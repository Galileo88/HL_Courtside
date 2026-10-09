/* The share icon on a story turns the article, picture and stat sheets into one image:
   a download on a computer, the share sheet on a phone. */
const { launchBrowser, samplePath } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';

const png = bytes => ({
  png: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  width: bytes.readUInt32BE(16),
  height: bytes.readUInt32BE(20),
});

(async () => {
  const browser = await launchBrowser();
  try {
    const desk = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true }),
      page = await desk.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page.locator('#saveFile').setInputFiles(samplePath);
    await page.waitForFunction(() => document.getElementById('saveFile').disabled);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 300000 });
    const story = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        return (await a.all('stories')).find(s => s.gid != null && s.imageBlob).id;
      } finally {
        a.db.close();
      }
    });
    const open = async p => {
      await p.evaluate(id => (location.hash = '#story/' + encodeURIComponent(id)), story);
      await p.waitForSelector('.article-byline .article-share');
    };
    await open(page);
    // One credit and one icon on the byline, and the icon is a button screen readers can name.
    const byline = await page.locator('.article-byline').first();
    assert.equal((await byline.textContent()).match(/HoopWire Staff/g).length, 1);
    assert.equal(await page.locator('.article-share').count(), 1);
    assert.equal(await page.locator('.article-share').getAttribute('aria-label'), 'Share story');

    // On a computer, the icon downloads a 1080-pixel-wide PNG of the whole article.
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('.article-share')]);
    assert.match(download.suggestedFilename(), /^hoopwire-[a-z0-9-]+\.png$/);
    const image = png(fs.readFileSync(await download.path()));
    assert.ok(image.png);
    assert.equal(image.width, 1080);
    assert.ok(image.height > 1400, `the article, picture and stat sheet fit in ${image.height}px`);
    assert.equal(await page.locator('.share-sheet').count(), 0, 'the off-screen copy is removed');

    // On a phone, it opens the share sheet with the image attached.
    const phone = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        serviceWorkers: 'block',
      }),
      mobile = await phone.newPage();
    mobile.on('pageerror', e => errors.push(e.message));
    await mobile.addInitScript(() => {
      navigator.canShare = data => Array.isArray(data?.files);
      navigator.share = async data => {
        window.shared = {
          title: data.title,
          type: data.files[0].type,
          name: data.files[0].name,
          size: data.files[0].size,
        };
      };
    });
    await mobile.goto(url);
    await mobile.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await mobile.locator('#saveFile').setInputFiles(samplePath);
    await mobile.waitForFunction(() => document.getElementById('saveFile').disabled);
    await mobile.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 300000 });
    await open(mobile);
    await mobile.locator('.article-share').tap();
    await mobile.waitForFunction(() => window.shared);
    const shared = await mobile.evaluate(() => window.shared);
    assert.equal(shared.type, 'image/png');
    assert.match(shared.name, /\.png$/);
    assert.ok(shared.size > 50000);
    assert.equal(shared.title, await mobile.locator('.article-headline').textContent());
    assert.deepEqual(errors, []);
    console.log('Share checks passed: byline icon, 1080px PNG download on a computer, share sheet on a phone.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
