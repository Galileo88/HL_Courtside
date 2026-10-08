/* Draws Hoop Land player sprites with a player's appearance and team uniform. */
(() => {
  const root = './player-assets/';
  const files = [
    'idle',
    'head',
    'eye-white',
    'eye-color',
    'brow-color',
    'unibrow-color',
    'hair',
    'facial-hair',
    'head-accessories',
    'shooting',
    'shooting-arms',
    'dribbling',
    'passing',
    'passing-arms',
    'dunking',
    'dunking-arms',
    'coach-jacket',
    'coach-undershirt',
    'coach-tie',
    'staff-idle',
    'staff-idle-alt',
    'jersey-numbers',
    'celebrate',
    'bench-idle',
    'bench-celebrate',
    'sitting',
    'sitting-staff',
    'injured-leg',
    'injured-leg-arms',
    'running',
    'running-arms',
  ];
  const images = {};
  const flightBall = new Image();
  flightBall.src = './scene-assets/ball-seams.png';
  images['flight-ball'] = flightBall;
  for (const file of files) {
    const image = new Image();
    image.src =
      ([
        'shooting',
        'shooting-arms',
        'dribbling',
        'passing',
        'passing-arms',
        'dunking',
        'dunking-arms',
        'coach-jacket',
        'coach-undershirt',
        'coach-tie',
        'staff-idle',
        'staff-idle-alt',
        'jersey-numbers',
        'celebrate',
        'bench-idle',
        'bench-celebrate',
        'sitting',
        'sitting-staff',
        'injured-leg',
        'injured-leg-arms',
        'running',
        'running-arms',
      ].includes(file)
        ? './scene-assets/'
        : root) +
      file +
      '.png';
    images[file] = image;
  }
  const hex = (value, fallback) =>
    /^#?[\da-f]{6}$/i.test(String(value || '')) ? '#' + String(value).replace('#', '') : fallback;
  const color = (value, team, fallback) => {
    const slot = { PRI: 0, SEC: 1, TER: 2 }[String(value || '').toUpperCase()];
    return hex(slot === undefined ? value : team?.teamColors?.[slot], fallback);
  };
  const rgb = value => {
    const v = hex(value, '#ffffff');
    return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  };
  function shade(base, scale) {
    return base.map(channel => Math.max(0, Math.min(255, Math.round(channel * scale))));
  }
  function paint(ctx, image, sx, sy, tint) {
    if (!image.complete || !image.naturalWidth) return;
    const off = document.createElement('canvas');
    off.width = off.height = 32;
    const layer = off.getContext('2d', { willReadFrequently: true });
    layer.drawImage(image, sx, sy, 32, 32, 0, 0, 32, 32);
    if (tint) {
      const data = layer.getImageData(0, 0, 32, 32),
        base = rgb(tint);
      for (let i = 0; i < data.data.length; i += 4) {
        if (!data.data[i + 3]) continue;
        const [r, g, b] = data.data.slice(i, i + 3);
        if (r < 25 && g < 25 && b < 25) continue;
        const next = shade(base, r > 230 ? 1.1 : r < 190 ? 0.75 : 1);
        data.data[i] = next[0];
        data.data[i + 1] = next[1];
        data.data[i + 2] = next[2];
      }
      layer.putImageData(data, 0, 0);
    }
    ctx.drawImage(off, 0, 0);
  }
  function atlas(ctx, image, code, columns, tint, frame) {
    const number = Number(code);
    if (!Number.isInteger(number) || number < 1) return;
    const x = (number % columns) * 64 + (frame % 2) * 32,
      y = Math.floor(number / columns) * 64;
    paint(ctx, image, x, y, tint);
  }
  const skinShades = { '220,129,88': 1, '215,85,66': 0.78, '225,174,120': 1.15, '195,36,58': 0.65, '210,53,48': 0.7 };
  // Ball pixels use their own native palette markers, separate from accessories.
  function ballPalette(ball = {}) {
    const primary = rgb(hex(ball.pri, '#E37033'));
    return {
      '230,50,0': rgb(hex(ball.outline, '#44220F')),
      '229,100,0': shade(primary, 0.7),
      '226,150,0': primary,
      '227,200,0': shade(rgb(hex(ball.sec, '#E37033')), 1.3),
      '228,255,0': shade(rgb(hex(ball.ter, '#E37033')), 1.6),
    };
  }
  const shortsStarts = [21, 22, 23, 22];
  function body(ctx, frame, player, team, uniformIndex, pose = 'idle', ball = {}) {
    const nativeSuit = (player.isCoach || player.wearsSuit) && (pose === 'idle' || pose === 'suit-standing');
    // Staff sit in the game's own suited sitting sprite.
    const image = nativeSuit
      ? images['staff-idle-alt']
      : (player.isCoach || player.wearsSuit) && pose === 'sitting'
        ? images['sitting-staff']
        : images[pose];
    if (!image?.complete || !image.naturalWidth) return null;
    const off = document.createElement('canvas');
    off.width = off.height = 32;
    const columns = image.naturalWidth / 32;
    const layer = off.getContext('2d', { willReadFrequently: true });
    layer.drawImage(image, (frame % columns) * 32, Math.floor(frame / columns) * 32, 32, 32, 0, 0, 32, 32);
    const pixels = layer.getImageData(0, 0, 32, 32),
      source = new Uint8ClampedArray(pixels.data);
    const skinColor = hex(player.appearance?.skinC, '#dc8158'),
      skin = rgb(skinColor);
    const ballColors = ballPalette(ball);
    const suit = player.isCoach || player.wearsSuit ? player.suits?.[0] || {} : null;
    const uniform = suit
      ? {
          jersey: suit.jacketC,
          shorts: suit.pantC,
          jerseyStripe: suit.jacketC,
          jerseyCollar: suit.shirtC,
          shortsStripe: suit.pantC,
        }
      : team?.uniforms?.[uniformIndex] || team?.uniforms?.[0] || {};
    const gear =
      player.isCoach || player.wearsSuit
        ? player.suits?.[0] || {}
        : player.accessories?.[uniformIndex] || player.accessories?.[0] || {};
    const jersey = rgb(color(uniform.jersey, team, '#147dff')),
      shorts = rgb(color(uniform.shorts, team, '#147dff'));
    const jerseyStripe = rgb(color(uniform.jerseyStripe, team, color(uniform.jersey, team, '#147dff')));
    const jerseyCollar = rgb(
      color(uniform.jerseyCollar, team, color(uniform.jerseyStripe, team, color(uniform.jersey, team, '#147dff')))
    );
    const shortsStripe = rgb(color(uniform.shortsStripe, team, color(uniform.shorts, team, '#147dff')));
    const shortsStart = shortsStarts[frame % 4] ?? 22;
    const uniformRows = Array.from({ length: 32 }, () => ({ min: 32, max: -1 }));
    for (let i = 0; i < source.length; i += 4) {
      const r = source[i],
        b = source[i + 2],
        a = source[i + 3];
      if (!a || b !== 255 || r > 40) continue;
      const pixel = Math.floor(i / 4),
        x = pixel % 32,
        y = Math.floor(pixel / 32),
        row = uniformRows[y];
      row.min = Math.min(row.min, x);
      row.max = Math.max(row.max, x);
    }
    const gearRgb = (key, fallback) => rgb(color(gear[key], team, fallback));
    const accessory = {
      L_Shoulder: gearRgb('L_Shoulder', skinColor),
      R_Shoulder: gearRgb('R_Shoulder', skinColor),
      L_Elbow: gearRgb('L_Elbow', skinColor),
      R_Elbow: gearRgb('R_Elbow', skinColor),
      L_Wrist: gearRgb('L_Wrist', skinColor),
      R_Wrist: gearRgb('R_Wrist', skinColor),
      L_Knee: gearRgb('L_Knee', skinColor),
      R_Knee: gearRgb('R_Knee', skinColor),
      L_Shin: gearRgb('L_Shin', skinColor),
      R_Shin: gearRgb('R_Shin', skinColor),
      sockC: gearRgb('sockC', '#ffffff'),
      shoeC: gearRgb('shoeC', '#ffffff'),
      soleC: gearRgb('soleC', '#202020'),
    };
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (!pixels.data[i + 3]) continue;
      const r = source[i],
        g = source[i + 1],
        b = source[i + 2],
        pixel = Math.floor(i / 4),
        x = pixel % 32,
        y = Math.floor(pixel / 32);
      let next;
      const skinScale = skinShades[`${r},${g},${b}`];
      if (nativeSuit && suit) {
        // Native suit atlas: dedicated clothing masks, no overlays.
        const suitColor = (key, fallback) => rgb(color(suit[key], team, fallback));
        if (r === 195 && g === 36 && b === 58) next = suitColor('shoeC', '#000000');
        else if (skinScale !== undefined) next = shade(skin, skinScale);
        else if (b === 255 && r <= 35) {
          const key = r === 5 ? 'tieC' : r === 10 ? 'shirtC' : r === 25 || r === 35 ? 'pantC' : 'jacketC';
          next = shade(suitColor(key, key === 'shirtC' ? '#ffffff' : '#262539'), r === 30 || r === 35 ? 0.7 : 1);
        } else if (r === 200 && g === 255 && b === 255) next = suitColor('laceC', color(suit.shoeC, team, '#000000'));
        else if (r === 205 && g === 172 && b === 190) next = suitColor('soleC', '#000000');
      } else if (ballColors[`${r},${g},${b}`]) next = ballColors[`${r},${g},${b}`];
      else if (skinScale !== undefined) next = shade(skin, skinScale);
      else if (
        suit &&
        y >= 14 &&
        ['163,172,190', '103,112,139', '38,36,58', '57,58,86', '20,16,32'].includes(`${r},${g},${b}`)
      ) {
        const base = rgb(color(y >= 27 ? suit.shoeC : y >= 22 ? suit.pantC : suit.jacketC, team, '#262539'));
        next = shade(base, r > 150 ? 1.2 : r > 90 ? 0.95 : r > 50 ? 1.1 : r < 30 ? 0.6 : 0.85);
      } else if (suit && r === 15 && g === 77 && b === 163) next = rgb(color(suit.tieC, team, '#67718a'));
      else if (b === 255 && r <= 40) {
        const isShorts = y >= shortsStart,
          row = uniformRows[y],
          width = row.max - row.min + 1;
        const leftEdge = x === row.min,
          rightEdge = x === row.max;
        // The idle sprite encodes the collar as exactly three (5,200,255) pixels;
        // matching only those avoids recoloring nearby jersey pixels.
        const collar = r === 5 && g === 200;
        // Hoop Land's front-facing uniform is asymmetric: the viewer-left torso and
        // shorts edge stay in the base uniform color. The upper-left shoulder and
        // viewer-right edges use the configured stripe colors.
        const leftShoulder = !isShorts && y <= shortsStart - 5;
        // Exact shorts-stripe mask includes the isolated hip and inset pixels.
        const isShortsStripe = r === 15 && g === 150;
        const base = isShorts ? shorts : jersey;
        let target = base,
          direct = false;
        if (isShortsStripe) {
          target = shortsStripe;
          direct = true;
        } else if (collar) {
          target = jerseyCollar;
          direct = true;
        } else if (width >= 4 && rightEdge && y < shortsStart - 2) {
          target = jerseyStripe;
          direct = true;
        } else if (width >= 4 && leftEdge && leftShoulder) {
          target = jerseyStripe;
          direct = true;
        }
        next = direct ? target : shade(base, Math.max(0.55, Math.min(1.3, g / 150)));
      } else if (b === 0 && g >= 120 && r < 200) {
        const key = r < 75 ? 'L_Shoulder' : r < 120 ? 'R_Shoulder' : r < 150 ? 'L_Knee' : 'R_Knee';
        next = shade(accessory[key], Math.max(0.6, Math.min(1.2, g / 175)));
      } else if (g === 0 && b >= 100) {
        const key = r < 90 ? 'L_Elbow' : r < 130 ? 'R_Elbow' : r < 160 ? 'L_Shin' : 'R_Shin';
        next = shade(accessory[key], Math.max(0.6, Math.min(1.2, b / 200)));
      } else if (b === 150 && g >= 100) {
        const key = r < 100 ? 'L_Wrist' : r < 150 ? 'R_Wrist' : 'sockC';
        next = shade(accessory[key], Math.max(0.6, Math.min(1.1, g / 150)));
      } else if (r === 200 && g === 255 && b === 255) next = accessory.shoeC;
      else if (r === 205 && g === 172 && b === 190) next = accessory.soleC;
      if (next) {
        pixels.data[i] = next[0];
        pixels.data[i + 1] = next[1];
        pixels.data[i + 2] = next[2];
      }
    }
    layer.putImageData(pixels, 0, 0);
    ctx.drawImage(off, 0, 0);
    return { uniform, shortsStart };
  }
  function jerseyNumber(ctx, player, team, uniform, scale, offsetY, frame, pose, facing) {
    const value = Number(player.num);
    if (!Number.isInteger(value) || value < 0 || value > 100) return;
    const tile = document.createElement('canvas');
    tile.width = tile.height = 16;
    const layer = tile.getContext('2d');
    layer.drawImage(images['jersey-numbers'], (value % 10) * 32, Math.floor(value / 10) * 32, 16, 16, 0, 0, 16, 16);
    layer.globalCompositeOperation = 'source-in';
    layer.fillStyle = color(uniform?.jerseyNumber, team, color(uniform?.jerseyStripe, team, '#ffffff'));
    layer.fillRect(0, 0, 16, 16);
    // Native numbers use 64 pixels/unit; the player body uses 32. Keep the
    // separate half-pixel detail until the final 2x action image is composed.
    const center = pose === 'dribbling' && frame === 1 ? 15 : 16;
    const x = (facing === 'right' ? 32 - center : center) - 4;
    const bob = pose === 'idle' ? [0, 1, 2, 1][frame % 4] : 0;
    ctx.drawImage(tile, x * scale, (offsetY + 12 + bob) * scale, 8 * scale, 8 * scale);
  }
  function draw(canvas, player, team, uniformIndex, frame = 0, pose = 'idle', facing = 'left', ball = {}) {
    const ctx = canvas.getContext('2d'),
      scene = document.createElement('canvas');
    scene.width = 32;
    scene.height = 42;
    const sceneCtx = scene.getContext('2d'),
      appearance = player.appearance || {},
      gear =
        player.isCoach || player.wearsSuit
          ? player.suits?.[0] || {}
          : player.accessories?.[uniformIndex] || player.accessories?.[0] || {};
    const offsetY = 9;
    sceneCtx.save();
    sceneCtx.translate(0, offsetY);
    const bodyState = body(sceneCtx, frame, player, team, uniformIndex, pose, ball);
    sceneCtx.restore();
    if ((player.isCoach || player.wearsSuit) && pose !== 'idle' && pose !== 'suit-standing' && pose !== 'sitting') {
      const suit = player.suits?.[0] || {};
      sceneCtx.save();
      sceneCtx.translate(0, offsetY);
      paint(sceneCtx, images['coach-jacket'], 0, 0, color(suit.jacketC, team, '#262539'));
      paint(sceneCtx, images['coach-undershirt'], 0, 0, color(suit.shirtC, team, '#ffffff'));
      paint(sceneCtx, images['coach-tie'], 0, 0, color(suit.tieC, team, '#66718a'));
      sceneCtx.restore();
    }
    // The staging area adds eight logical pixels above the body.
    // The injured player sits lower in the game's sprite, the head bobbing a pixel
    // between frames; a running stride lifts the head a pixel on alternate frames.
    sceneCtx.save();
    sceneCtx.translate(
      0,
      offsetY +
        (pose === 'idle'
          ? [-8, -7, -6, -7][frame % 4]
          : pose === 'injured-leg'
            ? [-5, -4][frame % 2]
            : pose === 'running'
              ? [-9, -8][frame % 2]
              : -8)
    );
    // Back views: the second and fourth rows of the four-column atlases, the second frame of a sitting strip.
    const back =
        pose === 'dunking'
          ? frame >= 4
          : pose === 'sitting'
            ? frame % 2 === 1
            : ['idle', 'celebrate', 'bench-idle', 'bench-celebrate', 'suit-standing', 'running'].includes(pose) &&
              Math.floor(frame / 4) % 2 === 1,
      headX = back ? 32 : 0;
    // The injured sprite keeps its own pained face; only the hair goes on it.
    if (pose !== 'injured-leg') {
      paint(sceneCtx, images.head, headX, 0, hex(appearance.skinC, '#dc8158'));
      paint(sceneCtx, images['eye-white'], headX, 0);
      paint(sceneCtx, images['eye-color'], headX, 0, hex(appearance.eyeC, '#472d3c'));
      paint(sceneCtx, images['brow-color'], headX, 0, hex(appearance.browC, '#262539'));
      if (appearance.unibrow) paint(sceneCtx, images['unibrow-color'], headX, 0, hex(appearance.browC, '#262539'));
    }
    if (!back) atlas(sceneCtx, images['facial-hair'], appearance.fHair, 8, hex(appearance.fHairC, '#262539'), 0);
    atlas(sceneCtx, images.hair, appearance.hair, 16, hex(appearance.hairC, '#262539'), back ? 1 : 0);
    if (gear.headAcc !== 'none')
      atlas(sceneCtx, images['head-accessories'], gear.headAcc, 8, color(gear.headAccC, team, '#ffffff'), 0);
    atlas(sceneCtx, images['head-accessories'], gear.headAcc2, 8, color(gear.headAcc2C, team, '#ffffff'), 0);
    sceneCtx.restore();
    const arms = {
      shooting: 'shooting-arms',
      passing: 'passing-arms',
      dunking: 'dunking-arms',
      'injured-leg': 'injured-leg-arms',
      running: 'running-arms',
    }[pose];
    if (arms) {
      sceneCtx.save();
      sceneCtx.translate(0, offsetY);
      body(sceneCtx, frame, player, team, uniformIndex, arms, ball);
      sceneCtx.restore();
    }
    const scale = canvas.width / 32;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (facing === 'right') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(scene, 0, 0, scene.width, scene.height, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    // Keep digits readable when the player faces right, instead of mirroring text.
    if (bodyState && !(player.isCoach || player.wearsSuit))
      jerseyNumber(ctx, player, team, bodyState.uniform, scale, offsetY, frame, pose, facing);
  }
  function drawPortrait(canvas, player, team, uniformIndex) {
    const source = document.createElement('canvas');
    source.width = 128;
    source.height = 168;
    draw(source, player, team, uniformIndex, 0);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    // Crop the fixed first frame to the top 28 logical pixels so the portrait
    // includes more of the shoulders and upper jersey while remaining a bust.
    ctx.drawImage(source, 0, 0, 128, 112, 0, 0, canvas.width, canvas.height);
  }
  window.HoopWirePlayer = {
    ready: () => Promise.all(Object.values(images).map(image => image.decode())),
    draw,
    ballPalette,
    portrait: drawPortrait,
    // A jersey number in the game's own digits: a 16 x 16 tile (the digits'
    // native 64 pixels per unit) filled with the given color.
    numberTile(value, fill) {
      value = Number(value);
      const tile = document.createElement('canvas');
      tile.width = tile.height = 16;
      if (!Number.isInteger(value) || value < 0 || value > 100 || !images['jersey-numbers']?.complete) return tile;
      const layer = tile.getContext('2d');
      layer.drawImage(images['jersey-numbers'], (value % 10) * 32, Math.floor(value / 10) * 32, 16, 16, 0, 0, 16, 16);
      layer.globalCompositeOperation = 'source-in';
      layer.fillStyle = fill;
      layer.fillRect(0, 0, 16, 16);
      return tile;
    },
    drawBall(canvas, ball = {}) {
      const c = canvas.getContext('2d'),
        tile = document.createElement('canvas');
      tile.width = tile.height = 8;
      const t = tile.getContext('2d');
      t.drawImage(flightBall, 0, 0);
      const p = t.getImageData(0, 0, 8, 8),
        palette = ballPalette(ball);
      const source = {
        '227,112,51': '226,150,0',
        '255,146,66': '227,200,0',
        '255,179,82': '228,255,0',
        '159,78,36': '229,100,0',
        '68,34,15': '230,50,0',
      };
      for (let i = 0; i < p.data.length; i += 4) {
        const value = palette[source[Array.from(p.data.slice(i, i + 3)).join(',')]];
        if (value) for (let k = 0; k < 3; k++) p.data[i + k] = value[k];
      }
      t.putImageData(p, 0, 0);
      c.imageSmoothingEnabled = false;
      c.drawImage(tile, 0, 0, canvas.width, canvas.height);
    },
  };
})();
