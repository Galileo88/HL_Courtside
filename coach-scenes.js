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
  async function arena(ctx, scene, crowd) {
    const floor = await window.HoopWireCourt.render(scene.team, { includeHoops: false });
    // Outside the apron the game shows its dark arena floor, not the court image's margin.
    ctx.fillStyle = '#141020'; ctx.fillRect(0, 0, 2048, 1024);
    ctx.fillStyle = '#262439'; ctx.fillRect(COURT[0] + 16, COURT[1] + 32, 992, 448);
    ctx.drawImage(floor.canvas, 151, 55, 722, 402, COURT[0] + 151, COURT[1] + 55, 722, 402);
    ctx.drawImage(tinted(art[crowd], teamColor(scene.team, 0, '#147dff')), 0, CROWD_TOP);
    return floor.customCourt;
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
      const camera = [700, 250, 384, 216], { canvas, ctx } = stage(camera);
      const customCourt = await arena(ctx, scene, scene.record && scene.record[0] / Math.max(1, scene.record[0] + scene.record[1]) < .3 ? 'crowd-0' : 'crowd-50');
      // The bench on the sideline, under the stands: chairs, a few players sitting.
      const seat = 334, sitters = (scene.players || []).slice(0, 3);
      for (const x of [760, 786, 812, 838, 864, 890, 916, 942]) cell(ctx, art.chair, 0, x - 16, seat - 30);
      [786, 864, 916].forEach((x, i) => person(ctx, sitters[i], scene.team, 'bench-idle', i % 4, x, seat + 2, 'left'));
      depth(ctx, [{ data: scene.coach, team: scene.team, pose: 'idle', frame: 0, x: 968, foot: 372, facing: 'left' }]);
      const light = ctx.createRadialGradient(968, 352, 12, 968, 352, 260);
      light.addColorStop(0, 'rgba(0,0,0,.05)'); light.addColorStop(1, 'rgba(6,9,20,.55)');
      ctx.fillStyle = light; ctx.fillRect(...camera);
      return { canvas, extra: { customCourt } };
    },
    // A good season: a full house, confetti, the coach and the stars at center court.
    async good(scene, rand) {
      const camera = [832, 224, 384, 216], { canvas, ctx } = stage(camera);
      const customCourt = await arena(ctx, scene, 'crowd-100');
      const players = scene.players || [];
      depth(ctx, [
        { data: players[0], team: scene.team, pose: 'celebrate', frame: 0, x: 912, foot: 392, facing: 'right' },
        { data: players[1], team: scene.team, pose: 'celebrate', frame: 2, x: 1132, foot: 396, facing: 'left' },
        { data: players[2], team: scene.team, pose: 'celebrate', frame: 1, x: 966, foot: 410, facing: 'right' },
        { data: players[3], team: scene.team, pose: 'celebrate', frame: 3, x: 1080, foot: 412, facing: 'left' },
        { data: scene.coach, team: scene.team, pose: scene.champion ? 'celebrate' : 'idle', frame: 0, x: 1024, foot: 420, facing: 'left' }
      ]);
      if (scene.champion) ctx.drawImage(art.trophy, 1012, 352, 24, 24);
      // The game's confetti, in the team's colors.
      const pieces = [teamColor(scene.team, 0, '#147dff'), teamColor(scene.team, 1, '#ffffff'), '#ffffff', '#ffd23f'].map(c => recolor(art.confetti, c));
      for (let i = 0; i < 10; i++) ctx.drawImage(pieces[i % pieces.length], camera[0] - 96 + (i % 5) * 96 + rand() * 40, camera[1] - 80 + Math.floor(i / 5) * 110 + rand() * 40, 160, 160);
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
      version: 2, seed: id, kind: `coach-${context.coachScene}`,
      league: { name: league.leagueName || null, logoURL: league.logoURL || null },
      team: structuredClone({ id: team?.id, city: team?.city, name: team?.name, shortName: team?.shortName, logoURL: team?.logoURL || null, teamColors: team?.teamColors, uniforms: team?.uniforms, court: team?.court }),
      coach: context.coach, executive: executive ? { ...snap(executive), isCoach: true } : null,
      players: [...(context.celebrants || []), ...others].slice(0, 4).map(snap), record: context.record || null, champion: !!context.champion, season
    };
  }
  window.HoopWireCoachScenes = { draw, caption, inputs, kinds: ['coach-hire', 'coach-fire', 'coach-poor', 'coach-good'] };
})();
