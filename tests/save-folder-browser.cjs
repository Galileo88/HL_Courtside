/* Save folder flow with a stand-in folder: choose a slot, remember it, reload its newest save. */
const { launchBrowser, samplePath } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';

// Two leagues share the folder; slot 02 saved most recently. Saves have no file extension.
function fakeFolder({ permission = 'granted', cancel = false, names = null } = {}) {
  window.showDirectoryPicker = async () => {
    if (cancel) throw new DOMException('The user aborted a request.', 'AbortError');
    const entry = (name, lastModified, body) => ({
      kind: 'file',
      name,
      getFile: async () => new File([await body()], name, { lastModified }),
    });
    const sample = () => fetch('/tests/fixtures/sample_save').then(r => r.blob());
    const files = (
      names || ['HL_LEAGUE_Y1_2026_SAVE_FILE_01', 'HL_LEAGUE_Y2_2027_SAVE_FILE_01', 'OTHER_LEAGUE_Y1_2026_SAVE_FILE_02']
    ).map((name, i) => entry(name, 1000 * (i + 1), sample));
    files.push(entry('settings', 9000, async () => '{"volume":1}'));
    return {
      name: 'Temp Files',
      queryPermission: async () => (permission === 'granted' ? 'granted' : 'prompt'),
      requestPermission: async () => permission,
      async *values() {
        yield* files;
      },
    };
  };
}
const status = page => page.locator('#status').textContent();
const ready = page =>
  page.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 120000 });
async function loaded(page) {
  await page.waitForFunction(() => document.getElementById('saveFile').disabled);
  await ready(page);
  assert.equal(await status(page), 'Save loaded.');
}

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await ready(page);
    assert.ok(await page.locator('#chooseSaveFolder').isVisible());

    await page.evaluate(fakeFolder, { cancel: true });
    await page.locator('#chooseSaveFolder').click();
    await ready(page);
    assert.doesNotMatch(await status(page), /abort/i);

    // Several slots: the player picks this league's slot, and its newest save loads.
    await page.evaluate(fakeFolder, {});
    await page.locator('#chooseSaveFolder').click();
    await page.locator('#saveSlots button').first().waitFor();
    assert.deepEqual(
      (await page.locator('#saveSlots button').allTextContents()).map(t => t.split(' · ')[0]),
      ['Slot 01', 'Slot 02']
    );
    await page
      .locator('.load-card')
      .screenshot({ path: require('node:path').join(__dirname, '..', 'artifacts/save-slots.png') });
    await page.locator('#saveSlots button', { hasText: 'Slot 01' }).click();
    await loaded(page);
    assert.equal(await page.locator('#fileName').textContent(), 'HL_LEAGUE_Y2_2027_SAVE_FILE_01');

    // Load latest stays in slot 01 although slot 02 was written later.
    await page.locator('#siteMenuButton').click();
    await page.locator('#menuLoadLatest').click();
    await loaded(page);
    assert.equal(await page.locator('#fileName').textContent(), 'HL_LEAGUE_Y2_2027_SAVE_FILE_01');
    await page.evaluate(() => (location.hash = '#welcome'));
    await ready(page);
    assert.equal(await page.locator('#saveFolderName').textContent(), 'Temp Files · slot 01');

    // Loading a save from another slot by hand makes that the slot to follow.
    await page.locator('#saveFile').setInputFiles({
      name: 'OTHER_LEAGUE_Y1_2026_SAVE_FILE_02',
      mimeType: 'application/octet-stream',
      buffer: fs.readFileSync(samplePath),
    });
    await loaded(page);
    await page.evaluate(() => (location.hash = '#welcome'));
    await ready(page);
    assert.equal(await page.locator('#saveFolderName').textContent(), 'Temp Files · slot 02');

    // One slot in the folder needs no question.
    await page.evaluate(fakeFolder, { names: ['HL_LEAGUE_Y1_2026_SAVE_FILE_03'] });
    await page.locator('#changeSaveFolder').click();
    await loaded(page);
    await page.evaluate(() => (location.hash = '#welcome'));
    await ready(page);
    assert.equal(await page.locator('#saveFolderName').textContent(), 'Temp Files · slot 03');

    await page.evaluate(fakeFolder, { permission: 'denied' });
    await page.locator('#changeSaveFolder').click();
    await ready(page);
    assert.match(await status(page), /needs permission to read the Temp Files folder/);
    assert.deepEqual(errors, []);

    const plain = await browser.newPage();
    await plain.addInitScript(() => delete window.showDirectoryPicker);
    await plain.goto(url);
    await ready(plain);
    assert.equal(await plain.locator('#saveFolder').isVisible(), false);
    console.log(
      'Save folder checks passed: slot choice, newest save in the slot, other slots ignored, hand-loaded slot, single slot, cancel, refusal, unsupported browsers.'
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
