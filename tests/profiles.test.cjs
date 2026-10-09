const { samplePath } = require('./helpers.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  C = require('../js/coverage/core.js'),
  P = require('../js/coverage/profiles.js');

const save = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

test('a league yields player, coach and team profiles with stats, awards and ranks', () => {
  const league = save.seasonLeagues[0],
    fp = C.buildFingerprint(league),
    records = P.build(league, fp);
  const players = records.filter(r => r.kind === 'player'),
    teams = records.filter(r => r.kind === 'team'),
    coaches = records.filter(r => r.kind === 'coach');
  assert.ok(players.length > 100 && teams.length === league.teams.length && coaches.length >= teams.length);
  for (const r of records) assert.equal(r.id, P.profileId(fp, r.kind, r.ref));
  const star = players.find(p => p.seasons.some(s => s.GP > 0 && s.PTS > 0));
  assert.ok(star.seasons.every(s => s.yr && ['season', 'playoffs'].includes(s.period) && Number.isFinite(s.GP)));
  // Award ids resolve to the league's own names, or Hoop Land's fixed ones.
  const honored = players.find(p => p.awards.length);
  assert.ok(honored.awards.every(a => typeof a.name === 'string' && a.years.length));
  assert.ok(players.some(p => p.awards.some(a => a.name === 'All-Star')));
  const team = teams[0];
  assert.equal(team.ranks.of, league.teams.length);
  assert.ok(team.ranks.record >= 1 && team.ranks.PTS >= 1);
  assert.ok(team.roster.length > 0 && team.seasons.length > 0);
  // No ratings, potential or skills on a profile.
  assert.doesNotMatch(JSON.stringify(records), /"(?:rating|pot|attributes|skills|tendencies)"/);
});

test('article links go to the first mention of each person or team, never an ambiguous name', () => {
  const index = P.nameIndex([
    { kind: 'player', id: 'L:player:1', name: 'Patrick Ryan' },
    { kind: 'player', id: 'L:player:2', name: 'Sam Moon' },
    { kind: 'player', id: 'L:player:3', name: 'Sam Moon' },
    { kind: 'coach', id: 'L:coach:9', name: 'Ralph Goodman' },
    { kind: 'team', id: 'L:team:4', name: 'Dallas Wranglers', nickname: 'Wranglers' },
    { kind: 'team', id: 'L:team:5', name: 'Delmar Rams', nickname: 'Rams' },
    { kind: 'team', id: 'L:team:6', name: 'Davis Rams', nickname: 'Rams' },
  ]);
  assert.ok(!index.some(([name]) => name === 'Sam Moon'), 'two players share the name');
  const parts = P.linkParagraphs(
    [
      'Patrick Ryan scored 30, and the Wranglers beat the Rams. Coach Ralph Goodman smiled.',
      'Patrick Ryan again, the Dallas Wranglers again, and Sam Moon. Wranglers fans cheered. Ryanson sat.',
    ],
    index
  );
  const links = parts.flat().filter(p => p.id);
  assert.deepEqual(
    links.map(l => [l.text, l.id]),
    [
      ['Patrick Ryan', 'L:player:1'],
      ['Wranglers', 'L:team:4'],
      ['Ralph Goodman', 'L:coach:9'],
    ]
  );
  // "the Rams" belongs to two teams, so it stays plain; text is preserved exactly.
  assert.equal(
    parts.map(p => p.map(x => x.text).join('')).join('\n'),
    [
      'Patrick Ryan scored 30, and the Wranglers beat the Rams. Coach Ralph Goodman smiled.',
      'Patrick Ryan again, the Dallas Wranglers again, and Sam Moon. Wranglers fans cheered. Ryanson sat.',
    ].join('\n')
  );
  assert.deepEqual(P.linkParagraphs(['No index.'], null), [[{ text: 'No index.' }]]);
});
