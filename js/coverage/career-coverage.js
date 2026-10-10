/* Career mode stories: the career player and the Koality Showcase that opens a career. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.HoopWireCareer = factory(root.HoopWireCore);
})(globalThis, function (C) {
  'use strict';
  const CAREER_MODE = 2,
    SHOWCASE_GAME = 3,
    FAN_POST = 4;
  const strengths = {
    LAY: 'finishing at the rim',
    DNK: 'dunking',
    INS: 'scoring inside',
    MID: 'the mid-range jumper',
    TPT: 'three-point shooting',
    FTS: 'free-throw shooting',
    DRB: 'ball handling',
    PAS: 'passing',
    ORE: 'offensive rebounding',
    DRE: 'defensive rebounding',
    STL: 'jumping passing lanes',
    BLK: 'shot blocking',
    STR: 'strength',
    SPD: 'speed',
    STM: 'stamina',
  };
  const regions =
    typeof Intl === 'object' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  // Plain names where the browser's are written for menus ("Congo - Kinshasa", "Hong Kong SAR China").
  const names = {
    BA: 'Bosnia and Herzegovina',
    CD: 'Democratic Republic of the Congo',
    CG: 'Republic of the Congo',
    HK: 'Hong Kong',
    MM: 'Myanmar',
    MO: 'Macao',
    PS: 'Palestine',
    TC: 'Turks and Caicos Islands',
  };
  function country(code) {
    try {
      return (code && (names[code] || regions?.of(code))) || null;
    } catch {
      return null;
    }
  }
  // A country as a sentence names it: "from the United States", "from the Philippines", "from Slovenia".
  const theCountries = new Set(['BS', 'GM', 'KM', 'MV', 'NL', 'PH', 'SC']);
  function place(code) {
    const name = country(code);
    return name && (theCountries.has(code) || /^United |Republic|Islands$/.test(name)) ? `the ${name}` : name;
  }
  // Before a career starts, the game asks how the player wants to be remembered and saves the answer as
  // the player's potential. These are the game's three answers, word for word (with the word the game's
  // Hall of Fame line drops), so coverage quotes exactly what the player said.
  const goals = {
    10: {
      quote: 'I will be known as the greatest player to ever play the game of basketball.',
      goal: 'the greatest player to ever play the game',
      headline: n => `${n} wants to be the greatest of all time`,
    },
    9: {
      quote: 'I will be known as one of the best Hall of Famers of all time.',
      goal: 'one of the best Hall of Famers of all time',
      headline: n => `${n} sets sights on the Hall of Fame`,
    },
    8: {
      quote: 'I will be known as an All-Star year in and year out.',
      goal: 'an All-Star year in and year out',
      headline: n => `${n} wants to be an All-Star year in and year out`,
    },
  };
  const positionLabels = ['PG', 'G', 'SG', 'G/F', 'SF', 'F', 'PF', 'F/C', 'C'];
  // 84 inches reads 7'0"; prose spells it out as "7-foot", 80 as "6-foot-8".
  const feet = inches => (Number.isFinite(inches) && inches > 0 ? [Math.floor(inches / 12), inches % 12] : null),
    height = inches => feet(inches) && `${feet(inches)[0]}'${feet(inches)[1]}"`;
  const current = (p, key) => (Array.isArray(p.attributes?.[key]) ? Number(p.attributes[key][0]) || 0 : 0);

  // The league running the career and the player in it, found on a team or a showcase roster.
  function careerPlayer(league) {
    const s = league?.season || {};
    if (s.mode !== CAREER_MODE || !(s.playerId > 0)) return null;
    for (const team of [...(league.teams || []), ...(league.starTeams || [])]) {
      const player = (team.roster || []).find(p => p.id === s.playerId);
      if (player) return { player, team };
    }
    return null;
  }
  // The high school all-star game between the league's two showcase teams, while it is still to be played.
  function upcomingShowcase(league) {
    const stars = league.starTeams || [];
    if (league.leagueType !== 1 || stars.length < 2) return null;
    for (const day of league.season?.schedule || [])
      for (const game of day.results || []) {
        const home = stars.find(t => t.id === game.homeTeam),
          away = stars.find(t => t.id === game.awayTeam);
        if (game.gameType !== SHOWCASE_GAME || !home || !away) continue;
        return game.winner || game.homeScore || game.awayScore ? null : { game, home, away };
      }
    return null;
  }
  // A team's starting five, in lineup order, from the save's saved lineup.
  function starters(team) {
    const ids = (team.startingLineup || [])
      .filter(x => Number.isInteger(x?.linePos) && x.linePos < 5)
      .sort((a, b) => a.linePos - b.linePos)
      .map(x => x.pid);
    return ids.map(id => (team.roster || []).find(p => p.id === id)).filter(Boolean);
  }
  // The player's best traits by current rating, named only when they lead the showcase field.
  function standouts(player, field) {
    return Object.keys(strengths)
      .filter(key => current(player, key) > 0)
      .map(key => ({
        key,
        value: current(player, key),
        rank: field.filter(p => current(p, key) > current(player, key)).length + 1,
      }))
      .filter(x => x.rank <= 3)
      .sort((a, b) => a.rank - b.rank || b.value - a.value)
      .slice(0, 2);
  }

  function showcaseStories(league) {
    const career = careerPlayer(league),
      showcase = upcomingShowcase(league);
    if (!career || !showcase) return [];
    const { player } = career,
      team = [showcase.home, showcase.away].find(t => t.roster.some(p => p.id === player.id));
    if (!team) return [];
    const other = team === showcase.home ? showcase.away : showcase.home,
      field = [...showcase.home.roster, ...showcase.away.roster];
    const fp = C.buildFingerprint(league),
      year = C.seasonYear(league),
      day = Math.max(1, C.buildLookups(league).latestDay + 1),
      event = 'Koality Showcase',
      arena = showcase.home.arenaName || null;
    const name = C.playerDisplay(player),
      last = player.ln || C.surname(name),
      he = C.pronoun(player),
      subject = he ? C.capitalize(he) : last,
      his = he === 'she' ? 'her' : he === 'he' ? 'his' : C.possessive(last),
      him = he === 'she' ? 'her' : he === 'he' ? 'him' : last,
      position = C.positionName(player.pos),
      from = place(player.ctry),
      T = C.teamRef(team),
      O = C.teamRef(other);
    const countrymen = field.filter(p => p.id !== player.id && p.ctry && p.ctry === player.ctry),
      fans = (league.season?.posts || []).filter(x => x.player?.id === player.id && x.author?.type === FAN_POST),
      fansFromHome = fans.filter(x => x.author?.fanData?.ctry === player.ctry).length;
    const rosterRow = p => [
      C.playerDisplay(p),
      positionLabels[p.pos] || '—',
      height(p.ht) || '—',
      country(p.ctry) || '—',
    ];
    const story = (key, fields) => ({
      id: `${fp}:${year}:season:${key}`,
      eventKey: key,
      kind: 'season',
      fingerprint: fp,
      season: year,
      day,
      templateVersion: 1,
      editorialVersion: 1,
      quotesEnabled: false,
      leagueName: league.leagueName,
      createdAt: new Date().toISOString(),
      relatedTeams: [team, other].map(t => ({ id: t.id, name: C.teamDisplay(t), logoURL: t.logoURL || null })),
      ...fields,
    });
    const gameBall = league.gameballs?.[Number(league.settings?.gameBall) || 0] || {
      pri: 'E37033',
      sec: 'E37033',
      ter: 'E37033',
      outline: '44220F',
    };
    // A prospect's Hoop Gram post about the game, in the showcase team's colors.
    const showcasePost = (side, opponent, poster) => ({
      winner: side,
      loser: opponent,
      home: showcase.home,
      game: { homeTeam: showcase.home.id },
      scenePlayer: poster,
      gameBall,
      coachScene: 'showcase',
      recruit: poster,
      post: { text: `${event} week. Let's go.`, tag: event.replace(/\s+/g, '').toLowerCase(), event },
    });
    const result = [];

    // 1. The career player, introduced before the first game.
    const traits = standouts(player, field);
    // "a 17-year-old wing from Slovenia", with whatever the save knows.
    const age = player.age > 0 ? `${/^(8|11|18)/.test(String(player.age)) ? 'an' : 'a'} ${player.age}-year-old` : '',
      bio = [age || (position && 'a'), position, from && `from ${from}`].filter(Boolean).join(' ');
    const size = [
      feet(player.ht) && `${feet(player.ht)[0]}-foot${feet(player.ht)[1] ? `-${feet(player.ht)[1]}` : ''}`,
      player.wt > 0 && `${player.wt} pounds`,
    ]
      .filter(Boolean)
      .join(' and ');
    const others = countrymen.map(p => C.playerDisplay(p));
    const sameSide = countrymen.filter(p => team.roster.includes(p)),
      otherSide = countrymen.filter(p => other.roster.includes(p));
    const roster = [player, ...team.roster.filter(p => p.id !== player.id)];
    result.push({
      story: story(`career-showcase-${player.id}`, {
        type: 'Career',
        headline: `${name} opens ${he ? his : 'a'} career at the ${event}`,
        importance: 125,
        paragraphs: [
          `${name}${bio ? `, ${bio},` : ''} takes the floor at the ${event}, the high school all-star game where college coaches get their first long look at the top prospects.`,
          `${subject} wears No. ${player.num} and ${starters(team).includes(player) ? 'starts' : 'comes off the bench'} for ${T.full} against ${O.full}${arena ? ` at ${arena}` : ''}.`,
          size
            ? traits.length
              ? `At ${size}, ${last} brings a college-ready frame, and ${his} ${C.listJoin(traits.map(t => strengths[t.key]))} ${traits.length === 1 ? 'ranks' : 'rank'} among the best in the showcase field.`
              : `${C.capitalize(last)} checks in at ${size}.`
            : '',
          // Players from the same country, named together; a long list becomes a count.
          others.length > 4
            ? `${C.capitalize(last)} is one of ${C.num(others.length + 1)} players from ${from || 'the same country'} in the game.`
            : others.length
              ? `${C.capitalize(last)} won't be the only player from ${from || 'home'} on the floor: ${C.listJoin(
                  [
                    sameSide.length &&
                      `${C.listJoin(sameSide.map(C.playerDisplay))} ${sameSide.length === 1 ? 'plays' : 'play'} alongside ${him} on ${T.full}`,
                    otherSide.length &&
                      `${C.listJoin(otherSide.map(C.playerDisplay))} ${otherSide.length === 1 ? 'suits' : 'suit'} up for ${O.full}`,
                  ].filter(Boolean)
                )}.`
              : '',
          fans.length
            ? fansFromHome === fans.length && from
              ? `Back in ${from}, fans are already posting about ${him} on Hoop Gram.`
              : `Fans are already posting about ${him} on Hoop Gram.`
            : '',
        ].filter(Boolean),
        seasonSnapshot: {
          headers: ['Player', 'Pos', 'Ht', 'From'],
          rows: roster.map(rosterRow),
          board: {
            kicker: event,
            title: T.display,
            headers: ['Player', 'Pos', 'Ht', 'From'],
            rows: roster.map(rosterRow),
          },
          source: 'season.career',
          career: {
            event,
            name,
            last,
            pronoun: he || null,
            age: player.age || null,
            position: position || null,
            height: height(player.ht),
            weight: player.wt || null,
            country: from,
            num: player.num ?? null,
            team: T.display,
            opponent: O.display,
            countrymen: others,
            strengths: traits.map(t => strengths[t.key]),
            fanPosts: fans.length,
            fanPostsFromHome: fansFromHome,
          },
        },
      }),
      context: showcasePost(team, other, player),
    });

    // 2. In the player's own words: how the player wants to be remembered.
    const goal = goals[player.pot];
    if (goal) {
      const said = goal.quote.replace(/\.$/, ',');
      result.push({
        story: story(`career-potential-${player.id}`, {
          type: 'Career',
          headline: goal.headline(name),
          importance: 115,
          paragraphs: [
            `“${said}” ${name} said ahead of the ${event}.`,
            `It's a bold goal for ${bio || 'a prospect'} who hasn't played a college minute yet.`,
            `${subject} gets ${his} first chance to back it up when ${T.full} face ${O.full}.`,
          ],
          seasonSnapshot: {
            headers: ['Player', 'Pos', 'Ht', 'From'],
            rows: [rosterRow(player)],
            board: {
              kicker: event,
              title: 'Prospect',
              headers: ['Player', 'Pos', 'Ht', 'From'],
              rows: [rosterRow(player)],
              lead: false,
            },
            source: 'season.career',
            goal: {
              event,
              name,
              last,
              pronoun: he || null,
              goal: goal.goal,
              level: player.pot,
              team: T.display,
            },
          },
        }),
        context: {
          winner: team,
          loser: other,
          home: team,
          game: { homeTeam: team.id },
          scenePlayer: player,
          gameBall,
          sceneKind: 'interview',
          interviewVariant: 'player-close-up',
          event,
        },
      });
    }

    // 3. The showcase itself: who is on each side.
    const tallest = t => [...t.roster].filter(p => p.ht > 0).sort((a, b) => b.ht - a.ht || a.id - b.id)[0];
    const countries = t => [...new Set(t.roster.map(p => p.ctry).filter(Boolean))];
    const international = t => t.roster.filter(p => p.ctry && p.ctry !== 'US').length;
    const sides = [showcase.home, showcase.away].map(t => ({
      t,
      R: C.teamRef(t),
      tall: tallest(t),
      countries: countries(t),
    }));
    const worldly = sides.find(s => international(s.t) > s.t.roster.length / 2 && s.countries.length >= 3);
    const starting = [showcase.home, showcase.away].flatMap(t => starters(t).map(p => ({ p, t })));
    result.push({
      story: story('showcase-preview', {
        type: 'Showcase preview',
        headline:
          sides[0].R.nickname === sides[1].R.nickname && sides[0].R.city && sides[1].R.city
            ? `${sides[0].R.city} and ${sides[1].R.city} ${sides[0].R.nickname} meet in the ${event}`
            : `${sides[0].R.display} meet ${sides[1].R.display} in the ${event}`,
        importance: 110,
        paragraphs: [
          `The ${event} puts ${C.num(field.length)} of the top high school prospects on one floor, with ${sides[0].R.full} facing ${sides[1].R.full}${arena ? ` at ${arena}` : ''}.`,
          worldly
            ? `The ${worldly.R.display} roster has a global feel, with players from ${C.listJoin(worldly.countries.map(c => place(c) || c))}.`
            : '',
          sides.every(s => s.tall)
            ? `The size to watch: ${C.playerDisplay(sides[0].tall)} (${height(sides[0].tall.ht)}) for ${sides[0].R.full} and ${C.playerDisplay(sides[1].tall)} (${height(sides[1].tall.ht)}) for ${sides[1].R.full}.`
            : '',
          `${name} wears No. ${player.num} for ${T.full}.`,
        ].filter(Boolean),
        seasonSnapshot: {
          headers: ['Player', 'Pos', 'Ht', 'From'],
          rows: starting.map(x => rosterRow(x.p)),
          board: {
            kicker: event,
            title: 'Starting lineups',
            headers: ['Player', 'Pos', 'Ht', 'From'],
            rows: starting.map(x => rosterRow(x.p)),
            subs: starting.map(x => C.teamDisplay(x.t)),
            lead: false,
          },
          source: 'season.career',
          showcase: {
            event,
            arena,
            teams: sides.map(s => ({
              name: s.R.display,
              tallest: s.tall ? { name: C.playerDisplay(s.tall), height: height(s.tall.ht) } : null,
              countries: s.countries.map(c => country(c) || c),
            })),
            featured: name,
            featuredTeam: T.display,
          },
        },
      }),
      context: showcasePost(other, team, sides.find(s => s.t === other).tall || other.roster[0]),
    });
    return result;
  }
  // Hoop Gram replies. A post in the player's feed is about something (Hoop Land's post kinds), and
  // when the player answers it the save keeps how (the game's reply kinds). The exact words are picked
  // at random from a set and not saved, so coverage reports what the player did, not a quote.
  const POST = {
    showcase: 1,
    showcaseResults: 2,
    recruitment: 3,
    playerOfTheGame: 4,
    teamWin: 5,
    teamLoss: 6,
    opponentWin: 7,
    opponentLoss: 8,
  };
  const REPLY = {
    positive: 1,
    negative: 2,
    creditTeammate: 3,
    creditCoach: 4,
    creditTeam: 5,
    creditFans: 6,
    callOutTeammate: 7,
    callOutCoach: 8,
    callOutTeam: 9,
    callOutFans: 10,
  };
  // The strongest reply leads when the player answered several posts about one game.
  const weight = r => (r >= REPLY.callOutTeammate ? 3 : r >= REPLY.creditTeammate ? 2 : 1);
  function replyStories(league) {
    const career = careerPlayer(league);
    if (!career) return [];
    const { player } = career,
      lookup = C.buildLookups(league),
      fp = C.buildFingerprint(league),
      year = C.seasonYear(league);
    const answered = (league.season?.posts || []).filter(
      x => Number.isInteger(x.responseType) && x.responseType > 0 && Object.values(POST).includes(x.contentType)
    );
    const name = C.playerDisplay(player),
      last = player.ln || C.surname(name),
      he = C.pronoun(player),
      his = he === 'she' ? 'her' : he === 'he' ? 'his' : C.possessive(last),
      him = he === 'she' ? 'her' : he === 'he' ? 'him' : last;
    const groups = new Map();
    for (const post of answered) {
      const key = post.gid > 0 ? `game-${post.gid}` : `${post.contentType}-${post.day}-${post.team?.id ?? 0}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(post);
    }
    const result = [];
    for (const [key, posts] of groups) {
      const post = [...posts].sort((a, b) => weight(b.responseType) - weight(a.responseType) || a.day - b.day)[0],
        reply = post.responseType,
        kind = post.contentType;
      const played = post.gid > 0 ? lookup.completed.find(x => x.game.gId === post.gid) : null,
        game = played?.game;
      const mine =
        (game &&
          [game.homeTeam, game.awayTeam]
            .map(id => lookup.teams.get(id))
            .find(t => t?.roster?.some(p => p.id === player.id))) ||
        career.team;
      const other = game ? lookup.teams.get(game.homeTeam === mine?.id ? game.awayTeam : game.homeTeam) : null;
      const pitched = kind === POST.recruitment ? lookup.teams.get(post.team?.id) || null : null;
      // A recruiting reply needs the school; a game reply needs the game.
      if ((kind === POST.recruitment && !pitched) || ([4, 5, 6, 7, 8].includes(kind) && !(game && other))) continue;
      const T = mine && C.teamRef(mine),
        O = other && C.teamRef(other),
        P = pitched && C.teamRef(pitched),
        won = game ? game.winner === mine?.id : null;
      // Winner's score first, win or lose.
      const score = game && `${Math.max(game.homeScore, game.awayScore)}-${Math.min(game.homeScore, game.awayScore)}`;
      const record = game && (game.homeTeam === mine?.id ? game.homeRecord : game.awayRecord);
      const coach = C.coachForTeam(mine),
        fan = post.author?.fanData,
        city = mine?.city || T?.display;
      // What the player did, as a reporter would put it: [headline verb phrase, story verb phrase].
      const said = {
        [REPLY.creditTeammate]: ['gives a teammate the credit', 'gave a teammate the credit'],
        [REPLY.creditCoach]: coach
          ? [`credits Coach ${C.playerDisplay(coach)}`, `credited Coach ${C.playerDisplay(coach)}`]
          : [`credits ${his} coach`, `credited ${his} coach`],
        [REPLY.creditTeam]: ['credits the whole roster', 'credited the whole roster'],
        [REPLY.creditFans]: city
          ? [`thanks the fans in ${city}`, `thanked the fans in ${city}`]
          : ['thanks the fans', 'thanked the fans'],
        [REPLY.callOutTeammate]: ['calls out a teammate', 'called out a teammate'],
        [REPLY.callOutCoach]: ['questions the coaching staff', 'questioned the coaching staff'],
        [REPLY.callOutTeam]: ['calls out the team', 'called out the team'],
        [REPLY.callOutFans]: ['fires back at the fans', 'fired back at the fans'],
      }[reply];
      let headline, lead, label;
      if (kind === POST.recruitment) {
        // A school's pitch is answered with a yes, a no, thanks or a jab, whichever reply was picked.
        const tone =
          reply === REPLY.positive
            ? [
                `gives ${P.display} ${his} word`,
                `answered ${C.possessive(P.full)} pitch on Hoop Gram and gave the program ${his} word`,
                `gave ${his} word`,
              ]
            : reply === REPLY.negative
              ? [
                  `turns down ${P.display}`,
                  `turned down ${P.full} on Hoop Gram and said ${he || last} would forge ${his} own path`,
                  'turned it down',
                ]
              : weight(reply) === 2
                ? [
                    `thanks ${P.display} for the interest`,
                    `answered ${C.possessive(P.full)} pitch on Hoop Gram with thanks but no promises`,
                    'thanked them for the interest',
                  ]
                : [
                    `fires back at ${P.display}`,
                    `fired back at ${C.possessive(P.full)} pitch on Hoop Gram`,
                    'fired back at the pitch',
                  ];
        headline = `${name} ${tone[0]}`;
        lead = `${name} ${tone[1]}.`;
        label = tone[2];
      } else if (kind === POST.showcase || kind === POST.showcaseResults) {
        const when = kind === POST.showcase ? 'ahead of the Koality Showcase' : 'after the Koality Showcase';
        // Showcase teams are thrown together for one night, so credit goes to whoever got the player there.
        const showcase = {
          [REPLY.creditTeammate]: ['credits a Showcase teammate', 'credited a Showcase teammate'],
          [REPLY.creditCoach]: [`credits the coaches who got ${him} here`, `credited the coaches who got ${him} here`],
          [REPLY.creditTeam]: [`credits ${his} Showcase teammates`, `credited ${his} Showcase teammates`],
          [REPLY.creditFans]: ['thanks the fans', 'thanked the fans'],
        }[reply];
        const tone =
          reply === REPLY.positive
            ? ['embraces the Koality Showcase spotlight', `embraced the Hoop Gram buzz ${when}`]
            : reply === REPLY.negative
              ? ['brushes off the Koality Showcase hype', `pushed back on the Hoop Gram buzz ${when}`]
              : [`${(showcase || said)[0]} ${when}`, `${(showcase || said)[1]} on Hoop Gram ${when}`];
        headline = `${name} ${tone[0]}`;
        lead = `${name} ${tone[1]}.`;
        label = tone[1].split(' on Hoop Gram')[0];
      } else {
        const rivals = kind === POST.opponentWin || kind === POST.opponentLoss;
        const tone =
          reply === REPLY.positive
            ? rivals
              ? [`shows ${O.display} fans respect`, 'showed the other side some respect']
              : won
                ? ['soaks it in', 'soaked in the win']
                : [`keeps ${his} head up`, `kept ${his} head up`]
            : reply === REPLY.negative
              ? rivals
                ? [`trades jabs with ${O.display} fans`, 'traded jabs with the other side']
                : won
                  ? [`answers ${his} critics`, `answered ${his} critics`]
                  : ['deflects the blame', `said the loss was out of ${his} control`]
              : rivals && reply === REPLY.callOutFans
                ? [`fires back at ${O.display} fans`, 'fired back at the other side']
                : said;
        // The opponent is named once in a headline.
        const after = tone[0].includes(O.display)
          ? `${score} ${won ? 'win' : 'loss'}`
          : `${score} ${won ? 'win over' : 'loss to'} ${O.display}`;
        headline = `${name} ${tone[0]} after ${after}`;
        lead = `${name} ${tone[1]} on Hoop Gram after ${C.possessive(T.full)} ${score} ${won ? 'win over' : 'loss to'} ${O.full}.`;
        label = tone[1];
      }
      const also = posts.filter(x => x !== post && x.responseType !== reply).length;
      const paragraphs = [
        lead,
        post.author?.type === FAN_POST && fan?.fn && fan?.ln
          ? `${C.capitalize(he || last)} was answering a post from a fan, ${fan.fn} ${fan.ln}.`
          : '',
        game && Array.isArray(record) && record.length === 2 && kind !== POST.opponentWin && kind !== POST.opponentLoss
          ? `The ${won ? 'win moved' : 'loss dropped'} ${T.full} to ${record[0]}-${record[1]}.`
          : '',
        also
          ? `${C.capitalize(he || last)} also answered ${C.plural(also, 'other post')} about ${game ? 'the game' : 'it'}.`
          : '',
      ].filter(Boolean);
      result.push({
        story: {
          id: `${fp}:${year}:season:career-reply-${key}`,
          eventKey: `career-reply-${key}`,
          kind: 'season',
          type: 'Hoop Gram reply',
          fingerprint: fp,
          season: year,
          day: Math.max(1, (played ? played.dayIndex : post.day) + 1),
          templateVersion: 1,
          editorialVersion: 1,
          quotesEnabled: false,
          leagueName: league.leagueName,
          createdAt: new Date().toISOString(),
          headline,
          importance: weight(reply) === 3 ? 105 : 90,
          paragraphs,
          relatedTeams: [mine, other || pitched]
            .filter(Boolean)
            .map(t => ({ id: t.id, name: C.teamDisplay(t), logoURL: t.logoURL || null })),
          seasonSnapshot: {
            headers: ['Player', 'Team', 'Reply'],
            rows: [[name, T ? T.display : '—', C.capitalize(label)]],
            source: 'season.career',
            reply: {
              name,
              last,
              pronoun: he || null,
              post: kind,
              reply,
              did: label,
              team: T?.display || null,
              opponent: O?.display || P?.display || null,
              won,
              score,
            },
          },
        },
        context: {
          winner: game ? lookup.teams.get(game.winner) : mine,
          loser: game
            ? lookup.teams.get(game.winner === game.homeTeam ? game.awayTeam : game.homeTeam)
            : other || pitched || mine,
          home: game ? lookup.teams.get(game.homeTeam) : mine,
          game: game || { homeTeam: mine?.id },
          scenePlayer: player,
          gameBall: league.gameballs?.[Number(league.settings?.gameBall) || 0],
          sceneKind: 'interview',
          interviewVariant: 'player-close-up',
        },
      });
    }
    return result;
  }
  const candidates = league => [...showcaseStories(league), ...replyStories(league)];
  return { candidates, careerPlayer, upcomingShowcase, POST, REPLY };
});
