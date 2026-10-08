/* Coach story scenes: hiring, firing, a rough season and a good one.
   Everything is drawn on a 192 x 108 logical grid at 4x, the same pixel
   size as the 32 x 42 game sprites, so props and people match. */
(() => {
  "use strict";
  const U = 4, W = 192, H = 108;
  const hex = value => /^#?[\da-f]{6}$/i.test(String(value || '')) ? '#' + String(value).replace('#', '') : null;
  const rgb = value => { const v = hex(value) || '#808080'; return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); };
  const css = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  const tone = (value, scale) => css(rgb(value).map(c => Math.max(0, Math.min(255, c * scale))));
  // Team colors: primary, secondary; a uniform slot (PRI/SEC/TER) resolves through them.
  const teamColor = (team, slot, fallback) => hex(team?.teamColors?.[slot]) || fallback;
  const slotColor = (team, value, fallback) => { const slot = { PRI: 0, SEC: 1, TER: 2 }[String(value || '').toUpperCase()]; return slot === undefined ? hex(value) || fallback : teamColor(team, slot, fallback); };
  function seeded(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function painter(ctx) {
    const px = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x) * U, Math.round(y) * U, Math.round(w) * U, Math.round(h) * U); };
    return px;
  }
  // A 3 x 5 pixel font for scoreboards and signs.
  const glyphs = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
    '-': '000000111000000', A: '010101111101101', C: '111100100100111', E: '111100111100111', H: '101101111101101',
    I: '111010010010111', L: '100100100100111', M: '101111111101101', N: '111101101101101', O: '111101101101111',
    P: '111101111100100', S: '111100111001111', T: '111010010010010', X: '101101010101101', R: '110101110101101', D: '110101101101110'
  };
  function text(px, value, x, y, color) {
    let cx = x;
    for (const ch of String(value).toUpperCase()) {
      const g = glyphs[ch];
      if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') px(cx + i % 3, y + Math.floor(i / 3), 1, 1, color);
      cx += ch === ' ' ? 3 : 4;
    }
  }
  const width = value => String(value).length * 4 - 1;
  function figure(ctx, data, team, x, foot, facing = 'left') {
    if (!data) return;
    const tile = document.createElement('canvas'); tile.width = 128; tile.height = 168;
    window.HoopWirePlayer.draw(tile, data, team, 0, 0, 'idle', facing, {});
    ctx.drawImage(tile, x * U, (foot - 42) * U, 128, 168);
  }
  function shadow(ctx, x, foot) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse((x + 16) * U, (foot - 1) * U, 13 * U, 3 * U, 0, 0, Math.PI * 2); ctx.fill(); }
  async function logoImage(data) {
    if (!data) return null;
    const image = new Image(); image.src = data;
    try { await image.decode(); return image; } catch { return null; }
  }

  // An arena from courtside: stands, a scoreboard, the ad boards, the team's own floor.
  async function arena(ctx, px, scene, rand, { full, dim }) {
    const team = scene.team, primary = teamColor(team, 0, '#1455a5'), secondary = teamColor(team, 1, '#e7ab45');
    px(0, 0, W, 60, dim ? '#0b0f17' : '#162238');
    // Seats rise in rows; a full house is heads in every seat, a bad year leaves them empty.
    for (let y = 22; y < 54; y += 3) for (let x = (y % 2) * 1.5; x < W; x += 3) {
      const filled = rand() < full;
      if (!filled) { px(x, y, 2, 2, tone(primary, dim ? .28 : .4)); px(x, y + 1, 2, 1, tone(primary, dim ? .2 : .3)); continue; }
      const crowd = [primary, secondary, '#f0d2b0', '#8a5a3c', '#e8e8e8', '#4c6a8c'];
      px(x, y, 2, 2, tone(crowd[Math.floor(rand() * crowd.length)], dim ? .45 : 1));
    }
    // Scoreboard.
    px(62, 2, 68, 21, '#3b4252'); px(63, 3, 66, 19, '#05070b');
    // Ad boards, then the floor from the team's own court.
    px(0, 54, W, 6, tone(primary, dim ? .5 : 1)); px(0, 54, W, 1, tone(primary, dim ? .7 : 1.3));
    const floor = await window.HoopWireCourt.render(team, { includeHoops: false });
    ctx.drawImage(floor.canvas, 120, 236, 784, 190, 0, 60 * U, W * U, (H - 60) * U);
    if (dim) { ctx.fillStyle = 'rgba(6,10,20,.38)'; ctx.fillRect(0, 60 * U, W * U, (H - 60) * U); }
    return { primary, secondary, customCourt: floor.customCourt };
  }
  function board(px, top, bottom, color) {
    if (top) text(px, top, 96 - Math.round(width(top) / 2), 6, '#c9d6e8');
    text(px, bottom, 96 - Math.round(width(bottom) / 2), top ? 13 : 10, color);
  }

  const scenes = {
    // Introductory press conference: the new coach and a team executive hold up the jersey.
    async hire(ctx, px, scene, rand, art) {
      const team = scene.team;
      const wall = await window.HoopWirePressBackdrop.render(art['press-background'], team, scene.pressLogoData, { scale: 2, league: scene.league, leagueData: scene.pressLeagueLogoData });
      window.HoopWirePressBackdrop.paint(ctx, wall, [0, 0, 768, 432]);
      px(0, 90, W, 18, '#1b2130'); px(0, 90, W, 1, tone(teamColor(team, 0, '#1455a5'), 1.1)); px(0, 91, W, 1, '#2b3346');
      const exec = scene.executive, coachX = exec ? 98 : 80;
      if (exec) { shadow(ctx, 62, 94); figure(ctx, exec, team, 62, 94, 'left'); }
      shadow(ctx, coachX, 94); figure(ctx, scene.coach, team, coachX, 94, 'right');
      // The jersey, in the team's home colors, held up between them.
      const u = team?.uniforms?.[0] || {}, body = slotColor(team, u.jersey, teamColor(team, 0, '#1455a5')), trim = slotColor(team, u.jerseyStripe, teamColor(team, 1, '#ffffff'));
      const shape = ['000111000000111000', '001111100001111100', '011111111111111110', '111111111111111111', '011111111111111110', '001111111111111100', '000111111111111000', '000111111111111000', '000111111111111000', '000111111111111000', '000111111111111000', '000111111111111000', '000111111111111000', '000111111111111000', '000111111111111000', '000011111111110000'];
      const jx = (exec ? 87 : 95), jy = 62;
      shape.forEach((row, y) => [...row].forEach((c, x) => { if (c === '1') px(jx + x, jy + y, 1, 1, body); }));
      px(jx + 6, jy + 2, 6, 1, trim); px(jx + 7, jy + 3, 4, 1, trim); px(jx + 3, jy + 4, 1, 3, trim); px(jx + 14, jy + 4, 1, 3, trim); px(jx + 4, jy + 15, 10, 1, trim);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect((jx + 3) * U, (jy + 13) * U, 12 * U, 2 * U);
      const number = String(scene.season || '').slice(-2) || '1';
      text(px, number, jx + 9 - Math.round(width(number) / 2), jy + 6, trim);
      // A few camera flashes from the press row.
      for (let i = 0; i < 4; i++) {
        const x = 10 + rand() * 172, y = 6 + rand() * 30;
        ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(x * U, y * U, 4 * U, 0, Math.PI * 2); ctx.fill();
        px(x - 2, y, 5, 1, '#ffffff'); px(x, y - 2, 1, 5, '#ffffff');
      }
      return { pressLogoData: wall.logoData, pressLeagueLogoData: wall.leagueLogoData };
    },
    // Cleaning out the office: a dim arena hallway, a cardboard box, the exit.
    async fire(ctx, px, scene, rand, art) {
      const team = scene.team, primary = teamColor(team, 0, '#1455a5');
      px(0, 0, W, 80, tone(teamColor(team, 2, '#283038'), .55));
      for (let y = 0; y < 80; y += 8) px(0, y, W, 1, 'rgba(0,0,0,.18)');
      px(0, 52, W, 4, tone(primary, .6)); px(0, 52, W, 1, tone(primary, .85));
      px(0, 80, W, 28, '#2a2e36'); for (let x = 0; x < W; x += 16) px(x, 80, 1, 28, '#23262d'); px(0, 80, W, 1, '#3a3f49');
      // The exit door, lit from the other side.
      px(148, 30, 30, 50, '#15181e'); px(150, 32, 26, 48, '#4a5160'); px(152, 36, 8, 8, '#ffe9a8'); px(154, 58, 20, 2, '#aab3c2');
      ctx.fillStyle = 'rgba(255,233,168,.10)'; ctx.beginPath(); ctx.moveTo(150 * U, 80 * U); ctx.lineTo(176 * U, 80 * U); ctx.lineTo(192 * U, 108 * U); ctx.lineTo(120 * U, 108 * U); ctx.fill();
      px(151, 21, 24, 8, '#2a0b0b'); text(px, 'EXIT', 155, 22, '#ff5a4f');
      ctx.fillStyle = 'rgba(255,70,60,.16)'; ctx.fillRect(147 * U, 17 * U, 32 * U, 16 * U);
      // The team's framed logo, hanging crooked.
      const wall = await window.HoopWirePressBackdrop.render(art['press-background'], team, scene.pressLogoData, { scale: 1, league: scene.league, leagueData: scene.pressLeagueLogoData });
      const logo = await logoImage(wall.logoData);
      ctx.save(); ctx.translate(42 * U, 30 * U); ctx.rotate(-0.12);
      ctx.fillStyle = '#5a3b22'; ctx.fillRect(-13 * U, -13 * U, 26 * U, 26 * U); ctx.fillStyle = '#e9e4d8'; ctx.fillRect(-11 * U, -11 * U, 22 * U, 22 * U);
      if (logo) { ctx.imageSmoothingEnabled = false; ctx.drawImage(logo, -10 * U, -10 * U, 20 * U, 20 * U); }
      ctx.restore();
      // One flickering tube light over the coach.
      px(78, 2, 40, 2, '#d7ecff');
      ctx.fillStyle = 'rgba(215,236,255,.08)'; ctx.beginPath(); ctx.moveTo(78 * U, 4 * U); ctx.lineTo(118 * U, 4 * U); ctx.lineTo(132 * U, 100 * U); ctx.lineTo(64 * U, 100 * U); ctx.fill();
      shadow(ctx, 82, 98); figure(ctx, scene.coach, team, 82, 98, 'right');
      // The box at the waist: a ball, a clipboard, a framed photo.
      const bx = 91, by = 85;
      px(bx + 1, by - 4, 4, 4, '#e37033'); px(bx + 2, by - 4, 1, 4, '#44220f');
      px(bx + 8, by - 6, 4, 6, '#b5874f'); px(bx + 9, by - 5, 2, 4, '#f4f1e8'); px(bx + 9, by - 7, 2, 1, '#8d8d8d');
      px(bx + 5, by - 3, 3, 3, '#2b2b2b'); px(bx + 6, by - 2, 1, 1, tone(primary, 1));
      px(bx - 1, by - 1, 16, 1, '#5e3f20'); px(bx - 1, by, 1, 8, '#5e3f20'); px(bx + 14, by, 1, 8, '#5e3f20');
      px(bx, by, 14, 8, '#b98a52'); px(bx, by, 14, 1, '#d4a76a'); px(bx, by + 7, 14, 1, '#7d5530'); px(bx + 6, by + 1, 2, 6, '#a57742');
      ctx.fillStyle = 'rgba(8,12,24,.22)'; ctx.fillRect(0, 0, W * U, H * U);
      return { pressLogoData: wall.logoData, pressLeagueLogoData: wall.leagueLogoData };
    },
    // A rough season: a half-empty arena, the coach alone by the bench, the record in red.
    async poor(ctx, px, scene, rand) {
      const team = scene.team, { primary, customCourt } = await arena(ctx, px, scene, rand, { full: .22, dim: true });
      board(px, String(scene.season || ''), scene.record ? `${scene.record[0]}-${scene.record[1]}` : '', '#ff3b30');
      // The bench, mostly empty: a towel, a tipped bottle, cups on the floor.
      for (let i = 0; i < 7; i++) { px(20 + i * 12, 64, 9, 7, tone(primary, .55)); px(20 + i * 12, 64, 9, 1, tone(primary, .75)); px(22 + i * 12, 71, 1, 4, '#1a1d24'); px(27 + i * 12, 71, 1, 4, '#1a1d24'); }
      px(46, 63, 7, 3, '#e8e8e8'); px(48, 66, 3, 3, '#d0d0d0');
      px(70, 92, 6, 3, '#d9e7f2'); px(76, 93, 2, 2, '#9cc3e0'); px(36, 95, 3, 3, '#f1f1f1'); px(120, 97, 3, 3, '#f1f1f1'); px(41, 97, 2, 2, '#f1f1f1');
      const coachX = 100;
      const light = ctx.createRadialGradient((coachX + 16) * U, 70 * U, 8 * U, (coachX + 16) * U, 70 * U, 46 * U);
      light.addColorStop(0, 'rgba(255,240,210,.10)'); light.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = light; ctx.fillRect(0, 0, W * U, H * U);
      shadow(ctx, coachX, 100); figure(ctx, scene.coach, team, coachX, 100, 'left');
      ctx.fillStyle = 'rgba(6,10,22,.18)'; ctx.fillRect(0, 0, W * U, H * U);
      return { customCourt };
    },
    // A good season: a packed house, confetti, the coach at center court with the stars.
    async good(ctx, px, scene, rand) {
      const team = scene.team, { primary, secondary, customCourt } = await arena(ctx, px, scene, rand, { full: .96, dim: false });
      board(px, scene.champion ? 'CHAMPIONS' : String(scene.season || ''), scene.record ? `${scene.record[0]}-${scene.record[1]}` : '', '#ffd23f');
      const glow = ctx.createLinearGradient(0, 0, 0, 60 * U); glow.addColorStop(0, 'rgba(255,255,255,.10)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W * U, 60 * U);
      const people = [[scene.players?.[0], 46, 99, 'right'], [scene.players?.[1], 128, 99, 'left'], [scene.coach, 87, 101, 'left']];
      for (const [who, x, foot, facing] of people) if (who) { shadow(ctx, x, foot); figure(ctx, who, team, x, foot, facing); }
      if (scene.champion) {
        // The trophy, held at the coach's chest: outlined so it reads as a cup.
        const tx = 99, ty = 83, o = '#4a2f06';
        px(tx - 2, ty - 1, 13, 1, o); px(tx - 2, ty - 1, 1, 6, o); px(tx + 10, ty - 1, 1, 6, o);
        px(tx - 1, ty, 2, 1, '#f2c230'); px(tx + 8, ty, 2, 1, '#f2c230'); px(tx - 1, ty + 1, 1, 3, '#f2c230'); px(tx + 9, ty + 1, 1, 3, '#f2c230');
        px(tx + 1, ty - 1, 7, 6, o); px(tx + 2, ty - 1, 5, 5, '#f2c230'); px(tx + 3, ty, 1, 3, '#fff3b0'); px(tx + 2, ty + 4, 5, 1, '#d9a520');
        px(tx + 3, ty + 5, 3, 3, o); px(tx + 4, ty + 5, 1, 2, '#c8941a');
        px(tx + 1, ty + 8, 7, 3, o); px(tx + 2, ty + 8, 5, 2, '#7a4f12');
      }
      // Confetti in the team's colors.
      const pieces = [primary, secondary, '#ffffff', '#ffd23f'];
      for (let i = 0; i < 150; i++) { const x = rand() * W, y = rand() * H; px(x, y, rand() < .5 ? 1 : 2, rand() < .5 ? 1 : 2, pieces[Math.floor(rand() * pieces.length)]); }
      return { customCourt };
    }
  };

  async function draw(ctx, scene, art) {
    ctx.imageSmoothingEnabled = false;
    const px = painter(ctx), rand = seeded(scene.seed || 'coach');
    const style = String(scene.kind).replace(/^coach-/, '');
    return (await (scenes[style] || scenes.hire)(ctx, px, scene, rand, art)) || {};
  }
  function caption(scene) {
    const C = window.HoopWireCore, name = scene.coach ? C.playerDisplay(scene.coach) : 'The coach', team = C.teamDisplay(scene.team);
    const record = scene.record ? `${scene.record[0]}-${scene.record[1]}` : null;
    return ({
      'coach-hire': `${name} is introduced as head coach of the ${team}.`,
      'coach-fire': `${name} clears out after leaving the ${team}.`,
      'coach-poor': `${name} on the sideline during a ${record ? `${record} ` : ''}season for the ${team}.`,
      'coach-good': scene.champion ? `${name} and the ${team} celebrate the ${scene.season} championship.` : `${name} and the ${team} celebrate a ${record ? `${record} ` : ''}season.`
    })[scene.kind] || `${name} of the ${team}.`;
  }
  const snap = person => person ? structuredClone({ id: person.id, tid: person.tid, fn: person.fn, ln: person.ln, num: person.num, appearance: person.appearance, accessories: person.accessories, suits: person.suits, isCoach: !!person.isCoach }) : null;
  // Scene inputs from a story context: { coach, coachScene, record, champion, celebrants }.
  function inputs(context, id, league = {}, season = null) {
    const team = context.winner, C = window.HoopWireCore;
    const executive = (team?.frontOffice?.staff || []).filter(p => p.pos !== 1 && p.appearance).sort((a, b) => a.pos - b.pos)[0];
    return {
      version: 1, seed: id, kind: `coach-${context.coachScene}`,
      league: { name: league.leagueName || null, logoURL: league.logoURL || null },
      team: structuredClone({ id: team?.id, city: team?.city, name: team?.name, shortName: team?.shortName, logoURL: team?.logoURL || null, teamColors: team?.teamColors, uniforms: team?.uniforms, court: team?.court }),
      coach: context.coach, executive: executive ? { ...snap(executive), isCoach: true } : null,
      players: (context.celebrants || []).map(snap), record: context.record || null, champion: !!context.champion, season
    };
  }
  window.HoopWireCoachScenes = { draw, caption, inputs, kinds: ['coach-hire', 'coach-fire', 'coach-poor', 'coach-good'] };
})();
