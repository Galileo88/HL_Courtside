const test = require('node:test'),
  assert = require('node:assert/strict'),
  N = require('../js/newsroom/newsroom.js');
const league = (id, type) => ({ id, name: id, shortName: id.toUpperCase(), leagueType: type });
const story = (id, fingerprint, day, importance = 10, season = 1967) => ({
  id,
  fingerprint,
  day,
  importance,
  season,
  headline: id,
  paragraphs: ['A basketball story. More detail.'],
});
test('mixed editions prioritize each latest day, balance supporting coverage and never repeat stories', () => {
  const stories = [];
  for (const [id, day] of [
    ['pro', 90],
    ['college', 89],
  ])
    for (let i = 0; i < 14; i++) stories.push(story(id + i, id, day - (i > 8 ? 1 : 0), 100 - i));
  stories.push(story('old', 'pro', 80, 140), story('older-year', 'pro', 99, 999, 1966));
  const edition = N.buildEdition({ stories, leagues: [league('pro', 0), league('college', 1)] });
  assert.equal(edition.lead.id, 'college0');
  assert.equal(edition.supporting[0].fingerprint, 'pro');
  const all = [edition.lead, ...edition.supporting, ...edition.headlines, ...edition.sections.flatMap(s => s.items)];
  assert.equal(new Set(all.map(s => s.id)).size, all.length);
  assert.ok(all.every(s => !['old', 'older-year'].includes(s.id)));
  assert.ok(edition.sections.some(s => s.label === 'Pro Basketball'));
  assert.ok(edition.sections.some(s => s.label === 'College Basketball'));
  assert.deepEqual(
    N.buildEdition({ stories: [...stories].reverse(), leagues: [league('pro', 0), league('college', 1)] }).lead,
    edition.lead
  );
  assert.deepEqual(edition.date, { season: 1967, day: 90 });
});
test('the front page is dated by the pro league and a finished college season ranks behind it', () => {
  const stories = [];
  for (const [id, day] of [
    ['pro', 90],
    ['college', 35],
  ])
    for (let i = 0; i < 6; i++) stories.push(story(id + i, id, day, id === 'college' ? 500 : 100 - i));
  const pro = league('pro', 0);
  pro.asOf = { season: 1967, day: 92 };
  const college = league('college', 1);
  college.gameResults = {
    1967: { 34: { 1: { gid: 1, home: { name: 'A', score: 70 }, away: { name: 'B', score: 60 } } } },
  };
  const e = N.buildEdition({ stories, leagues: [college, pro] });
  assert.equal(e.lead.fingerprint, 'pro');
  assert.ok(e.supporting.every(s => s.fingerprint === 'pro'));
  assert.deepEqual(e.date, { season: 1967, day: 92 });
  assert.equal(e.editions.find(x => x.league.id === 'college').stale, true);
  assert.equal(e.editions.find(x => x.league.id === 'college').scoresStale, true);
  assert.ok(e.sections.find(s => s.label === 'College Basketball').items.length);
  // A league page keeps its own date.
  assert.equal(N.buildEdition({ stories, leagues: [college, pro], fingerprint: 'college' }).date.day, 35);
});
test('league editions isolate coverage, use three covered days and latest saved season', () => {
  const stories = [
    story('new', 'p', 90, 1),
    story('back', 'p', 80, 999),
    story('third', 'p', 50, 999),
    story('fourth', 'p', 40, 999),
    story('other', 'c', 99, 999),
    story('prior', 'p', 100, 999, 1966),
  ];
  const e = N.buildEdition({ stories, leagues: [league('p', 0), league('c', 1)], fingerprint: 'p' });
  assert.equal(e.lead.id, 'new');
  assert.deepEqual(
    e.supporting.map(s => s.id),
    ['back', 'third']
  );
  assert.equal(e.editions.length, 1);
});
test('older metadata is inferred conservatively and unavailable images or TV do not exclude stories', () => {
  const p = story('p', 'p', 1);
  p.seasonSnapshot = { leagueType: 0 };
  const unknown = story('u', 'u', 1);
  const e = N.buildEdition({
    stories: [p, unknown],
    leagues: [
      { id: 'p', name: 'Pros' },
      { id: 'u', name: 'Unknown' },
    ],
  });
  assert.equal(e.leagues[0].leagueType, 0);
  assert.equal(e.leagues[1].leagueType, null);
  assert.equal(e.tvStory, null);
  assert.equal(e.supporting.length, 1);
  assert.equal(N.buildEdition({ stories: [], leagues: [] }).lead, null);
});
test('score groups label their own season and latest results day, with recap fallback and no future games', () => {
  const game = { gid: 1, home: { name: 'A', score: 100 }, away: { name: 'B', score: 90 } };
  const p = league('p', 0);
  p.gameResults = { 1967: { 89: { 1: game }, 91: { 2: { home: { name: 'A' }, away: { name: 'B' } } } } };
  const c = story('c', 'c', 15);
  c.gid = 2;
  c.gameSummary = game;
  const e = N.buildEdition({ stories: [story('p', 'p', 90), c], leagues: [p, league('c', 1)] });
  assert.equal(e.editions[0].scoreDay, 89);
  assert.equal(e.editions[1].scoreDay, 15);
  assert.equal(e.editions[0].games.length, 1);
});
test('summaries use rendered prose, keep decimals and cap long sentences', () => {
  assert.equal(
    N.summary(story('a', 'p', 1), ['Alex averaged 31.5 points per game. Another sentence.']),
    'Alex averaged 31.5 points per game.'
  );
  assert.ok(N.summary(story('a', 'p', 1), ['word '.repeat(100)]).length <= 180);
  assert.equal(
    N.summary({ type: 'Regular-season review' }, ['Stars set the pace with 60 wins. More analysis.']),
    'Stars set the pace with 60 wins.'
  );
});

test('one-league sparse editions shorten sections and unknown league routes stay isolated', () => {
  const stories = [story('only', 'p', 2)];
  const leagues = [league('p', 0)];
  const edition = N.buildEdition({ stories, leagues });
  assert.equal(edition.lead.id, 'only');
  assert.deepEqual(edition.supporting, []);
  assert.deepEqual(edition.headlines, []);
  assert.deepEqual(edition.sections, []);
  assert.equal(N.buildEdition({ stories, leagues, fingerprint: '' }).lead, null);
  assert.equal(N.buildEdition({ stories, leagues, fingerprint: 'missing' }).lead, null);
});
test('one kind of story cannot take over the top of the page while other news waits', () => {
  const stories = [];
  for (let i = 0; i < 10; i++) stories.push({ ...story(`ret${i}`, 'p', 5, 120 - i), type: 'Retirement' });
  for (let i = 0; i < 4; i++)
    stories.push({
      ...story(`game${i}`, 'p', 5, 60 - i),
      gid: i + 1,
      gameSummary: { home: { name: 'A', score: 90 }, away: { name: 'B', score: 80 } },
    });
  stories.push(
    { ...story('inj', 'p', 5, 55), type: 'Injury' },
    { ...story('folded', 'p', 5, 200), type: 'Retirement', inRoundup: 'x' }
  );
  const e = N.buildEdition({ stories, leagues: [league('p', 0)] }),
    top = [e.lead, ...e.supporting];
  assert.equal(e.lead.id, 'ret0');
  assert.equal(top.filter(s => N.family(s) === 'farewell').length, 1);
  assert.ok(top.some(s => N.family(s) === 'game'));
  assert.ok(top.some(s => s.id === 'inj'));
  const shown = [...top, ...e.headlines].map(s => s.id);
  assert.ok(['game0', 'game1', 'game2', 'game3', 'inj'].every(id => shown.includes(id)));
  // Caps relax once nothing else is left.
  assert.ok(shown.indexOf('game3') < shown.indexOf('ret3'));
  assert.ok(
    ![e.lead, ...e.supporting, ...e.headlines, ...e.sections.flatMap(s => s.items)].some(s => s.id === 'folded')
  );
});
