const test = require('node:test'),
  assert = require('node:assert/strict');
const P = require('../js/coverage/performance-coverage.js'),
  B = require('../js/broadcast/broadcast-content.js'),
  S = require('../js/coverage/season-coverage.js');
// A full-length game: 110-100. Season lines are ten games before tonight plus tonight.
function fixture() {
  const box = (PTS, REB = 4, AST = 2, STL = 1, TO = 2, GS = 1) => ({
    GP: 1,
    GS,
    PTS,
    REB,
    AST,
    STL,
    TO,
    MIN: [1800, 1800, 0, 0, 0, 0],
  });
  const player = (id, tid, fn, game, avg) => ({
    id,
    tid,
    fn,
    ln: fn + 'son',
    gender: 0,
    gameStats: game,
    stats: [
      {
        yr: 8,
        league: 0,
        season: [
          {
            tid,
            GP: 11,
            GS: (avg.GS ?? 1) * 10 + game.GS,
            PTS: avg.PTS * 10 + game.PTS,
            REB: avg.REB * 10 + game.REB,
            AST: avg.AST * 10 + game.AST,
            STL: avg.STL * 10 + game.STL,
            TO: avg.TO * 10 + game.TO,
          },
        ],
      },
    ],
  });
  const usual = { REB: 4, AST: 2, STL: 1, TO: 2 };
  return {
    leagueName: 'Test',
    leagueType: 0,
    season: {
      startingYear: 1,
      currentYear: 8,
      currentDay: 0,
      schedule: [
        {
          results: [
            {
              gId: 1,
              gameType: 0,
              tRound: 0,
              homeTeam: 1,
              awayTeam: 2,
              homeScore: 110,
              awayScore: 100,
              winner: 1,
              potg: 13,
              homeRecord: [8, 3],
              awayRecord: [3, 8],
            },
          ],
        },
      ],
    },
    teams: [
      {
        id: 1,
        city: 'Star City',
        name: 'Stars',
        roster: [
          player(11, 1, 'Alex', box(30), { ...usual, PTS: 12 }), // a regular who breaks out
          player(12, 1, 'Bo', box(10, 4, 2, 1, 2, 0), { ...usual, PTS: 2, GS: 0 }), // deep bench, small average
          player(13, 1, 'Cy', box(70), { ...usual, PTS: 70 }),
        ], // player of the game
        season: [{ yr: 8, seasonStats: { GP: 11, W: 8, L: 3 } }],
      },
      {
        id: 2,
        city: 'Moon Bay',
        name: 'Moons',
        roster: [
          player(21, 2, 'Sam', box(8), { ...usual, PTS: 25 }), // the go-to scorer goes quiet
          player(22, 2, 'Dee', box(3), { ...usual, PTS: 5 }), // a role player's ordinary dip
          player(23, 2, 'Eli', box(89), { ...usual, PTS: 89 }),
        ],
        season: [{ yr: 8, seasonStats: { GP: 11, W: 3, L: 8 } }],
      },
    ],
  };
}
const ids = l =>
  P.candidates(l)
    .map(x => x.story.playerId)
    .sort();
test('coverage goes to breakouts by regulars and quiet nights by go-to scorers, not bench noise', () => {
  const l = fixture(),
    before = JSON.stringify(l),
    rows = P.candidates(l);
  assert.equal(JSON.stringify(l), before);
  assert.deepEqual(ids(l), [11, 21]);
  const alex = rows.find(x => x.story.playerId === 11).story,
    sam = rows.find(x => x.story.playerId === 21).story;
  assert.equal(alex.type, 'Above expectations');
  assert.equal(sam.type, 'Below expectations');
  assert.match(alex.headline, /Alex Alexson (?:pours in 30|erupts for 30|goes for 30)/);
  assert.match(sam.headline, /Quiet night for Sam Samson|Sam Samson limited to 8/);
  assert.match(
    alex.paragraphs[0],
    /Alex Alexson scored 30 points in the Stars' 110-100 win over the Moon Bay Moons, far beyond his usual 12\.0 points per game/
  );
  assert.match(sam.paragraphs[0], /a quiet night for the team's second-leading scorer at 25\.0 points a game/);
  for (const story of [alex, sam]) {
    assert.equal(story.performanceSnapshot.baseline.GP, 10);
    const prose = [story.headline, ...story.paragraphs, ...B.script(story).map(t => t.text)].join(' ');
    assert.doesNotMatch(prose, /%|percent|player of the game|undefined|NaN/i);
    // Every host has a say, and the segment ends on the game, not a promise of more.
    const turns = B.script(story);
    assert.equal(new Set(turns.map(t => t.speaker)).size, 4, story.headline);
    assert.doesNotMatch(turns.at(-1).text, /next topic|moving on/i);
  }
  assert.deepEqual(
    P.candidates(l).map(x => x.story.id),
    rows.map(x => x.story.id)
  );
});
test('a bench breakout needs a line that is news on its own', () => {
  const l = fixture();
  l.teams[0].roster[1].gameStats.PTS = 10;
  assert.ok(!ids(l).includes(12));
  // Thirty-five from the end of the bench is a story anyone would run.
  const big = fixture(),
    bo = big.teams[0].roster[1];
  bo.gameStats.PTS = 35;
  bo.stats[0].season[0].PTS += 25;
  big.teams[0].roster[2].gameStats.PTS -= 25;
  big.teams[0].roster[2].stats[0].season[0].PTS -= 25;
  const story = P.candidates(big).find(x => x.story.playerId === 12)?.story;
  assert.ok(story);
  assert.match(story.headline, /off the bench|sparks bench/);
  assert.match(story.paragraphs.join(' '), /mostly come off the bench this season/);
});
test('one story per team per game keeps the strongest night', () => {
  const l = fixture(),
    bo = l.teams[0].roster[1];
  bo.gameStats.PTS = 35;
  bo.stats[0].season[0].PTS += 25;
  l.teams[0].roster[2].gameStats.PTS -= 25;
  l.teams[0].roster[2].stats[0].season[0].PTS -= 25;
  const stars = P.candidates(l).filter(x => x.story.performanceSnapshot.team.id === 1);
  assert.equal(stars.length, 1);
  assert.equal(stars[0].story.playerId, 12);
});
test('the player of the game belongs to the recap, not a performance story', () => {
  const l = fixture();
  l.season.schedule[0].results[0].potg = 11;
  assert.ok(!ids(l).includes(11));
});
test('turnovers can lead coverage for a starter', () => {
  const l = fixture();
  l.teams[0].roster[0].gameStats.PTS = 12;
  l.teams[0].roster[0].stats[0].season[0].PTS -= 18;
  l.teams[0].roster[2].gameStats.PTS += 18;
  l.teams[0].roster[2].stats[0].season[0].PTS += 18;
  Object.assign(l.teams[0].roster[0].gameStats, { TO: 9 });
  l.teams[0].roster[0].stats[0].season[0].TO += 7;
  const story = P.candidates(l).find(x => x.story.playerId === 11).story;
  assert.equal(story.type, 'Below expectations');
  assert.match(story.headline, /coughs it up 9 times|Turnovers trip up/);
});
test('short games scale the bars without letting tiny counts through', () => {
  const scale = P.leagueScale({}, { completed: [{ game: { tRound: 0, gameType: 0, homeScore: 30, awayScore: 28 } }] });
  assert.ok(scale < 0.3);
  const c = P.compare({ REB: 4 }, { GP: 10, REB: 7 });
  P.judge(c, { REB: 4 }, { scorerRank: 5, reboundRank: 5, starter: false }, scale);
  assert.equal(c[0].qualifies, false, 'four rebounds against a 0.7 average is bench noise');
  const big = P.compare({ PTS: 12 }, { GP: 10, PTS: 40 });
  P.judge(big, { PTS: 12 }, { scorerRank: 1, starter: true }, scale);
  assert.equal(big[0].qualifies, true, 'twelve points from a four-point scorer in a 30-point game is a breakout');
});
test('zero averages and absent or invalid categories never manufacture a comparison', () => {
  assert.deepEqual(P.compare({ PTS: 10 }, { GP: 0, PTS: 10 }), []);
  assert.deepEqual(P.compare({ PTS: -1, REB: NaN }, { GP: 10, PTS: 10, REB: 10 }), []);
  assert.equal(P.average(1 / 30), '0.033');
});
test('first appearances, DNPs, ambiguous games and unverified box scores do not create stories', () => {
  for (const change of [
    l =>
      l.teams.forEach(t =>
        t.roster.forEach(p => {
          p.stats[0].season[0].GP = 3;
        })
      ),
    l => l.teams.forEach(t => (t.roster[0].gameStats.MIN[0] = 0)),
    l => l.teams.forEach(t => (t.roster[0].gameStats.DNP = 1)),
    l => l.season.schedule[0].results.push({ ...l.season.schedule[0].results[0], gId: 2 }),
    l => l.teams.forEach(t => t.roster[0].gameStats.PTS++),
  ]) {
    const l = fixture();
    change(l);
    assert.ok(!ids(l).some(id => [11, 21].includes(id)));
  }
});
test('playoff games compare against the regular season without subtracting playoff totals', () => {
  const l = fixture();
  l.season.schedule[0].results[0].tRound = 1;
  for (const t of l.teams)
    for (const p of t.roster) {
      const s = p.stats[0].season[0],
        g = p.gameStats;
      for (const k of ['GS', 'PTS', 'REB', 'AST', 'STL', 'TO']) s[k] -= g[k];
      s.GP = 10;
    }
  const story = P.candidates(l).find(x => x.story.playerId === 11).story;
  assert.equal(story.performanceSnapshot.baseline.PTS, 120);
  assert.doesNotMatch(story.paragraphs.join(' '), /Those averages/);
});
test('baselines combine team stints and stay fixed when later saves are loaded', () => {
  const l = fixture(),
    p = l.teams[0].roster[0],
    total = p.stats[0].season[0];
  p.stats[0].season = [
    { ...total, GP: 6, PTS: 90, REB: 24, AST: 12, STL: 6, TO: 12, GS: 6 },
    { tid: 99, GP: 5, PTS: 60, REB: 20, AST: 10, STL: 5, TO: 10, GS: 5 },
  ];
  const story = P.candidates(l).find(x => x.story.playerId === 11).story;
  assert.equal(story.performanceSnapshot.baseline.PTS, 120);
  p.stats[0].season[0].PTS += 100;
  const live = S.refreshTVStory(story, l);
  assert.deepEqual(live.performanceSnapshot, story.performanceSnapshot);
  assert.deepEqual(B.script(live), B.script(story));
});
test('daily coverage skips older team games and matches league and year', () => {
  const l = fixture();
  l.teams[0].roster[0].stats.push({ yr: 7, league: 0, season: [{ GP: 10, PTS: 9999, REB: 9999, AST: 9999 }] });
  l.teams[0].roster[0].stats.push({ yr: 8, league: 1, season: [{ GP: 10, PTS: 9999, REB: 9999, AST: 9999 }] });
  assert.equal(P.candidates(l).find(x => x.story.playerId === 11).story.performanceSnapshot.baseline.PTS, 120);
  const g = l.season.schedule[0].results[0];
  l.season.schedule.push({ results: [{ ...g, gId: 2 }] });
  assert.ok(P.candidates(l).every(x => x.story.gid === 2 && x.story.day === 2));
});
test('archived stories from the old percentage rule still play on TV', () => {
  const old = {
    id: 'old',
    playerName: 'Alex Star',
    gameSummary: { home: { name: 'Stars', score: 30 }, away: { name: 'Moons', score: 10 } },
    performanceSnapshot: {
      baseline: { GP: 10, PTS: 200 },
      comparisons: [{ key: 'PTS', label: 'points', actual: 30, expected: 20, favorable: true, qualifies: true }],
    },
  };
  const text = B.script(old)
    .map(t => t.text)
    .join(' ');
  assert.match(text, /Alex Star/);
  assert.match(text, /20\.0/);
  assert.doesNotMatch(text, /undefined|NaN/);
});
test('stories archived under the old rule are judged again: noise leaves, real news is rewritten with its stakes', () => {
  const game = {
      home: { id: 1, name: 'Chattanooga Bridgekeepers', score: 70 },
      away: { id: 2, name: 'Cumberland Kestrels', score: 71 },
    },
    team = { id: 2, city: 'Cumberland', name: 'Kestrels' };
  const old = (name, box, baseline) => ({
    id: name,
    kind: 'performance',
    playerName: name,
    playerStats: box,
    gameSummary: game,
    sceneInputs: { team },
    performanceSnapshot: {
      baseline,
      comparisons: [
        {
          key: 'PTS',
          label: 'points',
          actual: box.PTS,
          expected: baseline.PTS / baseline.GP,
          favorable: false,
          qualifies: true,
        },
      ],
    },
    paragraphs: [
      `${name} has a quiet scoring night, finishing with ${box.PTS} points, compared with a season average of 9.0.`,
    ],
  });
  // Two points from a nine-point scorer was a story under the 50% rule. It isn't news.
  assert.equal(
    P.rejudge(
      old(
        'Sean Cizikas',
        { GP: 1, PTS: 2, REB: 3, AST: 1, STL: 0, TO: 0, FGM: 1, FGA: 4 },
        { GP: 32, PTS: 288, REB: 96, AST: 64, STL: 19, TO: 19 }
      ),
      { playoffs: true, title: true, college: true }
    ),
    null
  );
  const craig = P.rejudge(
    old(
      'Kelly Craig',
      { GP: 1, PTS: 7, REB: 6, AST: 1, STL: 0, TO: 1, FGM: 3, FGA: 12 },
      { GP: 32, PTS: 579, REB: 83, AST: 40, STL: 20, TO: 30 }
    ),
    { playoffs: true, title: true, college: true }
  );
  assert.ok(craig);
  assert.equal(craig.editorialVersion, 4);
  const text = [craig.headline, ...craig.paragraphs, ...B.script(craig).map(t => t.text)].join(' ');
  assert.match(craig.paragraphs[0], /in the national championship game/);
  assert.match(text, /won the national championship, 71-70/);
  assert.match(text, /against (?:the )?Bridgekeepers/);
  assert.doesNotMatch(
    text,
    /against the Chattanooga|also recorded|compared with a season average|The comparison uses|%/
  );
  assert.equal(P.rejudge(craig), craig, 'Current stories pass through untouched');
});
test('playoff performance stories carry the game and round', () => {
  const l = fixture();
  l.season.schedule[0].results[0].tRound = 1;
  l.season.schedule[0].results[0].tId = 0;
  l.season.schedule[0].results[0].homeRecord = [3, 1];
  l.season.schedule[0].results[0].awayRecord = [1, 3];
  const filler = [3, 5, 7].map(id => ({ topSeed: id, lowerSeed: id + 1, firstTo: 4, currentGame: 0, winner: 0 }));
  l.season.playoffs = [
    { yr: 8, rounds: [{ series: [{ topSeed: 1, lowerSeed: 2, firstTo: 4, currentGame: 4, winner: 0 }, ...filler] }] },
  ];
  for (const t of l.teams)
    for (const p of t.roster) {
      const s = p.stats[0].season[0],
        g = p.gameStats;
      for (const k of ['GS', 'PTS', 'REB', 'AST', 'STL', 'TO']) s[k] -= g[k];
      s.GP = 10;
    }
  const story = P.candidates(l).find(x => x.story.playerId === 11).story;
  assert.match(story.paragraphs[0], /in Game 4 of the first round/);
  assert.match(
    B.script(story)
      .map(t => t.text)
      .join(' '),
    /Game 4/
  );
});
module.exports = { fixture };
