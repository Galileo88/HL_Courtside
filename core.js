/* Deterministic daily coverage and conservative stat matching. */
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HoopWireCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function choose(seed, values, salt = "") {
    const index = parseInt(hashString(seed + "|" + salt), 36) % values.length;
    return values[index];
  }

  function assertSave(data) {
    if (!data || !Array.isArray(data.seasonLeagues) || data.seasonLeagues.length === 0) {
      throw new Error("This file does not contain a Hoop Land seasonLeagues array.");
    }
  }

  function teamDisplay(team) {
    if (!team) return "Unknown Team";
    const city = (team.city || "").trim();
    const name = (team.name || team.shortName || "Team").trim();
    return city ? `${city} ${name}` : name;
  }

  function playerDisplay(player) {
    if (!player) return "the player of the game";
    return [player.fn, player.ln].filter(Boolean).join(" ").trim() || "the player of the game";
  }

  function lastName(player) {
    return (player && player.ln) ? player.ln : playerDisplay(player);
  }

  function recordText(record) {
    if (!Array.isArray(record) || record.length < 2) return "—";
    return `${record[0]}-${record[1]}`;
  }

  function percentage(record) {
    if (!Array.isArray(record) || record.length < 2) return .5;
    const games = record[0] + record[1];
    return games ? record[0] / games : .5;
  }

  function pregameRecord(postRecord, wasWinner) {
    if (!Array.isArray(postRecord) || postRecord.length < 2) return [0, 0];
    return [
      Math.max(0, postRecord[0] - (wasWinner ? 1 : 0)),
      Math.max(0, postRecord[1] - (wasWinner ? 0 : 1))
    ];
  }

  function isCompleted(game, teams, currentGame) {
    return Number.isInteger(game.gId) && game.gId > 0 &&
      teams.has(game.homeTeam) && teams.has(game.awayTeam) && game.homeTeam !== game.awayTeam &&
      Number.isFinite(game.homeScore) && Number.isFinite(game.awayScore) &&
      game.homeScore >= 0 && game.awayScore >= 0 && game.homeScore !== game.awayScore &&
      game.winner === (game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam) &&
      !(currentGame?.inProgress && currentGame.gId === game.gId);
  }

  function seasonYear(league) { return league.season?.currentYear || league.season?.startingYear || "Season"; }
  function storyId(fingerprint, year, gid) { return `${fingerprint}:${year}:game:${gid}`; }
  function snapshotId(fingerprint, year, gid, pid) { return `${storyId(fingerprint, year, gid)}:player:${pid}`; }
  function validStats(stats) {
    return stats?.GP === 1 && ["PTS", "REB", "AST"].every(k => Number.isInteger(stats[k]) && stats[k] >= 0);
  }
  function coachForTeam(team) {
    const matches = (team?.frontOffice?.staff || []).filter(person => person.pos === 1 && person.tid === team.id);
    if (matches.length !== 1) return null;
    const person = matches[0];
    return structuredClone({id:person.id,tid:person.tid,fn:person.fn,ln:person.ln,
      appearance:person.appearance,suits:person.suits,isCoach:true});
  }
  function buildLookups(league) {
    const teams = new Map(), players = new Map(), newsByGame = new Map(), latestByTeam = new Map();
    for (const team of league.teams || []) {
      teams.set(team.id, team);
      for (const player of team.roster || []) players.set(player.id, player);
    }
    for (const player of league.freeAgents || []) players.set(player.id, player);
    for (const item of league.season?.news || []) {
      if (item.category === 1 && item.type === 9 && item.gid > 0) newsByGame.set(item.gid, item);
    }
    const completed = [];
    (league.season?.schedule || []).forEach((day, dayIndex) => {
      for (const game of day.results || []) {
        if (!isCompleted(game, teams, league.currentGame)) continue;
        completed.push({game, dayIndex});
        for (const tid of [game.homeTeam, game.awayTeam]) {
          const previous = latestByTeam.get(tid);
          if (!previous || previous.dayIndex < dayIndex) latestByTeam.set(tid, {dayIndex, games: [game]});
          else if (previous.dayIndex === dayIndex) previous.games.push(game);
        }
      }
    });
    return {teams, players, newsByGame, latestByTeam, completed,
      latestDay: completed.length ? Math.max(...completed.map(x => x.dayIndex)) : -1};
  }
  function captureSnapshots(league, fingerprint = buildFingerprint(league)) {
    const lookups = buildLookups(league), snapshots = [];
    for (const player of lookups.players.values()) {
      const latest = lookups.latestByTeam.get(player.tid);
      if (!latest || latest.games.length !== 1 || !validStats(player.gameStats)) continue;
      if (league.currentGame?.inProgress && [league.currentGame.homeTeam, league.currentGame.roadTeam].includes(player.tid)) continue;
      const game = latest.games[0];
      const team = lookups.teams.get(player.tid);
      const teamScore = game.homeTeam === player.tid ? game.homeScore : game.awayScore;
      // The save's per-game POTG counter is unused. Corroborate using team points instead.
      if (!team?.roster?.length || team.roster.some(p => !Number.isInteger(p.gameStats?.PTS) || p.gameStats.PTS < 0) ||
          team.roster.reduce((total, p) => total + p.gameStats.PTS, 0) !== teamScore ||
          player.gameStats.PTS > teamScore) continue;
      snapshots.push({id: snapshotId(fingerprint, seasonYear(league), game.gId, player.id),
        fingerprint, season: seasonYear(league), gid: game.gId, pid: player.id, day: latest.dayIndex + 1,
        stats: structuredClone(player.gameStats),
        player: structuredClone({id: player.id, tid: player.tid, fn: player.fn, ln: player.ln,
          num: player.num, appearance: player.appearance, accessories: player.accessories}),
        team: structuredClone({id: team.id, city: team.city, name: team.name, shortName: team.shortName,
          logoURL: team.logoURL, teamColors: team.teamColors, uniforms: team.uniforms, court: team.court}),
        capturedAt: new Date().toISOString()});
    }
    return snapshots;
  }

  function buildFingerprint(league) {
    const teams = (league.teams || [])
      .map(t => `${t.id}:${t.shortName || ""}:${t.name || ""}`)
      .sort()
      .join("|");
    const season = league.season || {};
    return hashString(`${league.leagueName}|${season.startingYear}|${teams}`);
  }

  function coverageThreshold(level) {
    if (level === "major") return 80;
    if (level === "standard") return 65;
    return 0;
  }

  function gameContext(game, dayIndex, league, lookups, snapshots = new Map(), fingerprint = buildFingerprint(league)) {
    const home = lookups.teams.get(game.homeTeam);
    const away = lookups.teams.get(game.awayTeam);
    const winner = lookups.teams.get(game.winner);
    const loser = game.winner === game.homeTeam ? away : home;
    const winnerIsHome = game.winner === game.homeTeam;

    const winnerScore = winnerIsHome ? game.homeScore : game.awayScore;
    const loserScore = winnerIsHome ? game.awayScore : game.homeScore;
    const winnerRecord = winnerIsHome ? game.homeRecord : game.awayRecord;
    const loserRecord = winnerIsHome ? game.awayRecord : game.homeRecord;
    const winnerPre = pregameRecord(winnerRecord, true);
    const loserPre = pregameRecord(loserRecord, false);
    const winnerPreGames = winnerPre[0] + winnerPre[1];
    const loserPreGames = loserPre[0] + loserPre[1];

    const margin = Math.abs(winnerScore - loserScore);
    const close = margin <= 3;
    const blowout = margin >= 12;
    const upset =
      winnerPreGames >= 5 &&
      loserPreGames >= 5 &&
      percentage(winnerPre) + 0.15 < percentage(loserPre);

    const news = lookups.newsByGame.get(game.gId);
    const nativeRating = news ? Number(news.rating || 0) : 5;
    let importance = nativeRating * 5;
    if (close) importance += 10;
    if (blowout && margin >= 15) importance += 5;
    if (upset) importance += 20;
    if (game.gameType && game.gameType !== 0) importance += 25;

    const snapshot = snapshots.get(snapshotId(fingerprint, seasonYear(league), game.gId, game.potg));
    const potgStatsTrusted = !!snapshot && validStats(snapshot.stats);
    const potg = potgStatsTrusted ? snapshot.player : null;

    const season = league.season || {};
    return {
      game,
      gameBall: structuredClone(league.gameballs?.[Number(league.settings?.gameBall) || 0] ||
        {pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}),
      dayIndex,
      dayNumber: dayIndex + 1,
      seasonYear: season.currentYear || season.startingYear || "Season",
      home,
      away,
      winner,
      loser,
      winnerName: teamDisplay(winner),
      loserName: teamDisplay(loser),
      winnerScore,
      loserScore,
      winnerRecord,
      loserRecord,
      winnerPre,
      loserPre,
      margin,
      close,
      blowout,
      upset,
      importance,
      nativeRating,
      potg,
      potgName: playerDisplay(potg),
      potgStatsTrusted,
      potgStats: snapshot?.stats,
      potgSnapshot: snapshot,
      scenePlayer: potg || winner?.roster?.[0],
      leagueName: league.leagueName || "League",
      coach: coachForTeam(winner)
    };
  }

  function formatStatLine(stats) {
    if (!stats) return "";
    const parts = ["PTS", "REB", "AST"].map((k, i) => {
      const label = ["point", "rebound", "assist"][i];
      return `${stats[k]} ${label}${stats[k] === 1 ? "" : "s"}`;
    });
    for (const [k, label] of [["STL", "steal"], ["BLK", "block"]]) {
      if (Number.isInteger(stats[k]) && stats[k] > 0) parts.push(`${stats[k]} ${label}${stats[k] === 1 ? "" : "s"}`);
    }
    for (const [made, attempted, label] of [["FGM", "FGA", "from the field"], ["TPM", "TPA", "from three"], ["FTM", "FTA", "at the line"]]) {
      if (Number.isInteger(stats[made]) && Number.isInteger(stats[attempted]) && stats[attempted] > 0 && stats[made] >= 0 && stats[made] <= stats[attempted]) {
        parts.push(`${stats[made]}-for-${stats[attempted]} ${label}`);
      }
    }

    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }

  function gameType(ctx) {
    if (ctx.upset) return "Upset";
    if (ctx.close) return "Close game";
    if (ctx.blowout) return "Statement win";
    return "Game recap";
  }

  function headline(ctx, seed) {
    if (ctx.upset) {
      return choose(seed, [
        `${ctx.winnerName} knocks off ${ctx.loserName} in ${ctx.winnerScore}-${ctx.loserScore} win`,
        `${ctx.winnerName} delivers upset of ${ctx.loserName}`,
        `${ctx.winnerName} stuns ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`
      ], "headline-upset");
    }

    if (ctx.close) {
      return choose(seed, [
        `${ctx.winnerName} edges ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`,
        `${ctx.winnerName} slips past ${ctx.loserName} in close finish`,
        `${ctx.winnerName} holds off ${ctx.loserName} by ${ctx.margin}`
      ], "headline-close");
    }

    if (ctx.blowout) {
      return choose(seed, [
        `${ctx.winnerName} rolls past ${ctx.loserName} in ${ctx.margin}-point win`,
        `${ctx.winnerName} handles ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`,
        `${ctx.winnerName} pulls away from ${ctx.loserName} in convincing win`
      ], "headline-blowout");
    }

    if (ctx.potg && ctx.potg.tid === ctx.game.winner) {
      return choose(seed, [
        `${ctx.potgName} helps ${ctx.winnerName} past ${ctx.loserName}`,
        `${ctx.winnerName} beats ${ctx.loserName} behind ${lastName(ctx.potg)}`,
        `${ctx.winnerName} tops ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`
      ], "headline-normal");
    }

    return `${ctx.winnerName} beats ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`;
  }

  function fictionalQuote(ctx, seed) {
    if (ctx.close) {
      return choose(seed, [
        "We knew it was going to be a battle, so the biggest thing was staying composed.",
        "Games like that come down to a few possessions, and we found a way to finish.",
        "We had to stay with it all the way through, and we did enough to get the win."
      ], "quote-close");
    }
    if (ctx.upset) {
      return choose(seed, [
        "We respected the matchup, but our focus was on playing our game and competing every possession.",
        "We came in believing we could get the job done, and everybody stayed together.",
        "The result matters, but the biggest thing was how connected we were as a group."
      ], "quote-upset");
    }
    if (ctx.blowout) {
      return choose(seed, [
        "We came out focused and kept the pressure on.",
        "It was a complete team effort, and we stayed with what was working.",
        "Everybody contributed, and that is the kind of effort we want to build on."
      ], "quote-blowout");
    }
    return choose(seed, [
      "We did what we needed to do and came away with the result we wanted.",
      "The biggest thing was staying together and making the right plays.",
      "It was a good team effort, and now we have to keep building from it."
    ], "quote-normal");
  }

  function paragraphOne(ctx, seed) {
    const winnerRecord = recordText(ctx.winnerRecord);
    const loserRecord = recordText(ctx.loserRecord);

    if (ctx.upset) {
      return choose(seed, [
        `${ctx.winnerName} pulled off the upset with a ${ctx.winnerScore}-${ctx.loserScore} victory over ${ctx.loserName}. The result moved ${ctx.winnerName} to ${winnerRecord}, while ${ctx.loserName} fell to ${loserRecord}.`,
        `${ctx.winnerName} entered the matchup behind ${ctx.loserName} in the standings but came away with a ${ctx.winnerScore}-${ctx.loserScore} win. The victory improved ${ctx.winnerName} to ${winnerRecord}.`
      ], "p1-upset");
    }

    if (ctx.close) {
      return choose(seed, [
        `${ctx.winnerName} escaped with a ${ctx.winnerScore}-${ctx.loserScore} victory over ${ctx.loserName}, with only ${ctx.margin} point${ctx.margin === 1 ? "" : "s"} separating the teams. The win moved ${ctx.winnerName} to ${winnerRecord}.`,
        `Little separated ${ctx.winnerName} and ${ctx.loserName}, but ${ctx.winnerName} came away with a ${ctx.winnerScore}-${ctx.loserScore} victory. ${ctx.loserName} fell to ${loserRecord} with the loss.`
      ], "p1-close");
    }

    if (ctx.blowout) {
      return choose(seed, [
        `${ctx.winnerName} had little trouble with ${ctx.loserName}, earning a ${ctx.winnerScore}-${ctx.loserScore} victory. The ${ctx.margin}-point win moved ${ctx.winnerName} to ${winnerRecord}.`,
        `${ctx.winnerName} controlled the scoreboard in a ${ctx.winnerScore}-${ctx.loserScore} win over ${ctx.loserName}. ${ctx.winnerName} improved to ${winnerRecord}, while ${ctx.loserName} moved to ${loserRecord}.`
      ], "p1-blowout");
    }

    return choose(seed, [
      `${ctx.winnerName} picked up a ${ctx.winnerScore}-${ctx.loserScore} victory over ${ctx.loserName}. The win moved ${ctx.winnerName} to ${winnerRecord}, while ${ctx.loserName} fell to ${loserRecord}.`,
      `${ctx.winnerName} defeated ${ctx.loserName} ${ctx.winnerScore}-${ctx.loserScore}, adding another win to its season. The result put ${ctx.winnerName} at ${winnerRecord}.`
    ], "p1-normal");
  }

  function paragraphTwo(ctx, seed, quotesEnabled) {
    if (!ctx.potg) {
      return `${ctx.winnerName} finished ${ctx.margin} points ahead on the scoreboard. The final score was ${ctx.winnerScore}-${ctx.loserScore}.`;
    }

    const stats = ctx.potgStatsTrusted ? formatStatLine(ctx.potgStats) : "";
    const firstSentence = stats
      ? `${ctx.potgName} was named player of the game after finishing with ${stats}.`
      : `${ctx.potgName} was named player of the game for ${ctx.winnerName}.`;

    if (!quotesEnabled || ctx.potg.tid !== ctx.game.winner) {
      return `${firstSentence} ${ctx.winnerName} finished with a ${ctx.margin}-point advantage on the scoreboard.`;
    }

    const quote = fictionalQuote(ctx, seed);
    return `${firstSentence} "${quote}" ${lastName(ctx.potg)} said.`;
  }

  function paragraphThree(ctx, seed) {
    const wr = ctx.winnerRecord || [0, 0];
    const lr = ctx.loserRecord || [0, 0];
    const winnerRecord = recordText(wr);
    const loserRecord = recordText(lr);

    return choose(seed, [
      `The win improved ${ctx.winnerName} to ${winnerRecord}, while ${ctx.loserName} fell to ${loserRecord}.`,
      `${ctx.winnerName} moved to ${winnerRecord} with the victory. ${ctx.loserName} dropped to ${loserRecord}.`,
      `With the victory, ${ctx.winnerName} picked up its ${wr[0]}${ordinalSuffix(wr[0])} win of the season and improved to ${winnerRecord}. ${ctx.loserName} fell to ${loserRecord}.`
    ], "p3");
  }

  function ordinalSuffix(value) {
    const n = Math.abs(Number(value));
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    if (n % 10 === 1) return "st";
    if (n % 10 === 2) return "nd";
    if (n % 10 === 3) return "rd";
    return "th";
  }

  function optionalParagraph(ctx, seed) {
    if (ctx.upset) {
      return `${ctx.winnerName} entered the game with a lower pregame winning percentage than ${ctx.loserName}, making the result one of the more notable outcomes of the day.`;
    }
    if (ctx.close) {
      return `The ${ctx.margin}-point final margin made it one of the tighter results of Day ${ctx.dayNumber}.`;
    }
    if (ctx.margin >= 15) {
      return `${ctx.winnerName}'s ${ctx.margin}-point margin was large enough to qualify as one of the day's more decisive results so far.`;
    }
    return "";
  }

  function generateArticle(ctx, fingerprint, quotesEnabled) {
    const id = `${fingerprint}:${ctx.seasonYear}:game:${ctx.game.gId}`;
    const seed = id;
    const paragraphs = [
      paragraphOne(ctx, seed),
      paragraphTwo(ctx, seed, quotesEnabled),
      paragraphThree(ctx, seed)
    ];
    const extra = optionalParagraph(ctx, seed);
    if (extra) paragraphs.push(extra);
    if (quotesEnabled && ctx.coach) paragraphs.push(coachParagraph(ctx,seed));

    return {
      id,
      fingerprint,
      season: ctx.seasonYear,
      day: ctx.dayNumber,
      gid: ctx.game.gId,
      type: gameType(ctx),
      importance: ctx.importance,
      headline: headline(ctx, seed),
      paragraphs,
      templateVersion: 3,
      leagueName: ctx.leagueName,
      playerStats: ctx.potgStats ? structuredClone(ctx.potgStats) : null,
      playerId: ctx.potg?.id ?? null,
      playerName: ctx.potgStats ? ctx.potgName : null,
      gameSummary: {home: {id:ctx.home.id,name:teamDisplay(ctx.home),logoURL:ctx.home.logoURL || null,score:ctx.game.homeScore},
        away: {id:ctx.away.id,name:teamDisplay(ctx.away),logoURL:ctx.away.logoURL || null,score:ctx.game.awayScore}},
      quotesEnabled,
      coach: ctx.coach ? structuredClone(ctx.coach) : null,
      createdAt: new Date().toISOString()
    };
  }


  function candidates(league, fingerprint, snapshots, coverage = "standard") {
    const lookups = buildLookups(league);
    return lookups.completed.filter(x => x.dayIndex === lookups.latestDay)
      .map(x => gameContext(x.game, x.dayIndex, league, lookups, snapshots, fingerprint))
      .filter(ctx => ctx.importance >= coverageThreshold(coverage))
      .sort((a,b) => b.importance - a.importance || b.game.gId - a.game.gId);
  }
  function shouldGenerate(existing, ctx) {
    return !existing || (existing.templateVersion === 3 &&
      ((!existing.playerStats && ctx.potgStatsTrusted) || (!existing.coach && !!ctx.coach)));
  }
  function coachParagraph(ctx, seed) {
    const quote = choose(seed,ctx.close ? [
      "We had to stay composed, and I'm pleased we came away with the win.",
      "It was a close game, and the group stayed together."
    ] : ctx.blowout ? [
      "I'm pleased with the result, but we have to keep working as a group.",
      "This was a good win for our team, and now we have to build on it."
    ] : [
      "It is good to get the win. We will keep working to improve together.",
      "I'm pleased we came away with the result. Our focus now is the next game."
    ],"coach-quote");
    return `"${quote}" ${ctx.winnerName} head coach ${playerDisplay(ctx.coach)} said after the game.`;
  }
  return {hashString, choose, assertSave, teamDisplay, playerDisplay, buildFingerprint, isCompleted,
    buildLookups, captureSnapshots, snapshotId, storyId, seasonYear, validStats, gameContext,
    candidates, formatStatLine, generateArticle, shouldGenerate, coachForTeam, coachParagraph};
});
