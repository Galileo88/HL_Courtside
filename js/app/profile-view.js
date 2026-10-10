/* Player, coach and team pages, opened from names in articles. */
(() => {
  'use strict';
  const C = window.HoopWireCore;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const per = (s, k) => (Number.isFinite(s?.[k]) && s.GP > 0 ? (s[k] / s.GP).toFixed(1) : '—');
  const pct = (s, m, a) => (s?.[a] > 0 && Number.isFinite(s[m]) ? `${((100 * s[m]) / s[a]).toFixed(1)}%` : '—');
  const split = (s, m, a) => (Number.isFinite(s?.[m]) && Number.isFinite(s?.[a]) ? `${s[m]}-${s[a]}` : '—');
  const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  const record = s => (Number.isFinite(s?.W) && Number.isFinite(s?.L) ? `${s.W}-${s.L}` : '—');
  let regionNames = null;
  function country(code) {
    try {
      regionNames ||= new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(code) || code;
    } catch {
      return code;
    }
  }
  // "#player/<league>/<id>" for the profile saved as "<league>:player:<id>".
  function href(id) {
    const [kind, ref] = id.split(':').slice(-2),
      fingerprint = id.slice(0, -(kind.length + ref.length + 2));
    return `#${kind}/${encodeURIComponent(fingerprint)}/${ref}`;
  }
  function route(hash) {
    const m = hash.match(/^#(player|coach|team)\/([^/]+)\/(-?\d+)$/);
    if (!m) return null;
    const fingerprint = decodeURIComponent(m[2]);
    return { kind: m[1], fingerprint, id: `${fingerprint}:${m[1]}:${m[3]}`, ref: Number(m[3]) };
  }
  function section(title, ...content) {
    const wrap = el('section', 'profile-section');
    wrap.append(el('h2', 'profile-section-title', title), ...content.filter(Boolean));
    return wrap;
  }
  // A player's or coach's head and shoulders in the game's sprite: a player in the team's home uniform,
  // a coach (or a retired player with a suit) in the suit.
  function portrait(profile) {
    const look = profile.look,
      sprites = window.HoopWirePlayer;
    if (!look?.appearance || !sprites) return null;
    const canvas = el('canvas', 'profile-portrait');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Portrait of ${profile.name}`);
    const suited = look.coach || (profile.retired && look.suits?.length > 0);
    const person = {
      appearance: look.appearance,
      accessories: look.accessories || [],
      suits: look.suits || [],
      num: suited ? null : look.num,
      isCoach: !!look.coach,
      wearsSuit: suited && !look.coach,
    };
    // Facing right, framed on the eyes: every sprite shares the game's head, so the eyes sit at the same spot
    // (column 16.5, row 18 facing right) and a 19 x 18 window, columns 7 to 25 and rows 9 to 26, centers them
    // exactly with the shoulders below. Big hair runs past the edge. Five screen pixels per sprite pixel.
    canvas.width = 95;
    canvas.height = 90;
    sprites
      .ready()
      .then(() => {
        const small = document.createElement('canvas');
        small.width = 32;
        small.height = 42;
        sprites.draw(small, person, look.team, 0, 0, 'idle', 'right');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 7, 9, 19, 18, 0, 0, 95, 90);
      })
      .catch(() => canvas.remove());
    return canvas;
  }
  function header(profile, kicker, lines, logo) {
    const head = el('header', 'profile-header');
    const face = logo ? null : portrait(profile);
    if (face) head.append(face);
    if (logo && window.HoopWireCourt?.validURL(logo)) {
      // The logo takes its space only once it has loaded.
      const img = el('img', 'profile-logo');
      img.hidden = true;
      img.alt = '';
      img.addEventListener('load', () => (img.hidden = false), { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      img.src = logo;
      head.append(img);
    }
    const text = el('div', 'profile-heading');
    text.append(el('p', 'article-meta', kicker), el('h1', 'article-headline profile-name', profile.name));
    for (const line of lines.filter(Boolean)) {
      const p = el('p', 'profile-line');
      for (const part of [].concat(line)) p.append(typeof part === 'string' ? document.createTextNode(part) : part);
      text.append(p);
    }
    head.append(text);
    return head;
  }
  function link(text, target) {
    const a = el('a', 'entity-link', text);
    a.href = target;
    return a;
  }
  function bioLine(p) {
    const player = p.kind === 'player';
    return [
      // Profiles saved before heights read 7'0" stored "7-0".
      player && p.height ? p.height.replace(/^(\d+)-(\d+)$/, `$1'$2"`) : null,
      player && p.weight ? `${p.weight} lbs` : null,
      p.age ? `Age ${p.age}` : null,
      [p.hometown, p.country ? country(p.country) : null].filter(Boolean).join(', ') || null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  // College players by class, as the stories write it (Fr., So., Jr., Sr.); pros by seasons in the league,
  // this one included, with a first-year pro called a rookie.
  function seasonLabel(p) {
    if (p.years == null) return null;
    if (p.leagueType === 1) return ['Fr.', 'So.', 'Jr.', 'Sr.'][Math.min(3, Math.max(0, p.years))];
    return p.years === 0 ? 'Rookie' : `Years Pro: ${p.years + 1}`;
  }
  function stories(ctx, profile) {
    const name = profile.name;
    return [...ctx.state.stories.values()]
      .filter(
        s =>
          s.fingerprint === profile.fingerprint &&
          ((profile.kind === 'player' && s.playerId === profile.ref) ||
            (profile.kind === 'team' && (s.relatedTeams || []).some(t => t.id === profile.ref)) ||
            [s.headline, ...(s.paragraphs || [])].some(t => typeof t === 'string' && t.includes(name)))
      )
      .sort((a, b) => Number(b.season) - Number(a.season) || b.day - a.day || b.importance - a.importance)
      .slice(0, 8);
  }
  function newsList(ctx, profile) {
    const list = stories(ctx, profile);
    if (!list.length) return null;
    const ul = el('ul', 'profile-news');
    for (const s of list) {
      const li = el('li');
      li.append(link(s.headline, ctx.storyHref(s.id)), el('span', 'profile-news-date', ` ${s.season} · Day ${s.day}`));
      ul.append(li);
    }
    return section('In the news', ul);
  }
  function awardsList(awards) {
    if (!awards?.length) return null;
    const ul = el('ul', 'profile-awards');
    for (const a of awards) {
      const li = el('li');
      li.append(el('strong', '', a.name), document.createTextNode(` ${a.years.join(', ')}`));
      ul.append(li);
    }
    return section('Awards', ul);
  }
  // The box scores HoopWire stored for this player, newest first.
  function gameLog(ctx, profile) {
    const league = ctx.state.leagues.find(l => l.id === profile.fingerprint);
    return [...ctx.state.snapshots.values()]
      .filter(s => s.fingerprint === profile.fingerprint && s.pid === profile.ref)
      .sort((a, b) => Number(b.season) - Number(a.season) || b.day - a.day)
      .map(s => {
        const game = league?.gameResults?.[s.season]?.[s.day]?.[s.gid],
          mine = game && [game.home, game.away].find(t => t.id === s.team?.id),
          them = game && [game.home, game.away].find(t => t !== mine);
        const result = mine && them ? `${mine.score > them.score ? 'W' : 'L'} ${mine.score}-${them.score}` : '';
        const opponent = them ? `${game.home === mine ? 'vs.' : 'at'} ${C.teamRef({ name: them.name }).nickname}` : '';
        const recap = `${profile.fingerprint}:${s.season}:game:${s.gid}`;
        return {
          label: [`Day ${s.day}`, opponent, result].filter(Boolean).join(' · '),
          href: ctx.state.stories.has(recap) ? ctx.storyHref(recap) : null,
          season: s.season,
          s: s.stats,
        };
      });
  }
  const minutes = s => (Array.isArray(s?.MIN) && Number.isFinite(s.MIN[0]) ? Math.round(s.MIN[0] / 60) : '—');
  function boxRows(games) {
    return games.map(g => [
      g.label,
      minutes(g.s),
      g.s.PTS,
      g.s.REB,
      g.s.AST,
      g.s.STL,
      g.s.BLK,
      split(g.s, 'FGM', 'FGA'),
      split(g.s, 'TPM', 'TPA'),
      split(g.s, 'FTM', 'FTA'),
    ]);
  }
  const BOX = ['Game', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG', '3PT', 'FT'];
  const AVERAGES = ['GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%', 'FT%'];
  const averages = s => [
    s.GP,
    per(s, 'MIN'),
    per(s, 'PTS'),
    per(s, 'REB'),
    per(s, 'AST'),
    per(s, 'STL'),
    per(s, 'BLK'),
    pct(s, 'FGM', 'FGA'),
    pct(s, 'TPM', 'TPA'),
    pct(s, 'FTM', 'FTA'),
  ];
  function combine(rows) {
    const out = {};
    for (const r of rows)
      for (const [k, v] of Object.entries(r))
        if (Number.isFinite(v) && !['yr', 'tid'].includes(k)) out[k] = (out[k] || 0) + v;
    return out;
  }

  function player(ctx, p) {
    const team = p.teamId != null ? `${p.fingerprint}:team:${p.teamId}` : null,
      teamName = p.seasons.filter(s => s.tid === p.teamId).at(-1)?.team;
    const role = [p.number != null ? `#${p.number}` : null, p.position ? shortPosition(p.position) : null]
      .filter(Boolean)
      .join(' · ');
    // Experience follows the team: "#34 · PG · Trojans · Sr.", and never breaks across lines.
    const label = p.retired ? null : seasonLabel(p),
      experience = label && el('span', 'profile-nowrap', label);
    const lines = [
      [
        role,
        ...(team && teamName ? [role ? ' · ' : '', link(teamName, href(team))] : p.retired ? [' · Retired'] : []),
        ...(experience ? [role || (team && teamName) ? ' · ' : '', experience] : []),
      ],
      bioLine(p),
    ];
    const out = [header(p, `Player · ${p.leagueName}`, lines)];
    const year = p.asOf.season,
      now = ['season', 'playoffs']
        .map(period => ({ period, s: combine(p.seasons.filter(s => s.yr === year && s.period === period)) }))
        .filter(x => x.s.GP > 0);
    if (now.length)
      out.push(
        section(
          `${year} season`,
          ctx.statBoard({
            kicker: 'Per game',
            title: `${year} averages`,
            headers: ['', ...AVERAGES],
            rows: now.map(x => [x.period === 'season' ? 'Regular season' : 'Playoffs', ...averages(x.s)]),
            highlight: false,
            marker: false,
            optional: ['MIN', 'STL', 'BLK', 'FT%'],
          })
        )
      );
    const games = gameLog(ctx, p);
    if (games.length) {
      out.push(
        section(
          'Latest game',
          ctx.statBoard({
            kicker: `${games[0].season} · Box score`,
            title: games[0].label,
            headers: BOX,
            rows: boxRows([{ ...games[0], label: games[0].href ? 'Recap' : 'Box score' }]),
            links: [games[0].href],
            highlight: false,
            marker: false,
            optional: ['MIN', 'STL', 'BLK', 'FT'],
          })
        )
      );
      if (games.length > 1)
        out.push(
          section(
            'Game log',
            ctx.statBoard({
              kicker: 'Recent games',
              title: `Last ${Math.min(10, games.length)}`,
              headers: BOX,
              rows: boxRows(games.slice(0, 10)),
              links: games.slice(0, 10).map(g => g.href),
              highlight: false,
              marker: false,
              optional: ['MIN', 'STL', 'BLK', 'FT'],
            })
          )
        );
    }
    for (const period of ['season', 'playoffs']) {
      const rows = p.seasons.filter(s => s.period === period);
      if (!rows.length) continue;
      const total = combine(rows);
      out.push(
        section(
          period === 'season' ? 'Career' : 'Career playoffs',
          ctx.statBoard({
            kicker: period === 'season' ? 'Regular season' : 'Playoffs',
            title: 'By season',
            headers: ['Season', 'Team', ...AVERAGES],
            rows: [
              ...rows.map(s => [String(s.yr), s.team ? C.teamRef({ name: s.team }).nickname : '—', ...averages(s)]),
              ...(rows.length > 1 ? [['Career', '', ...averages(total)]] : []),
            ],
            highlight: false,
            marker: false,
            optional: ['MIN', 'STL', 'BLK', 'FT%', '3P%'],
          })
        )
      );
    }
    const labels = { PTS: 'Points', REB: 'Rebounds', AST: 'Assists', STL: 'Steals', BLK: 'Blocks', TPM: '3-pointers' };
    const highs = ['season', 'playoffs'].filter(k => Object.keys(p.highs?.[k] || {}).length);
    if (highs.length) {
      const keys = Object.keys(labels).filter(k => highs.some(h => p.highs[h][k] != null));
      out.push(
        section(
          'Career highs',
          ctx.statBoard({
            kicker: 'Single game',
            title: 'Career highs',
            headers: ['', ...keys.map(k => labels[k])],
            rows: highs.map(h => [
              h === 'season' ? 'Regular season' : 'Playoffs',
              ...keys.map(k => p.highs[h][k] ?? '—'),
            ]),
            highlight: false,
            marker: false,
          })
        )
      );
    }
    out.push(awardsList(p.awards), newsList(ctx, p));
    return out;
  }

  function coach(ctx, c) {
    const team = c.teamId != null ? `${c.fingerprint}:team:${c.teamId}` : null,
      teamName = team ? ctx.teams.get(team)?.name : null;
    const lines = [
      teamName ? ['Head coach · ', link(teamName, href(team))] : 'Head coach',
      bioLine(c),
      c.years ? `${ordinal(c.years + 1)} season` : null,
    ];
    const rows = [
      c.current?.GP > 0 ? [`${c.asOf.season} season`, record(c.current), winPct(c.current)] : null,
      // A first-year coach's career is this season, so it isn't repeated.
      c.career?.season?.GP > (c.current?.GP || 0) ? ['Career', record(c.career.season), winPct(c.career.season)] : null,
      c.career?.playoffs?.GP > 0 ? ['Career playoffs', record(c.career.playoffs), winPct(c.career.playoffs)] : null,
    ].filter(Boolean);
    return [
      header(c, `Coach · ${c.leagueName}`, lines),
      rows.length
        ? section(
            'Record',
            ctx.statBoard({
              kicker: 'Wins and losses',
              title: 'Coaching record',
              headers: ['', 'W-L', 'Win %'],
              rows,
              highlight: false,
              marker: false,
            })
          )
        : null,
      awardsList(c.awards),
      newsList(ctx, c),
    ];
  }
  const winPct = s => (s.W + s.L > 0 ? (s.W / (s.W + s.L)).toFixed(3).replace(/^0/, '') : '—');

  function team(ctx, t, roster) {
    const coachId = t.coachId != null ? `${t.fingerprint}:coach:${t.coachId}` : null,
      coachName = coachId ? ctx.coaches.get(coachId)?.name : null,
      current = t.seasons.find(s => s.yr === t.asOf.season),
      r = t.ranks;
    const lines = [
      current
        ? [
            `${record(current.regular)}${r?.record ? ` · ${ordinal(r.record)} in the league` : ''}${current.poll ? ` · No. ${current.poll} in the poll` : ''}`,
          ]
        : null,
      [
        coachName ? 'Coach ' : '',
        ...(coachName ? [link(coachName, href(coachId))] : []),
        t.arena ? `${coachName ? ' · ' : ''}${t.arena}` : '',
      ],
      t.titles?.length
        ? `${t.titles.length === 1 ? 'Champions' : `${t.titles.length}-time champions`}: ${t.titles.join(', ')}`
        : null,
    ];
    const out = [header(t, `Team · ${t.leagueName}`, lines, t.logoURL)];
    if (current) {
      const s = current.regular;
      const stats = [
        ['PTS', per(s, 'PTS'), r?.PTS],
        ['OPP', per(s, 'OPP'), r?.OPP],
        ['Margin', s.GP > 0 ? ((s.PTS - s.OPP) / s.GP).toFixed(1) : '—', r?.margin],
        ['FG%', pct(s, 'FGM', 'FGA'), r?.FG],
        ['3P%', pct(s, 'TPM', 'TPA'), r?.TP],
        ['REB', per(s, 'REB'), r?.REB],
        ['AST', per(s, 'AST'), r?.AST],
        ['STL', per(s, 'STL'), r?.STL],
        ['BLK', per(s, 'BLK'), r?.BLK],
        ['TO', per(s, 'TO'), r?.TO],
      ];
      out.push(
        section(
          `${t.asOf.season} team stats`,
          ctx.statBoard({
            kicker: 'Per game',
            title: r?.of ? `League rank out of ${r.of}` : 'Team stats',
            headers: ['', ...stats.map(x => x[0])],
            rows: [
              ['Per game', ...stats.map(x => x[1])],
              ...(r ? [['Rank', ...stats.map(x => (x[2] ? ordinal(x[2]) : '—'))]] : []),
            ],
            highlight: false,
            marker: false,
            optional: ['Margin', 'STL', 'BLK', 'TO'],
          })
        )
      );
    }
    if (roster.length) {
      const year = t.asOf.season;
      const rows = roster
        .map(p => ({ p, s: combine(p.seasons.filter(s => s.yr === year && s.period === 'season' && s.tid === t.ref)) }))
        .sort((a, b) => (b.s.GP > 0 ? b.s.PTS / b.s.GP : -1) - (a.s.GP > 0 ? a.s.PTS / a.s.GP : -1));
      out.push(
        section(
          'Roster',
          ctx.statBoard({
            kicker: `${year} season`,
            title: 'Players',
            headers: ['Player', 'POS', ...AVERAGES.slice(0, 7), 'FG%'],
            rows: rows.map(({ p, s }) => [
              p.name,
              shortPosition(p.position),
              s.GP || 0,
              per(s, 'MIN'),
              per(s, 'PTS'),
              per(s, 'REB'),
              per(s, 'AST'),
              per(s, 'STL'),
              per(s, 'BLK'),
              pct(s, 'FGM', 'FGA'),
            ]),
            links: rows.map(({ p }) => href(p.id)),
            optional: ['MIN', 'STL', 'BLK'],
            highlight: true,
          })
        )
      );
    }
    const league = ctx.state.leagues.find(l => l.id === t.fingerprint),
      results = Object.entries(league?.gameResults?.[t.asOf.season] || {})
        .flatMap(([day, games]) => Object.values(games).map(g => ({ day: Number(day), g })))
        .filter(({ g }) => g.home?.id === t.ref || g.away?.id === t.ref)
        .sort((a, b) => b.day - a.day)
        .slice(0, 10);
    if (results.length)
      out.push(
        section(
          'Results',
          ctx.statBoard({
            kicker: `${t.asOf.season} season`,
            title: 'Recent games',
            headers: ['Game', 'Result', 'Score'],
            rows: results.map(({ day, g }) => {
              const home = g.home.id === t.ref,
                mine = home ? g.home : g.away,
                them = home ? g.away : g.home;
              return [
                `Day ${day} · ${home ? 'vs.' : 'at'} ${C.teamRef({ name: them.name }).nickname}`,
                mine.score > them.score ? 'W' : 'L',
                `${mine.score}-${them.score}`,
              ];
            }),
            links: results.map(({ g }) => {
              const id = `${t.fingerprint}:${t.asOf.season}:game:${g.gid}`;
              return ctx.state.stories.has(id) ? ctx.storyHref(id) : null;
            }),
            highlight: false,
            marker: false,
          })
        )
      );
    if (t.seasons.length > 1)
      out.push(
        section(
          'History',
          ctx.statBoard({
            kicker: 'By season',
            title: 'Season records',
            headers: ['Season', 'W-L', 'PTS', 'OPP', 'Playoffs'],
            rows: [...t.seasons]
              .reverse()
              .map(s => [
                String(s.yr),
                record(s.regular),
                per(s.regular, 'PTS'),
                per(s.regular, 'OPP'),
                s.playoffs ? `${record(s.playoffs)}${t.titles.includes(s.yr) ? ' · Champions' : ''}` : '—',
              ]),
            highlight: false,
            marker: false,
          })
        )
      );
    out.push(newsList(ctx, t));
    return out;
  }
  function shortPosition(name) {
    return (
      {
        'point guard': 'PG',
        'combo guard': 'G',
        'shooting guard': 'SG',
        wing: 'G/F',
        'small forward': 'SF',
        forward: 'F',
        'power forward': 'PF',
        'forward-center': 'F/C',
        center: 'C',
      }[name] || '—'
    );
  }

  // Draws the page for a profile route; returns false when the profile isn't in the archive.
  async function render(feed, r, ctx) {
    const profile = await ctx.archive.get('profiles', r.id);
    if (!profile) return false;
    const related = new Map();
    const load = async ids => {
      for (const p of await Promise.all(ids.map(id => ctx.archive.get('profiles', id)))) if (p) related.set(p.id, p);
    };
    if (profile.kind === 'player' && profile.teamId != null)
      await load([`${profile.fingerprint}:team:${profile.teamId}`]);
    if (profile.kind === 'coach' && profile.teamId != null)
      await load([`${profile.fingerprint}:team:${profile.teamId}`]);
    if (profile.kind === 'team') {
      await load([
        ...profile.roster.map(id => `${profile.fingerprint}:player:${id}`),
        ...(profile.coachId != null ? [`${profile.fingerprint}:coach:${profile.coachId}`] : []),
      ]);
    }
    const page = { ...ctx, teams: related, coaches: related };
    const parts =
      profile.kind === 'player'
        ? player(page, profile)
        : profile.kind === 'coach'
          ? coach(page, profile)
          : team(
              page,
              profile,
              profile.roster.map(id => related.get(`${profile.fingerprint}:player:${id}`)).filter(Boolean)
            );
    const article = el('article', 'article-card profile');
    article.append(...parts.filter(Boolean));
    article.append(el('p', 'profile-asof', `Updated through ${profile.asOf.season}, Day ${profile.asOf.day}.`));
    feed.append(article);
    return true;
  }

  window.HoopWireProfileView = { render, route, href };
})();
