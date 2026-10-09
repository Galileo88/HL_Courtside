/* Images survive iOS dropping archived files: bytes are stored inline, lost images are redrawn, and the TV keeps 16:9. */
const { launchBrowser, samplePath } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page.locator('#saveFile').setInputFiles(samplePath);
    await page.waitForFunction(() => document.getElementById('saveFile').disabled);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 180000 });

    // Images are stored as bytes inside the records, not as separate Blob files.
    const raw = await page.evaluate(
      () =>
        new Promise(resolve => {
          const req = indexedDB.open('hoopwire.daily.v1');
          req.onsuccess = () => {
            const tx = req.result.transaction(['stories', 'leagues']);
            const stories = tx.objectStore('stories').getAll(),
              leagues = tx.objectStore('leagues').getAll();
            tx.oncomplete = () => {
              req.result.close();
              const story = stories.result.find(s => s.imageBlob);
              const studio = Object.values(leagues.result[0].studios)[0];
              resolve({
                story: story.imageBlob instanceof Blob ? 'blob' : story.imageBlob?.packedImage ? 'bytes' : 'none',
                studio: studio.imageBlob instanceof Blob ? 'blob' : studio.imageBlob?.packedImage ? 'bytes' : 'none',
              });
            };
          };
        })
    );
    assert.deepEqual(raw, { story: 'bytes', studio: 'bytes' });

    // The TV player is 16:9 even when its picture can't load, and a lost picture is redrawn and saved.
    await page.evaluate(() => (location.hash = '#tv'));
    await page.waitForSelector('#tvStudio:not([hidden])');
    const ratio = () =>
      page.evaluate(() => {
        const r = document.getElementById('tvStage').getBoundingClientRect();
        return Math.round((r.width / r.height) * 100) / 100;
      });
    assert.equal(await ratio(), 1.78);
    await page.evaluate(async () => {
      // Simulate iOS losing the stored file: the picture's bytes are now garbage.
      const a = await new HoopWireArchive().open();
      const leagues = await a.all('leagues');
      for (const league of leagues)
        for (const studio of Object.values(league.studios))
          studio.imageBlob = new Blob(['lost'], { type: 'image/png' });
      await a.write({ leagues });
      const stories = await a.all('stories');
      for (const s of stories) if (s.imageBlob) s.imageBlob = new Blob(['lost'], { type: 'image/png' });
      await a.write({ stories });
      a.db.close();
    });
    await page.reload();
    await page.waitForFunction(() => location.hash === '#tv' && !document.getElementById('tvStudio').hidden);
    assert.equal(await ratio(), 1.78, 'the player keeps its shape while the picture is missing');
    await page.waitForFunction(() => document.getElementById('tvStudio').naturalWidth === 960, null, {
      timeout: 60000,
    });
    // A story picture comes back the same way.
    await page.evaluate(() => (location.hash = '#newsroom'));
    await page.waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('.wire-feature img, .wire-story img, .wire-tv-poster')].filter(i =>
          i.getAttribute('src')?.startsWith('blob:')
        );
        return imgs.length && imgs.every(i => i.complete && i.naturalWidth > 0);
      },
      null,
      { timeout: 90000 }
    );
    // The redrawn pictures were saved, so the next reload is clean.
    const fixed = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        // The studio on screen was redrawn; whichever league it belongs to, its picture is whole again.
        const sizes = await Promise.all(
          (await a.all('leagues')).map(
            async l => (await Object.values(l.studios)[0].imageBlob.arrayBuffer()).byteLength
          )
        );
        return Math.max(...sizes);
      } finally {
        a.db.close();
      }
    });
    assert.ok(fixed > 1000);
    assert.deepEqual(errors, []);
    console.log(
      'Image recovery checks passed: inline bytes, 16:9 player, lost studio and story pictures redrawn and saved.'
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
