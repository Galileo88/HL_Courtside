/* Transaction, award and offseason stories from the save's news events. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./core.js'), require('./records-coverage.js'), require('./season-coverage.js'));
  else root.HoopWireNews = factory(root.HoopWireCore, root.HoopWireRecords, root.HoopWireSeason);
})(globalThis, function (C, R, S) {
  'use strict';
  const types = {
    2: 'Draft',
    3: 'Signing',
    5: 'Roster move',
    6: 'Waivers',
    7: 'Trade',
    10: 'Injury',
    11: 'Injury return',
    12: 'Award announcement',
    13: 'Championship review',
    14: 'Commitment',
    15: 'Draft declaration',
    16: 'Retirement announcement',
    17: 'Retirement',
    18: 'Player option',
    19: 'Player option',
    20: 'Team option',
    21: 'Team option',
    22: 'Hall of Fame',
    25: 'Jersey retirement',
    26: 'Coaching change',
    27: 'Coaching change',
    28: 'Coaching change',
    29: 'Coach retirement',
    30: 'Contract extension',
    31: 'Trade request',
  };
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(k => [k, canonical(value[k])])
      );
    return value;
  }
  const rounds = ['', 'first-round', 'second-round', 'third-round', 'fourth-round', 'fifth-round'];
  function seasonLine(player, league, year) {
    const s = S.stats(player, league, year);
    if (!s || s.GP < 1) return '';
    const last = player.ln || C.surname(C.playerDisplay(player));
    return `${last} ${player.retired ? 'averaged' : 'is averaging'} ${C.perGameList(s)} in ${C.plural(s.GP, 'game')} this season.`;
  }
  const roundupTypes = new Set([2, 3, 14, 15, 18, 19, 20, 21, 26]),
    roundupSize = 4;
  // Option decisions travel together; so do a phase's hires and its quiet retirements.
  const optionTypes = new Set([18, 19, 20, 21]),
    wholePhase = t => t === 2 || t === 26 || t === 16 || t === 17 || optionTypes.has(t),
    groupOf = t => (optionTypes.has(t) ? 'option' : t);
  const perGame = (s, k) => (s?.GP > 0 && Number.isFinite(s[k]) ? (s[k] / s.GP).toFixed(1) : null);
  function college(p) {
    const s = p?.history?.collegeStats?.season;
    return s?.GP > 0 && Number.isFinite(s.PTS) ? s : null;
  }
  function contextFor(team, lookup, league, player) {
    const opponent = [...lookup.teams.values()].find(t => t.id !== team.id);
    return {
      winner: team,
      loser: opponent,
      home: team,
      game: { homeTeam: team.id },
      scenePlayer: player || team.roster?.[0],
      potg: player || null,
      potgStatsTrusted: !!player,
      gameBall: league.gameballs?.[Number(league.settings?.gameBall) || 0] || {
        pri: 'E37033',
        sec: 'E37033',
        ter: 'E37033',
        outline: '44220F',
      },
    };
  }
  // A coach's standing: career winning percentage, playoff wins, titles and the
  // game's own coach rating. Roughly: under 6 an unknown, 6 a solid name, 15 a big one.
  // Option headlines name the move, the way a transactions wire does.
  function optionHeadline(type, name, team) {
    const T = C.teamRef(team),
      accepted = type === 18 || type === 20;
    if (type >= 20)
      return `${T.nickname} ${C.verb(T, accepted ? 'pick' : 'decline')}${accepted ? ' up' : ''} ${C.possessive(name)} option`;
    return accepted ? `${name} opts in with ${T.nickname}` : `${name} opts out, heads to free agency`;
  }
  // A coach for a press-conference image: the staff record's look, marked as a coach.
  // What the save knows about a coaching change, for the TV desk to argue over: how the coach did with
  // this team, how the last stretch went, and, for a hire, the job and the coach's last stop.
  function coachingFacts(event, coach, team, lookup, year) {
    if (![26, 27, 28].includes(event.type) || !coach || !team) return null;
    const head = event.type !== 26 || (team.frontOffice?.staff || []).find(c => c.id === coach.id)?.pos === 1;
    if (!head) return null;
    const seasons = (coach.career?.teamHistory || [])
      .flatMap(h => (h.season || []).map(s => ({ ...s, yr: h.yr })))
      .filter(s => s.GP > 0)
      .sort((a, b) => a.yr - b.yr);
    const here = seasons.filter(s => s.tid === team.id && (event.type === 26 ? s.yr < year : true)),
      latest = here.at(-1),
      ten = (latest?.L10 || []).filter(x => x === 0 || x === 1);
    const before = seasons.filter(s => s.tid !== team.id && s.yr <= year).at(-1),
      stop = before && seasons.filter(s => s.tid === before.tid && s.yr <= before.yr),
      stopTeam = before && lookup.teams.get(before.tid);
    const prior = (team.season || [])
      .filter(r => r.yr < year && r.seasonStats?.W + r.seasonStats?.L > 0)
      .sort((a, b) => b.yr - a.yr)[0]?.seasonStats;
    return {
      change: event.type === 26 ? 'hired' : event.type === 28 ? 'fired' : 'released',
      name: C.playerDisplay(coach),
      last: coach.ln || C.surname(C.playerDisplay(coach)),
      pronoun: C.pronoun(coach) || null,
      team: C.teamDisplay(team),
      career: { W: coach.career?.season?.W || 0, L: coach.career?.season?.L || 0 },
      seasons: event.type === 26 ? 0 : here.length,
      winningSeasons: event.type === 26 ? 0 : here.filter(s => s.W > s.L).length,
      recent: event.type !== 26 && ten.length >= 5 ? { W: ten.filter(x => x === 1).length, G: ten.length } : null,
      prior: event.type === 26 && prior ? { W: prior.W, L: prior.L } : null,
      lastStop:
        event.type === 26 && stopTeam
          ? {
              team: C.teamDisplay(stopTeam),
              W: stop.reduce((n, s) => n + s.W, 0),
              L: stop.reduce((n, s) => n + s.L, 0),
              seasons: stop.length,
            }
          : null,
    };
  }
  // What the desk can say about a player in the news: role, age, scoring and place on the team, and for an
  // injury, how much of the season it costs, counted from the day it happened.
  function playerFacts(event, info, player, team, league, lookup, year) {
    const kind = { 3: 'signing', 10: 'injury', 11: 'return', 30: 'extension' }[event.type];
    if (!kind || !player || !team) return null;
    const now = S.stats(player, league, year),
      perGame = p => {
        const s = S.stats(p, league, year, 'season', team.id);
        return s?.GP >= 3 ? s.PTS / s.GP : null;
      };
    const scorers = (team.roster || [])
      .map(p => ({ id: p.id, ppg: perGame(p) }))
      .filter(x => x.ppg !== null)
      .sort((a, b) => b.ppg - a.ppg);
    const rank =
      kind === 'signing' || scorers.length < 5 ? null : scorers.findIndex(x => x.id === player.id) + 1 || null;
    const played = lookup.completed.filter(
        x =>
          x.dayIndex <= Number(event.date) &&
          x.game.gameType === 0 &&
          [x.game.homeTeam, x.game.awayTeam].includes(team.id)
      ).length,
      total = Number(league.season?.totalGames);
    return {
      kind,
      last: player.ln || C.surname(C.playerDisplay(player)),
      pronoun: C.pronoun(player) || null,
      age: player.age > 0 ? player.age : null,
      tier: R.tier(R.stature(player, league)),
      ppg: now?.GP >= 3 ? Number((now.PTS / now.GP).toFixed(1)) : null,
      rank,
      years: (event.type === 30 ? info.contract?.ext?.yrs : info.contract?.yrs) || null,
      gamesOut: kind === 'injury' && info.injury?.gamesOut > 0 ? info.injury.gamesOut : null,
      gamesLeft: total > 0 && played <= total ? total - played : null,
    };
  }
  function coachSubject(c) {
    return c
      ? structuredClone({
          id: c.id,
          tid: c.tid,
          fn: c.fn,
          ln: c.ln,
          appearance: c.appearance,
          suits: c.suits,
          isCoach: true,
        })
      : null;
  }
  function coachStature(c) {
    const r = c?.career?.season || {},
      po = c?.career?.playoffs || {},
      games = (r.W || 0) + (r.L || 0);
    const titles = (c?.awards || []).filter(a => a.id === 0).reduce((n, a) => n + (a.yearsWon || []).length, 0);
    return (
      Math.round(
        ((games >= 40 ? (r.W / games - 0.5) * 40 : 0) + titles * 8 + (po.W || 0) / 8 + ((c?.pot || 7) - 7) * 2) * 10
      ) / 10
    );
  }
  const coachTier = v => (v >= 15 ? 'star' : v >= 6 ? 'regular' : 'role');
  function coachRecord(c) {
    const r = c?.career?.season || {},
      po = c?.career?.playoffs || {},
      titles = (c?.awards || []).filter(a => a.id === 0).reduce((n, a) => n + (a.yearsWon || []).length, 0);
    if (!((r.W || 0) + (r.L || 0))) return '';
    // "an 89-39 record", "an 11-5 record": the article follows how the number is said.
    const an = /^8/.test(String(r.W)) || /^1[18]$/.test(String(r.W)) ? 'an' : 'a';
    const parts = [
      `${an} ${r.W}-${r.L} career record`,
      ...(po.W > 0 ? [C.plural(po.W, 'playoff win')] : []),
      ...(titles ? [titles === 1 ? 'a championship' : `${C.num(titles)} championships`] : []),
    ];
    return C.listJoin(parts);
  }
  function roundup(list, { league, lookup, players, coaches, year, fp, result, day, own = () => false }) {
    const type = list[0].type,
      short = league.shortName || league.leagueName,
      cap = C.capitalize;
    // Retirement news often points at no current team; the player's last team from the stat lines stands in.
    const lastTeam = p => {
      const lines = (p?.stats || [])
        .filter(x => x.league === league.leagueType)
        .sort((a, b) => b.yr - a.yr)
        .flatMap(x => x.season || []);
      return lines.map(x => lookup.teams.get(x.tid)).find(Boolean) || lookup.teams.get(p?.tid) || null;
    };
    const rows = list
      .map(n => {
        const p = (type === 26 ? coaches : players).get(n.pid);
        return { n, p, t: lookup.teams.get(n.tid) || (type === 16 || type === 17 ? lastTeam(p) : null) };
      })
      .filter(x => x.p && x.t);
    if (!rows.length) return;
    const T = t => C.teamRef(t),
      name = p => C.playerDisplay(p),
      last = p => p.ln || C.surname(name(p));
    let headline,
      paragraphs = [],
      table,
      lead,
      storyType,
      headers;
    if (type === 2) {
      rows.sort(
        (a, b) =>
          (a.n.data?.draftPick?.rd || 9) - (b.n.data?.draftPick?.rd || 9) ||
          (a.n.data?.draftPick?.pk || 99) - (b.n.data?.draftPick?.pk || 99)
      );
      const pick = x => x.n.data?.draftPick || {},
        via = x => {
          const o = lookup.teams.get(pick(x).otid);
          return o && o.id !== x.t.id ? ` (from ${T(o).nick})` : '';
        };
      const resume = x => {
        const c = college(x.p);
        return c
          ? ` ${C.capitalize(x.p.age ? `the ${x.p.age}-year-old` : last(x.p))} averaged ${perGame(c, 'PTS')} points, ${perGame(c, 'REB')} rebounds and ${perGame(c, 'AST')} assists in college.`
          : '';
      };
      lead = rows[0];
      storyType = 'Draft';
      headline = `${T(lead.t).nickname} ${C.verb(T(lead.t), 'take')} ${name(lead.p)} No. ${pick(lead).pk || 1} in ${year} draft`;
      paragraphs.push(
        `${cap(T(lead.t).full)} selected ${name(lead.p)} with the No. ${pick(lead).pk || 1} pick in the ${year} ${short} draft${via(lead)}.${resume(lead)}`
      );
      const next = rows.slice(1, 3);
      if (next.length)
        paragraphs.push(
          next.map(x => `${cap(T(x.t).full)} took ${name(x.p)} at No. ${pick(x).pk}${via(x)}.${resume(x)}`).join(' ')
        );
      const rest = rows.slice(3, 10);
      if (rest.length)
        paragraphs.push(
          `The rest of the top ${C.num(Math.min(10, rows.length))}: ${C.listJoin(rest.map(x => `${name(x.p)} to ${T(x.t).nick} at No. ${pick(x).pk}`))}.`
        );
      const roundsUsed = new Set(rows.map(x => pick(x).rd)).size;
      paragraphs.push(
        `In all, ${C.plural(rows.length, 'player')} ${rows.length === 1 ? 'was' : 'were'} selected over ${C.plural(roundsUsed, 'round')}.`
      );
      headers = ['Pick', 'Team', 'Player'];
      table = rows.map(x => [`${pick(x).rd}-${pick(x).pk}`, C.teamDisplay(x.t), name(x.p)]);
    } else if (type === 3) {
      const rookie = x => x.p.history?.draft?.yr === year || x.p.yrs === 0;
      const prior = x => S.stats(x.p, league, year - 1) || S.stats(x.p, league, year);
      const vets = rows
        .filter(x => !rookie(x))
        .sort((a, b) => (Number(perGame(prior(b), 'PTS')) || 0) - (Number(perGame(prior(a), 'PTS')) || 0));
      const rookies = rows
        .filter(rookie)
        .sort(
          (a, b) =>
            (a.p.history?.draft?.rd || 9) - (b.p.history?.draft?.rd || 9) ||
            (a.p.history?.draft?.pk || 99) - (b.p.history?.draft?.pk || 99)
        );
      const deal = x => (x.n.data?.contract?.yrs > 0 ? `${C.num(x.n.data.contract.yrs)}-year deal` : 'deal');
      lead = vets[0] || rookies[0];
      storyType = 'Free agency';
      const line = x => {
        const s = prior(x),
          ppg = perGame(s, 'PTS');
        return ppg
          ? ` ${C.capitalize(last(x.p))} averaged ${ppg} points and ${perGame(s, 'REB')} rebounds last season.`
          : '';
      };
      if (vets.length) {
        headline = `${name(vets[0].p)} signs with ${T(vets[0].t).nickname}${vets.length > 1 ? ` as free agency heats up` : ''}`;
        paragraphs.push(
          `${name(vets[0].p)} signed a ${deal(vets[0])} with ${T(vets[0].t).full}, the biggest name in a busy stretch of free agency.${line(vets[0])}`
        );
        if (vets.length > 1)
          paragraphs.push(
            `Also on the move: ${C.listJoin(
              // Signings by one team read together: "Kemal Yildirim and Zack Jones to the Airmen".
              [
                ...vets
                  .slice(1, 6)
                  .reduce((m, x) => m.set(x.t.id, [...(m.get(x.t.id) || []), x]), new Map())
                  .values(),
              ].map(group => `${C.listJoin(group.map(x => name(x.p)))} to ${T(group[0].t).nick}`)
            )}${vets.length > 6 ? `, among ${C.plural(vets.length - 6, 'other veteran')}` : ''}.`
          );
      } else {
        const top = rookies.find(x => x.p.history?.draft?.yr === year) || rookies[0],
          no =
            top.p.history?.draft?.yr === year && top.p.history.draft.rd === 1
              ? `No. ${top.p.history.draft.pk} pick `
              : '';
        headline = `${C.plural(rookies.length, 'rookie')} sign first contracts, led by ${name(top.p)}`;
        paragraphs.push(
          `${C.capitalize(C.plural(rookies.length, 'rookie'))} signed ${rookies.length === 1 ? 'a first contract' : 'their first contracts'}, led by ${no}${name(top.p)} with ${T(top.t).full}.`
        );
      }
      if (vets.length && rookies.length)
        paragraphs.push(
          `The rest was routine business: ${C.plural(rookies.length, 'rookie')} signed first contracts, including ${name(rookies[0].p)} with ${T(rookies[0].t).full}.`
        );
      headers = ['Team', 'Player', 'Years'];
      table = rows.map(x => [C.teamDisplay(x.t), name(x.p), x.n.data?.contract?.yrs || '—']);
    } else if (type === 14) {
      rows.sort((a, b) => (b.p.pot || 0) - (a.p.pot || 0) || (b.p.rating || 0) - (a.p.rating || 0) || a.p.id - b.p.id);
      lead = rows[0];
      storyType = 'Recruiting';
      const counts = new Map();
      for (const x of rows) counts.set(x.t.id, (counts.get(x.t.id) || 0) + 1);
      const busiest = [...counts].sort((a, b) => b[1] - a[1])[0];
      headline = `${name(lead.p)} headlines the recruiting class`;
      paragraphs.push(
        `${name(lead.p)}${lead.p.age ? `, ${lead.p.age},` : ''} committed to ${T(lead.t).full}, the headliner on a day when ${C.plural(rows.length, 'recruit')} made their college choices.`
      );
      if (rows.length > 1)
        paragraphs.push(`Other top names: ${C.listJoin(rows.slice(1, 5).map(x => `${name(x.p)} to ${T(x.t).nick}`))}.`);
      if (busiest && busiest[1] >= 3)
        paragraphs.push(
          `${cap(T(lookup.teams.get(busiest[0])).full)} had the busiest day, landing ${C.plural(busiest[1], 'commitment')}.`
        );
      headers = ['School', 'Recruit', 'Age'];
      table = rows.map(x => [C.teamDisplay(x.t), name(x.p), x.p.age || '—']);
    } else if (optionTypes.has(type)) {
      // Contract options: the biggest name leads, the rest is a list.
      const accepted = x => [18, 20].includes(x.n.type),
        owner = x => (x.n.type < 20 ? 'player' : 'team');
      rows.sort((a, b) => R.stature(b.p, league) - R.stature(a.p, league) || a.p.id - b.p.id);
      lead = rows[0];
      storyType = 'Contract options';
      const what = x =>
        owner(x) === 'player'
          ? `${name(x.p)} ${accepted(x) ? 'exercised' : 'declined'} a player option with ${T(x.t).full}`
          : `${cap(T(x.t).full)} ${accepted(x) ? 'picked up' : 'declined'} the team option on ${C.possessive(name(x.p))} contract`;
      const declined = rows.filter(x => !accepted(x)).length;
      headline = optionHeadline(lead.n.type, name(lead.p), lead.t);
      paragraphs.push(
        `${what(lead)}, the biggest name among ${C.plural(rows.length, 'option decision')} around the league.`
      );
      const rest = rows
        .slice(1)
        .filter(x => R.tier(R.stature(x.p, league)) !== 'role')
        .slice(0, 3);
      if (rest.length) paragraphs.push(`${rest.map(what).join('. ')}.`);
      if (declined)
        paragraphs.push(
          `Of those, ${C.num(declined)} ${declined === 1 ? 'was' : 'were'} declined, sending ${declined === 1 ? 'that player' : 'those players'} toward free agency.`
        );
      headers = ['Player', 'Team', 'Option', 'Decision'];
      table = rows.map(x => [name(x.p), C.teamDisplay(x.t), cap(owner(x)), accepted(x) ? 'Accepted' : 'Declined']);
    } else if (type === 26) {
      // The coaching carousel, led by the strongest team that made a hire.
      const strength = t => {
        const r = (t.season || []).filter(r => r.seasonStats?.GP > 0).sort((a, b) => b.yr - a.yr)[0]?.seasonStats;
        return r ? r.W / Math.max(1, r.W + r.L) : 0;
      };
      rows.sort((a, b) => coachStature(b.p) - coachStature(a.p) || strength(b.t) - strength(a.t) || a.t.id - b.t.id);
      lead = rows[0];
      storyType = 'Coaching change';
      const rec = t => {
        const r = (t.season || []).filter(r => r.seasonStats?.GP > 0).sort((a, b) => b.yr - a.yr)[0]?.seasonStats;
        return r ? ` (${r.W}-${r.L} last season)` : '';
      };
      headline = `Coaching carousel: ${C.plural(rows.length, league.leagueType === 1 ? 'program' : 'team')} ${rows.length === 1 ? 'changes' : 'change'} coaches`;
      paragraphs.push(
        `${cap(T(lead.t).full)}${rec(lead.t)} hired ${name(lead.p)}${coachRecord(lead.p) ? `, who brings ${coachRecord(lead.p)}` : ''}. It was the biggest name to move in an offseason when ${C.plural(rows.length, league.leagueType === 1 ? 'program' : 'team')} changed coaches.`
      );
      if (rows.length > 1)
        paragraphs.push(
          `Also hiring: ${C.listJoin(rows.slice(1, 6).map(x => `${T(x.t).nick} (${name(x.p)})`))}${rows.length > 6 ? `, among ${C.plural(rows.length - 6, 'other')}` : ''}.`
        );
      headers = ['Team', 'Hire'];
      table = rows.map(x => [C.teamDisplay(x.t), name(x.p)]);
    } else if (type === 16 || type === 17) {
      // Role players at the end of the line: one story for the group.
      const career = x => R.history(x.p, league);
      // Players with their own story are listed, but the group is led by someone without one.
      rows.sort(
        (a, b) =>
          Number(own(a.n)) - Number(own(b.n)) || R.stature(b.p, league) - R.stature(a.p, league) || a.p.id - b.p.id
      );
      lead = rows[0];
      storyType = type === 17 ? 'Retirement' : 'Retirement announcement';
      const c = career(lead),
        careerLine = x => {
          const h = career(x);
          return h?.GP > 0 ? `${(h.PTS / h.GP).toFixed(1)} points over ${h.GP} games` : '';
        };
      headline =
        type === 17
          ? `${name(lead.p)} leads this year's retirement class`
          : `${name(lead.p)} among the veterans set to retire`;
      paragraphs.push(
        `${rows.length < 10 ? C.capitalize(C.plural(rows.length, 'player')) : `In all, ${C.plural(rows.length, 'player')}`} ${type === 17 ? 'retired' : 'announced plans to retire'}, a group led by ${name(lead.p)} of ${T(lead.t).full}${c?.GP > 0 ? `, who averaged ${careerLine(lead)}` : ''}.`
      );
      if (rows.length > 1)
        paragraphs.push(
          `${type === 17 ? 'Also retiring' : 'Also on the way out'}: ${C.listJoin(rows.slice(1, 5).map(x => `${name(x.p)} (${T(x.t).nick})`))}${rows.length > 5 ? `, among ${C.plural(rows.length - 5, 'other')}` : ''}.`
        );
      paragraphs.push(
        `Most were role players who stuck around. Few careers in this league go longer.`.replace(
          /Few careers.*$/,
          (() => {
            const longest = [...rows].sort((a, b) => (career(b)?.GP || 0) - (career(a)?.GP || 0))[0],
              h = career(longest);
            return h?.GP > 0 ? `The longest run belonged to ${name(longest.p)}: ${h.GP} games.` : '';
          })()
        )
      );
      headers = ['Player', 'Team', 'GP', 'PPG'];
      table = rows.map(x => {
        const h = career(x);
        return [name(x.p), C.teamDisplay(x.t), h?.GP || '—', h?.GP > 0 ? (h.PTS / h.GP).toFixed(1) : '—'];
      });
    } else {
      const s = x => S.stats(x.p, league, year);
      rows.sort((a, b) => (Number(perGame(s(b), 'PTS')) || 0) - (Number(perGame(s(a), 'PTS')) || 0));
      lead = rows[0];
      storyType = 'Draft declaration';
      headline = `${name(lead.p)} leads ${C.plural(rows.length, 'early entrant')} into the draft`;
      const ppg = x => perGame(s(x), 'PTS');
      paragraphs.push(
        `${name(lead.p)} of ${T(lead.t).full} declared for the draft${ppg(lead) ? ` after averaging ${ppg(lead)} points and ${perGame(s(lead), 'REB')} rebounds this season` : ''}, headlining a group of ${C.plural(rows.length, 'player')} who are turning pro.`
      );
      if (rows.length > 1)
        paragraphs.push(
          `Also declaring: ${C.listJoin(rows.slice(1, 6).map(x => `${name(x.p)} (${T(x.t).nick}${ppg(x) ? `, ${ppg(x)} points per game` : ''})`))}.`
        );
      headers = ['Player', 'School', 'PPG'];
      table = rows.map(x => [name(x.p), C.teamDisplay(x.t), ppg(x) || '—']);
    }
    const item = x => {
      const c = college(x.p),
        cur = S.stats(x.p, league, year),
        prev = S.stats(x.p, league, year - 1);
      return {
        name: name(x.p),
        team: C.teamDisplay(x.t),
        teamCity: x.t.city || null,
        teamNickname: x.t.name || null,
        age: x.p.age || null,
        pick: x.n.data?.draftPick?.pk || null,
        round: x.n.data?.draftPick?.rd || null,
        years: x.n.data?.contract?.yrs || null,
        rookie: x.p.yrs === 0,
        college: c ? { PTS: perGame(c, 'PTS'), REB: perGame(c, 'REB'), AST: perGame(c, 'AST') } : null,
        season: cur?.GP > 0 ? { PTS: perGame(cur, 'PTS'), REB: perGame(cur, 'REB') } : null,
        last: prev?.GP > 0 ? { PTS: perGame(prev, 'PTS'), REB: perGame(prev, 'REB') } : null,
      };
    };
    const ordered =
      type === 2 ? rows : type === 3 ? [...rows].sort((a, b) => Number(a.p.yrs === 0) - Number(b.p.yrs === 0)) : rows;
    const key = `roundup-${groupOf(type)}-${list[0].phase}-${type === 2 ? year : wholePhase(type) ? 'all' : list[0].date}`;
    if (result.some(x => x.story.eventKey === key)) return;
    const related = [...new Map(rows.map(x => [x.t.id, x.t])).values()];
    const story = {
      id: `${fp}:${year}:season:${key}`,
      eventKey: key,
      kind: 'season',
      fingerprint: fp,
      season: year,
      day,
      type: storyType,
      headline,
      paragraphs,
      importance:
        type === 2
          ? 120
          : type === 16 || type === 17
            ? 60
            : optionTypes.has(type)
              ? Math.round(Math.min(75, 40 + 2 * R.stature(lead.p, league)))
              : type === 26
                ? 75
                : 95,
      templateVersion: 5,
      editorialVersion: 4,
      quotesEnabled: false,
      leagueName: league.leagueName,
      createdAt: new Date().toISOString(),
      relatedTeams: related.map(t => ({ id: t.id, name: C.teamDisplay(t), logoURL: t.logoURL || null })),
      seasonSnapshot: {
        headers,
        rows: table,
        source: 'season.news',
        roundup: {
          type,
          count: rows.length,
          items: (type === 3 ? [lead, ...ordered.filter(x => x !== lead)] : ordered).slice(0, 12).map(item),
        },
      },
    };
    // Draft stories show the top pick on the draft stage.
    result.push({
      story,
      context:
        type === 26
          ? { ...contextFor(lead.t, lookup, league, null), coach: coachSubject(lead.p), coachScene: 'hire' }
          : type === 2
            ? {
                ...contextFor(lead.t, lookup, league, lead.p),
                coachScene: 'draft',
                draftee: lead.p,
                pick: lead.n.data?.draftPick || null,
              }
            : // Signings show the lead player holding up the new jersey; retirements, the lead player's farewell at the podium.
              type === 3
              ? { ...contextFor(lead.t, lookup, league, lead.p), coachScene: 'signing', signee: lead.p }
              : // A recruiting day shows the headliner's commitment post on Hoop Gram.
                type === 14
                ? { ...contextFor(lead.t, lookup, league, lead.p), coachScene: 'commit', recruit: lead.p }
                : type === 16 || type === 17
                  ? { ...contextFor(lead.t, lookup, league, lead.p), coachScene: 'farewell', retiree: lead.p }
                  : contextFor(lead.t, lookup, league, lead.p),
    });
  }
  function candidates(league, leagues = []) {
    const cal = calendar(league, leagues);
    // News from the college season keeps its own date; news after it follows the pro calendar.
    const dayOf = n => (cal.over ? Math.min(cal.day, Math.max(cal.own, Number(n.date) + 1)) : cal.own);
    const lookup = C.buildLookups(league),
      year = C.seasonYear(league),
      fp = C.buildFingerprint(league),
      players = new Map(lookup.players),
      result = [];
    for (const p of [...(league.retirees || []), ...(league.hallOfFame || [])])
      if (p && Number.isInteger(p.id) && !players.has(p.id)) players.set(p.id, p);
    const coaches = new Map((league.coaches || []).map(p => [p.id, p]));
    for (const t of lookup.teams.values()) for (const p of t.frontOffice?.staff || []) coaches.set(p.id, p);
    const currentDay = Number.isInteger(league.season?.currentDay) ? league.season.currentDay : lookup.latestDay;
    const firstDay = lookup.latestDay <= currentDay ? Math.max(0, lookup.latestDay) : Math.max(0, currentDay);
    const phase = league.season?.phase;
    // Offseason phases turn over quickly; the draft, signings and recruiting
    // from the last few phases are still today's news.
    const recentPhase = n =>
      Number.isInteger(n.phase) && n.phase < phase && n.phase >= phase - 3 && roundupTypes.has(n.type);
    const events = (league.season?.news || []).filter(
      n =>
        n.league === league.leagueType &&
        Number.isInteger(n.date) &&
        types[n.type] &&
        (n.phase === phase ? n.date >= firstDay && n.date <= currentDay : recentPhase(n))
    );
    // A day with many routine moves becomes one roundup instead of a feed of briefs.
    const grouped = new Map();
    for (const n of events)
      if (roundupTypes.has(n.type)) {
        const k = `${groupOf(n.type)}:${n.phase}:${wholePhase(n.type) ? 'all' : n.date}`;
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k).push(n);
      }
    const bundled = new Set(
      [...grouped.values()].filter(list => list.length >= roundupSize || list[0].type === 2).flat()
    );
    for (const [, list] of grouped)
      if (bundled.has(list[0]))
        roundup(list, { league, lookup, players, coaches, year, fp, result, day: dayOf(list[0]) });
    const inRoundup = new Map();
    // Hires and option decisions fold into their roundup, but a name worth
    // its own story keeps one: a notable coach, a contender's new coach, a player who matters.
    const contender = t => {
      const r = t && (t.season || []).filter(r => r.seasonStats?.GP > 0).sort((a, b) => b.yr - a.yr)[0]?.seasonStats;
      return !!r && r.W / Math.max(1, r.W + r.L) >= 0.65;
    };
    for (const list of grouped.values())
      if (bundled.has(list[0]) && (list[0].type === 26 || optionTypes.has(list[0].type)))
        for (const n of list) {
          bundled.delete(n);
          const level = n.type === 26 ? null : R.tier(R.stature(players.get(n.pid), league)),
            declined = [19, 21].includes(n.type);
          const own =
            n.type === 26
              ? coachTier(coachStature(coaches.get(n.pid))) !== 'role' || contender(lookup.teams.get(n.tid))
              : level === 'star' || (declined && level === 'regular');
          if (!own) inRoundup.set(n, `roundup-${groupOf(n.type)}-${n.phase}-all`);
        }
    // Role players' retirements share one roundup; names people know keep their own story.
    const quiet = new Map();
    for (const n of events)
      if (
        (n.type === 16 || n.type === 17) &&
        players.has(n.pid) &&
        R.tier(R.stature(players.get(n.pid), league)) === 'role'
      ) {
        const k = `${n.type}:${n.phase}`;
        quiet.set(k, [...(quiet.get(k) || []), n]);
      }
    // A role player's farewell is still a story with an angle: a title, a whole career in one place, the longest run.
    const angle = new Map();
    for (const list of quiet.values()) {
      const games = n => R.history(players.get(n.pid), league)?.GP || 0,
        longest = Math.max(...list.map(games));
      for (const n of list) {
        const p = players.get(n.pid),
          titles = (p.awards || [])
            .filter(a => a.id === 0 && a.league === league.leagueType)
            .reduce((k, a) => k + (a.yearsWon || []).length, 0);
        const teams = new Set(
            (p.stats || []).filter(x => x.league === league.leagueType).flatMap(x => (x.season || []).map(y => y.tid))
          ),
          seasons = new Set((p.stats || []).filter(x => x.league === league.leagueType).map(x => x.yr)).size;
        const why = titles
          ? { titles }
          : teams.size === 1 && seasons >= 7
            ? { lifer: seasons, team: [...teams][0] }
            : list.length >= 3 && games(n) === longest && longest >= 200
              ? { longest }
              : null;
        if (why) angle.set(n, why);
      }
    }
    for (const list of quiet.values())
      if (list.length >= 3) {
        roundup(list, {
          league,
          lookup,
          players,
          coaches,
          year,
          fp,
          result,
          day: dayOf(list[0]),
          own: n => angle.has(n),
        });
        for (const n of list) if (!angle.has(n)) inRoundup.set(n, `roundup-${list[0].type}-${list[0].phase}-all`);
      }
    for (const event of events.filter(n => !bundled.has(n))) {
      const info = event.data || {},
        jersey = info.retiredNumber;
      // An award story's award: the league's entry, with its trophy sprite and colors.
      const awardOf = data => (league.awards || []).find(a => a.id === data.awardId) || null;
      // A player's span in this league, first season to last, for a retired jersey's banner.
      const careerYears = p => {
        const yrs = (p?.stats || [])
          .filter(x => x.league === league.leagueType && (x.season || []).length)
          .map(x => x.yr);
        return yrs.length ? `${Math.min(...yrs)}–${Math.max(...yrs)}` : null;
      };
      let coachEvent = [26, 27, 28, 29].includes(event.type);
      const personId = event.type === 25 && jersey?.pid > 0 ? jersey.pid : event.pid;
      const player =
        (coachEvent ? coaches : players).get(personId) ||
        ([22, 25].includes(event.type) ? coaches.get(personId) : null);
      if (player && [22, 25].includes(event.type) && !players.has(personId)) coachEvent = true;
      let team = lookup.teams.get(event.tid),
        related = team ? [team] : [],
        headline = '',
        paragraphs = [],
        rows = [];
      const name = player ? C.playerDisplay(player) : '',
        teamName = team ? C.teamDisplay(team) : '',
        type = types[event.type];
      if (event.type === 7) {
        const trade = info.trade;
        if (trade?.status !== 1 || !Array.isArray(trade.teams) || trade.teams.length < 2) continue;
        related = trade.teams.map(t => lookup.teams.get(t.tid));
        if (related.some(t => !t)) continue;
        team = related[0];
        let invalid = false;
        for (const side of trade.teams) {
          const outgoing = [];
          for (const asset of side.assets || []) {
            // Each side lists its outgoing assets; asset.tid is the destination.
            const destination = lookup.teams.get(asset.tid);
            if (!destination || destination.id === side.tid) {
              invalid = true;
              break;
            }
            let item = '';
            if (asset.pid > 0) {
              const p = players.get(asset.pid);
              if (!p) {
                invalid = true;
                break;
              }
              item = C.playerDisplay(p);
            } else if (asset.draftPick?.yr > 0 && asset.draftPick?.rd > 0)
              item = `a ${asset.draftPick.yr} ${rounds[asset.draftPick.rd] || `round-${asset.draftPick.rd}`} pick`;
            else {
              invalid = true;
              break;
            }
            outgoing.push(`${item} to ${C.teamDisplay(destination)}`);
            rows.push([C.teamDisplay(lookup.teams.get(side.tid)), item, C.teamDisplay(destination)]);
          }
          if (outgoing.length)
            paragraphs.push(
              `${C.capitalize(C.teamRef(lookup.teams.get(side.tid)).full)} sent ${C.listJoin(outgoing)}.`
            );
        }
        if (invalid || !rows.length) continue;
        // Two-team deals read as one sentence: who got whom, for what.
        if (trade.teams.length === 2) {
          const [x, y] = trade.teams.map(t => ({
            ref: C.teamRef(lookup.teams.get(t.tid)),
            items: rows.filter(r => r[0] === C.teamDisplay(lookup.teams.get(t.tid))).map(r => r[1]),
          }));
          if (x.items.length && y.items.length)
            paragraphs = [
              `${C.capitalize(x.ref.full)} acquired ${C.listJoin(y.items)} from ${y.ref.full} in exchange for ${C.listJoin(x.items)}.`,
            ];
        }
        const playerAssets = trade.teams.flatMap(t =>
          (t.assets || [])
            .filter(a => a.pid > 0)
            .map(a => ({ from: lookup.teams.get(t.tid), to: lookup.teams.get(a.tid), player: players.get(a.pid) }))
        );
        for (const { player: p } of playerAssets.slice(0, 2)) {
          const line = seasonLine(p, league, year);
          if (line) paragraphs.push(line);
        }
        const lead = playerAssets[0];
        headline = lead
          ? `${C.teamRef(lead.to).nickname} ${C.verb(C.teamRef(lead.to), 'acquire')} ${C.playerDisplay(lead.player)} from ${C.teamRef(lead.from).nickname}`
          : `${related.map(t => C.teamRef(t).nickname).join(' and ')} ${related.length === 2 ? 'swap' : 'complete'} draft picks`;
      } else if (event.type === 13) {
        if (!team) continue;
        headline = `${C.teamRef(team).nickname} crowned ${year} champions`;
        paragraphs = [
          `${C.capitalize(C.teamRef(team).full)} are the ${year} ${league.shortName || league.leagueName} champions.`,
        ];
        rows = [[teamName, 'Not available', year]];
      } else {
        if (!player) continue;
        if (!team && [16, 17, 22, 29].includes(event.type)) {
          team = lookup.teams.get(player.tid);
          related = team ? [team] : [];
        }
        if (!team && ![16, 17, 22, 29].includes(event.type)) continue;
        const T = team ? C.teamRef(team) : null,
          Full = T ? C.capitalize(T.full) : '',
          nick = T?.nickname || '',
          last = player.ln || C.surname(name),
          season = coachEvent ? '' : seasonLine(player, league, year);
        const record = team && (team.season || []).find(r => r.yr === year)?.seasonStats,
          standing =
            record && Number.isInteger(record.W) && Number.isInteger(record.L) && record.W + record.L > 0
              ? ` (${record.W}-${record.L})`
              : '';
        switch (event.type) {
          case 2: {
            const pick = info.draftPick;
            if (!Number.isInteger(pick?.rd) || pick.rd < 1) continue;
            headline = `${nick} ${C.verb(T, 'take')} ${name}${pick.pk > 0 ? ` at No. ${pick.pk}` : ` in round ${pick.rd}`}`;
            paragraphs = [
              `${Full} selected ${name}${pick.pk > 0 ? ` with the No. ${pick.pk} pick` : ''}${pick.rd > 1 || !(pick.pk > 0) ? ` in the ${rounds[pick.rd] ? rounds[pick.rd].replace('-round', ' round') : `round ${pick.rd}`}` : ''} of the draft.`,
            ];
            break;
          }
          case 3:
            headline = `${name} signs with ${nick}`;
            paragraphs = [
              `${name} signed with ${T.full}${info.contract?.yrs > 0 ? ` on a ${C.num(info.contract.yrs)}-year deal` : ''}.`,
              season,
            ].filter(Boolean);
            break;
          case 5:
          case 6:
            headline = `${nick} ${C.verb(T, event.type === 6 ? 'waive' : 'release')} ${name}`;
            paragraphs = [`${Full} ${event.type === 6 ? 'waived' : 'released'} ${name}.`, season].filter(Boolean);
            break;
          case 10: {
            const games = info.injury?.gamesOut,
              known = Number.isInteger(games) && games > 0;
            headline = known
              ? `${name} out ${C.plural(games, 'game')} for ${nick}`
              : `${nick} ${C.verb(T, 'lose')} ${name} to injury`;
            paragraphs = [
              `${name} will miss ${known ? `an estimated ${C.plural(games, 'game')}` : 'time'} with an injury, a blow to ${T.full}${standing}.`,
              season ? `${season} ${C.capitalize(T.short)} will have to find that production elsewhere.` : '',
            ].filter(Boolean);
            break;
          }
          case 11:
            headline = `${name} cleared to return for ${nick}`;
            paragraphs = [
              `${name} has recovered from injury, giving ${T.full} another option in the rotation.`,
              season,
            ].filter(Boolean);
            break;
          case 12: {
            const award = (league.awards || []).find(a => a.id === info.awardId);
            if (!award || award.id === 0) continue;
            headline = `${name} wins ${award.name}`;
            paragraphs = [`${name} has won the ${year} ${award.name}${/award$/i.test(award.name) ? '' : ' award'}.`];
            rows = [[award.name, name, year]];
            break;
          }
          case 14:
            headline = `${name} commits to ${nick}`;
            paragraphs = [`${Full} landed a commitment from ${name}.`];
            break;
          case 15:
            headline = `${name} declares for the draft`;
            paragraphs = [`${name} has declared for the draft.`, season.replace(' is averaging ', ' averaged ')].filter(
              Boolean
            );
            break;
          case 16:
            headline = `${name} announces plans to retire`;
            paragraphs = [
              `${name} has announced plans to retire, putting a ${league.shortName || league.leagueName} career on its final lap.`,
            ];
            break;
          case 17:
            headline = `${name} calls it a career`;
            paragraphs = [`${name} has retired from basketball.`];
            break;
          case 18:
          case 19:
          case 20:
          case 21: {
            const accepted = [18, 20].includes(event.type),
              owner = event.type < 20 ? 'player' : 'team';
            headline = optionHeadline(event.type, name, team);
            paragraphs = [
              owner === 'player'
                ? `${name} ${accepted ? 'exercised' : 'declined'} a player option with ${T.full}.`
                : `${Full} ${accepted ? 'picked up' : 'declined'} the team option on ${C.possessive(name)} contract.`,
              season,
            ].filter(Boolean);
            break;
          }
          case 22:
            headline = `${name} enters the Hall of Fame`;
            paragraphs = [`${name} has been inducted into the ${league.shortName || league.leagueName} Hall of Fame.`];
            break;
          case 25:
            if (!Number.isInteger(jersey?.num) || jersey.num < 0) continue;
            headline = `${nick} ${C.verb(T, 'retire')} ${C.possessive(name)} No. ${jersey.num}`;
            paragraphs = [
              `${Full} retired No. ${jersey.num} in honor of ${name}. Nobody will wear it for the franchise again.`,
            ];
            break;
          case 26: {
            const head = (team?.frontOffice?.staff || []).find(c => c.id === player.id)?.pos === 1,
              cr = coachRecord(player),
              prior = (team.season || [])
                .filter(r => r.seasonStats?.GP > 0)
                .sort((a, b) => b.yr - a.yr)[0]?.seasonStats;
            headline = `${nick} ${C.verb(T, 'hire')} ${name}`;
            paragraphs = head
              ? [
                  `${Full} hired ${name} as head coach.${cr ? ` ${C.capitalize(last)} brings ${cr}.` : ''}`,
                  prior && prior.W / Math.max(1, prior.W + prior.L) >= 0.65
                    ? `It's one of the best jobs in the league: ${T.nick} went ${prior.W}-${prior.L} last season.`
                    : '',
                ].filter(Boolean)
              : [`${name} is joining the ${T.display} coaching staff.`];
            break;
          }
          case 27:
          case 28:
            headline = `${nick} ${C.verb(T, 'part')} ways with ${name}`;
            paragraphs = [
              `${Full} ${event.type === 28 ? 'fired' : 'released'} coach ${name}${standing ? `, with the team at ${standing.slice(2, -1)}` : ''}.${coachRecord(player) ? ` ${C.capitalize(last)} leaves with ${coachRecord(player)}.` : ''}`,
            ];
            break;
          case 29:
            headline = `Coach ${name} retires`;
            paragraphs = [`${name} has retired from coaching.`];
            break;
          case 30:
            headline = `${nick} ${C.verb(T, 'extend')} ${name}`;
            paragraphs = [
              `${Full} and ${name} agreed to a contract extension${info.contract?.ext?.yrs > 0 ? ` that adds ${C.plural(info.contract.ext.yrs, 'year')}` : ''}.`,
              season,
            ].filter(Boolean);
            break;
          case 31:
            headline = `${name} requests a trade`;
            paragraphs = [`${name} has asked ${T.full} for a trade. No deal is in place yet.`, season].filter(Boolean);
            break;
        }
        if (!headline) continue;
        const why = angle.get(event);
        if (why)
          paragraphs.push(
            why.titles
              ? `${C.capitalize(last)} won ${why.titles === 1 ? 'a championship' : `${C.num(why.titles)} championships`} along the way.`
              : why.lifer
                ? `${C.capitalize(last)} spent all ${C.num(why.lifer)} seasons with ${C.teamRef(lookup.teams.get(why.team) || team).full}.`
                : `No one in this year's retirement class played longer: ${why.longest} games.`
          );
        if (!coachEvent) {
          const career = R.history(player, league);
          if (career && [16, 17, 22, 25].includes(event.type)) {
            paragraphs.push(
              `${C.surname(name)} averaged ${(career.PTS / career.GP).toFixed(1)} points, ${(career.REB / career.GP).toFixed(1)} rebounds and ${(career.AST / career.GP).toFixed(1)} assists over ${career.GP} regular-season games in ${league.shortName || league.leagueName}.`
            );
            rows.push(
              ['Career PPG', (career.PTS / career.GP).toFixed(1), 'Regular season'],
              ['Career RPG', (career.REB / career.GP).toFixed(1), 'Regular season'],
              ['Career APG', (career.AST / career.GP).toFixed(1), 'Regular season']
            );
          }
        }
        if (event.type !== 12) rows.unshift(['Event', type, name]);
      }
      if (event.type === 10 && team) {
        const record = (team.season || []).find(r => r.yr === year);
        paragraphs.push(
          ...S.quoteLines(
            `${fp}:${year}:injury:${event.pid}:${event.date}`,
            record,
            false,
            C.coachForTeam(team),
            player,
            'injury',
            team
          )
        );
      }
      // An unattached retired player can still receive league-wide Hall of Fame coverage.
      if (!related.length) related = [...lookup.teams.values()];
      team ||= related[0];
      if (!team) continue;
      const key =
        event.type === 12
          ? `award-${info.awardId}-${event.pid}`
          : event.type === 13
            ? 'championship'
            : `news-${C.hashString(JSON.stringify(canonical({ league: event.league, phase: event.phase, date: event.date, type: event.type, tid: event.tid, pid: event.pid, gid: event.gid, data: info })))}`;
      if (result.some(x => x.story.eventKey === key)) continue;
      // News value follows who it's about: a star's retirement leads, a bench player's is a line in a roundup.
      const size = coachEvent ? 0 : R.stature(player, league),
        now = !coachEvent && player ? S.stats(player, league, year) : null,
        ppg = now?.GP > 0 ? now.PTS / now.GP : 0;
      const teamRec =
          team &&
          (
            (team.season || []).find(r => r.yr === year && r.seasonStats?.GP > 0) ||
            (team.season || []).find(r => r.yr === year - 1)
          )?.seasonStats,
        winPct = teamRec && teamRec.W + teamRec.L > 0 ? teamRec.W / (teamRec.W + teamRec.L) : 0.5;
      const value =
        event.type === 16 || event.type === 17
          ? R.tier(size) === 'role'
            ? angle.has(event)
              ? angle.get(event).titles
                ? 60
                : 55
              : 40
            : Math.min(135, 60 + 2.5 * size)
          : event.type === 22
            ? 120
            : event.type === 25
              ? 100
              : event.type === 13
                ? 125
                : event.type === 12
                  ? 85
                  : event.type === 10
                    ? Math.min(110, 45 + 3 * ppg + (winPct >= 0.6 ? 15 : 0))
                    : event.type === 11
                      ? Math.min(80, 35 + 2 * ppg)
                      : event.type === 7
                        ? Math.min(
                            125,
                            60 +
                              2.5 *
                                Math.max(
                                  size,
                                  ...(info.trade?.teams || []).flatMap(t =>
                                    (t.assets || []).map(a => R.stature(players.get(a.pid), league))
                                  )
                                )
                          )
                        : [26, 27, 28, 29].includes(event.type)
                          ? Math.round(
                              Math.min(
                                120,
                                55 +
                                  2 * Math.max(0, coachStature(player)) +
                                  (winPct - 0.5) * 40 +
                                  (event.type === 28 ? 10 : 0)
                              )
                            )
                          : [18, 19, 20, 21].includes(event.type)
                            ? Math.min(85, 30 + 2 * size)
                            : [3, 5, 6].includes(event.type)
                              ? Math.min(100, 45 + 2 * size)
                              : event.type === 30
                                ? Math.min(110, 50 + 2 * size)
                                : event.type === 31
                                  ? Math.min(120, 60 + 2.5 * size)
                                  : 50;
      const coaching = coachEvent ? coachingFacts(event, player, team, lookup, year) : null;
      const playerNews = coachEvent ? null : playerFacts(event, info, player, team, league, lookup, year);
      const story = {
        id: `${fp}:${year}:season:${key}`,
        eventKey: key,
        kind: 'season',
        fingerprint: fp,
        season: year,
        day: dayOf(event),
        type,
        headline,
        paragraphs,
        importance: inRoundup.has(event) ? 10 : Math.round(value),
        ...(inRoundup.has(event) ? { inRoundup: `${fp}:${year}:season:${inRoundup.get(event)}` } : {}),
        templateVersion: event.type === 10 ? 6 : 5,
        editorialVersion: 3,
        quotesEnabled: true,
        leagueName: league.leagueName,
        createdAt: new Date().toISOString(),
        relatedTeams: related.map(t => ({ id: t.id, name: C.teamDisplay(t), logoURL: t.logoURL || null })),
        seasonSnapshot: {
          headers: event.type === 7 ? ['From', 'Asset', 'To'] : ['Category', 'Value', 'Context'],
          rows,
          newsEvent: structuredClone(event),
          ...(coaching ? { coaching } : {}),
          ...(playerNews ? { newsPlayer: playerNews } : {}),
          source: 'season.news',
        },
      };
      const opponent = related.find(t => t.id !== team.id) || [...lookup.teams.values()].find(t => t.id !== team.id);
      const featured = !coachEvent && player && related.some(t => t.id === event.tid) ? player : null;
      result.push({
        story,
        context: {
          winner: team,
          loser: opponent,
          home: team,
          game: { homeTeam: team.id },
          scenePlayer: featured || team.roster?.[0],
          potg: featured,
          coach: coachEvent ? coachSubject(player) : null,
          coachScene:
            event.type === 26 && (team?.frontOffice?.staff || []).find(c => c.id === player?.id)?.pos === 1
              ? 'hire'
              : [27, 28].includes(event.type)
                ? 'fire'
                : event.type === 12 && featured && awardOf(info)
                  ? 'award'
                  : null,
          ...(event.type === 12 && featured && awardOf(info) ? { awardee: featured, award: awardOf(info) } : {}),
          ...(event.type === 10 && featured ? { injury: true } : {}),
          ...([3, 7, 30].includes(event.type) && featured ? { coachScene: 'signing', signee: featured } : {}),
          ...([16, 17].includes(event.type) && player ? { coachScene: 'farewell', retiree: player } : {}),
          ...(event.type === 14 && featured ? { coachScene: 'commit', recruit: featured } : {}),
          ...(event.type === 25 && player && jersey != null
            ? { coachScene: 'rafters', retired: { player, num: jersey, years: careerYears(player) } }
            : {}),
          ...(event.type === 22 && player
            ? {
                coachScene: 'hof',
                inductee: player,
                hall: (league.hallOfFame || []).filter(p => p && p.id !== player.id && p.appearance).slice(-2),
              }
            : {}),
          potgStatsTrusted: !!featured,
          gameBall: league.gameballs?.[Number(league.settings?.gameBall) || 0] || {
            pri: 'E37033',
            sec: 'E37033',
            ter: 'E37033',
            outline: '44220F',
          },
        },
      });
    }
    return result;
  }
  // College stops at its title game while the pro league keeps the shared
  // calendar running; coverage written in that gap carries the pro date.
  function calendar(league, leagues = []) {
    const own = Math.max(1, C.buildLookups(league).latestDay + 1),
      year = C.seasonYear(league);
    const over =
      league.leagueType === 1 &&
      (league.season?.news || []).some(
        n => n.type === 13 && n.league === league.leagueType && n.phase === league.season?.phase
      );
    const pro = over ? leagues.find(l => l !== league && l.leagueType === 0 && C.seasonYear(l) === year) : null;
    const proDay = pro ? Math.max(1, C.buildLookups(pro).latestDay + 1) : 0;
    return { day: Math.max(own, proDay), own, over, elapsed: Math.max(0, proDay - own) };
  }
  const classes = ['Fr.', 'So.', 'Jr.', 'Sr.'],
    classWord = { 'Fr.': 'freshman', 'So.': 'sophomore', 'Jr.': 'junior', 'Sr.': 'senior' };
  const classOf = p => classes[Math.min(3, Math.max(0, p.yrs | 0))];
  // College coverage outside the season, written only from what the save has
  // settled. After the title game nobody has declared yet, so the desk runs
  // the draft-eligible board and the seniors who are out of eligibility.
  // Once the offseason sets the draft class and the new rosters, it reports
  // who left, who's back and the official preseason poll.
  function offseason(league, leagues = []) {
    if (league.leagueType !== 1) return [];
    const lookup = C.buildLookups(league),
      year = C.seasonYear(league),
      fp = C.buildFingerprint(league),
      short = league.shortName || league.leagueName,
      result = [];
    const name = p => C.playerDisplay(p),
      last = p => p.ln || C.surname(name(p)),
      T = t => C.teamRef(t),
      cap = C.capitalize;
    const pg = (x, k) => Number(perGame(x.s, k)) || 0,
      line = x => `${perGame(x.s, 'PTS')} points, ${perGame(x.s, 'REB')} rebounds and ${perGame(x.s, 'AST')} assists`;
    const statRow = x => [name(x.p), x.cls, perGame(x.s, 'PTS'), perGame(x.s, 'REB'), perGame(x.s, 'AST')];
    // Pro teams draft on potential, so it leads the grade; college production moves a player up or down from there.
    const grade = x => (x.p.pot || 0) + (pg(x, 'PTS') + pg(x, 'REB') / 2 + pg(x, 'AST') * 0.7) / 8;
    const item = x => ({
      name: name(x.p),
      team: C.teamDisplay(x.t),
      teamCity: x.t.city || null,
      teamNickname: x.t.name || null,
      age: x.p.age || null,
      year: x.cls,
      senior: x.cls === 'Sr.',
      pronoun: C.pronoun(x.p),
      season: { PTS: perGame(x.s, 'PTS'), REB: perGame(x.s, 'REB'), AST: perGame(x.s, 'AST') },
    });
    const subs = list => list.map(x => C.teamDisplay(x.t));
    // The offseason's big college stories: the draft class and the poll lead; the rest support.
    const worth = { 'draft-class': 110, 'preseason-poll': 105, 'draft-watch': 90, returning: 85, seniors: 80 };
    const push = (key, day, { type, headline, paragraphs, board, items, lead, kind, extra = {} }) => {
      const related = [...new Map((items || []).map(x => [x.t.id, x.t])).values()];
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
        importance: worth[kind] || 90,
        templateVersion: 5,
        editorialVersion: 4,
        quotesEnabled: false,
        leagueName: league.leagueName,
        createdAt: new Date().toISOString(),
        relatedTeams: related.map(t => ({ id: t.id, name: C.teamDisplay(t), logoURL: t.logoURL || null })),
        seasonSnapshot: {
          headers: board.headers,
          rows: board.rows,
          board,
          source: 'season.offseason',
          roundup: { type: kind, count: items.length, items: items.slice(0, 12).map(item), ...extra },
        },
      };
      result.push({ story, context: contextFor(lead.t, lookup, league, lead.p) });
    };
    const cal = calendar(league, leagues);
    if (cal.over && cal.elapsed >= 1) {
      const rows = [...lookup.players.values()]
        .map(p => ({ p, t: lookup.teams.get(p.tid), s: S.stats(p, league, year), cls: classOf(p) }))
        .filter(x => x.t && x.s?.GP > 0);
      if (rows.length < 10) return result;
      const champion = lookup.teams.get(
        (league.season?.news || []).find(
          n => n.type === 13 && n.league === league.leagueType && n.phase === league.season?.phase
        )?.tid
      );
      // 1. The big board: everyone who could be drafted, if they choose to go.
      const board = [...rows].sort((a, b) => grade(b) - grade(a) || a.p.id - b.p.id).slice(0, 10),
        top = board[0],
        seniors = board.filter(x => x.cls === 'Sr.').length,
        he = C.pronoun(top.p);
      push('offseason-draft-watch', cal.day, {
        type: 'Draft watch',
        kind: 'draft-watch',
        headline: `Draft watch: ${name(top.p)} tops HoopWire's big board`,
        items: board,
        lead: top,
        paragraphs: [
          `With the ${year} ${short} season in the books, the draft conversation starts now. ${name(top.p)}, a ${classWord[top.cls]} at ${T(top.t).short}, tops HoopWire's big board after averaging ${line(top)}.`,
          top.cls === 'Sr.'
            ? `${cap(last(top.p))} is out of college eligibility, so the pros are next.`
            : `${cap(last(top.p))} has college eligibility left, so the question is whether ${he || last(top.p)} leaves early.`,
          `Next on the board: ${C.listJoin(board.slice(1, 4).map(x => `${name(x.p)} (${T(x.t).short}, ${x.cls})`))}.`,
          ...board
            .slice(0, 4)
            .filter(x => pg(x, 'PTS') < 8)
            .slice(0, 1)
            .map(
              x =>
                `${name(x.p)} scored only ${perGame(x.s, 'PTS')} points a game. The board is betting on ${C.possessive(last(x.p))} ceiling, not the box score.`
            ),
          seniors === board.length
            ? `All ten are seniors on their way out.`
            : seniors === 1
              ? `Only one of the top ten is a senior; the other nine decide this offseason whether to declare.`
              : seniors
                ? `${cap(C.num(seniors))} of the top ten are seniors; the other ${C.num(board.length - seniors)} decide this offseason whether to declare.`
                : `None of the top ten are seniors. All of them decide this offseason whether to declare.`,
        ],
        board: {
          kicker: 'Draft watch',
          title: 'Big board',
          headers: ['Player', 'Class', 'PPG', 'RPG', 'APG'],
          rows: board.map(statRow),
          subs: subs(board),
          ranked: true,
        },
        extra: { seniors },
      });
      // 2. The seniors: out of eligibility, so this part is already settled.
      const most = Math.max(...rows.map(r => r.s.GP));
      const done = rows
        .filter(x => x.cls === 'Sr.' && x.s.GP >= Math.max(1, Math.floor(most / 2)))
        .sort((a, b) => pg(b, 'PTS') - pg(a, 'PTS') || a.p.id - b.p.id)
        .slice(0, 8);
      if (cal.elapsed >= 7 && done.length >= 3) {
        const lead = done[0],
          champ = champion && done.find(x => x.t.id === champion.id);
        push('offseason-seniors', cal.day, {
          type: 'College offseason',
          kind: 'seniors',
          headline: `Last call: ${name(lead.p)} leads the seniors out the door`,
          items: done,
          lead,
          paragraphs: [
            `${name(lead.p)} of ${T(lead.t).full} heads a senior class that has played its last college game. ${cap(last(lead.p))} averaged ${line(lead)} in a final season.`,
            `Also out of eligibility: ${C.listJoin(done.slice(1, 4).map(x => `${name(x.p)} (${T(x.t).short}, ${perGame(x.s, 'PTS')} points)`))}.`,
            champ ? `${cap(T(champion).full)} ${C.verb(T(champion), 'send')} ${name(champ.p)} out a champion.` : '',
          ].filter(Boolean),
          board: {
            kicker: 'Senior class',
            title: 'Final-season scoring leaders',
            headers: ['Player', 'Class', 'PPG', 'RPG', 'APG'],
            rows: done.map(statRow),
            subs: subs(done),
            ranked: true,
          },
        });
      }
      return result;
    }
    // The offseason: the draft class and the new rosters are in the save.
    if (lookup.latestDay >= 0) return result;
    const prev = year - 1,
      day = Math.max(1, lookup.latestDay + 1);
    const teamOf = p => {
      const e = (p.stats || [])
        .filter(x => x.league === league.leagueType && x.yr === prev)
        .flatMap(x => x.season || [])
        .find(x => lookup.teams.has(x.tid));
      return e ? lookup.teams.get(e.tid) : null;
    };
    const pro = leagues.find(l => l !== league && l.leagueType === 0);
    // Draft-class entries keep the college class they played last season in.
    const leaving = (pro?.draftClass || [])
      .map(p => ({ p, t: teamOf(p), s: S.stats(p, league, prev), cls: classOf(p) }))
      .filter(x => x.t && x.s?.GP > 0);
    // Championships carry league 0 even for college teams; the team list already scopes it.
    const champion = [...lookup.teams.values()].find(t => t.championships?.yearsWon?.includes(prev));
    // 1. Who's going: the draft class, as the save lists it.
    if (leaving.length >= 5) {
      const ranked = [...leaving].sort((a, b) => grade(b) - grade(a) || a.p.id - b.p.id),
        top = ranked[0],
        early = leaving.filter(x => x.cls !== 'Sr.').length,
        fresh = leaving.filter(x => x.cls === 'Fr.').length;
      const counts = new Map();
      for (const x of leaving) counts.set(x.t.id, (counts.get(x.t.id) || 0) + 1);
      const [hitId, hit] = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0],
        hardest = lookup.teams.get(hitId);
      push('offseason-draft-class', day, {
        type: 'Draft class',
        kind: 'draft-class',
        headline: `${name(top.p)} leads the ${year} draft class`,
        items: ranked,
        lead: top,
        paragraphs: [
          `The ${year} draft class is set, and ${name(top.p)} of ${T(top.t).full} leads the way after averaging ${line(top)} as a ${classWord[top.cls]}.`,
          early === leaving.length
            ? `Every player in the class is leaving with eligibility left${fresh ? `, and ${C.num(fresh)} played just one college season` : ''}.`
            : early === 0
              ? `Every player in the class is a senior.`
              : leaving.length - early < 10
                ? `All but ${C.num(leaving.length - early)} players in the class are leaving with eligibility left${fresh ? `, and ${C.num(fresh)} played just one college season` : ''}.`
                : `In the class, ${early} players are leaving with eligibility left${fresh ? `, and ${C.num(fresh)} played just one college season` : ''}.`,
          `Also headed to the draft: ${C.listJoin(ranked.slice(1, 4).map(x => `${name(x.p)} (${T(x.t).short}, ${x.cls})`))}.`,
          hit >= 3
            ? `No program was hit harder than ${T(hardest).full}, with ${C.plural(hit, 'player')} headed to the draft.`
            : '',
        ].filter(Boolean),
        board: {
          kicker: 'Draft class',
          title: 'Top college prospects',
          headers: ['Player', 'Class', 'PPG', 'RPG', 'APG'],
          rows: ranked.slice(0, 10).map(statRow),
          subs: subs(ranked.slice(0, 10)),
          ranked: true,
        },
        extra: { early, fresh },
      });
    }
    // 2. Who's back: last season's players still on a roster.
    const roster = [...lookup.players.values()]
      .map(p => ({ p, t: lookup.teams.get(p.tid), s: S.stats(p, league, prev), cls: classOf(p) }))
      .filter(x => x.t && x.p.yrs >= 1 && x.s?.GP > 0);
    const most = roster.length ? Math.max(...roster.map(r => r.s.GP)) : 0;
    const back = roster
      .filter(x => x.s.GP >= Math.max(1, Math.floor(most / 2)))
      .sort((a, b) => pg(b, 'PTS') - pg(a, 'PTS') || a.p.id - b.p.id)
      .slice(0, 8);
    if (back.length >= 3) {
      const top = back[0],
        champ = champion && back.find(x => x.t.id === champion.id),
        gone = leaving.length ? [...leaving].sort((a, b) => pg(b, 'PTS') - pg(a, 'PTS'))[0] : null;
      push('offseason-returning', day, {
        type: 'College offseason',
        kind: 'returning',
        headline: `${name(top.p)} leads the stars back for ${year}`,
        items: back,
        lead: top,
        paragraphs: [
          `The best scorer back this season is ${name(top.p)} of ${T(top.t).full}. The ${classWord[top.cls]} averaged ${line(top)} last season.`,
          `Also back: ${C.listJoin(back.slice(1, 4).map(x => `${name(x.p)} (${T(x.t).short}, ${perGame(x.s, 'PTS')} points)`))}.`,
          champ
            ? `${cap(T(champion).full)} ${C.verb(T(champion), 'bring')} back ${name(champ.p)}, who averaged ${perGame(champ.s, 'PTS')} points for the ${prev} champions.`
            : '',
          gone && pg(gone, 'PTS') > pg(top, 'PTS')
            ? `Last season's top scorer won't be part of it: ${name(gone.p)} (${perGame(gone.s, 'PTS')} points) is in the draft.`
            : '',
        ].filter(Boolean),
        board: {
          kicker: `${year} season`,
          title: 'Top returning scorers',
          headers: ['Player', 'Class', 'PPG', 'RPG', 'APG'],
          rows: back.map(statRow),
          subs: subs(back),
          ranked: true,
        },
      });
    }
    // 3. The official preseason poll, once the game publishes it.
    const polled = [...lookup.teams.values()]
      .map(t => ({
        t,
        now: (t.season || []).find(r => r.yr === year),
        then: (t.season || []).find(r => r.yr === prev),
      }))
      .filter(x => x.now?.poll > 0)
      .sort((a, b) => a.now.poll - b.now.poll);
    if (polled.length >= 10 && polled[0].now.poll === 1) {
      for (const x of polled) {
        const players = roster.filter(r => r.t.id === x.t.id),
          games = x.then?.seasonStats?.GP || 0;
        x.starters = games ? Math.min(5, players.filter(r => r.s.GS * 2 >= games).length) : null;
        x.star = [...players].sort((a, b) => pg(b, 'PTS') - pg(a, 'PTS'))[0] || null;
        x.lost = leaving.filter(l => l.t.id === x.t.id).sort((a, b) => pg(b, 'PTS') - pg(a, 'PTS'))[0] || null;
        x.lostCount = leaving.filter(l => l.t.id === x.t.id).length;
      }
      // The incoming freshmen often explain a ranking better than who's back:
      // the poll rates talent, and potential is how the game rates recruits.
      const freshmen = [...lookup.players.values()].filter(
        p => p.yrs === 0 && lookup.teams.has(p.tid) && !S.stats(p, league, prev)?.GP
      );
      const pots = freshmen.map(p => p.pot || 0).sort((a, b) => b - a),
        bar = pots.length >= 10 ? pots[Math.floor(pots.length * 0.2)] : Infinity,
        elite = pots.filter(v => v >= bar).length;
      const classes = new Map();
      for (const p of freshmen) classes.set(p.tid, [...(classes.get(p.tid) || []), p]);
      const most = Math.max(0, ...[...classes.values()].map(c => c.length)),
        deepest = [...classes].sort(
          (a, b) =>
            b[1].reduce((n, p) => n + (p.pot || 0), 0) - a[1].reduce((n, p) => n + (p.pot || 0), 0) || a[0] - b[0]
        )[0];
      for (const x of polled) {
        x.fresh = (classes.get(x.t.id) || []).sort((a, b) => (b.pot || 0) - (a.pot || 0) || a.id - b.id);
        x.elite = x.fresh.filter(p => (p.pot || 0) >= bar);
        x.onlyMost = x.fresh.length === most && [...classes.values()].filter(c => c.length === most).length === 1;
        x.recruiting = x.fresh.length >= 3 && (x.elite.length >= 2 || deepest?.[0] === x.t.id);
      }
      const rec = x => (x.then?.seasonStats ? `${x.then.seasonStats.W}-${x.then.seasonStats.L}` : '—');
      const startersText = x =>
        x.starters == null
          ? null
          : x.starters === 5
            ? 'all five starters'
            : x.starters === 0
              ? 'no starters'
              : x.starters === 1
                ? 'one starter'
                : `${C.num(x.starters)} starters`;
      const top = polled[0],
        ten = polled.slice(0, 10);
      const eliteText = x => {
        const e = x.elite,
          names = e.slice(0, 3).map(name);
        if (!e.length) return '';
        if (e.length === 1) return `, and ${names[0]} is one of the ${elite} highest-rated recruits in the country`;
        return `, and ${C.num(e.length)} of them${e.length <= 3 ? `, ${C.listJoin(names)},` : `, led by ${C.listJoin(names.slice(0, 2))},`} are among the ${elite} highest-rated recruits in the country`;
      };
      // Why a team sits where it does: the freshman class when that's the story, otherwise the core that's back.
      const lineFor = x => {
        const N = cap(T(x.t).nick),
          st = startersText(x),
          parts = [];
        const lostLine = x.lostCount
          ? `${C.plural(x.lostCount, 'player')} left for the draft${x.lost ? `, ${name(x.lost.p)} (${perGame(x.lost.s, 'PTS')} points) among them` : ''}`
          : '';
        if (x.recruiting) {
          parts.push(
            `The case for No. ${x.now.poll} is the freshman class. ${N} signed ${C.plural(x.fresh.length, 'recruit')}${x.onlyMost ? ', more than any other program' : ''}${eliteText(x)}.`
          );
          if (x.starters === 0)
            parts.push(`${N} will need them. ${lostLine ? `${cap(lostLine)}, and no` : 'No'} starters return.`);
          else if (st)
            parts.push(
              `${N} also ${C.verb(T(x.t), 'return')} ${st}${x.star ? `, led by ${name(x.star.p)} (${perGame(x.star.s, 'PTS')} points a game last season)` : ''}.`
            );
        } else {
          if (st)
            parts.push(
              `${N} ${C.verb(T(x.t), 'return')} ${st}${x.star ? `, led by ${name(x.star.p)} (${perGame(x.star.s, 'PTS')} points a game last season)` : ''}.`
            );
          if (x.elite.length)
            parts.push(
              x.fresh.length === 1
                ? `${name(x.elite[0])}, ${C.possessive(T(x.t).nick)} only freshman, is one of the ${elite} highest-rated recruits in the country.`
                : `${name(x.elite[0])} headlines a ${C.num(x.fresh.length)}-player freshman class and is one of the ${elite} highest-rated recruits in the country.`
            );
          if (lostLine && x.starters != null && x.starters <= 2) parts.push(`${cap(lostLine)}.`);
        }
        return parts.join(' ');
      };
      const moves = polled.filter(x => x.then?.poll > 0).map(x => ({ x, d: x.then.poll - x.now.poll })),
        riser = moves.sort((a, b) => b.d - a.d)[0];
      const champ = champion && polled.find(x => x.t.id === champion.id);
      const lead = { p: top.star?.p || top.t.roster?.[0], t: top.t };
      push('offseason-preseason-poll', day, {
        type: 'Preseason poll',
        kind: 'preseason-poll',
        headline: `Preseason poll: ${T(top.t).nickname} ${C.verb(T(top.t), 'open')} ${year} at No. 1`,
        items: ten.filter(x => x.star).map(x => ({ ...x.star })),
        lead,
        paragraphs: [
          `The ${year} ${short} preseason poll is out, and ${T(top.t).full} ${C.verb(T(top.t), 'open')} the season at No. 1${rec(top) === '—' ? '' : ` after going ${rec(top)} last year`}.`,
          lineFor(top),
          `Rounding out the top five: ${C.listJoin(polled.slice(1, 5).map(x => `${T(x.t).short}${rec(x) === '—' ? '' : ` (${rec(x)})`}`))}.`,
          champ
            ? champ.now.poll <= 25
              ? `The defending champions, ${T(champion).full}, start at No. ${champ.now.poll}.`
              : `The defending champions, ${T(champion).full}, start the season unranked.`
            : '',
          deepest && deepest[0] !== top.t.id && polled.find(x => x.t.id === deepest[0])
            ? (d =>
                `The deepest freshman class belongs to ${T(d.t).full}: ${C.plural(d.fresh.length, 'recruit')}${d.elite.length ? `, ${d.elite.length === d.fresh.length ? 'all' : C.num(d.elite.length)} of them among the country's highest rated` : ''}. ${C.capitalize(T(d.t).nick)} ${C.verb(T(d.t), 'start')} at No. ${d.now.poll}.`)(
                polled.find(x => x.t.id === deepest[0])
              )
            : '',
          riser && riser.d >= 8
            ? `No team climbed further than ${T(riser.x.t).full}, from No. ${riser.x.then.poll} at the end of last season to No. ${riser.x.now.poll}${riser.x.fresh.length >= 3 ? `, with ${C.plural(riser.x.fresh.length, 'freshman', 'freshmen')} arriving${riser.x.elite.length ? `, ${C.num(riser.x.elite.length)} of them among the country's highest-rated recruits` : ''}` : ''}.`
            : '',
        ].filter(Boolean),
        board: {
          kicker: 'Preseason poll',
          title: `${year} top 10`,
          headers: ['School', 'Last season', 'Starters back', 'Freshmen', 'Top returner'],
          rows: ten.map(x => [
            C.teamDisplay(x.t),
            rec(x),
            x.starters ?? '—',
            x.fresh.length,
            x.star ? name(x.star.p) : '—',
          ]),
          ranked: true,
        },
        extra: {
          champion: champion ? C.teamDisplay(champion) : null,
          championRank: champ?.now.poll || null,
          teams: ten.map(x => ({
            team: C.teamDisplay(x.t),
            teamCity: x.t.city || null,
            teamNickname: x.t.name || null,
            record: rec(x),
            poll: x.now.poll,
            starters: x.starters,
            freshmen: x.fresh.length,
            eliteFreshmen: x.elite.length,
            recruiting: x.recruiting,
            star: x.star ? name(x.star.p) : null,
            starPTS: x.star ? perGame(x.star.s, 'PTS') : null,
          })),
        },
      });
    }
    return result;
  }
  return { candidates, offseason, calendar };
});
