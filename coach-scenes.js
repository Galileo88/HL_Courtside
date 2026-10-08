/* Coach story scenes, built from the game's own art at the game's scale:
   the game's arena (stairs, crowd, court), the bench chairs and sitting and
   celebrating sprites, the press wall and podium, the locker room. The
   camera frames a 384 x 216 piece of the world at 2x, the same framing as
   the wide action shots, so people are their native 32 x 42. */
(() => {
  "use strict";
  const art = {};
  let ready;
  const files = ['crowd-100', 'crowd-50', 'crowd-0', 'stairs', 'announce-table', 'guard-rails', 'spectator-body', 'spectator-head-m', 'spectator-head-f', 'spectator-cheer-m', 'spectator-cheer-f', 'headset', 'chair', 'championship', 'natty', 'confetti', 'camera-flash', 'draft-podium', 'locker-room'];
  function load() {
    ready ||= Promise.all(files.map(async name => { const image = new Image(); image.src = `scene-assets/${name}.png`; await image.decode(); art[name] = image; }));
    return ready;
  }
  const hex = value => /^#?[\da-f]{6}$/i.test(String(value || '')) ? '#' + String(value).replace('#', '') : null;
  const rgb = value => { const v = hex(value) || '#808080'; return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); };
  const teamColor = (team, slot, fallback) => hex(team?.teamColors?.[slot]) || fallback;
  function seeded(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // The game's arena, rebuilt from its court scene. Every piece is a
  // 32-pixel-per-unit sprite under a flat orthographic camera; a unit
  // position (x, y) sits at pixel (1024 + 32x, 512 - 32y) of the 2048 x 1024
  // crowd sheet, with the 1024 x 512 court centered in it. Draw order follows
  // the game's sorting layers: the court on Background; then on Default the
  // stairs (-1000), the crowd sheet (-900), the guard rails (-656), bench
  // and announcer chairs (-653) and the announce table (-650); then the
  // seated bench players and announcers (-2), and the live fans in the front
  // rows: chairs (0), bodies (1), heads (2), each layer back to front.
  const COURT = [512, 256], px = (x, y) => [1024 + 32 * x, 512 - 32 * y];
  // Only the far stands (the top 320 rows) are kept, since the camera never turns around.
  const FAN_ROWS = [8.5, 8, 7.5], FAN_BLOCKS = [[-10.75, -5.25], [-2.75, 2.75], [5.25, 10.75]];
  const BENCH = { home: [2.5, 11], road: [-11, -2.5] }, ANNOUNCERS = [-1.4, -0.6, 0.6, 1.4];
  const seatsOf = ([a, b]) => Array.from({ length: Math.round((b - a) / .5) + 1 }, (_, i) => a + i * .5);
  // The game recolors the crowd with its ColorSwap shader; here the fans' blue shirts take the home team's primary.
  function tinted(image, color) {
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height), base = rgb(color);
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
      if (!data.data[i + 3] || b < 100 || b < r + 60 || b < g) continue;
      const light = Math.max(.45, Math.min(1.25, (g + b) / 330));
      data.data[i] = Math.min(255, base[0] * light); data.data[i + 1] = Math.min(255, base[1] * light); data.data[i + 2] = Math.min(255, base[2] * light);
    }
    ctx.putImageData(data, 0, 0); return canvas;
  }
  function recolor(image, color) {
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
  function stage(camera) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 432;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const [x, y, w] = camera, s = 768 / w;
    const world = () => ctx.setTransform(s, 0, 0, s, -x * s, -y * s), screen = () => ctx.setTransform(1, 0, 0, 1, 0, 0);
    world();
    return { canvas, ctx, world, screen };
  }
  function person(ctx, data, team, pose, frame, x, foot, facing = 'left', uniform = 0) {
    if (!data) return;
    const tile = document.createElement('canvas'); tile.width = 128; tile.height = 168;
    window.HoopWirePlayer.draw(tile, data, team, uniform, frame, pose, facing, {});
    ctx.drawImage(tile, x - 16, foot - 42, 32, 42);
  }
  function shadow(ctx, x, foot, w = 11) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, foot - 2, w, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  // One 32 x 32 cell of a three-column atlas.
  const cell = (ctx, image, index, x, y, size = 32, cols = 3) => ctx.drawImage(image, index % cols * 32, Math.floor(index / cols) * 32, 32, 32, x, y, size, size);
  // A live fan: the game's spectator body and head, recolored per fan the way
  // its ColorSwap shader does (skin, hair, shirt, pants, shoes).
  const SKIN = ['#f3c9a4', '#e0ac69', '#c68642', '#a86b3c', '#8d5524', '#5c3a21'], HAIR = ['#1f1a24', '#3b2219', '#5a3a1e', '#8c6b3e', '#2b2b2b', '#c9a36a', '#7a7a7a'];
  const PANTS = ['#2e3a59', '#22222a', '#555a66', '#8a7a5c'], SHOES = ['#e8e8e8', '#222228', '#c8c8c8'];
  function swap(image, index, map) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true }); cell(g, image, index, 0, 0);
    const d = g.getImageData(0, 0, 32, 32);
    for (let i = 0; i < d.data.length; i += 4) {
      if (!d.data[i + 3]) continue;
      const hit = map[`${d.data[i]},${d.data[i + 1]},${d.data[i + 2]}`];
      if (hit) { d.data[i] = hit[0]; d.data[i + 1] = hit[1]; d.data[i + 2] = hit[2]; }
    }
    g.putImageData(d, 0, 0); return c;
  }
  const shade = (color, k) => rgb(color).map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  // The game's UpdateAwardColors: the trophy's ColorSwap keys on each pixel's
  // red channel. Primary (the column) takes 237, 231 at 1.3x and 229 at 0.7x;
  // secondary (the ball) 163, 219 and 103; base 38, 57 and 20; plate 227 and 221 at 1.3x.
  function trophy(colors) {
    const image = ['championship', 'natty'].includes(colors?.sprite) ? art[colors.sprite] : art.championship;
    if (!colors) return image;
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), map = {};
    for (const [key, slots] of [['primary', [237, 231, 229]], ['secondary', [163, 219, 103]], ['base', [38, 57, 20]], ['plate', [227, 221]]]) {
      if (!hex(colors[key])) continue;
      slots.forEach((red, i) => { map[red] = shade(colors[key], [1, 1.3, .7][i]); });
    }
    for (let i = 0; i < d.data.length; i += 4) { const hit = d.data[i + 3] && map[d.data[i]]; if (hit) { d.data[i] = hit[0]; d.data[i + 1] = hit[1]; d.data[i + 2] = hit[2]; } }
    g.putImageData(d, 0, 0); return c;
  }
  function fan(rand, team, cheer) {
    const pick = list => list[Math.floor(rand() * list.length)], skin = pick(SKIN), hair = pick(HAIR);
    const r = rand(), shirt = r < .55 ? teamColor(team, 0, '#147dff') : r < .85 ? teamColor(team, 1, '#ffffff') : '#f2f2f2', pants = pick(PANTS), shoe = pick(SHOES);
    const head = { '220,129,88': shade(skin, 1), '215,85,66': shade(skin, .82), '225,174,120': shade(skin, 1.12), '50,175,0': shade(skin, 1), '45,60,90': shade(hair, 1),
      '20,125,255': shade(shirt, 1), '10,175,255': shade(shirt, 1.15), '5,200,255': shade(shirt, 1.3) };
    const body = { '25,75,255': shade(pants, 1), '35,25,255': shade(pants, .78), '20,125,255': shade(pants, 1.15), '195,36,58': shade(shoe, 1), '205,172,190': shade(shoe, .8) };
    const sheet = art[`spectator-${cheer ? 'cheer' : 'head'}-${rand() < .5 ? 'm' : 'f'}`];
    return { body: swap(art['spectator-body'], 0, body), head: swap(sheet, cheer ? Math.floor(rand() * 3) : 0, head) };
  }
  async function arena(scene, crowd, camera, rand, { fill = 1, cheer = false, bench = [], benchPose = 'bench-idle', announcers = [] } = {}) {
    // The floor, the crowd and the fans belong to the home team of the arena.
    const team = scene.venue || scene.team, floor = await window.HoopWireCourt.render(team, { includeHoops: false });
    const { canvas, ctx } = stage(camera);
    ctx.fillStyle = 'rgb(20,16,32)'; ctx.fillRect(camera[0], camera[1], camera[2], camera[3]);
    ctx.drawImage(floor.canvas, ...COURT);
    ctx.drawImage(art.stairs, 0, 0);
    ctx.drawImage(tinted(art[crowd], teamColor(team, 0, '#147dff')), 0, 0);
    ctx.drawImage(art['guard-rails'], 512, px(0, 6.78)[1] - 12);
    // Chairs for both benches and the announcers, then the table.
    for (const x of [...seatsOf(BENCH.home), ...seatsOf(BENCH.road)]) { const [cx, cy] = px(x, 6.25); cell(ctx, art.chair, 0, cx - 16, cy - 16); }
    for (const x of ANNOUNCERS) { const [cx, cy] = px(x, 6.42); cell(ctx, art.chair, 0, cx - 16, cy - 16); }
    ctx.drawImage(art['announce-table'], px(0, 5.72)[0] - 64, px(0, 5.72)[1] - 32);
    // Seated bench players and announcers: feet at the sitting sprite's bottom pivot.
    for (const b of bench) { const [x, y] = px(b.seat, 5.75); person(ctx, b.data, scene.team, benchPose, b.frame || 0, x, y + 1, 'left'); }
    announcers.forEach((a, i) => { if (!a) return; const [x, y] = px(ANNOUNCERS[i], 5.92); person(ctx, a, team, 'sitting', 0, x, y + 1, 'left'); const [hx, hy] = px(ANNOUNCERS[i], 6.67); cell(ctx, art.headset, 0, hx - 16, hy - 16, 32, 2); });
    // The live fans in the front rows of each far section, back row first.
    const seats = [];
    for (const y of FAN_ROWS) for (const block of FAN_BLOCKS) for (const x of seatsOf(block)) seats.push([x, y]);
    const fans = seats.map(([x, y]) => ({ x, y, f: rand() < fill ? fan(rand, team, cheer && rand() < .7) : null }));
    for (const s of fans) { const [x, y] = px(s.x, s.y); cell(ctx, art.chair, 0, x - 16, y - 16); }
    for (const s of fans) if (s.f) { const [x, y] = px(s.x, s.y); ctx.drawImage(s.f.body, x - 16, y - 16); }
    for (const s of fans) if (s.f) { const [x, y] = px(s.x, s.y + .25); ctx.drawImage(s.f.head, x - 16, y - 16); }
    return { canvas, ctx, customCourt: floor.customCourt };
  }
  function depth(ctx, list) { list.filter(a => a.data).sort((a, b) => a.foot - b.foot).forEach(a => { shadow(ctx, a.x, a.foot); person(ctx, a.data, a.team, a.pose, a.frame, a.x, a.foot, a.facing, a.uniform || 0); }); }

  const scenes = {
    // The introductory press conference: the wall, the podium, the cameras.
    async hire(scene, rand, sceneArt) {
      const { canvas, ctx, world, screen } = stage([0, 0, 384, 216]);
      screen();
      const wall = await window.HoopWirePressBackdrop.render(sceneArt['press-background'], scene.team, scene.pressLogoData, { scale: 1, league: scene.league, leagueData: scene.pressLeagueLogoData });
      window.HoopWirePressBackdrop.paint(ctx, wall, [0, 0, 768, 432]);
      world();
      ctx.fillStyle = '#1b2130'; ctx.fillRect(0, 176, 384, 40); ctx.fillStyle = '#2b3346'; ctx.fillRect(0, 176, 384, 1);
      // The podium's top is 25 pixels into its sprite; the coach stands behind it, shoulders above.
      const podium = [168, 134];
      depth(ctx, [{ data: scene.executive, team: scene.team, pose: 'idle', frame: 0, x: 140, foot: 184, facing: 'right' }, { data: scene.coach, team: scene.team, pose: 'idle', frame: 1, x: 200, foot: podium[1] + 36, facing: 'left' }]);
      ctx.drawImage(art['draft-podium'], podium[0], podium[1], 64, 64);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) ctx.drawImage(art['camera-flash'], 20 + rand() * 330, 20 + rand() * 120, 48, 48);
      ctx.globalCompositeOperation = 'source-over';
      return { canvas, extra: { pressLogoData: wall.logoData, pressLeagueLogoData: wall.leagueLogoData } };
    },
    // After the firing: the empty locker room, the coach alone on a chair.
    async fire(scene, rand) {
      // The same 2x camera as the other coach scenes, so the coach stays the same size as at the podium or courtside.
      const { canvas, ctx } = stage([0, 0, 384, 216]);
      const room = art['locker-room'], top = 96, left = -32, seat = 192;
      // The game's locker room tile, run the width of the room, with its wood above and its carpet below in the team's color.
      ctx.fillStyle = 'rgb(70,33,31)'; ctx.fillRect(0, 0, 384, top);
      ctx.fillStyle = 'rgb(98,53,48)'; for (let y = 6; y < top; y += 8) ctx.fillRect(0, y, 384, 1);
      for (let x = left; x < 384; x += 64) ctx.drawImage(room, x, top);
      ctx.fillStyle = 'rgb(15,77,163)'; ctx.fillRect(0, top + 64, 384, 216 - top - 64);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, top + 64, 384, 2);
      // The coach on the middle chair of a locker bay; the game seats the sitting sprite 8 pixels above the tile's bottom, level with the chair legs.
      shadow(ctx, seat, top + 58, 10);
      person(ctx, scene.coach, scene.team, 'sitting', 0, seat, top + 56, 'left');
      const light = ctx.createRadialGradient(seat, top + 40, 8, seat, top + 40, 210);
      light.addColorStop(0, 'rgba(0,0,0,0)'); light.addColorStop(1, 'rgba(4,6,14,.7)');
      ctx.fillStyle = light; ctx.fillRect(0, 0, 384, 216);
      return { canvas };
    },
    // A rough season: a thin crowd, a quiet home bench, the coach on the sideline in front of it.
    async poor(scene, rand) {
      const bad = scene.record && scene.record[0] / Math.max(1, scene.record[0] + scene.record[1]) < .3;
      const camera = [1060, 166, 384, 216], seats = seatsOf(BENCH.home), players = scene.players || [];
      const bench = [3, 6, 8, 11, 14].map((s, i) => ({ seat: seats[s], data: players[i], frame: i % 4 })).filter(b => b.data);
      const { canvas, ctx, customCourt } = await arena(scene, bad ? 'crowd-0' : 'crowd-50', camera, rand, { fill: bad ? .12 : .4, bench });
      depth(ctx, [{ data: scene.coach, team: scene.team, pose: 'idle', frame: 0, x: 1250, foot: 356, facing: 'left' }]);
      const light = ctx.createRadialGradient(1250, 330, 10, 1250, 330, 240);
      light.addColorStop(0, 'rgba(0,0,0,.04)'); light.addColorStop(1, 'rgba(6,9,20,.55)');
      ctx.fillStyle = light; ctx.fillRect(...camera);
      return { canvas, extra: { customCourt } };
    },
    // A good season: the coach and the stars at center court, under the confetti.
    async good(scene, rand) {
      // On the road the winners wear their road uniforms, and the home crowd has nothing to cheer.
      const [cx, cy] = px(0, 0), camera = [cx - 192, cy - 108, 384, 216], players = scene.players || [], away = !!scene.venue, uniform = away ? 1 : 0;
      const { canvas, ctx, customCourt } = await arena(scene, 'crowd-100', camera, rand, { fill: 1, cheer: !away, announcers: away ? [] : scene.broadcasters || [] });
      const coach = { data: scene.coach, team: scene.team, pose: scene.champion ? 'celebrate' : 'idle', frame: 0, x: cx, foot: cy + 36, facing: 'left', uniform };
      depth(ctx, [
        { data: players[0], team: scene.team, pose: 'celebrate', frame: 0, x: cx - 72, foot: cy + 6, facing: 'right', uniform },
        { data: players[1], team: scene.team, pose: 'celebrate', frame: 2, x: cx + 72, foot: cy + 8, facing: 'left', uniform },
        { data: players[2], team: scene.team, pose: 'celebrate', frame: 1, x: cx - 38, foot: cy + 24, facing: 'right', uniform },
        { data: players[3], team: scene.team, pose: 'celebrate', frame: 3, x: cx + 38, foot: cy + 26, facing: 'left', uniform },
        coach
      ]);
      // The championship trophy in the league's award colors, at its native size, its base in the coach's raised hands.
      if (scene.champion && scene.coach) ctx.drawImage(trophy(scene.trophy), cx - 16, coach.foot - 32 - 29, 32, 32);
      // The game's confetti, in the team's colors, over the whole frame.
      const pieces = [teamColor(scene.team, 0, '#147dff'), teamColor(scene.team, 1, '#ffffff'), '#ffffff', '#ffd23f'].map(c => recolor(art.confetti, c));
      for (let i = 0; i < 10; i++) ctx.drawImage(pieces[i % pieces.length], camera[0] - 40 + (i % 5) * 95 + rand() * 30, camera[1] - 50 + Math.floor(i / 5) * 115 + rand() * 30, 160, 160);
      return { canvas, extra: { customCourt } };
    }
  };

  async function draw(scene, sceneArt) {
    await load();
    const style = String(scene.kind).replace(/^coach-/, '');
    return (scenes[style] || scenes.hire)(scene, seeded(scene.seed || 'coach'), sceneArt);
  }
  function caption(scene) {
    const C = window.HoopWireCore, name = scene.coach ? C.playerDisplay(scene.coach) : 'The coach', team = C.teamDisplay(scene.team);
    const record = scene.record ? `${scene.record[0]}-${scene.record[1]} ` : '';
    return ({
      'coach-hire': `${name} is introduced as head coach of the ${team}.`,
      'coach-fire': `${name} sits alone in the ${team} locker room.`,
      'coach-poor': `${name} on the sideline during a ${record}season for the ${team}.`,
      'coach-good': scene.champion ? `${name} and the ${team} celebrate the ${scene.season} championship${scene.venue?.city ? ` in ${scene.venue.city}` : ''}.` : `${name} and the ${team} celebrate a ${record}season.`
    })[scene.kind] || `${name} of the ${team}.`;
  }
  const snap = person => person ? structuredClone({ id: person.id, tid: person.tid, fn: person.fn, ln: person.ln, num: person.num, appearance: person.appearance, accessories: person.accessories, suits: person.suits, isCoach: !!person.isCoach }) : null;
  const court = team => structuredClone({ id: team?.id, city: team?.city, name: team?.name, shortName: team?.shortName, logoURL: team?.logoURL || null, teamColors: team?.teamColors, uniforms: team?.uniforms, court: team?.court });
  // The league's title award (id 0) names the trophy sprite, championship for
  // the pros and natty for college, and carries its four colors.
  function trophyColors(league) {
    const award = (league.awards || []).find(a => a.id === 0) || (league.awards || []).find(a => a.spriteName === 'championship');
    return award ? { sprite: award.spriteName, primary: award.primaryC, secondary: award.secondaryC, base: award.baseC, plate: award.plateC } : null;
  }
  // Scene inputs from a story context: { coach, coachScene, record, champion, celebrants, venue }.
  function inputs(context, id, league = {}, season = null) {
    const team = context.winner;
    const executive = (team?.frontOffice?.staff || []).filter(p => p.pos !== 1 && p.appearance).sort((a, b) => a.pos - b.pos)[0];
    const others = (team?.roster || []).filter(p => !(context.celebrants || []).some(c => c.id === p.id)).sort((a, b) => a.id - b.id);
    return {
      version: 8, seed: id, kind: `coach-${context.coachScene}`,
      league: { name: league.leagueName || null, logoURL: league.logoURL || null },
      team: court(team),
      venue: context.venue && context.venue.id !== team?.id ? court(context.venue) : null,
      trophy: trophyColors(league),
      coach: context.coach, executive: executive ? { ...snap(executive), isCoach: true } : null,
      broadcasters: (team?.frontOffice?.staff || []).filter(p => p.pos !== 1 && p.appearance).slice(0, 4).map(p => ({ ...snap(p), isCoach: true })),
      players: [...(context.celebrants || []), ...others].slice(0, 4).map(snap), record: context.record || null, champion: !!context.champion, season
    };
  }
  window.HoopWireCoachScenes = { draw, caption, inputs, kinds: ['coach-hire', 'coach-fire', 'coach-poor', 'coach-good'] };
})();
