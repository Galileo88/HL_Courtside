/* Archive-backed editorial editions; selection never depends on upload time. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HoopWireNewsroom = factory();
})(globalThis, function () {
  'use strict';
  const staleDays = 3,
    ageCost = 30;
  // Story families for variety: no block of the page goes to one kind of news.
  function family(s) {
    const t = s.type || '';
    if (s.performanceSnapshot) return 'performance';
    if (s.gameSummary || (s.gid != null && s.kind !== 'season')) return 'game';
    if (/retire|hall of fame|jersey/i.test(t)) return 'farewell';
    if (/injur/i.test(t)) return 'injury';
    if (/coach/i.test(t)) return 'coaching';
    if (/record|milestone/i.test(t)) return 'record';
    if (/review|leaders/i.test(t)) return 'review';
    if (/sign|free agency|trade|roster|waiv|option|extension|contract/i.test(t)) return 'transaction';
    if (/recruit|commit|draft|offseason|poll|declaration/i.test(t)) return 'pipeline';
    if (/award/i.test(t)) return 'award';
    if (/playoff|championship|snub/i.test(t)) return 'postseason';
    return t || 'other';
  }
  const priority = (a, b) => (b.importance || 0) - (a.importance || 0) || a.id.localeCompare(b.id);
  function leagueInfo(league, stories) {
    const types = [
      ...new Set(
        stories
          .filter(s => s.fingerprint === league.id)
          .map(s => s.seasonSnapshot?.leagueType)
          .filter(t => t === 0 || t === 1)
      ),
    ];
    return {
      ...league,
      leagueType: [0, 1].includes(league.leagueType) ? league.leagueType : types.length === 1 ? types[0] : null,
    };
  }
  function buildEdition({ stories, leagues, fingerprint = null }) {
    const known = new Map(leagues.map(l => [l.id, leagueInfo(l, stories)]));
    const scoped = stories.filter(
      s => known.has(s.fingerprint) && !s.inRoundup && (fingerprint === null || s.fingerprint === fingerprint)
    );
    const editions = [],
      entries = [];
    for (const league of known.values()) {
      const all = scoped.filter(s => s.fingerprint === league.id);
      if (!all.length) continue;
      const season = Math.max(...all.map(s => Number(s.season))),
        current = all.filter(s => Number(s.season) === season);
      const days = [...new Set(current.map(s => s.day))].sort((a, b) => b - a).slice(0, 3);
      const results = league.gameResults?.[season] || {},
        resultDays = Object.keys(results)
          .map(Number)
          .filter(d => Object.values(results[d] || {}).some(validGame))
          .sort((a, b) => b - a);
      let scoreDay = resultDays[0],
        games = scoreDay ? Object.values(results[scoreDay]).filter(validGame) : [];
      if (!games.length) {
        const recaps = current.filter(s => s.gameSummary && validGame(s.gameSummary));
        scoreDay = Math.max(0, ...recaps.map(s => s.day));
        games = [
          ...new Map(
            recaps.filter(s => s.day === scoreDay).map(s => [s.gid, { gid: s.gid, ...s.gameSummary }])
          ).values(),
        ];
      }
      // The save's calendar can run ahead of the last story day.
      const asOf =
        Number(league.asOf?.season) === season && Number(league.asOf?.day) > days[0]
          ? Number(league.asOf.day)
          : days[0];
      editions.push({
        league,
        season,
        day: asOf,
        scoreDay,
        games: games.sort((a, b) => (a.gid || 0) - (b.gid || 0)),
        stale: false,
        scoresStale: false,
      });
      entries.push({ days, candidates: current.filter(s => days.includes(s.day)) });
    }
    // Both leagues share one calendar, and the pro league usually runs longest,
    // so the front page is dated by it. A league that has stopped playing
    // (college after its title game) ranks behind the current day's news.
    const pro = editions.filter(e => e.league.leagueType === 0),
      latest = list =>
        list.reduce((a, b) => (b.season > a.season || (b.season === a.season && b.day > a.day) ? b : a), list[0]);
    const anchor = editions.length ? latest(pro.length ? pro : editions) : null;
    const pool = [];
    editions.forEach((edition, i) => {
      const behind = day =>
        fingerprint === null &&
        edition !== anchor &&
        (edition.season < anchor.season || (edition.season === anchor.season && anchor.day - day > staleDays));
      edition.stale = behind(edition.day);
      // Old finals (a college title game) leave the score strip once the calendar moves on.
      edition.scoresStale = behind(edition.scoreDay || 0);
      for (const story of entries[i].candidates)
        pool.push({
          story,
          offset: entries[i].days.indexOf(story.day) + (edition.stale ? 3 : 0),
          age: edition.stale
            ? edition.season === anchor.season
              ? anchor.day - story.day
              : 365
            : Math.max(0, entries[i].days[0] - story.day),
        });
    });
    // The lead is the freshest day's biggest story. Below it, news value
    // decides, with each day of age costing a little.
    const weight = e => (e.story.importance || 0) - ageCost * e.age;
    pool.sort((a, b) => weight(b) - weight(a) || a.offset - b.offset || priority(a.story, b.story));
    const used = new Set(),
      count = new Map(),
      take = entry => {
        if (!entry) return null;
        used.add(entry.story.id);
        const f = family(entry.story);
        count.set(f, (count.get(f) || 0) + 1);
        return entry.story;
      };
    // Variety: a kind of story can't take over a block while other news waits.
    const next = (ok = () => true, cap = Infinity, counts = count) =>
      pool.find(
        e =>
          !used.has(e.story.id) &&
          ok(e) &&
          (counts.get(family(e.story)) || 0) < (family(e.story) === 'game' ? cap + 1 : cap)
      ) || pool.find(e => !used.has(e.story.id) && ok(e));
    const lead = take(pool.find(e => e.offset === 0) || null);
    const supporting = [];
    if (fingerprint === null && lead) {
      const other = next(e => e.offset < 3 && e.story.fingerprint !== lead.fingerprint, 1);
      if (other && other.offset < 3) supporting.push(take(other));
    }
    while (supporting.length < 3) {
      const e = next(() => true, 1);
      if (!e) break;
      supporting.push(take(e));
    }
    const headlines = [],
      inList = new Map();
    while (headlines.length < 6) {
      const e = next(() => true, 2, inList);
      if (!e) break;
      const f = family(e.story);
      inList.set(f, (inList.get(f) || 0) + 1);
      headlines.push(take(e));
    }
    const sections = [];
    const addSection = (label, filter, limit) => {
      const own = new Map(),
        items = [];
      while (items.length < limit) {
        const e = next(e => filter(e.story), 2, own);
        if (!e) break;
        const f = family(e.story);
        own.set(f, (own.get(f) || 0) + 1);
        items.push(take(e));
      }
      if (items.length) sections.push({ label, items });
    };
    if (fingerprint !== null) addSection(`More from ${known.get(fingerprint)?.name || 'the league'}`, () => true, 8);
    else {
      addSection('Pro Basketball', s => known.get(s.fingerprint)?.leagueType === 0, 4);
      addSection('College Basketball', s => known.get(s.fingerprint)?.leagueType === 1, 4);
      addSection('More coverage', s => known.get(s.fingerprint)?.leagueType == null, 4);
    }
    const tvStory = pool.map(e => e.story).find(s => known.get(s.fingerprint)?.studios?.[s.season]?.imageBlob) || null;
    return {
      lead,
      supporting,
      headlines,
      sections,
      editions,
      date: anchor ? { season: anchor.season, day: anchor.day } : null,
      leagues: [...known.values()],
      tvStory,
      title:
        fingerprint !== null
          ? `${known.get(fingerprint)?.shortName || known.get(fingerprint)?.name || 'League'} News`
          : 'The Daily Wire',
    };
  }
  function validGame(g) {
    return g?.home?.name && g?.away?.name && Number.isFinite(g.home.score) && Number.isFinite(g.away.score);
  }
  function summary(story, paragraphs) {
    const text = (paragraphs || story.paragraphs || []).find(p => typeof p === 'string' && p.trim()) || '';
    const sentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || text;
    return sentence.length > 180 ? sentence.slice(0, 177).replace(/\s+\S*$/, '') + '…' : sentence;
  }
  return { buildEdition, leagueInfo, summary, family };
});
