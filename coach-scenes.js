/* Coach story scenes, built from the game's own art at the game's scale:
   the game's arena (stairs, crowd, court), the bench chairs and sitting and
   celebrating sprites, the podium, the locker room, and the curtained stage
   the draft and the press conference share. The camera frames a 384 x 216 piece of the world at 2x, the same framing as
   the wide action shots, so people are their native 32 x 42. */
(() => {
  "use strict";
  const art = {};
  // The game's award statuettes, by the spriteName the league's awards name.
  const AWARDS = ['mvp', 'fmvp', 'dpoy', 'roty', '6moty', 'mip', 'asmvp', 'trophy', 'poty', 'mop', 'all_star'];
  let ready;
  const files = ['crowd-100', 'crowd-50', 'crowd-0', 'stairs', 'announce-table', 'guard-rails', 'spectator-body', 'spectator-head-m', 'spectator-head-f', 'spectator-cheer-m', 'spectator-cheer-f', 'headset', 'chair', 'championship', 'natty', 'confetti', 'draft-podium', 'locker-room', 'billboard-ads', 'cameraman-body', 'cameraman-head', 'jersey-hanger', 'banner-blank', 'banner-frame', 'banner-spotlight', 'hoopgram', 'hoopgram-text', 'hoopgram-like', 'hoopgram-verified', ...AWARDS.map(a => `award-${a}`), '../assets/draft_logo'];
  function load() {
    ready ||= Promise.all(files.map(async name => { const image = new Image(); image.src = `scene-assets/${name}.png`; await image.decode(); art[name.replace(/^.*\//, '')] = image; }));
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
  // A color's brightness, 0 to 1; a near-black team color gives way to the team's second color.
  const lightness = color => { const [r, g, b] = rgb(color); return (.299 * r + .587 * g + .114 * b) / 255; };
  const field = team => { const a = teamColor(team, 0, '#1d428a'), b = teamColor(team, 1, '#ffffff'); return lightness(a) < .15 && lightness(b) > lightness(a) ? b : a; };
  const shade = (color, k) => rgb(color).map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  // The game's UpdateAwardColors: the trophy's ColorSwap keys on each pixel's
  // red channel. Primary (the column) takes 237, 231 at 1.3x and 229 at 0.7x;
  // secondary (the ball) 163, 219 and 103; base 38, 57 and 20; plate 227 and 221 at 1.3x.
  function trophy(colors) {
    const image = ['championship', 'natty'].includes(colors?.sprite) ? art[colors.sprite] : AWARDS.includes(colors?.sprite) ? art[`award-${colors.sprite}`] : art.championship;
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
  // A generic league commissioner: gray hair, navy suit, white shirt, red tie.
  const COMMISSIONER = { id: -1, fn: 'League', ln: 'Commissioner', isCoach: true, appearance: { skinC: 'F4CCA1', eyeC: '141020', unibrow: false, browC: 'A3ACBD', hair: '0138', hairC: 'A3ACBD', fHair: '0000', fHairC: 'A3ACBD' },
    suits: [{ headAcc: '0000', headAccC: '000000', jacketC: '262539', shirtC: 'F2F2F2', tieC: 'C22E3A', pantC: '262539', shoeC: '000000', laceC: '', soleC: '000000' }], accessories: [] };
  // An image cropped to its visible pixels, so a padded logo fills its box.
  function trim(image) {
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { const n = (i - 3) / 4, x = n % c.width, y = Math.floor(n / c.width); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return image;
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height); return out;
  }
  // A fan seen from behind, facing the stage: the second row of the head sheets.
  function fanBack(rand, team, cheer) {
    const pick = list => list[Math.floor(rand() * list.length)], skin = pick(SKIN), hair = pick(HAIR);
    const r = rand(), shirt = !team ? pick(['#2e3a59', '#555a66', '#22222a', '#8a7a5c', '#f2f2f2', '#6b6761']) : r < .5 ? teamColor(team, 0, '#147dff') : r < .8 ? teamColor(team, 1, '#ffffff') : pick(['#f2f2f2', '#2e3a59', '#8a7a5c']);
    const map = { '220,129,88': shade(skin, 1), '215,85,66': shade(skin, .82), '225,174,120': shade(skin, 1.12), '50,175,0': shade(skin, 1), '45,60,90': shade(hair, 1),
      '20,125,255': shade(shirt, 1), '10,175,255': shade(shirt, 1.15), '5,200,255': shade(shirt, 1.3) };
    return swap(art[`spectator-${cheer ? 'cheer' : 'head'}-${rand() < .5 ? 'm' : 'f'}`], 3 + Math.floor(rand() * 3), map);
  }
  // Rows of people seen from behind, facing a stage or podium, drawn a little
  // darker as the foreground. Seated rows put each person in one of the
  // game's chairs, seen from behind: its back covers the shoulders, so only
  // the head shows above it, and some seats are left empty.
  function audience(ctx, rand, team, rows, { cheer = .35, chairs = false, spacing = 16 } = {}) {
    const layer = document.createElement('canvas'); layer.width = ctx.canvas.width; layer.height = ctx.canvas.height;
    const c = layer.getContext('2d'); c.imageSmoothingEnabled = false; c.setTransform(ctx.getTransform());
    for (const [y, offset] of rows) for (let x = -8 + offset; x < 392; x += spacing + (chairs ? 0 : Math.floor(rand() * 3))) {
      const empty = rand() >= (chairs ? .8 : .92);
      if (empty && !chairs) continue;
      const up = rand() < cheer, dy = chairs ? 0 : Math.floor(rand() * 2);
      if (!empty) c.drawImage(fanBack(rand, team, up), x - 16, y - 16 + dy);
      if (chairs) cell(c, art.chair, 0, x - 16, y - 5);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(4,6,16,.35)'; c.fillRect(0, 0, layer.width, layer.height);
    const transform = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.setTransform(transform);
  }
  // The arena's ad strip: the home team's custom strip when the save names one,
  // otherwise the game's own. Either way it is eight bands stacked down a
  // square sheet (the eighth repeats the first), adSize pixels wide.
  async function adStrip(scene) {
    const url = scene.adsData || scene.ads?.url;
    if (url && (String(url).startsWith('data:') || window.HoopWireCourt.validURL(url))) {
      const image = await window.HoopWireCourt.loadImage(url, true).catch(() => null);
      if (image) {
        let data = scene.adsData || null;
        if (!data) try { const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; c.getContext('2d').drawImage(image, 0, 0); data = c.toDataURL('image/png'); } catch { data = null; }
        const width = Math.min(Math.max(1, Number(scene.ads?.size) || image.width), image.width);
        return { image, width, band: width / 8, bands: Math.max(1, Math.min(7, Math.floor(image.height / (width / 8)) - 1)), data, custom: true };
      }
    }
    return { image: art['billboard-ads'], width: 128, band: 16, bands: 7, data: null, custom: false };
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
    // Chairs for both benches and the announcers. The announcers sit behind the
    // table: its open front is filled, as in the game, by one 16-pixel band of
    // the billboard ad strip that scrolls behind it, and the frame goes on top.
    for (const x of [...seatsOf(BENCH.home), ...seatsOf(BENCH.road)]) { const [cx, cy] = px(x, 6.25); cell(ctx, art.chair, 0, cx - 16, cy - 16); }
    for (const x of ANNOUNCERS) { const [cx, cy] = px(x, 6.42); cell(ctx, art.chair, 0, cx - 16, cy - 16); }
    announcers.forEach((a, i) => { if (!a) return; const [x, y] = px(ANNOUNCERS[i], 5.92); person(ctx, a, team, 'sitting', 0, x, y + 1, 'left'); const [hx, hy] = px(ANNOUNCERS[i], 6.67); cell(ctx, art.headset, 0, hx - 16, hy - 16, 32, 2); });
    // The table's opening is 126 x 14 of its 128 x 32 pixels; the game's mask
    // crops the band to that, a sixteenth off each edge of a 16-pixel band.
    const [tx, ty] = [px(0, 5.72)[0] - 64, px(0, 5.72)[1] - 32], ads = await adStrip(scene), band = Math.floor(rand() * ads.bands), u = ads.width / 128;
    ctx.imageSmoothingEnabled = ads.custom; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ads.image, u, band * ads.band + ads.band / 16, 126 * u, ads.band * 14 / 16, tx + 1, ty + 17, 126, 14);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art['announce-table'], tx, ty);
    // Seated bench players: feet at the sitting sprite's bottom pivot.
    for (const b of bench) { const [x, y] = px(b.seat, 5.75); person(ctx, b.data, scene.team, benchPose, b.frame || 0, x, y + 1, 'left'); }
    // The live fans in the front rows of each far section, back row first.
    const seats = [];
    for (const y of FAN_ROWS) for (const block of FAN_BLOCKS) for (const x of seatsOf(block)) seats.push([x, y]);
    const fans = seats.map(([x, y]) => ({ x, y, f: rand() < fill ? fan(rand, team, cheer && rand() < .7) : null }));
    for (const s of fans) { const [x, y] = px(s.x, s.y); cell(ctx, art.chair, 0, x - 16, y - 16); }
    for (const s of fans) if (s.f) { const [x, y] = px(s.x, s.y); ctx.drawImage(s.f.body, x - 16, y - 16); }
    for (const s of fans) if (s.f) { const [x, y] = px(s.x, s.y + .25); ctx.drawImage(s.f.head, x - 16, y - 16); }
    return { canvas, ctx, customCourt: floor.customCourt, adsData: ads.data };
  }
  function depth(ctx, list) { list.filter(a => a.data).sort((a, b) => a.foot - b.foot).forEach(a => { shadow(ctx, a.x, a.foot); person(ctx, a.data, a.team, a.pose, a.frame, a.x, a.foot, a.facing, a.uniform || 0); }); }

  // A TV camera operator from the game's media sprites: standing legs, and a
  // head with the camera on the shoulder (cell 2 aims left, cell 6 right),
  // the head half a unit above the body as with the game's spectators. The
  // crew wear dark shirts and pants.
  function cameraman(ctx, rand, x, foot, aim) {
    const pick = list => list[Math.floor(rand() * list.length)], skin = pick(SKIN), hair = pick(HAIR), shirt = pick(['#22222a', '#2e3a59', '#3a3a44']), pants = pick(['#22222a', '#2e3a59']);
    const head = { '220,129,88': shade(skin, 1), '215,85,66': shade(skin, .82), '50,175,0': shade(skin, 1), '45,60,90': shade(hair, 1), '20,125,255': shade(shirt, 1), '10,175,255': shade(shirt, 1.15), '5,200,255': shade(shirt, 1.3) };
    const body = { '25,75,255': shade(pants, 1), '35,25,255': shade(pants, .78), '20,125,255': shade(pants, 1.15), '195,36,58': shade('#222228', 1), '205,172,190': shade('#222228', .8) };
    shadow(ctx, x, foot, 9);
    ctx.drawImage(swap(art['cameraman-body'], 0, body), x - 16, foot - 32);
    ctx.drawImage(swap(art['cameraman-head'], aim === 'right' ? 6 : 2, head), x - 16, foot - 40);
  }
  // A Hall of Fame bust: the player's portrait (32 x 28) cast in bronze, the
  // same bronze for everyone, as a real bust is. The portrait is drawn with
  // marker colors in place of the player's own (skin red, hair green, brows
  // blue, eyes cyan) and no team or gear, so only the sculpted form carries
  // over: the face, head and the whites of the eyes take the primary bronze,
  // lit with highlights from the upper left; hair and beard sit a step darker
  // in the shading; brows, irises and the mouth line fall into the shadow;
  // the outline is a deep bronze.
  // The Hall of Fame mark, when the app ships one; the scene letters its own title otherwise.
  let hofLogo;
  const loadHofLogo = () => hofLogo ||= new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = 'assets/hof_logo.png'; });
  const BRONZE = { highlight: [191, 119, 28], primary: [172, 107, 25], shading: [156, 97, 23], shadow: [130, 81, 19], outline: [104, 62, 9] };
  function bronze(player, scale = 2) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 28;
    const a = player.appearance || {};
    const cast = { ...player, num: null, accessories: [], wearsSuit: false, isCoach: false,
      appearance: { ...a, skinC: 'FF0000', hairC: '00FF00', fHairC: '00FF00', browC: '0000FF', eyeC: '00FFFF' } };
    window.HoopWirePlayer.portrait(c, cast, null, 0);
    const g = c.getContext('2d', { willReadFrequently: true }), d = g.getImageData(0, 0, 32, 28), out = new Uint8ClampedArray(d.data.length);
    for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4; if (d.data[i + 3] < 128) continue;
      const [r, gr, b] = d.data.slice(i, i + 3), hi = Math.max(r, gr, b), lit = (r + gr + b) / 3;
      let tone;
      if (hi < 48) tone = 'outline';
      else if (r > 180 && gr > 180 && b > 180) tone = 'primary';
      else if (b > r + 40 && gr > r + 40) tone = 'shadow';
      else if (b > r && b > gr) tone = 'shadow';
      else if (gr > r && gr > b) tone = hi > 150 ? 'shading' : 'shadow';
      else if (r > gr + 40 && r > b + 40) tone = hi > 200 ? 'primary' : hi > 140 ? 'shading' : 'shadow';
      else tone = lit > 150 ? 'primary' : lit > 90 ? 'shading' : 'shadow';
      // Light from the upper left: the first lit pixels along the top and left edges catch it.
      const edge = x === 0 || d.data[i - 1] < 128 || y === 0 || d.data[i - 128 + 3] < 128;
      if (tone === 'primary' && edge && x < 20) tone = 'highlight';
      out.set([...BRONZE[tone], 255], i);
    }
    g.putImageData(new ImageData(out, 32, 28), 0, 0);
    g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.ellipse(16, 10, 16, 19, 0, 0, Math.PI * 2); g.fill();
    const o = document.createElement('canvas'); o.width = 32 * scale; o.height = 28 * scale;
    const og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, o.width, o.height); return o;
  }
  // A team's color token from its uniform (PRI, SEC, TER or a hex value).
  const token = (team, value, fallback) => ({ PRI: teamColor(team, 0, fallback), SEC: teamColor(team, 1, fallback), TER: teamColor(team, 2, fallback) })[String(value || '').toUpperCase()] || hex(value) || fallback;
  // The game's hanger jersey in the team's home uniform, off its hanger, colored
  // the way the player renderer colors a uniform from the same blue masks: the
  // body (20,125,255) the jersey color, shaded as on the players; the side
  // stripes and straps (10,175,255) the stripe color; the collar (5,200,255)
  // the collar color; the hem (30,50,255) a shadow of the jersey color. The
  // hanger's steel pixels are cleared, the number goes on in the game's own
  // digits where the game places it (half the jersey's width, a little above
  // its middle), and a dark outline runs round it like every other sprite.
  function jersey(team, num) {
    const u = team?.uniforms?.[0] || {}, body = token(team, u.jersey, teamColor(team, 0, '#147dff'));
    const stripe = token(team, u.jerseyStripe, body), collar = token(team, u.jerseyCollar, stripe);
    const map = { '20,125,255': shade(body, 125 / 150), '10,175,255': rgb(stripe), '5,200,255': rgb(collar), '30,50,255': shade(body, .55) };
    const shirt = swap(art['jersey-hanger'], 0, map), g = shirt.getContext('2d', { willReadFrequently: true }), d = g.getImageData(0, 0, 32, 32);
    for (let i = 0; i < d.data.length; i += 4) if (d.data[i] === 163 && d.data[i + 1] === 172 && d.data[i + 2] === 190) d.data[i + 3] = 0;
    g.putImageData(d, 0, 0);
    if (num != null) g.drawImage(window.HoopWirePlayer.numberTile(num, token(team, u.jerseyNumber, stripe)), 9, 5);
    const out = document.createElement('canvas'); out.width = out.height = 34;
    const o = out.getContext('2d'), dark = recolor(shirt, '#14101e');
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) o.drawImage(dark, dx, dy);
    o.drawImage(shirt, 1, 1);
    return out;
  }
  // Blue stage curtains in pixel art: a fold every 16 pixels, lit across each
  // fold, darkening toward the floor, under a scalloped valance.
  function curtains(ctx, bottom) {
    const folds = [.62, .7, .8, .9, 1, 1.06, 1.1, 1.06, 1, .92, .84, .76, .7, .64, .58, .56];
    for (let x = 0; x < 384; x++) {
      const k = folds[x % 16];
      for (let y = 0; y < bottom; y += 4) {
        const fade = 1 - .35 * y / bottom, v = shade('#1f4fb8', k * fade);
        ctx.fillStyle = `rgb(${v[0]},${v[1]},${v[2]})`; ctx.fillRect(x, y, 1, 4);
      }
    }
    for (let x = 0; x < 384; x += 24) {
      ctx.fillStyle = '#163a8c'; ctx.fillRect(x, 0, 24, 9);
      ctx.fillStyle = '#163a8c'; ctx.fillRect(x + 2, 9, 20, 2); ctx.fillRect(x + 5, 11, 14, 2);
      ctx.fillStyle = '#2c5fcc'; ctx.fillRect(x, 2, 24, 1);
      ctx.fillStyle = '#0c2460'; ctx.fillRect(x + 5, 13, 14, 1);
    }
    ctx.fillStyle = 'rgba(4,8,24,.2)'; ctx.fillRect(0, 0, 384, bottom);
  }
  // The stage both the draft and the press conference stand on: a spotlight
  // on the podium, the deck with floorboards closer together toward the
  // curtains, and its front face in the team's color. Returns the podium's base.
  function stageFloor(ctx, primary) {
    ctx.globalCompositeOperation = 'lighter';
    const spot = ctx.createRadialGradient(192, 130, 6, 192, 130, 90); spot.addColorStop(0, 'rgba(120,150,220,.35)'); spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot; ctx.fillRect(0, 0, 384, 216); ctx.globalCompositeOperation = 'source-over';
    const deck = 128, edge = 172;
    ctx.fillStyle = '#1b2033'; ctx.fillRect(0, deck, 384, edge - deck); ctx.fillStyle = '#2d3550'; ctx.fillRect(0, deck, 384, 1);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let y = deck + 4, gap = 4; y < edge; y += gap, gap += 1) ctx.fillRect(0, y, 384, 1);
    ctx.fillStyle = '#0d1020'; ctx.fillRect(0, edge, 384, 216 - edge); ctx.fillStyle = primary; ctx.fillRect(0, edge, 384, 2);
    // The podium stands back from the stage's edge.
    return edge - 10;
  }
  const scenes = {
    // The introductory press conference: the wall, the podium, the press.
    async hire(scene, rand) {
      // Laid out like the draft: the curtains and stage, the coach behind the
      // game's podium where the pick stands, the executive beside it where the
      // commissioner stands, and the press seated in front, framed closer at 3x.
      const camera = [54, 44, 256, 144], { canvas, ctx, world, screen } = stage(camera), team = scene.team;
      const primary = teamColor(team, 0, '#1d428a'), secondary = teamColor(team, 1, '#ffffff');
      curtains(ctx, 128);
      // Two banners hang on the curtains either side of the coach, each on a rod
      // and two cords: the team's in its primary color with a trim of its
      // secondary, the league's white with a navy trim, each with its logo.
      const [mark, leagueMark] = await Promise.all([window.HoopWirePressBackdrop.teamLogo(team, scene.pressLogoData), window.HoopWirePressBackdrop.leagueLogo(scene.league ? { logoURL: scene.league.logoURL } : null, scene.pressLeagueLogoData)]);
      const hang = (banner, field, trimColor, logo) => {
        world();
        ctx.fillStyle = '#9aa3b8'; ctx.fillRect(banner[0] + 6, 0, 1, banner[1]); ctx.fillRect(banner[0] + banner[2] - 7, 0, 1, banner[1]);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(banner[0] + 3, banner[1] + 3, banner[2], banner[3]);
        ctx.fillStyle = trimColor; ctx.fillRect(...banner);
        ctx.fillStyle = field; ctx.fillRect(banner[0] + 2, banner[1] + 2, banner[2] - 4, banner[3] - 4);
        ctx.fillStyle = '#c9ced9'; ctx.fillRect(banner[0] - 4, banner[1] - 2, banner[2] + 8, 2); ctx.fillStyle = '#6b7389'; ctx.fillRect(banner[0] - 4, banner[1], banner[2] + 8, 1);
        if (!logo?.image) return;
        screen();
        const image = trim(logo.image), k0 = canvas.width / camera[2], box = [(banner[0] + 5 - camera[0]) * k0, (banner[1] + 5 - camera[1]) * k0, (banner[2] - 10) * k0, (banner[3] - 10) * k0];
        const fit = Math.min(box[2] / image.width, box[3] / image.height), k = logo.pixel && fit >= 1 ? Math.floor(fit) : fit, w = Math.round(image.width * k), h = Math.round(image.height * k);
        ctx.imageSmoothingEnabled = !logo.pixel || k < 1; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, Math.round(box[0] + (box[2] - w) / 2), Math.round(box[1] + (box[3] - h) / 2), w, h);
        ctx.imageSmoothingEnabled = false; world();
      };
      hang([122, 52, 48, 46], primary, secondary, mark);
      hang([214, 52, 48, 46], '#f2f2f2', '#13285c', leagueMark);
      const base = stageFloor(ctx, teamColor(team, 0, '#1d428a'));
      // An award puts the player at the podium in a suit, the commissioner
      // beside them presenting, and the award's statuette, in the award's own
      // colors, on a pedestal across the stage.
      // A signing has no podium: the player and the executive stand together,
      // the player holding up the new jersey. A retirement farewell is the
      // player alone at the podium.
      const award = scene.kind === 'coach-award', signing = scene.kind === 'coach-signing', farewell = scene.kind === 'coach-farewell';
      if (signing) {
        // Close enough that the jersey's edges cover a hand of each.
        depth(ctx, [{ data: scene.executive, team, pose: 'idle', frame: 0, x: 172, foot: base - 4, facing: 'right' }, { data: scene.signee, team, pose: 'suit-standing', frame: 0, x: 196, foot: base - 4, facing: 'left' }]);
        // The jersey held up between them at chest height, at half the player's
        // pixel scale, as the game hangs jerseys beside players in its locker room.
        const shirt = jersey(team, scene.signee?.num), u = 1 / 2, cut = 6, [jx, jy] = [184 - 17 * u, base - 4 - 17];
        ctx.drawImage(shirt, 0, cut, 34, 34 - cut, jx, jy, 34 * u, (34 - cut) * u);
      } else {
        depth(ctx, [award ? { data: scene.awardee, team, pose: 'suit-standing', frame: 0, x: 192, foot: base - 27, facing: 'left' } : farewell ? { data: scene.retiree, team, pose: 'suit-standing', frame: 0, x: 192, foot: base - 27, facing: 'left' } : { data: scene.coach, team, pose: 'idle', frame: 1, x: 192, foot: base - 27, facing: 'left' }]);
        ctx.drawImage(art['draft-podium'], 160, base - 64, 64, 64);
      }
      if (signing || farewell) {} else if (award) {
        shadow(ctx, 140, base - 5, 10); person(ctx, COMMISSIONER, null, 'suit-standing', 0, 140, base - 6, 'right');
        const [px0, top] = [236, base - 22];
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px0 + 2, top + 2, 20, 22);
        ctx.fillStyle = '#14182a'; ctx.fillRect(px0, top, 20, 22); ctx.fillStyle = '#1f2540'; ctx.fillRect(px0 + 2, top + 2, 16, 20);
        ctx.fillStyle = '#c9a24a'; ctx.fillRect(px0 - 1, top, 22, 2);
        // The statuette at two-thirds size, two screen pixels per sprite pixel at
        // this 3x zoom, so it reads as a trophy beside the player, not a figure.
        const size = 64 / 3;
        ctx.drawImage(trophy(scene.award), px0 + 10 - size / 2, top - 20, size, size);
      } else depth(ctx, [{ data: scene.executive, team, pose: 'idle', frame: 0, x: 140, foot: base - 6, facing: 'right' }]);
      // TV cameras at either side of the stage, aimed at the podium.
      cameraman(ctx, rand, 80, base - 2, 'right'); cameraman(ctx, rand, 288, base - 2, 'left');
      audience(ctx, rand, null, [[180, 4], [202, 14]], { cheer: 0, chairs: true, spacing: 20 });
      return { canvas, extra: { pressLogoData: mark?.data || scene.pressLogoData || null, pressLeagueLogoData: leagueMark?.data || scene.pressLeagueLogoData || null } };
    },
    // The Hall of Fame: a wood-paneled hall, the inductee's bronze bust under a
    // spotlight on a stone pedestal with a brass nameplate, and earlier
    // inductees on their own pedestals either side, in the hall's shade.
    async hof(scene, rand) {
      const camera = [64, 24, 256, 144], { canvas, ctx, world, screen } = stage(camera), team = scene.team;
      ctx.fillStyle = '#20140d'; ctx.fillRect(0, 0, 384, 216);
      for (let x = 0; x < 384; x += 32) { ctx.fillStyle = '#2b1b12'; ctx.fillRect(x + 3, 30, 26, 92); ctx.fillStyle = '#35221a'; ctx.fillRect(x + 3, 30, 26, 1); ctx.fillStyle = '#160d08'; ctx.fillRect(x, 0, 2, 132); }
      ctx.fillStyle = '#b08a3e'; ctx.fillRect(0, 128, 384, 2); ctx.fillStyle = '#6e5424'; ctx.fillRect(0, 130, 384, 1);
      ctx.fillStyle = '#3b1416'; ctx.fillRect(0, 131, 384, 85); ctx.fillStyle = '#4a1c1e'; for (let y = 134, gap = 3; y < 216; y += gap, gap += 1) ctx.fillRect(0, y, 384, 1);
      const pedestal = (x, top, name) => {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 14, top + 46, 34, 4);
        ctx.fillStyle = '#3a3b46'; ctx.fillRect(x - 18, top - 3, 36, 4); ctx.fillStyle = '#2b2c35'; ctx.fillRect(x - 15, top + 1, 30, 44);
        ctx.fillStyle = '#3c3e4a'; ctx.fillRect(x - 15, top + 1, 3, 44); ctx.fillStyle = '#1d1e25'; ctx.fillRect(x - 17, top + 44, 34, 4);
        ctx.fillStyle = '#9c7a34'; ctx.fillRect(x - 12, top + 12, 24, 10); ctx.fillStyle = '#d9b860'; ctx.fillRect(x - 11, top + 13, 22, 1);
        if (name) { screen(); const k = canvas.width / camera[2]; ctx.fillStyle = '#2a1a08'; ctx.textAlign = 'center'; ctx.font = '700 11px Georgia';
          ctx.fillText(name.toUpperCase(), (x - camera[0]) * k, (top + 19.5 - camera[1]) * k, 22 * k); world(); }
      };
      const place = (p, x, top, lit) => {
        pedestal(x, top, p ? window.HoopWireCore.playerDisplay(p) : null);
        if (!p) return;
        const b = bronze(p);
        if (!lit) { const g = b.getContext('2d'); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(14,8,4,.45)'; g.fillRect(0, 0, b.width, b.height); }
        ctx.drawImage(b, x - b.width / 2, top - b.height);
      };
      const hall = scene.hall || [];
      if (hall[0]) place(hall[0], 104, 112, false);
      if (hall[1]) place(hall[1], 280, 112, false);
      ctx.globalCompositeOperation = 'lighter';
      const spot = ctx.createRadialGradient(192, 70, 4, 192, 70, 90); spot.addColorStop(0, 'rgba(255,214,150,.32)'); spot.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spot; ctx.fillRect(0, 0, 384, 216); ctx.globalCompositeOperation = 'source-over';
      place(scene.inductee, 192, 118, true);
      screen(); const k = canvas.width / camera[2];
      // The Hall of Fame mark on the wall above the busts, the class year beneath it.
      const cx = (192 - camera[0]) * k, logo = await loadHofLogo();
      ctx.textAlign = 'center';
      if (logo) {
        const w = 300, h = Math.round(w * logo.height / logo.width);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(logo, Math.round(cx - w / 2), 30, w, h); ctx.imageSmoothingEnabled = false;
        // The class year in the mark's color, condensed and spaced out to sit with its lettering.
        ctx.save(); ctx.fillStyle = '#cbbca9'; ctx.font = '700 26px Arial, sans-serif'; ctx.letterSpacing = '3px';
        ctx.translate(cx, 30 + h + 32); ctx.scale(.78, 1); ctx.fillText(`CLASS OF ${scene.season}`, 0, 0); ctx.restore();
      } else {
        ctx.fillStyle = '#e6cd8e'; ctx.font = '700 26px Georgia'; ctx.fillText('HALL OF FAME', cx, (40 - camera[1]) * k);
        ctx.fillStyle = '#c4a45e'; ctx.font = '700 15px Georgia'; ctx.fillText(`CLASS OF ${scene.season}`, cx, (48 - camera[1]) * k);
      }
      world();
      return { canvas };
    },
    // A jersey retirement: up in the rafters over the home crowd, the player's
    // banner raised among the team's championship banners and earlier
    // retired numbers. Each is the game's blank banner in the team's primary
    // color with its frame in the secondary, under the game's banner shading.
    async rafters(scene, rand) {
      const { canvas, ctx, world, screen } = stage([0, 0, 384, 216]), team = scene.team, k = canvas.width / 384;
      const primary = teamColor(team, 0, '#1d428a'), secondary = teamColor(team, 1, '#ffffff');
      const sky = ctx.createLinearGradient(0, 0, 0, 160); sky.addColorStop(0, '#07090f'); sky.addColorStop(1, '#141a2b');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 384, 216);
      // Steel trusses across the roof.
      ctx.fillStyle = '#262c3c'; ctx.fillRect(0, 10, 384, 2); ctx.fillRect(0, 22, 384, 2);
      ctx.fillStyle = '#1d2230'; for (let x = 0; x < 384; x += 16) { for (let y = 12; y < 22; y++) { ctx.fillRect(x + (y - 12) * 1.6, y, 1, 1); ctx.fillRect(x + 16 - (y - 12) * 1.6, y, 1, 1); } }
      // The top of the far stands below, from the game's own arena art.
      ctx.save(); ctx.translate(0, 150);
      ctx.drawImage(art.stairs, 832, 0, 384, 66, 0, 0, 384, 66); ctx.drawImage(tinted(art['crowd-100'], primary), 832, 0, 384, 66, 0, 0, 384, 66);
      ctx.fillStyle = 'rgba(4,6,12,.45)'; ctx.fillRect(0, 0, 384, 66); ctx.restore();
      const banner = (x, top, lines, dim) => {
        ctx.fillStyle = '#5b6274'; ctx.fillRect(x + 8, 24, 1, top - 24); ctx.fillRect(x + 39, 24, 1, top - 24);
        ctx.drawImage(recolor(art['banner-blank'], primary), x, top); ctx.drawImage(recolor(art['banner-frame'], secondary), x, top);
        screen(); ctx.fillStyle = secondary; ctx.textAlign = 'center';
        for (const [text, size, y] of lines) { ctx.font = `900 ${size}px Arial`; ctx.fillText(text, (x + 24) * k, (top + y) * k, 40 * k); }
        world(); ctx.globalAlpha = .6; ctx.drawImage(art['banner-spotlight'], x, top); ctx.globalAlpha = 1;
        if (dim) { ctx.fillStyle = 'rgba(4,6,14,.25)'; ctx.fillRect(x, top, 48, 64); }
      };
      const titles = (team?.championships?.yearsWon || []).slice(-2), others = (scene.retiredNumbers || []).filter(n => n !== scene.retired?.num).slice(-2);
      const sides = [...titles.map(y => [[String(y), 14, 28], ['CHAMPIONS', 8, 40]]), ...others.map(n => [[String(n), 26, 38]])].slice(0, 4);
      // Earlier banners fill the slots nearest the new one first, alternating sides.
      [112, 224, 56, 280].forEach((x, i) => { if (sides[i]) banner(x, 36, sides[i], true); });
      ctx.globalCompositeOperation = 'lighter';
      const spot = ctx.createRadialGradient(192, 70, 4, 192, 70, 80); spot.addColorStop(0, 'rgba(255,236,190,.3)'); spot.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spot; ctx.fillRect(0, 0, 384, 216); ctx.globalCompositeOperation = 'source-over';
      const p = scene.retired?.player, name = p ? (p.ln || window.HoopWireCore.playerDisplay(p)).toUpperCase() : '';
      banner(168, 44, [[name, 10, 14], [String(scene.retired?.num ?? ''), 30, 42], [scene.retired?.years || '', 7, 56]], false);
      return { canvas };
    },
    // A college commitment: the recruit's Hoop Gram post, built from the game's
    // own Hoop Gram art (its logo and wordmark, the like heart, the verified
    // badge), with the recruit's portrait in the school's uniform over the
    // school's colors and logo.
    async commit(scene, rand) {
      const { canvas, ctx, screen } = stage([0, 0, 384, 216]), team = scene.team, C = window.HoopWireCore, p = scene.recruit;
      const primary = field(team), secondary = primary === teamColor(team, 0, '#1d428a') ? teamColor(team, 1, '#ffffff') : teamColor(team, 0, '#1d428a');
      screen(); ctx.imageSmoothingEnabled = false;
      const bg = ctx.createLinearGradient(0, 0, 768, 432); bg.addColorStop(0, `rgb(${shade(primary, .55)})`); bg.addColorStop(1, `rgb(${shade(primary, .25)})`);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 768, 432);
      const sprite = (image, x, y, k, color) => { const src = color ? recolor(image, color) : image, b = trim(src); ctx.drawImage(b, x, y, b.width * k, b.height * k); return [b.width * k, b.height * k]; };
      // The post card.
      const [cx, cy, cw, ch] = [234, 10, 300, 412];
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(cx + 6, cy + 6, cw, ch);
      ctx.fillStyle = '#0f1118'; ctx.fillRect(cx, cy, cw, ch); ctx.fillStyle = '#262a36'; ctx.fillRect(cx, cy + 46, cw, 2);
      sprite(art.hoopgram, cx + 12, cy + 10, 1.5);
      sprite(art['hoopgram-text'], cx + 46, cy + 17, 2);
      // The recruit's handle, with the verified badge.
      const handle = p ? `@${String(p.fn || '').toLowerCase()}${String(p.ln || '').toLowerCase()}`.replace(/[^@a-z0-9._]/g, '') : '@recruit';
      ctx.fillStyle = '#ffffff'; ctx.font = '700 15px Arial'; ctx.textAlign = 'left'; ctx.fillText(handle, cx + 14, cy + 70);
      const hw = ctx.measureText(handle).width; sprite(art['hoopgram-verified'], cx + 20 + hw, cy + 58, 1.25);
      // The photo, in one of two designs picked per story: the recruit's
      // portrait over the school's colors and a faint logo, or the recruit
      // standing with a ball beside the school's logo on a dark field cut by
      // the school's color at two corners.
      const [px0, py0, pw, ph] = [cx + 12, cy + 82, cw - 24, 236];
      const logo = await window.HoopWirePressBackdrop.teamLogo(team, scene.pressLogoData);
      const fit = (image, box) => { const im = trim(image), k = Math.min(box / im.width, box / im.height); return [im, im.width * k, im.height * k]; };
      if (C.choose(String(scene.seed), ['portrait', 'standing'], 'hoopgram-design') === 'standing') {
        ctx.fillStyle = '#171717'; ctx.fillRect(px0, py0, pw, ph);
        ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip();
        ctx.fillStyle = `rgb(${shade(primary, .58)})`;
        ctx.beginPath(); ctx.moveTo(px0 + pw * .58, py0); ctx.lineTo(px0 + pw, py0); ctx.lineTo(px0 + pw, py0 + ph * .5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px0, py0 + ph * .48); ctx.lineTo(px0, py0 + ph); ctx.lineTo(px0 + pw * .34, py0 + ph); ctx.fill();
        ctx.restore();
        if (logo?.image) {
          const [im, w, h] = fit(logo.image, 112), [lx, ly] = [px0 + pw - 70, py0 + 86];
          // A mostly dark logo would vanish on the dark field, so it sits on a white disc ringed in the school's color.
          const g = document.createElement('canvas'); g.width = g.height = 24; const gc = g.getContext('2d', { willReadFrequently: true }); gc.drawImage(im, 0, 0, 24, 24);
          const px = gc.getImageData(0, 0, 24, 24).data; let sum = 0, n = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128) { sum += .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; n++; }
          if (n && sum / n / 255 < .45) { ctx.fillStyle = primary; ctx.beginPath(); ctx.arc(lx, ly, 64, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(lx, ly, 60, 0, Math.PI * 2); ctx.fill(); }
          const k = n && sum / n / 255 < .45 ? .82 : 1;
          ctx.imageSmoothingEnabled = !logo.pixel; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, lx - w * k / 2, ly - h * k / 2, w * k, h * k); ctx.imageSmoothingEnabled = false;
        }
        // The recruit at five times the sprite's size, holding the ball low, in the school's uniform.
        if (p) { const c = document.createElement('canvas'); c.width = 32 * 5; c.height = 42 * 5; window.HoopWirePlayer.draw(c, { ...p, wearsSuit: false, isCoach: false }, team, 0, 1, 'dribbling', 'right', {}); ctx.drawImage(c, px0 - 6, py0 + ph - c.height + 6); }
        ctx.fillStyle = primary; ctx.fillRect(px0, py0 + ph - 4, pw, 4);
      } else {
        const photo = ctx.createLinearGradient(0, py0, 0, py0 + ph); photo.addColorStop(0, `rgb(${shade(primary, 1.1)})`); photo.addColorStop(1, `rgb(${shade(primary, .7)})`);
        ctx.fillStyle = photo; ctx.fillRect(px0, py0, pw, ph);
        // The faint logo is a two-tone white watermark: the logo's dark parts in
        // strong white and its light parts in faint white, so its detail reads
        // and it shows whatever the school's colors are.
        if (logo?.image) {
          const [im, w, h] = fit(logo.image, 200), mark = document.createElement('canvas'); mark.width = im.width; mark.height = im.height;
          const mc = mark.getContext('2d', { willReadFrequently: true }); mc.drawImage(im, 0, 0);
          const d = mc.getImageData(0, 0, mark.width, mark.height);
          for (let i = 0; i < d.data.length; i += 4) { const l = .299 * d.data[i] + .587 * d.data[i + 1] + .114 * d.data[i + 2]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(d.data[i + 3] * (l < 128 ? 1 : .4)); }
          mc.putImageData(d, 0, 0);
          ctx.globalAlpha = .3; ctx.imageSmoothingEnabled = !logo.pixel; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(mark, px0 + (pw - w) / 2, py0 + 12, w, h); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
        }
        if (p) { const c = document.createElement('canvas'); c.width = 32 * 7; c.height = 28 * 7; window.HoopWirePlayer.portrait(c, { ...p, wearsSuit: false, isCoach: false }, team, 0); ctx.drawImage(c, px0 + (pw - c.width) / 2, py0 + ph - c.height); }
        ctx.fillStyle = secondary; ctx.fillRect(px0, py0 + ph - 4, pw, 4);
      }
      // Likes and the caption.
      const likes = Math.round((2 + rand() * 18) * 10) / 10;
      sprite(art['hoopgram-like'], cx + 14, py0 + ph + 12, 1.75, '#e5484d');
      ctx.fillStyle = '#ffffff'; ctx.font = '700 14px Arial'; ctx.fillText(`${likes}K likes`, cx + 42, py0 + ph + 27);
      // The caption, the handle in bold, wrapped to the card.
      ctx.font = '700 13px Arial'; ctx.fillText(handle.slice(1), cx + 14, py0 + ph + 52);
      let x = cx + 14 + ctx.measureText(handle.slice(1)).width + 6, y = py0 + ph + 52;
      ctx.fillStyle = '#c9cfdb'; ctx.font = '400 13px Arial';
      for (const word of `Committed. ${C.teamDisplay(team)}, let's work.`.split(' ')) {
        const w = ctx.measureText(word + ' ').width;
        if (x + w > cx + cw - 12) { x = cx + 14; y += 18; }
        ctx.fillText(word, x, y); x += w;
      }
      ctx.fillStyle = '#7d8aa6'; ctx.fillText(`#${String(team?.name || 'Committed').replace(/\s+/g, '')}`, cx + 14, y + 20);
      return { canvas, extra: { pressLogoData: logo?.data || scene.pressLogoData || null, pressLeagueLogoData: scene.pressLeagueLogoData || null } };
    },
    // A player award: the press conference stage, the player at the podium.
    award(scene, rand) { return scenes.hire(scene, rand); },
    // A signing, trade or extension: the player holding up the team's jersey beside the executive.
    signing(scene, rand) { return scenes.hire(scene, rand); },
    // A retirement: the player's farewell at the podium.
    farewell(scene, rand) { return scenes.hire(scene, rand); },
    // After the firing: the empty locker room, the coach alone on a chair.
    async fire(scene, rand) {
      // A tight 3x shot on the coach and the lockers either side, like the press conference.
      const { canvas, ctx } = stage([64, 40, 256, 144]);
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
      const light = ctx.createRadialGradient(seat, top + 40, 8, seat, top + 40, 150);
      light.addColorStop(0, 'rgba(0,0,0,0)'); light.addColorStop(1, 'rgba(4,6,14,.7)');
      ctx.fillStyle = light; ctx.fillRect(0, 0, 384, 216);
      return { canvas };
    },
    // A rough season: a thin crowd, a quiet home bench, the coach on the sideline in front of it.
    async poor(scene, rand) {
      const bad = scene.record && scene.record[0] / Math.max(1, scene.record[0] + scene.record[1]) < .3;
      const camera = [1060, 166, 384, 216], seats = seatsOf(BENCH.home), players = scene.players || [];
      const bench = [3, 6, 8, 11, 14].map((s, i) => ({ seat: seats[s], data: players[i], frame: i % 4 })).filter(b => b.data);
      const { canvas, ctx, customCourt, adsData } = await arena(scene, bad ? 'crowd-0' : 'crowd-50', camera, rand, { fill: bad ? .12 : .4, bench });
      depth(ctx, [{ data: scene.coach, team: scene.team, pose: 'idle', frame: 0, x: 1250, foot: 356, facing: 'left' }]);
      const light = ctx.createRadialGradient(1250, 330, 10, 1250, 330, 240);
      light.addColorStop(0, 'rgba(0,0,0,.04)'); light.addColorStop(1, 'rgba(6,9,20,.55)');
      ctx.fillStyle = light; ctx.fillRect(...camera);
      return { canvas, extra: { customCourt, adsData } };
    },
    // A good season: the coach and the stars just above the center circle, the
    // scorer's table and the far stands behind them, under the confetti.
    async good(scene, rand) {
      // On the road the winners wear their road uniforms, and the home crowd has nothing to cheer.
      // The camera's top is the far stands' back fan rows; the group stands about three units above center court.
      const [cx] = px(0, 0), [, top] = px(0, 9.75), gy = px(0, 4.4)[1], camera = [cx - 192, top, 384, 216], players = scene.players || [], away = !!scene.venue, uniform = away ? 1 : 0;
      const { canvas, ctx, customCourt, adsData } = await arena(scene, 'crowd-100', camera, rand, { fill: 1, cheer: !away, announcers: scene.broadcasters || [] });
      const coach = { data: scene.coach, team: scene.team, pose: scene.champion ? 'celebrate' : 'idle', frame: 0, x: cx, foot: gy + 30, facing: 'left', uniform };
      depth(ctx, [
        { data: players[0], team: scene.team, pose: 'celebrate', frame: 0, x: cx - 72, foot: gy, facing: 'right', uniform },
        { data: players[1], team: scene.team, pose: 'celebrate', frame: 2, x: cx + 72, foot: gy + 2, facing: 'left', uniform },
        { data: players[2], team: scene.team, pose: 'celebrate', frame: 1, x: cx - 38, foot: gy + 18, facing: 'right', uniform },
        { data: players[3], team: scene.team, pose: 'celebrate', frame: 3, x: cx + 38, foot: gy + 20, facing: 'left', uniform },
        coach
      ]);
      // The championship trophy in the league's award colors, at its native size, its base in the coach's raised hands.
      if (scene.champion && scene.coach) ctx.drawImage(trophy(scene.trophy), cx - 16, coach.foot - 32 - 29, 32, 32);
      // The game's confetti, in the team's colors, over the whole frame.
      const pieces = [teamColor(scene.team, 0, '#147dff'), teamColor(scene.team, 1, '#ffffff'), '#ffffff', '#ffd23f'].map(c => recolor(art.confetti, c));
      for (let i = 0; i < 10; i++) ctx.drawImage(pieces[i % pieces.length], camera[0] - 40 + (i % 5) * 95 + rand() * 30, camera[1] - 50 + Math.floor(i / 5) * 115 + rand() * 30, 160, 160);
      return { canvas, extra: { customCourt, adsData } };
    },
    // Draft night: the pick at the game's podium in front of the stage screens.
    // The center screen stacks the league logo, the DRAFT DAY mark and the
    // year; the side screens show the pick's portrait. Fans fill the floor in
    // front of the stage, facing it.
    async draft(scene, rand) {
      const { canvas, ctx, world, screen } = stage([0, 0, 384, 216]), team = scene.team, player = scene.draftee;
      const primary = teamColor(team, 0, '#1d428a'), secondary = teamColor(team, 1, '#ffffff');
      curtains(ctx, 128);
      const panel = (x, y, w, h) => {
        ctx.fillStyle = '#05070d'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        ctx.fillStyle = '#20263a'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#13285c'); g.addColorStop(1, '#070d22');
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      };
      // Center screen: league logo above DRAFT DAY, the year below.
      const center = [124, 8, 136, 88]; panel(...center);
      const logo = await window.HoopWirePressBackdrop.leagueLogo(scene.league ? { logoURL: scene.league.logoURL } : null, scene.pressLeagueLogoData);
      screen();
      if (logo?.image) {
        const box = [2 * 192 - 70, 22, 140, 44], image = trim(logo.image), fit = Math.min(box[2] / image.width, box[3] / image.height);
        const k = logo.pixel && fit >= 1 ? Math.floor(fit) : fit, w = Math.round(image.width * k), h = Math.round(image.height * k);
        ctx.imageSmoothingEnabled = !logo.pixel || k < 1; ctx.drawImage(image, Math.round(box[0] + (box[2] - w) / 2), Math.round(box[1] + (box[3] - h) / 2), w, h);
      }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(art.draft_logo, 2 * 192 - 78, 72, 156, 76);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = '900 30px Arial';
      ctx.fillText(String(scene.season || ''), 384, 182);
      world();
      // Side screens: the pick's portrait over the drafting team's logo in the
      // team's colors, then the team and the round and pick beneath.
      const mark = await window.HoopWirePressBackdrop.teamLogo(team, scene.pressLogoData);
      // A near-black primary would swallow the logo, so the screen takes the secondary instead.
      const light = c => { const [r, g, b] = rgb(c); return (.299 * r + .587 * g + .114 * b) / 255; };
      const field = light(primary) < .15 && light(secondary) > light(primary) ? secondary : primary, trimColor = field === primary ? secondary : primary;
      for (const x of [22, 278]) {
        panel(x, 12, 84, 96);
        ctx.fillStyle = field; ctx.fillRect(x + 6, 18, 72, 56);
        ctx.fillStyle = trimColor; ctx.fillRect(x + 6, 72, 72, 2);
        if (mark?.image) {
          screen();
          const image = trim(mark.image), box = [2 * (x + 8), 2 * 20, 136, 100], fit = Math.min(box[2] / image.width, box[3] / image.height);
          const k = mark.pixel && fit >= 1 ? Math.floor(fit) : fit, w = Math.round(image.width * k), h = Math.round(image.height * k);
          ctx.globalAlpha = .8; ctx.imageSmoothingEnabled = !mark.pixel || k < 1; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(image, Math.round(box[0] + (box[2] - w) / 2), Math.round(box[1] + (box[3] - h) / 2), w, h);
          ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; world();
        }
        if (player) { const p = document.createElement('canvas'); p.width = 128; p.height = 112; window.HoopWirePlayer.portrait(p, player, team, 0); ctx.drawImage(p, x + 10, 16, 64, 56); }
        screen(); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
        const name = window.HoopWireCore.teamDisplay(team).toUpperCase();
        let size = 13; do { ctx.font = `900 ${size}px Arial`; } while (ctx.measureText(name).width > 156 && --size > 8);
        ctx.fillText(name, 2 * (x + 42), 2 * 86);
        ctx.font = '900 13px Arial'; ctx.fillStyle = '#c9d6f2';
        ctx.fillText(scene.pick?.pk ? `${scene.pick.rd ? `ROUND ${scene.pick.rd} · ` : ''}PICK ${scene.pick.pk}` : 'DRAFT PICK', 2 * (x + 42), 2 * 100); world();
      }
      // The pick behind the podium; the game stands the player's feet 27 pixels above the podium's base.
      const base = stageFloor(ctx, primary), podium = [160, base - 64];
      if (player) { shadow(ctx, 192, base - 26, 10); person(ctx, player, team, 'suit-standing', 0, 192, base - 27, 'left'); }
      ctx.drawImage(art['draft-podium'], ...podium, 64, 64);
      // The commissioner beside the podium, turned toward the pick.
      shadow(ctx, 140, base - 5, 10); person(ctx, COMMISSIONER, null, 'suit-standing', 0, 140, base - 6, 'right');
      // TV cameras at either end of the stage, aimed at the podium.
      cameraman(ctx, rand, 30, base - 2, 'right'); cameraman(ctx, rand, 354, base - 2, 'left');
      // Fans on the floor in front of the stage, backs to the camera.
      audience(ctx, rand, team, [[180, 0], [194, 8], [208, 4]]);
      return { canvas, extra: { pressLogoData: mark?.data || scene.pressLogoData || null, pressLeagueLogoData: logo?.data || scene.pressLeagueLogoData || null } };
    }
  };

  async function draw(scene, sceneArt) {
    await load();
    const style = String(scene.kind).replace(/^coach-/, '');
    return (scenes[style] || scenes.hire)(scene, seeded(scene.seed || 'coach'), sceneArt);
  }
  function caption(scene) {
    if (scene.kind === 'coach-hof') {
      const C = window.HoopWireCore;
      return `${scene.inductee ? C.playerDisplay(scene.inductee) : 'The inductee'}'s bust in the ${scene.league?.name || 'league'} Hall of Fame, class of ${scene.season}.`;
    }
    if (scene.kind === 'coach-commit') {
      const C = window.HoopWireCore;
      return `${scene.recruit ? C.playerDisplay(scene.recruit) : 'A recruit'} announces a commitment to ${C.teamDisplay(scene.team)} on Hoop Gram.`;
    }
    if (scene.kind === 'coach-rafters') {
      const C = window.HoopWireCore, p = scene.retired?.player;
      return `${p ? C.playerDisplay(p) : 'A'}'s No. ${scene.retired?.num ?? ''} banner is raised to the rafters by the ${C.teamDisplay(scene.team)}.`;
    }
    if (scene.kind === 'coach-signing') {
      const C = window.HoopWireCore, who = scene.signee ? C.playerDisplay(scene.signee) : 'The player';
      return `${who} holds up a ${C.teamDisplay(scene.team)} jersey${scene.signee?.num != null ? ` with No. ${scene.signee.num}` : ''}.`;
    }
    if (scene.kind === 'coach-farewell') {
      const C = window.HoopWireCore, who = scene.retiree ? C.playerDisplay(scene.retiree) : 'The player';
      return `${who} says farewell at the podium.`;
    }
    if (scene.kind === 'coach-award') {
      const C = window.HoopWireCore, who = scene.awardee ? C.playerDisplay(scene.awardee) : 'The winner';
      return `${who} of the ${C.teamDisplay(scene.team)} at the podium with the ${scene.season} ${scene.award?.name || 'award'} trophy.`;
    }
    if (scene.kind === 'coach-draft') {
      const C = window.HoopWireCore, who = scene.draftee ? C.playerDisplay(scene.draftee) : 'The pick';
      const round = scene.pick?.rd ? ` in round ${scene.pick.rd}` : '';
      return `${who} at the podium with the commissioner after going No. ${scene.pick?.pk || 1}${round} to the ${C.teamDisplay(scene.team)} in the ${scene.season} draft.`;
    }
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
  const court = team => structuredClone({ id: team?.id, city: team?.city, name: team?.name, shortName: team?.shortName, logoURL: team?.logoURL || null, teamColors: team?.teamColors, uniforms: team?.uniforms, court: team?.court, championships: { yearsWon: [...(team?.championships?.yearsWon || [])] } });
  // The arena's ad strip: its home team's, else the first team in the league with one.
  function adsFor(home, league) {
    const office = home?.frontOffice?.adsURL ? home.frontOffice : (league.teams || []).find(t => t.frontOffice?.adsURL)?.frontOffice;
    return office ? { url: office.adsURL, size: Number(office.adSize) || null } : null;
  }
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
      version: 28, seed: id, kind: `coach-${context.coachScene}`,
      league: { name: league.leagueName || null, logoURL: league.logoURL || null },
      team: court(team),
      venue: context.venue && context.venue.id !== team?.id ? court(context.venue) : null,
      trophy: trophyColors(league), ads: adsFor(context.venue || team, league),
      coach: context.coach, executive: executive ? { ...snap(executive), isCoach: true } : null,
      // The broadcast crew at the table works for the arena's home team.
      broadcasters: ((context.venue || team)?.frontOffice?.staff || []).filter(p => p.pos !== 1 && p.appearance).slice(0, 4).map(p => ({ ...snap(p), isCoach: true })),
      draftee: context.draftee ? { ...snap(context.draftee), wearsSuit: true, isCoach: false } : null, pick: context.pick || null,
      awardee: context.awardee ? { ...snap(context.awardee), wearsSuit: true, isCoach: false } : null,
      inductee: snap(context.inductee), hall: (context.hall || []).map(snap),
      signee: context.signee ? { ...snap(context.signee), wearsSuit: true, isCoach: false } : null,
      retiree: context.retiree ? { ...snap(context.retiree), wearsSuit: true, isCoach: false } : null,
      recruit: snap(context.recruit),
      retired: context.retired ? { player: snap(context.retired.player), num: context.retired.num, years: context.retired.years || null } : null,
      retiredNumbers: (team?.retiredNumbers || []).map(n => typeof n === 'object' ? n?.num ?? n?.number ?? n?.jersey : n).filter(n => n != null),
      award: context.award ? { name: context.award.name, sprite: context.award.spriteName, primary: context.award.primaryC, secondary: context.award.secondaryC, base: context.award.baseC, plate: context.award.plateC } : null,
      players: [...(context.celebrants || []), ...others].slice(0, 4).map(snap), record: context.record || null, champion: !!context.champion, season
    };
  }
  window.HoopWireCoachScenes = { draw, caption, inputs, kinds: ['coach-hire', 'coach-fire', 'coach-poor', 'coach-good', 'coach-draft', 'coach-award', 'coach-hof', 'coach-signing', 'coach-farewell', 'coach-rafters', 'coach-commit'] };
})();
