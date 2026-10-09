const { fullSamplePath, launchBrowser } = require('./helpers.cjs');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const root = path.resolve(__dirname, '..'),
  save = JSON.parse(fs.readFileSync(fullSamplePath, 'utf8'));
const server = http.createServer((req, res) => {
  const f = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f)) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    'Content-Type',
    { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] ||
      'application/octet-stream'
  );
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    const ready = () => page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await ready();
    const leagueLogo = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#092033';
      x.beginPath();
      x.arc(64, 64, 60, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#fff';
      x.lineWidth = 5;
      x.stroke();
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = 'bold 52px Arial';
      x.fillText('HL', 64, 65);
      return c.toDataURL();
    });
    for (const league of save.seasonLeagues) league.logoURL = leagueLogo;
    await page
      .locator('#saveFile')
      .setInputFiles({ name: 'league.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await ready();
    const logoChecks = await page.evaluate(async () => {
      const background = await HoopWireCourt.loadImage('assets/scene/press-background.png'),
        mark = document.createElement('canvas');
      mark.width = 64;
      mark.height = 32;
      const painter = mark.getContext('2d');
      painter.fillStyle = '#ff00ff';
      painter.fillRect(0, 0, 64, 32);
      const custom = await HoopWirePressBackdrop.render(background, { logoURL: mark.toDataURL() }),
        native = await HoopWirePressBackdrop.render(background, { logoURL: 'atlanta' });
      const offline = await HoopWirePressBackdrop.render(
          background,
          { logoURL: 'https://unreachable.invalid/logo.png' },
          custom.logoData
        ),
        missing = await HoopWirePressBackdrop.render(background, {});
      painter.fillStyle = '#00ffff';
      painter.fillRect(0, 0, 64, 32);
      const leagueImage = mark.toDataURL();
      const alternating = await HoopWirePressBackdrop.render(background, { logoURL: custom.logoData }, null, {
        league: { logoURL: leagueImage },
      });
      const ac = alternating.canvas.getContext('2d'),
        leagueCenters = alternating.leagueSlots.map(slot =>
          Array.from(ac.getImageData(slot.x + slot.width / 2, slot.y + slot.height / 2, 1, 1).data)
        ),
        leagueMargin = Array.from(ac.getImageData(35, 16, 1, 1).data);
      const offlineLeague = await HoopWirePressBackdrop.render(background, {}, null, {
        league: { logoURL: 'https://unreachable.invalid/league.png' },
        leagueData: alternating.leagueLogoData,
      });
      const high = await HoopWirePressBackdrop.render(background, { logoURL: 'atlanta' }, null, { scale: 4 }),
        output = document.createElement('canvas');
      output.width = 768;
      output.height = 432;
      const display = output.getContext('2d');
      display.imageSmoothingEnabled = false;
      HoopWirePressBackdrop.paint(display, high, [224, 126, 320, 180]);
      const restored = !display.imageSmoothingEnabled;
      const c = custom.canvas.getContext('2d'),
        centers = custom.slots.map(slot =>
          Array.from(c.getImageData(slot.x + slot.width / 2, slot.y + slot.height / 2, 1, 1).data)
        );
      const pixel = Array.from(c.getImageData(36, 4, 1, 1).data),
        fallback = Array.from(missing.canvas.getContext('2d').getImageData(16, 16, 1, 1).data);
      return {
        leagueCenters,
        leagueMargin,
        leagueSlots: alternating.leagueSlots.length,
        offlineLeague: offlineLeague.leagueStatus,
        restored,
        highWidth: high.canvas.width,
        slots: custom.slots.length,
        centers,
        pixel,
        fallback,
        native: native.status,
        offline: offline.status,
        data: custom.logoData,
      };
    });
    assert.equal(logoChecks.leagueSlots, 8);
    assert.ok(logoChecks.leagueCenters.every(p => p[0] === 0 && p[1] === 255 && p[2] === 255));
    assert.deepEqual(logoChecks.leagueMargin, [15, 77, 163, 255]);
    assert.equal(logoChecks.offlineLeague, 'loaded');
    assert.equal(logoChecks.restored, true, 'Backdrop smoothing must not soften the pixel-art foreground');
    assert.equal(logoChecks.highWidth, 512);
    assert.equal(logoChecks.slots, 8);
    assert.ok(logoChecks.centers.every(p => p[0] === 255 && p[1] === 0 && p[2] === 255));
    assert.deepEqual(logoChecks.pixel, [15, 77, 163, 255]);
    assert.deepEqual(logoChecks.fallback, [15, 77, 163, 255]);
    assert.equal(logoChecks.native, 'loaded');
    assert.equal(logoChecks.offline, 'loaded');
    assert.match(logoChecks.data, /^data:image\/png;base64,/);
    const previews = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      const stories = await a.all('stories');
      a.db.close();
      const interview = stories.find(
          s => s.sceneInputs.kind === 'interview' && s.sceneInputs.pressLogoStatus === 'loaded'
        ),
        action = stories.find(s => s.sceneInputs.kind === 'action');
      const variants = [
          ...HoopWireScenes.interviewVariants.map(v => ['interview', v]),
          ...['drive-tight', 'shot-close-up', 'pass-tight', 'dunk-tight'].map(v => ['action', v]),
        ],
        results = [];
      for (const [kind, variant] of variants) {
        const scene = structuredClone((kind === 'interview' ? interview : action).sceneInputs);
        scene.kind = kind;
        if (kind === 'interview') scene.interview = HoopWireScenes.interviewDesign(scene.seed, variant);
        else {
          scene.action = HoopWireScenes.actionDesign(scene.seed, variant, 'right');
          scene.pose = scene.action.pose;
        }
        const result = await HoopWireScenes.render(scene),
          base64 = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(result.imageBlob);
          });
        results.push({ variant, caption: result.imageCaption, base64 });
      }
      return results;
    });
    assert.equal(new Set(previews.map(p => p.base64)).size, 8);
    const deskMatches = await page.evaluate(async previews => {
      async function load(base64) {
        const image = new Image();
        image.src = 'data:image/png;base64,' + base64;
        await image.decode();
        return image;
      }
      const group = await load(previews.find(p => p.variant === 'group').base64),
        close = await load(previews.find(p => p.variant === 'player-close-up').base64);
      const expected = document.createElement('canvas'),
        actual = document.createElement('canvas');
      expected.width = actual.width = 768;
      expected.height = actual.height = 432;
      const e = expected.getContext('2d'),
        a = actual.getContext('2d');
      e.imageSmoothingEnabled = a.imageSmoothingEnabled = false;
      e.drawImage(group, ...HoopWireScenes.interviewDesign('', 'player-close-up').camera, 0, 0, 768, 432);
      a.drawImage(close, 0, 0);
      const ep = e.getImageData(0, 400, 768, 32).data,
        ap = a.getImageData(0, 400, 768, 32).data;
      return ep.every((value, i) => value === ap[i]);
    }, previews);
    assert.equal(
      deskMatches,
      true,
      'The interview close-up must enlarge the desk with the same camera crop as the player'
    );

    for (const preview of previews)
      fs.writeFileSync(path.join(root, 'artifacts', preview.variant + '.png'), Buffer.from(preview.base64, 'base64'));
    const sheet = await page.evaluate(async previews => {
      const c = document.createElement('canvas');
      c.width = 1536;
      c.height = 512;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#092033';
      ctx.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < previews.length; i++) {
        const x = (i % 4) * 384,
          y = Math.floor(i / 4) * 256,
          img = new Image();
        img.src = 'data:image/png;base64,' + previews[i].base64;
        await img.decode();
        ctx.drawImage(img, x, y + 30, 384, 216);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText(previews[i].variant, x + 12, y + 22);
      }
      return c.toDataURL().split(',')[1];
    }, previews);
    fs.writeFileSync(path.join(root, 'artifacts/framing-preview.png'), Buffer.from(sheet, 'base64'));
    const before = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        const rows = await a.all('stories'),
          chosen = ['interview', 'action'].map(kind => rows.find(s => s.sceneInputs.kind === kind));
        await a.write({
          stories: chosen.map(s => ({ ...s, sceneInputs: { ...s.sceneInputs, version: 6, interview: undefined } })),
        });
        return chosen.map(s => ({ id: s.id, paragraphs: s.paragraphs, stats: s.playerStats, createdAt: s.createdAt }));
      } finally {
        a.db.close();
      }
    });
    await page.reload();
    await ready();
    const backup = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        return JSON.parse(JSON.stringify(await a.exportData()));
      } finally {
        a.db.close();
      }
    });
    assert.ok(backup.stories.some(s => s.sceneInputs?.pressLogoData?.startsWith('data:image/png;base64,')));
    assert.ok(backup.stories.some(s => s.sceneInputs?.pressLeagueLogoData?.startsWith('data:image/png;base64,')));
    const after = await page.evaluate(
      async ids => {
        const a = await new HoopWireArchive().open();
        try {
          return await Promise.all(ids.map(id => a.get('stories', id)));
        } finally {
          a.db.close();
        }
      },
      before.map(s => s.id)
    );
    for (let i = 0; i < before.length; i++) {
      assert.equal(after[i].sceneInputs.version, 16);
      assert.deepEqual(after[i].paragraphs, before[i].paragraphs);
      assert.deepEqual(after[i].playerStats, before[i].stats);
      assert.equal(after[i].createdAt, before[i].createdAt);
    }
    assert.deepEqual(errors, []);
    console.log(
      'Framing checks passed: four interview views, four player action close-ups, distinct images and archived image upgrades preserving stories and stats.'
    );
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e.stack);
  process.exitCode = 1;
});
