const test = require('node:test'),
  assert = require('node:assert/strict'),
  R = require('../js/coverage/records-coverage.js');
function fixture() {
  const game = {
    league: 0,
    gameType: 0,
    tRound: 0,
    gId: 10,
    homeTeam: 1,
    awayTeam: 2,
    homeScore: 20,
    awayScore: 8,
    winner: 1,
    potg: 11,
    homeRecord: [6, 4],
    awayRecord: [4, 6],
  };
  const stat = (GP, PTS) => ({ tid: 1, GP, PTS, REB: 0, AST: 0, STL: 0, BLK: 0, TPM: 0 });
  return {
    leagueName: 'Fixture League',
    shortName: 'FL',
    leagueType: 0,
    season: { startingYear: 1, currentYear: 2, totalGames: 30, schedule: [{ results: [game] }] },
    records: { season: { PTS: [{ pid: 11, tid: 1, value: 20, yr: 2, gameResults: game }] } },
    teams: [
      {
        id: 1,
        name: 'Stars',
        roster: [
          {
            id: 11,
            tid: 1,
            fn: 'Alex',
            ln: 'Star',
            gameStats: stat(1, 20),
            careerStats: { seasonHighs: { PTS: 20 } },
            stats: [
              { league: 0, yr: 1, season: [stat(30, 995)] },
              { league: 0, yr: 2, season: [stat(10, 1005)] },
              { league: 1, yr: 1, season: [stat(50, 9999)] },
            ],
          },
        ],
        season: [{ yr: 2, seasonStats: { GP: 10, W: 6, L: 4 } }],
      },
      {
        id: 2,
        name: 'Moons',
        roster: [
          {
            id: 22,
            tid: 2,
            fn: 'Sam',
            ln: 'Moon',
            gameStats: stat(1, 8),
            stats: [
              { league: 0, yr: 1, season: [stat(30, 1100)] },
              { league: 0, yr: 2, season: [stat(10, 100)] },
            ],
          },
        ],
        season: [{ yr: 2, seasonStats: { GP: 10, W: 4, L: 6 } }],
      },
    ],
  };
}
test('routine coverage uses averages while preserving league-scoped totals as evidence', () => {
  const l = fixture(),
    p = l.teams[0].roster[0];
  assert.equal(R.history(p, l).PTS, 2000);
  const s = R.enrich({ playerId: 11, gid: 10, paragraphs: [] }, l);
  assert.equal(s.cumulativeStats.season.PTS, 1005);
  assert.equal(s.cumulativeStats.career.PTS, 2000);
  assert.match(s.paragraphs.join(' '), /100\.5 points.*per game/);
  assert.doesNotMatch(s.paragraphs.join(' '), /1005|2000|season totals|career/);
});
test('verified game detects crossing, personal best and single-game league/team marks', () => {
  const rows = R.candidates(fixture()),
    s = rows.find(x => x.story.type === 'Milestone').story;
  assert.match(s.paragraphs.join(' '), /1,000/);
  assert.match(s.paragraphs.join(' '), /2,000/);
  assert.match(s.paragraphs.join(' '), /set a regular-season career high with 20 points/);
  assert.ok(s.seasonSnapshot.evidence.some(e => e.label === 'League game record: points'));
  assert.ok(s.seasonSnapshot.evidence.some(e => e.label === 'Team player game record: points'));
  const ev = s.seasonSnapshot.evidence,
    mark = ev.find(e => e.mark),
    high = ev.find(e => /^Career game high/.test(e.label));
  assert.equal(mark.stat, 'PTS');
  assert.ok(mark.value - mark.before > 0);
  assert.ok(Number.isFinite(high.average));
  assert.ok(Number.isInteger(s.seasonSnapshot.pid));
  assert.ok(Number.isInteger(s.seasonSnapshot.gid));
});
test('single-game record survives unavailable full box score without inventing POTG or other stats', () => {
  const l = fixture();
  l.teams[0].roster[0].gameStats.PTS = 19;
  const s = R.candidates(l).find(x => x.story.type === 'Single-game record').story;
  assert.match(s.headline, /20 points/);
  assert.doesNotMatch(s.paragraphs.join(' '), /player of the game|rebounds|assists/);
  assert.ok(!R.candidates(l).some(x => x.story.type === 'Milestone'));
});
test('watch is bounded, regular-season only and has stable identity across repeated uploads', () => {
  const l = fixture();
  l.teams[0].roster[0].stats[1].season[0].PTS = 1090;
  const first = R.candidates(l).filter(x => x.story.type === 'Record watch');
  assert.ok(first.some(x => x.story.paragraphs[0].includes('10 points shy')));
  assert.ok(
    first.some(x =>
      /^Alex Star is now only 10 points shy of the FL single-season record, 1,100, set by Sam Moon in 1\.$/.test(
        x.story.paragraphs[0]
      )
    )
  );
  assert.deepEqual(
    first.map(x => x.story.id),
    R.candidates(l)
      .filter(x => x.story.type === 'Record watch')
      .map(x => x.story.id)
  );
  l.teams[0].season[0].seasonStats.GP = 30;
  assert.ok(!R.candidates(l).some(x => x.story.eventKey.startsWith('watch-season')));
});
test('team season low requires complete schedule; highs do not imply personal lows', () => {
  const l = fixture(),
    g = l.season.schedule[0].results[0];
  l.season.schedule = [50, 55, 60, 45, 40, 20].map((score, i) => ({
    results: [{ ...g, gId: i + 1, homeScore: score }],
  }));
  l.teams[0].season[0].seasonStats.GP = 6;
  assert.ok(R.candidates(l).some(x => x.story.eventKey === 'team-scoring-low-1-6'));
  l.teams[0].season[0].seasonStats.GP = 7;
  assert.ok(!R.candidates(l).some(x => x.story.type === 'Team record'));
  assert.ok(!R.candidates(l).some(x => /career low/.test(x.story.paragraphs.join(' '))));
});
test('placeholder and wrong-league record entries cannot create record stories', () => {
  const l = fixture();
  l.records.season.PTS[0].gameResults = { ...l.records.season.PTS[0].gameResults, league: 1 };
  l.teams[0].roster[0].gameStats.PTS = 19;
  assert.ok(!R.candidates(l).some(x => x.story.type === 'Single-game record'));
  l.records.season.PTS[0].gameResults = {
    league: 0,
    gId: 10,
    homeTeam: 1,
    awayTeam: 2,
    homeScore: 0,
    awayScore: 0,
    winner: 0,
  };
  assert.ok(!R.candidates(l).some(x => x.story.type === 'Single-game record'));
});
test('empty years do not erase retired players career totals', () => {
  const l = fixture(),
    p = l.teams[0].roster[0];
  p.stats.push({ league: 0, yr: 0, season: [{ GP: 0, PTS: 0, REB: 0, AST: 0 }] });
  assert.equal(R.history(p, l).PTS, 2000);
});
test('a career record held by a retiree says when they retired; active holders still hold it', () => {
  const l = fixture();
  l.retirees = [
    {
      id: 99,
      tid: 0,
      fn: 'Old',
      ln: 'Timer',
      stats: [{ league: 0, yr: 1, season: [{ tid: 1, GP: 20, PTS: 2050, REB: 0, AST: 0, STL: 0, BLK: 0, TPM: 0 }] }],
    },
  ];
  const watch = R.candidates(l)
    .filter(x => x.story.type === 'Record watch')
    .map(x => x.story.paragraphs[0])
    .find(p => /career record/.test(p));
  assert.match(
    watch,
    /^Alex Star is now only 50 points shy of the FL career record, 2,050, set by Old Timer, who retired in 1\.$/
  );
  // The same league as a college one: its players graduate.
  const swap = () => {
    for (const t of l.teams) for (const p of t.roster) for (const st of p.stats) st.league = 1 - st.league;
    l.retirees[0].stats[0].league = 1 - l.retirees[0].stats[0].league;
    l.season.schedule[0].results[0].league = 1 - l.season.schedule[0].results[0].league;
    l.leagueType = 1 - l.leagueType;
  };
  swap();
  const college = R.candidates(l)
    .filter(x => x.story.type === 'Record watch')
    .map(x => x.story.paragraphs[0])
    .find(p => /career record/.test(p));
  assert.match(college, /set by Old Timer, who graduated in 1\.$/);
  swap();
  l.retirees = [];
  l.teams[1].roster[0].stats.push({
    league: 0,
    yr: 2,
    season: [{ tid: 2, GP: 1, PTS: 1050, REB: 0, AST: 0, STL: 0, BLK: 0, TPM: 0 }],
  });
  const held = R.candidates(l)
    .filter(x => x.story.type === 'Record watch')
    .map(x => x.story.paragraphs[0])
    .find(p => /career record/.test(p));
  if (held) assert.match(held, /held by Sam Moon\.$/);
});
