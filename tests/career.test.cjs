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
  assert.match(text, /Tavish Berlin, a 17-year-old wing from Slovenia, takes the floor at the Koality Showcase/);
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
test('players from the same country are named together, and a long list becomes a count', () => {
  const two = league();
  two.starTeams[0].roster.push(prospect(13, 'Luka', 'Novak', { ctry: 'SI' }));
  const paragraph = l => K.candidates(l)[0].story.paragraphs.find(p => /only player|one of/.test(p));
  assert.equal(
    paragraph(two),
    "Berlin won't be the only player from Slovenia on the floor: Luka Novak plays alongside him on the Western All-Americans and Jozef Bozic suits up for the Eastern All-Americans."
  );
  two.starTeams[0].roster.push(prospect(14, 'Jan', 'Kos', { ctry: 'SI' }));
  assert.match(paragraph(two), /Luka Novak and Jan Kos play alongside him on the Western All-Americans/);
  const many = league();
  for (let i = 0; i < 5; i++) many.starTeams[1].roster.push(prospect(40 + i, 'Player', `No${i}`, { ctry: 'SI' }));
  assert.equal(paragraph(many), 'Berlin is one of seven players from Slovenia in the game.');
});
test('countries read the way a sentence says them, and tables keep the plain name', () => {
  const l = league();
  l.starTeams[0].roster[0].ctry = 'US';
  l.season.posts[0].author.fanData.ctry = 'US';
  l.starTeams[1].roster[0].ctry = 'US';
  const profile = K.candidates(l)[0].story,
    text = profile.paragraphs.join(' ');
  assert.match(text, /a 17-year-old wing from the United States, takes the floor/);
  assert.match(text, /won't be the only player from the United States on the floor/);
  assert.match(text, /Back in the United States, fans/);
  assert.equal(profile.seasonSnapshot.rows[0][3], 'United States');
  for (const [code, said] of [
    ['PH', 'the Philippines'],
    ['NL', 'the Netherlands'],
    ['DO', 'the Dominican Republic'],
    ['CD', 'the Democratic Republic of the Congo'],
    ['HK', 'Hong Kong'],
    ['SI', 'Slovenia'],
  ]) {
    l.starTeams[0].roster[0].ctry = code;
    assert.match(K.candidates(l)[0].story.paragraphs[0], new RegExp(`wing from ${said}, takes`), code);
  }
});
test('the goal story quotes how the player wants to be remembered, with no ratings behind it', () => {
  const { story, context } = K.candidates(league())[1];
  assert.equal(story.headline, 'Tavish Berlin wants to be an All-Star year in and year out');
  const text = story.paragraphs.join(' ');
  assert.match(
    text,
    /^“I will be known as an All-Star year in and year out,” Tavish Berlin said ahead of the Koality Showcase\./
  );
  assert.match(text, /a bold goal for a 17-year-old .+ who hasn't played a college minute yet/);
  assert.doesNotMatch(text, /ceiling|potential|room to grow|developed|rating/i);
  assert.deepEqual(story.seasonSnapshot.headers, ['Player', 'Pos', 'Ht', 'From']);
  assert.equal(story.seasonSnapshot.rows[0][0], 'Tavish Berlin');
  assert.equal(story.seasonSnapshot.goal.goal, 'an All-Star year in and year out');
  assert.equal(context.sceneKind, 'interview');
  assert.equal(context.event, 'Koality Showcase');
  const greatest = league();
  greatest.starTeams[0].roster[0].pot = 10;
  assert.equal(K.candidates(greatest)[1].story.headline, 'Tavish Berlin wants to be the greatest of all time');
  assert.match(
    K.candidates(greatest)[1].story.paragraphs[0],
    /^“I will be known as the greatest player to ever play the game of basketball,”/
  );
  const famer = league();
  famer.starTeams[0].roster[0].pot = 9;
  assert.match(K.candidates(famer)[1].story.paragraphs[0], /one of the best Hall of Famers of all time,”/);
  // An answer the game never offered gets no story.
  const other = league();
  other.starTeams[0].roster[0].pot = 7;
  assert.deepEqual(
    K.candidates(other).map(x => x.story.eventKey),
    ['career-showcase-10', 'showcase-preview']
  );
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
// A college career a few games in, with Hoop Gram posts the player has answered, stored the way the
// game stores them: what the post was about (contentType) and how the player replied (responseType).
function replies() {
  const base = league({ mode: 2 });
  const berlin = base.starTeams[0].roster[0];
  const coach = { id: 90, tid: 3, pos: 1, fn: 'Jackie', ln: 'Farmer' };
  base.teams = [
    {
      id: 3,
      city: 'Allegheny State',
      name: 'Mountaineers',
      roster: [berlin, prospect(12, 'Curtis', 'Hall')],
      frontOffice: { staff: [coach] },
    },
    { id: 4, city: 'Laramie', name: 'Lassos', roster: [prospect(30, 'Matt', 'Woods')] },
  ];
  base.starTeams = [];
  base.season.schedule = [
    {
      results: [
        {
          gameType: 0,
          homeTeam: 3,
          awayTeam: 4,
          gId: 700,
          homeScore: 60,
          awayScore: 65,
          winner: 4,
          homeRecord: [0, 1],
          awayRecord: [1, 0],
        },
      ],
    },
    { results: [{ gameType: 0, homeTeam: 4, awayTeam: 3, gId: 701, homeScore: 58, awayScore: 70, winner: 3 }] },
  ];
  const post = (day, gid, contentType, responseType, extra = {}) => ({
    league: 1,
    day,
    gid,
    contentType,
    responseType,
    player: { id: 10 },
    author: { type: 4, fanData: { fn: 'Jane', ln: 'Doe' } },
    team: { id: 3 },
    ...extra,
  });
  base.season.posts = [
    post(0, 700, K.POST.teamLoss, K.REPLY.callOutCoach),
    post(0, 700, K.POST.teamLoss, K.REPLY.positive),
    post(1, 701, K.POST.teamWin, K.REPLY.creditCoach),
    post(1, 701, K.POST.opponentLoss, K.REPLY.negative),
    // A school's pitch comes from its coach, not a fan.
    post(0, 0, K.POST.recruitment, K.REPLY.positive, { team: { id: 4 }, author: { type: 2 } }),
    // Unanswered posts make no story.
    post(1, 701, K.POST.playerOfTheGame, 0),
  ];
  return base;
}
test('Hoop Gram replies become stories that report what the player did, not invented quotes', () => {
  const stories = K.candidates(replies()).map(x => x.story);
  const byKey = Object.fromEntries(stories.map(s => [s.eventKey, s]));
  assert.deepEqual(Object.keys(byKey).sort(), ['career-reply-3-0-4', 'career-reply-game-700', 'career-reply-game-701']);
  const loss = byKey['career-reply-game-700'];
  assert.equal(loss.headline, 'Tavish Berlin questions the coaching staff after 65-60 loss to Laramie Lassos');
  assert.match(
    loss.paragraphs[0],
    /questioned the coaching staff on Hoop Gram after the Allegheny State Mountaineers' 65-60 loss to the Laramie Lassos\./
  );
  assert.match(loss.paragraphs.join(' '), /also answered one other post about the game\./);
  assert.match(loss.paragraphs.join(' '), /The loss dropped the Allegheny State Mountaineers to 0-1\./);
  assert.match(loss.paragraphs.join(' '), /answering a post from a fan, Jane Doe/);
  assert.equal(loss.day, 1);
  const win = byKey['career-reply-game-701'];
  assert.equal(win.headline, 'Tavish Berlin credits Coach Jackie Farmer after 70-58 win over Laramie Lassos');
  assert.equal(win.day, 2);
  const recruit = byKey['career-reply-3-0-4'];
  assert.equal(recruit.headline, 'Tavish Berlin gives Laramie Lassos his word');
  assert.match(
    recruit.paragraphs[0],
    /answered the Laramie Lassos' pitch on Hoop Gram and gave the program his word\./
  );
  assert.doesNotMatch(recruit.paragraphs.join(' '), /a fan/);
  for (const s of stories) {
    assert.equal(s.type, 'Hoop Gram reply');
    assert.doesNotMatch(s.paragraphs.join(' '), /“|undefined|NaN/);
  }
  // A reply to a game the save can't find is skipped rather than guessed at.
  const lost = replies();
  lost.season.posts = [{ ...lost.season.posts[0], gid: 999 }];
  assert.deepEqual(
    K.candidates(lost).map(x => x.story.eventKey),
    []
  );
});
test('every Hoop Gram post and reply the game offers makes one story that reads right', () => {
  const B = require('../js/broadcast/broadcast-content.js');
  const games = { [K.POST.playerOfTheGame]: 701, [K.POST.teamWin]: 701, [K.POST.opponentLoss]: 701 };
  for (const kind of Object.values(K.POST))
    for (const reply of Object.values(K.REPLY)) {
      const l = replies(),
        pitch = kind === K.POST.recruitment;
      l.season.posts = [
        {
          league: 1,
          day: 0,
          gid: kind <= K.POST.recruitment ? 0 : games[kind] || 700,
          contentType: kind,
          responseType: reply,
          player: { id: 10 },
          author: pitch ? { type: 2 } : { type: 4, fanData: { fn: 'Jane', ln: 'Doe' } },
          team: { id: pitch ? 4 : 3 },
        },
      ];
      const found = K.candidates(l).filter(x => x.story.type === 'Hoop Gram reply');
      assert.equal(found.length, 1, `post ${kind}, reply ${reply}`);
      const { story } = found[0],
        tv = B.script(story, {})
          .map(t => t.text)
          .join(' ');
      const all = [story.headline, ...story.paragraphs, tv].join(' ');
      assert.doesNotMatch(all, /undefined|NaN|null|\$\{| {2}/, `post ${kind}, reply ${reply}`);
      // The opponent is named once in a headline, and a win is never "a win after a win".
      assert.ok((story.headline.match(/Laramie Lassos/g) || []).length <= 1, story.headline);
      assert.doesNotMatch(story.headline, /win after .* win|loss after .* loss/, story.headline);
      // Credit or a jab in reply to a school's pitch is about the school, not teammates or fans.
      if (pitch) assert.doesNotMatch(all, /teammate|the fans|roster/, story.headline);
      // Showcase teams are one-night teams with no home city.
      if (kind <= K.POST.showcaseResults) assert.doesNotMatch(all, /fans in|whole roster/, story.headline);
      if (story.seasonSnapshot.reply.won === false) assert.doesNotMatch(tv, /Winners share/);
    }
});
