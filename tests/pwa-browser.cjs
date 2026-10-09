/* HoopWire as a Home Screen app: installable, opens offline, behaves under a finger, and keeps
   story pictures as lossless WebP that survive a backup. */
const { launchBrowser, samplePath } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';

(async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);

    // The manifest and every icon it names load.
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]').href;
      const data = await (await fetch(href)).json();
      const icons = await Promise.all(
        [
          ...data.icons.map(i => new URL(i.src, href).href),
          document.querySelector('link[rel="apple-touch-icon"]').href,
        ].map(async src => (await fetch(src)).ok)
      );
      return { display: data.display, purposes: data.icons.map(i => i.purpose), icons };
    });
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.purposes.includes('maskable'));
    assert.ok(manifest.icons.every(Boolean));

    // The service worker takes over, and the app still opens with the network gone.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    assert.ok(await page.locator('#welcome').isVisible());
    await context.setOffline(false);

    // A tap never zooms or pans the page.
    const touch = await page.evaluate(() => {
      const field = document.createElement('input');
      document.body.append(field);
      const size = parseFloat(getComputedStyle(field).fontSize);
      field.remove();
      const html = getComputedStyle(document.documentElement);
      return {
        size,
        selects: [...document.querySelectorAll('select')].every(s => parseFloat(getComputedStyle(s).fontSize) >= 16),
        overscroll: html.overscrollBehaviorY,
        touchAction: html.touchAction,
      };
    });
    assert.ok(touch.size >= 16 && touch.selects, 'fields are at least 16px');
    assert.equal(touch.overscroll, 'none');
    assert.equal(touch.touchAction, 'manipulation');

    await page.locator('#saveFile').setInputFiles(samplePath);
    await page.waitForFunction(() => document.getElementById('saveFile').disabled);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 300000 });

    // Nothing on a phone is wider than the screen, so the page cannot be dragged sideways.
    const story = await page.evaluate(() => document.querySelector('[data-story-id]')?.dataset.storyId);
    for (const hash of ['#newsroom', '#story/' + encodeURIComponent(story), '#tv', '#archive']) {
      await page.evaluate(h => (location.hash = h), hash);
      await page.waitForTimeout(400);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(wide <= 0, `${hash} is ${wide}px wider than the screen`);
    }

    // New story pictures are lossless WebP, and a backup brings them back as WebP.
    const pictures = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        const before = (await a.all('stories')).filter(s => s.imageBlob);
        const backup = await a.exportData();
        const data = backup.stories.find(s => s.imageData)?.imageData.slice(0, 23);
        await a.resetAll();
        await a.importData(backup);
        const after = (await a.all('stories')).filter(s => s.imageBlob);
        return {
          types: [...new Set(before.map(s => s.imageBlob.type))],
          restored: after.length === before.length && after.every(s => s.imageBlob.type === 'image/webp'),
          data,
        };
      } finally {
        a.db.close();
      }
    });
    assert.deepEqual(pictures.types, ['image/webp']);
    assert.equal(pictures.data, 'data:image/webp;base64,');
    assert.ok(pictures.restored);
    assert.deepEqual(errors, []);
    console.log(
      'App checks passed: installable, opens offline, no zoom or sideways drag on a phone, WebP pictures survive a backup.'
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
