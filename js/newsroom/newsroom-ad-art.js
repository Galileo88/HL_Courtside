/* Movie and footwear creative assembled from Hoop Land's native sprites. */
(() => {
  'use strict';
  const cache = new Map();
  const colors = ['#26c6e8', '#ffbd59', '#eb415a'];
  function actor(ctx, host, x, y, scale, { suit = false, facing = 'left', color = '145FA1', shoe = 'FFFFFF' } = {}) {
    const sprite = document.createElement('canvas');
    sprite.width = 32;
    sprite.height = 42;
    const person = {
      ...host,
      wearsSuit: suit,
      isCoach: false,
      num: 7,
      accessories: [{ shoeC: shoe, soleC: 'FFFFFF', sockC: 'FFFFFF' }],
      suits: [{ jacketC: color, shirtC: 'FFFFFF', tieC: 'B8A371', pantC: color, shoeC: '141020', headAcc: '0000' }],
    };
    const team = {
      uniforms: [
        { jersey: color, shorts: color, jerseyStripe: 'FFFFFF', jerseyCollar: 'FFFFFF', jerseyNumber: 'FFFFFF' },
      ],
    };
    window.HoopWirePlayer.draw(sprite, person, team, 0, 0, suit ? 'suit-standing' : 'idle', facing);
    ctx.drawImage(sprite, x, y, 32 * scale, 42 * scale);
    return sprite;
  }
  // A bottle drawn from its silhouette: each row's half-width, with a cap, glass, label and a highlight.
  function bottle(shape, colors) {
    const widest = Math.max(...shape.map(r => r.w)),
      art = document.createElement('canvas');
    art.width = widest * 2 + 2;
    art.height = shape.length;
    const ctx = art.getContext('2d'),
      mid = widest + 1;
    shape.forEach(({ w, part }, y) => {
      const fill = colors[part] || colors.body;
      ctx.fillStyle = colors.outline;
      ctx.fillRect(mid - w - 1, y, w * 2 + 2, 1);
      ctx.fillStyle = fill[0];
      ctx.fillRect(mid - w, y, w * 2, 1);
      if (w >= 3 && fill[1]) {
        ctx.fillStyle = fill[1];
        ctx.fillRect(mid - w + 1, y, 1, 1);
      }
      if (w >= 3 && fill[2]) {
        ctx.fillStyle = fill[2];
        ctx.fillRect(mid + w - 2, y, 2, 1);
      }
    });
    // Close the top and bottom with the outline.
    ctx.fillStyle = colors.outline;
    ctx.fillRect(mid - shape[0].w - 1, 0, shape[0].w * 2 + 2, 1);
    ctx.fillRect(mid - shape.at(-1).w - 1, shape.length - 1, shape.at(-1).w * 2 + 2, 1);
    return art;
  }
  const rows = (count, w, part) => Array.from({ length: count }, () => ({ w, part }));
  // Sports drink: push-pull cap, a short neck and a grip label.
  const SPORT_BOTTLE = [
    ...rows(2, 1, 'cap'),
    ...rows(4, 3, 'cap'),
    { w: 2, part: 'body' },
    { w: 3, part: 'body' },
    { w: 4, part: 'body' },
    ...rows(4, 5, 'body'),
    ...rows(3, 5, 'label'),
    ...rows(2, 5, 'stripe'),
    ...rows(3, 5, 'label'),
    ...rows(9, 5, 'body'),
    { w: 4, part: 'body' },
  ];
  // Longneck beer: crown cap, long neck with foil, shoulders and a body label.
  const BEER_BOTTLE = [
    ...rows(2, 2, 'cap'),
    { w: 2, part: 'body' },
    ...rows(3, 2, 'foil'),
    ...rows(8, 2, 'body'),
    { w: 3, part: 'body' },
    { w: 4, part: 'body' },
    { w: 5, part: 'body' },
    ...rows(6, 6, 'body'),
    ...rows(3, 6, 'label'),
    ...rows(2, 6, 'stripe'),
    ...rows(4, 6, 'label'),
    ...rows(5, 6, 'body'),
    { w: 5, part: 'body' },
  ];
  // Softens the art's edges into the ad's own background, so no box shows around it.
  function blend(ctx, width, height, color, size = 22) {
    for (const [x0, y0, x1, y1, x, y, w, h] of [
      [0, 0, 0, size, 0, 0, width, size],
      [0, height, 0, height - size, 0, height - size, width, size],
      [0, 0, size, 0, 0, 0, size, height],
      [width, 0, width - size, 0, width - size, 0, size, height],
    ]) {
      const fade = ctx.createLinearGradient(x0, y0, x1, y1);
      fade.addColorStop(0, color);
      fade.addColorStop(1, color + '00');
      ctx.fillStyle = fade;
      ctx.fillRect(x, y, w, h);
    }
  }
  const burger = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = 'assets/scene/burger.png';
  });
  async function compose(product, hosts) {
    await HoopWirePlayer.ready();
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (product === 'movie-drama') {
      const gradient = ctx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, '#221422');
      gradient.addColorStop(1, '#b36738');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#d6a96b';
      ctx.fillRect(0, 137, 300, 43);
      ctx.strokeStyle = '#f5dc9b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(150, 165, 96, 20, 0, 0, Math.PI * 2);
      ctx.stroke();
      actor(ctx, hosts[1], 18, 48, 2.5, { color: 'DFA044' });
      actor(ctx, hosts[2], 79, 74, 1.8, { color: '722434', facing: 'right' });
      const lead = document.createElement('canvas');
      lead.width = 32;
      lead.height = 42;
      const player = { ...hosts[0], wearsSuit: false, num: 7, accessories: [{ shoeC: 'FFFFFF', soleC: 'FFFFFF' }] };
      HoopWirePlayer.draw(
        lead,
        player,
        {
          uniforms: [
            {
              jersey: '162F52',
              shorts: '162F52',
              jerseyStripe: 'FFFFFF',
              jerseyCollar: 'FFFFFF',
              jerseyNumber: 'FFFFFF',
            },
          ],
        },
        0,
        0,
        'idle',
        'right'
      );
      ctx.drawImage(lead, 4, 4, 24, 27, 156, 15, 144, 162);
      const ball = document.createElement('canvas');
      ball.width = ball.height = 8;
      HoopWirePlayer.drawBall(ball);
      ctx.drawImage(ball, 90, 137, 20, 20);
      blend(ctx, 300, 180, '#221422', 14);
    } else if (product === 'movie-thriller') {
      ctx.fillStyle = '#080f22';
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#713051';
      ctx.beginPath();
      ctx.arc(239, 35, 24, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const h = 30 + ((i * 37) % 75);
        ctx.fillStyle = i % 2 ? '#13243e' : '#192c45';
        ctx.fillRect(i * 26, 100 - h, 24, h + 80);
        for (let y = 110 - h; y < 165; y += 14) {
          ctx.fillStyle = colors[i % 3];
          ctx.fillRect(i * 26 + 7, y, 3, 3);
        }
      }
      actor(ctx, hosts[2], 172, 32, 3.1, { suit: true, color: '38202F', facing: 'right' });
      const portrait = document.createElement('canvas');
      portrait.width = 32;
      portrait.height = 42;
      const lead = {
        ...hosts[0],
        wearsSuit: true,
        suits: [{ jacketC: '374753', shirtC: 'FFFFFF', tieC: 'B8A371', pantC: '374753', shoeC: '141020' }],
      };
      HoopWirePlayer.draw(portrait, lead, null, 0, 0, 'suit-standing');
      ctx.drawImage(portrait, 4, 4, 24, 27, -8, 10, 156, 175.5);
    } else if (product === 'airways') {
      const sky = ctx.createLinearGradient(0, 0, 0, 180);
      sky.addColorStop(0, '#235275');
      sky.addColorStop(1, '#e1b171');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#f5d895';
      ctx.beginPath();
      ctx.arc(231, 54, 32, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#213b53';
        ctx.fillRect(180 + i * 16, 112 - ((i * 19) % 43), 14, 80);
      }
      ctx.fillStyle = '#17314b';
      ctx.fillRect(0, 141, 300, 39);
      actor(ctx, hosts[1], 43, 0, 4, { suit: true, color: '394353' });
      ctx.fillStyle = '#302f36';
      ctx.fillRect(187, 116, 34, 39);
      ctx.strokeStyle = '#dec189';
      ctx.strokeRect(197, 109, 13, 8);
      ctx.fillStyle = '#ba9c5c';
      ctx.fillRect(199, 116, 3, 39);
      blend(ctx, 300, 180, '#17314b', 16);
    } else if (product === 'streaming') {
      ctx.fillStyle = '#091423';
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#214865';
      ctx.fillRect(16, 16, 268, 147);
      ctx.fillStyle = '#091423';
      ctx.fillRect(22, 22, 256, 135);
      actor(ctx, hosts[0], 38, 12, 3, { suit: true, color: '234768' });
      actor(ctx, hosts[2], 166, 12, 3, { suit: true, color: '712334', facing: 'right' });
      ctx.fillStyle = '#172f49';
      ctx.fillRect(23, 117, 254, 38);
      ctx.fillStyle = '#ef314c';
      ctx.fillRect(23, 137, 51, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Arial';
      ctx.fillText('ON AIR', 29, 149);
      ctx.fillStyle = '#728397';
      ctx.fillRect(103, 168, 94, 5);
      ctx.fillRect(144, 162, 12, 10);
    } else if (product === 'food') {
      // Royal rays behind the table, two players turned toward the burger.
      ctx.fillStyle = '#70252a';
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#7f2d31';
      for (let i = 0; i < 16; i += 2) {
        const a = (Math.PI * i) / 16,
          b = (Math.PI * (i + 1)) / 16;
        ctx.beginPath();
        ctx.moveTo(150, 136);
        ctx.lineTo(150 - Math.cos(a) * 340, 136 - Math.sin(a) * 340);
        ctx.lineTo(150 - Math.cos(b) * 340, 136 - Math.sin(b) * 340);
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(150, 96, 4, 150, 96, 70);
      glow.addColorStop(0, 'rgba(255,205,96,.45)');
      glow.addColorStop(1, 'rgba(255,205,96,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#dca458';
      ctx.fillRect(0, 136, 300, 44);
      ctx.fillStyle = '#c48c45';
      ctx.fillRect(0, 136, 300, 3);
      ctx.fillStyle = 'rgba(73,30,24,.35)';
      [
        [64, 158, 34],
        [236, 158, 34],
      ].forEach(([x, y, w]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, w, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      actor(ctx, hosts[0], 12, 24, 3.4, { color: 'C39224', facing: 'right' });
      actor(ctx, hosts[1], 180, 24, 3.4, { color: 'C39224' });
      // The sprite's top five rows are the burger; the rest is its stand.
      await burger.then(image => ctx.drawImage(image, 0, 0, 8, 5, 114, 64, 72, 45)).catch(() => {});
      ctx.fillStyle = '#ffe6a3';
      [
        [110, 46],
        [190, 54],
        [134, 30],
        [170, 38],
      ].forEach(([x, y]) => {
        ctx.fillRect(x, y - 2, 2, 6);
        ctx.fillRect(x - 2, y, 6, 2);
      });
    } else if (product === 'apparel') {
      const light = ctx.createRadialGradient(231, 62, 10, 231, 62, 170);
      light.addColorStop(0, '#354635');
      light.addColorStop(1, '#101a17');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#ceff69';
      ctx.font = '900 30px Arial';
      ctx.textAlign = 'left';
      ['PUT IN', 'THE', 'WORK.'].forEach((line, i) => ctx.fillText(line, 18, 58 + i * 33));
      const sprite = document.createElement('canvas');
      sprite.width = 32;
      sprite.height = 42;
      const person = {
        ...hosts[2],
        wearsSuit: false,
        num: 12,
        accessories: [{ shoeC: 'FFFFFF', soleC: 'FFFFFF', sockC: 'FFFFFF' }],
      };
      HoopWirePlayer.draw(
        sprite,
        person,
        {
          uniforms: [
            {
              jersey: '145FA1',
              shorts: '145FA1',
              jerseyStripe: 'FFFFFF',
              jerseyCollar: 'FFFFFF',
              jerseyNumber: 'FFFFFF',
            },
          ],
        },
        0,
        1,
        'shooting'
      );
      ctx.drawImage(sprite, 162, 0, 128, 168);
      blend(ctx, 300, 180, '#101a17', 14);
    } else if (product === 'automotive') {
      canvas.height = 285;
      const night = ctx.createLinearGradient(0, 0, 0, 285);
      night.addColorStop(0, '#08101d');
      night.addColorStop(0.62, '#253745');
      night.addColorStop(1, '#071019');
      ctx.fillStyle = night;
      ctx.fillRect(0, 0, 300, 285);
      // Arena lights and the open road frame the truck.
      // One light, on the right, clear of the headline.
      for (const [x, y] of [[267, 87]]) {
        ctx.fillStyle = '#5c6c77';
        ctx.fillRect(x, y, 2, 75);
        const glow = ctx.createRadialGradient(x, y, 1, x, y, 35);
        glow.addColorStop(0, 'rgba(184,231,255,.55)');
        glow.addColorStop(1, 'rgba(184,231,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 35, y - 35, 70, 70);
        ctx.fillStyle = '#c5edff';
        ctx.fillRect(x - 8, y - 2, 18, 3);
      }
      ctx.fillStyle = '#0e1821';
      ctx.beginPath();
      ctx.moveTo(112, 149);
      ctx.lineTo(181, 149);
      ctx.lineTo(300, 285);
      ctx.lineTo(0, 285);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f3f1e7';
      ctx.font = '900 27px Arial';
      ctx.fillText('THE GAME ENDS.', 18, 36);
      ctx.fillStyle = '#8fc5dc';
      ctx.fillText('THE NIGHT', 18, 70);
      ctx.fillText('DOESN’T.', 18, 104);
      const truck = await HoopWireCourt.loadImage('assets/scene/truck.png');
      const width = 286,
        height = (width * truck.height) / truck.width,
        left = 7,
        top = 266 - height;
      // The truck sits at an angle, so its shadow follows where the tires meet the ground (as fractions of
      // the art): far front, near front, near rear and the hidden far rear, softened at the edges. A shadow
      // blur from an offset shape softens it in every browser.
      const footprint = [
        [0.1, 0.95],
        [0.46, 1],
        [0.88, 0.875],
        [0.52, 0.83],
      ].map(([x, y]) => [left + x * width, top + y * height]);
      const [cx, cy] = footprint.reduce(([a, b], [x, y]) => [a + x / 4, b + y / 4], [0, 0]);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 9;
      ctx.shadowOffsetX = 1000;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      footprint.forEach(([x, y], i) => {
        const px = cx + (x - cx) * 1.12 - 1000,
          py = cy + (y - cy) * 1.25;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      // Each visible tire presses a darker patch into the ground.
      ctx.shadowBlur = 3;
      ctx.shadowColor = 'rgba(0,0,0,.7)';
      for (const [x, y, r] of [
        [0.122, 0.955, 0.045],
        [0.455, 1, 0.062],
        [0.87, 0.878, 0.055],
      ]) {
        ctx.beginPath();
        ctx.ellipse(left + x * width - 1000, top + y * height, r * width, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(truck, left, top, width, height);
      ctx.restore();
      blend(ctx, 300, 285, '#08101d', 26);
    } else if (product === 'beer') {
      const glow = ctx.createRadialGradient(150, 86, 3, 150, 86, 150);
      glow.addColorStop(0, '#a56e33');
      glow.addColorStop(1, '#291811');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 300, 180);
      // A bar top for the bottles to stand on.
      const bar = ctx.createLinearGradient(0, 152, 0, 180);
      bar.addColorStop(0, '#4a2c18');
      bar.addColorStop(1, '#291811');
      ctx.fillStyle = bar;
      ctx.fillRect(0, 152, 300, 28);
      const amber = bottle(BEER_BOTTLE, {
        outline: '#2a1408',
        cap: ['#d8b25a', '#f4dc94', '#a7812f'],
        foil: ['#e7cf8f', '#fbeec4', '#b99c55'],
        body: ['#8a4a14', '#c47a2c', '#5f3009'],
        label: ['#efe0bd', '#fff4d8', '#cdb88e'],
        stripe: ['#a3262c', '#c8393f', '#7c1a1f'],
      });
      ctx.fillStyle = 'rgba(20,10,5,.55)';
      ctx.beginPath();
      ctx.ellipse(150, 156, 82, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Two bottles, one a step behind the other.
      ctx.drawImage(amber, 92, 156 - amber.height * 3, amber.width * 3, amber.height * 3);
      ctx.drawImage(amber, 150, 156 - amber.height * 3.6, amber.width * 3.6, amber.height * 3.6);
      blend(ctx, 300, 180, '#291811', 18);
    } else if (product === 'shoes') {
      const spotlight = ctx.createRadialGradient(150, 84, 8, 150, 84, 150);
      spotlight.addColorStop(0, '#33566d');
      spotlight.addColorStop(1, '#0a1823');
      ctx.fillStyle = spotlight;
      ctx.fillRect(0, 0, 300, 180);
      // A lit display plinth.
      const plinth = ctx.createRadialGradient(150, 148, 4, 150, 148, 110);
      plinth.addColorStop(0, '#1d4560');
      plinth.addColorStop(1, '#0a1823');
      ctx.fillStyle = plinth;
      ctx.beginPath();
      ctx.ellipse(150, 148, 112, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(2,10,16,.6)';
      ctx.beginPath();
      ctx.ellipse(150, 146, 92, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // The supplied Stride artwork, with only its flat backdrop removed.
      const source = await HoopWireCourt.loadImage('assets/scene/shoes.png'),
        shoe = document.createElement('canvas');
      shoe.width = source.width;
      shoe.height = source.height;
      const s = shoe.getContext('2d');
      s.drawImage(source, 0, 0);
      const art = s.getImageData(0, 0, shoe.width, shoe.height);
      const bg = Array.from(art.data.slice(0, 3)),
        visited = new Uint8Array(shoe.width * shoe.height),
        queue = [];
      for (let x = 0; x < shoe.width; x++) queue.push(x, (shoe.height - 1) * shoe.width + x);
      for (let y = 0; y < shoe.height; y++) queue.push(y * shoe.width, y * shoe.width + shoe.width - 1);
      for (let i = 0; i < queue.length; i++) {
        const n = queue[i];
        if (visited[n]) continue;
        visited[n] = 1;
        const offset = n * 4;
        if (!bg.every((v, k) => art.data[offset + k] === v)) continue;
        art.data[offset + 3] = 0;
        const x = n % shoe.width,
          y = Math.floor(n / shoe.width);
        if (x) queue.push(n - 1);
        if (x + 1 < shoe.width) queue.push(n + 1);
        if (y) queue.push(n - shoe.width);
        if (y + 1 < shoe.height) queue.push(n + shoe.width);
      }
      s.putImageData(art, 0, 0);
      // Sized to stand clear of the faded edges.
      const width = 128,
        height = (width * shoe.height) / shoe.width;
      ctx.drawImage(shoe, 150 - width / 2, 150 - height, width, height);
      blend(ctx, 300, 180, '#0a1823', 18);
    }
    return canvas.toDataURL('image/png');
  }
  function render(product, hosts) {
    const key = JSON.stringify([product, hosts]);
    if (!cache.has(key))
      cache.set(
        key,
        compose(product, hosts).catch(error => {
          cache.delete(key);
          throw error;
        })
      );
    return cache.get(key);
  }
  window.HoopWireAdArt = { render, bottle, blend, SPORT_BOTTLE };
})();
