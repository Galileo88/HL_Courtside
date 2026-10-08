const { launchBrowser } = require('./helpers.cjs');
/* Verify sponsor atlas selection, fitted size and saved-studio upgrades. */
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname,
    file = path.resolve(root, '.' + (name === '/' ? '/index.html' : decodeURIComponent(name)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    'Content-Type',
    { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav' }[
      path.extname(file)
    ] || 'application/octet-stream'
  );
  fs.createReadStream(file).pipe(res);
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
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    const suitPixels = await page.evaluate(async () => {
      await HoopWirePlayer.ready();
      const person = HoopWireTV.inputs({ teams: [] }).announcers[0];
      person.suits = [{ jacketC: '225588', shirtC: 'FFFFFF', tieC: 'FF0000', pantC: '336699', shoeC: '000000' }];
      return ['left', 'right'].map(facing => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 42;
        HoopWirePlayer.draw(canvas, person, null, 0, 0, 'idle', facing);
        const ctx = canvas.getContext('2d');
        return [
          [15, 25],
          [14, 24],
          [13, 24],
          [13, 30],
        ].map(([x, y]) => Array.from(ctx.getImageData(facing === 'right' ? 31 - x : x, y, 1, 1).data));
      });
    });
    for (const pixels of suitPixels)
      assert.deepEqual(
        pixels,
        [
          [255, 0, 0, 255],
          [255, 255, 255, 255],
          [24, 59, 95, 255],
          [51, 102, 153, 255],
        ],
        'Native tie, shirt, jacket and pants masks must stay distinct, including mirrored models'
      );
    const fixtures = await page.evaluate(() =>
      Object.fromEntries(
        ['horizontal', 'vertical'].map(layout => {
          const c = document.createElement('canvas');
          c.width = layout === 'horizontal' ? 2048 : 256;
          c.height = 256;
          const ctx = c.getContext('2d');
          if (layout === 'horizontal') c.height = 64;
          for (let i = 0; i < 8; i++) {
            const x = layout === 'horizontal' ? i * 256 : 0,
              y = layout === 'vertical' ? i * 32 : 0,
              h = layout === 'vertical' ? 32 : 64;
            ctx.fillStyle = ['#d71920', '#16964e', '#126bd2', '#8b45c0', '#e7a821', '#18bac0', '#c54b99', '#d71920'][i];
            ctx.fillRect(x, y, 256, h);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${h / 2}px Arial`;
            ctx.fillText(`SPONSOR ${i + 1}`, x + 40, y + h * 0.7);
          }
          return [layout, c.toDataURL().split(',')[1]];
        })
      )
    );
    await page.route('https://sponsor-test.invalid/**', r =>
      r.fulfill({
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.from(fixtures[new URL(r.request().url()).pathname.slice(1, -4)], 'base64'),
      })
    );
    for (const layout of ['horizontal', 'vertical']) {
      const result = await page.evaluate(async layout => {
        const inputs = {
          ...HoopWireTV.inputs({ teams: [], leagueName: 'Sponsor check' }),
          adsURL: `https://sponsor-test.invalid/${layout}.png`,
          adSize: 256,
          adSlots: [0, 2, 4, 6],
        };
        const studio = await HoopWireTV.render(inputs),
          bitmap = await createImageBitmap(studio.imageBlob),
          c = document.createElement('canvas');
        c.width = 960;
        c.height = 540;
        const ctx = c.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const pixels = Array.from({ length: 4 }, (_, i) =>
          [14 + i * 236, 237 + i * 236].map(x => Array.from(ctx.getImageData(x, 438, 1, 1).data))
        );
        const backdrop = await createImageBitmap(studio.backdropBlob);
        ctx.drawImage(backdrop, 0, 0);
        backdrop.close();
        const behind = Array.from({ length: 4 }, (_, i) => Array.from(ctx.getImageData(14 + i * 236, 438, 1, 1).data));
        if (layout === 'horizontal') {
          const img = document.createElement('img');
          img.id = 'sponsorPreview';
          img.src = URL.createObjectURL(studio.imageBlob);
          document.body.appendChild(img);
          await img.decode();
          const a = await new HoopWireArchive().open();
          await a.write({
            leagues: [
              {
                id: 'sponsor-upgrade',
                leagueName: 'Sponsor check',
                studios: { 1: { ...studio, inputs: { ...inputs, version: 3 } } },
              },
            ],
          });
          a.db.close();
        }
        return {
          pixels,
          behind,
          status: studio.adsStatus,
          version: studio.inputs.version,
          currentVersion: HoopWireTV.version,
          random: HoopWireTV.inputs({ teams: [] }).adSlots,
        };
      }, layout);
      assert.equal(result.status, 'loaded');
      assert.equal(result.version, result.currentVersion);
      assert.equal(result.random.length, 4);
      assert.ok(result.random.every(n => Number.isInteger(n) && n >= 0 && n < 7));
      const colors = [
        [215, 25, 32, 255],
        [18, 107, 210, 255],
        [231, 168, 33, 255],
        [197, 75, 153, 255],
      ];
      result.pixels.forEach((pixels, i) => pixels.forEach(pixel => assert.deepEqual(pixel, colors[i])));
      result.behind.forEach((pixel, i) => assert.deepEqual(pixel, colors[i]));
    }
    await page.locator('#sponsorPreview').screenshot({ path: path.join(root, 'artifacts/tv-desk-ads.png') });
    await page.reload();
    await page.waitForFunction(async () => {
      const a = await new HoopWireArchive().open();
      try {
        return (await a.get('leagues', 'sponsor-upgrade'))?.studios?.[1]?.inputs?.version === HoopWireTV.version;
      } finally {
        a.db.close();
      }
    });
    assert.deepEqual(errors, []);
    console.log(
      'Desk sponsor checks passed: larger ad windows, random selection from ads 1–7 across all four spots for horizontal and vertical atlases, matching backdrop and saved-studio upgrade.'
    );
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e.stack);
  process.exitCode = 1;
});
