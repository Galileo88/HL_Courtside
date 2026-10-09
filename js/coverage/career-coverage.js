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
  function country(code) {
    try {
      return (code && regions?.of(code)) || null;
    } catch {
      return null;
    }
  }
  const skillLabels = {
    LAY: 'Finishing',
    DNK: 'Dunking',
    INS: 'Inside scoring',
    MID: 'Mid-range',
    TPT: 'Three-point',
    FTS: 'Free throws',
    DRB: 'Ball handling',
    PAS: 'Passing',
    ORE: 'Off. rebounding',
    DRE: 'Def. rebounding',
    STL: 'Steals',
    BLK: 'Shot blocking',
    STR: 'Strength',
    SPD: 'Speed',
    STM: 'Stamina',
  };
  // The career ceilings the game offers before a career starts, on its 0-10 potential scale (two per star).
  const ceilings = {
    10: 'the greatest player of all time',
    9: 'a first-ballot Hall of Famer',
    8: 'a perennial All-Star',
  };
  const starWords = ['zero', 'one', 'two', 'three', 'four', 'five'];
  const stars = pot => `${starWords[Math.floor(pot / 2)]}${pot % 2 ? '-and-a-half' : ''}-star`;
  const positionLabels = ['PG', 'G', 'SG', 'G/F', 'SF', 'F', 'PF', 'F/C', 'C'];
  const height = inches => (Number.isFinite(inches) && inches > 0 ? `${Math.floor(inches / 12)}-${inches % 12}` : null);
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

  function candidates(league) {
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
      from = country(player.ctry),
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
    const size = [height(player.ht)?.replace('-', '-foot-'), player.wt > 0 && `${player.wt} pounds`]
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
          `${name}${bio ? `, ${bio},` : ''} opens ${he ? his : 'a'} career in the ${event}, the all-star game where college programs get their look at the top high school prospects.`,
          `${subject} wears No. ${player.num} and ${starters(team).includes(player) ? 'starts' : 'comes off the bench'} for ${T.full} against ${O.full}${arena ? ` at ${arena}` : ''}.`,
          size
            ? traits.length
              ? `At ${size}, ${last} brings a college-ready frame, and ${his} ${C.listJoin(traits.map(t => strengths[t.key]))} ${traits.length === 1 ? 'ranks' : 'rank'} among the best in the showcase field.`
              : `${C.capitalize(last)} checks in at ${size}.`
            : '',
          others.length
            ? `${C.capitalize(last)} won't be the only player from ${from || 'home'} on the floor: ${C.listJoin([
                ...sameSide.map(p => `${C.playerDisplay(p)} is a teammate on ${T.full}`),
                ...(otherSide.length
                  ? [
                      `${C.listJoin(otherSide.map(p => C.playerDisplay(p)))} ${otherSide.length === 1 ? 'suits' : 'suit'} up for ${O.full}`,
                    ]
                  : []),
              ])}.`
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

    // 2. The ceiling: how good the player can become and where the growth has to come from.
    if (Number.isInteger(player.pot) && player.pot > 0) {
      const skills = Object.keys(strengths)
        .filter(key => Array.isArray(player.attributes?.[key]))
        .map(key => ({ key, now: player.attributes[key][0], top: player.attributes[key][1] }))
        .filter(x => Number.isFinite(x.now) && Number.isFinite(x.top));
      const growth = skills.filter(x => x.top > x.now).sort((a, b) => b.top - b.now - (a.top - a.now) || b.top - a.top);
      const most = growth.length ? growth[0].top - growth[0].now : 0;
      const room = growth.filter(x => x.top - x.now === most).slice(0, 3),
        done = skills.filter(x => x.top === x.now && x.top >= 15);
      const peers = field.filter(p => p.id !== player.id && p.pot === player.pot).length;
      const ceiling = ceilings[player.pot] || null;
      result.push({
        story: story(`career-potential-${player.id}`, {
          type: 'Career',
          headline: ceiling
            ? `${name}'s ceiling: ${ceiling.replace(/^(a|the) /, '')}`
            : `${name} brings a ${stars(player.pot)} ceiling to the ${event}`,
          importance: 115,
          paragraphs: [
            ceiling
              ? `${name} arrives at the ${event} with the ceiling of ${ceiling}.`
              : `${name} arrives at the ${event} as a ${stars(player.pot)} prospect.`,
            room.length ? `The most room to grow is in ${his} ${C.listJoin(room.map(x => strengths[x.key]))}.` : '',
            done.length
              ? `${C.capitalize(his)} ${C.listJoin(done.map(x => strengths[x.key]))} ${done.length === 1 ? 'is' : 'are'} already fully developed.`
              : '',
            ceiling
              ? `A ceiling that high is a long climb, and it starts in the ${event}.`
              : `The climb starts in the ${event}.`,
          ].filter(Boolean),
          seasonSnapshot: {
            headers: ['Skill', 'Now', 'Ceiling'],
            rows: [...growth, ...skills.filter(x => !growth.includes(x))]
              .slice(0, 10)
              .map(x => [skillLabels[x.key], x.now, x.top]),
            board: {
              kicker: 'Room to grow',
              title: name,
              headers: ['Skill', 'Now', 'Ceiling'],
              rows: [...growth, ...skills.filter(x => !growth.includes(x))]
                .slice(0, 10)
                .map(x => [skillLabels[x.key], x.now, x.top]),
              lead: false,
            },
            source: 'season.career',
            potential: {
              event,
              name,
              last,
              pronoun: he || null,
              potential: player.pot,
              stars: stars(player.pot),
              ceiling,
              room: room.map(x => strengths[x.key]),
              developed: done.map(x => strengths[x.key]),
              peers,
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
            ? `The ${worldly.R.display} roster has a global feel, with players from ${C.listJoin(worldly.countries.map(c => country(c) || c))}.`
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
  return { candidates, careerPlayer, upcomingShowcase };
});
