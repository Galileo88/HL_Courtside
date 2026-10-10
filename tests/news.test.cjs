const { fullSamplePath } = require('./helpers.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict'),
  N = require('../js/coverage/news-coverage.js');
function fixture() {
  return {
    leagueName: 'Test League',
    shortName: 'TL',
    leagueType: 0,
    season: { currentYear: 8, startingYear: 1, currentDay: 4, phase: 9, schedule: [], news: [] },
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
            stats: [{ yr: 8, league: 0, season: [{ tid: 1, GP: 10, PTS: 100, REB: 50, AST: 30 }] }],
          },
        ],
        frontOffice: { staff: [{ id: 91, tid: 1, pos: 1, fn: 'Casey', ln: 'Coach' }] },
      },
      { id: 2, name: 'Moons', roster: [] },
    ],
    coaches: [{ id: 92, tid: 0, fn: 'Pat', ln: 'Retired' }],
    awards: [{ id: 2, name: 'MVP' }],
  };
}
function event(type, patch = {}) {
  return { league: 0, date: 4, phase: 9, type, tid: 1, pid: 11, gid: 0, data: {}, ...patch };
}
test('retirement announcement, retirement, Hall of Fame and retired jersey are distinct events', () => {
  const l = fixture();
  l.season.news = [event(16), event(17), event(22), event(25, { data: { retiredNumber: { pid: 11, num: 0, yr: 8 } } })];
  const rows = N.candidates(l).map(x => x.story);
  assert.equal(rows.length, 4);
  assert.match(rows[0].headline, /plans to retire/);
  assert.match(rows[1].headline, /calls it a career/);
  assert.match(rows[2].headline, /Hall of Fame/);
  assert.match(rows[3].headline, /No. 0/);
  assert.ok(rows.every(s => s.paragraphs.join(' ').includes('10.0 points')));
  assert.equal(new Set(rows.map(s => s.id)).size, 4);
});
test('coach hires, releases, firings and retirements resolve staff and never use player career stats', () => {
  const l = fixture();
  l.season.news = [26, 27, 28, 29].map(type => event(type, { pid: 91 }));
  l.season.news.push(event(29, { pid: 92, tid: 0 }));
  const rows = N.candidates(l);
  assert.equal(rows.length, 5);
  assert.match(rows[2].story.paragraphs[0], /fired coach Casey Coach/);
  assert.match(rows[4].story.headline, /Pat Retired retires/);
  assert.ok(rows.every(x => !x.story.paragraphs.join(' ').includes('career spans')));
});
test('trade direction follows the outgoing side and destination, including picks', () => {
  const l = fixture();
  l.season.news = [
    event(7, {
      data: {
        trade: {
          status: 1,
          teams: [
            { tid: 1, assets: [{ pid: 11, tid: 2 }] },
            { tid: 2, assets: [{ pid: 0, tid: 1, draftPick: { yr: 9, rd: 1 } }] },
          ],
        },
      },
    }),
  ];
  const s = N.candidates(l)[0].story;
  assert.deepEqual(s.seasonSnapshot.rows[0], ['Stars', 'Alex Star', 'Moons']);
  assert.deepEqual(s.seasonSnapshot.rows[1], ['Moons', 'a 9 first-round pick', 'Stars']);
  assert.match(s.headline, /Moons acquire Alex Star from Stars/);
  assert.match(s.paragraphs[0], /^The Stars acquired a 9 first-round pick from the Moons in exchange for Alex Star\./);
  l.season.news[0].data.trade.status = 0;
  assert.equal(N.candidates(l).length, 0);
});
test('source evidence is retained; read flags and field order do not create duplicates', () => {
  const l = fixture();
  l.season.news = [event(3, { data: { contract: { yrs: 3, pid: 11 } } })];
  const s = N.candidates(l)[0].story;
  l.season.news[0].read = true;
  l.season.news[0].data.contract = { pid: 11, yrs: 3 };
  assert.equal(N.candidates(l)[0].story.id, s.id);
  assert.equal(s.seasonSnapshot.newsEvent.data.contract.yrs, 3);
  l.season.news.push(structuredClone(l.season.news[0]));
  assert.equal(N.candidates(l).length, 1);
});
test('unknown types, wrong leagues, future announcements and missing identities are not guessed', () => {
  const l = fixture();
  l.season.news = [
    event(999),
    event(17, { league: 1 }),
    event(17, { date: 5 }),
    event(17, { pid: 999 }),
    event(17, { phase: 8 }),
  ];
  assert.equal(N.candidates(l).length, 0);
});
test('award and championship events share existing milestone identities; game recap events are not duplicated', () => {
  const l = fixture();
  l.season.news = [event(12, { data: { awardId: 2 } }), event(13), event(9)];
  const rows = N.candidates(l).map(x => x.story);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].eventKey, 'award-2-11');
  assert.equal(rows[1].eventKey, 'championship');
});
test('injury disappointment overrides a winning season for coach and injured player', () => {
  const l = fixture();
  l.teams[0].season = [{ yr: 8, seasonStats: { W: 60, L: 22 } }];
  l.season.news = [event(10, { data: { injury: { gamesOut: 5 } } })];
  const text = N.candidates(l)[0].story.paragraphs.join(' ');
  assert.match(text, /head coach Casey Coach said/);
  assert.match(text, /Alex Star said/);
  assert.match(text, /disappoint|frustrat|hate/);
  assert.doesNotMatch(text, /fictional interview|great season/);
});
test('a finished college season keeps its beat on the pro calendar with save-backed offseason features', () => {
  const save = JSON.parse(require('fs').readFileSync(fullSamplePath, 'utf8')),
    [pro, college] = save.seasonLeagues;
  const champ = college.teams[0].id,
    full = college.season.schedule,
    end = day => {
      college.season.schedule = full.slice(0, day + 1);
      college.season.news = [
        ...college.season.news.filter(n => n.type !== 13),
        { league: 1, date: day, phase: college.season.phase, type: 13, tid: champ, pid: 0, gid: 0, data: {} },
      ];
    };
  assert.equal(N.offseason(pro, save.seasonLeagues).length, 0);
  end(10);
  const cal = N.calendar(college, save.seasonLeagues);
  assert.equal(cal.over, true);
  assert.equal(cal.day, 33);
  assert.equal(cal.own, 11);
  const rows = N.offseason(college, save.seasonLeagues).map(x => x.story);
  // Before the offseason nobody has declared, so only the board and the seniors run.
  assert.deepEqual(
    rows.map(s => s.eventKey),
    ['offseason-draft-watch', 'offseason-seniors']
  );
  assert.ok(rows.every(s => s.day === 33 && s.seasonSnapshot.board.rows.length >= 3));
  assert.ok(rows[1].seasonSnapshot.roundup.items.every(x => x.year === 'Sr.'));
  assert.doesNotMatch(
    rows.flatMap(s => s.paragraphs).join(' '),
    /projected|counted as gone|returning next season|will decide who keeps playing/
  );
  assert.ok(N.candidates(college, save.seasonLeagues).every(x => x.story.day >= 11 && x.story.day <= 33));
  college.season.news.push(
    {
      league: 1,
      date: 20,
      phase: college.season.phase,
      type: 17,
      tid: college.teams[0].id,
      pid: college.teams[0].roster[0].id,
      gid: 0,
      data: {},
    },
    {
      league: 1,
      date: 10,
      phase: college.season.phase,
      type: 17,
      tid: college.teams[0].id,
      pid: college.teams[0].roster[1].id,
      gid: 0,
      data: {},
    }
  );
  const dated = N.candidates(college, save.seasonLeagues)
    .filter(x => x.story.type === 'Retirement')
    .map(x => x.story.day)
    .sort((a, b) => a - b);
  assert.deepEqual(dated, [11, 21]);
  // The features run a week apart on the pro calendar.
  end(28);
  assert.deepEqual(
    N.offseason(college, save.seasonLeagues).map(x => x.story.eventKey),
    ['offseason-draft-watch']
  );
  // No pro league, or a college season still in progress: nothing new.
  assert.equal(N.offseason(college, [college]).length, 0);
});
test('the college offseason reports the real draft class, who is back and the official preseason poll', () => {
  const save = JSON.parse(require('fs').readFileSync(fullSamplePath, 'utf8')),
    [pro, college] = save.seasonLeagues;
  const last = college.season.currentYear,
    next = last + 1;
  college.season.currentYear = next;
  college.season.schedule = [];
  const players = college.teams.flatMap(t => t.roster);
  for (const p of players) p.yrs = Math.max(1, p.yrs | 0);
  // Five players leave for the draft: off the rosters and into the pro draft class.
  const gone = college.teams.slice(0, 5).map(t => t.roster.shift());
  pro.draftClass = gone;
  college.teams.forEach((t, i) => {
    t.season = [...(t.season || []), { yr: next, poll: i + 1, seed: 0, seasonStats: { GP: 0, W: 0, L: 0 } }];
  });
  // The top team's case is its incoming class.
  const t0 = college.teams[0];
  for (let i = 0; i < 4; i++)
    t0.roster.push({ id: 900000 + i, tid: t0.id, fn: 'Fresh', ln: `Man${i}`, yrs: 0, pot: 10, stats: [] });
  for (const t of college.teams.slice(1, 6))
    t.roster.push({ id: 910000 + t.id, tid: t.id, fn: 'Other', ln: `Kid${t.id}`, yrs: 0, pot: 6, stats: [] });
  const rows = N.offseason(college, save.seasonLeagues).map(x => x.story),
    key = k => rows.find(s => s.eventKey === k);
  assert.deepEqual(
    rows.map(s => s.eventKey),
    ['offseason-draft-class', 'offseason-returning', 'offseason-preseason-poll']
  );
  assert.match(key('offseason-draft-class').headline, new RegExp(`leads the ${next} draft class$`));
  const leaving = new Set(gone.map(p => `${p.fn} ${p.ln}`));
  assert.ok(key('offseason-returning').seasonSnapshot.roundup.items.every(x => !leaving.has(x.name)));
  const poll = key('offseason-preseason-poll');
  assert.match(poll.paragraphs[0], new RegExp(`${next} .* preseason poll is out`));
  assert.equal(poll.seasonSnapshot.board.rows[0][0], college.teams[0].city + ' ' + college.teams[0].name);
  assert.match(
    poll.paragraphs.join(' '),
    /The case for No\. 1 is the freshman class\. .* signed four recruits, more than any other program/
  );
  assert.ok(rows.every(s => s.day === 1));
});
test('news value follows who it is about: role-player retirements share a roundup, stars keep their own story', () => {
  const l = fixture(),
    roster = l.teams[0].roster;
  for (let i = 0; i < 4; i++)
    roster.push({
      id: 20 + i,
      tid: 1,
      fn: 'Bench',
      ln: `Guy${i}`,
      stats: [{ yr: 8, league: 0, season: [{ tid: 1, GP: 40, PTS: 80, REB: 40, AST: 20 }] }],
    });
  roster.push({
    id: 30,
    tid: 1,
    fn: 'Big',
    ln: 'Star',
    awards: [{ id: 2, league: 0, yearsWon: [7, 8] }],
    stats: [{ yr: 8, league: 0, season: [{ tid: 1, GP: 80, PTS: 2000, REB: 500, AST: 400 }] }],
  });
  l.season.news = [...[20, 21, 22, 23].map(pid => event(17, { pid })), event(17, { pid: 30 })];
  const rows = N.candidates(l).map(x => x.story),
    star = rows.find(s => s.headline === 'Big Star calls it a career'),
    group = rows.find(s => s.seasonSnapshot?.roundup?.type === 17);
  assert.ok(star && star.importance >= 120);
  assert.ok(group && group.importance < star.importance);
  assert.match(group.headline, /leads this year's retirement class$/);
  const folded = rows.filter(s => s.inRoundup);
  assert.equal(folded.length, 4);
  assert.ok(folded.every(s => s.inRoundup === group.id && s.importance < 20));
});
test('notable coaches get their own story ahead of unknowns, who stay in the carousel unless the job is a big one', () => {
  const l = fixture();
  l.teams = [1, 2, 3, 4, 5].map(id => ({
    id,
    name: `Team${id}`,
    roster: [],
    season: [{ yr: 7, seasonStats: { GP: 82, W: id === 2 ? 60 : 30, L: id === 2 ? 22 : 52 } }],
    frontOffice: {
      staff: [
        {
          id: 90 + id,
          tid: id,
          pos: 1,
          fn: 'Coach',
          ln: `C${id}`,
          pot: 7,
          career: {
            season: { W: id === 1 ? 250 : id === 2 ? 100 : 120, L: id === 1 ? 78 : 228 },
            playoffs: { W: id === 1 ? 40 : 0 },
          },
          awards: id === 1 ? [{ id: 0, yearsWon: [5, 6] }] : [],
        },
      ],
    },
  }));
  l.season.news = [1, 2, 3, 4, 5].map(id => event(26, { tid: id, pid: 90 + id }));
  const rows = N.candidates(l).map(x => x.story),
    own = rows.filter(s => !s.inRoundup && !s.seasonSnapshot?.roundup);
  const big = own.find(s => /C1/.test(s.headline)),
    contender = own.find(s => /C2/.test(s.headline));
  assert.ok(big && contender, "the proven coach and the contender's hire keep their own stories");
  assert.ok(big.importance > contender.importance);
  assert.match(big.paragraphs[0], /brings a 250-78 career record, 40 playoff wins and two championships/);
  assert.equal(rows.filter(s => s.inRoundup).length, 3);
  assert.match(rows.find(s => s.seasonSnapshot?.roundup?.type === 26).paragraphs[0], /Coach C1/);
});
test('option headlines name the move and coach stories carry the coach for a press-conference image', () => {
  const l = fixture();
  l.season.news = [event(20), event(19, { tid: 1 }), event(28, { pid: 91 })];
  const rows = N.candidates(l);
  assert.deepEqual(
    rows.slice(0, 2).map(x => x.story.headline),
    ["Stars pick up Alex Star's option", 'Alex Star opts out, heads to free agency']
  );
  const coach = rows.find(x => x.story.type === 'Coaching change');
  assert.equal(coach.context.coach.ln, 'Coach');
  assert.equal(coach.context.coach.isCoach, true);
  assert.ok(rows.slice(0, 2).every(x => !x.context.coach));
  assert.equal(coach.context.coachScene, 'fire');
  const hire = N.candidates({ ...l, season: { ...l.season, news: [event(26, { pid: 91 })] } })[0];
  assert.equal(hire.context.coachScene, 'hire');
});
test('coaching changes carry what the desk can argue over, and nothing the save does not know', () => {
  const B = require('../js/broadcast/broadcast-content.js');
  const season = (tid, W, L, L10 = []) => ({ tid, GP: W + L, W, L, L10 });
  const talk = (type, career) => {
    const l = fixture();
    l.teams[0].season = [{ yr: 7, seasonStats: { W: 9, L: 21, GP: 30 } }];
    const coach = l.teams[0].frontOffice.staff[0];
    coach.career = career;
    if (type !== 26) {
      l.teams[0].frontOffice.staff = [];
      l.coaches.push({ ...coach, tid: -1 });
    }
    l.season.news = [event(type, { pid: 91 })];
    const story = N.candidates(l).find(x => x.story.type === 'Coaching change').story;
    return { story, lines: B.script(story).map(t => [t.speaker, t.text]) };
  };
  const fired = talk(28, {
    season: { W: 52, L: 57 },
    teamHistory: [
      { yr: 6, season: [season(1, 18, 12)] },
      { yr: 7, season: [season(1, 16, 14)] },
      { yr: 8, season: [season(1, 4, 9, [0, 0, 1, 0, 0, 0, 1, 0, 0, 1])] },
    ],
  });
  assert.deepEqual(fired.story.seasonSnapshot.coaching.recent, { W: 3, G: 10 });
  assert.deepEqual(fired.lines.slice(2, 4), [
    [2, "You could see it coming. They'd lost seven of their last ten."],
    [3, 'To be fair, Coach had two winning seasons there.'],
  ]);
  assert.deepEqual(new Set(fired.lines.map(x => x[0])).size, 4);
  const hired = talk(26, {
    season: { W: 70, L: 50 },
    teamHistory: [
      { yr: 6, season: [season(2, 46, 14)] },
      { yr: 7, season: [season(2, 24, 36)] },
    ],
  });
  assert.deepEqual(
    hired.lines.slice(2, 4).map(x => x[1]),
    [
      "Nobody takes that job thinking it's easy. They went 9-21 last season.",
      'Coach has done it before. That 70-50 came with the Moons over two seasons.',
    ]
  );
  // A coach the save knows nothing about gets the plain segment, not filler.
  const unknown = talk(28, undefined);
  assert.equal(unknown.lines.length, 3);
});
test('player news talks about what the player means to the team, with numbers that fit the point', () => {
  const B = require('../js/broadcast/broadcast-content.js');
  const player = (id, ppg, extra = {}) => ({
    id,
    tid: 1,
    fn: 'P',
    ln: 'No' + id,
    gender: 0,
    stats: [{ yr: 8, league: 0, season: [{ tid: 1, GP: 10, PTS: ppg * 10, REB: 20, AST: 10 }] }],
    ...extra,
  });
  const say = (type, data, star, extra) => {
    const l = fixture();
    l.season.totalGames = 30;
    l.season.currentDay = 10;
    l.season.schedule = Array.from({ length: 10 }, (_, d) => ({
      results: [{ gameType: 0, gId: d + 1, homeTeam: 1, awayTeam: 2, homeScore: 20, awayScore: 10, winner: 1 }],
    }));
    l.teams[0].roster = [
      player(11, star, { fn: 'Alex', ln: 'Star', ...extra }),
      ...[8, 7, 6, 5, 4].map((p, i) => player(20 + i, p)),
    ];
    l.season.news = [event(type, { date: 9, data })];
    const story = N.candidates(l).find(x => x.story.seasonSnapshot?.newsPlayer)?.story;
    return story ? B.script(story).map(t => [t.speaker, t.text]) : [];
  };
  const injury = say(10, { injury: { gamesOut: 12 } }, 15);
  assert.deepEqual(injury.slice(-3, -1), [
    [2, "And it's their leading scorer, too."],
    [3, "Those 12 games are more than half of what's left of the regular season."],
  ]);
  assert.equal(new Set(injury.map(x => x[0])).size, 4);
  const bench = say(10, { injury: { gamesOut: 2 } }, 1);
  assert.ok(bench.some(x => /not one of their top scorers/.test(x[1])));
  assert.ok(!bench.some(x => /of what's left/.test(x[1])));
  const extension = say(30, { contract: { ext: { yrs: 4 } } }, 15, { age: 21 });
  assert.ok(extension.some(x => x[1] === "He's their leading scorer. You don't let that walk."));
  assert.ok(extension.some(x => x[1] === "And he's only 21, so there's room to grow."));
  for (const lines of [injury, bench, extension]) assert.ok(lines.every(x => !/undefined|NaN|null/.test(x[1])));
});
test('trades and farewells get the point a desk would make, only when the save supports it', () => {
  const B = require('../js/broadcast/broadcast-content.js');
  const lines = story => B.script(story).map(t => [t.speaker, t.text]);
  const l = fixture();
  l.teams[0].season = [{ yr: 8, seasonStats: { W: 4, L: 12 } }];
  l.teams[1].season = [{ yr: 8, seasonStats: { W: 12, L: 4 } }];
  l.season.news = [
    event(7, {
      data: {
        trade: {
          status: 1,
          teams: [
            { tid: 1, assets: [{ pid: 11, tid: 2 }] },
            { tid: 2, assets: [{ pid: 0, tid: 1, draftPick: { yr: 9, rd: 1 } }] },
          ],
        },
      },
    }),
  ];
  const trade = lines(N.candidates(l)[0].story);
  assert.deepEqual(trade.slice(3, 5), [
    [2, "The Moons are 12-4. They're going for it."],
    [3, "And the Stars get a pick back. At 4-12, that's a team thinking about next year."],
  ]);
  // Without records, the take stands alone.
  l.teams[0].season = l.teams[1].season = [];
  assert.ok(!lines(N.candidates(l)[0].story).some(x => /going for it|next year/.test(x[1])));
  const r = fixture();
  r.teams[0].roster[0].awards = [{ id: 0, league: 0, yearsWon: [3, 6] }];
  r.season.news = [event(17)];
  assert.ok(lines(N.candidates(r)[0].story).some(x => x[1].startsWith("And don't forget the two championships.")));
  r.teams[0].roster[0].awards = [];
  assert.ok(!lines(N.candidates(r)[0].story).some(x => /championship|seasons/.test(x[1])));
});
test('news cards hold numbers, not a restatement of the headline', () => {
  const l = fixture();
  l.season.news = [event(17), event(3, { data: { contract: { yrs: 2 } } })];
  const [retired, signed] = N.candidates(l).map(x => x.story.seasonSnapshot);
  assert.deepEqual(retired.headers, ['Stat', 'Regular season']);
  assert.deepEqual(
    retired.rows.map(r => r[0]),
    ['Points per game', 'Rebounds per game', 'Assists per game', 'Games']
  );
  assert.ok(![...retired.rows, ...signed.rows].some(r => r[0] === 'Event'));
});
