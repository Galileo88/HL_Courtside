/* Deterministic daily coverage and conservative stat matching. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HoopWireCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function choose(seed, values, salt = '') {
    const index = parseInt(hashString(seed + '|' + salt), 36) % values.length;
    return values[index];
  }

  function assertSave(data) {
    if (!data || !Array.isArray(data.seasonLeagues) || data.seasonLeagues.length === 0) {
      throw new Error('This file does not contain a Hoop Land seasonLeagues array.');
    }
  }

  function teamDisplay(team) {
    if (!team) return 'Unknown Team';
    const city = (team.city || '').trim();
    const name = (team.name || team.shortName || 'Team').trim();
    return city ? `${city} ${name}` : name;
  }

  function playerDisplay(player) {
    if (!player) return 'the player of the game';
    return [player.fn, player.ln].filter(Boolean).join(' ').trim() || 'the player of the game';
  }

  function lastName(player) {
    return player && player.ln ? player.ln : playerDisplay(player);
  }

  function recordText(record) {
    if (!Array.isArray(record) || record.length < 2) return '—';
    return `${record[0]}-${record[1]}`;
  }

  function percentage(record) {
    if (!Array.isArray(record) || record.length < 2) return 0.5;
    const games = record[0] + record[1];
    return games ? record[0] / games : 0.5;
  }

  function pregameRecord(postRecord, wasWinner) {
    if (!Array.isArray(postRecord) || postRecord.length < 2) return [0, 0];
    return [Math.max(0, postRecord[0] - (wasWinner ? 1 : 0)), Math.max(0, postRecord[1] - (wasWinner ? 0 : 1))];
  }

  function isCompleted(game, teams, currentGame) {
    return (
      Number.isInteger(game.gId) &&
      game.gId > 0 &&
      teams.has(game.homeTeam) &&
      teams.has(game.awayTeam) &&
      game.homeTeam !== game.awayTeam &&
      Number.isFinite(game.homeScore) &&
      Number.isFinite(game.awayScore) &&
      game.homeScore >= 0 &&
      game.awayScore >= 0 &&
      game.homeScore !== game.awayScore &&
      game.winner === (game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam) &&
      !(currentGame?.inProgress && currentGame.gId === game.gId)
    );
  }

  function seasonYear(league) {
    return league.season?.currentYear || league.season?.startingYear || 'Season';
  }
  function storyId(fingerprint, year, gid) {
    return `${fingerprint}:${year}:game:${gid}`;
  }
  function snapshotId(fingerprint, year, gid, pid) {
    return `${storyId(fingerprint, year, gid)}:player:${pid}`;
  }
  function validStats(stats) {
    return stats?.GP === 1 && ['PTS', 'REB', 'AST'].every(k => Number.isInteger(stats[k]) && stats[k] >= 0);
  }
  function coachForTeam(team) {
    const matches = (team?.frontOffice?.staff || []).filter(person => person.pos === 1 && person.tid === team.id);
    if (matches.length !== 1) return null;
    const person = matches[0];
    return structuredClone({
      id: person.id,
      tid: person.tid,
      fn: person.fn,
      ln: person.ln,
      appearance: person.appearance,
      suits: person.suits,
      isCoach: true,
    });
  }
  function buildLookups(league) {
    const teams = new Map(),
      players = new Map(),
      newsByGame = new Map(),
      latestByTeam = new Map();
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
        completed.push({ game, dayIndex });
        for (const tid of [game.homeTeam, game.awayTeam]) {
          const previous = latestByTeam.get(tid);
          if (!previous || previous.dayIndex < dayIndex) latestByTeam.set(tid, { dayIndex, games: [game] });
          else if (previous.dayIndex === dayIndex) previous.games.push(game);
        }
      }
    });
    return {
      teams,
      players,
      newsByGame,
      latestByTeam,
      completed,
      latestDay: completed.length ? Math.max(...completed.map(x => x.dayIndex)) : -1,
    };
  }
  function captureSnapshots(league, fingerprint = buildFingerprint(league)) {
    const lookups = buildLookups(league),
      snapshots = [];
    for (const player of lookups.players.values()) {
      const latest = lookups.latestByTeam.get(player.tid);
      if (!latest || latest.games.length !== 1 || !validStats(player.gameStats)) continue;
      if (
        league.currentGame?.inProgress &&
        [league.currentGame.homeTeam, league.currentGame.roadTeam].includes(player.tid)
      )
        continue;
      const game = latest.games[0];
      const team = lookups.teams.get(player.tid);
      const teamScore = game.homeTeam === player.tid ? game.homeScore : game.awayScore;
      // The save's per-game POTG counter is unused. Corroborate using team points instead.
      if (
        !team?.roster?.length ||
        team.roster.some(p => !Number.isInteger(p.gameStats?.PTS) || p.gameStats.PTS < 0) ||
        team.roster.reduce((total, p) => total + p.gameStats.PTS, 0) !== teamScore ||
        player.gameStats.PTS > teamScore
      )
        continue;
      snapshots.push({
        id: snapshotId(fingerprint, seasonYear(league), game.gId, player.id),
        fingerprint,
        season: seasonYear(league),
        gid: game.gId,
        pid: player.id,
        day: latest.dayIndex + 1,
        stats: structuredClone(player.gameStats),
        player: structuredClone({
          id: player.id,
          tid: player.tid,
          fn: player.fn,
          ln: player.ln,
          gender: player.gender,
          num: player.num,
          appearance: player.appearance,
          accessories: player.accessories,
        }),
        team: structuredClone({
          id: team.id,
          city: team.city,
          name: team.name,
          shortName: team.shortName,
          logoURL: team.logoURL,
          teamColors: team.teamColors,
          uniforms: team.uniforms,
          court: team.court,
        }),
        capturedAt: new Date().toISOString(),
      });
    }
    return snapshots;
  }

  // A game's place on the front page. ctx.importance decides which games get
  // written up; once written, a game between good teams outranks one between
  // bad ones, and any decent game outranks a bench player's career night.
  function frontPageWeight(ctx) {
    const good = r => Array.isArray(r) && r[0] + r[1] >= 5 && r[0] / (r[0] + r[1]) >= 0.6;
    const contenders = [ctx.winnerPre, ctx.loserPre].filter(good).length;
    return ctx.importance + 30 + (contenders === 2 ? 15 : contenders === 1 ? 5 : 0);
  }

  function buildFingerprint(league) {
    const teams = (league.teams || [])
      .map(t => `${t.id}:${t.shortName || ''}:${t.name || ''}`)
      .sort()
      .join('|');
    const season = league.season || {};
    return hashString(`${league.leagueName}|${season.startingYear}|${teams}`);
  }

  function coverageThreshold(level) {
    if (level === 'major') return 80;
    if (level === 'standard') return 65;
    return 0;
  }

  /* Game facts: everything a writer may claim about a game, derived once from
     the save. Playoff games carry the series record in home/awayRecord, so the
     season record comes from the team's season line instead. */
  const isRecord = r =>
    Array.isArray(r) && r.length >= 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 0 && r[1] >= 0;
  function bracketFor(league) {
    return (league.season?.playoffs || []).find(p => p.yr === seasonYear(league)) || null;
  }
  function roundName(bracket, tRound, college) {
    return nameForTeams((bracket?.rounds?.[tRound - 1]?.series || []).length * 2, tRound, college);
  }
  function nameForTeams(teams, tRound, college) {
    if (teams === 2)
      return college
        ? { name: 'national championship game', short: 'title', final: true }
        : { name: 'Finals', short: 'Finals', final: true };
    if (tRound === 1) return { name: 'first round', short: 'first-round', final: false };
    if (college)
      return {
        name: { 4: 'Final Four', 8: 'Elite Eight', 16: 'Sweet 16', 32: 'round of 32' }[teams] || `round ${tRound}`,
        short: { 4: 'Final Four', 8: 'Elite Eight', 16: 'Sweet 16' }[teams] || `round-${tRound}`,
        final: false,
      };
    return teams === 4
      ? { name: 'semifinals', short: 'semifinal', final: false }
      : {
          name: tRound === 2 ? 'second round' : 'quarterfinals',
          short: tRound === 2 ? 'second-round' : 'quarterfinal',
          final: false,
        };
  }
  function seriesFacts(game, league) {
    if (!(game.tRound > 0)) return null;
    const bracket = bracketFor(league),
      series = bracket?.rounds?.[game.tRound - 1]?.series?.[game.tId];
    const loserId = game.winner === game.homeTeam ? game.awayTeam : game.homeTeam;
    if (
      !series ||
      ![series.topSeed, series.lowerSeed].includes(game.winner) ||
      ![series.topSeed, series.lowerSeed].includes(loserId)
    )
      return null;
    const firstTo = series.firstTo,
      wr = game.winner === game.homeTeam ? game.homeRecord : game.awayRecord,
      lr = game.winner === game.homeTeam ? game.awayRecord : game.homeRecord;
    if (
      !(firstTo >= 1) ||
      !isRecord(wr) ||
      !isRecord(lr) ||
      wr[0] !== lr[1] ||
      wr[1] !== lr[0] ||
      wr[0] < 1 ||
      wr[0] > firstTo ||
      wr[1] >= firstTo
    )
      return null;
    const [wins, losses] = wr,
      round = roundName(bracket, game.tRound, league.leagueType === 1),
      clinched = wins === firstTo;
    const teams = (bracket.rounds[game.tRound - 1].series || []).length * 2;
    return {
      round: game.tRound,
      roundName: round.name,
      roundShort: round.short,
      final: round.final,
      firstTo,
      bestOf: firstTo * 2 - 1,
      nextRound: teams > 2 ? nameForTeams(teams / 2, game.tRound + 1, league.leagueType === 1).name : null,
      gameNumber: wins + losses,
      wins,
      losses,
      clinched,
      title: round.final && clinched,
      sweep: clinched && losses === 0 && firstTo > 1,
      decider: firstTo > 1 && wins + losses === firstTo * 2 - 1,
      tied: wins === losses,
      savedSeason: firstTo > 1 && losses === firstTo - 1,
      loserFacesElimination: !clinched && firstTo > 1 && wins === firstTo - 1,
      winnerHigherSeed: series.topSeed === game.winner,
    };
  }
  // Streaks, recent form and the season series, from the save's own schedule.
  function formFacts(game, dayIndex, lookups) {
    if (game.tRound > 0 || game.gameType !== 0) return {};
    const form = {},
      played = lookups.completed.filter(x => x.dayIndex <= dayIndex && x.game.tRound === 0 && x.game.gameType === 0);
    for (const tid of [game.homeTeam, game.awayTeam]) {
      const games = played.filter(x => x.game.homeTeam === tid || x.game.awayTeam === tid).map(x => x.game);
      const post = tid === game.homeTeam ? game.homeRecord : game.awayRecord;
      // Only a complete record chain proves a streak.
      if (!isRecord(post) || games.length !== post[0] + post[1] || games.at(-1)?.gId !== game.gId) continue;
      const results = games.map(g => g.winner === tid),
        last = results.at(-1);
      let length = 0;
      for (let i = results.length - 1; i >= 0 && results[i] === last; i--) length++;
      let ended = 0;
      for (let i = results.length - 2; i >= 0 && results[i] !== last; i--) ended++;
      const recent = results.slice(-10);
      form[tid] = {
        streak: { won: last, length },
        ended: ended >= 3 && length === 1 ? { won: !last, length: ended } : null,
        last10: recent.length === 10 ? [recent.filter(Boolean).length, recent.filter(x => !x).length] : null,
      };
    }
    const meetings = played
      .filter(x => [x.game.homeTeam, x.game.awayTeam].every(t => [game.homeTeam, game.awayTeam].includes(t)))
      .map(x => x.game);
    if (meetings.at(-1)?.gId === game.gId)
      form.series = { meetings: meetings.length, winnerWins: meetings.filter(g => g.winner === game.winner).length };
    return form;
  }
  function seasonLine(team, league) {
    const s = (team?.season || []).find(r => r.yr === seasonYear(league))?.seasonStats;
    return isRecord([s?.W, s?.L]) && s.W + s.L > 0 ? [s.W, s.L] : null;
  }
  function priorSeason(team, league) {
    const s = (team?.season || []).find(r => r.yr === Number(seasonYear(league)) - 1)?.seasonStats;
    return isRecord([s?.W, s?.L]) && s.W + s.L > 0 ? [s.W, s.L] : null;
  }

  function gameContext(game, dayIndex, league, lookups, snapshots = new Map(), fingerprint = buildFingerprint(league)) {
    const home = lookups.teams.get(game.homeTeam);
    const away = lookups.teams.get(game.awayTeam);
    const winner = lookups.teams.get(game.winner);
    const loser = game.winner === game.homeTeam ? away : home;
    const winnerIsHome = game.winner === game.homeTeam;
    const series = seriesFacts(game, league),
      playoffs = game.tRound > 0;

    const winnerScore = winnerIsHome ? game.homeScore : game.awayScore;
    const loserScore = winnerIsHome ? game.awayScore : game.homeScore;
    // In the playoffs the game's records describe the series, not the season.
    const winnerRecord = playoffs ? seasonLine(winner, league) : winnerIsHome ? game.homeRecord : game.awayRecord;
    const loserRecord = playoffs ? seasonLine(loser, league) : winnerIsHome ? game.awayRecord : game.homeRecord;
    const winnerPre = playoffs ? winnerRecord : pregameRecord(winnerRecord, true);
    const loserPre = playoffs ? loserRecord : pregameRecord(loserRecord, false);
    const winnerPreGames = winnerPre[0] + winnerPre[1];
    const loserPreGames = loserPre[0] + loserPre[1];

    const margin = Math.abs(winnerScore - loserScore);
    const close = margin <= 3;
    const blowout = margin >= 12;
    const upset =
      !playoffs && winnerPreGames >= 5 && loserPreGames >= 5 && percentage(winnerPre) + 0.15 < percentage(loserPre);

    const news = lookups.newsByGame.get(game.gId);
    const nativeRating = news ? Number(news.rating || 0) : 5;
    let importance = nativeRating * 5;
    if (close) importance += 10;
    if (blowout && margin >= 15) importance += 5;
    if (upset) importance += 20;
    if (playoffs)
      importance += 25 + (series?.clinched ? 15 : 0) + (series?.decider ? 10 : 0) + (series?.title ? 40 : 0);

    const snapshot = snapshots.get(snapshotId(fingerprint, seasonYear(league), game.gId, game.potg));
    const potgStatsTrusted = !!snapshot && validStats(snapshot.stats);
    const potg = potgStatsTrusted ? snapshot.player : null;

    // Verified box scores for everyone in this game, from the same snapshot checks.
    const box = [];
    for (const team of [home, away])
      for (const player of team?.roster || []) {
        const snap = snapshots.get(snapshotId(fingerprint, seasonYear(league), game.gId, player.id));
        if (snap && validStats(snap.stats) && snap.team?.id === team.id)
          box.push({
            pid: snap.pid,
            tid: team.id,
            name: playerDisplay(snap.player),
            last: lastName(snap.player),
            stats: snap.stats,
          });
      }
    const slate = lookups.completed
      .filter(x => x.dayIndex === dayIndex)
      .map(x => Math.abs(x.game.homeScore - x.game.awayScore));
    const season = league.season || {};
    const form = formFacts(game, dayIndex, lookups);
    const titles =
      winner?.championships &&
      winner.championships.league === league.leagueType &&
      Array.isArray(winner.championships.yearsWon)
        ? winner.championships.yearsWon
        : [];
    return {
      college: league.leagueType === 1,
      leagueShort: league.shortName || league.leagueName || 'league',
      titleCount:
        series?.title && titles.includes(seasonYear(league))
          ? new Set(titles.filter(y => y <= seasonYear(league))).size
          : null,
      game,
      box,
      series,
      form,
      playoffs,
      winnerLastSeason: priorSeason(winner, league),
      loserLastSeason: priorSeason(loser, league),
      dayGames: slate.length,
      widestOfDay: slate.length >= 3 && slate.filter(m => m >= margin).length === 1,
      gameBall: structuredClone(
        league.gameballs?.[Number(league.settings?.gameBall) || 0] || {
          pri: 'E37033',
          sec: 'E37033',
          ter: 'E37033',
          outline: '44220F',
        }
      ),
      dayIndex,
      dayNumber: dayIndex + 1,
      seasonYear: season.currentYear || season.startingYear || 'Season',
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
      leagueName: league.leagueName || 'League',
      coach: coachForTeam(winner),
    };
  }

  /* Newsroom voice helpers: AP-style numbers, short references and agreement. */
  const smallNumbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  function num(n) {
    return Number.isInteger(n) && n >= 0 && n < 10 ? smallNumbers[n] : String(n);
  }
  function plural(n, word, words = word + 's') {
    return `${num(n)} ${n === 1 ? word : words}`;
  }
  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }
  function listJoin(parts) {
    return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1);
  }
  function surname(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length > 2 && /^(?:jr|sr|ii|iii|iv|v)\.?$/i.test(parts.at(-1))) parts.pop();
    return parts.at(-1) || String(name || '');
  }
  function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
  }
  // Saves store positions on a 0-8 scale: the five positions on even values, hybrids between them.
  const POSITIONS = [
    'point guard',
    'combo guard',
    'shooting guard',
    'wing',
    'small forward',
    'forward',
    'power forward',
    'forward-center',
    'center',
  ];
  function positionName(pos) {
    return (Number.isInteger(pos) && POSITIONS[pos]) || '';
  }
  // The award settings' position flags a player falls under: one for a position, both neighbors for a hybrid.
  function positionKeys(pos) {
    const keys = ['pg', 'sg', 'sf', 'pf', 'c'];
    if (!Number.isInteger(pos) || pos < 0 || pos > 8) return [];
    return pos % 2 ? [keys[(pos - 1) / 2], keys[(pos + 1) / 2]] : [keys[pos / 2]];
  }
  // Hoop Land records gender 0 for men and 1 for women; anything else keeps the name.
  function pronoun(person) {
    return person?.gender === 0 ? 'he' : person?.gender === 1 ? 'she' : null;
  }
  // Subject, object and possessive forms for a person, or their name when the save gives no gender.
  function pronouns(person, name = '') {
    const he = pronoun(person);
    return {
      he: he || name,
      him: he === 'she' ? 'her' : he === 'he' ? 'him' : name,
      his: he === 'she' ? 'her' : he === 'he' ? 'his' : possessive(name),
    };
  }
  // What a coach or teammate calls the group: "guys" on a men's roster, "players" on a women's.
  function squad(team) {
    const roster = team?.roster || [];
    return roster.length && roster.filter(p => p.gender === 1).length > roster.length / 2 ? 'players' : 'guys';
  }
  // Accepts a native team, a snapshot team or an archived score summary.
  function teamRef(team) {
    let city = '',
      nickname = '';
    if (team?.nickname) {
      nickname = team.nickname;
      city = team.city || '';
    } else if (team && Object.prototype.hasOwnProperty.call(team, 'city')) {
      city = (team.city || '').trim();
      nickname = (team.name || team.shortName || 'Team').trim();
    } else {
      const words = String(team?.name || 'Team')
        .trim()
        .split(/\s+/);
      nickname = words.pop();
      city = words.join(' ');
    }
    const display = city ? `${city} ${nickname}` : nickname;
    return {
      display,
      city: city || null,
      nickname,
      full: `the ${display}`,
      nick: `the ${nickname}`,
      short: city || `the ${nickname}`,
      plural: /s$/i.test(nickname) && !/(?:ss|us)$/i.test(nickname),
    };
  }
  // Present-tense verb for a bare nickname: "Wolverines stun", "Thunder stuns".
  function verb(team, base) {
    if (team.plural) return base;
    const irregular = { are: 'is', have: 'has', were: 'was', do: 'does' };
    return irregular[base] || base + (/(?:s|sh|ch|x|z)$/.test(base) ? 'es' : 's');
  }
  function shotPair(s, made, attempted) {
    return (
      Number.isInteger(s?.[made]) &&
      Number.isInteger(s?.[attempted]) &&
      s[attempted] > 0 &&
      s[made] >= 0 &&
      s[made] <= s[attempted]
    );
  }
  function quoteParagraph(text, attribution) {
    // AP style: the attribution follows the first sentence.
    const sentences = String(text)
      .match(/[^.!?]+[.!?]+/g)
      ?.map(s => s.trim()) || [String(text)];
    const first = sentences[0].replace(/\.$/, ','),
      rest = sentences.slice(1).join(' ');
    return `“${first}” ${attribution} said.${rest ? ` “${rest}”` : ''}`;
  }
  const statLabels = { PTS: 'points', REB: 'rebounds', AST: 'assists', STL: 'steals', BLK: 'blocks' };
  function lineSummary(s) {
    const parts = [plural(s.PTS, 'point')];
    for (const [k, min] of [
      ['REB', 3],
      ['AST', 3],
      ['STL', 2],
      ['BLK', 2],
    ])
      if (Number.isInteger(s[k]) && s[k] >= min)
        parts.push(plural(s[k], statLabels[k].replace(/s$/, ''), statLabels[k]));
    return listJoin(parts);
  }
  function doubles(stats) {
    return Object.keys(statLabels).filter(k => Number.isInteger(stats?.[k]) && stats[k] >= 10);
  }

  function gameType(ctx) {
    if (ctx.series?.title) return ctx.college ? 'National championship' : 'Championship';
    if (ctx.series?.clinched) return 'Series clincher';
    if (ctx.playoffs) return 'Playoff game';
    if (ctx.upset) return 'Upset';
    if (ctx.close) return 'Close game';
    if (ctx.blowout) return 'Statement win';
    return 'Game recap';
  }

  function featured(ctx) {
    if (!ctx.potg || !ctx.potgStatsTrusted || !ctx.potgStats) return null;
    const s = ctx.potgStats,
      name = playerDisplay(ctx.potg);
    return {
      name,
      last: ctx.potg.ln || surname(name),
      he: pronoun(ctx.potg),
      s,
      onWinner: ctx.potg.tid === ctx.game.winner,
      team: ctx.potg.tid === ctx.game.winner ? teamRef(ctx.winner) : teamRef(ctx.loser),
      teamScore: ctx.potg.tid === ctx.game.winner ? ctx.winnerScore : ctx.loserScore,
      doubles: doubles(s),
      // A headline line scales with how much scoring the game had.
      get headliner() {
        const scale = Math.min(1, Math.max(0.15, (ctx.winnerScore + ctx.loserScore) / 200));
        return (
          this.doubles.length >= 2 || s.PTS >= 22 * scale || (this.teamScore > 0 && s.PTS / this.teamScore >= 0.25)
        );
      },
    };
  }
  // The headline clause for a stat line: "had 14 points and 11 rebounds".
  function statClause(p) {
    const s = p.s,
      d = p.doubles;
    if (d.length >= 3) {
      const kind = ['', '', '', 'triple-double', 'quadruple-double', 'quintuple-double'][d.length];
      return `had ${listJoin(d.map(k => `${s[k]} ${statLabels[k]}`))} for a ${kind}`;
    }
    if (d.length === 2) return `had ${listJoin(d.map(k => `${s[k]} ${statLabels[k]}`))}`;
    const other = ['REB', 'AST'].filter(k => Number.isInteger(s[k]) && s[k] >= 5 && s[k] > s.PTS)[0];
    if (other)
      return `had ${plural(s.PTS, 'point')} and ${plural(s[other], statLabels[other].replace(/s$/, ''), statLabels[other])}`;
    return `scored ${plural(s.PTS, 'point')}`;
  }

  function headline(ctx, seed) {
    const W = teamRef(ctx.winner),
      L = teamRef(ctx.loser),
      w = W.nickname,
      l = L.nickname;
    const score = `${ctx.winnerScore}-${ctx.loserScore}`,
      p = featured(ctx),
      star = p?.onWinner && p.headliner ? p : null;
    const v = base => verb(W, base);
    const S = ctx.series;
    if (S) {
      const by = star ? ` behind ${star.last}` : '';
      const prize = ctx.college ? 'national championship' : `${ctx.seasonYear} ${ctx.leagueShort} title`;
      if (S.title)
        return choose(
          seed,
          [
            `${w} ${v('win')} ${prize}${by}`,
            star
              ? `${star.last} leads ${w} to ${ctx.college ? 'national' : ctx.leagueShort} championship`
              : `${w} ${v('claim')} ${prize} with ${score} win over ${l}`,
          ],
          'headline-title'
        );
      if (S.sweep)
        return choose(
          seed,
          [`${w} ${v('sweep')} ${l}${by}`, `${w} ${v('finish')} off sweep of ${l}, ${score}`],
          'headline-sweep'
        );
      if (S.clinched)
        return choose(
          seed,
          [
            `${w} ${v('eliminate')} ${l}, ${v('advance')} to ${S.nextRound || 'next round'}`,
            `${w} ${v('close')} out ${l} in ${S.firstTo > 1 ? `Game ${S.gameNumber}` : `${score} win`}${by}`,
          ],
          'headline-clinch'
        );
      if (S.decider === false && S.tied && S.wins === S.firstTo - 1)
        return `${w} ${v('force')} Game ${S.bestOf} against ${l}${by}`;
      if (S.tied)
        return choose(
          seed,
          [
            `${w} ${v('even')} series with ${l}${by}`,
            star
              ? `${star.last} scores ${star.s.PTS}, ${w} ${v('even')} series`
              : `${w} ${v('draw')} level with ${l}, ${S.wins}-${S.losses}`,
          ],
          'headline-even'
        );
      if (S.savedSeason)
        return choose(
          seed,
          [`${w} ${v('stay')} alive against ${l}${by}`, `${w} ${v('avoid')} elimination, ${score}`],
          'headline-alive'
        );
      if (S.gameNumber === 1)
        return choose(
          seed,
          [
            `${w} ${v('take')} Game 1 from ${l}${by}`,
            star
              ? `${star.last} scores ${star.s.PTS} as ${w} ${v('take')} Game 1`
              : `${w} ${v('strike')} first against ${l}`,
          ],
          'headline-g1'
        );
      if (S.wins > S.losses)
        return S.wins === S.firstTo - 1
          ? choose(
              seed,
              [
                `${w} ${v('move')} one win from ${S.nextRound ? `the ${S.nextRound}` : 'advancing'}`,
                `${w} ${v('take')} ${S.wins}-${S.losses} lead over ${l}${by}`,
              ],
              'headline-lead'
            )
          : choose(
              seed,
              [
                `${w} ${v('take')} ${S.wins}-${S.losses} series lead over ${l}`,
                star
                  ? `${star.last} scores ${star.s.PTS}, ${w} ${v('go')} up ${S.wins}-${S.losses}`
                  : `${w} ${v('go')} up ${S.wins}-${S.losses} on ${l}`,
              ],
              'headline-lead'
            );
      return `${w} ${v('cut')} series deficit to ${S.losses}-${S.wins}${by}`;
    }
    if (star && star.doubles.length >= 3) {
      return choose(
        seed,
        [
          `${star.last} posts ${['', '', '', 'triple-double', 'quadruple-double', 'quintuple-double'][star.doubles.length]} as ${w} ${v('beat')} ${l}`,
          `${star.last} fills the box score, ${w} ${v('top')} ${l} ${score}`,
        ],
        'headline-triple'
      );
    }
    if (ctx.upset) {
      return choose(
        seed,
        [
          `${w} ${v('stun')} ${l} ${score}${star ? ` behind ${star.last}` : ''}`,
          star ? `${star.last}, ${w} ${v('upset')} ${l} ${score}` : `${w} ${v('knock')} off ${l} ${score}`,
          `${w} ${v('upend')} ${l}, ${score}`,
        ],
        'headline-upset'
      );
    }
    if (ctx.close) {
      return choose(
        seed,
        [
          `${w} ${v('edge')} ${l} ${score}`,
          star ? `${star.last} helps ${w} slip past ${l} ${score}` : `${w} ${v('slip')} past ${l} ${score}`,
          `${w} ${v('get')} past ${l} ${score}`,
        ],
        'headline-close'
      );
    }
    if (ctx.blowout) {
      return choose(
        seed,
        [
          `${w} ${v('rout')} ${l} ${score}`,
          `${w} ${v('roll')} past ${l} ${score}${star ? ` behind ${star.last}` : ''}`,
          star
            ? `${star.last} powers ${w} to ${ctx.margin}-point win over ${l}`
            : `${w} ${v('pull')} away from ${l}, ${score}`,
        ],
        'headline-blowout'
      );
    }
    if (star) {
      return choose(
        seed,
        star.doubles.length === 2
          ? [
              `${possessive(star.last)} double-double lifts ${w} past ${l} ${score}`,
              `${star.last} posts double-double, ${w} ${v('beat')} ${l} ${score}`,
            ]
          : [
              `${star.last} scores ${star.s.PTS}, ${w} ${v('beat')} ${l} ${score}`,
              `${star.last} leads ${w} past ${l}, ${score}`,
              `${w} ${v('top')} ${l} ${score} behind ${star.last}`,
            ],
        'headline-normal'
      );
    }
    return `${w} ${v('beat')} ${l} ${score}`;
  }

  function quoteBank(ctx, seed, salt) {
    const pick = options => choose(seed, options, salt),
      S = ctx.series,
      guys = squad(ctx.winner);
    if (S && salt === 'quote-coach') {
      if (S.title)
        return pick([
          `Nobody can ever take this away from these ${guys}. They earned every bit of it.`,
          "I've been dreaming about this since I got into coaching. I'm so happy for this group.",
          "This is what we built all year for. Champions. I still can't believe I get to say it.",
        ]);
      if (S.clinched)
        return pick([
          "Closing out a series is the hardest thing to do in this league. I'm proud of how we finished it.",
          "We'll enjoy it tonight. Tomorrow we get to work on the next one.",
          `That's a good team we just beat. Our ${guys} earned this.`,
        ]);
      if (S.savedSeason)
        return pick([
          `Our ${guys} weren't ready to go home. That was a team that refused to quit.`,
          'We had our backs against the wall and responded. Now we have to do it again.',
        ]);
      if (S.tied)
        return pick([
          "It's a new series. We'll regroup and go again.",
          'Nobody panicked. We knew we had a response in us.',
        ]);
      return pick(
        S.gameNumber === 1
          ? [
              "That's one. We need four against a team like this.".replace('four', num(S.firstTo)),
              "Good start. That's all it is.",
            ]
          : [
              "We did our job tonight. It's not over until it's over.",
              'I liked our response. Now we have to keep our foot on the gas.',
              "Closeout games are the hardest ones. We'll be ready for it.",
            ].slice(0, S.wins === S.firstTo - 1 ? 3 : 2)
      );
    }
    if (S) {
      if (S.title)
        return pick([
          "We're champions. I don't even know what to say right now. This group deserved it.",
          `All the work, all those nights, it was all for this. I love these ${guys}.`,
          "I've wanted this my whole life. To do it with this team, it means everything.",
        ]);
      if (S.clinched)
        return pick([
          "On to the next one. We're not satisfied yet.",
          "That's a good team over there. Closing them out feels good, but we want more.",
          'We came in with one goal. This was just a step.',
        ]);
      if (S.savedSeason)
        return pick([
          "We're not ready to go home. Simple as that.",
          'Backs against the wall, you find out who you are. We found out tonight.',
        ]);
      if (S.tied)
        return pick([
          "It's a brand-new series now. We'll be ready.",
          "We knew we'd respond. Now we have to keep it going.",
        ]);
      return pick([
        "We did our job tonight. The series isn't over.",
        "Win the next possession, win the next game. That's all we're thinking about.",
        "Good win, but we haven't done anything yet.",
      ]);
    }
    if (salt === 'quote-coach') {
      if (ctx.close)
        return pick([
          "That was a grind. Neither team gave an inch, and I'm proud of how our group competed.",
          "Those are the ones that test you. We didn't play perfect, but we were good enough at the end.",
          "Give them credit, they made it hard on us. I'll take a win like that every time.",
          `Games like that grow you up. I'm happy for our ${guys}.`,
        ]);
      if (ctx.upset)
        return pick([
          `There's a lot of respect in our locker room for that team. But our ${guys} believed they could win this game, and they played like it.`,
          `We don't look at the standings. We came in with a plan and our ${guys} trusted it.`,
          "That's a quality opponent. Beating a team like that tells our group what it's capable of.",
          `I told our ${guys} before the game that the records don't matter once the ball goes up. They believed it.`,
        ]);
      if (ctx.blowout)
        return pick([
          "That's about as complete as we've been. Now the challenge is doing it again.",
          "I liked our focus from the start. When we play with that kind of edge, we're a tough out.",
          "Good night for us. We'll enjoy it, then get back to work tomorrow.",
          "We were sharp. I don't want to make too much of one night, but that's the standard.",
        ]);
      return pick([
        "Good win. There's stuff we have to clean up, but I'll take it.",
        `It wasn't always pretty. Our ${guys} found a way, and that's what good teams do.`,
        "We handled our business. That's what I want to see from this group.",
        'I thought we were the more connected team tonight. Still plenty to work on.',
      ]);
    }
    if (ctx.close)
      return pick([
        'Those are the games you want to be in. We stayed together and did just enough.',
        'That one was a fight. Credit to them, they made us earn every bucket.',
        "Close games, you can't get rattled. We stayed level and got the win.",
        "My heart's still racing a little bit. That's a good team, and we'll take it.",
        "We didn't make it easy on ourselves. But we got the stops when we had to, and that's what matters.",
      ]);
    if (ctx.upset)
      return pick([
        'People can look at the records all they want. Nobody in here was surprised.',
        'We knew what kind of team they were. We just wanted to go out and play our game.',
        "That's a good team. Beating them, that's a confidence thing for us.",
        'Honestly, we had nothing to lose. We just went out and played free.',
        "I don't think anybody outside our locker room gave us a chance. That's fine with us.",
      ]);
    if (ctx.blowout)
      return pick([
        "When we're playing together like that, we're hard to beat. Everybody was locked in.",
        'We just wanted to come out and set the tone. It felt good to put a full game together.',
        "That's the version of us we want to see every night.",
        "We were sharing it, getting stops, having fun. That's when we're at our best.",
        "We've been waiting on a game like that. Now we've got to keep it going.",
      ]);
    return pick([
      "We came in and handled our business. That's all you can ask.",
      "It wasn't perfect, but a win's a win. We'll look at the film and get better.",
      'Just trying to make the right plays. My teammates put me in good spots tonight.',
      'I just took what the defense gave me. Shots were falling, so I kept shooting.',
      'Good team win. We did what we came here to do.',
    ]);
  }

  function recordNote(ref, pre, post, won) {
    const r = recordText(post),
      even = post[0] === post[1];
    if (won && even) return `${ref} got back to .500 at ${r}`;
    if (won && pre[0] <= pre[1] && post[0] > post[1]) return `${ref} moved above .500 at ${r}`;
    if (!won && pre[0] >= pre[1] && post[0] < post[1]) return `${ref} slipped below .500 at ${r}`;
    if (!won && even) return `${ref} fell to .500 at ${r}`;
    return `${ref} ${won ? 'improved' : 'fell'} to ${r}`;
  }
  function gamesBetter(a, b) {
    // How far record a sits ahead of record b, in games.
    const gap = (a[0] - b[0] + (b[1] - a[1])) / 2;
    return gap <= 0 ? '' : gap === 0.5 ? 'a half-game' : gap % 1 ? `${Math.floor(gap)} 1/2 games` : plural(gap, 'game');
  }

  function teamTotals(box, tid) {
    const rows = box.filter(r => r.tid === tid);
    if (!rows.length) return null;
    const totals = {};
    for (const k of ['PTS', 'REB', 'AST', 'TO', 'FGM', 'FGA', 'TPM', 'TPA', 'STL', 'BLK'])
      totals[k] = rows.every(r => Number.isInteger(r.stats[k]) && r.stats[k] >= 0)
        ? rows.reduce((n, r) => n + r.stats[k], 0)
        : null;
    return totals;
  }
  // One box-score edge that separated the teams, chosen by how lopsided it was.
  function teamEdge(ctx, W, L) {
    const w = teamTotals(ctx.box || [], ctx.winner?.id),
      l = teamTotals(ctx.box || [], ctx.loser?.id);
    if (!w || !l) return '';
    const options = [];
    if (w.FGA > 0 && l.FGA > 0 && w.FGM !== null && l.FGM !== null) {
      const a = w.FGM / w.FGA,
        b = l.FGM / l.FGA;
      if (b <= 0.36 && a - b >= 0.1)
        options.push({
          score: (a - b) * 3,
          text: `${capitalize(L.short)} shot just ${l.FGM}-of-${l.FGA} from the field.`,
        });
      else if (a >= 0.55 && a - b >= 0.1)
        options.push({
          score: (a - b) * 3,
          text: `${capitalize(W.short)} shot ${Math.round(a * 100)}% from the field, making ${w.FGM} of ${w.FGA} attempts.`,
        });
    }
    if (w.REB !== null && l.REB !== null && Math.abs(w.REB - l.REB) >= Math.max(4, 0.3 * Math.min(w.REB, l.REB))) {
      options.push({
        score: Math.abs(w.REB - l.REB) / Math.max(1, Math.min(w.REB, l.REB)),
        text:
          w.REB > l.REB
            ? `${capitalize(W.short)} owned the glass, outrebounding ${L.short} ${w.REB}-${l.REB}.`
            : `${capitalize(L.short)} won the rebounding battle ${l.REB}-${w.REB} and still came up short.`,
      });
    }
    if (w.TO !== null && l.TO !== null && l.TO - w.TO >= 3)
      options.push({
        score: (l.TO - w.TO) / Math.max(2, w.TO),
        text:
          w.TO === 0
            ? `${capitalize(L.short)} turned it over ${plural(l.TO, 'time')}; ${W.short} didn't commit a single turnover.`
            : `${capitalize(L.short)} turned it over ${plural(l.TO, 'time')}, ${num(l.TO - w.TO)} more than ${W.short}.`,
      });
    if (w.TPM !== null && l.TPM !== null && w.TPM - l.TPM >= 3)
      options.push({
        score: (w.TPM - l.TPM) / Math.max(2, l.TPM),
        text: `${capitalize(W.short)} won the 3-point battle, hitting ${num(w.TPM)} from deep to ${possessive(L.short)} ${num(l.TPM)}.`,
      });
    return options.sort((a, b) => b.score - a.score)[0]?.text || '';
  }

  const ordinalWord = n =>
    ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][n] ||
    `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
  // A short reference is singular when it's a city ("Logan has") or a singular nickname.
  function shortVerb(team, base) {
    return team.city || !team.plural ? verb({ plural: false }, base) : base;
  }
  function seriesClause(ctx, S) {
    const where = S.final ? 'the Finals' : `their ${S.roundShort} series`;
    if (S.title)
      return ctx.college
        ? 'to win the national championship'
        : `to win the ${ctx.seasonYear} ${ctx.leagueShort} championship`;
    if (S.firstTo === 1) return S.nextRound ? `to advance to the ${S.nextRound}` : 'to advance';
    if (S.sweep) return `to complete a ${num(S.firstTo)}-game sweep in the ${S.roundName}`;
    if (S.clinched)
      return S.decider
        ? `in Game ${S.gameNumber} to win ${where} ${S.wins}-${S.losses}`
        : `to close out ${where} ${S.wins}-${S.losses}`;
    if (S.tied && S.wins === S.firstTo - 1) return `to force a Game ${S.bestOf}`;
    if (S.tied) return `to even ${where} at ${S.wins === 1 ? 'a game' : `${num(S.wins)} games`} apiece`;
    if (S.savedSeason) return 'to stave off elimination';
    if (S.gameNumber === 1) return `in Game 1 of ${S.final ? 'the Finals' : `their ${S.roundShort} series`}`;
    if (S.wins > S.losses) return `to take a ${S.wins}-${S.losses} lead in ${where}`;
    return `to cut their deficit in ${S.final ? 'the Finals' : 'the series'} to ${S.losses}-${S.wins}`;
  }
  function playoffLede(ctx, seed, W, L, p) {
    const score = `${ctx.winnerScore}-${ctx.loserScore}`,
      star = p?.onWinner && p.headliner ? p : null,
      clause = seriesClause(ctx, ctx.series);
    const beat = ctx.close ? 'edged' : ctx.blowout ? 'routed' : 'beat';
    return capitalize(
      star
        ? choose(
            seed,
            [
              `${star.name} ${statClause(star)}, and ${W.full} ${beat} ${L.full} ${score} ${clause}.`,
              `${W.full} ${beat} ${L.full} ${score} ${clause}, with ${star.name} finishing with ${statClause(star).replace(/^(?:had|scored) /, '')}.`,
            ],
            'playoff-lede'
          )
        : `${W.full} ${beat} ${L.full} ${score} ${clause}.`
    );
  }
  function playoffContext(ctx, seed, W, L) {
    const S = ctx.series,
      wr = ctx.winnerRecord,
      lr = ctx.loserRecord,
      parts = [];
    const records =
      isRecord(wr) && isRecord(lr)
        ? `${capitalize(W.short)} went ${recordText(wr)} in the regular season; ${L.short} went ${recordText(lr)}.`
        : '';
    if (S.title) {
      if (isRecord(wr))
        parts.push(
          wr[0] < wr[1]
            ? `Not bad for a team that finished ${recordText(wr)} in the regular season.`
            : `It caps a ${recordText(wr)} regular season for ${W.short}.`
        );
      if (ctx.titleCount)
        parts.push(
          ctx.titleCount === 1
            ? "It is the franchise's first championship."
            : `It is the franchise's ${ordinalWord(ctx.titleCount)} championship.`
        );
      return parts.join(' ');
    }
    if (S.clinched) {
      parts.push(`${capitalize(W.short)} ${shortVerb(W, 'advance')} to the ${S.nextRound || 'next round'}.`);
      const gap = isRecord(wr) && isRecord(lr) ? gamesBetter(lr, wr) : '';
      if (gap && !S.winnerHigherSeed)
        parts.push(
          `It is a genuine upset: ${L.short} went ${recordText(lr)} in the regular season, ${gap} better than ${W.short}.`
        );
      else
        parts.push(
          `${capitalize(possessive(L.short))} season ends${isRecord(lr) ? ` after a ${recordText(lr)} regular season` : ''}.`
        );
      return parts.join(' ');
    }
    if (S.savedSeason && S.losses > S.wins)
      parts.push(
        `${capitalize(L.short)} still ${shortVerb(L, 'lead')} the series ${S.losses}-${S.wins}, and Game ${S.gameNumber + 1} is next.`
      );
    else if (S.wins === S.firstTo - 1)
      parts.push(
        `${capitalize(W.short)} can close out the series with a win in Game ${S.gameNumber + 1}, and ${L.short} ${shortVerb(L, 'face')} elimination.`
      );
    else if (S.tied)
      parts.push(
        `It's ${S.bestOf - S.gameNumber === 3 ? 'a best-of-three' : `a best-of-${num(S.bestOf - S.gameNumber)}`} from here.`
      );
    else parts.push(`Game ${S.gameNumber + 1} is next.`);
    if (S.gameNumber <= 2 && records) parts.push(records);
    return parts.join(' ');
  }
  function formNotes(ctx, W, L) {
    const f = ctx.form || {},
      notes = [],
      w = f[ctx.winner?.id],
      l = f[ctx.loser?.id];
    if (w?.ended && !w.ended.won) notes.push(`The win snapped a ${num(w.ended.length)}-game losing streak.`);
    else if (w?.streak.length >= 3)
      notes.push(`${capitalize(W.short)} ${shortVerb(W, 'have')} won ${num(w.streak.length)} straight.`);
    if (l?.ended && l.ended.won)
      notes.push(`The loss ended ${possessive(L.short)} ${num(l.ended.length)}-game winning streak.`);
    else if (l?.streak.length >= 3)
      notes.push(`${capitalize(L.short)} ${shortVerb(L, 'have')} lost ${num(l.streak.length)} straight.`);
    const h = f.series;
    if (notes.length < 2 && h?.meetings >= 2) {
      const a = h.winnerWins,
        b = h.meetings - h.winnerWins;
      notes.push(
        a === h.meetings
          ? `${capitalize(W.short)} ${shortVerb(W, 'have')} won ${h.meetings === 2 ? 'both' : `all ${num(h.meetings)}`} meetings this season.`
          : a === b
            ? `The teams have split ${num(h.meetings)} meetings this season.`
            : a > b
              ? `${capitalize(W.short)} ${shortVerb(W, 'lead')} the season series ${a}-${b}.`
              : `${capitalize(L.short)} still ${shortVerb(L, 'lead')} the season series ${b}-${a}.`
      );
    }
    return notes.slice(0, 2).join(' ');
  }

  function lede(ctx, seed, W, L, p) {
    if (ctx.series) return playoffLede(ctx, seed, W, L, p);
    const score = `${ctx.winnerScore}-${ctx.loserScore}`,
      star = p?.onWinner && p.headliner ? p : null;
    const pick = options => capitalize(choose(seed, options, 'lede'));
    if (star) {
      const did = statClause(star),
        Name = star.name;
      if (ctx.upset)
        return pick([
          `${Name} ${did}, and ${W.full} knocked off ${L.full} ${score}.`,
          `${W.full} upset ${L.full} ${score}, getting ${star.s.PTS} points from ${Name}.`,
        ]);
      if (ctx.close)
        return pick([
          `${Name} ${did}, and ${W.full} edged ${L.full} ${score}.`,
          `${W.full} slipped past ${L.full} ${score}, with ${Name} leading the way.`,
        ]);
      if (ctx.blowout)
        return pick([
          `${Name} ${did}, and ${W.full} routed ${L.full} ${score}.`,
          `${W.full} rolled past ${L.full} ${score} behind ${Name}, who ${did}.`,
        ]);
      return pick([
        `${Name} ${did} to lead ${W.full} past ${L.full} ${score}.`,
        `${Name} ${did}, and ${W.full} beat ${L.full} ${score}.`,
        `${W.full} got ${plural(star.s.PTS, 'point')} from ${Name} and beat ${L.full} ${score}.`,
      ]);
    }
    if (ctx.upset)
      return pick([
        `${capitalize(W.full)} knocked off ${L.full} ${score}.`,
        `${capitalize(W.full)} upset ${L.full} ${score}.`,
      ]);
    if (ctx.close)
      return pick([
        `${capitalize(W.full)} edged ${L.full} ${score}.`,
        `${capitalize(W.full)} slipped past ${L.full} ${score}.`,
      ]);
    if (ctx.blowout)
      return pick([
        `${capitalize(W.full)} routed ${L.full} ${score}.`,
        `${capitalize(W.full)} rolled past ${L.full} ${score}.`,
      ]);
    return pick([
      `${capitalize(W.full)} beat ${L.full} ${score}.`,
      `${capitalize(W.full)} took care of ${L.full}, ${score}.`,
    ]);
  }

  function contextParagraph(ctx, seed, W, L) {
    if (ctx.series) return playoffContext(ctx, seed, W, L);
    return [regularContext(ctx, seed, W, L), formNotes(ctx, W, L)].filter(Boolean).join(' ');
  }
  function regularContext(ctx, seed, W, L) {
    const wr = ctx.winnerRecord,
      lr = ctx.loserRecord,
      hasRecords = [wr, lr].every(r => Array.isArray(r) && r.length >= 2);
    const records = hasRecords
      ? `${capitalize(recordNote(W.short, ctx.winnerPre, wr, true))}, while ${recordNote(L.short, ctx.loserPre, lr, false)}.`
      : '';
    if (ctx.upset) {
      const gap = gamesBetter(ctx.loserPre, ctx.winnerPre);
      const turn = choose(
        seed,
        [
          'and left with the kind of loss that gets noticed around the league',
          "and still couldn't solve a team it was supposed to handle",
          'which made this one a genuine surprise',
        ],
        'upset-turn'
      );
      return `${capitalize(L.short)} came in ${recordText(ctx.loserPre)}${gap ? `, ${gap} better than ${W.short},` : ''} ${turn}. ${records}`.trim();
    }
    if (ctx.close) {
      return `${choose(
        seed,
        [
          `Only ${plural(ctx.margin, 'point')} separated the teams at the finish.`,
          `It was a ${ctx.margin}-point game at the end, about as close as they come.`,
          `The final margin was a single possession.`,
        ],
        'close-context'
      )} ${records}`.trim();
    }
    if (ctx.blowout) {
      const widest = ctx.widestOfDay ? ` It was the most lopsided result on a ${num(ctx.dayGames)}-game slate.` : '';
      return `The ${ctx.margin}-point margin left little room for debate.${widest} ${records}`.trim();
    }
    const better =
      hasRecords &&
      ctx.winnerPre[0] + ctx.winnerPre[1] >= 5 &&
      percentage(ctx.loserPre) - percentage(ctx.winnerPre) >= 0.08;
    return better ? `${records} ${capitalize(L.short)} had the better record coming in.` : records;
  }

  function starParagraph(ctx, seed, W, L, p) {
    if (!p) return ctx.potg ? `${ctx.potgName} was named player of the game.` : '';
    const s = p.s,
      last = p.last,
      team = p.team.short;
    const fg = shotPair(s, 'FGM', 'FGA') && s.FGA >= 3 ? s.FGM / s.FGA : null;
    const threes =
      fg !== null && shotPair(s, 'TPM', 'TPA') && s.TPM > 0 && s.TPM <= s.FGM
        ? `, including ${s.TPM === 1 ? 'a 3-pointer' : `${num(s.TPM)} 3-pointers`}`
        : '';
    const shooting = fg !== null ? `${s.FGM}-of-${s.FGA} shooting${threes}` : '';
    const share = p.teamScore > 0 && s.PTS >= 4 && s.PTS / p.teamScore >= 0.3;
    if (!p.onWinner)
      return `${p.name} was the best player on the floor in a losing effort for ${L.short}, finishing with ${lineSummary(s)}${shooting ? ` on ${shooting}` : ''}.`;
    if (!p.headliner)
      return `${p.name} earned player of the game honors with ${lineSummary(s)}${shooting ? ` on ${shooting}` : ''}.`;
    let first = '';
    if (fg !== null && s.FGA >= 6 && fg <= 0.35)
      first = `It wasn't efficient. ${last} needed ${plural(s.FGA, 'shot')} to get there, going ${s.FGM}-of-${s.FGA}${share ? `, but still supplied ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points` : ''}.`;
    else if (fg !== null && fg >= 0.6 && s.FGA >= 4)
      first = choose(
        seed,
        [
          `${last} barely wasted a possession, going ${s.FGM}-of-${s.FGA} from the field${threes}${share ? `${threes ? ',' : ''} and accounting for ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points` : ''}.`,
          `${last} needed just ${plural(s.FGA, 'shot')} to get there, making ${num(s.FGM)}${threes}.`,
        ],
        'star-efficient'
      );
    else if (shooting && share)
      first = choose(
        seed,
        [
          `${last} accounted for ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points on ${shooting}.`,
          `${last} carried the scoring load on ${shooting}, supplying ${num(s.PTS)} of the team's ${p.teamScore} points.`,
        ],
        'star-share'
      );
    else if (shooting) first = `${last} got there on ${shooting}.`;
    else if (share) first = `${last} supplied ${num(s.PTS)} of ${possessive(team)} ${p.teamScore} points.`;
    const extras = ['REB', 'AST', 'STL', 'BLK']
      .filter(k => !p.doubles.includes(k) && Number.isInteger(s[k]) && s[k] >= { REB: 4, AST: 3, STL: 2, BLK: 2 }[k])
      .map(k => plural(s[k], statLabels[k].replace(/s$/, ''), statLabels[k]));
    const clean = Number.isInteger(s.TO) && s.TO === 0 && s.PTS >= 5,
      sloppy = Number.isInteger(s.TO) && s.TO >= 4;
    let second = '';
    if (extras.length)
      second = p.he
        ? `${capitalize(p.he)} also had ${listJoin(extras)}${clean ? ` ${extras.length > 1 ? 'without a turnover' : "and didn't commit a turnover"}` : ''}.`
        : `Throw in ${listJoin(extras)}${clean ? ' and zero turnovers' : ''}, and it was a full night's work.`;
    else if (clean) second = `${p.he ? capitalize(p.he) : last} didn't commit a turnover.`;
    if (sloppy) second += `${second ? ' ' : ''}The one blemish: ${plural(s.TO, 'turnover')}.`;
    return [first, second].filter(Boolean).join(' ');
  }

  function supportParagraph(ctx, seed, W, L, p) {
    const box = ctx.box || [],
      parts = [];
    const ranked = tid =>
      box.filter(r => r.tid === tid && r.stats.PTS > 0).sort((a, b) => b.stats.PTS - a.stats.PTS || a.pid - b.pid);
    const helper = ranked(ctx.winner?.id).find(r => r.pid !== ctx.potg?.id);
    if (helper) {
      const s = helper.stats,
        bench = s.GS === 0 ? ' off the bench' : '';
      const extra = ['REB', 'AST']
        .filter(k => Number.isInteger(s[k]) && s[k] >= 4)
        .map(k => plural(s[k], statLabels[k].replace(/s$/, ''), statLabels[k]));
      const verbText = p?.onWinner ? 'added' : `led ${W.short} with`;
      parts.push(`${helper.name} ${verbText} ${listJoin([plural(s.PTS, 'point'), ...extra])}${bench}.`);
    }
    const top = ranked(ctx.loser?.id).find(r => r.pid !== ctx.potg?.id);
    if (top) {
      const s = top.stats,
        cold = shotPair(s, 'FGM', 'FGA') && s.FGA >= 5 && s.FGM / s.FGA <= 0.35;
      parts.push(
        `${top.name} led ${L.short} with ${plural(s.PTS, 'point')}${cold ? `, but went ${s.FGM}-of-${s.FGA} from the field` : ''}.`
      );
    }
    const edge = teamEdge(ctx, W, L);
    if (edge) parts.push(edge);
    return parts.join(' ');
  }

  function generateArticle(ctx, fingerprint, quotesEnabled) {
    const id = `${fingerprint}:${ctx.seasonYear}:game:${ctx.game.gId}`;
    const seed = id,
      W = teamRef(ctx.winner),
      L = teamRef(ctx.loser),
      p = featured(ctx);
    const paragraphs = [
      lede(ctx, seed, W, L, p),
      contextParagraph(ctx, seed, W, L),
      starParagraph(ctx, seed, W, L, p),
      supportParagraph(ctx, seed, W, L, p),
    ];
    if (quotesEnabled && p?.onWinner) paragraphs.push(quoteParagraph(quoteBank(ctx, seed, 'quote-player'), p.last));
    if (quotesEnabled && ctx.coach) paragraphs.push(coachParagraph(ctx, seed));
    const summary = team => ({
      id: team.id,
      name: teamDisplay(team),
      city: (team.city || '').trim() || null,
      nickname: (team.name || team.shortName || '').trim() || null,
      logoURL: team.logoURL || null,
    });
    return {
      id,
      fingerprint,
      season: ctx.seasonYear,
      day: ctx.dayNumber,
      gid: ctx.game.gId,
      type: gameType(ctx),
      importance: frontPageWeight(ctx),
      headline: headline(ctx, seed),
      paragraphs: paragraphs.filter(Boolean),
      templateVersion: 3,
      editorialVersion: 2,
      leagueName: ctx.leagueName,
      playerStats: ctx.potgStats ? structuredClone(ctx.potgStats) : null,
      playerId: ctx.potg?.id ?? null,
      playerName: ctx.potgStats ? ctx.potgName : null,
      gameSummary: {
        home: { ...summary(ctx.home), score: ctx.game.homeScore },
        away: { ...summary(ctx.away), score: ctx.game.awayScore },
      },
      // The verified facts behind the prose; TV reads the same evidence.
      facts: structuredClone({
        version: 1,
        playoffs: ctx.playoffs,
        series: ctx.series,
        form: ctx.form,
        college: ctx.college,
        leagueShort: ctx.leagueShort,
        titleCount: ctx.titleCount,
        upset: ctx.upset,
        records: {
          [ctx.winner.id]: { pre: ctx.winnerPre, post: ctx.winnerRecord, last: ctx.winnerLastSeason },
          [ctx.loser.id]: { pre: ctx.loserPre, post: ctx.loserRecord, last: ctx.loserLastSeason },
        },
      }),
      quotesEnabled,
      coach: ctx.coach ? structuredClone(ctx.coach) : null,
      createdAt: new Date().toISOString(),
    };
  }

  function candidates(league, fingerprint, snapshots, coverage = 'standard') {
    const lookups = buildLookups(league);
    return lookups.completed
      .filter(x => x.dayIndex === lookups.latestDay)
      .map(x => gameContext(x.game, x.dayIndex, league, lookups, snapshots, fingerprint))
      .filter(ctx => ctx.importance >= coverageThreshold(coverage))
      .sort((a, b) => b.importance - a.importance || b.game.gId - a.game.gId);
  }
  function shouldGenerate(existing, ctx) {
    // Editorial upgrades rewrite the prose for games still in the loaded save.
    return (
      !existing ||
      (existing.templateVersion === 3 &&
        ((!existing.playerStats && ctx.potgStatsTrusted) ||
          (!existing.coach && !!ctx.coach) ||
          (existing.editorialVersion || 0) < 2))
    );
  }
  function coachParagraph(ctx, seed) {
    const W = teamRef(ctx.winner);
    return quoteParagraph(
      quoteBank(ctx, seed, 'quote-coach'),
      `${W.city || W.nickname} coach ${playerDisplay(ctx.coach)}`
    );
  }
  return {
    hashString,
    choose,
    assertSave,
    teamDisplay,
    playerDisplay,
    buildFingerprint,
    isCompleted,
    buildLookups,
    captureSnapshots,
    snapshotId,
    storyId,
    seasonYear,
    validStats,
    gameContext,
    candidates,
    generateArticle,
    shouldGenerate,
    coachForTeam,
    num,
    plural,
    capitalize,
    listJoin,
    surname,
    possessive,
    pronoun,
    pronouns,
    squad,
    positionName,
    positionKeys,
    teamRef,
    verb,
    quoteParagraph,
    gamesBetter,
    teamTotals,
  };
});
