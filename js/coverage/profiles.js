/* Player, coach and team profiles saved with each upload, and the links that lead to them from articles. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.HoopWireProfiles = factory(root.HoopWireCore);
})(globalThis, function (C) {
  'use strict';
  const KEYS = ['GP', 'GS', 'PTS', 'FGM', 'FGA', 'TPM', 'TPA', 'FTM', 'FTA', 'REB', 'ORB', 'AST', 'STL', 'BLK', 'TO'];
  const TEAM_KEYS = [
    'GP',
    'W',
    'L',
    'PTS',
    'OPP',
    'FGM',
    'FGA',
    'TPM',
    'TPA',
    'FTM',
    'FTA',
    'REB',
    'AST',
    'STL',
    'BLK',
    'TO',
  ];
  // Hoop Land's special honors carry fixed ids instead of an entry in the league's award list.
  const SPECIAL_AWARDS = { 96: '3-Point Contest', 100: 'All-Star Game MVP', 101: 'All-Star' };
  const HIGHS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TPM'];

  const profileId = (fingerprint, kind, ref) => `${fingerprint}:${kind}:${ref}`;
  const valid = n => Number.isFinite(n) && n >= 0;
  function totals(row, keys) {
    const out = {};
    for (const k of keys) if (valid(row?.[k])) out[k] = row[k];
    // Native MIN[0] is total playing time in seconds.
    if (Array.isArray(row?.MIN) && valid(row.MIN[0])) out.MIN = row.MIN[0] / 60;
    return out;
  }
  function height(inches) {
    return valid(inches) && inches > 0 ? `${Math.floor(inches / 12)}-${inches % 12}` : null;
  }
  function awardList(person, league) {
    const names = new Map((league.awards || []).map(a => [a.id, a.name]));
    return (person.awards || [])
      .filter(a => a && a.league === league.leagueType && Array.isArray(a.yearsWon) && a.yearsWon.length)
      .map(a => ({ name: names.get(a.id) || SPECIAL_AWARDS[a.id], years: [...a.yearsWon].sort((x, y) => x - y) }))
      .filter(a => a.name)
      .sort((a, b) => b.years.length - a.years.length || a.name.localeCompare(b.name));
  }
  function bio(person) {
    return {
      age: valid(person.age) && person.age > 0 ? person.age : null,
      height: height(person.ht),
      weight: valid(person.wt) && person.wt > 0 ? person.wt : null,
      country: person.ctry || null,
      hometown: person.home || null,
      years: valid(person.yrs) ? person.yrs : null,
      gender: person.gender ?? 0,
    };
  }

  // What the portrait needs: the person's look, their gear or suit, and the team's home uniform and colors.
  function look(person, team, coach = false) {
    if (!person?.appearance) return null;
    const copy = v => (v == null ? null : JSON.parse(JSON.stringify(v)));
    return {
      appearance: copy(person.appearance),
      accessories: copy((person.accessories || []).slice(0, 1)),
      suits: copy((person.suits || []).slice(0, 1)),
      num: Number.isInteger(person.num) ? person.num : null,
      coach,
      team: team
        ? { uniforms: copy((team.uniforms || []).slice(0, 1)), teamColors: copy(team.teamColors || null) }
        : null,
    };
  }
  // Everyone a story can name: rostered players, the showcase teams, free agents, prospects and retirees.
  function people(league) {
    const players = new Map(),
      coaches = new Map(),
      retired = new Set();
    const addPlayer = (p, retiree = false) => {
      if (!p || !Number.isInteger(p.id) || !(p.fn || p.ln)) return;
      if (retiree) retired.add(p.id);
      if (!players.has(p.id)) players.set(p.id, p);
    };
    for (const team of [...(league.teams || []), ...(league.starTeams || [])]) {
      for (const p of team.roster || []) addPlayer(p);
      for (const c of team.frontOffice?.staff || []) if (c.pos === 1 && c.tid === team.id) coaches.set(c.id, c);
    }
    for (const p of [...(league.freeAgents || []), ...(league.draftClass || [])]) addPlayer(p);
    for (const p of [...(league.retirees || []), ...(league.hallOfFame || [])]) addPlayer(p, true);
    for (const c of league.coaches || []) if (c && Number.isInteger(c.id) && !coaches.has(c.id)) coaches.set(c.id, c);
    return { players, coaches, retired };
  }

  function teamRanks(league, year) {
    const rows = (league.teams || [])
      .map(t => ({ id: t.id, s: (t.season || []).find(x => x.yr === year)?.seasonStats }))
      .filter(x => x.s?.GP > 0);
    const per = (s, k) => s[k] / s.GP,
      pct = (s, m, a) => (s[a] > 0 ? s[m] / s[a] : 0);
    const measures = {
      record: s => s.W / Math.max(1, s.W + s.L),
      PTS: s => per(s, 'PTS'),
      OPP: s => -per(s, 'OPP'),
      margin: s => per(s, 'PTS') - per(s, 'OPP'),
      FG: s => pct(s, 'FGM', 'FGA'),
      TP: s => pct(s, 'TPM', 'TPA'),
      REB: s => per(s, 'REB'),
      AST: s => per(s, 'AST'),
      STL: s => per(s, 'STL'),
      BLK: s => per(s, 'BLK'),
      TO: s => -per(s, 'TO'),
    };
    const ranks = new Map(rows.map(r => [r.id, { of: rows.length }]));
    for (const [key, measure] of Object.entries(measures))
      for (const r of rows) ranks.get(r.id)[key] = 1 + rows.filter(o => measure(o.s) > measure(r.s)).length;
    return ranks;
  }

  // Profiles as of this upload. They are saved so a link in an older story still opens a page.
  function build(league, fingerprint) {
    const year = C.seasonYear(league),
      lookup = C.buildLookups(league),
      asOf = { season: year, day: Math.max(1, lookup.latestDay + 1) },
      base = { fingerprint, leagueName: league.leagueName || 'League', leagueType: league.leagueType, asOf },
      teams = new Map([...(league.teams || []), ...(league.starTeams || [])].map(t => [t.id, t])),
      teamName = id => (teams.has(id) ? C.teamDisplay(teams.get(id)) : null),
      { players, coaches, retired } = people(league),
      records = [];

    for (const p of players.values()) {
      const seasons = [];
      for (const entry of p.stats || [])
        if (entry.league === league.leagueType && Number.isInteger(entry.yr))
          for (const period of ['season', 'playoffs'])
            for (const row of entry[period] || [])
              if (row?.GP > 0)
                seasons.push({ yr: entry.yr, period, tid: row.tid, team: teamName(row.tid), ...totals(row, KEYS) });
      const highs = {};
      for (const period of ['seasonHighs', 'playoffHighs']) {
        const h = p.careerStats?.[period];
        if (h)
          highs[period === 'seasonHighs' ? 'season' : 'playoffs'] = Object.fromEntries(
            HIGHS.filter(k => valid(h[k]) && h[k] > 0).map(k => [k, h[k]])
          );
      }
      records.push({
        ...base,
        id: profileId(fingerprint, 'player', p.id),
        kind: 'player',
        ref: p.id,
        name: C.playerDisplay(p),
        number: Number.isInteger(p.num) && p.num >= 0 ? p.num : null,
        position: C.positionName(p.pos) || null,
        teamId: teams.has(p.tid) && !retired.has(p.id) ? p.tid : null,
        retired: retired.has(p.id),
        ...bio(p),
        seasons: seasons.sort((a, b) => a.yr - b.yr || (a.period === b.period ? 0 : a.period === 'season' ? -1 : 1)),
        look: look(p, teams.has(p.tid) && !retired.has(p.id) ? teams.get(p.tid) : null),
        highs,
        awards: awardList(p, league),
      });
    }

    for (const c of coaches.values()) {
      const career = c.career || {},
        team = teams.get(c.tid);
      records.push({
        ...base,
        id: profileId(fingerprint, 'coach', c.id),
        kind: 'coach',
        ref: c.id,
        name: C.playerDisplay(c),
        teamId: team ? team.id : null,
        ...bio(c),
        career: {
          season: totals(career.season, ['GP', 'W', 'L']),
          playoffs: totals(career.playoffs, ['GP', 'W', 'L']),
        },
        current: team ? totals((team.season || []).find(x => x.yr === year)?.seasonStats, ['GP', 'W', 'L']) : null,
        look: look(c, team, true),
        awards: awardList(c, league),
      });
    }

    const ranks = teamRanks(league, year);
    for (const t of league.teams || []) {
      const coach = (t.frontOffice?.staff || []).find(c => c.pos === 1 && c.tid === t.id);
      const ref = C.teamRef(t);
      records.push({
        ...base,
        id: profileId(fingerprint, 'team', t.id),
        kind: 'team',
        ref: t.id,
        name: C.teamDisplay(t),
        city: ref.city || null,
        nickname: ref.nickname || null,
        logoURL: t.logoURL || null,
        arena: t.arenaName || null,
        coachId: coach?.id ?? null,
        seasons: (t.season || [])
          .filter(x => Number.isInteger(x.yr) && x.seasonStats?.GP > 0)
          .map(x => ({
            yr: x.yr,
            regular: totals(x.seasonStats, TEAM_KEYS),
            playoffs: x.playoffStats?.GP > 0 ? totals(x.playoffStats, TEAM_KEYS) : null,
            poll: Number.isInteger(x.poll) && x.poll > 0 ? x.poll : null,
          }))
          .sort((a, b) => a.yr - b.yr),
        ranks: ranks.get(t.id) || null,
        titles:
          t.championships?.league === league.leagueType && Array.isArray(t.championships.yearsWon)
            ? [...t.championships.yearsWon].sort((a, b) => a - b)
            : [],
        roster: (t.roster || []).filter(p => Number.isInteger(p.id)).map(p => p.id),
      });
    }
    return records;
  }

  // The names an article can link, with any name two people share left out so a link is never wrong.
  function nameIndex(records) {
    const byName = new Map();
    const add = (name, target, needsThe = false) => {
      if (!name || name.length < 3) return;
      const key = `${needsThe ? 'the ' : ''}${name}`;
      const seen = byName.get(key);
      byName.set(key, seen && seen.id !== target ? { ambiguous: true } : { id: target, name, needsThe });
    };
    for (const r of records) {
      if (r.kind === 'team') {
        add(r.name, r.id);
        // "the Wranglers" links when no other team in the league shares the nickname.
        if (r.nickname && r.nickname !== r.name) add(r.nickname, r.id, true);
      } else add(r.name, r.id);
    }
    return [...byName.values()].filter(v => !v.ambiguous).map(v => [v.name, v.id, v.needsThe ? 1 : 0]);
  }

  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Splits an article's paragraphs into text and links, linking each person or team the first time they appear.
  function linkParagraphs(paragraphs, index) {
    const entries = [...(index || [])].sort((a, b) => b[0].length - a[0].length);
    if (!entries.length) return paragraphs.map(text => [{ text }]);
    const pattern = new RegExp(
      entries
        .map(
          ([name, , needsThe]) =>
            `${needsThe ? '(?<=\\bthe )' : ''}(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`
        )
        .join('|'),
      'gu'
    );
    const target = new Map(entries.map(([name, id, needsThe]) => [`${needsThe ? 1 : 0}|${name}`, id]));
    const linked = new Set();
    return paragraphs.map(text => {
      const parts = [];
      let at = 0;
      for (const match of text.matchAll(pattern)) {
        const before = text.slice(Math.max(0, match.index - 4), match.index);
        const id = (/\bthe $/.test(before) && target.get(`1|${match[0]}`)) || target.get(`0|${match[0]}`);
        if (!id || linked.has(id)) continue;
        linked.add(id);
        if (match.index > at) parts.push({ text: text.slice(at, match.index) });
        parts.push({ text: match[0], id });
        at = match.index + match[0].length;
      }
      if (at < text.length) parts.push({ text: text.slice(at) });
      return parts;
    });
  }

  return { build, nameIndex, linkParagraphs, profileId };
});
