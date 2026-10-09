const test = require('node:test'),
  assert = require('node:assert/strict'),
  K = require('../js/coverage/career-coverage.js');

const prospect = (id, fn, ln, extra = {}) => ({
  id,
  fn,
  ln,
  gender: 0,
  age: 17,
  ht: 78,
  wt: 200,
  pos: 4,
  num: id,
  ctry: 'US',
  attributes: { STR: [8, 8], SPD: [8, 8], STM: [8, 8], TPT: [8, 8] },
  ...extra,
});
function league({ mode = 2, played = false } = {}) {
  const west = {
    id: 1,
    startingLineup: [
      { linePos: 0, pid: 10 },
      { linePos: 1, pid: 11 },
    ],
    city: 'Western',
    name: 'All-Americans',
    arenaName: 'Monarchs Arena West',
    roster: [
      prospect(10, 'Tavish', 'Berlin', {
        ctry: 'SI',
        ht: 80,
        wt: 234,
        pos: 3,
        num: 12,
        pot: 8,
        attributes: { STR: [17, 17], STM: [20, 20], TPT: [10, 14], LAY: [10, 14], PAS: [9, 12] },
      }),
      prospect(11, 'Karl', 'Phelps', { ht: 87, pos: 8 }),
    ],
  };
  const east = {
    id: 2,
    startingLineup: [{ linePos: 0, pid: 21 }],
    city: 'Eastern',
    name: 'All-Americans',
    roster: [
      prospect(20, 'Jozef', 'Bozic', { ctry: 'SI' }),
      prospect(21, 'Abdullah', 'Polat', { ctry: 'TR' }),
      prospect(22, 'Mirko', 'Makela', { ctry: 'FI', ht: 86 }),
    ],
  };
  return {
    leagueName: 'National College Sporting Association',
    shortName: 'NCSA',
    leagueType: 1,
    teams: [{ id: 3, city: 'Allegheny State', name: 'Mountaineers', roster: [] }],
    starTeams: [west, east],
    season: {
      mode,
      playerId: 10,
      teamId: 1,
      currentYear: 1967,
      schedule: [
        {
          results: [
            {
              gameType: 3,
              homeTeam: 1,
              awayTeam: 2,
              gId: 513,
              homeScore: played ? 80 : 0,
              awayScore: played ? 70 : 0,
              winner: played ? 1 : 0,
            },
          ],
        },
      ],
      posts: [
        { player: { id: 10 }, author: { type: 4, fanData: { ctry: 'SI' } } },
        { player: { id: 10 }, author: { type: 3, fanData: {} } },
      ],
    },
  };
}

test('a career opens with a player profile and a showcase preview before the game', () => {
  const stories = K.candidates(league()).map(x => x.story);
  assert.deepEqual(
    stories.map(s => s.eventKey),
    ['career-showcase-10', 'career-potential-10', 'showcase-preview']
  );
  const [profile, , preview] = stories;
  assert.equal(profile.headline, 'Tavish Berlin opens his career at the Koality Showcase');
  const text = profile.paragraphs.join(' ');
  assert.match(text, /Tavish Berlin, a 17-year-old wing from Slovenia, opens his career/);
  assert.match(
    text,
    /No\. 12 and starts for the Western All-Americans against the Eastern All-Americans at Monarchs Arena West/
  );
  assert.deepEqual(
    preview.seasonSnapshot.rows.map(r => r[0]),
    ['Tavish Berlin', 'Karl Phelps', 'Abdullah Polat']
  );
  assert.equal(preview.seasonSnapshot.board.lead, false);
  assert.match(text, /6-foot-8 and 234 pounds/);
  assert.match(text, /his stamina and strength rank among the best/);
  assert.match(text, /Jozef Bozic suits up for the Eastern All-Americans/);
  assert.match(text, /Back in Slovenia, fans are already posting about him on Hoop Gram/);
  assert.equal(profile.seasonSnapshot.rows[0][0], 'Tavish Berlin');
  assert.equal(preview.headline, 'Western and Eastern All-Americans meet in the Koality Showcase');
  assert.match(preview.paragraphs.join(' '), /players from Slovenia, Türkiye and Finland/);
  assert.ok(stories.every(s => s.day === 1 && s.season === 1967));
});
test('the ceiling story names the potential and where the growth has to come from', () => {
  const { story, context } = K.candidates(league())[1];
  assert.equal(story.headline, "Tavish Berlin's ceiling: perennial All-Star");
  const text = story.paragraphs.join(' ');
  assert.match(text, /with the ceiling of a perennial All-Star/);
  assert.match(text, /most room to grow is in his finishing at the rim and three-point shooting\./);
  assert.match(text, /His strength and stamina are already fully developed/);
  assert.deepEqual(story.seasonSnapshot.rows, [
    ['Most room to grow', 'Finishing and three-point'],
    ['Room to grow', 'Passing'],
    ['Fully developed', 'Strength and stamina'],
  ]);
  assert.doesNotMatch(JSON.stringify([story.headline, story.paragraphs, story.seasonSnapshot.rows]), /\d/);
  assert.equal(context.sceneKind, 'interview');
  assert.equal(context.event, 'Koality Showcase');
  const low = league();
  low.starTeams[0].roster[0].pot = 7;
  assert.equal(K.candidates(low)[1].story.headline, "Tavish Berlin's ceiling is still an open question");
});
test('no story is illustrated with a game that has not happened', () => {
  const contexts = K.candidates(league()).map(x => x.context);
  assert.ok(contexts.every(c => c.coachScene === 'showcase' || c.sceneKind === 'interview'));
  const posts = contexts.filter(c => c.coachScene === 'showcase');
  assert.ok(posts.every(c => c.post?.tag === 'koalityshowcase'));
  assert.deepEqual(
    posts.map(c => c.recruit.ln),
    ['Berlin', 'Makela']
  );
});
test('no career stories outside career mode or once the showcase is played', () => {
  assert.deepEqual(K.candidates(league({ mode: 1 })), []);
  assert.deepEqual(K.candidates(league({ played: true })), []);
  const l = league();
  l.season.playerId = 99;
  assert.deepEqual(K.candidates(l), []);
});
