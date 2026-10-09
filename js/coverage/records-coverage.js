/* In-season context, milestones and record watches. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./core.js'), require('./season-coverage.js'));
  else root.HoopWireRecords = factory(root.HoopWireCore, root.HoopWireSeason);
})(globalThis, function (C, S) {
  'use strict';
  const names = {
    PTS: 'points',
    REB: 'rebounds',
    AST: 'assists',
    STL: 'steals',
    BLK: 'blocks',
    TPM: 'three-pointers',
    FGM: 'field goals',
    FTM: 'free throws',
    TO: 'turnovers',
  };
  const steps = { PTS: 1000, REB: 500, AST: 500, STL: 100, BLK: 100, TPM: 250, FGM: 1000, FTM: 500 };
  const notableHigh = { PTS: 20, REB: 15, AST: 10, STL: 5, BLK: 5, TPM: 5, FGM: 10, FTM: 10 };
  const valid = n => Number.isInteger(n) && n >= 0;
  function history(p, league, period = 'season') {
    const years = [
      ...new Set(
        (p.stats || []).filter(x => x.league === league.leagueType && x.yr <= C.seasonYear(league)).map(x => x.yr)
      ),
    ];
    const lines = years
      .filter(y => {
        const entries = (p.stats || [])
          .filter(s => s.league === league.leagueType && s.yr === y)
          .flatMap(s => s[period] || []);
        return entries.length && !entries.every(s => ['GP', 'PTS', 'REB', 'AST'].every(k => s[k] === 0));
      })
      .map(y => S.stats(p, league, y, period));
    if (!lines.length || lines.some(s => !s)) return null;
    const sum = {};
    for (const k of ['GP', ...Object.keys(names)])
      if (lines.every(s => valid(s[k]))) sum[k] = lines.reduce((n, s) => n + s[k], 0);
    return sum.GP > 0 ? sum : null;
  }
  // How big a name a player is, from the save: career production in this
  // league, how long they lasted, and the honors on their record.
  // Roughly: under 12 a role player, 12 a regular, 18 a star.
  const honorWeight = {
    0: 1.5,
    1: 8,
    2: 12,
    3: 4,
    4: 3,
    5: 3,
    6: 3,
    7: 4,
    8: 4,
    9: 4,
    10: 3,
    11: 3,
    101: 3,
    100: 2,
    96: 2,
  };
  function stature(p, league) {
    if (!p) return 0;
    const career = history(p, league),
      current = S.stats(p, league, C.seasonYear(league));
    const ppg = Math.max(career?.GP > 0 ? career.PTS / career.GP : 0, current?.GP >= 5 ? current.PTS / current.GP : 0);
    const honors = (p.awards || [])
      .filter(a => a.league === league.leagueType)
      .reduce((n, a) => n + (honorWeight[a.id] || 0) * (a.yearsWon || []).length, 0);
    const hall = (league.hallOfFame || []).some(h => h?.id === p.id) ? 20 : 0;
    return Math.round((ppg + honors + Math.min(career?.GP || 0, 600) / 100 + hall) * 10) / 10;
  }
  const tier = v => (v >= 18 ? 'star' : v >= 12 ? 'regular' : 'role');
  const scopeOf = e => e.scope || (/^career/i.test(e.label || '') ? 'career' : 'season');
  function data(league) {
    const lookup = C.buildLookups(league),
      year = C.seasonYear(league),
      players = new Map(lookup.players);
    for (const p of [...(league.retirees || []), ...(league.hallOfFame || [])])
      if (!players.has(p.id)) players.set(p.id, p);
    // Only players the save lists as retired are called retired in copy.
    const retired = new Set(
      [...(league.retirees || []), ...(league.hallOfFame || [])]
        .map(p => p?.id)
        .filter(id => id != null && !lookup.players.has(id))
    );
    const snapshots = C.captureSnapshots(league).filter(s => s.day === lookup.latestDay + 1);
    return { league, lookup, year, players, snapshots, retired };
  }
  function periodFor(game) {
    return game.tRound > 0 ? 'playoffs' : game.gameType === 0 ? 'season' : null;
  }
  function contextFor(d, snap) {
    const player = d.players.get(snap.pid),
      entry = d.lookup.completed.find(x => x.game.gId === snap.gid);
    if (!player || !entry) return null;
    const period = periodFor(entry.game);
    if (!period) return null;
    const season = S.stats(player, d.league, d.year, period),
      career = history(player, d.league, period);
    if (!season || !career) return null;
    return { player, game: entry.game, period, season, career, gameStats: snap.stats };
  }
  function enrich(story, league) {
    if (!story.playerId) return story;
    const d = data(league),
      snap = d.snapshots.find(s => s.pid === story.playerId && s.gid === story.gid);
    const facts = snap && contextFor(d, snap);
    if (!facts) return story;
    const { player, season, career, period } = facts;
    const last = player.ln || C.surname(C.playerDisplay(player)),
      game = story.playerStats || facts.gameStats;
    const big =
      season.GP > 1 &&
      valid(game?.PTS) &&
      game.PTS >= (1.75 * season.PTS) / season.GP &&
      game.PTS - season.PTS / season.GP >= 3;
    const when = period === 'season' ? 'this season' : 'in the playoffs';
    const line = `${last} is averaging ${C.perGameList(season)} ${when}.`;
    // Season context belongs beside the box score, ahead of the postgame quotes.
    const text = big
      ? `It was a breakout night for ${last}, who came in averaging ${((season.PTS - game.PTS) / (season.GP - 1)).toFixed(1)} points a game ${when}.`
      : line;
    const at = story.paragraphs.findIndex(p => /^[“"]/.test(p));
    if (at >= 0) story.paragraphs.splice(at, 0, text);
    else story.paragraphs.push(text);
    story.cumulativeStats = structuredClone({ season, career, period, year: d.year, leagueType: league.leagueType });
    story.statContextVersion = 1;
    return story;
  }
  function candidates(league) {
    const d = data(league),
      { lookup, year, players, retired } = d,
      fp = C.buildFingerprint(league),
      day = lookup.latestDay + 1,
      result = [];
    if (day < 1) return result;
    function add(key, type, headline, paragraphs, team, player, evidence, game, value = null) {
      if (!team || !paragraphs.length) return;
      const opponent =
        lookup.teams.get(game?.homeTeam === team.id ? game.awayTeam : game?.homeTeam) ||
        [...lookup.teams.values()].find(t => t.id !== team.id);
      const story = {
        id: `${fp}:${year}:season:${key}`,
        eventKey: key,
        kind: 'season',
        fingerprint: fp,
        season: year,
        day,
        type,
        headline,
        paragraphs,
        importance: Math.round(value ?? (type === 'Record watch' ? 75 : 105)),
        templateVersion: 5,
        editorialVersion: 3,
        quotesEnabled: true,
        leagueName: league.leagueName,
        createdAt: new Date().toISOString(),
        relatedTeams: [{ id: team.id, name: C.teamDisplay(team), logoURL: team.logoURL || null }],
        seasonSnapshot: {
          headers: ['Category', 'Mark', 'Context'],
          rows: evidence.map(e => [e.label, e.value, e.detail]),
          evidence: structuredClone(evidence),
          source: 'uploaded-save',
          pid: player?.id ?? null,
          teamId: team.id,
          gid: game?.gId ?? null,
        },
      };
      const context = {
        winner: team,
        loser: opponent,
        home: lookup.teams.get(game?.homeTeam) || team,
        game: game || { homeTeam: team.id },
        scenePlayer: player || team.roster?.[0],
        potg: player,
        potgStatsTrusted: !!player,
        gameBall: league.gameballs?.[Number(league.settings?.gameBall) || 0] || {
          pri: 'E37033',
          sec: 'E37033',
          ter: 'E37033',
          outline: '44220F',
        },
      };
      result.push({ story, context });
    }
    // Record books open after a league's first season; until then a record only beats that season's games.
    const established = year > (Number(league.season?.startingYear) || year);
    // Individual milestones require a matched box score to establish when a threshold was crossed.
    for (const snap of d.snapshots) {
      const f = contextFor(d, snap);
      if (!f) continue;
      const { player, season, career, period, game } = f,
        team = lookup.teams.get(player.tid),
        name = C.playerDisplay(player),
        stage = period === 'season' ? 'regular-season' : 'playoff';
      if (season.GP < 2) continue;
      const paragraphs = [],
        evidence = [];
      for (const [k, label] of Object.entries(names)) {
        const value = snap.stats[k];
        if (!valid(value) || value === 0) continue;
        for (const [scope, total, step] of [
          ['season', season, steps[k]],
          ['career', career, steps[k] * 2],
        ]) {
          if (!step || !valid(total[k]) || total[k] < value || (scope === 'career' && career.GP === season.GP))
            continue;
          const mark = Math.floor(total[k] / step) * step;
          if (mark >= step && total[k] - value < mark) {
            paragraphs.push(
              `${paragraphs.length ? C.surname(name) : name} reached ${mark.toLocaleString('en-US')} ${scope === 'career' ? 'career ' : ''}${stage} ${label}${paragraphs.length ? '' : `, adding ${value} against ${C.teamRef(lookup.teams.get(game.homeTeam === team.id ? game.awayTeam : game.homeTeam)).full}`} ${paragraphs.length ? 'as well' : `to bring the total to ${total[k].toLocaleString('en-US')}`}.`
            );
            evidence.push({
              label: `${scope} ${label}`,
              value: total[k],
              detail: `Milestone: ${mark}`,
              before: total[k] - value,
              mark,
              stats: structuredClone(total),
              gameId: game.gId,
              stat: k,
              scope,
              stage,
            });
          }
        }
        const high = player.careerStats?.[period === 'season' ? 'seasonHighs' : 'playoffHighs']?.[k];
        if (career.GP >= 10 && valid(high) && high === value && value >= notableHigh[k]) {
          paragraphs.push(
            `${paragraphs.length ? C.surname(name) : name} set a ${stage} career high with ${value} ${label}${paragraphs.length ? ' along the way' : ''}.`
          );
          evidence.push({
            label: `Career game high: ${label}`,
            value,
            detail: stage,
            source: 'careerStats',
            gameId: game.gId,
            stat: k,
            stage,
            average: season.GP > 0 ? Number((season[k] / season.GP).toFixed(1)) : null,
          });
        }
        const entries = (league.records?.[period]?.[k] || []).filter(
          r => valid(r.value) && r.gameResults?.league === league.leagueType
        );
        const max = entries.length ? Math.max(...entries.map(r => r.value)) : null;
        const record = entries.find(
          r => r.pid === player.id && r.yr === year && r.gameResults.gId === game.gId && r.value === value
        );
        const before = list => {
          const others = list.filter(r => r !== record).map(r => r.value);
          return others.length ? Math.max(...others) : null;
        };
        const against = C.teamRef(lookup.teams.get(game.homeTeam === team.id ? game.awayTeam : game.homeTeam)).full;
        if (established && record && value === max) {
          paragraphs.push(
            paragraphs.length
              ? `Those ${value} ${label} are also the most in a ${stage} game in league history.`
              : `${name} had ${value} ${label} against ${against}, the most in a ${stage} game in league history.`
          );
          evidence.push({
            label: `League game record: ${label}`,
            value,
            detail: stage,
            record: structuredClone(record),
            gameId: game.gId,
            stat: k,
            stage,
            previous: before(entries),
          });
        }
        const teamEntries = entries.filter(r => r.tid === team.id);
        if (established && record && teamEntries.length && value === Math.max(...teamEntries.map(r => r.value))) {
          paragraphs.push(
            paragraphs.length
              ? `It's also a ${C.teamDisplay(team)} franchise record.`
              : `${name} had ${value} ${label} against ${against}, a ${C.teamDisplay(team)} franchise record for a single game.`
          );
          evidence.push({
            label: `Team player game record: ${label}`,
            value,
            detail: C.teamDisplay(team),
            record: structuredClone(record),
            gameId: game.gId,
            stat: k,
            stage,
            previous: before(teamEntries),
          });
        }
      }
      // A record-book line is news for anyone; a career high mostly matters for the names people know.
      const lift = { star: 25, regular: 10, role: 0 }[tier(stature(player, league))] + (period === 'playoffs' ? 10 : 0);
      const worth = Math.max(
        ...evidence.map(e =>
          /^League game record/.test(e.label)
            ? 115
            : /^Team player game record/.test(e.label)
              ? 90 + lift / 2
              : e.mark
                ? (scopeOf(e) === 'career' ? 80 : 65) + lift
                : /^Career game high/.test(e.label)
                  ? 45 + lift
                  : 60
        )
      );
      if (paragraphs.length)
        add(
          `milestone-${period}-${player.id}-${game.gId}`,
          evidence.some(e => e.mark) ? 'Milestone' : 'Single-game record',
          evidence[0].mark
            ? `${name} reaches ${evidence[0].mark.toLocaleString('en-US')} ${evidence[0].label}`
            : `${name} posts ${evidence[0].label.startsWith('Career') ? 'a career-best' : evidence[0].label.startsWith('Team') ? 'a franchise-record' : 'a league-record'} ${evidence[0].value} ${evidence[0].label.split(': ').at(-1)}`,
          paragraphs,
          team,
          player,
          evidence,
          game,
          worth
        );
    }
    // The record book can substantiate a single-game mark even after a box score is overwritten.
    for (const period of ['season', 'playoffs', 'finals'])
      for (const [k, label] of Object.entries(names)) {
        const entries = (league.records?.[period]?.[k] || []).filter(
          r =>
            valid(r.value) &&
            r.gameResults?.league === league.leagueType &&
            C.isCompleted(r.gameResults, lookup.teams, league.currentGame)
        );
        if (!entries.length || !established) continue;
        const max = Math.max(...entries.map(r => r.value));
        if (max === 0) continue;
        for (const record of entries.filter(r => r.value === max && r.yr === year)) {
          const played = lookup.completed.find(
            x => x.game.gId === record.gameResults.gId && x.dayIndex === lookup.latestDay
          );
          const p = players.get(record.pid),
            team = lookup.teams.get(record.tid);
          if (
            !played ||
            !p ||
            !team ||
            result.some(x =>
              x.story.seasonSnapshot.evidence.some(
                e =>
                  e.record?.pid === p.id &&
                  e.record?.gameResults?.gId === played.game.gId &&
                  e.record?.value === record.value
              )
            )
          )
            continue;
          add(
            `single-game-${period}-${p.id}-${k.toLowerCase()}-${played.game.gId}`,
            'Single-game record',
            `${C.playerDisplay(p)} posts a league-record ${record.value} ${label}`,
            [
              `${C.playerDisplay(p)} had ${record.value} ${label} against ${C.teamRef(lookup.teams.get(played.game.homeTeam === team.id ? played.game.awayTeam : played.game.homeTeam)).full}, the most in a ${period === 'season' ? 'regular-season' : period === 'finals' ? 'Finals' : 'playoff'} game in league history.`,
            ],
            team,
            p,
            [
              {
                label: `Single-game ${label}`,
                value: record.value,
                detail: period,
                record: structuredClone(record),
                gameId: played.game.gId,
                stat: k,
                stage: period === 'season' ? 'regular-season' : period === 'finals' ? 'Finals' : 'playoff',
                previous: (() => {
                  const o = entries.filter(r => r !== record).map(r => r.value);
                  return o.length ? Math.max(...o) : null;
                })(),
              },
            ],
            played.game,
            115
          );
        }
      }
    // Where a record came from: a season mark has its year; a career mark is
    // still growing while its holder plays, so it's "held by" until they stop.
    // Only the save's retirees are called retired (graduated, in college); anyone else just last played.
    const recordOrigin = (record, scope, holder, league, year) => {
      if (scope === 'season')
        return Number.isInteger(record.yr) ? `set by ${holder} in ${record.yr}` : `set by ${holder}`;
      const years = (record.p.stats || [])
          .filter(s => s.league === league.leagueType && Number.isInteger(s.yr))
          .map(s => s.yr),
        last = years.length ? Math.max(...years) : null;
      // College players who leave the game graduate; pros retire.
      const left = league.leagueType === 1 ? 'graduated' : 'retired';
      if (retired.has(record.p.id))
        return last !== null ? `set by ${holder}, who ${left} in ${last}` : `set by ${holder}, who has since ${left}`;
      return last !== null && last < year ? `set by ${holder}, who last played in ${last}` : `held by ${holder}`;
    };
    // Compare current totals with prior seasons and the league's career leaderboard from player histories.
    const careerLeaders = [...players.values()].map(p => ({ p, s: history(p, league) })).filter(x => x.s);
    const prior = [];
    for (const p of players.values())
      for (const yr of new Set(
        (p.stats || []).filter(s => s.league === league.leagueType && s.yr < year).map(s => s.yr)
      )) {
        const s = S.stats(p, league, yr);
        if (s) prior.push({ p, s, yr });
      }
    for (const player of lookup.players.values()) {
      const team = lookup.teams.get(player.tid),
        season = S.stats(player, league, year),
        career = history(player, league);
      if (!team || !season || season.GP < 5) continue;
      for (const [k, label] of Object.entries(names)) {
        if (k === 'TO') continue;
        for (const [scope, total, pool] of [
          ['season', season, prior],
          ['career', career, careerLeaders.filter(x => x.p.id !== player.id)],
        ]) {
          if (!valid(total?.[k]) || (scope === 'career' && (!career || career.GP === season.GP))) continue;
          const ranked = pool.filter(x => valid(x.s[k])).sort((a, b) => b.s[k] - a.s[k]);
          if (!ranked.length || ranked[0].s[k] <= 0) continue;
          const record = ranked[0],
            gap = record.s[k] - total[k];
          if (gap <= 0) {
            const snap = d.snapshots.find(s => s.pid === player.id),
              f = snap && contextFor(d, snap);
            const otherCurrent =
              scope === 'season'
                ? [...players.values()]
                    .filter(p => p.id !== player.id)
                    .map(p => S.stats(p, league, year)?.[k])
                    .filter(valid)
                : [];
            if (
              f?.period === 'season' &&
              valid(snap.stats[k]) &&
              snap.stats[k] > 0 &&
              (gap === 0 ? total[k] - snap.stats[k] < record.s[k] : total[k] - snap.stats[k] <= record.s[k]) &&
              (!otherCurrent.length || total[k] >= Math.max(...otherCurrent))
            ) {
              const name = C.playerDisplay(player),
                holder = C.playerDisplay(record.p);
              add(
                `record-${scope}-${gap === 0 ? 'tie' : 'break'}-${player.id}-${k.toLowerCase()}-${record.s[k]}`,
                'League record',
                `${name} ${gap === 0 ? 'ties' : 'passes'} ${holder} in the record book`,
                [
                  `${name} has ${total[k]} ${scope === 'season' ? 'regular-season' : 'career regular-season'} ${label}, ${gap === 0 ? 'matching' : 'surpassing'} ${holder}'s ${record.s[k]}. ${snap.stats[k]} against ${C.teamRef(lookup.teams.get(f.game.homeTeam === team.id ? f.game.awayTeam : f.game.homeTeam)).full} put ${C.surname(name)} ${gap === 0 ? 'level' : 'over the top'}.`,
                ],
                team,
                player,
                [
                  {
                    label: `${scope} ${label}`,
                    value: total[k],
                    detail: `Previous mark: ${record.s[k]}`,
                    holder: record.p.id,
                    holderName: holder,
                    target: record.s[k],
                    tie: gap === 0,
                    gameId: f.game.gId,
                    stat: k,
                    scope,
                    source: 'player.stats',
                  },
                ],
                f.game,
                (scope === 'career' ? 125 : 115) + { star: 10, regular: 5, role: 0 }[tier(stature(player, league))]
              );
            }
            continue;
          }
          if (gap > Math.max(1, Math.min(record.s[k] * 0.05, (season[k] / season.GP) * 3))) continue;
          // A season-total watch expires when the team's regular season is over.
          if (
            scope === 'season' &&
            (team.season || []).find(s => s.yr === year)?.seasonStats?.GP >= league.season?.totalGames
          )
            continue;
          const name = C.playerDisplay(player),
            holder = C.playerDisplay(record.p),
            title = scope === 'season' ? 'single-season mark' : 'career lead';
          add(
            `watch-${scope}-${player.id}-${k.toLowerCase()}-${record.p.id}-${record.s[k]}`,
            'Record watch',
            `${name} closes in on ${holder}'s ${title}`,
            [
              `${name} is now only ${C.plural(gap, label.replace(/s$/, ''))} shy of the ${league.shortName || league.leagueName} ${scope === 'season' ? 'single-season' : 'career'} record, ${Number(record.s[k]).toLocaleString('en-US')}, ${recordOrigin(record, scope, holder, league, year)}.`,
            ],
            team,
            player,
            [
              {
                label: `${scope} ${label}`,
                value: total[k],
                detail: `${gap} behind ${holder}`,
                target: record.s[k],
                holder: record.p.id,
                holderName: holder,
                recordYear: record.yr ?? null,
                stat: k,
                scope,
                watch: true,
                source: 'player.stats',
              },
            ],
            undefined,
            55 + { star: 25, regular: 10, role: 0 }[tier(stature(player, league))] + (scope === 'career' ? 5 : 0)
          );
        }
      }
    }
    // Team scoring highs/lows need a complete regular-season schedule to date.
    for (const team of lookup.teams.values()) {
      const games = lookup.completed.filter(
        x => periodFor(x.game) === 'season' && [x.game.homeTeam, x.game.awayTeam].includes(team.id)
      );
      const teamYear = (team.season || []).find(s => s.yr === year)?.seasonStats;
      if (!teamYear || games.length !== teamYear.GP || games.length < 6) continue;
      for (const entry of games.filter(x => x.dayIndex === lookup.latestDay)) {
        const score = g => (g.homeTeam === team.id ? g.homeScore : g.awayScore);
        const earlier = games.filter(x => x.dayIndex < entry.dayIndex);
        if (earlier.length < 5) continue;
        const value = score(entry.game),
          high = Math.max(...earlier.map(x => score(x.game))),
          low = Math.min(...earlier.map(x => score(x.game)));
        if (value <= high && value >= low) continue;
        const direction = value > high ? 'high' : 'low';
        const T = C.teamRef(team),
          O = C.teamRef(lookup.teams.get(entry.game.homeTeam === team.id ? entry.game.awayTeam : entry.game.homeTeam));
        add(
          `team-scoring-${direction}-${team.id}-${entry.game.gId}`,
          'Team record',
          `${T.nickname} ${C.verb(T, 'hit')} season ${direction} with ${value} points`,
          [
            direction === 'high'
              ? `${C.capitalize(T.full)} scored ${value} points against ${O.full}, their most in a game this season. The previous high was ${high}.`
              : `${C.capitalize(T.full)} managed just ${value} points against ${O.full}, their lowest output of the season. The previous low was ${low}.`,
          ],
          team,
          null,
          [
            {
              label: `Team season scoring ${direction}`,
              value,
              detail: `Previous: ${direction === 'high' ? high : low}`,
              gameId: entry.game.gId,
              source: 'season.schedule',
              stat: 'PTS',
              direction,
              previous: direction === 'high' ? high : low,
              average: Number((earlier.reduce((n, x) => n + score(x.game), 0) / earlier.length).toFixed(1)),
            },
          ],
          entry.game,
          (direction === 'high' ? 55 : 50) + (teamYear.W / Math.max(1, teamYear.W + teamYear.L) >= 0.6 ? 10 : 0)
        );
      }
    }
    return result;
  }
  return { history, enrich, candidates, stature, tier };
});
