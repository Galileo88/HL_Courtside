/* Evidence the TV desk may cite at playback: results, streaks, series and stakes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HoopWireBroadcastContext = factory();
})(globalThis, function () {
  'use strict';
  const record = r => Array.isArray(r) && r.length === 2 && r.every(n => Number.isInteger(n) && n >= 0);
  const same = (a, b) => record(a) && record(b) && a.every((n, i) => n === b[i]);
  const result = g =>
    g?.home?.id != null &&
    g?.away?.id != null &&
    g.home.id !== g.away.id &&
    [g.home.score, g.away.score].every(n => Number.isFinite(n) && n >= 0) &&
    g.home.score !== g.away.score;
  const matches = (a, b) =>
    result(a) && result(b) && ['home', 'away'].every(k => a[k].id === b[k].id && a[k].score === b[k].score);
  function enrichResult(previous, source) {
    if (previous && !matches(previous, source)) return structuredClone(previous);
    const next = structuredClone(previous || source);
    for (const k of ['homeRecord', 'awayRecord']) if (record(source[k])) next[k] = [...source[k]];
    for (const k of ['gameType', 'tRound']) if (Number.isInteger(source[k]) && source[k] >= 0) next[k] = source[k];
    return next;
  }
  function teamResult(g, tid) {
    const side = g.home.id === tid ? 'home' : g.away.id === tid ? 'away' : null;
    if (!side) return null;
    const other = side === 'home' ? 'away' : 'home',
      won = g[side].score > g[other].score,
      post = g[side + 'Record'];
    if (!record(post) || post[won ? 0 : 1] < 1) return null;
    const pre = [...post];
    pre[won ? 0 : 1]--;
    const period = g.tRound > 0 ? 'playoffs' : g.gameType === 0 ? 'season' : null;
    return { day: g.day, gid: g.gid, won, pre, post, period, opponent: g[other].name };
  }
  function teamHistory(current, tid, games) {
    const now = teamResult(current, tid);
    if (!now || !now.period) return null;
    const candidates = games.filter(g => g.gid !== current.gid && (g.home.id === tid || g.away.id === tid));
    // A game ID is an identity, not proof of its order within a day.
    if (candidates.some(g => g.day === current.day)) return null;
    const recent = [],
      usedDays = new Set();
    let expected = now.pre;
    for (const g of candidates.filter(g => g.day < current.day).sort((a, b) => b.day - a.day)) {
      if (usedDays.has(g.day) || candidates.filter(x => x.day === g.day).length > 1) break;
      usedDays.add(g.day);
      const entry = teamResult(g, tid);
      if (!entry || entry.period !== now.period || !same(entry.post, expected)) break;
      recent.push(entry);
      expected = entry.pre;
    }
    let before = 0;
    const prior = recent[0]?.won;
    for (const entry of recent) {
      if (entry.won !== prior) break;
      before++;
    }
    const bounded = before < recent.length || same(expected, [0, 0]);
    // Without the preceding opposite result or the season origin, an exact
    // streak could be longer than the available archive suggests.
    return {
      recent,
      streak: bounded
        ? {
            won: now.won,
            length: prior === now.won ? before + 1 : 1,
            ended: prior !== undefined && prior !== now.won ? { won: prior, length: before } : null,
          }
        : null,
    };
  }
  function buildContext(story, { league, stories = [], snapshots = [] } = {}) {
    if (!story) return {};
    const scoped = s =>
      s.fingerprint === story.fingerprint &&
      String(s.season) === String(story.season) &&
      Number.isInteger(s.day) &&
      s.day >= 1 &&
      s.day <= story.day;
    const games = new Map();
    if (league && league.id === story.fingerprint) {
      for (const [day, entries] of Object.entries(league.gameResults?.[story.season] || {})) {
        if (!Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > story.day) continue;
        for (const g of Object.values(entries))
          if (result(g)) games.set(g.gid, { ...structuredClone(g), day: Number(day) });
      }
    }
    for (const s of stories.filter(scoped))
      if (result(s.gameSummary) && !games.has(s.gid))
        games.set(s.gid, { ...structuredClone(s.gameSummary), gid: s.gid, day: s.day });
    const current = games.get(story.gid);
    const context = {
      asOfDay: story.day,
      teams: {},
      snapshots: snapshots.filter(s => scoped(s) && s.gid === story.gid).map(s => structuredClone(s)),
    };
    if (current && current.day === story.day && matches(current, story.gameSummary)) {
      context.game = current;
      for (const side of ['home', 'away'])
        context.teams[current[side].id] = teamHistory(current, current[side].id, [...games.values()]);
      const winner = current.home.score > current.away.score ? current.home.id : current.away.id;
      // A native championship announcement explicitly attached to this game
      // can establish its consequence. A championship on a later day cannot.
      const title = stories
        .filter(scoped)
        .find(
          s =>
            s.day === story.day &&
            s.seasonSnapshot?.newsEvent?.type === 13 &&
            s.seasonSnapshot.newsEvent.date + 1 === story.day &&
            s.seasonSnapshot.newsEvent.gid === story.gid &&
            s.seasonSnapshot.newsEvent.tid === winner
        );
      if (title) context.consequence = { verified: true, kind: 'championship', source: title.id };
    }
    const dated = story.broadcastSnapshot;
    if (
      dated &&
      scoped(dated) &&
      dated.day === story.day &&
      dated.playerId === story.playerId &&
      Number.isInteger(dated.average?.GP) &&
      dated.average.GP > 0 &&
      ['season', 'playoffs'].includes(dated.period) &&
      Number.isFinite(dated.average.PTS) &&
      dated.average.PTS >= 0
    )
      context.average = structuredClone(dated);
    return context;
  }
  return { buildContext, enrichResult, record };
});
