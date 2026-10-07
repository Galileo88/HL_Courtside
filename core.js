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
          gender: player.gender, num: player.num, appearance: player.appearance, accessories: player.accessories}),
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

    // Verified box scores for everyone in this game, from the same snapshot checks.
    const box = [];
    for (const team of [home, away]) for (const player of team?.roster || []) {
      const snap = snapshots.get(snapshotId(fingerprint, seasonYear(league), game.gId, player.id));
      if (snap && validStats(snap.stats) && snap.team?.id === team.id)
        box.push({pid: snap.pid, tid: team.id, name: playerDisplay(snap.player), last: lastName(snap.player), stats: snap.stats});
    }
    const slate = lookups.completed.filter(x => x.dayIndex === dayIndex).map(x => Math.abs(x.game.homeScore - x.game.awayScore));
    const season = league.season || {};
    return {
      game,
      box,
      dayGames: slate.length,
      widestOfDay: slate.length >= 3 && slate.filter(m => m >= margin).length === 1,
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

  /* Newsroom voice helpers: AP-style numbers, short references and agreement. */
  const smallNumbers = ["zero","one","two","three","four","five","six","seven","eight","nine"];
  function num(n) { return Number.isInteger(n) && n >= 0 && n < 10 ? smallNumbers[n] : String(n); }
  function plural(n, word, words = word + "s") { return `${num(n)} ${n === 1 ? word : words}`; }
  function capitalize(text) { return text ? text.charAt(0).toUpperCase() + text.slice(1) : ""; }
  function listJoin(parts) { return parts.length < 2 ? parts.join("") : parts.slice(0, -1).join(", ") + " and " + parts.at(-1); }
  function surname(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length > 2 && /^(?:jr|sr|ii|iii|iv|v)\.?$/i.test(parts.at(-1))) parts.pop();
    return parts.at(-1) || String(name || "");
  }
  function possessive(name) { return /s$/i.test(name) ? `${name}'` : `${name}'s`; }
  // Hoop Land records gender 0 for men and 1 for women; anything else keeps the name.
  function pronoun(person) { return person?.gender === 0 ? "he" : person?.gender === 1 ? "she" : null; }
  // Accepts a native team, a snapshot team or an archived score summary.
  function teamRef(team) {
    let city = "", nickname = "";
    if (team?.nickname) { nickname = team.nickname; city = team.city || ""; }
    else if (team && Object.prototype.hasOwnProperty.call(team, "city")) {
      city = (team.city || "").trim(); nickname = (team.name || team.shortName || "Team").trim();
    } else {
      const words = String(team?.name || "Team").trim().split(/\s+/);
      nickname = words.pop(); city = words.join(" ");
    }
    const display = city ? `${city} ${nickname}` : nickname;
    return {display, city: city || null, nickname, full: `the ${display}`, nick: `the ${nickname}`,
      short: city || `the ${nickname}`, plural: /s$/i.test(nickname) && !/(?:ss|us)$/i.test(nickname)};
  }
  // Present-tense verb for a bare nickname: "Wolverines stun", "Thunder stuns".
  function verb(team, base) {
    if (team.plural) return base;
    const irregular = {are: "is", have: "has", were: "was", do: "does"};
    return irregular[base] || base + (/(?:s|sh|ch|x|z)$/.test(base) ? "es" : "s");
  }
  function shotPair(s, made, attempted) {
    return Number.isInteger(s?.[made]) && Number.isInteger(s?.[attempted]) && s[attempted] > 0 && s[made] >= 0 && s[made] <= s[attempted];
  }
  function quoteParagraph(text, attribution) {
    // AP style: the attribution follows the first sentence.
    const sentences = String(text).match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) || [String(text)];
    const first = sentences[0].replace(/\.$/, ","), rest = sentences.slice(1).join(" ");
    return `“${first}” ${attribution} said.${rest ? ` “${rest}”` : ""}`;
  }
  const statLabels = {PTS: "points", REB: "rebounds", AST: "assists", STL: "steals", BLK: "blocks"};
  function lineSummary(s) {
    const parts = [plural(s.PTS, "point")];
    for (const [k, min] of [["REB", 3], ["AST", 3], ["STL", 2], ["BLK", 2]])
      if (Number.isInteger(s[k]) && s[k] >= min) parts.push(plural(s[k], statLabels[k].replace(/s$/, ""), statLabels[k]));
    return listJoin(parts);
  }
  function doubles(stats) { return Object.keys(statLabels).filter(k => Number.isInteger(stats?.[k]) && stats[k] >= 10); }

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
      if (shotPair(stats, made, attempted)) parts.push(`${stats[made]}-for-${stats[attempted]} ${label}`);
    }
    return listJoin(parts);
  }

  function gameType(ctx) {
    if (ctx.upset) return "Upset";
    if (ctx.close) return "Close game";
    if (ctx.blowout) return "Statement win";
    return "Game recap";
  }

  function featured(ctx) {
    if (!ctx.potg || !ctx.potgStatsTrusted || !ctx.potgStats) return null;
    const s = ctx.potgStats, name = playerDisplay(ctx.potg);
    return {name, last: ctx.potg.ln || surname(name), he: pronoun(ctx.potg), s, onWinner: ctx.potg.tid === ctx.game.winner,
      team: ctx.potg.tid === ctx.game.winner ? teamRef(ctx.winner) : teamRef(ctx.loser),
      teamScore: ctx.potg.tid === ctx.game.winner ? ctx.winnerScore : ctx.loserScore, doubles: doubles(s),
      get headliner() { return this.doubles.length >= 2 || s.PTS >= 10 || (this.teamScore > 0 && s.PTS / this.teamScore >= .25); }};
  }
  // The headline clause for a stat line: "had 14 points and 11 rebounds".
  function statClause(p) {
    const s = p.s, d = p.doubles;
    if (d.length >= 3) {
      const kind = ["", "", "", "triple-double", "quadruple-double", "quintuple-double"][d.length];
      return `had ${listJoin(d.map(k => `${s[k]} ${statLabels[k]}`))} for a ${kind}`;
    }
    if (d.length === 2) return `had ${listJoin(d.map(k => `${s[k]} ${statLabels[k]}`))}`;
    const other = ["REB", "AST"].filter(k => Number.isInteger(s[k]) && s[k] >= 5 && s[k] > s.PTS)[0];
    if (other) return `had ${plural(s.PTS, "point")} and ${plural(s[other], statLabels[other].replace(/s$/, ""), statLabels[other])}`;
    return `scored ${plural(s.PTS, "point")}`;
  }

  function headline(ctx, seed) {
    const W = teamRef(ctx.winner), L = teamRef(ctx.loser), w = W.nickname, l = L.nickname;
    const score = `${ctx.winnerScore}-${ctx.loserScore}`, p = featured(ctx), star = p?.onWinner && p.headliner ? p : null;
    const v = base => verb(W, base);
    if (star && star.doubles.length >= 3) {
      return choose(seed, [
        `${star.last} posts ${["","","","triple-double","quadruple-double","quintuple-double"][star.doubles.length]} as ${w} ${v("beat")} ${l}`,
        `${star.last} fills the box score, ${w} ${v("top")} ${l} ${score}`
      ], "headline-triple");
    }
    if (ctx.upset) {
      return choose(seed, [
        `${w} ${v("stun")} ${l} ${score}${star ? ` behind ${star.last}` : ""}`,
        star ? `${star.last}, ${w} ${v("upset")} ${l} ${score}` : `${w} ${v("knock")} off ${l} ${score}`,
        `${w} ${v("upend")} ${l}, ${score}`
      ], "headline-upset");
    }
    if (ctx.close) {
      return choose(seed, [
        `${w} ${v("edge")} ${l} ${score}`,
        star ? `${star.last} helps ${w} slip past ${l} ${score}` : `${w} ${v("slip")} past ${l} ${score}`,
        `${w} ${v("get")} past ${l} ${score}`
      ], "headline-close");
    }
    if (ctx.blowout) {
      return choose(seed, [
        `${w} ${v("rout")} ${l} ${score}`,
        `${w} ${v("roll")} past ${l} ${score}${star ? ` behind ${star.last}` : ""}`,
        star ? `${star.last} powers ${w} to ${ctx.margin}-point win over ${l}` : `${w} ${v("pull")} away from ${l}, ${score}`
      ], "headline-blowout");
    }
    if (star) {
      return choose(seed, star.doubles.length === 2 ? [
        `${possessive(star.last)} double-double lifts ${w} past ${l} ${score}`,
        `${star.last} posts double-double, ${w} ${v("beat")} ${l} ${score}`
      ] : [
        `${star.last} scores ${star.s.PTS}, ${w} ${v("beat")} ${l} ${score}`,
        `${star.last} leads ${w} past ${l}, ${score}`,
        `${w} ${v("top")} ${l} ${score} behind ${star.last}`
      ], "headline-normal");
    }
    return `${w} ${v("beat")} ${l} ${score}`;
  }

  function quoteBank(ctx, seed, salt) {
    const pick = options => choose(seed, options, salt);
    if (salt === "quote-coach") {
      if (ctx.close) return pick([
        "That was a grind. Neither team gave an inch, and I'm proud of how our group competed.",
        "Those are the ones that test you. We didn't play perfect, but we were good enough at the end.",
        "Give them credit, they made it hard on us. I'll take a win like that every time.",
        "Games like that grow you up. I'm happy for our guys."
      ]);
      if (ctx.upset) return pick([
        "There's a lot of respect in our locker room for that team. But our guys believed they could win this game, and they played like it.",
        "We don't look at the standings. We came in with a plan and our guys trusted it.",
        "That's a quality opponent. Beating a team like that tells our group what it's capable of.",
        "I told our guys before the game that the records don't matter once the ball goes up. They believed it."
      ]);
      if (ctx.blowout) return pick([
        "That's about as complete as we've been. Now the challenge is doing it again.",
        "I liked our focus from the start. When we play with that kind of edge, we're a tough out.",
        "Good night for us. We'll enjoy it, then get back to work tomorrow.",
        "We were sharp. I don't want to make too much of one night, but that's the standard."
      ]);
      return pick([
        "Good win. There's stuff we have to clean up, but I'll take it.",
        "It wasn't always pretty. Our guys found a way, and that's what good teams do.",
        "We handled our business. That's what I want to see from this group.",
        "I thought we were the more connected team tonight. Still plenty to work on."
      ]);
    }
    if (ctx.close) return pick([
      "Those are the games you want to be in. We stayed together and did just enough.",
      "That one was a fight. Credit to them, they made us earn every bucket.",
      "Close games, you can't get rattled. We stayed level and got the win.",
      "My heart's still racing a little bit. That's a good team, and we'll take it.",
      "We didn't make it easy on ourselves. But we got the stops when we had to, and that's what matters."
    ]);
    if (ctx.upset) return pick([
      "People can look at the records all they want. Nobody in here was surprised.",
      "We knew what kind of team they were. We just wanted to go out and play our game.",
      "That's a good team. Beating them, that's a confidence thing for us.",
      "Honestly, we had nothing to lose. We just went out and played free.",
      "I don't think anybody outside our locker room gave us a chance. That's fine with us."
    ]);
    if (ctx.blowout) return pick([
      "When we're playing together like that, we're hard to beat. Everybody was locked in.",
      "We just wanted to come out and set the tone. It felt good to put a full game together.",
      "That's the version of us we want to see every night.",
      "We were sharing it, getting stops, having fun. That's when we're at our best.",
      "We've been waiting on a game like that. Now we've got to keep it going."
    ]);
    return pick([
      "We came in and handled our business. That's all you can ask.",
      "It wasn't perfect, but a win's a win. We'll look at the film and get better.",
      "Just trying to make the right plays. My teammates put me in good spots tonight.",
      "I just took what the defense gave me. Shots were falling, so I kept shooting.",
      "Good team win. We did what we came here to do."
    ]);
  }

  function recordNote(ref, pre, post, won) {
    const r = recordText(post), even = post[0] === post[1];
    if (won && even) return `${ref} got back to .500 at ${r}`;
    if (won && pre[0] <= pre[1] && post[0] > post[1]) return `${ref} moved above .500 at ${r}`;
    if (!won && pre[0] >= pre[1] && post[0] < post[1]) return `${ref} slipped below .500 at ${r}`;
    if (!won && even) return `${ref} fell to .500 at ${r}`;
    return `${ref} ${won ? "improved" : "fell"} to ${r}`;
  }
  function gamesBetter(a, b) { // How far record a sits ahead of record b, in games.
    const gap = ((a[0] - b[0]) + (b[1] - a[1])) / 2;
    return gap <= 0 ? "" : gap === .5 ? "a half-game" : gap % 1 ? `${Math.floor(gap)} 1/2 games` : plural(gap, "game");
  }

  function teamTotals(box, tid) {
    const rows = box.filter(r => r.tid === tid);
    if (!rows.length) return null;
    const totals = {};
    for (const k of ["PTS","REB","AST","TO","FGM","FGA","TPM","TPA","STL","BLK"])
      totals[k] = rows.every(r => Number.isInteger(r.stats[k]) && r.stats[k] >= 0) ? rows.reduce((n, r) => n + r.stats[k], 0) : null;
    return totals;
  }
  // One box-score edge that separated the teams, chosen by how lopsided it was.
  function teamEdge(ctx, W, L) {
    const w = teamTotals(ctx.box || [], ctx.winner?.id), l = teamTotals(ctx.box || [], ctx.loser?.id);
    if (!w || !l) return "";
    const options = [];
    if (w.FGA > 0 && l.FGA > 0 && w.FGM !== null && l.FGM !== null) {
      const a = w.FGM / w.FGA, b = l.FGM / l.FGA;
      if (b <= .36 && a - b >= .1) options.push({score: (a - b) * 3, text: `${capitalize(L.short)} shot just ${l.FGM}-of-${l.FGA} from the field.`});
      else if (a >= .55 && a - b >= .1) options.push({score: (a - b) * 3, text: `${capitalize(W.short)} shot ${Math.round(a * 100)}% from the field, making ${w.FGM} of ${w.FGA} attempts.`});
    }
    if (w.REB !== null && l.REB !== null && Math.abs(w.REB - l.REB) >= Math.max(4, .3 * Math.min(w.REB, l.REB))) {
      options.push({score: Math.abs(w.REB - l.REB) / Math.max(1, Math.min(w.REB, l.REB)),
        text: w.REB > l.REB ? `${capitalize(W.short)} owned the glass, outrebounding ${L.short} ${w.REB}-${l.REB}.` :
          `${capitalize(L.short)} won the rebounding battle ${l.REB}-${w.REB} and still came up short.`});
    }
    if (w.TO !== null && l.TO !== null && l.TO - w.TO >= 3)
      options.push({score: (l.TO - w.TO) / Math.max(2, w.TO), text: w.TO === 0 ? `${capitalize(L.short)} turned it over ${plural(l.TO, "time")}; ${W.short} didn't commit a single turnover.` :
        `${capitalize(L.short)} turned it over ${plural(l.TO, "time")}, ${num(l.TO - w.TO)} more than ${W.short}.`});
    if (w.TPM !== null && l.TPM !== null && w.TPM - l.TPM >= 3)
      options.push({score: (w.TPM - l.TPM) / Math.max(2, l.TPM), text: `${capitalize(W.short)} won the 3-point battle, hitting ${num(w.TPM)} from deep to ${possessive(L.short)} ${num(l.TPM)}.`});
    return options.sort((a, b) => b.score - a.score)[0]?.text || "";
  }

  function lede(ctx, seed, W, L, p) {
    const score = `${ctx.winnerScore}-${ctx.loserScore}`, star = p?.onWinner && p.headliner ? p : null;
    const pick = options => capitalize(choose(seed, options, "lede"));
    if (star) {
      const did = statClause(star), Name = star.name;
      if (ctx.upset) return pick([
        `${Name} ${did}, and ${W.full} knocked off ${L.full} ${score}.`,
        `${W.full} upset ${L.full} ${score}, getting ${star.s.PTS} points from ${Name}.`
      ]);
      if (ctx.close) return pick([
        `${Name} ${did}, and ${W.full} edged ${L.full} ${score}.`,
        `${W.full} slipped past ${L.full} ${score}, with ${Name} leading the way.`
      ]);
      if (ctx.blowout) return pick([
        `${Name} ${did}, and ${W.full} routed ${L.full} ${score}.`,
        `${W.full} rolled past ${L.full} ${score} behind ${Name}, who ${did}.`
      ]);
      return pick([
        `${Name} ${did} to lead ${W.full} past ${L.full} ${score}.`,
        `${Name} ${did}, and ${W.full} beat ${L.full} ${score}.`,
        `${W.full} got ${plural(star.s.PTS, "point")} from ${Name} and beat ${L.full} ${score}.`
      ]);
    }
    if (ctx.upset) return pick([`${capitalize(W.full)} knocked off ${L.full} ${score}.`, `${capitalize(W.full)} upset ${L.full} ${score}.`]);
    if (ctx.close) return pick([`${capitalize(W.full)} edged ${L.full} ${score}.`, `${capitalize(W.full)} slipped past ${L.full} ${score}.`]);
    if (ctx.blowout) return pick([`${capitalize(W.full)} routed ${L.full} ${score}.`, `${capitalize(W.full)} rolled past ${L.full} ${score}.`]);
    return pick([`${capitalize(W.full)} beat ${L.full} ${score}.`, `${capitalize(W.full)} took care of ${L.full}, ${score}.`]);
  }

  function contextParagraph(ctx, seed, W, L) {
    const wr = ctx.winnerRecord, lr = ctx.loserRecord, hasRecords = [wr, lr].every(r => Array.isArray(r) && r.length >= 2);
    const records = hasRecords ? `${capitalize(recordNote(W.short, ctx.winnerPre, wr, true))}, while ${recordNote(L.short, ctx.loserPre, lr, false)}.` : "";
    if (ctx.upset) {
      const gap = gamesBetter(ctx.loserPre, ctx.winnerPre);
      const turn = choose(seed, ["and left with the kind of loss that gets noticed around the league", "and still couldn't solve a team it was supposed to handle", "which made this one a genuine surprise"], "upset-turn");
      return `${capitalize(L.short)} came in ${recordText(ctx.loserPre)}${gap ? `, ${gap} better than ${W.short},` : ""} ${turn}. ${records}`.trim();
    }
    if (ctx.close) {
      return `${choose(seed, [
        `Only ${plural(ctx.margin, "point")} separated the teams at the finish.`,
        `It was a ${ctx.margin}-point game at the end, about as close as they come.`,
        `The final margin was a single possession.`
      ], "close-context")} ${records}`.trim();
    }
    if (ctx.blowout) {
      const widest = ctx.widestOfDay ? ` It was the most lopsided result on a ${num(ctx.dayGames)}-game slate.` : "";
      return `The ${ctx.margin}-point margin left little room for debate.${widest} ${records}`.trim();
    }
    const better = hasRecords && ctx.winnerPre[0] + ctx.winnerPre[1] >= 5 && percentage(ctx.loserPre) - percentage(ctx.winnerPre) >= .08;
    return better ? `${records} ${capitalize(L.short)} had the better record coming in.` : records;
  }

  function starParagraph(ctx, seed, W, L, p) {
    if (!p) return ctx.potg ? `${ctx.potgName} was named player of the game.` : "";
    const s = p.s, last = p.last, team = p.team.short;
    const fg = shotPair(s, "FGM", "FGA") && s.FGA >= 3 ? s.FGM / s.FGA : null;
    const threes = fg !== null && shotPair(s, "TPM", "TPA") && s.TPM > 0 && s.TPM <= s.FGM ? `, including ${s.TPM === 1 ? "a 3-pointer" : `${num(s.TPM)} 3-pointers`}` : "";
    const shooting = fg !== null ? `${s.FGM}-of-${s.FGA} shooting${threes}` : "";
    const share = p.teamScore > 0 && s.PTS >= 4 && s.PTS / p.teamScore >= .3;
    if (!p.onWinner) return `${p.name} was the best player on the floor in a losing effort for ${L.short}, finishing with ${lineSummary(s)}${shooting ? ` on ${shooting}` : ""}.`;
    if (!p.headliner) return `${p.name} earned player of the game honors with ${lineSummary(s)}${shooting ? ` on ${shooting}` : ""}.`;
    let first = "";
    if (fg !== null && s.FGA >= 6 && fg <= .35) first = `It wasn't efficient. ${last} needed ${plural(s.FGA, "shot")} to get there, going ${s.FGM}-of-${s.FGA}${share ? `, but still supplied ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points` : ""}.`;
    else if (fg !== null && fg >= .6 && s.FGA >= 4) first = choose(seed, [
      `${last} barely wasted a possession, going ${s.FGM}-of-${s.FGA} from the field${threes}${share ? `${threes ? "," : ""} and accounting for ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points` : ""}.`,
      `${last} needed just ${plural(s.FGA, "shot")} to get there, making ${num(s.FGM)}${threes}.`
    ], "star-efficient");
    else if (shooting && share) first = choose(seed, [
      `${last} accounted for ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points on ${shooting}.`,
      `${last} carried the scoring load on ${shooting}, supplying ${num(s.PTS)} of the team's ${p.teamScore} points.`
    ], "star-share");
    else if (shooting) first = `${last} got there on ${shooting}.`;
    else if (share) first = `${last} supplied ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points.`;
    const extras = ["REB", "AST", "STL", "BLK"].filter(k => !p.doubles.includes(k) && Number.isInteger(s[k]) && s[k] >= ({REB: 4, AST: 3, STL: 2, BLK: 2})[k])
      .map(k => plural(s[k], statLabels[k].replace(/s$/, ""), statLabels[k]));
    const clean = Number.isInteger(s.TO) && s.TO === 0 && s.PTS >= 5, sloppy = Number.isInteger(s.TO) && s.TO >= 4;
    let second = "";
    if (extras.length) second = p.he ? `${capitalize(p.he)} also had ${listJoin(extras)}${clean ? ` ${extras.length > 1 ? "without a turnover" : "and didn't commit a turnover"}` : ""}.` :
      `Throw in ${listJoin(extras)}${clean ? " and zero turnovers" : ""}, and it was a full night's work.`;
    else if (clean) second = `${p.he ? capitalize(p.he) : last} didn't commit a turnover.`;
    if (sloppy) second += `${second ? " " : ""}The one blemish: ${plural(s.TO, "turnover")}.`;
    return [first, second].filter(Boolean).join(" ");
  }

  function supportParagraph(ctx, seed, W, L, p) {
    const box = ctx.box || [], parts = [];
    const ranked = tid => box.filter(r => r.tid === tid && r.stats.PTS > 0).sort((a, b) => b.stats.PTS - a.stats.PTS || a.pid - b.pid);
    const helper = ranked(ctx.winner?.id).find(r => r.pid !== ctx.potg?.id);
    if (helper) {
      const s = helper.stats, bench = s.GS === 0 ? " off the bench" : "";
      const extra = ["REB", "AST"].filter(k => Number.isInteger(s[k]) && s[k] >= 4).map(k => plural(s[k], statLabels[k].replace(/s$/, ""), statLabels[k]));
      const verbText = p?.onWinner ? "added" : `led ${W.short} with`;
      parts.push(`${helper.name} ${verbText} ${plural(s.PTS, "point")}${extra.length ? ` and ${listJoin(extra)}` : ""}${bench}.`);
    }
    const top = ranked(ctx.loser?.id).find(r => r.pid !== ctx.potg?.id);
    if (top) {
      const s = top.stats, cold = shotPair(s, "FGM", "FGA") && s.FGA >= 5 && s.FGM / s.FGA <= .35;
      parts.push(`${top.name} led ${L.short} with ${plural(s.PTS, "point")}${cold ? `, but went ${s.FGM}-of-${s.FGA} from the field` : ""}.`);
    }
    const edge = teamEdge(ctx, W, L);
    if (edge) parts.push(edge);
    return parts.join(" ");
  }

  function generateArticle(ctx, fingerprint, quotesEnabled) {
    const id = `${fingerprint}:${ctx.seasonYear}:game:${ctx.game.gId}`;
    const seed = id, W = teamRef(ctx.winner), L = teamRef(ctx.loser), p = featured(ctx);
    const paragraphs = [lede(ctx, seed, W, L, p), contextParagraph(ctx, seed, W, L), starParagraph(ctx, seed, W, L, p), supportParagraph(ctx, seed, W, L, p)];
    if (quotesEnabled && p?.onWinner) paragraphs.push(quoteParagraph(quoteBank(ctx, seed, "quote-player"), p.last));
    if (quotesEnabled && ctx.coach) paragraphs.push(coachParagraph(ctx, seed));
    const summary = team => ({id: team.id, name: teamDisplay(team), city: (team.city || "").trim() || null,
      nickname: (team.name || team.shortName || "").trim() || null, logoURL: team.logoURL || null});
    return {
      id,
      fingerprint,
      season: ctx.seasonYear,
      day: ctx.dayNumber,
      gid: ctx.game.gId,
      type: gameType(ctx),
      importance: ctx.importance,
      headline: headline(ctx, seed),
      paragraphs: paragraphs.filter(Boolean),
      templateVersion: 3,
      editorialVersion: 2,
      leagueName: ctx.leagueName,
      playerStats: ctx.potgStats ? structuredClone(ctx.potgStats) : null,
      playerId: ctx.potg?.id ?? null,
      playerName: ctx.potgStats ? ctx.potgName : null,
      gameSummary: {home: {...summary(ctx.home), score: ctx.game.homeScore}, away: {...summary(ctx.away), score: ctx.game.awayScore}},
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
    // Editorial upgrades rewrite the prose for games still in the loaded save.
    return !existing || (existing.templateVersion === 3 &&
      ((!existing.playerStats && ctx.potgStatsTrusted) || (!existing.coach && !!ctx.coach) || (existing.editorialVersion || 0) < 2));
  }
  function coachParagraph(ctx, seed) {
    const W = teamRef(ctx.winner);
    return quoteParagraph(quoteBank(ctx, seed, "quote-coach"), `${W.city || W.nickname} coach ${playerDisplay(ctx.coach)}`);
  }
  return {hashString, choose, assertSave, teamDisplay, playerDisplay, buildFingerprint, isCompleted,
    buildLookups, captureSnapshots, snapshotId, storyId, seasonYear, validStats, gameContext,
    candidates, formatStatLine, generateArticle, shouldGenerate, coachForTeam, coachParagraph,
    num, plural, capitalize, listJoin, surname, possessive, pronoun, teamRef, verb, shotPair, quoteParagraph, gamesBetter, teamTotals};
});
