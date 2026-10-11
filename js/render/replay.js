/* Short replays of a story's featured play: a dunk, or a made jumper from a spot on the floor, animated
   with the same court and player sprites as the story's picture. */
(() => {
  'use strict';
  // Everything is planned on the native 1024 x 512 court, attacking the right basket, and mirrored for the
  // left one. The save's shot spots use game units: 32 pixels each, from center court (512, 256).
  const RIM = [802, 189],
    BASKET = [802, 256],
    // A dunk takes off from the floor in front of the basket and rises with the ball up on the basket side, then
    // hangs under the rim. Both use the unmirrored (left-facing) frames at the right basket: the dunk frame holds
    // the ball near pixel (25, 5) of its 32-pixel cell, at the rim from apex, and the hanging frame grips the rim at pixel (8, 11), so a
    // player at hang.x, hang.lift off the floor, has that hand on the front of the rim.
    DUNK = { ground: 276, takeoff: 748, apex: { x: 788, lift: 64 }, hang: { x: 804, lift: 65 } };
  const SPOTS = {
    'corner-three': { shot: [786, 402], pts: 3, label: 'hits a corner three' },
    'wing-three': { shot: [684, 380], pts: 3, label: 'hits a three from the wing' },
    'top-three': { shot: [628, 262], pts: 3, label: 'hits a three from the top of the key' },
    elbow: { shot: [702, 306], pts: 2, label: 'hits a jumper from the elbow' },
    baseline: { shot: [784, 344], pts: 2, label: 'hits a baseline jumper' },
  };
  // The game's hoop animations (Hoop Land's net_swish, hoop_dunked and hoop_released clips): the net steps through
  // its four frames as the ball goes through, and a dunk pulls the rim and net down a couple of degrees, holding
  // them there while the dunker hangs, then wobbles them back when the dunker lets go. Times are seconds;
  // tilts are degrees, negative pulling the rim down.
  const NET_SWISH = [
      [0, 0],
      [0.05, 1],
      [0.1, 2],
      [0.15, 3],
      [0.25, 2],
      [0.3, 1],
      [0.35, 0],
    ],
    HOOP_DUNKED = [
      [0, 0],
      [0.1, -2],
      [0.2, -1.5],
      [0.4, -1.5],
    ],
    HOOP_RELEASED = [
      [0, -1.5],
      [0.1, 1],
      [0.2, -0.75],
      [0.3, 0.25],
      [0.4, 0],
    ];
  // Dunks start from one of these and dribble in to the takeoff spot.
  const LANES = { wing: [640, 340], top: [596, 262], baseline: [700, 392] };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    lerp = (a, b, u) => a + (b - a) * u,
    smooth = u => u * u * (3 - 2 * u),
    phase = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  // Only action pictures of a player in a game get a replay; an injury stays a still.
  function available(scene) {
    return (
      scene?.kind === 'action' &&
      !!scene.player &&
      !!scene.team &&
      !String(scene.action?.variant || '').startsWith('injury') &&
      scene.pose !== 'injured-leg'
    );
  }

  // The featured player's made field goals from the save's last game, when that is this story's game.
  // play 2 is a make in the play-by-play; type 9 is a free throw.
  function madeShots(league, story, playerId) {
    const game = league?.currentGame;
    if (!game || game.inProgress || story?.gid == null || game.gId !== story.gid || playerId == null) return [];
    return (game.playByPlay || [])
      .filter(e => e?.play === 2 && e.shotData?.pid === playerId && e.shotData.type !== 9 && e.shotData.pts >= 2)
      .map(e => ({
        x: 512 + e.shotData.posX * 32,
        y: 256 - e.shotData.posY * 32,
        type: e.shotData.type,
        pts: e.shotData.pts,
      }))
      .filter(s => Number.isFinite(s.x) && Number.isFinite(s.y));
  }

  function plan(scene, story = {}, shots = []) {
    if (!available(scene)) return null;
    const C = window.HoopWireCore,
      seed = String(story.id || scene.seed || 'replay'),
      variant = String(scene.action?.variant || '');
    let side = ['left', 'right'].includes(scene.action?.side) ? scene.action.side : scene.attackDirection;
    side = side === 'left' ? 'left' : 'right';
    const real = (shots || []).filter(s => Number.isFinite(s.x) && Number.isFinite(s.y));
    if (real.length) {
      const shot = C.choose(seed, real, 'replay-shot'),
        right = shot.x >= 512,
        x = right ? shot.x : 1024 - shot.x,
        y = clamp(shot.y, 104, 408),
        close = Math.hypot(x - BASKET[0], y - BASKET[1]) < 56;
      // Types 0 and 4 are finishes at the rim; the game has no layup sprite, so they are dunks.
      if ([0, 4].includes(shot.type) || close)
        return {
          kind: 'dunk',
          side: right ? 'right' : 'left',
          start: LANES[C.choose(seed, Object.keys(LANES), 'replay-lane')],
          pts: 2,
          label: 'throws it down',
          real: true,
          duration: 4,
        };
      return {
        kind: 'jumper',
        side: right ? 'right' : 'left',
        spot: [clamp(x, 560, 836), y],
        pts: shot.pts === 3 ? 3 : 2,
        label: shot.pts === 3 ? 'hits a three' : 'hits a jumper',
        real: true,
        duration: 4.4,
      };
    }
    const dunk =
      variant.startsWith('dunk') || (variant.startsWith('drive') && C.choose(seed, [true, false], 'replay-drive'));
    if (dunk)
      return {
        kind: 'dunk',
        side,
        start: LANES[C.choose(seed, Object.keys(LANES), 'replay-lane')],
        pts: 2,
        label: 'throws it down',
        real: false,
        duration: 4,
      };
    const threes = Object.keys(SPOTS).filter(k => SPOTS[k].pts === 3),
      name = C.choose(
        seed,
        variant.includes('three') || variant === 'shot-close-up' ? threes : Object.keys(SPOTS),
        'replay-spot'
      );
    return {
      kind: 'jumper',
      side,
      spot: [...SPOTS[name].shot],
      spotName: name,
      pts: SPOTS[name].pts,
      label: SPOTS[name].label,
      real: false,
      duration: 4.4,
    };
  }

  // Where everyone and the ball are at time t, in right-basket coordinates. Players are { x, foot, lift, pose,
  // frame, facing }: x and foot are the ground point, lift how far they are off the floor.
  function frameAt(clip, t) {
    t = clamp(t, 0, clip.duration);
    return { ...playAt(clip, t), camera: camera(clip, t) };
  }
  const playAt = (clip, t) => (clip.kind === 'dunk' ? dunkAt(clip, t) : jumperAt(clip, t));
  // The net frame u seconds into a swish, and a hoop tilt eased between the clip's keys.
  function netFrame(u) {
    if (!(u >= 0)) return 0;
    let frame = 0;
    for (const [time, value] of NET_SWISH) if (u >= time) frame = value;
    return frame;
  }
  function tiltAt(keys, u) {
    if (!(u > 0)) return keys[0][1];
    for (let i = 1; i < keys.length; i++)
      if (u < keys[i][0]) {
        const [a, from] = keys[i - 1],
          [b, to] = keys[i];
        return lerp(from, to, smooth((u - a) / (b - a)));
      }
    return keys.at(-1)[1];
  }
  const step = (t, fps, n) => Math.floor(t * fps) % n;
  const toward = (from, to) => (to >= from ? 'right' : 'left');

  function ballAfterMake(t, made, depthX = RIM[0]) {
    // Through the net, then down to the floor under the basket, a bounce, and a roll toward the camera.
    const u = t - made;
    if (u < 0.14) return { x: depthX, y: lerp(RIM[1], RIM[1] + 16, u / 0.14), ground: BASKET[1] + 4, behind: true };
    const fall = u - 0.14;
    const floor = BASKET[1] + 4;
    if (fall < 0.26)
      return { x: depthX - fall * 18, y: lerp(RIM[1] + 16, floor - 3, (fall / 0.26) ** 2), ground: floor, foot: floor };
    const hop = fall - 0.26,
      roll = depthX - 4.7 - hop * 22,
      ground = floor + hop * 14;
    const bounce =
      hop < 0.34
        ? Math.sin((Math.PI * hop) / 0.34) * 14
        : hop < 0.52
          ? Math.sin((Math.PI * (hop - 0.34)) / 0.18) * 4
          : 0;
    return { x: roll, y: ground - 3 - bounce, ground, foot: ground };
  }

  // The shooter brings the ball up from further out and a little toward the middle of the floor.
  const jumperStart = ([x, y]) => [Math.max(530, x - 70), y + (256 - y) * 0.25];
  function jumperAt(clip, t) {
    const [sx, sy] = clip.spot,
      start = jumperStart(clip.spot),
      facingRim = toward(sx, RIM[0]);
    const shooter = { x: sx, foot: sy, lift: 0, pose: 'idle', frame: step(t, 6, 4), facing: facingRim };
    if (t < 1.2) {
      const u = smooth(t / 1.2);
      Object.assign(shooter, {
        x: lerp(start[0], sx, u),
        foot: lerp(start[1], sy, u),
        pose: 'dribbling',
        frame: step(t, 10, 4),
        facing: toward(start[0], sx),
      });
    } else if (t < 2.4) {
      // The game's shot: gather (0-1), the ball up (2-3), the release (4) and the follow-through (5-7).
      const k = t - 1.2;
      shooter.pose = 'shooting';
      shooter.frame =
        k < 0.12 ? 0 : k < 0.24 ? 1 : k < 0.36 ? 2 : k < 0.48 ? 3 : k < 0.7 ? 4 : k < 0.85 ? 5 : k < 1 ? 6 : 7;
      shooter.lift = k > 0.24 && k < 0.85 ? Math.sin((Math.PI * (k - 0.24)) / 0.61) * 9 : 0;
    }
    const release = 1.7,
      fs = facingRim === 'right' ? 1 : -1,
      from = [sx + 10 * fs, sy - 40 - 9],
      distance = Math.hypot(RIM[0] - from[0], RIM[1] - from[1]),
      flight = 0.5 + distance / 500,
      made = release + flight,
      arc = 26 + distance * 0.22;
    let ball = null;
    if (t >= release && t < made) {
      const u = (t - release) / flight;
      ball = {
        x: lerp(from[0], RIM[0], u),
        y: lerp(from[1], RIM[1], u) - arc * 4 * u * (1 - u),
        ground: lerp(sy, BASKET[1], u),
        // The last stretch drops in behind the front of the rim.
        behind: u > 0.9,
      };
    } else if (t >= made) ball = ballAfterMake(t, made);
    if (t > made + 0.3) Object.assign(shooter, { pose: 'celebrate', frame: step(t, 8, 4), lift: 0, facing: facingRim });

    // The closest defender closes out from the paint and gets a hand up as the shot goes.
    const toRim = Math.hypot(BASKET[0] - sx, BASKET[1] - sy) || 1,
      ux = (BASKET[0] - sx) / toRim,
      uy = (BASKET[1] - sy) / toRim,
      guard = [sx + ux * 24, sy + uy * 24 + 5],
      paint = [lerp(sx, BASKET[0], 0.6), lerp(sy, BASKET[1], 0.6) + 6];
    const close = smooth(phase(t, 0.3, 1.45)),
      defender = {
        x: lerp(paint[0], guard[0], close),
        foot: lerp(paint[1], guard[1], close),
        lift: 0,
        pose: close > 0 && close < 1 ? 'running' : 'idle',
        frame: close > 0 && close < 1 ? step(t, 10, 4) : step(t, 6, 4),
        facing: toward(guard[0] + ux, sx),
      };
    if (t >= 1.45 && t < 2.1)
      Object.assign(defender, { pose: 'celebrate', frame: 2, lift: Math.sin((Math.PI * (t - 1.45)) / 0.65) * 6 });
    const spread = support(clip, t, made);
    return { shooter, defender, ...spread, ball, made, release, shake: 0, hoop: { net: netFrame(t - made), tilt: 0 } };
  }

  function dunkAt(clip, t) {
    const [px, py] = clip.start,
      shooter = { x: DUNK.takeoff, foot: DUNK.ground, lift: 0, pose: 'idle', frame: 0, facing: 'right' };
    const rise = 1.25,
      slam = 1.65,
      drop = 2.15,
      land = 2.4;
    if (t < rise) {
      const u = smooth(t / rise);
      Object.assign(shooter, {
        x: lerp(px, DUNK.takeoff, u),
        foot: lerp(py, DUNK.ground, u),
        pose: 'dribbling',
        frame: step(t, 11, 4),
        facing: toward(px, DUNK.takeoff),
      });
    } else if (t < slam) {
      // The game's two-hand dunk, the ball raised toward the rim.
      const u = (t - rise) / (slam - rise);
      Object.assign(shooter, {
        x: lerp(DUNK.takeoff, DUNK.apex.x, u),
        lift: DUNK.apex.lift * Math.sin((Math.PI / 2) * u),
        pose: 'dunking',
        frame: 0,
        facing: 'left',
      });
    } else if (t < drop)
      // Hanging on the rim (the game's dunk_hanging), dipping a pixel as the rim gives.
      Object.assign(shooter, {
        // Carried the last few pixels under the rim as the dunk goes down.
        x: lerp(DUNK.apex.x, DUNK.hang.x, smooth(phase(t, slam, slam + 0.1))),
        lift: DUNK.hang.lift - Math.sin(Math.PI * phase(t, slam, slam + 0.2)) * 1.5,
        pose: 'dunk-released',
        frame: 0,
        facing: 'left',
      });
    else if (t < land) {
      // Letting go (dunk_released: frames 0, 1, 2, 0) and dropping to the floor.
      const u = phase(t, drop, land);
      Object.assign(shooter, {
        x: DUNK.hang.x,
        lift: DUNK.hang.lift * (1 - u * u),
        pose: 'dunk-released',
        frame: t - drop < 0.08 ? 1 : t - drop < 0.16 ? 2 : 0,
        facing: 'left',
      });
    } else if (t < land + 0.2)
      // The landing, arms up (dunk_landing), before the celebration.
      Object.assign(shooter, { x: DUNK.hang.x, pose: 'dunk-released', frame: 3, facing: 'left' });
    else Object.assign(shooter, { x: DUNK.hang.x, pose: 'celebrate', frame: step(t, 8, 4), facing: 'left' });
    const ball = t >= slam ? ballAfterMake(t, slam) : null;
    // A trailing defender who gets there a step late.
    const chase = smooth(phase(t, 0.15, 1.5)),
      defender = {
        x: lerp(px - 34, DUNK.takeoff - 22, chase),
        foot: lerp(py + 12, DUNK.ground + 16, chase),
        lift: 0,
        pose: chase < 1 ? 'running' : 'idle',
        frame: chase < 1 ? step(t, 10, 4) : step(t, 6, 4),
        facing: 'right',
      };
    if (t >= 1.4 && t < 1.95)
      Object.assign(defender, { pose: 'celebrate', frame: 2, lift: Math.sin((Math.PI * (t - 1.4)) / 0.55) * 7 });
    const spread = support(clip, t, slam);
    return {
      shooter,
      defender,
      ...spread,
      ball,
      made: slam,
      release: rise,
      hoop: {
        net: netFrame(t - slam),
        tilt: t < drop ? tiltAt(HOOP_DUNKED, t - slam) : tiltAt(HOOP_RELEASED, t - drop),
      },
      shake: t >= slam && t < slam + 0.18 ? (1 - (t - slam) / 0.18) * 2 : 0,
    };
  }

  // Everyone else holds a spot away from the play; a teammate celebrates the make.
  function support(clip, t, made) {
    const ball = clip.kind === 'dunk' ? [DUNK.takeoff, DUNK.ground] : clip.spot;
    const spots = [
      [612, 196],
      [700, 410],
      [790, 160],
      [660, 290],
    ].filter(p => Math.hypot(p[0] - ball[0], p[1] - ball[1]) > 60);
    const teammates = spots.slice(0, 2).map((p, i) => ({
      x: p[0],
      foot: p[1],
      lift: 0,
      pose: i === 0 && t > made + 0.25 ? 'celebrate' : 'idle',
      frame: step(t + i * 0.3, i === 0 && t > made + 0.25 ? 8 : 6, 4),
      facing: toward(p[0], ball[0]),
    }));
    // Help defense sits in the paint for a jumper and steps out of the lane for a dunk.
    const helpers = (
      clip.kind === 'dunk'
        ? [
            [BASKET[0] - 78, BASKET[1] - 44],
            [BASKET[0] - 104, BASKET[1] + 54],
          ]
        : [
            [BASKET[0] - 40, BASKET[1] - 34],
            [BASKET[0] - 64, BASKET[1] + 40],
          ]
    ).map((p, i) => ({
      x: p[0],
      foot: p[1],
      lift: 0,
      pose: 'idle',
      frame: step(t + 0.5 + i * 0.2, 6, 4),
      facing: toward(p[0], ball[0]),
    }));
    return { teammates, opponents: helpers };
  }

  // The camera works like a broadcast replay: on the shooter for the move, with the basket's side of the
  // floor in view, then up with the ball to the rim, then back to the shooter for the celebration.
  // A dunk is close enough to the rim to keep both in the shot.
  // Each hand-off between those is a blend over a few tenths of a second, so the target never jumps.
  function focus(clip, t) {
    const state = playAt(clip, t),
      p = state.shooter,
      body = [p.x, p.foot - p.lift - 22],
      rim = [RIM[0] - 18, RIM[1] + 22],
      mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    if (clip.kind === 'dunk') return [lerp(p.x, rim[0], 0.45), lerp(p.foot - 22, RIM[1] - 8, 0.45)];
    // The ball starts in the shooter's hands and ends at the rim, so following it is continuous too.
    const ball = state.ball && t < state.made ? [state.ball.x, state.ball.y] : t < state.release ? body : RIM,
      lead = mix(body, rim, 0.22),
      flight = mix(ball, rim, 0.35),
      after = mix(body, rim, 0.15);
    const up = smooth(phase(t, state.release - 0.2, state.release + 0.25)),
      back = smooth(phase(t, state.made + 0.3, state.made + 1));
    return mix(mix(lead, flight, up), after, back);
  }
  function camera(clip, t) {
    // Eased by a weighted average of where it wanted to be over the last 0.6 seconds, heaviest in the middle,
    // so it pans instead of cutting and starts and stops gently.
    let x = 0,
      y = 0,
      total = 0;
    const samples = 24;
    for (let i = 0; i < samples; i++) {
      const weight = Math.sin((Math.PI * (i + 0.5)) / samples),
        [a, b] = focus(clip, Math.max(0, t - (0.6 * i) / samples));
      x += a * weight;
      y += b * weight;
      total += weight;
    }
    x /= total;
    y /= total;
    const late = smooth(phase(t, clip.kind === 'dunk' ? 1.0 : 1.9, clip.kind === 'dunk' ? 1.6 : 2.7)),
      w = clip.kind === 'dunk' ? lerp(272, 232, late) : lerp(272, 248, late);
    return { x, y, w, h: (w * 9) / 16 };
  }

  // Drawing. Sprites are cached per pose, frame and facing, since the game's art is recolored per player.
  // label is the corner tag: REPLAY on a story, HIGHLIGHTS on HoopWire TV.
  async function prepare(scene, clip, { label = 'REPLAY' } = {}) {
    await window.HoopWirePlayer.ready();
    const floor = await window.HoopWireCourt.render(scene.home || scene.team, { includeHoops: false });
    const hoops = document.createElement('canvas');
    hoops.width = 2048;
    hoops.height = 1024;
    const h = hoops.getContext('2d');
    h.imageSmoothingEnabled = false;
    h.scale(2, 2);
    // The rim and net are drawn each frame, so they can swish and tilt; the rest of the hoop is fixed.
    floor.hoopFrame(h);
    const [rim, net] = await Promise.all(
      ['rim', 'net-swish'].map(name => window.HoopWireCourt.loadImage(`assets/court/${name}.png`))
    );
    const ball = document.createElement('canvas');
    ball.width = ball.height = 16;
    window.HoopWirePlayer.drawBall(ball, scene.ball);
    const assets = { scene, clip, label, floor: floor.canvas, hoops, rim, net, ball, tiles: new Map() };
    // Recolor every sprite the clip will show before it plays, so no frame waits on one.
    for (let t = 0; t <= clip.duration; t += 1 / 30)
      for (const [key, data, team, uniform, p] of castOf(scene, playAt(clip, t)))
        tile(assets, key, data, team, uniform, p.pose, p.frame, facing(clip, p.facing));
    return assets;
  }
  // Who is on the floor: the cache key, the player, their team and uniform, and where they are this frame.
  function castOf(scene, state) {
    return [
      ['player', scene.player, scene.team, scene.uniformIndex, state.shooter],
      [
        'opp0',
        scene.opponents?.[0] || scene.opponentPlayer,
        scene.opponent,
        scene.opponentUniformIndex,
        state.defender,
      ],
      ['mate0', scene.teammates?.[0], scene.team, scene.uniformIndex, state.teammates[0]],
      ['mate1', scene.teammates?.[1], scene.team, scene.uniformIndex, state.teammates[1]],
      ['opp1', scene.opponents?.[1], scene.opponent, scene.opponentUniformIndex, state.opponents[0]],
      ['opp2', scene.opponents?.[2], scene.opponent, scene.opponentUniformIndex, state.opponents[1]],
    ].filter(a => a[1] && a[4]);
  }
  // Every sheet is drawn facing left, as the game's *_front_left frames; the renderer mirrors it for right.
  // A clip at the left basket mirrors the whole play.
  const facing = (clip, f) => (clip.side === 'left' ? (f === 'right' ? 'left' : 'right') : f);
  function tile(assets, key, data, team, uniform, pose, frame, facing) {
    const id = `${key}|${pose}|${frame}|${facing}`;
    let canvas = assets.tiles.get(id);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 168;
      window.HoopWirePlayer.draw(canvas, data, team, uniform, frame, pose, facing, assets.scene.ball);
      assets.tiles.set(id, canvas);
    }
    return canvas;
  }
  // Both rims and nets, placed as the court renderer places them; only the basket in play moves.
  function rims(ctx, assets, hoop, mirror) {
    const { rim, net, pivot } = window.HoopWireCourt.rimLayout;
    for (const right of [false, true]) {
      const live = right !== mirror,
        tilt = live ? hoop.tilt : 0,
        frame = live ? hoop.net : 0;
      ctx.save();
      if (right) {
        ctx.translate(1024, 0);
        ctx.scale(-1, 1);
      }
      // Drawn as the left hoop: a negative tilt turns the free end of the rim down, clockwise on screen.
      ctx.translate(pivot[0], pivot[1]);
      ctx.rotate((-tilt * Math.PI) / 180);
      ctx.translate(-pivot[0], -pivot[1]);
      ctx.drawImage(assets.rim, rim[0], rim[1]);
      ctx.drawImage(assets.net, frame * 32, 0, 32, 32, net[0], net[1], 32, 32);
      ctx.restore();
    }
  }
  function draw(canvas, assets, t) {
    const { scene, clip } = assets,
      state = frameAt(clip, t),
      ctx = canvas.getContext('2d'),
      mirror = clip.side === 'left',
      X = x => (mirror ? 1024 - x : x),
      face = f => facing(clip, f);
    const cam = state.camera,
      w = cam.w,
      h = cam.h,
      left = clamp(X(cam.x) - w / 2, 0, 1024 - w),
      top = clamp(cam.y - h / 2, 0, 512 - h),
      scale = canvas.width / w,
      shake = state.shake ? Math.sin(t * 90) * state.shake : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#162b49';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, Math.round((-left + shake) * scale), Math.round((-top + shake * 0.5) * scale));
    ctx.drawImage(assets.floor, 0, 0, 1024, 512);
    const cast = castOf(scene, state);
    // Shadows stay on the floor, under the ground point of anyone in the air.
    ctx.fillStyle = '#00000033';
    for (const [, , , , p] of cast) {
      ctx.beginPath();
      ctx.ellipse(X(p.x), p.foot - 2, 11 * (1 - Math.min(0.4, p.lift / 120)), 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const ball = state.ball;
    if (ball) {
      ctx.fillStyle = '#0000002e';
      ctx.beginPath();
      ctx.ellipse(X(ball.x), ball.ground, 4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const layers = cast.map(([key, data, team, uniform, p]) => ({
      depth: p.foot,
      order: 0,
      draw: () =>
        ctx.drawImage(
          tile(assets, key, data, team, uniform, p.pose, p.frame, face(p.facing)),
          Math.round(X(p.x) - 16),
          Math.round(p.foot - 42 - p.lift),
          32,
          42
        ),
    }));
    layers.push(
      { depth: BASKET[1], order: 1, draw: () => ctx.drawImage(assets.hoops, 0, 0, 1024, 512) },
      { depth: BASKET[1], order: 3, draw: () => rims(ctx, assets, state.hoop, mirror) }
    );
    const ballLayer = ball && {
      // Going through the hoop, the ball is in front of the backboard and behind the rim and net.
      depth: ball.behind ? BASKET[1] : (ball.foot ?? 1e6),
      order: 2,
      draw: () => ctx.drawImage(assets.ball, Math.round(X(ball.x) - 4), Math.round(ball.y - 4), 8, 8),
    };
    if (ballLayer) layers.push(ballLayer);
    layers.sort((a, b) => a.depth - b.depth || a.order - b.order).forEach(layer => layer.draw());
    // The broadcast's replay bug, and the result once the ball is through.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = '700 22px "Segoe UI", Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'middle';
    const label = assets.label || 'REPLAY',
      width = ctx.measureText(label).width + 28;
    ctx.fillStyle = '#081829d9';
    ctx.fillRect(18, 18, width, 38);
    ctx.fillStyle = '#ee3546';
    ctx.fillRect(18, 18, 6, 38);
    ctx.fillStyle = '#79fff4';
    ctx.fillText(label, 34, 38);
    if (t > state.made + 0.2) {
      const C = window.HoopWireCore,
        text = `${C.playerDisplay(scene.player).toUpperCase()} · ${clip.kind === 'dunk' ? 'DUNK' : clip.pts === 3 ? '3 PTS' : '2 PTS'}`;
      ctx.font = '700 24px "Segoe UI", Arial, Helvetica, sans-serif';
      const u = Math.min(1, (t - state.made - 0.2) / 0.25),
        bar = ctx.measureText(text).width + 36;
      ctx.globalAlpha = u;
      ctx.fillStyle = '#081829e6';
      ctx.fillRect(18, canvas.height - 64, bar, 44);
      ctx.fillStyle = '#238bce';
      ctx.fillRect(18, canvas.height - 64, bar, 4);
      ctx.fillStyle = '#f0f7ff';
      ctx.fillText(text, 36, canvas.height - 40);
      ctx.globalAlpha = 1;
    }
  }

  // Plays a clip into the canvas, from a point in it when resuming; done resolves true when it ends and false
  // when it is stopped, and elapsed() says how far it got.
  function play(canvas, assets, { onFrame, from = 0 } = {}) {
    let stopped = false,
      frame = 0,
      resolve;
    const done = new Promise(r => (resolve = r));
    let t = from;
    const started = performance.now() - from * 1000,
      tick = now => {
        if (stopped) return;
        t = Math.max(from, (now - started) / 1000);
        // The feed redraws its articles; a replay taken off the page stops with it.
        if (t > from + 0.1 && !canvas.isConnected) {
          stopped = true;
          return resolve(false);
        }
        draw(canvas, assets, Math.min(t, assets.clip.duration));
        onFrame?.(t);
        if (t >= assets.clip.duration + 0.5) {
          stopped = true;
          resolve(true);
        } else frame = requestAnimationFrame(tick);
      };
    frame = requestAnimationFrame(tick);
    return {
      done,
      elapsed: () => t,
      stop() {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(frame);
        resolve(false);
      },
    };
  }

  function caption(scene, clip) {
    if (!clip) return '';
    return `Replay: ${window.HoopWireCore.playerDisplay(scene.player)} ${clip.label}.`;
  }

  window.HoopWireReplay = {
    available,
    madeShots,
    plan,
    frameAt,
    netFrame,
    prepare,
    draw,
    play,
    caption,
    SPOTS,
    RIM,
    BASKET,
  };
})();
