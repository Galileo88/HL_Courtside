/* One-sheet posters for the HoopWire Pictures films, drawn with Hoop Land's sprites.
   A poster is 2:3 for the sidebar; a banner is 16:9 for the story feed. */
(() => {
  'use strict';
  const cache = new Map();
  // Everything is laid out in poster points and drawn at three device pixels each,
  // so sprite pixels stay square and the type stays sharp.
  const RES = 3;
  const TYPE =
    "'DIN Condensed', 'Avenir Next Condensed', 'Bahnschrift', 'Roboto Condensed', 'Arial Narrow', Arial, sans-serif";
  const LED = {
    0: '111101101101111',
    1: '010110010010111',
    2: '111001111100111',
    3: '111001111001111',
    4: '101101111001001',
    5: '111100111001111',
    6: '111100111101111',
    7: '111001001001001',
    8: '111101111101111',
    9: '111101111001111',
    '.': '000000000000100',
    ':': '000100000100000',
  };
  const films = {
    'movie-drama': {
      title: ['LAST', 'POSSESSION'],
      tagline: 'ONE SHOT. EVERYTHING ON THE LINE.',
      rating: 'PG-13',
      scene: courtScene,
      ink: ['#fff7e8', '#e6b56a'],
      accent: '#f0b867',
      crew: ['MUSIC BY TESS ADEYEMI', 'EDITED BY RAFAEL OKONJO', 'DIRECTED BY DANA WHITFIELD'],
    },
    'movie-thriller': {
      title: ['MIDNIGHT', 'TRANSFER'],
      tagline: 'EVERY DEAL HAS A DARK SIDE.',
      rating: 'R',
      scene: streetScene,
      ink: ['#f4f7fb', '#b9c7d6'],
      accent: '#ff4a5c',
      crew: ['MUSIC BY KAI LINDQVIST', 'EDITED BY MARA VOSS', 'DIRECTED BY ELIAS GRANT'],
    },
  };
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  // A fixed sequence, so the same poster draws the same way every time.
  function random(seed) {
    let s = seed;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }
  function sprite(person, pose, frame, facing, uniform) {
    const art = canvas(32, 42);
    const team = uniform && {
      uniforms: [
        { jersey: uniform, shorts: uniform, jerseyStripe: 'FFFFFF', jerseyCollar: 'FFFFFF', jerseyNumber: 'FFFFFF' },
      ],
    };
    HoopWirePlayer.draw(art, person, team, 0, frame, pose, facing);
    return art;
  }
  // Light falling on a figure from above: warm on the head and shoulders, dark at the feet.
  function light(art, top, bottom) {
    const c = canvas(art.width, art.height),
      x = c.getContext('2d');
    x.drawImage(art, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    const g = x.createLinearGradient(0, 0, 0, art.height);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    x.fillStyle = g;
    x.fillRect(0, 0, art.width, art.height);
    return c;
  }
  function silhouette(art, color) {
    const c = canvas(art.width, art.height),
      x = c.getContext('2d');
    x.drawImage(art, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, art.width, art.height);
    return c;
  }
  function glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + alpha);
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function digits(ctx, text, x, y, size, color) {
    ctx.fillStyle = color;
    for (const char of text) {
      const bits = LED[char] || '';
      [...bits].forEach(
        (bit, i) => bit === '1' && ctx.fillRect(x + (i % 3) * size, y + Math.floor(i / 3) * size, size, size)
      );
      x += (char === '.' || char === ':' ? 2 : 4) * size;
    }
  }

  // LAST POSSESSION: a lone shooter rising under the spotlight, the ball in the air, one second left.
  function courtScene(ctx, w, h, focus, hosts) {
    const rand = random(41),
      floor = Math.round(h * 0.74),
      cx = Math.round(w * focus);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05060c');
    sky.addColorStop(0.55, '#121827');
    sky.addColorStop(0.8, '#1d1a22');
    sky.addColorStop(1, '#0a0709');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // The upper bowl: rows of fans, bigger toward the floor.
    for (let row = 0; row < 16; row++) {
      const y = Math.round(h * 0.2 + row * row * 0.2 + row * 2.6),
        size = row < 6 ? 1 : row < 12 ? 2 : 3;
      if (y > floor - 6) break;
      for (let x = (row % 2) * size * 2; x < w; x += size * 4 + Math.floor(rand() * size * 2)) {
        if (rand() < 0.12) continue;
        const shade = 12 + Math.floor(rand() * 10) + row;
        ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 14})`;
        ctx.fillRect(x, y, size * 2, size * 2);
        ctx.fillRect(x - size, y + size * 2, size * 4, size * 2);
      }
    }
    // Phones and cameras going off in the stands.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = rand() * w,
        y = h * 0.2 + rand() * (floor - h * 0.24);
      glow(ctx, x, y, 3 + rand() * 4, '#dfe8ff', '66');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    // The hoop at regulation height, right of the shooter.
    const rim = floor - Math.min(105, Math.round(floor * 0.62)),
      board = Math.min(w - 26, cx + 82);
    ctx.fillStyle = '#1c1f27';
    ctx.fillRect(board + 3, rim - 8, 14, 3);
    ctx.fillRect(board + 14, rim - 8, 4, floor - rim + 8);
    ctx.fillRect(board + 8, floor - 5, 18, 5);
    ctx.fillStyle = '#d9dee7';
    ctx.fillRect(board, rim - 26, 3, 32);
    ctx.fillStyle = '#9aa3b2';
    ctx.fillRect(board + 2, rim - 26, 1, 32);
    ctx.fillStyle = '#ff7a2f';
    ctx.fillRect(board - 24, rim, 24, 2);
    ctx.fillStyle = '#e9edf3b0';
    for (let y = 3; y < 16; y += 3) ctx.fillRect(board - 23 + y / 2.5, rim + y, 22 - (y / 2.5) * 2, 1);
    for (let x = 0; x < 5; x++) ctx.fillRect(board - 22 + x * 5 + (x < 2 ? 1 : x > 2 ? -1 : 0), rim + 2, 1, 13);
    glow(ctx, board - 10, rim - 6, 30, '#ffd9a0', '2a');
    // The shot clock on the backboard, down to its last second.
    ctx.fillStyle = '#0b0b0f';
    ctx.fillRect(board - 9, rim - 41, 21, 14);
    glow(ctx, board + 1, rim - 34, 22, '#ff3b30', '40');
    digits(ctx, '0.8', board - 6, rim - 39, 2, '#ff4a3a');
    // The spotlight, from the rafters down to the shooter.
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(0, 0, 0, floor);
    beam.addColorStop(0, '#ffd89a00');
    beam.addColorStop(0.25, '#ffd89a22');
    beam.addColorStop(1, '#ffd89a40');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 0);
    ctx.lineTo(cx + 6, 0);
    ctx.lineTo(cx + 40, floor);
    ctx.lineTo(cx - 40, floor);
    ctx.fill();
    for (let i = 0; i < 40; i++) {
      const t = rand(),
        y = t * floor;
      ctx.fillStyle = `rgba(255,226,180,${0.2 + rand() * 0.4})`;
      ctx.fillRect(Math.round(cx + (rand() - 0.5) * (12 + t * 70)), Math.round(y), 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    // The floor: polished wood with the spotlight pooled on it.
    const wood = ctx.createLinearGradient(0, floor, 0, h);
    wood.addColorStop(0, '#5a361d');
    wood.addColorStop(1, '#140b07');
    ctx.fillStyle = wood;
    ctx.fillRect(0, floor, w, h - floor);
    ctx.fillStyle = '#7a4a26';
    ctx.fillRect(0, floor, w, 1);
    ctx.strokeStyle = '#e8d3b055';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(board, floor + 9, 92, 9, 0, Math.PI * 0.5, Math.PI * 1.04);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const pool = ctx.createRadialGradient(cx, floor + 6, 2, cx, floor + 6, 60);
    pool.addColorStop(0, '#ffcf8a55');
    pool.addColorStop(1, '#ffcf8a00');
    ctx.fillStyle = pool;
    ctx.save();
    ctx.translate(cx, floor + 6);
    ctx.scale(1, 0.22);
    ctx.translate(-cx, -(floor + 6));
    ctx.fillRect(cx - 60, floor - 54, 120, 120);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    // The shooter on the follow-through, the ball on its way.
    const lead = {
        ...hosts[0],
        wearsSuit: false,
        isCoach: false,
        num: 7,
        accessories: [{ shoeC: 'FFFFFF', soleC: 'FFFFFF', sockC: 'FFFFFF' }],
      },
      shooter = light(sprite(lead, 'shooting', 4, 'right', '1B3A66'), '#ffd7964d', '#05060c99'),
      lift = 10,
      top = floor - lift - 84;
    ctx.fillStyle = '#00000080';
    ctx.beginPath();
    ctx.ellipse(cx, floor + 2, 13, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // A faint reflection in the floor.
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.translate(0, floor * 2);
    ctx.scale(1, -1);
    ctx.drawImage(shooter, cx - 32, top + 2 * lift, 64, 84);
    ctx.restore();
    ctx.drawImage(shooter, cx - 32, top, 64, 84);
    const ball = canvas(8, 8);
    HoopWirePlayer.drawBall(ball);
    const bx = Math.round(cx + (board - 12 - cx) * 0.62) - 5,
      by = rim - 30;
    ctx.fillStyle = '#ffd59a';
    for (let i = 1; i < 6; i++) {
      const t = i / 6,
        x = cx + 14 + (bx - cx - 14) * t,
        y = top + 18 + (by + 5 - top - 18) * t - Math.sin(t * Math.PI) * 8;
      ctx.globalAlpha = 0.1 + t * 0.25;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    ctx.globalAlpha = 1;
    glow(ctx, bx + 5, by + 5, 14, '#ffb35c', '55');
    ctx.drawImage(ball, bx, by, 10, 10);
  }

  // MIDNIGHT TRANSFER: a deal on a wet street at night, under one streetlight.
  function streetScene(ctx, w, h, focus, hosts) {
    const rand = random(7),
      ground = Math.round(h * 0.7),
      cx = Math.round(w * focus);
    const sky = ctx.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, '#02050b');
    sky.addColorStop(1, '#0d2a3a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.08, h * 0.42, w * 0.55, '#ff2440', '38');
    // Three layers of towers, the nearest the darkest.
    const lights = [];
    [
      ['#0c2231', 0.34, 0.5, 12, 0.35],
      ['#081826', 0.44, 0.62, 16, 0.5],
      ['#050d16', 0.52, 0.75, 22, 0.6],
    ].forEach(([color, low, high, width, lit]) => {
      for (let x = -4; x < w; ) {
        const bw = width + Math.floor(rand() * width),
          top = Math.round(h * (low - rand() * (high - low) * 0.9) + (high - low) * h * 0.3);
        ctx.fillStyle = color;
        ctx.fillRect(x, top, bw - 2, ground - top);
        for (let y = top + 4; y < ground - 3; y += 4)
          for (let wx = x + 2; wx < x + bw - 4; wx += 3)
            if (rand() < lit * 0.35) {
              const tone = rand();
              const c = tone < 0.6 ? '#f6c46c' : tone < 0.92 ? '#7fd8ef' : '#ff5a6a';
              ctx.fillStyle = c + (tone < 0.92 ? 'aa' : 'cc');
              ctx.fillRect(wx, y, 1, 2);
              lights.push([wx, y, c]);
            }
        if (bw > width * 1.6 && rand() < 0.5) {
          ctx.fillStyle = color;
          ctx.fillRect(x + Math.floor(bw / 2) - 1, top - 10, 1, 10);
          ctx.fillStyle = '#ff3346';
          ctx.fillRect(x + Math.floor(bw / 2) - 1, top - 11, 1, 1);
          glow(ctx, x + bw / 2 - 0.5, top - 10.5, 4, '#ff3346', '88');
        }
        x += bw;
      }
    });
    // Mist where the street meets the skyline.
    const mist = ctx.createLinearGradient(0, ground - 30, 0, ground + 6);
    mist.addColorStop(0, '#1b4a5c00');
    mist.addColorStop(1, '#1b4a5c88');
    ctx.fillStyle = mist;
    ctx.fillRect(0, ground - 30, w, 36);
    // Wet asphalt that carries the city's lights.
    const street = ctx.createLinearGradient(0, ground, 0, h);
    street.addColorStop(0, '#0a1a24');
    street.addColorStop(1, '#020509');
    ctx.fillStyle = street;
    ctx.fillRect(0, ground, w, h - ground);
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, c] of lights) {
      if (rand() < 0.5) continue;
      ctx.fillStyle = c + '30';
      ctx.fillRect(x, ground + (ground - y) * 0.35, 1, 2 + rand() * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
    // The streetlight and its cone of sodium light.
    const pole = Math.min(w - 10, cx + 30);
    ctx.fillStyle = '#0b1218';
    ctx.fillRect(pole, Math.round(h * 0.16), 3, ground + 8 - Math.round(h * 0.16));
    ctx.fillRect(pole - 22, Math.round(h * 0.16), 24, 2);
    ctx.fillStyle = '#ffd08a';
    ctx.fillRect(pole - 25, Math.round(h * 0.16) + 2, 8, 2);
    glow(ctx, pole - 21, Math.round(h * 0.16) + 3, 14, '#ffb357', '99');
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, h * 0.16, 0, ground + 10);
    cone.addColorStop(0, '#ffb35744');
    cone.addColorStop(1, '#ffb35714');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(pole - 25, h * 0.16 + 4);
    ctx.lineTo(pole - 17, h * 0.16 + 4);
    ctx.lineTo(pole + 8, ground + 10);
    ctx.lineTo(pole - 54, ground + 10);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // The lead in a dark suit, briefcase in hand, lit from the lamp above.
    const lead = {
        ...hosts[0],
        wearsSuit: true,
        isCoach: false,
        suits: [
          { jacketC: '1F2A36', shirtC: 'FFFFFF', tieC: '8E1B2B', pantC: '1F2A36', shoeC: '0B0B0F', headAcc: '0000' },
        ],
      },
      figure = light(sprite(lead, 'suit-standing', 0, 'left'), '#ffbe6a40', '#02050b80'),
      fx = pole - 34 - 48,
      fy = ground + 22 - 126 + 6;
    // The long shadow the lamp throws toward the camera.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(fx + 48, ground + 22);
    ctx.transform(1, 0, -0.9, 0.35, 0, 0);
    ctx.drawImage(silhouette(figure, '#000000'), -48, 0, 96, 126);
    ctx.restore();
    ctx.drawImage(figure, fx, fy, 96, 126);
    ctx.fillStyle = '#2b1a10';
    ctx.fillRect(fx + 12, fy + 84, 16, 12);
    ctx.fillStyle = '#4a2e1c';
    ctx.fillRect(fx + 12, fy + 84, 16, 2);
    ctx.fillStyle = '#c9a76a';
    ctx.fillRect(fx + 18, fy + 81, 4, 3);
    // The other party, waiting in the dark, edged in red neon.
    const other = {
        ...hosts[1],
        wearsSuit: true,
        isCoach: false,
        suits: [
          { jacketC: '111111', shirtC: '222222', tieC: '111111', pantC: '111111', shoeC: '000000', headAcc: '0000' },
        ],
      },
      shape = sprite(other, 'suit-standing', 0, 'right'),
      ox = Math.max(4, cx - 95),
      oy = ground + 6 - 84 + 4;
    glow(ctx, ox + 26, oy + 40, 44, '#ff2a46', '30');
    ctx.globalAlpha = 0.85;
    ctx.drawImage(silhouette(shape, '#ff3a52'), ox - 1, oy, 64, 84);
    ctx.globalAlpha = 1;
    ctx.drawImage(light(shape, '#2a0910e0', '#020306f0'), ox, oy, 64, 84);
    // Rain across everything.
    ctx.strokeStyle = '#b8d7e83a';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 0; i < Math.round((w * h) / 260); i++) {
      const x = rand() * (w + 20),
        y = rand() * h,
        l = 5 + rand() * 7;
      ctx.moveTo(x, y);
      ctx.lineTo(x - l * 0.25, y + l);
    }
    ctx.stroke();
  }

  // Fits a line of type to a width, condensing it if the font runs wide. Tracking is
  // set letter by letter, and a fill of two colors runs top to bottom.
  function line(ctx, text, x, y, size, width, { weight = 700, tracking = 0, align = 'center', fill = '#fff' } = {}) {
    ctx.save();
    ctx.font = `${weight} ${size}px ${TYPE}`;
    const chars = [...text],
      widths = chars.map(c => ctx.measureText(c).width),
      natural = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1),
      squeeze = Math.min(1, width / natural);
    ctx.translate(x - (align === 'center' ? (natural * squeeze) / 2 : 0), y);
    ctx.scale(squeeze, 1);
    if (Array.isArray(fill)) {
      const ink = ctx.createLinearGradient(0, -size * 0.72, 0, 0);
      ink.addColorStop(0, fill[0]);
      ink.addColorStop(1, fill[1]);
      ctx.fillStyle = ink;
    } else ctx.fillStyle = fill;
    ctx.textBaseline = 'alphabetic';
    let at = 0;
    chars.forEach((c, i) => {
      ctx.fillText(c, at, 0);
      at += widths[i] + tracking;
    });
    ctx.restore();
    return natural * squeeze;
  }
  function names(hosts) {
    return hosts.slice(0, 3).map(h => `${h.fn || ''} ${h.ln || ''}`.trim().toUpperCase());
  }
  // The title, the tagline, the credits block and the release line.
  function type(ctx, film, hosts, x, top, width, scale) {
    const center = x + width / 2,
      cast = names(hosts);
    let y = top;
    line(ctx, film.tagline, center, y, 6 * scale, width, { tracking: 1.6 * scale, fill: film.accent });
    y += 9 * scale;
    line(ctx, 'HOOPWIRE PICTURES PRESENTS', center, y, 4.5 * scale, width, {
      tracking: 1.4 * scale,
      fill: '#ffffffb0',
    });
    y += (film.title[0].length > 5 ? 16 : 14) * scale;
    line(ctx, film.title[0], center, y, (film.title[0].length > 5 ? 16 : 13) * scale, width * 0.74, {
      weight: 600,
      tracking: 5 * scale,
      fill: film.ink[0],
    });
    y += 33 * scale;
    ctx.save();
    ctx.shadowColor = film.accent + '66';
    ctx.shadowBlur = 8 * scale;
    if (film.rating === 'R') {
      // A split-second double image, like a film frame slipping.
      line(ctx, film.title[1], center - 1.2, y, 36 * scale, width, {
        weight: 800,
        tracking: 0.5 * scale,
        fill: '#ff2d4a99',
      });
      line(ctx, film.title[1], center + 1.2, y, 36 * scale, width, {
        weight: 800,
        tracking: 0.5 * scale,
        fill: '#33d6ff66',
      });
    }
    line(ctx, film.title[1], center, y, 36 * scale, width, { weight: 800, tracking: 0.5 * scale, fill: film.ink });
    ctx.restore();
    y += 11 * scale;
    // The billing block, set tall and tight as it is on every one-sheet.
    const credits = [
      `HOOPWIRE PICTURES PRESENTS A COURTSIDE FILMS PRODUCTION ${cast.join(' ')}`,
      `"${film.title.join(' ')}" ${film.crew.join(' ')} PRODUCED BY HOOPWIRE PICTURES`,
    ];
    ctx.save();
    ctx.translate(0, y);
    ctx.scale(1, 1.7);
    credits.forEach((text, i) =>
      line(ctx, text, center, i * 4.2 * scale, 3.4 * scale, width * 0.92, { weight: 500, fill: '#ffffff80' })
    );
    ctx.restore();
    y += 19 * scale;
    const release = 'IN THEATERS FRIDAY',
      used = line(ctx, release, center - 8 * scale, y, 7 * scale, width * 0.7, {
        tracking: 2.2 * scale,
        fill: '#ffffff',
      });
    const bx = center - 8 * scale + used / 2 + 5 * scale,
      bw = (film.rating.length > 2 ? 15 : 7) * scale;
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(bx, y - 6.5 * scale, bw, 7.5 * scale);
    line(ctx, film.rating, bx + bw / 2, y - 0.8 * scale, 5.5 * scale, bw - 2, { weight: 800, fill: '#ffffff' });
  }
  function grain(ctx, w, h) {
    const image = ctx.getImageData(0, 0, w, h),
      data = image.data,
      rand = random(3);
    for (let i = 0; i < data.length; i += 4) {
      const n = (rand() - 0.5) * 14;
      data[i] += n;
      data[i + 1] += n;
      data[i + 2] += n;
    }
    ctx.putImageData(image, 0, 0);
  }
  async function compose(product, hosts, shape) {
    await HoopWirePlayer.ready();
    const film = films[product],
      banner = shape === 'banner',
      w = banner ? 356 : 200,
      h = banner ? 200 : 300,
      out = canvas(w * RES, h * RES),
      ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(RES, RES);
    if (banner) {
      // The scene on the right, the type on the left over the dark.
      film.scene(ctx, w, h, product === 'movie-drama' ? 0.62 : 0.74, hosts);
      const shade = ctx.createLinearGradient(0, 0, w * 0.62, 0);
      shade.addColorStop(0, '#04050af2');
      shade.addColorStop(0.62, '#04050ab0');
      shade.addColorStop(1, '#04050a00');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);
      type(ctx, film, hosts, 10, 62, 150, 0.9);
    } else {
      const art = canvas(w * RES, 236 * RES),
        stage = art.getContext('2d');
      stage.imageSmoothingEnabled = false;
      stage.scale(RES, RES);
      film.scene(stage, w, 236, product === 'movie-drama' ? 0.38 : 0.66, hosts);
      ctx.fillStyle = '#04050a';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(art, 0, 0, w, 236);
      const fade = ctx.createLinearGradient(0, 150, 0, 236);
      fade.addColorStop(0, '#04050a00');
      fade.addColorStop(1, '#04050a');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 150, w, 86);
      const cast = names(hosts);
      cast.forEach((name, i) =>
        line(ctx, name, (w / 3) * (i + 0.5), 13, 5.4, w / 3 - 8, { weight: 600, tracking: 1.1, fill: '#f1e6d4' })
      );
      type(ctx, film, hosts, 12, 186, w - 24, 1);
    }
    // Darker corners pull the eye to the middle.
    const vignette = ctx.createRadialGradient(
      w / 2,
      h * 0.42,
      Math.min(w, h) * 0.3,
      w / 2,
      h * 0.42,
      Math.max(w, h) * 0.75
    );
    vignette.addColorStop(0, '#00000000');
    vignette.addColorStop(1, '#000000b0');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    grain(ctx, out.width, out.height);
    return out.toDataURL('image/png');
  }
  function render(product, hosts, shape = 'poster') {
    const key = JSON.stringify([product, hosts, shape]);
    if (!cache.has(key))
      cache.set(
        key,
        compose(product, hosts, shape).catch(error => {
          cache.delete(key);
          throw error;
        })
      );
    return cache.get(key);
  }
  window.HoopWirePosters = { render, films: Object.keys(films) };
})();
