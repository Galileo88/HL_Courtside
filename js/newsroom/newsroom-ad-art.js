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
      gradient.addColorStop(0, '#351925');
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
      ctx.fillStyle = '#ffc76e';
      ctx.fillRect(29, 14, 2, 71);
      ctx.fillRect(269, 14, 2, 71);
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
      ctx.fillStyle = '#a62945';
      ctx.fillRect(0, 147, 300, 4);
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
      ctx.fillStyle = '#f0bf70';
      ctx.fillRect(146, 55, 2, 79);
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
      ctx.fillRect(0, 145, 300, 35);
      ctx.strokeStyle = '#b4ccd4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 140);
      ctx.lineTo(300, 140);
      ctx.stroke();
      actor(ctx, hosts[1], 43, 0, 4, { suit: true, color: '394353' });
      ctx.fillStyle = '#302f36';
      ctx.fillRect(187, 116, 34, 39);
      ctx.strokeStyle = '#dec189';
      ctx.strokeRect(197, 109, 13, 8);
      ctx.fillStyle = '#ba9c5c';
      ctx.fillRect(199, 116, 3, 39);
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
      ctx.fillStyle = '#e1ad41';
      ctx.fillRect(0, 0, 300, 4);
      ctx.fillStyle = '#dca458';
      ctx.fillRect(0, 136, 300, 44);
      ctx.fillStyle = '#c48c45';
      ctx.fillRect(0, 136, 300, 3);
      ctx.fillStyle = 'rgba(73,30,24,.35)';
      [
        [64, 158, 34],
        [236, 158, 34],
        [150, 157, 34],
      ].forEach(([x, y, w]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, w, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      actor(ctx, hosts[0], 12, 24, 3.4, { color: 'C39224', facing: 'right' });
      actor(ctx, hosts[1], 180, 24, 3.4, { color: 'C39224' });
      await burger.then(image => ctx.drawImage(image, 118, 53, 64, 104)).catch(() => {});
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
    } else if (product === 'automotive') {
      canvas.height = 285;
      const night = ctx.createLinearGradient(0, 0, 0, 285);
      night.addColorStop(0, '#08101d');
      night.addColorStop(0.62, '#253745');
      night.addColorStop(1, '#071019');
      ctx.fillStyle = night;
      ctx.fillRect(0, 0, 300, 285);
      // Arena lights and the open road frame the truck.
      for (const [x, y] of [
        [29, 100],
        [267, 87],
      ]) {
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
        height = (width * truck.height) / truck.width;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath();
      ctx.ellipse(150, 265, 133, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(truck, 7, 266 - height, width, height);
      ctx.restore();
    } else if (product === 'beer') {
      const glow = ctx.createRadialGradient(162, 81, 3, 162, 81, 167);
      glow.addColorStop(0, '#a56e33');
      glow.addColorStop(1, '#291811');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 300, 180);
      ctx.fillStyle = '#321d11';
      ctx.fillRect(0, 153, 300, 27);
      ctx.strokeStyle = '#b4894e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 153);
      ctx.lineTo(300, 153);
      ctx.stroke();
      const source = await HoopWireCourt.loadImage('assets/scene/bottle.png'),
        bottle = document.createElement('canvas');
      bottle.width = source.width;
      bottle.height = source.height;
      const b = bottle.getContext('2d');
      b.drawImage(source, 0, 0);
      const pixels = b.getImageData(0, 0, bottle.width, bottle.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (!pixels.data[i + 3]) continue;
        const y = Math.floor(i / 4 / bottle.width),
          shade = pixels.data[i] / 255;
        const color = y === 0 ? [233, 205, 155] : [173, 102, 34];
        color.forEach((v, k) => (pixels.data[i + k] = Math.round(v * shade)));
      }
      b.putImageData(pixels, 0, 0);
      ctx.fillStyle = '#24150c';
      ctx.beginPath();
      ctx.ellipse(152, 155, 84, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(102, 150);
      ctx.rotate(-0.12);
      ctx.drawImage(bottle, -24, -96, 48, 96);
      ctx.restore();
      ctx.drawImage(bottle, 150, 9, 72, 144);
    } else if (product === 'shoes') {
      const spotlight = ctx.createRadialGradient(150, 90, 8, 150, 90, 155);
      spotlight.addColorStop(0, '#33566d');
      spotlight.addColorStop(1, '#0a1823');
      ctx.fillStyle = spotlight;
      ctx.fillRect(0, 0, 300, 180);
      ctx.strokeStyle = '#638ba1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(150, 151, 112, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      const source = await HoopWireCourt.loadImage('assets/scene/shoes.png'),
        shoe = document.createElement('canvas');
      shoe.width = source.width;
      shoe.height = source.height;
      const s = shoe.getContext('2d');
      s.drawImage(source, 0, 0);
      const pixels = s.getImageData(0, 0, shoe.width, shoe.height);
      // Remove only the flat backdrop connected to the image edges, leaving
      // the supplied shoe colors and interior pixels intact.
      const bg = Array.from(pixels.data.slice(0, 3)),
        visited = new Uint8Array(shoe.width * shoe.height),
        queue = [];
      for (let x = 0; x < shoe.width; x++) queue.push(x, (shoe.height - 1) * shoe.width + x);
      for (let y = 0; y < shoe.height; y++) queue.push(y * shoe.width, y * shoe.width + shoe.width - 1);
      for (let i = 0; i < queue.length; i++) {
        const n = queue[i];
        if (visited[n]) continue;
        visited[n] = 1;
        const offset = n * 4;
        if (!bg.every((v, k) => pixels.data[offset + k] === v)) continue;
        pixels.data[offset + 3] = 0;
        const x = n % shoe.width,
          y = Math.floor(n / shoe.width);
        if (x) queue.push(n - 1);
        if (x + 1 < shoe.width) queue.push(n + 1);
        if (y) queue.push(n - shoe.width);
        if (y + 1 < shoe.height) queue.push(n + shoe.width);
      }
      s.putImageData(pixels, 0, 0);
      ctx.fillStyle = '#082031';
      ctx.beginPath();
      ctx.ellipse(150, 154, 62, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const width = 144,
        height = (width * shoe.height) / shoe.width;
      ctx.drawImage(shoe, 78, 1, width, height);
      ctx.fillStyle = '#a9edff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('COURT 01', 150, 176);
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
  window.HoopWireAdArt = { render };
})();
