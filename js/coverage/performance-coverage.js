/* Player performance stories: breakout lines and key players going quiet. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./core.js'), require('./season-coverage.js'));
  else root.HoopWirePerformance = factory(root.HoopWireCore, root.HoopWireSeason);
})(globalThis, function (C, S) {
  'use strict';
  const categories = { PTS: 'points', REB: 'rebounds', AST: 'assists', STL: 'steals', TO: 'turnovers' };
  const unit = {
    PTS: ['point', 'points'],
    REB: ['rebound', 'rebounds'],
    AST: ['assist', 'assists'],
    STL: ['steal', 'steals'],
    TO: ['turnover', 'turnovers'],
  };
  const valid = n => Number.isInteger(n) && n >= 0;
  const average = n => (n > 0 && n < 0.1 ? String(Number(n.toPrecision(2))) : n.toFixed(1));
  // Bars are written for a full-length pro game (about 110 points a team) and
  // scaled by the league's real scoring. Steals barely scale with game length.
  const bars = {
    PTS: { line: 22, swing: 10, ratio: 1.5, floor: [7, 5] },
    REB: { line: 12, swing: 6, ratio: 1.6, floor: [6, 4] },
    AST: { line: 9, swing: 5, ratio: 1.6, floor: [5, 3] },
    STL: { line: 4, swing: 3, ratio: 2, flat: true, floor: [3, 2] },
    TO: { line: 6, swing: 4, ratio: 2, floor: [5, 3] },
  };
  const minimumGames = 5,
    perGameCap = 1,
    dailyShare = 0.6;
  function leagueScale(league, lookup) {
    const games = lookup.completed.filter(x => x.game.tRound === 0 && x.game.gameType === 0);
    if (!games.length) return 1;
    const perTeam = games.reduce((n, x) => n + x.game.homeScore + x.game.awayScore, 0) / (games.length * 2);
    return Math.min(1.2, Math.max(0.15, perTeam / 110));
  }
  // Small counts are noisy at any game length, so every bar has an absolute floor.
  const bar = (k, field, scale) =>
    Math.max(
      bars[k].floor[field === 'line' ? 0 : 1],
      bars[k][field] * (bars[k].flat ? Math.max(0.75, Math.sqrt(scale)) : scale)
    );
  // Where the player sits in the rotation, from season averages before the game.
  function role(player, baseline, team, league, year, period) {
    const mates = (team?.roster || [])
      .map(p => ({ p, s: S.stats(p, league, year, 'season', team.id) }))
      .filter(x => x.s?.GP >= 3);
    const rank = k =>
      1 + mates.filter(x => x.p.id !== player.id && x.s[k] / x.s.GP > (baseline[k] ?? 0) / baseline.GP).length;
    const starts = Number.isFinite(baseline.GS) ? baseline.GS / baseline.GP : null;
    return {
      scorerRank: rank('PTS'),
      reboundRank: rank('REB'),
      starter: starts === null ? null : starts >= 0.5,
      minutes: Number.isFinite(baseline.MIN) ? baseline.MIN / baseline.GP : null,
      period,
    };
  }
  function compare(box, baseline) {
    if (!valid(baseline?.GP) || baseline.GP === 0) return [];
    return Object.entries(categories).flatMap(([key, label]) => {
      if (!valid(box?.[key]) || !valid(baseline[key])) return [];
      const expected = baseline[key] / baseline.GP,
        difference = box[key] - expected;
      return [
        {
          key,
          label,
          actual: box[key],
          expected,
          direction: difference >= 0 ? 'above' : 'below',
          favorable: key === 'TO' ? difference < 0 : difference > 0,
          qualifies: false,
          mention: false,
          score: 0,
        },
      ];
    });
  }
  // The editorial test. Each category that passes gets a score; the story
  // leads with the strongest one.
  function judge(comparisons, box, r, scale) {
    for (const c of comparisons) {
      const b = k => bar(c.key, k, scale),
        avg = c.expected,
        x = c.actual;
      let score = 0;
      if (c.key === 'TO') {
        if (x >= Math.max(b('line'), avg + b('swing'), avg * bars.TO.ratio) && r.starter !== false)
          score = ((x - avg) / b('swing')) * 0.8;
      } else if (c.favorable) {
        // Deep-bench averages swing wildly; they need a line that's news on its own.
        const regular = avg >= b('line') * 0.4 || x >= b('line') * 1.5;
        if (regular && x >= b('line') && x >= avg * bars[c.key].ratio && x - avg >= b('swing'))
          score = (x - avg) / b('swing');
      } else if (c.key === 'PTS') {
        // Quiet scoring nights are news only for a team's go-to scorers.
        if (r.scorerRank <= 2 && avg >= Math.max(6, 14 * scale) && x <= avg * 0.5 && avg - x >= Math.max(4, 8 * scale))
          score = ((avg - x) / Math.max(4, 8 * scale)) * 0.9;
      } else if (c.key === 'REB') {
        if (r.reboundRank === 1 && avg >= Math.max(5, 8 * scale) && x <= avg * 0.4)
          score = ((avg - x) / Math.max(3, 6 * scale)) * 0.7;
      }
      c.score = Number(score.toFixed(3));
      c.qualifies = score >= 1;
      // A secondary category is worth a sentence once it has moved by a real amount.
      c.mention = c.qualifies || Math.abs(x - avg) >= b('swing') * 0.6;
    }
    const fg = ['FGM', 'FGA'].every(k => valid(box[k])) && box.FGA > 0 && box.FGM <= box.FGA ? box.FGM / box.FGA : null;
    return { cold: r.scorerRank <= 2 && fg !== null && box.FGA >= Math.max(8, 15 * scale) && fg <= 0.3, fg };
  }
  const count = (n, key) => C.plural(n, unit[key][0], unit[key][1]);
  function size(c) {
    if (c.actual === 0) return 'none';
    const ratio = c.actual / c.expected;
    return ratio >= 2.5 ? 'way' : ratio >= 1.9 ? 'double' : ratio >= 1.5 ? 'well' : ratio <= 0.4 ? 'fraction' : 'half';
  }
  function versus(c, he) {
    const avg = average(c.expected),
      word = {
        way: 'far beyond',
        double: 'nearly double',
        well: 'well above',
        fraction: 'a fraction of',
        half: 'about half',
      }[size(c)];
    return `${word} ${he ? `${he === 'she' ? 'her' : 'his'} usual` : 'the usual'} ${avg}`;
  }
  function headline(name, c, opp, seed, bench, coldOnly) {
    const o = opp.nickname,
      n = c.actual,
      up = c.favorable;
    if (coldOnly)
      return C.choose(
        seed,
        [`${name} struggles from the field against ${o}`, `Cold night for ${name} against ${o}`],
        'performance-headline'
      );
    const options = {
      PTS: up
        ? bench
          ? [`${name} scores ${n} off the bench against ${o}`, `${name} sparks bench with ${n} against ${o}`]
          : [
              `${name} pours in ${n} against ${o}`,
              `${name} erupts for ${n} points`,
              `${name} goes for ${n} against ${o}`,
            ]
        : n === 0
          ? [`${name} held scoreless against ${o}`, `${name} goes scoreless against ${o}`]
          : [`Quiet night for ${name}: ${n} points against ${o}`, `${name} limited to ${n} points against ${o}`],
      REB: up
        ? [`${name} owns the glass with ${n} rebounds`, `${name} pulls down ${n} boards against ${o}`]
        : [`${name} quiet on the boards against ${o}`, `Few rebounds for ${name} against ${o}`],
      AST: up
        ? [`${name} dishes out ${n} assists against ${o}`, `${name} turns playmaker with ${n} assists`]
        : [`${name} finds few assists against ${o}`],
      STL: up
        ? [`${name} racks up ${n} steals against ${o}`, `${name} swipes ${n} steals against ${o}`]
        : [`${name} comes up short of usual steals against ${o}`],
      TO: up
        ? [`${name} takes care of the ball against ${o}`]
        : [`${name} coughs it up ${n} times against ${o}`, `Turnovers trip up ${name} against ${o}`],
    };
    return C.choose(seed, options[c.key], 'performance-headline');
  }
  function roleText(r, baseline) {
    const ppg = average(baseline.PTS / baseline.GP);
    if (r.scorerRank === 1) return `the team's leading scorer at ${ppg} points a game`;
    if (r.scorerRank === 2) return `the team's second-leading scorer at ${ppg} points a game`;
    if (r.starter === false) return `a reserve averaging ${ppg} points`;
    return `a player averaging ${ppg} points`;
  }
  function stage(series, college) {
    if (!series) return '';
    if (series.title)
      return college ? ' in the national championship game' : ' in the title-clinching game of the Finals';
    if (series.final) return series.firstTo > 1 ? ` in Game ${series.gameNumber} of the Finals` : ' in the title game';
    return series.firstTo > 1
      ? ` in Game ${series.gameNumber} of the ${series.roundName}`
      : ` in the ${series.roundName}`;
  }
  function article({
    name,
    last,
    he,
    focus,
    changes,
    baseline,
    mine,
    opp,
    result,
    stats,
    r,
    coldOnly,
    series,
    college,
  }) {
    const c = focus,
      in_ = `in ${C.possessive(mine.nick)} ${result.score} ${result.won ? 'win over' : 'loss to'} ${opp.full}${stage(series, college)}`;
    const shooting =
      valid(stats.FGM) && valid(stats.FGA) && stats.FGA > 0 && stats.FGM <= stats.FGA
        ? ` on ${stats.FGM}-of-${stats.FGA} shooting`
        : '';
    const subject = he ? C.capitalize(he) : last;
    let lede;
    if (coldOnly)
      lede = `${name} went ${stats.FGM}-of-${stats.FGA} from the field ${in_}, a rough shooting night for ${roleText(r, baseline)}.`;
    else if (c.key === 'PTS' && c.actual === 0)
      lede = `${name} went scoreless ${in_}, a quiet night for ${roleText(r, baseline)}.`;
    else if (c.key === 'PTS' && !c.favorable)
      lede = `${name} scored just ${count(c.actual, 'PTS')}${shooting} ${in_}, a quiet night for ${roleText(r, baseline)}.`;
    else {
      const what = {
        PTS: `scored ${count(c.actual, 'PTS')}${shooting} ${in_}`,
        REB: `grabbed ${count(c.actual, 'REB')} ${in_}`,
        AST: `had ${count(c.actual, 'AST')} ${in_}`,
        STL: `had ${count(c.actual, 'STL')} ${in_}`,
        TO: c.actual === 0 ? `didn't commit a turnover ${in_}` : `committed ${count(c.actual, 'TO')} ${in_}`,
      }[c.key];
      lede = `${name} ${what}, ${versus(c, he)} ${c.label} per game.`;
    }
    const paragraphs = [C.capitalize(lede)];
    // Who this is matters as much as the number: a bench breakout reads differently than a star's quiet night.
    if (c.qualifies && c.favorable && c.key !== 'TO') {
      if (r.starter === false)
        paragraphs.push(
          `${subject} has come off the bench for most of the season, averaging ${average(c.expected)} ${c.label}, which is what makes this one stand out.`
        );
    }
    const more = changes.filter(x => x !== c && x.mention);
    if (more.length) {
      const mixed = more.filter(x => x.favorable !== c.favorable),
        same = more.filter(x => x.favorable === c.favorable);
      const phrase = x =>
        `${x.key === 'TO' ? (x.actual === 0 ? 'no turnovers' : count(x.actual, 'TO')) : count(x.actual, x.key)} against an average of ${average(x.expected)}`;
      if (same.length) paragraphs.push(`${subject} also finished with ${C.listJoin(same.map(phrase))}.`);
      if (mixed.length)
        paragraphs.push(
          `${c.favorable ? "It wasn't all good news" : 'There was a bright side'}: ${C.listJoin(mixed.map(phrase))}.`
        );
    }
    return paragraphs;
  }
  function candidates(league) {
    const fingerprint = C.buildFingerprint(league),
      year = C.seasonYear(league),
      lookup = C.buildLookups(league),
      scale = leagueScale(league, lookup);
    const snapshots = C.captureSnapshots(league, fingerprint),
      map = new Map(snapshots.map(s => [s.id, s])),
      found = [];
    for (const snap of snapshots) {
      if (snap.day !== lookup.latestDay + 1) continue;
      const player = lookup.players.get(snap.pid),
        entry = lookup.completed.find(x => x.game.gId === snap.gid && x.dayIndex + 1 === snap.day);
      if (!player || !entry || snap.stats.DNP > 0 || (Array.isArray(snap.stats.MIN) && snap.stats.MIN[0] === 0))
        continue;
      const game = entry.game,
        playoffs = game.tRound > 0;
      if (!playoffs && game.gameType !== 0) continue;
      // The recap already covers the player of the game.
      if (game.potg === snap.pid) continue;
      const totals = S.stats(player, league, year, 'season');
      if (!totals) continue;
      const baseline = { GP: totals.GP - (playoffs ? 0 : 1) };
      if (baseline.GP < minimumGames) continue;
      for (const key of [...Object.keys(categories), 'GS', 'MIN']) {
        const v = key === 'MIN' ? (Array.isArray(snap.stats.MIN) ? snap.stats.MIN[0] / 60 : NaN) : snap.stats[key];
        if (Number.isFinite(totals[key]) && Number.isFinite(v) && (playoffs || totals[key] >= v))
          baseline[key] = totals[key] - (playoffs ? 0 : v);
      }
      const team = lookup.teams.get(snap.team.id),
        r = role(player, baseline, team, league, year, playoffs ? 'playoffs' : 'season');
      const comparisons = compare(snap.stats, baseline),
        { cold } = judge(comparisons, snap.stats, r, scale);
      const best = [...comparisons].sort((a, b) => b.score - a.score)[0];
      if (!best?.qualifies && !cold) continue;
      const coldOnly = !best?.qualifies;
      const focus = coldOnly ? comparisons.find(c => c.key === 'PTS') || best : best;
      found.push({
        snap,
        player,
        entry,
        game,
        playoffs,
        baseline,
        comparisons,
        focus,
        coldOnly,
        r,
        score: coldOnly ? 1.1 : best.score,
      });
    }
    // One story per team per game, and only the strongest nights on a busy slate.
    const perTeam = new Map(),
      slate = new Set(found.map(x => x.game.gId)).size,
      limit = Math.max(3, Math.round(slate * 2 * dailyShare)),
      kept = [];
    for (const x of found.sort((a, b) => b.score - a.score || a.snap.pid - b.snap.pid)) {
      const k = `${x.game.gId}:${x.snap.team.id}`;
      if ((perTeam.get(k) || 0) >= perGameCap || kept.length >= limit) continue;
      perTeam.set(k, (perTeam.get(k) || 0) + 1);
      kept.push(x);
    }
    const result = [];
    for (const x of kept) {
      const { snap, player, entry, game, baseline, comparisons, focus, coldOnly, r } = x;
      const name = C.playerDisplay(player),
        id = `${fingerprint}:${year}:performance:${snap.gid}:${snap.pid}`;
      const ctx = C.gameContext(game, entry.dayIndex, league, lookup, map, fingerprint);
      const story = C.generateArticle(ctx, fingerprint, false);
      const changes = [focus, ...comparisons.filter(c => c !== focus)];
      const good = changes.some(c => c.favorable && c.qualifies),
        poor = changes.some(c => !c.favorable && c.qualifies) || coldOnly;
      const mine = C.teamRef(snap.team),
        won = game.winner === snap.team.id,
        oppTeam = lookup.teams.get(game.homeTeam === snap.team.id ? game.awayTeam : game.homeTeam),
        opp = C.teamRef(oppTeam);
      const he = C.pronoun(snap.player),
        last = player.ln || C.surname(name);
      Object.assign(story, {
        id,
        kind: 'performance',
        type: good && poor ? 'Mixed performance' : good ? 'Above expectations' : 'Below expectations',
        headline: headline(name, focus, opp, id, r.starter === false, coldOnly),
        playerId: snap.pid,
        playerName: name,
        playerStats: structuredClone(snap.stats),
        coach: null,
        importance: Math.round(70 + Math.min(30, x.score * 8)),
        templateVersion: 1,
        editorialVersion: 4,
        quotesEnabled: false,
        performanceSnapshot: {
          baseline: structuredClone(baseline),
          comparisons,
          scale,
          source: 'season-before-game',
          role: r,
          cold: coldOnly,
          fingerprint,
          season: year,
          gid: snap.gid,
          day: snap.day,
          playerId: snap.pid,
          team: { id: snap.team.id, city: snap.team.city, name: snap.team.name },
          opponent: oppTeam ? { id: oppTeam.id, city: oppTeam.city, name: oppTeam.name } : null,
          won,
          pronoun: he,
          series: ctx.series ? structuredClone(ctx.series) : null,
          college: ctx.college,
        },
        paragraphs: article({
          name,
          last,
          he,
          focus,
          changes,
          baseline,
          mine,
          opp,
          result: { won, score: `${ctx.winnerScore}-${ctx.loserScore}` },
          stats: snap.stats,
          r,
          coldOnly,
          series: ctx.series,
          college: ctx.college,
        }),
      });
      result.push({
        story,
        context: {
          ...ctx,
          potg: snap.player,
          potgStats: snap.stats,
          potgStatsTrusted: true,
          potgSnapshot: snap,
          scenePlayer: snap.player,
        },
      });
    }
    return result.sort((a, b) => b.story.importance - a.story.importance || a.story.id.localeCompare(b.story.id));
  }
  function script(story, n = ['Maya', 'Jordan', 'Andre', 'Nina']) {
    const snapshot = story.performanceSnapshot,
      comparisons = snapshot?.comparisons || [];
    if (!comparisons.length) return [];
    const pick = (options, role) => C.choose(story.id || story.headline || '', options, role);
    // Archived stories from the old 50% rule carry no scores; their first qualifying category leads.
    const scored = comparisons.some(c => c.score > 0) || snapshot.cold;
    const focus = scored
      ? snapshot.cold
        ? comparisons.find(c => c.key === 'PTS') || comparisons[0]
        : [...comparisons].sort((a, b) => b.score - a.score)[0]
      : comparisons.find(c => c.qualifies) || comparisons[0];
    const name = story.playerName,
      last = C.surname(name),
      turns = [],
      say = (speaker, text) => turns.push({ speaker, text });
    const g = story.gameSummary,
      w = g.home.score > g.away.score ? g.home : g.away,
      l = w === g.home ? g.away : g.home;
    const mine = snapshot.team ? C.teamRef(snapshot.team) : null,
      opp = snapshot.opponent ? C.teamRef(snapshot.opponent) : C.teamRef(snapshot.team?.id === w.id ? l : w);
    const W = C.teamRef(w),
      avg = average(focus.expected),
      up = focus.favorable,
      r = snapshot.role || {},
      s = story.playerStats || {};
    const coldOnly = !!snapshot.cold,
      S = snapshot.series;
    const where = S?.title
      ? snapshot.college
        ? ' in the national championship game'
        : ' in the title clincher'
      : S
        ? S.firstTo > 1
          ? ` in Game ${S.gameNumber}`
          : ` in the ${S.roundName}`
        : '';
    const stat = coldOnly
      ? `${s.FGM}-of-${s.FGA} shooting`
      : focus.key === 'TO' && focus.actual === 0
        ? 'zero turnovers'
        : `${focus.actual} ${focus.actual === 1 ? unit[focus.key][0] : unit[focus.key][1]}`;
    const who =
      r.scorerRank === 1
        ? `${mine ? C.possessive(mine.nick) : "the team's"} leading scorer`
        : r.starter === false
          ? 'a reserve'
          : null;
    say(
      0,
      coldOnly
        ? pick(
            [
              `${name}: ${stat} against ${opp.nick}. ${n[1]}, what happened?`,
              `Rough one for ${name}. ${C.capitalize(stat)} against ${opp.nick}. ${n[1]}?`,
            ],
            'perf:open'
          )
        : pick(
            [
              `Let's talk about ${name}. ${C.capitalize(stat)} against ${opp.nick}${where}, and the average coming in was ${avg}. ${n[1]}?`,
              `${name}: ${stat} against ${opp.nick}${where}. Coming in, the average was ${avg}. ${n[1]}, what do you make of it?`,
              `${name} with ${stat}${where}${who ? `, and that's ${who}` : ''}. Normal night is ${avg}. ${n[1]}, go.`,
            ],
            'perf:open'
          )
    );
    say(
      1,
      coldOnly
        ? pick(
            [
              `Shots weren't falling. It happens. But when you're the go-to option, you have to find another way.`,
              `That's a bad night at the office. ${last} will want that one back.`,
            ],
            'perf:cold'
          )
        : focus.key === 'TO'
          ? up
            ? pick(
                [
                  `That's grown-up basketball. Take care of the rock, give your team a chance.`,
                  `I love it. No careless giveaways. That's how you earn trust.`,
                ],
                'perf:to-up'
              )
            : pick(
                [
                  `${focus.actual} turnovers? Come on. You can't give the ball away like that.`,
                  `That's sloppy. ${focus.actual} giveaways, and somebody's going to be looking at the film.`,
                ],
                'perf:to-down'
              )
          : up
            ? pick(
                r.starter === false
                  ? [
                      `That's a bench player taking over a game. Somebody give ${last} some love.`,
                      `See, this is why you watch every game. Nights like that come out of nowhere.`,
                      `Now that's a reserve making noise. More minutes. I'm just saying.`,
                    ]
                  : [
                      `That's what I've been waiting for! ${last} gave ${mine ? mine.nick : 'them'} way more than usual, and I want to see it again.`,
                      `Breakout night. I don't want to hear about one game. That's a player figuring something out.`,
                      `I'm a fan. That's exactly what ${mine ? mine.nick : 'that team'} needed from ${last}.`,
                    ],
                'perf:up'
              )
            : snapshot.won && S?.title
              ? pick(
                  [
                    `And it didn't matter one bit. ${last} has a ring. Nobody's asking about the box score at the parade.`,
                    `Quiet night, sure. Champion, though. I'd take that trade every day.`,
                  ],
                  'perf:down-title'
                )
              : snapshot.won
                ? pick(
                    [
                      `And they won anyway. That's what good teams do when the top option goes cold.`,
                      `Quiet night, but ${mine ? mine.nick : 'the team'} still got the W. I'll worry about it if it happens twice.`,
                    ],
                    'perf:down-won'
                  )
                : pick(
                    [
                      `That's a dud. ${last} didn't give ${mine ? mine.nick : 'them'} what they usually get.`,
                      `Where was ${last}? ${mine ? C.capitalize(mine.nick) : 'That team'} needed more than that.`,
                      `When your top option goes quiet, you're in trouble. Simple as that.`,
                    ],
                    'perf:down'
                  )
    );
    const early = snapshot.baseline.GP < minimumGames;
    say(
      3,
      early
        ? `Easy, ${n[1]}. That average is from ${snapshot.baseline.GP} ${snapshot.baseline.GP === 1 ? 'game' : 'games'}. We're still learning what normal looks like.`
        : coldOnly
          ? `${s.FGM} for ${s.FGA}. Over ${snapshot.baseline.GP} games, ${last} has been better than that. I'd call it a blip.`
          : up
            ? pick(
                [
                  `It's one game, but it's a real one. ${C.capitalize(stat)} isn't a fluke number.`,
                  `And that's not a small sample. ${snapshot.baseline.GP} games at ${avg} a night, and then this.`,
                ],
                'perf:n-up'
              )
            : pick(
                [
                  `One game doesn't make a slump. ${snapshot.baseline.GP} games say ${last} is better than this.`,
                  `I'd call it noise. ${snapshot.baseline.GP} games at ${avg} tells you more than one bad night.`,
                ],
                'perf:n-down'
              )
    );
    const extra = c => c !== focus && (scored ? c.mention : c.qualifies);
    const secondary = comparisons.find(c => extra(c) && c.favorable !== focus.favorable) || comparisons.find(extra);
    if (secondary) {
      const label =
        secondary.key === 'TO' && secondary.actual === 0
          ? 'no turnovers'
          : `${secondary.actual} ${secondary.actual === 1 ? unit[secondary.key][0] : unit[secondary.key][1]}`;
      say(
        2,
        `${secondary.favorable === focus.favorable ? 'And' : 'But'} look at the rest of it, ${n[1]}. ${C.capitalize(label)}, against an average of ${average(secondary.expected)}.`
      );
      say(
        1,
        secondary.favorable === focus.favorable
          ? secondary.favorable
            ? "So it wasn't just one thing. That's a complete night."
            : "So it's more than one problem. That's what worries me."
          : secondary.favorable
            ? "Okay, fair. Give credit where it's due."
            : "Fair point. One good thing doesn't wash out the rest."
      );
    }

    say(
      0,
      S?.title
        ? `And for the record, ${W.nick} won the ${snapshot.college ? 'national championship' : 'title'}, ${w.score}-${l.score}.`
        : S
          ? `${C.capitalize(W.nick)} won Game ${S.gameNumber}, ${w.score}-${l.score}. Next topic.`.replace(
              /won Game \d+/,
              S.firstTo > 1 ? `won Game ${S.gameNumber}` : 'won it'
            )
          : pick(
              [
                `${C.capitalize(W.nick)} won it, ${w.score}-${l.score}. Next topic.`,
                `Final was ${W.nickname} ${w.score}, ${C.teamRef(l).nickname} ${l.score}. We'll see what ${last} does for an encore.`,
                `For the record, ${W.nick} won ${w.score}-${l.score}. Moving on.`,
              ],
              'perf:close'
            )
    );
    return turns;
  }
  // Stories archived under the old 50% rule are judged again with today's rules,
  // from the box score and season averages they saved. Passing stories are
  // rewritten in the current voice; the rest return null and leave the archive.
  function rejudge(story, known = {}) {
    const snap = story.performanceSnapshot;
    if (!snap || Number(story.editorialVersion || 0) >= 3) return story;
    const box = story.playerStats,
      baseline = snap.baseline,
      g = story.gameSummary;
    if (!box || !baseline?.GP || !g?.home || !g?.away) return null;
    if (baseline.GP < minimumGames) return null;
    const scale = Math.min(1.2, Math.max(0.15, (g.home.score + g.away.score) / 2 / 110));
    const tid = story.sceneInputs?.team?.id,
      side = tid === g.home.id ? 'home' : tid === g.away.id ? 'away' : null;
    // The rotation isn't saved with old stories, so quiet nights need a bigger average to count.
    const r = {
      scorerRank: baseline.PTS / baseline.GP >= 18 * scale ? 1 : 3,
      reboundRank: baseline.REB / baseline.GP >= 10 * scale ? 1 : 3,
      starter: null,
      minutes: null,
    };
    const comparisons = compare(box, baseline),
      { cold } = judge(comparisons, box, r, scale);
    const best = [...comparisons].sort((a, b) => b.score - a.score)[0];
    if (!best?.qualifies && !cold) return null;
    if (!side) return null;
    const coldOnly = !best?.qualifies,
      focus = coldOnly ? comparisons.find(c => c.key === 'PTS') || best : best;
    const mineSide = g[side],
      oppSide = g[side === 'home' ? 'away' : 'home'],
      won = mineSide.score > oppSide.score;
    const mine = C.teamRef(story.sceneInputs.team || mineSide),
      opp = C.teamRef(oppSide),
      name = story.playerName,
      he = C.pronoun(story.sceneInputs?.player);
    const changes = [focus, ...comparisons.filter(c => c !== focus)];
    const good = changes.some(c => c.favorable && c.qualifies),
      poor = changes.some(c => !c.favorable && c.qualifies) || coldOnly;
    const hi = Math.max(g.home.score, g.away.score),
      lo = Math.min(g.home.score, g.away.score);
    return {
      ...story,
      type: good && poor ? 'Mixed performance' : good ? 'Above expectations' : 'Below expectations',
      headline: headline(name, focus, opp, story.id, false, coldOnly),
      editorialVersion: 4,
      importance: Math.round(70 + Math.min(30, (coldOnly ? 1.1 : best.score) * 8)),
      performanceSnapshot: {
        ...snap,
        comparisons,
        scale,
        role: r,
        cold: coldOnly,
        team: story.sceneInputs.team
          ? { id: mine.id ?? tid, city: story.sceneInputs.team.city, name: story.sceneInputs.team.name }
          : null,
        opponent: { id: oppSide.id, city: opp.city, name: opp.nickname },
        won,
        pronoun: he,
        series: known.title ? { title: true } : null,
        college: !!known.college,
      },
      paragraphs: article({
        name,
        last: C.surname(name),
        he,
        focus,
        changes,
        baseline,
        mine,
        opp,
        result: { won, score: `${hi}-${lo}` },
        stats: box,
        r,
        coldOnly,
        series: known.title ? { title: true } : known.playoffs ? { roundName: 'playoffs', firstTo: 1 } : null,
        college: known.college,
      }),
    };
  }
  return { categories, average, compare, judge, leagueScale, candidates, script, rejudge };
});
