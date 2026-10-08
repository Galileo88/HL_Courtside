const test = require('node:test'),
  assert = require('node:assert/strict');
const C = require('../core'),
  S = require('../season-coverage'),
  B = require('../broadcast-content');
function fixture() {
  const league = {
    leagueName: 'Current League',
    leagueType: 0,
    season: { currentYear: 1, startingYear: 1, schedule: [] },
    teams: [
      {
        id: 1,
        name: 'Stars',
        roster: [
          {
            id: 7,
            fn: 'Alex',
            ln: 'Star',
            tid: 1,
            stats: [
              {
                league: 0,
                yr: 1,
                season: [{ GP: 20, PTS: 500, REB: 200, AST: 100 }],
                playoffs: [{ GP: 5, PTS: 150, REB: 60, AST: 35 }],
                finals: [{ GP: 2, PTS: 64, REB: 20, AST: 14 }],
              },
            ],
          },
        ],
      },
    ],
  };
  const story = {
    id: 'old-award',
    kind: 'season',
    fingerprint: C.buildFingerprint(league),
    season: 1,
    day: 3,
    type: 'Award announcement',
    eventKey: 'award-99999-7',
    headline: 'Alex Star wins Most Outstanding Player',
    statsPeriod: 'finals',
    seasonSnapshot: {
      rows: [['Most Outstanding Player', 'Alex Star']],
      featuredPlayer: {
        id: 7,
        name: 'Alex Star',
        regularStats: { GP: 1, PTS: 10, REB: 1, AST: 1 },
        playoffStats: { GP: 1, PTS: 13, REB: 11, AST: 1 },
        finalsStats: { GP: 1, PTS: 13, REB: 11, AST: 1 },
      },
    },
  };
  return { story, league };
}
test('TV cards and dialogue both use the loaded save and relevant period', () => {
  const { story, league } = fixture(),
    before = JSON.stringify({ story, league }),
    live = S.refreshTVStory(story, league);
  const facts = S.factsForStory(live),
    text = B.script(live)
      .map(t => t.text)
      .join(' ');
  assert.equal(facts.rows[0][facts.headers.indexOf('GP')], 2);
  assert.equal(facts.rows[0][facts.headers.indexOf('PPG')], '32.0');
  assert.match(text, /32\.0 points and 7\.0 assists.*postseason/);
  assert.doesNotMatch(text, /13\.0 points/);
  assert.equal(JSON.stringify({ story, league }), before);
});
test('regular-season awards use live season totals; playoff tables use live playoff totals', () => {
  const { story, league } = fixture();
  delete story.statsPeriod;
  const regular = S.refreshTVStory(story, league);
  assert.equal(S.featuredStatsForStory(regular).PTS, 500);
  assert.match(
    B.script(regular)
      .map(t => t.text)
      .join(' '),
    /25\.0 points and 5\.0 assists/
  );
  story.seasonSnapshot.tables = [{ label: 'Playoff player statistics' }];
  const playoffs = S.refreshTVStory(story, league);
  assert.equal(S.featuredStatsForStory(playoffs).GP, 5);
  assert.equal(S.factsForStory(playoffs).rows[0][2], '30.0');
  assert.match(
    B.script(playoffs)
      .map(t => t.text)
      .join(' '),
    /30\.0 points and 7\.0 assists.*postseason/
  );
});
test('without a matching save, TV uses archived evidence without modifying it', () => {
  const { story, league } = fixture();
  for (const source of [
    null,
    { ...league, leagueName: 'Another League' },
    { ...league, season: { ...league.season, currentYear: 2 } },
  ]) {
    const live = S.refreshTVStory(story, source);
    assert.deepEqual(live, story);
    assert.notEqual(live, story);
    assert.match(
      B.script(live)
        .map(t => t.text)
        .join(' '),
      /13\.0 points and 1\.0 assists/
    );
  }
});
test('missing live postseason statistics do not silently reuse stale archive values', () => {
  const { story, league } = fixture(),
    player = league.teams[0].roster[0];
  delete player.stats[0].finals;
  delete player.stats[0].playoffs;
  const live = S.refreshTVStory(story, league);
  assert.equal(S.featuredStatsForStory(live), null);
  assert.doesNotMatch(
    B.script(live)
      .map(t => t.text)
      .join(' '),
    /13\.0 points|25\.0 points/
  );
});
