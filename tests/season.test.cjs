const { samplePath } = require('./helpers.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict'),
  S = require('../js/coverage/season-coverage.js');
test('regular-season reviews list the top three team records and main rates', () => {
  const names = ['Pittsburgh Riveters', 'Los Angeles Breakers', 'Boston Colonials'],
    records = [
      { GP: 82, W: 64, L: 18, PTS: 8848, OPP: 7462, FGM: 493, FGA: 1000, TPM: 305, TPA: 1000 },
      { GP: 82, W: 64, L: 18, PTS: 9069, OPP: 7700, FGM: 489, FGA: 1000, TPM: 278, TPA: 1000 },
      { GP: 82, W: 62, L: 20, PTS: 8840, OPP: 7905, FGM: 493, FGA: 1000, TPM: 315, TPA: 1000 },
    ];
  const story = {
    type: 'Regular-season review',
    season: 1967,
    relatedTeams: names.map((name, id) => ({ id, name })),
    seasonSnapshot: { teamRecords: records.map((seasonStats, teamId) => ({ teamId, record: { seasonStats } })) },
  };
  const groups = S.seasonReviewLists(story);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 3);
  assert.deepEqual(groups[0].headers, ['Team', 'Record', 'PPG', 'Opp PPG', 'FG%']);
  assert.deepEqual(groups[0].rows[0], ['Pittsburgh Riveters', '64-18', '107.9', '91.0', '49.3%']);
  assert.match(groups[0].items[0], /Pittsburgh Riveters: 64-18.*107\.9 PPG.*91\.0 opp. PPG.*49\.3% FG/);
  assert.match(groups[0].items[1], /Los Angeles Breakers: 64-18.*110\.6 PPG.*93\.9 opp. PPG/);
  assert.match(groups[0].items[2], /Boston Colonials: 62-20.*107\.8 PPG.*96\.4 opp. PPG/);
});
test('year reviews develop the leading teams and qualified players in prose with reference tables', () => {
  const l = fixture();
  l.season.totalGames = 4;
  Object.assign(l.awards[0], { calculation: 0, minGames: 50, PTS: 1 });
  l.teams.push({ ...structuredClone(l.teams[1]), id: 3, name: 'Team 3', roster: [] });
  l.teams.forEach((t, i) => {
    t.season[0].seasonStats = {
      GP: 4,
      W: 4 - i,
      L: i,
      PTS: 400 - i * 20,
      OPP: 300,
      REB: 160,
      AST: 100,
      FGM: 150,
      FGA: 300,
      TPM: 20,
      TPA: 60,
    };
  });
  const player = (id, PTS, GP = 4) => ({
    id,
    tid: 1,
    fn: 'Player',
    ln: String(id),
    awards: id === 1 ? [{ id: 2, league: 0, yearsWon: [0, 1] }] : [],
    stats: [
      {
        league: 0,
        yr: 1,
        season: [
          {
            tid: 1,
            GP,
            PTS,
            REB: 40,
            AST: 32,
            STL: 8,
            BLK: 4,
            TO: 8,
            FGM: 40,
            FGA: 80,
            TPM: 8,
            TPA: 20,
            FTM: 10,
            FTA: 12,
            MIN: [4800],
          },
        ],
      },
    ],
  });
  l.teams[0].roster = [player(1, 160), player(2, 120), player(3, 100), player(4, 90, 1)];
  l.teams[1].roster = [];
  const story = S.candidates(l).find(c => c.story.eventKey === 'regular-wrap').story,
    text = story.paragraphs.join(' ');
  assert.equal(story.paragraphs.length, 4);
  assert.equal(story.editorialVersion, 12);
  assert.equal(story.seasonSnapshot.reviewPlayers.length, 4);
  assert.match(text, /best record|finished level/);
  assert.match(text, /outscored opponents by/);
  assert.ok(story.paragraphs.some(p => p.split(/\s+/).length > 30));
  assert.doesNotMatch(text, /PPG|RPG|APG| · /);
  const groups = S.seasonReviewLists(story);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].items.length, 3);
  assert.deepEqual(groups[1].headers, ['Team', 'Record', 'PPG', 'Opp PPG', 'FG%']);
  assert.deepEqual(groups[1].rows[0], ['Team 1', '4-0', '100.0', '75.0', '50.0%']);
  const archived = structuredClone(story);
  delete archived.seasonSnapshot.reviewPlayers;
  archived.paragraphs = ['Old list.'];
  assert.equal(S.seasonReviewLists(archived).length, 1);
});
test('MVP race uses configured weights, eligibility, total calculation and recorded winner rather than scoring order', () => {
  const p = (name, PTS, REB, GP = 10) => ({
    name,
    position: 0,
    yearsPro: 3,
    s: { GP, PTS, REB, AST: 0, STL: 0, BLK: 0 },
  });
  const snapshot = {
    year: 1967,
    scheduledGames: 10,
    mvpAward: { enabled: true, phase: 0, calculation: 0, minGames: 80, PTS: 1, REB: 3 },
    reviewPlayers: [p('Scorer', 300, 10), p('All-around', 200, 100), p('Third', 150, 50), p('Brief', 1000, 0, 1)],
  };
  assert.deepEqual(
    S.mvpRace(snapshot).map(p => p.name),
    ['All-around', 'Scorer', 'Third']
  );
  snapshot.reviewPlayers[2].mvpWins = [1967];
  assert.equal(S.mvpRace(snapshot)[0].name, 'Third');
  delete snapshot.reviewPlayers[2].mvpWins;
  snapshot.reviewPlayers[1].position = 4;
  snapshot.mvpAward.c = false;
  assert.deepEqual(
    S.mvpRace(snapshot).map(p => p.name),
    ['Scorer', 'Third']
  );
  delete snapshot.mvpAward.c;
  snapshot.mvpAward.calculation = 1;
  snapshot.reviewPlayers[0].s.GP = 8;
  snapshot.reviewPlayers[1].s.PTS = 0;
  snapshot.reviewPlayers[1].s.REB = 100;
  assert.equal(S.mvpRace(snapshot)[0].name, 'Scorer');
  snapshot.mvpAward.calculation = 2;
  assert.deepEqual(S.mvpRace(snapshot), []);
});
test('season review names the configured pro or college award and gives each candidate a real standing', () => {
  const base = {
    season: 1967,
    seasonSnapshot: {
      leagueType: 0,
      teamRecords: [{ teamId: 1, record: { W: 60, L: 20 } }],
      mvpAward: { name: 'Most Valuable Player' },
      reviewPlayers: [
        { name: 'Alex', mvpWins: [], s: { GP: 80, PTS: 2000, REB: 500, AST: 400, FGM: 700, FGA: 1400 } },
        { name: 'Sam', mvpWins: [], s: { GP: 80, PTS: 1900, REB: 900, AST: 200, FGM: 650, FGA: 1300 } },
        { name: 'Pat', mvpWins: [], s: { GP: 80, PTS: 1800, REB: 400, AST: 800, FGM: 600, FGA: 1200 } },
      ],
      mvpAward: { enabled: true, phase: 0, calculation: 0, minGames: 0, PTS: 1 },
      scheduledGames: 80,
    },
    relatedTeams: [{ id: 1, name: 'Stars' }],
  };
  const text = S.seasonReviewArticle(base).join(' ');
  assert.match(
    text,
    /Most Valuable Player race runs through Alex, who averaged 25\.0 points and 6\.3 rebounds per game and has the clearest case/
  );
  assert.match(text, /Sam \(23\.8 points, 11\.3 rebounds\).*round out the Most Valuable Player conversation/);
  base.seasonSnapshot.leagueType = 1;
  delete base.seasonSnapshot.mvpAward.name;
  assert.match(S.seasonReviewArticle(base).join(' '), /Player of the Year/);
  assert.doesNotMatch(S.seasonReviewArticle(base).join(' '), /MVP race|MVP data unavailable/);
});
test('season reviews avoid inventing shooting and comparisons when records are incomplete', () => {
  const story = {
    type: 'Regular-season review',
    relatedTeams: [
      { id: 1, name: 'Stars' },
      { id: 2, name: 'Moons' },
    ],
    seasonSnapshot: {
      teamRecords: [
        { teamId: 1, record: { W: 3, L: 1 } },
        { teamId: 2, record: { W: 2, L: 2 } },
      ],
    },
  };
  const text = S.seasonReviewArticle(story).join(' ');
  assert.match(text, /Stars.*3-1.*Moons.*2-2/);
  assert.doesNotMatch(text, /points|shoot|undefined|NaN/);
  assert.deepEqual(S.seasonReviewArticle({ paragraphs: ['Existing reporting.'] }), ['Existing reporting.']);
});
test('statistical leaders read as a connected article and combine multiple titles', () => {
  const story = {
    season: 1967,
    leagueName: 'UBA',
    seasonSnapshot: {
      rows: [
        ['PTS', 'Halil Simsek', 3843, 90],
        ['REB', 'Joe Simon', 1665, 90],
        ['AST', 'Paul Ball', 1224, 90],
        ['STL', 'Keith Austin', 207, 90],
        ['BLK', 'Joe Simon', 297, 90],
      ],
    },
  };
  const paragraphs = S.leadersArticle(story);
  assert.equal(paragraphs.length, 3);
  assert.match(paragraphs[0], /Halil Simsek.*scoring title.*42\.7 points per game/);
  assert.match(paragraphs[2], /Paul Ball.*13\.6 assists per game/);
  assert.match(paragraphs[1], /Joe Simon swept the rebounding and shot-blocking titles.*18\.5 rebounds.*3\.3 blocks/);
  assert.match(paragraphs[2], /Keith Austin.*2\.3 steals/);
  assert.doesNotMatch(paragraphs.join(' '), /3843|1665|1224|207|297|led the league with/);
});
test('leader reporting discusses each winner without runner-up comparisons', () => {
  const story = {
    season: 1967,
    seasonSnapshot: {
      rows: [
        ['PTS', 'Scorer', 420, 10],
        ['REB', 'Big', 180, 10],
        ['BLK', 'Big', 30, 10],
        ['AST', 'Passer', 130, 10],
        ['STL', 'Guard', 20, 10],
      ],
      leaderProfiles: [
        { name: 'Scorer', s: { GP: 10, PTS: 420, FGM: 150, FGA: 300, REB: 10, AST: 10, STL: 1, BLK: 1 } },
        { name: 'Big', s: { GP: 10, PTS: 200, REB: 180, BLK: 30, AST: 10, STL: 1 } },
        { name: 'Passer', s: { GP: 10, PTS: 100, REB: 10, BLK: 1, AST: 130, TO: 20, STL: 1 } },
        { name: 'Guard', s: { GP: 10, PTS: 300, REB: 100, BLK: 20, AST: 100, STL: 20 } },
      ],
    },
  };
  const text = S.leadersArticle(story).join(' ');
  assert.match(text, /Scorer.*42\.0 points per game.*50\.0% shooting/);
  assert.match(text, /Big.*18\.0 rebounds and 3\.0 blocks/);
  assert.match(text, /20\.0 points a game.*double-double/);
  assert.match(text, /Passer.*13\.0 assists/);
  assert.match(text, /Guard.*2\.0 steals/);
  assert.doesNotMatch(text, /winning margin|gap|next on|runner-up|second place|behind|close race/);
});
test('leader articles preserve shared titles, missing categories and archived fallback', () => {
  const rows = [
    ['AST', 'Alex', 40, 10],
    ['AST', 'Sam', 20, 5],
    ['REB', 'Alex', 50, 10],
    ['BLK', 'Sam', 20, 10],
  ];
  const s = { seasonSnapshot: { rows } };
  const text = S.leadersArticle(s).join(' ');
  assert.match(text, /Alex and Sam shared the lead with 4\.0 assists per game/);
  assert.match(text, /Alex claimed the rebounding title at 5\.0/);
  assert.match(text, /Sam led the league in shot blocking with 2\.0/);
  assert.doesNotMatch(text, /undefined|NaN|points/);
  assert.deepEqual(
    S.leadersArticle({ seasonSnapshot: { rows: [['PTS', 'Alex', 20, 0]] }, paragraphs: ['Original reporting.'] }),
    ['Original reporting.']
  );
});
test('leader prose uses saved age, experience and resolved college without inventing a background', () => {
  const pro = { leagueType: 0, teams: [{ id: 9, city: 'Wrong pro city' }] },
    college = { leagueType: 1, teams: [{ id: 9, city: 'Kansas', name: 'Jayhawks' }] };
  const bio = S.playerBackground({ age: 24, yrs: 3, history: { coll: 9 } }, pro, [pro, college]);
  assert.deepEqual(bio, { age: 24, proSeason: 4, college: 'Kansas' });
  assert.deepEqual(S.playerBackground({ age: 0, yrs: 0, history: { coll: 0 } }, pro, [pro, college]), { proSeason: 1 });
  assert.deepEqual(S.playerBackground({ age: 21, yrs: 3, history: { coll: 9 } }, college, [pro, college]), { age: 21 });
  const story = {
    season: 1967,
    seasonSnapshot: {
      rows: [
        ['PTS', 'Alex', 300, 10],
        ['REB', 'Sam', 120, 10],
        ['AST', 'Pat', 100, 10],
        ['STL', 'Lee', 20, 10],
      ],
      leaderProfiles: [
        { name: 'Alex', position: 1, bio },
        { name: 'Sam', position: 4, bio: { age: 29 } },
        { name: 'Pat', position: 0, bio: { yearsPro: 11, college: 'Duke' } },
        { name: 'Lee', position: 2, bio: { age: 23 } },
        { name: 'Ray', position: 4, bio: { proSeason: 1, college: 'Ohio' } },
      ],
    },
  };
  story.seasonSnapshot.rows.push(['BLK', 'Ray', 30, 10]);
  const text = S.leadersArticle(story).join(' ');
  assert.match(text, /Alex, a fourth-year pro out of Kansas, won/);
  assert.match(text, /Ray, a rookie out of Ohio,/);
  assert.match(text, /Sam, a 29-year-old center, claimed/);
  assert.match(text, /Pat, a 12th-year pro out of Duke,/);
  assert.match(text, /Lee, a 23-year-old small forward, led/);
  assert.doesNotMatch(text, /undefined|NaN|Wrong pro city/);
  const l = fixture(),
    p = l.teams[0].roster[0];
  Object.assign(p, { age: 24, yrs: 3, history: { coll: 9 } });
  p.stats[0].season[0].PTS = 40;
  const generated = S.candidates(l, [l, college]).find(c => c.story.eventKey === 'leaders').story;
  assert.deepEqual(generated.seasonSnapshot.leaderProfiles.find(x => x.name === 'Player 1').bio, bio);
  assert.match(generated.paragraphs.join(' '), /fourth-year pro out of Kansas/);
  p.age = 25;
  assert.equal(generated.seasonSnapshot.leaderProfiles.find(x => x.name === 'Player 1').bio.age, 24);
});
function fixture() {
  return {
    leagueName: 'Test',
    leagueType: 0,
    shortName: 'T',
    season: { startingYear: 1, currentYear: 1, totalGames: 2, schedule: [], playoffs: [] },
    awards: [{ id: 2, name: 'MVP', enabled: true, phase: 0 }],
    teams: [1, 2].map(id => ({
      id,
      name: `Team ${id}`,
      roster: [
        {
          id,
          tid: id,
          fn: 'Player',
          ln: String(id),
          stats: [{ league: 0, yr: 1, season: [{ tid: id, GP: 2, PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0 }] }],
          awards: id === 1 ? [{ id: 2, league: 0, yearsWon: [1] }] : [],
        },
      ],
      season: [{ yr: 1, seasonStats: { GP: 2, W: 1, L: 1 }, seed: id }],
    })),
  };
}
test('repeat wins exclude duplicates, future wins and other leagues, and distinguish streaks', () => {
  const h = S.honorHistory(
    'Alex',
    'the MVP award',
    [
      { league: 0, yearsWon: [1965, 1966, 1967, 1967, 1970] },
      { league: 0, yearsWon: [1966] },
      { league: 1, yearsWon: [1964] },
    ],
    0,
    1967
  );
  assert.deepEqual(h.years, [1965, 1966, 1967]);
  assert.equal(h.count, 3);
  assert.equal(h.streak, 3);
  assert.match(
    S.honorLines({ seasonSnapshot: { honorHistory: h } }).join(' '),
    /third time Alex has won the MVP award, and the third in a row/
  );
  const gap = S.honorHistory('Alex', 'the MVP award', [{ league: 0, yearsWon: [1965, 1967] }], 0, 1967);
  assert.doesNotMatch(S.honorLines({ seasonSnapshot: { honorHistory: gap } }).join(' '), /straight|back-to-back/);
  const two = S.honorHistory('Alex', 'the MVP award', [{ league: 0, yearsWon: [1966, 1967] }], 0, 1967);
  assert.match(S.honorLines({ seasonSnapshot: { honorHistory: two } }).join(' '), /second time.*back-to-back/);
});
test('articles and broadcasts acknowledge repeated awards, leader titles and championships', () => {
  const l = fixture();
  l.season.currentYear = 1967;
  for (const t of l.teams) {
    t.season[0].yr = 1967;
    t.roster[0].stats[0].yr = 1967;
  }
  const p = l.teams[0].roster[0];
  p.stats[0].season[0].PTS = 60;
  p.awards = [
    { id: 2, league: 0, yearsWon: [1965, 1966, 1967] },
    { id: 7, league: 0, yearsWon: [1966, 1967] },
  ];
  l.teams[0].championships = { league: 0, yearsWon: [1965, 1966, 1967] };
  const stories = S.candidates(l).map(c => c.story),
    award = stories.find(s => s.eventKey === 'award-2-1'),
    champion = stories.find(s => s.eventKey === 'championship'),
    leaders = stories.find(s => s.eventKey === 'leaders');
  assert.match(award.paragraphs[0], /third time (?:Player )?1 has won the MVP award, and the third in a row/);
  assert.match(champion.paragraphs[0], /third championship for the Team 1, and the third in a row/);
  assert.match(
    leaders.paragraphs.join(' '),
    /second time (?:Player )?1 has won the scoring title, making it back-to-back/
  );
  const B = require('../js/broadcast/broadcast-content.js');
  assert.match(
    B.script(award)
      .map(t => t.text)
      .join(' '),
    /third time/
  );
  assert.match(
    B.script(champion)
      .map(t => t.text)
      .join(' '),
    /third championship/
  );
  assert.match(
    B.script(leaders)
      .map(t => t.text)
      .join(' '),
    /has won the scoring title, making it back-to-back/
  );
  const old = { ...award, paragraphs: ['Alex wins MVP.'], seasonSnapshot: { ...award.seasonSnapshot } };
  delete old.seasonSnapshot.honorHistory;
  assert.match(S.articleParagraphs(old)[0], /third time/);
  p.awards = p.awards.filter(a => a.id !== 7);
  p.awards.push({ id: 7, league: 0, yearsWon: [1965, 1966] });
  const prior = S.candidates(l).find(c => c.story.eventKey === 'leaders').story;
  assert.match(prior.paragraphs.join(' '), /1 also won the scoring title in 1965 and 1966\./);
  assert.doesNotMatch(prior.paragraphs.join(' '), /scoring title for the third time/);
});
test('regular wraps require every team completed; placeholders do not block finished records', () => {
  let l = fixture();
  assert.ok(S.candidates(l).some(x => x.story.eventKey === 'regular-wrap'));
  l.teams[0].season[0].seasonStats.GP = 1;
  assert.equal(S.candidates(l).length, 0);
});
test('awards require recorded winner, correct league/year and milestone; zero stats and ties survive', () => {
  const l = fixture(),
    c = S.candidates(l);
  assert.equal(c.filter(x => x.story.type === 'Award announcement').length, 1);
  assert.match(
    c.find(x => x.story.type === 'Award announcement').story.paragraphs[1],
    /0\.0 points, 0\.0 rebounds and 0\.0 assists/
  );
  assert.equal(c.find(x => x.story.eventKey === 'leaders').story.seasonSnapshot.rows.length, 10);
  l.teams[0].roster[0].awards[0].league = 1;
  assert.equal(S.candidates(l).filter(x => x.story.type === 'Award announcement').length, 0);
});
test('brackets exclude byes, produce active previews, and crown only confirmed winners', () => {
  const l = fixture();
  l.season.playoffs = [
    {
      yr: 1,
      rounds: [
        {
          series: [
            { topSeed: 1, lowerSeed: 2, firstTo: 1, winner: 0 },
            { topSeed: 1, lowerSeed: 0, winner: 1 },
          ],
        },
      ],
    },
  ];
  assert.equal(S.candidates(l).find(x => x.story.type === 'Playoff preview').story.seasonSnapshot.rows.length, 1);
  l.season.playoffs[0].rounds[0].series.pop();
  l.season.playoffs[0].rounds[0].series[0].winner = 1;
  assert.ok(S.candidates(l).some(x => x.story.eventKey === 'championship'));
  assert.ok(!S.candidates(l).some(x => x.story.type === 'Playoff preview'));
});
test('season totals aggregate transfers but exclude another league/year and playoffs', () => {
  const l = fixture(),
    p = l.teams[0].roster[0];
  p.stats[0].season.push({ GP: 1, PTS: 10, REB: 2, AST: 1 });
  p.stats[0].playoffs = [{ GP: 1, PTS: 99, REB: 99, AST: 99 }];
  p.stats.push({ league: 1, yr: 1, season: [{ GP: 1, PTS: 999, REB: 999, AST: 999 }] });
  assert.deepEqual(S.stats(p, l, 1), { GP: 3, PTS: 10, REB: 2, AST: 1 });
  l.season.currentYear = 2;
  assert.equal(S.candidates(l).length, 0);
});
test('later awards add independent events without changing existing milestone identities', () => {
  const l = fixture(),
    before = S.candidates(l).map(x => x.story.id);
  l.awards.push({ id: 6, name: 'Most Improved', enabled: true, phase: 0 });
  assert.deepEqual(
    S.candidates(l).map(x => x.story.id),
    before
  );
  l.teams[0].roster[0].awards.push({ id: 6, league: 0, yearsWon: [1] });
  const after = S.candidates(l).map(x => x.story.id);
  assert.equal(after.length, before.length + 1);
  assert.ok(before.every(id => after.includes(id)));
});
test('postseason awards wait for a champion and use postseason stats', () => {
  const l = fixture(),
    p = l.teams[0].roster[0];
  l.awards.push({ id: 1, name: 'Finals MVP', enabled: true, phase: 3 });
  p.awards.push({ id: 1, league: 0, yearsWon: [1] });
  p.stats[0].finals = [{ GP: 1, PTS: 27, REB: 0, AST: 0 }];
  assert.ok(!S.candidates(l).some(x => x.story.eventKey === 'award-1-1'));
  l.teams[0].championships = { league: 0, yearsWon: [1] };
  const story = S.candidates(l).find(x => x.story.eventKey === 'award-1-1').story;
  assert.match(story.paragraphs[1], /In the Finals, 1 had 27 points, zero rebounds and zero assists/);
  assert.equal(story.seasonSnapshot.featuredPlayer.finalsStats.PTS, 27);
});

test('team reviews use only that team’s save totals, including traded players', () => {
  const l = fixture(),
    p = l.teams[0].roster[0];
  p.stats[0].season[0].PTS = 10;
  p.stats[0].season.push({ tid: 2, GP: 1, PTS: 90, REB: 3, AST: 2 });
  const story = S.candidates(l).find(x => x.story.eventKey === 'team-1-regular').story;
  const table = story.seasonSnapshot.tables.find(t => t.label === 'Regular-season player statistics');
  assert.equal(table.rows[0][2], '5.0');
  assert.equal(table.rows[0][10], 10);
  assert.match(story.paragraphs.join(' '), /5\.0 points/);
  assert.doesNotMatch(story.paragraphs.join(' '), /first to|across .*regular-season games|saved|recorded/);
});

test('award tables include all league stints while team tables stay team-specific', () => {
  const l = fixture(),
    p = l.teams[0].roster[0];
  p.stats[0].season[0].PTS = 10;
  p.stats[0].season.push({ tid: 2, GP: 1, PTS: 90, REB: 3, AST: 2 });
  const story = S.candidates(l).find(x => x.story.eventKey === 'award-2-1').story;
  const table = story.seasonSnapshot.tables.find(t => t.label === 'Regular-season player statistics');
  assert.equal(table.rows[0][10], 100);
  assert.equal(table.rows[0][1], 3);
});
test('coach and player season quotes reflect winning records and championships', () => {
  const coach = { fn: 'Adrian', ln: 'Hunt' },
    player = { fn: 'Alex', ln: 'Star' };
  for (const wins of [60, 64, 70]) {
    const lines = S.quoteLines('same', { W: wins, L: 82 - wins }, false, coach, player).join(' ');
    assert.match(lines, /great season|great|success|proud|earned/i);
    assert.doesNotMatch(lines, /tough|not good|not enough|fictional|disappoint/i);
  }
  assert.match(S.quoteLines('same', { W: 11, L: 71 }, false, coach, player).join(' '), /tough|not good enough/i);
  assert.match(S.quoteLines('same', { W: 14, L: 18 }, true, coach, player).join(' '), /champion|title/i);
  assert.equal(S.outcome({ W: 41, L: 41 }), 'balanced');
});
test('playoff disappointment overrides regular-season success without confusing champions', () => {
  const coach = { fn: 'Casey', ln: 'Coach' },
    player = { fn: 'Alex', ln: 'Star' };
  const patterns = {
    missed: /standard|did not do enough|playoffs from home|games we let get away/i,
    eliminated: /disappoint|hurts/i,
    runnerup: /hurts|bitter|hard/i,
    injury: /frustrat|hate|disappoint/i,
  };
  for (const result of ['missed', 'eliminated', 'runnerup', 'injury'])
    assert.match(S.quoteLines('test', { W: 60, L: 22 }, false, coach, player, result).join(' '), patterns[result]);
  const teams = new Map([
      [1, {}],
      [2, {}],
      [3, {}],
      [4, {}],
    ]),
    bracket = {
      rounds: [
        {
          series: [
            { topSeed: 1, lowerSeed: 2, winner: 1 },
            { topSeed: 3, lowerSeed: 0, winner: 3 },
          ],
        },
        { series: [{ topSeed: 1, lowerSeed: 3, winner: 1 }] },
      ],
    };
  assert.equal(S.postseasonOutcome(1, bracket, 1, teams), 'champion');
  assert.equal(S.postseasonOutcome(3, bracket, 1, teams), 'runnerup');
  assert.equal(S.postseasonOutcome(2, bracket, 1, teams), 'eliminated');
  assert.equal(S.postseasonOutcome(4, bracket, 1, teams), 'missed');
});
test('individual awards show only the featured player and the relevant stat period', () => {
  const l = fixture();
  const story = S.candidates(l).find(x => x.story.eventKey === 'award-2-1').story;
  const facts = S.factsForStory(story);
  assert.equal(facts.rows.length, 1);
  assert.equal(facts.rows[0][0], 'Player 1');
  assert.ok(!facts.headers.includes('Team'));
  assert.ok(!story.seasonSnapshot.tables.some(t => t.label.includes('team statistics')));
  story.statsPeriod = 'finals';
  story.seasonSnapshot.featuredPlayer.finalsStats = { GP: 2, PTS: 50, REB: 4, AST: 0 };
  assert.equal(S.factsForStory(story).rows[0][2], '25.0');
});
test('62-20 and 64-18 teams still in the playoffs always receive proud season quotes', () => {
  const l = fixture();
  l.season.totalGames = 82;
  l.season.playoffs = [{ yr: 1, rounds: [{ series: [{ topSeed: 1, lowerSeed: 2, winner: 0, firstTo: 4 }] }] }];
  for (const [i, wins] of [62, 64].entries()) {
    l.teams[i].season[0].seasonStats = { GP: 82, W: wins, L: 82 - wins };
    l.teams[i].frontOffice = { staff: [{ id: 100 + i, tid: l.teams[i].id, pos: 1, fn: 'Coach', ln: String(i) }] };
  }
  for (const story of S.candidates(l)
    .filter(x => x.story.eventKey.startsWith('team-'))
    .map(x => x.story)) {
    const quotes = story.paragraphs.filter(p => p.startsWith('“'));
    assert.equal(quotes.length, 2);
    assert.ok(quotes.every(p => /proud|outstanding|tremendous|earned/i.test(p)));
    assert.doesNotMatch(quotes.join(' '), /disappoint|tough|get back to work|fictional|do better|not good enough/i);
  }
  for (let i = 0; i < 50; i++)
    assert.doesNotMatch(
      S.quoteLines(String(i), { W: 62, L: 20 }, false, { fn: 'Coach' }, null).join(' '),
      /disappoint|fictional|do better/i
    );
});

test('playoff previews summarize the round instead of repeating every matchup', () => {
  const teams = [1, 2, 3, 4].map((id, i) => ({ id, name: ['Breakers', 'Flyers', 'Stags', 'Foundry'][i] }));
  const records = [
    { team: teams[0], year: { seasonStats: { GP: 82, W: 64, L: 18, PTS: 9069, OPP: 7954 } } },
    { team: teams[1], year: { seasonStats: { GP: 82, W: 44, L: 38, PTS: 8200, OPP: 7921 } } },
    { team: teams[2], year: { seasonStats: { GP: 82, W: 57, L: 25, PTS: 8249, OPP: 7872 } } },
    { team: teams[3], year: { seasonStats: { GP: 82, W: 53, L: 29, PTS: 8060, OPP: 7946 } } },
  ];
  const lookup = { teams: new Map(teams.map(t => [t.id, t])) };
  const active = [
    { topSeed: 1, lowerSeed: 2, firstTo: 4 },
    { topSeed: 3, lowerSeed: 4, firstTo: 4 },
  ];
  const paragraphs = S.playoffPreviewParagraphs(
    active,
    records,
    lookup,
    { shortName: 'HL', leagueName: 'Hoop League' },
    0
  );
  assert.ok(paragraphs.length <= 3);
  assert.match(paragraphs[0], /postseason opener|matchups/i);
  assert.match(paragraphs.join(' '), /tightest pairing/i);
  assert.match(paragraphs.join(' '), /highest-scoring offense/i);
  assert.doesNotMatch(paragraphs.join(' '), /meet .* in a best-of-7 series.*meet .* in a best-of-7 series/i);
});

test('missed-playoff coach and player quotes have different perspectives', () => {
  const lines = S.quoteLines(
    'missed',
    { W: 40, L: 42 },
    false,
    { fn: 'Tracy', ln: 'Poole' },
    { fn: 'Chester', ln: 'Barnes' },
    'missed'
  );
  assert.equal(lines.length, 2);
  assert.match(lines[0], /standard|record|identity|consistency|all of us/i);
  assert.match(lines[1], /home|summer|games|I have to|next season/i);
  assert.doesNotMatch(lines[0], /watching the playoffs from home|all summer|I have to come back/i);
});

test('award stories stay focused on the winner and coach quotes discuss the winner', () => {
  const l = fixture();
  l.teams[0].frontOffice = { staff: [{ id: 50, tid: 1, pos: 1, fn: 'Tracy', ln: 'Poole' }] };
  const story = S.candidates(l).find(x => x.story.eventKey === 'award-2-1').story;
  const text = story.paragraphs.join(' ');
  const coachLine = story.paragraphs.find(p => /head coach/.test(p));
  assert.match(text, /Player 1/);
  assert.doesNotMatch(text, /playoffs|postseason|standings|missing|record says|regular-season record/i);
  assert.ok(coachLine);
  assert.match(coachLine, /Player\b/);
  assert.match(coachLine, /award|recognition|honor|recognized/i);
});
test('team review headlines add something the record does not already say', () => {
  const save = JSON.parse(require('node:fs').readFileSync(samplePath, 'utf8'));
  const headlines = save.seasonLeagues
    .flatMap(l => S.candidates(l, save.seasonLeagues))
    .filter(x => /^team-.*-regular$/.test(x.story.eventKey))
    .map(x => x.story.headline);
  assert.ok(headlines.length > 0);
  for (const h of headlines) {
    assert.doesNotMatch(h, /winning season|losing season|(?:above|below|over|under) \.500|a winning record/i, h);
    assert.match(h, /review: /);
  }
});
test('a title-game award line shows game totals without games played', () => {
  const story = {
    eventKey: 'award-3-1',
    type: 'Award announcement',
    statsPeriod: 'finals',
    seasonSnapshot: {
      featuredPlayer: {
        name: 'Herman Peterson',
        finalsStats: { GP: 1, PTS: 17, REB: 13, AST: 2, STL: 0, BLK: 0, FGM: 7, FGA: 8, TPM: 0, TPA: 1 },
        regularStats: { GP: 32, PTS: 700, REB: 200, AST: 50, STL: 10, BLK: 5, FGM: 300, FGA: 500, TPM: 5, TPA: 20 },
      },
    },
  };
  const facts = S.factsForStory(story);
  assert.equal(facts.single, true);
  assert.ok(!facts.headers.includes('GP'));
  assert.ok(!facts.headers.includes('PPG'));
  assert.deepEqual(facts.rows[0].slice(0, 4), ['Herman Peterson', 17, 13, 2]);
  assert.equal(facts.rows[0][6], '87.5%');
  // A multi-game Finals line keeps games played and per-game rates.
  story.seasonSnapshot.featuredPlayer.finalsStats = {
    GP: 4,
    PTS: 117,
    REB: 30,
    AST: 3,
    STL: 2,
    BLK: 1,
    FGM: 40,
    FGA: 58,
    TPM: 9,
    TPA: 13,
  };
  const series = S.factsForStory(story);
  assert.ok(series.headers.includes('GP'));
  assert.ok(series.headers.includes('PPG'));
});
test('college seeding snubs compare the bracket seed with the record and name the poll behind it', () => {
  const rows = [
    [24, 8, 15, 16],
    [23, 9, 1, 1],
    [22, 10, 2, 2],
    [21, 11, 3, 3],
    [20, 12, 4, 4],
    [19, 13, 6, 6],
    [18, 14, 7, 7],
    [17, 15, 8, 8],
    [8, 24, 5, 5],
    [16, 16, 9, 9],
  ];
  const teams = rows.map(([W, L, seed, poll], id) => ({
    id: id + 1,
    city: `City${id + 1}`,
    name: `Team${id + 1}`,
    roster: [],
    season: [{ yr: 1969, seed, poll, seasonStats: { GP: 32, W, L } }],
  }));
  teams.push({
    id: 20,
    city: 'Left',
    name: 'Outs',
    roster: [],
    season: [{ yr: 1969, seed: 0, poll: 30, seasonStats: { GP: 32, W: 21, L: 11 } }],
  });
  const series = [];
  for (let i = 0; i < 10; i += 2) series.push({ topSeed: i + 1, lowerSeed: i + 2, firstTo: 1, winner: 0 });
  const league = {
    leagueName: 'College',
    shortName: 'NC',
    leagueType: 1,
    teams,
    season: {
      currentYear: 1969,
      startingYear: 1,
      totalGames: 32,
      schedule: [],
      news: [],
      playoffs: [{ yr: 1969, rounds: [{ series }] }],
    },
  };
  league.season.currentYear = 1969;
  league.season.startingYear = 1969;
  const story = S.candidates(league, [league])
    .map(x => x.story)
    .find(s => s.eventKey === 'seeding-snub');
  assert.ok(story, 'snub story');
  assert.match(story.headline, /24-8 Team1 handed a No\. 15 seed/);
  const text = story.paragraphs.join(' ');
  assert.match(text, /poll never bought in.*No\. 16/);
  assert.match(text, /8-24 and still landed the No\. 5 seed/);
  assert.match(text, /Left Outs \(21-11\) didn't make the field/);
  assert.deepEqual(story.seasonSnapshot.board.headers, ['Team', 'Record', 'Seed', 'Poll']);
  const pro = { ...structuredClone(league), leagueType: 0 };
  assert.ok(!S.candidates(pro, [pro]).some(x => x.story.eventKey === 'seeding-snub'));
  const wrap = S.candidates(league, [league]).find(x => x.story.eventKey === 'regular-wrap')?.story;
  if (wrap) assert.deepEqual(wrap.seasonSnapshot.headers, ['Team', 'W', 'L', 'Seed', 'Poll']);
});
