/* Court layers and sprite positions adapted from HoopLeagueStudio's inspected court preview. */
(() => {
  'use strict';
  const cache = new Map();
  function validURL(value) {
    if (typeof value !== 'string') return false;
    if (/^data:image\/(png|jpeg|webp);base64,/i.test(value)) return true;
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }
  function load(url, remote = false) {
    if (!cache.has(url))
      cache.set(
        url,
        new Promise((resolve, reject) => {
          const image = new Image();
          let timer;
          const fail = () => {
            clearTimeout(timer);
            image.onload = image.onerror = null;
            cache.delete(url);
            reject(new Error('Court image unavailable'));
          };
          timer = setTimeout(fail, 8000);
          if (remote) image.crossOrigin = 'anonymous';
          image.onload = () => {
            clearTimeout(timer);
            resolve(image);
          };
          image.onerror = fail;
          image.src = url;
        })
      );
    return cache.get(url);
  }
  function rgb(value, team, fallback = 'FFFFFF') {
    const slot = { PRI: 0, SEC: 1, TER: 2 }[value];
    if (slot !== undefined) value = team?.teamColors?.[slot];
    const hex = /^#?[a-f\d]{6}$/i.test(value || '') ? value.replace(/^#/, '') : fallback;
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  }
  function recolor(image, tint, palette) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
      data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const mapped = palette?.[`${data[i]},${data[i + 1]},${data[i + 2]}`];
      const color = mapped || tint;
      if (!color) continue;
      const shade = tint ? Math.max(data[i], data[i + 1], data[i + 2]) / 255 : 1;
      for (let j = 0; j < 3; j++) data[i + j] = color[j] * shade;
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }
  const lineKeys = {
    '13,47,109': 'outerLine',
    '80,155,75': 'halfCourtLine',
    '19,178,242': 'outerKeyLine',
    '26,69,59': 'innerKeyLine',
    '15,77,163': 'outerFTCircle',
    '14,130,206': 'innerFTCircle',
  };
  const outerKeys = {
    '38,36,58': 'outerFloor',
    '65,182,230': 'outerBorder',
    '219,62,177': 'innerBorder',
    '123,207,92': 'mediaLines',
  };
  const palette = (mapping, court, team) =>
    Object.fromEntries(Object.entries(mapping).map(([key, name]) => [key, rgb(court[name], team)]));
  function hoopPalette(court, team) {
    const colors = {};
    const shades = (key, entries) => {
      const base = rgb(court[key], team);
      for (const [source, scale] of entries) colors[source] = base.map(v => Math.min(255, Math.round(v * scale)));
    };
    shades('hoopBase', [
      ['10,47,109', 0.75],
      ['5,77,163', 1],
      ['7,130,206', 1.2],
    ]);
    shades('hoopPole', [
      ['70,178,242', 1],
      ['75,243,252', 1.2],
      ['77,112,139', 0.65],
    ]);
    shades('polePadding', [
      ['210,44,54', 1],
      ['205,82,89', 1.15],
      ['207,151,155', 1.35],
      ['196,44,54', 0.85],
    ]);
    shades('hoopPadding', [
      ['85,155,75', 1],
      ['95,106,66', 0.7],
    ]);
    return colors;
  }
  const hoopFiles = ['hoop-shadow', 'hoop-base', 'hoop-pole', 'backboard', 'hoop-connector', 'rim'];
  const positions = [
    [110, 148],
    [110, 148],
    [110, 148],
    [110, 148],
    [134, 197],
    [214, 184],
  ];
  function drawHoops(ctx, images, court, team, part = 'all') {
    const colors = hoopPalette(court, team);
    for (const right of [false, true]) {
      ctx.save();
      if (right) {
        ctx.translate(1024, 0);
        ctx.scale(-1, 1);
      }
      images.forEach((image, i) => {
        if ((part === 'shadow' && i !== 0) || (part === 'structure' && i === 0)) return;
        ctx.globalAlpha = i === 0 ? 0.25 : 1;
        ctx.drawImage(i === 0 || i === 5 ? image : recolor(image, null, colors), ...positions[i]);
      });
      ctx.restore();
    }
  }
  async function render(team, { includeHoops = true } = {}) {
    const court = team?.court || {};
    const college = Number(court.threePointLine) === 1;
    const surfaces = ['outerWood', 'innerWood', 'outerFT', 'outerKey', 'innerKey', 'innerFT'];
    const files = surfaces.map(key => {
      const pattern = ['flat', 'lines', 'tiled', 'parquet', 'combs'].includes(court[key]) ? court[key] : 'parquet';
      return key + (key === 'innerWood' ? (college ? '-college' : '-pro') : '') + '-' + pattern;
    });
    const overlayPromise = validURL(court.overlayURL)
      ? load(court.overlayURL, true).catch(() => null)
      : Promise.resolve(null);
    const logoPromise =
      Number(court.logoSize) > 0 && validURL(team?.logoURL)
        ? load(team.logoURL, true).catch(() => null)
        : Promise.resolve(null);
    const [images, overlay, logo] = await Promise.all([
      Promise.all(
        ['outer-court', ...files, 'court-lines', college ? 'three-point-college' : 'three-point-pro', ...hoopFiles].map(
          file => load(`court/${file}.png`)
        )
      ),
      overlayPromise,
      logoPromise,
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(recolor(images[0], null, palette(outerKeys, court, team)), 0, 0);
    surfaces.forEach((key, i) => ctx.drawImage(recolor(images[i + 1], rgb(court[key + 'C'], team, 'DDAF78')), 191, 95));
    function custom(layer) {
      if (overlay && Number(court.overlayLayer || 0) === layer) ctx.drawImage(overlay, 0, 0, 1024, 512);
      const scale = [0, 0.5, 1, 1.5, 2][Number(court.logoSize)] || 0;
      if (logo && scale && Number(court.logoLayer || 0) === layer) {
        const ratio = Math.min((128 * scale) / logo.width, (128 * scale) / logo.height);
        ctx.drawImage(
          logo,
          512 - (logo.width * ratio) / 2,
          256 - (logo.height * ratio) / 2,
          logo.width * ratio,
          logo.height * ratio
        );
      }
    }
    custom(0);
    ctx.drawImage(recolor(images[7], null, palette(lineKeys, court, team)), 0, 0);
    if (Number(court.threePointLine) !== 2) ctx.drawImage(recolor(images[8], rgb(court.threePointLineC, team)), 0, 0);
    custom(1);
    for (const [key, x, y, rotation, max] of [
      ['baseline1', 176, 256, -Math.PI / 2, 280],
      ['baseline2', 848, 256, Math.PI / 2, 280],
      ['sideline1', 512, 80, 0, 580],
      ['sideline2', 512, 432, Math.PI, 580],
    ]) {
      if (!court[key]) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle =
        '#' +
        rgb(court[key + 'C'], team)
          .map(v => v.toString(16).padStart(2, '0'))
          .join('');
      ctx.fillText(String(court[key]), 0, 0, max);
      ctx.restore();
    }
    // Hoops are separate game sprites, even when the overlay supplies the full custom floor.
    drawHoops(ctx, images.slice(9), court, team, includeHoops ? 'all' : 'shadow');
    return {
      canvas,
      hoopLayers: [{ depth: 256, draw: target => drawHoops(target, images.slice(9), court, team, 'structure') }],
      customCourt: {
        url: court.overlayURL || null,
        status: overlay ? 'loaded' : court.overlayURL ? 'unavailable' : 'none',
        width: overlay?.width || null,
        height: overlay?.height || null,
      },
    };
  }
  window.HoopWireCourt = { render, validURL, loadImage: load };
})();
