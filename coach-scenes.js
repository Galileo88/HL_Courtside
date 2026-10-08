/* Coach story scenes, built from the game's own art at the game's scale:
   the team's court inside the game's arena crowd, the bench chairs and
   sitting and celebrating sprites, the press wall and podium, the locker
   room. The camera frames a 384 x 216 piece of the world at 2x, the same
   framing as the wide action shots, so people are their native 32 x 42. */
(() => {
  "use strict";
  const art = {};
  let ready;
  const files = ['crowd-100', 'crowd-50', 'crowd-0', 'chair', 'trophy', 'confetti', 'camera-flash', 'draft-podium', 'locker-room'];
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
  // The world arena: the court sits at (512, 256) inside the 2048 x 1024 crowd
  // layout, as in the game. The crowd art is trimmed to rows 141-875.
  const COURT = [512, 256], CROWD_TOP = 141;
  // Home fans wear the team's color: the crowd's blue shirt pixels take the primary.
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
  function person(ctx, data, team, pose, frame, x, foot, facing = 'left') {
    if (!data) return;
    const tile = document.createElement('canvas'); tile.width = 128; tile.height = 168;
    window.HoopWirePlayer.draw(tile, data, team, 0, frame, pose, facing, {});
    ctx.drawImage(tile, x - 16, foot - 42, 32, 42);
  }
  function shadow(ctx, x, foot, w = 11) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, foot - 2, w, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  // One 32 x 32 cell of a three-column atlas.
  const cell = (ctx, image, index, x, y, size = 32, cols = 3) => ctx.drawImage(image, index % cols * 32, Math.floor(index / cols) * 32, 32, 32, x, y, size, size);
  // The game's broadcast camera: an elevated view from beyond the near
  // sideline, so the floor recedes and the far stands rise behind the court.
  // The floor is projected row by row; people and chairs stand at their
  // projected spot at whole-pixel scale. focus is the floor point the camera
  // frames, at 2x there, the native scale of the wide action shots.
  const STANDS_BASE = 310, RANGE = 520, LENS = 2 * RANGE, HEIGHT = 240, RAKE = 55 * Math.PI / 180;
  async function arena(scene, crowd, [camX, focusY]) {
    const team = scene.team, floor = await window.HoopWireCourt.render(team, { includeHoops: false });
    const plane = document.createElement('canvas'); plane.width = 2048; plane.height = 1024;
    const p = plane.getContext('2d'); p.imageSmoothingEnabled = false;
    // Outside the apron the game shows its dark arena floor, not the court image's margin.
    p.fillStyle = '#141020'; p.fillRect(0, 0, 2048, 1024);
    p.fillStyle = '#262439'; p.fillRect(COURT[0] + 16, COURT[1] + 32, 992, 448);
    p.drawImage(floor.canvas, 151, 55, 722, 402, COURT[0] + 151, COURT[1] + 55, 722, 402);
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 432;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const near = focusY + RANGE, horizon = 300 - LENS * HEIGHT / RANGE;
    const project = (wx, wy) => { const z = near - wy, s = LENS / z; return [384 + (wx - camX) * s, horizon + LENS * HEIGHT / z, s]; };
    ctx.fillStyle = '#0c0a14'; ctx.fillRect(0, 0, 768, 432);
    const top = Math.floor(project(camX, STANDS_BASE)[1]);
    for (let y = Math.max(0, top); y < 432; y++) {
      const z = LENS * HEIGHT / (y + .5 - horizon), wy = near - z, s = LENS / z;
      ctx.drawImage(plane, camX - 384 / s, Math.floor(wy), 768 / s, 1, 0, y, 768, 1);
    }
    // The far stands: a raked plane rising back from the far apron, drawn row
    // by row like the floor, so each row of fans sits higher and farther away.
    const fans = tinted(art[crowd], teamColor(team, 0, '#147dff')), rows = STANDS_BASE - CROWD_TOP, zBase = near - STANDS_BASE;
    const at = v => { const d = rows - v, z = zBase + d * Math.cos(RAKE); return [horizon + LENS * (HEIGHT - d * Math.sin(RAKE)) / z, LENS / z]; };
    for (let v = 0; v < rows; v++) {
      const [y0, s] = at(v), [y1] = at(v + 1), top = Math.floor(y0), h = Math.ceil(y1) - top;
      if (h > 0) ctx.drawImage(fans, camX - 384 / s, v, 768 / s, 1, 0, top, 768, h);
    }
    return { canvas, ctx, project, customCourt: floor.customCourt };
  }
  // A person or prop on the floor at (wx, wy), at the projected whole-pixel scale.
  function stand(ctx, project, wx, wy) { const [x, y, s] = project(wx, wy); return [x, y, Math.max(1, Math.round(s))]; }
  function placed(ctx, project, list) {
    for (const a of list.filter(a => a.data).sort((a, b) => a.foot - b.foot)) {
      const [x, y, k] = stand(ctx, project, a.x, a.foot);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y - k, 11 * k, 3 * k, 0, 0, Math.PI * 2); ctx.fill();
      const tile = document.createElement('canvas'); tile.width = 128; tile.height = 168;
      window.HoopWirePlayer.draw(tile, a.data, a.team, 0, a.frame, a.pose, a.facing, {});
      ctx.drawImage(tile, Math.round(x - 16 * k), Math.round(y - 42 * k), 32 * k, 42 * k);
      a.screen = [x, y, k];
    }
    return list;
  }
  function depth(ctx, list) { list.filter(a => a.data).sort((a, b) => a.foot - b.foot).forEach(a => { shadow(ctx, a.x, a.foot); person(ctx, a.data, a.team, a.pose, a.frame, a.x, a.foot, a.facing); }); }

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
      const { canvas, ctx } = stage([0, 0, 256, 144]);
      const room = art['locker-room'], top = 50;
      // The game's locker room tile, run the width of the room, with its wood above and its carpet below in the team's color.
      ctx.fillStyle = 'rgb(70,33,31)'; ctx.fillRect(0, 0, 256, top);
      ctx.fillStyle = 'rgb(98,53,48)'; for (let y = 6; y < top; y += 8) ctx.fillRect(0, y, 256, 1);
      for (let x = 0; x < 256; x += 64) ctx.drawImage(room, x, top);
      ctx.fillStyle = 'rgb(15,77,163)'; ctx.fillRect(0, top + 64, 256, 144 - top - 64);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, top + 64, 256, 2);
      // The coach on the middle chair of the second locker bay.
      shadow(ctx, 96, top + 60, 10);
      person(ctx, scene.coach, scene.team, 'sitting', 0, 96, top + 58, 'left');
      const light = ctx.createRadialGradient(96, top + 40, 8, 96, top + 40, 150);
      light.addColorStop(0, 'rgba(0,0,0,0)'); light.addColorStop(1, 'rgba(4,6,14,.7)');
      ctx.fillStyle = light; ctx.fillRect(0, 0, 256, 144);
      return { canvas };
    },
    // A rough season: a thin crowd, a quiet bench, the coach on the sideline.
    async poor(scene, rand) {
      const crowd = scene.record && scene.record[0] / Math.max(1, scene.record[0] + scene.record[1]) < .3 ? 'crowd-0' : 'crowd-50';
      const { canvas, ctx, project, customCourt } = await arena(scene, crowd, [880, 350]);
      // The bench on the far sideline: chairs, a few players sitting, the coach in front.
      const seat = 334, sitters = (scene.players || []).slice(0, 3);
      for (const x of [776, 802, 828, 854, 880, 906, 932, 958]) { const [sx, sy, k] = stand(ctx, project, x, seat); cell(ctx, art.chair, 0, Math.round(sx - 16 * k), Math.round(sy - 32 * k), 32 * k); }
      placed(ctx, project, [802, 880, 932].map((x, i) => ({ data: sitters[i], team: scene.team, pose: 'bench-idle', frame: i % 4, x, foot: seat + 2, facing: 'left' })));
      placed(ctx, project, [{ data: scene.coach, team: scene.team, pose: 'idle', frame: 0, x: 900, foot: 372, facing: 'left' }]);
      const [cx, cy] = project(900, 372), light = ctx.createRadialGradient(cx, cy - 40, 12, cx, cy - 40, 520);
      light.addColorStop(0, 'rgba(0,0,0,.04)'); light.addColorStop(1, 'rgba(6,9,20,.55)');
      ctx.fillStyle = light; ctx.fillRect(0, 0, 768, 432);
      return { canvas, extra: { customCourt } };
    },
    // A good season: a full house, confetti, the coach and the stars at center court.
    async good(scene, rand) {
      const { canvas, ctx, project, customCourt } = await arena(scene, 'crowd-100', [1024, 404]);
      const players = scene.players || [];
      const list = placed(ctx, project, [
        { data: players[0], team: scene.team, pose: 'celebrate', frame: 0, x: 930, foot: 390, facing: 'right' },
        { data: players[1], team: scene.team, pose: 'celebrate', frame: 2, x: 1118, foot: 392, facing: 'left' },
        { data: players[2], team: scene.team, pose: 'celebrate', frame: 1, x: 972, foot: 408, facing: 'right' },
        { data: players[3], team: scene.team, pose: 'celebrate', frame: 3, x: 1076, foot: 410, facing: 'left' },
        { data: scene.coach, team: scene.team, pose: scene.champion ? 'celebrate' : 'idle', frame: 0, x: 1024, foot: 420, facing: 'left', coach: true }
      ]);
      const coach = list.find(a => a.coach)?.screen;
      // The trophy, raised over the coach's head.
      if (scene.champion && coach) { const [x, y, k] = coach; ctx.drawImage(art.trophy, Math.round(x - 12 * k), Math.round(y - 60 * k), 24 * k, 24 * k); }
      // The game's confetti, in the team's colors, over the whole frame.
      const pieces = [teamColor(scene.team, 0, '#147dff'), teamColor(scene.team, 1, '#ffffff'), '#ffffff', '#ffd23f'].map(c => recolor(art.confetti, c));
      for (let i = 0; i < 10; i++) ctx.drawImage(pieces[i % pieces.length], -80 + (i % 5) * 190 + rand() * 60, -100 + Math.floor(i / 5) * 230 + rand() * 60, 320, 320);
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
      'coach-good': scene.champion ? `${name} and the ${team} celebrate the ${scene.season} championship.` : `${name} and the ${team} celebrate a ${record}season.`
    })[scene.kind] || `${name} of the ${team}.`;
  }
  const snap = person => person ? structuredClone({ id: person.id, tid: person.tid, fn: person.fn, ln: person.ln, num: person.num, appearance: person.appearance, accessories: person.accessories, suits: person.suits, isCoach: !!person.isCoach }) : null;
  // Scene inputs from a story context: { coach, coachScene, record, champion, celebrants }.
  function inputs(context, id, league = {}, season = null) {
    const team = context.winner;
    const executive = (team?.frontOffice?.staff || []).filter(p => p.pos !== 1 && p.appearance).sort((a, b) => a.pos - b.pos)[0];
    const others = (team?.roster || []).filter(p => !(context.celebrants || []).some(c => c.id === p.id)).sort((a, b) => a.id - b.id);
    return {
      version: 3, seed: id, kind: `coach-${context.coachScene}`,
      league: { name: league.leagueName || null, logoURL: league.logoURL || null },
      team: structuredClone({ id: team?.id, city: team?.city, name: team?.name, shortName: team?.shortName, logoURL: team?.logoURL || null, teamColors: team?.teamColors, uniforms: team?.uniforms, court: team?.court }),
      coach: context.coach, executive: executive ? { ...snap(executive), isCoach: true } : null,
      players: [...(context.celebrants || []), ...others].slice(0, 4).map(snap), record: context.record || null, champion: !!context.champion, season
    };
  }
  window.HoopWireCoachScenes = { draw, caption, inputs, kinds: ['coach-hire', 'coach-fire', 'coach-poor', 'coach-good'] };
})();
