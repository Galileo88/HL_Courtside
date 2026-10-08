/* Exclusive HoopWire hosts, with the loaded league's advertisement artwork. */
(() => {
  'use strict';
  const cache = new Map();
  const names = [
    ['Maya', 'Brooks'],
    ['Jordan', 'Price'],
    ['Andre', 'Cole'],
    ['Nina', 'Reyes'],
  ];
  function defaults(index) {
    return {
      id: `hoopwire-host-${index}`,
      fn: names[index][0],
      ln: names[index][1],
      wearsSuit: true,
      appearance: {
        skinC: ['BF7958', 'F4CCA1', '5E3643', 'EEA160'][index],
        eyeC: '262539',
        browC: '262539',
        hair: ['0138', '0043', '0032', '0060'][index],
        hairC: ['262539', '945542', '141020', '46211F'][index],
        fHair: index === 2 ? '0005' : '0000',
        fHairC: '141020',
      },
      suits: [
        {
          jacketC: ['1A3157', '67718A', '77202D', '154FA1'][index],
          shirtC: 'FFFFFF',
          tieC: ['D71920', '173859', 'DBB45E', '66718A'][index],
          pantC: '141020',
          shoeC: '000000',
          headAcc: '0000',
        },
      ],
    };
  }
  function inputs(league) {
    const announcers = Array.from({ length: 4 }, (_, i) => defaults(i));
    const adTeam = (league.teams || []).find(t => t.frontOffice?.adsURL);
    return {
      version: 6,
      adSlots: randomAds(),
      leagueName: league.leagueName || 'HoopWire',
      season: window.HoopWireCore.seasonYear(league),
      announcers,
      adsURL: adTeam?.frontOffice?.adsURL || null,
      adSize: adTeam?.frontOffice?.adSize || 256,
      hostSource: 'hoopwire',
    };
  }
  function randomAds() {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 7));
  }
  function render(input) {
    input = { ...input, version: 6, adSlots: input.adSlots || randomAds() };
    const key = JSON.stringify(input);
    if (!cache.has(key))
      cache.set(
        key,
        compose(input).catch(error => {
          cache.delete(key);
          throw error;
        })
      );
    return cache.get(key);
  }
  async function compose(input, withHosts = true) {
    const C = window.HoopWireCourt;
    const [table, graphic, ads] = await Promise.all([
      C.loadImage('scene-assets/announce-table.png'),
      C.loadImage('scene-assets/announce-table-graphic.png'),
      C.validURL(input.adsURL) ? C.loadImage(input.adsURL, true).catch(() => null) : null,
      window.HoopWirePlayer.ready(),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a1426';
    ctx.fillRect(0, 0, 960, 540);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#10233b' : '#172d48';
      ctx.fillRect(i * 80, 0, 76, 420);
      ctx.fillStyle = '#306887';
      ctx.fillRect(i * 80 + 74, 0, 2, 420);
    }
    ctx.fillStyle = '#050b15';
    ctx.fillRect(245, 22, 470, 151);
    ctx.strokeStyle = '#278ec0';
    ctx.lineWidth = 4;
    ctx.strokeRect(245, 22, 470, 151);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 42px Arial';
    ctx.fillText('HOOPWIRE TV', 480, 84);
    ctx.fillStyle = '#ee3546';
    ctx.fillRect(338, 100, 284, 4);
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#b7cee5';
    ctx.fillText('THE DAILY DESK', 480, 132);
    ctx.font = '12px Arial';
    ctx.fillText(String(input.leagueName).slice(0, 65), 480, 155);
    if (withHosts)
      input.announcers.forEach((person, i) => {
        const tile = document.createElement('canvas');
        tile.width = 128;
        tile.height = 168;
        window.HoopWirePlayer.draw(tile, person, null, 0, 0, 'idle');
        ctx.save();
        if (i < 2) {
          ctx.translate(70 + i * 220 + 160, 180);
          ctx.scale(-1, 1);
          ctx.drawImage(tile, 0, 0, 160, 210);
        } else ctx.drawImage(tile, 70 + i * 220, 180, 160, 210);
        ctx.restore();
      });
    ctx.fillStyle = '#171929';
    ctx.fillRect(0, 350, 960, 190);
    ctx.drawImage(table, 0, 247, 960, 240);
    ctx.drawImage(graphic, 0, 247, 960, 240);
    ctx.fillStyle = '#172f65';
    ctx.fillRect(8, 365, 944, 121);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 32px Arial';
    ctx.fillText('HOOPWIRE TV', 480, 398);
    // Pick from the first seven atlas tiles; the eighth repeats the first.
    if (ads) {
      const tileWidth = Math.min(Math.max(1, Number(input.adSize) || 256), ads.width);
      const tileHeight = ads.height <= tileWidth / 4 ? ads.height : Math.min(32, ads.height);
      const columns = Math.max(1, Math.floor(ads.width / tileWidth));
      const count = Math.min(7, columns * Math.max(1, Math.floor(ads.height / tileHeight)));
      for (let i = 0; i < 4; i++) {
        const ad = Math.max(0, Math.floor(Number(input.adSlots[i]) || 0)) % count;
        const sx = (ad % columns) * tileWidth,
          sy = Math.floor(ad / columns) * tileHeight;
        const x = 14 + i * 236,
          w = 224,
          h = Math.min(68, Math.round((w * tileHeight) / tileWidth)),
          y = 438 - h / 2;
        ctx.fillStyle = '#0a1120';
        ctx.fillRect(x, y, w, h);
        const scale = Math.min(w / tileWidth, h / tileHeight),
          dw = tileWidth * scale,
          dh = tileHeight * scale;
        ctx.drawImage(ads, sx, sy, tileWidth, tileHeight, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      }
    }
    ctx.fillStyle = '#0b1425';
    ctx.fillRect(0, 496, 960, 44);
    ctx.fillStyle = '#d71920';
    ctx.fillRect(0, 496, 176, 44);
    ctx.textAlign = 'left';
    ctx.font = 'italic bold 18px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('HOOPWIRE', 25, 524);
    ctx.font = 'bold 13px Arial';
    ctx.fillText(`DAILY COVERAGE  /  SEASON ${input.season}`, 202, 523);
    const imageBlob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not compose the TV studio.'))), 'image/png')
    );
    const backdropBlob = withHosts ? (await compose(input, false)).imageBlob : null;
    return {
      imageBlob,
      ...(backdropBlob ? { backdropBlob } : {}),
      inputs: structuredClone(input),
      imageAlt: `HoopWire TV studio with four announcers: ${input.announcers.map(p => window.HoopWireCore.playerDisplay(p)).join(', ')}, behind the Hoop Land announcer desk.`,
      adsStatus: ads ? 'loaded' : input.adsURL ? 'unavailable' : 'none',
      adsWidth: ads?.width || null,
      adsHeight: ads?.height || null,
    };
  }
  window.HoopWireTV = { inputs, render };
})();
