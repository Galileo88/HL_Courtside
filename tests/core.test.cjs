const { samplePath } = require('./helpers.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../js/coverage/core.js');
function league() {
  const stats = (PTS, REB = 0, AST = 0) => ({
    GP: 1,
    PTS,
    REB,
    AST,
    STL: 1,
    BLK: 0,
    FGM: 4,
    FGA: 7,
    TPM: 0,
    TPA: 2,
    FTM: 2,
    FTA: 2,
  });
  return {
    leagueName: 'Test League',
    teams: [
      {
        id: 1,
        name: 'Stars',
        shortName: 'STA',
        roster: [{ id: 11, tid: 1, fn: 'Alex', ln: 'Star', num: 7, gameStats: stats(10) }],
      },
      {
        id: 2,
        name: 'Moons',
        shortName: 'MOO',
        roster: [{ id: 22, tid: 2, fn: 'Sam', ln: 'Moon', num: 9, gameStats: stats(8) }],
      },
    ],
    season: {
      startingYear: 2026,
      currentYear: 2026,
      currentDay: 3,
      schedule: [
        { results: [] },
        {
          results: [
            {
              gId: 1,
              homeTeam: 1,
              awayTeam: 2,
              homeScore: 10,
              awayScore: 8,
              winner: 1,
              potg: 11,
              homeRecord: [1, 0],
              awayRecord: [0, 1],
            },
          ],
        },
        { results: [{ gId: 2, homeTeam: 1, awayTeam: 2, homeScore: 0, awayScore: 0, winner: 0, potg: 0 }] },
      ],
    },
  };
}
function context(l) {
  const fp = C.buildFingerprint(l),
    snaps = C.captureSnapshots(l, fp);
  return C.candidates(l, fp, new Map(snaps.map(s => [s.id, s])), 'full')[0];
}
test('completion excludes placeholders, invalid winners, ties, invalid teams and live games', () => {
  const l = league(),
    look = C.buildLookups(l),
    g = l.season.schedule[1].results[0];
  assert.equal(look.latestDay, 1);
  assert.equal(look.completed.length, 1);
  for (const patch of [
    { winner: 2 },
    { winner: 0 },
    { homeScore: 8 },
    { awayTeam: 99 },
    { awayTeam: 1 },
    { homeScore: -1 },
  ])
    assert.equal(C.isCompleted({ ...g, ...patch }, look.teams), false);
  assert.equal(C.isCompleted(g, look.teams, { gId: 1, inProgress: true }), false);
});
test('verified award coverage retains zeros and shooting stats with or without quotes', () => {
  const l = league(),
    ctx = context(l);
  assert.ok(ctx.potgStatsTrusted);
  for (const quotes of [false, true]) {
    const story = C.generateArticle(ctx, C.buildFingerprint(l), quotes);
    const text = story.paragraphs.join(' ');
    assert.match(story.paragraphs[0], /Alex Star scored 10 points.*Stars.*10-8/);
    assert.match(text, /4-of-7 shooting/);
    assert.match(story.headline, /Stars .*Moons 10-8/);
    assert.equal(
      story.paragraphs.some(p => p.includes('said.')),
      quotes
    );
  }
});
test('unavailable stats never produce award claims or player quotes/headlines', () => {
  const l = league();
  l.teams[0].roster[0].gameStats.PTS = 9;
  const ctx = context(l),
    story = C.generateArticle(ctx, C.buildFingerprint(l), true);
  assert.equal(ctx.potgStatsTrusted, false);
  assert.doesNotMatch(story.headline + ' ' + story.paragraphs.join(' '), /Alex|Star said|player.of.the.game|said\./i);
  assert.equal(story.playerStats, null);
});
test('ambiguous multiple games on one day do not capture player stats', () => {
  const l = league();
  l.season.schedule[1].results.push({ ...l.season.schedule[1].results[0], gId: 3 });
  assert.equal(C.captureSnapshots(l).length, 0);
});
test('a live game prevents matching its partial player stats to the previous final result', () => {
  const l = league();
  l.currentGame = { gId: 2, inProgress: true, homeTeam: 1, roadTeam: 2 };
  assert.equal(C.captureSnapshots(l).length, 0);
});
test('a losing-side award recipient does not get a fictional victory quote', () => {
  const l = league();
  l.season.schedule[1].results[0].potg = 22;
  const ctx = context(l),
    story = C.generateArticle(ctx, C.buildFingerprint(l), true);
  assert.ok(story.playerStats);
  assert.match(story.paragraphs.join(' '), /Sam Moon was the best player on the floor in a losing effort/);
  assert.doesNotMatch(story.paragraphs.join(' '), /said\./);
  assert.doesNotMatch(story.headline, /Moon\b(?!s)/);
});
test('head coach identity comes from the team staff and quotes honor the quote toggle', () => {
  const l = league();
  l.teams[0].frontOffice = {
    staff: [
      { id: 100, tid: 1, pos: 1, fn: 'Dana', ln: 'Coach', appearance: {}, suits: [] },
      { id: 101, tid: 1, pos: 2, fn: 'Other', ln: 'Staff' },
    ],
  };
  const ctx = context(l),
    fp = C.buildFingerprint(l);
  assert.equal(ctx.coach.id, 100);
  assert.match(C.generateArticle(ctx, fp, true).paragraphs.at(-1), /^“.+,” Stars coach Dana Coach said\./);
  assert.doesNotMatch(C.generateArticle(ctx, fp, false).paragraphs.join(' '), /said/);
  l.teams[0].frontOffice.staff.push({ id: 102, tid: 1, pos: 1, fn: 'Duplicate', ln: 'Coach' });
  assert.equal(C.coachForTeam(l.teams[0]), null);
});
test('old snapshots survive later stats and only the latest completed day is eligible', () => {
  const l = league(),
    fp = C.buildFingerprint(l),
    snaps = C.captureSnapshots(l, fp);
  const saved = new Map(snaps.map(s => [s.id, s]));
  l.season.schedule[2].results = [{ ...l.season.schedule[1].results[0], gId: 2, homeScore: 12 }];
  l.teams[0].roster[0].gameStats.PTS = 12;
  assert.equal(C.candidates(l, fp, saved, 'full')[0].dayNumber, 3);
  assert.equal(saved.get(C.snapshotId(fp, 2026, 1, 11)).stats.PTS, 10);
  assert.equal(C.candidates(l, fp, saved, 'full')[0].potgStatsTrusted, false);
});
test('identities separate seasons and leagues and upgrade only current template team recaps', () => {
  const l = league(),
    ctx = context(l),
    fp = C.buildFingerprint(l);
  assert.notEqual(C.storyId(fp, 2026, 1), C.storyId(fp, 2027, 1));
  const other = structuredClone(l);
  other.leagueName = 'Other';
  assert.notEqual(fp, C.buildFingerprint(other));
  assert.equal(C.shouldGenerate({ templateVersion: 3, playerStats: null }, ctx), true);
  assert.equal(C.shouldGenerate({ templateVersion: 2 }, ctx), false);
  assert.equal(C.shouldGenerate({ templateVersion: 3, playerStats: ctx.potgStats }, ctx), true, 'older prose upgrades');
  assert.equal(C.shouldGenerate({ templateVersion: 3, editorialVersion: 2, playerStats: ctx.potgStats }, ctx), false);
});
test('sample save selects Day 33 in both leagues and verifies every latest-day award recipient', () => {
  const save = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  const counts = [];
  for (const l of save.seasonLeagues) {
    const fp = C.buildFingerprint(l),
      snaps = C.captureSnapshots(l, fp);
    const contexts = C.candidates(l, fp, new Map(snaps.map(s => [s.id, s])), 'full');
    assert.equal(C.buildLookups(l).latestDay, 32);
    assert.ok(contexts.every(ctx => ctx.potgStatsTrusted));
    counts.push(contexts.length);
  }
  assert.deepEqual(counts, [3, 14]);
});
test('recaps read like wire copy: short references, AP numbers and box-score context', () => {
  const l = league(),
    fp = C.buildFingerprint(l);
  l.teams[0].city = 'Logan';
  l.teams[0].name = 'Wolverines';
  l.teams[1].city = 'Tucson';
  l.teams[1].name = 'Cactus';
  l.teams[0].roster.push({
    id: 12,
    tid: 1,
    fn: 'Clyde',
    ln: 'Pearson',
    gameStats: { GP: 1, GS: 0, PTS: 0, REB: 6, AST: 1, STL: 0, BLK: 0, FGM: 0, FGA: 3, TPM: 0, TPA: 0, FTM: 0, FTA: 0 },
  });
  const story = C.generateArticle(context(l), fp, true),
    text = story.paragraphs.join(' ');
  assert.match(story.paragraphs[0], /the Logan Wolverines (?:beat|edged|slipped past) the Tucson Cactus 10-8/);
  assert.match(text, /Logan (?:improved|moved above)/);
  assert.doesNotMatch(text.replace(story.paragraphs[0], ''), /Logan Wolverines/);
  assert.match(story.headline, /^Wolverines (?:edge|slip past|get past) Cactus/);
  assert.match(text, /“[^”]+,” Star said\./);
  assert.doesNotMatch(text, /undefined|NaN|buzzer|comeback|rallied|held on|survived/);
  assert.equal(C.teamRef({ name: 'Tucson Cactus' }).plural, false);
  assert.equal(C.verb(C.teamRef({ name: 'Logan Wolverines' }), 'beat'), 'beat');
  assert.equal(C.verb(C.teamRef({ name: 'Thunder' }), 'beat'), 'beats');
  assert.equal(C.num(7), 'seven');
  assert.equal(C.num(12), '12');
  assert.equal(C.gamesBetter([21, 8], [16, 13]), 'five games');
  assert.equal(C.gamesBetter([21, 8], [20, 8]), 'a half-game');
});
module.exports = { league };
test('positions read on the save 0-8 scale, with hybrids between the five positions', () => {
  assert.equal(C.positionName(0), 'point guard');
  assert.equal(C.positionName(3), 'wing');
  assert.equal(C.positionName(4), 'small forward');
  assert.equal(C.positionName(8), 'center');
  assert.equal(C.positionName(9), '');
  assert.equal(C.positionName('PG'), '');
  assert.deepEqual(C.positionKeys(2), ['sg']);
  assert.deepEqual(C.positionKeys(7), ['pf', 'c']);
  assert.deepEqual(C.positionKeys(null), []);
});
test('a Hoop League Studio ID in the commissioner tag is the league identity, and a pinned archive wins', () => {
  const league = {
    leagueName: 'Hoop League',
    season: { startingYear: 2026 },
    commissioner: { tag: 'hoopwire:HW-a10d6139c4b6' },
    teams: [{ id: 1, name: 'A' }],
  };
  const expanded = { ...league, teams: [...league.teams, { id: 2, name: 'Expansion' }] };
  assert.equal(C.leagueId(league), 'hw-a10d6139c4b6');
  assert.equal(C.buildFingerprint(league), 'hw-a10d6139c4b6');
  assert.equal(C.buildFingerprint(expanded), C.buildFingerprint(league));
  assert.equal(C.buildFingerprint({ ...expanded, archiveId: 'kept' }), 'kept');
  for (const tag of ['', 'Railers', 'hoopwire:', 'hoopwire:hw-1 extra'])
    assert.equal(C.leagueId({ ...league, commissioner: { tag } }), null);
  assert.equal(C.leagueId({ ...league, commissioner: undefined }), null);
  assert.notEqual(
    C.buildFingerprint({ ...league, commissioner: null }),
    C.buildFingerprint({ ...expanded, commissioner: null })
  );
});
