/* Browser checks for local host speech, animation, cancellation and backups. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const save = JSON.parse(fs.readFileSync(process.argv[2] || path.join(root, 'sample_save'), 'utf8'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123');
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page
      .locator('#saveFile')
      .setInputFiles({ name: 'league.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page.locator('.nav a[href="#tv"]').click();
    assert.equal(await page.locator('#archive').isVisible(), false);
    assert.equal(await page.locator('#welcome').isVisible(), false);
    assert.equal(await page.locator('#tvSegment .article-body, #tvSegment .article-image').count(), 0);
    assert.ok((await page.locator('#tvSegment table').count()) > 0);
    assert.equal(await page.locator('.tv-live-host').count(), 4);
    assert.equal(await page.locator('.tv-speech').count(), 1);
    const voiced = await page.evaluate(async () => {
      const synth = await HoopWireBroadcast.voiceSamples(),
        audioContext = new AudioContext();
      const result = [];
      for (const pitch of HoopWireBroadcast.voicePitches) {
        const wave = synth.Animalese('HoopWire daily news', true, pitch),
          bytes = Uint8Array.from(atob(wave.dataURI.split(',')[1]), c => c.charCodeAt(0));
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).join(',');
        const decoded = await audioContext.decodeAudioData(bytes.buffer);
        const samples = decoded.getChannelData(0);
        result.push({ duration: decoded.duration, nonzero: samples.some(x => Math.abs(x) > 0.01), hash });
      }
      await audioContext.close();
      return result;
    });
    assert.equal(new Set(voiced.map(v => v.hash)).size, 4);
    assert.ok(voiced.every(v => v.duration > 0 && v.nonzero));
    const pitches = await page.evaluate(() => HoopWireBroadcast.voicePitches);
    assert.ok(
      Math.min(pitches[0], pitches[3]) > Math.max(pitches[1], pitches[2]),
      'Both female hosts have higher pitches than both male hosts'
    );
    assert.equal(await page.locator('.tv-live-host.is-speaking').count(), 0, 'TV should not autoplay when opened');
    assert.equal(
      await page.locator('#tvStagePlay').isVisible(),
      true,
      'Centered play overlay should be visible before starting'
    );
    await page.locator('#tvStagePlay').click();
    assert.equal(
      await page.locator('#tvStagePlay').isVisible(),
      false,
      'Play overlay should hide while the episode runs'
    );
    await page.waitForFunction(() => document.querySelectorAll('.tv-live-host.is-speaking').length === 1);
    assert.equal(await page.locator('.tv-live-host.is-speaking').getAttribute('data-host'), '0');
    assert.equal(
      await page.locator('.tv-live-host.is-speaking canvas').evaluate(c => getComputedStyle(c).animationName),
      'tv-talk-bob'
    );
    await page.locator('#tvPlay').click();
    assert.equal(await page.locator('.is-speaking').count(), 0);
    const seen = new Set();
    for (let i = 0; i < 30; i++) {
      const speaker = await page.locator('.tv-speech').getAttribute('class');
      seen.add(speaker);
      if (await page.locator('#tvLineNext').isDisabled()) break;
      await page.locator('#tvLineNext').evaluate(b => b.click());
    }
    assert.equal(seen.size, 4);
    await page.locator('#tvNext').click();
    assert.equal(await page.locator('.is-speaking').count(), 0, 'Next Story should load without autoplaying');
    assert.equal(await page.locator('#tvStagePlay').isVisible(), true, 'Next Story should return to the play overlay');
    assert.match(await page.locator('#tvStagePlay').getAttribute('aria-label'), /Play HoopWire TV episode/);
    await page.locator('#tvStagePlay').click();
    await page.waitForFunction(() => document.querySelectorAll('.is-speaking').length === 1);
    assert.match(await page.locator('#tvDiscussionStatus').textContent(), /^Line 1 of/);
    assert.equal(await page.locator('#tv button:visible').count(), 4);
    assert.equal(await page.locator('#tvTicker').isVisible(), true);
    assert.match(await page.locator('#tvTicker').getAttribute('aria-label'), /final results:/);
    assert.equal(await page.locator('#tvTicker').evaluate(t => t.parentElement.id), 'tvStage');
    assert.equal(await page.locator('#tvSegment h2').textContent(), 'Box score');
    await page.locator('#tvMute').click();
    assert.equal(await page.locator('#tvMute').getAttribute('aria-label'), 'Unmute voices');
    assert.equal(await page.locator('#tvMute').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.is-speaking').count(), 1);

    const oldStory = await page.locator('#tvStorySelect').inputValue();
    assert.equal(
      await page.locator('#tvStorySelect').inputValue(),
      oldStory,
      'Episode playback must not change the selected story'
    );
    await page.locator('#tv').screenshot({ path: path.join(root, 'artifacts/tv-discussion.png') });
    await page.locator('.nav a[href="#newsroom"]').click();
    assert.equal(await page.locator('.is-speaking').count(), 0);
    await page.locator('.nav a[href="#tv"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tv').screenshot({ path: path.join(root, 'artifacts/tv-discussion-mobile.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const backup = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      const data = await a.exportData();
      a.db.close();
      return data;
    });
    assert.ok(Object.values(backup.leagues[0].studios)[0].backdropData.startsWith('data:image/png;base64,'));
    const other = await browser.newContext(),
      p = await other.newPage();
    await p.goto('http://127.0.0.1:8123');
    await p.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await p
      .locator('#importFile')
      .setInputFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup)),
      });
    await p.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await p.goto('http://127.0.0.1:8123/#archive');
    await p.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await p.route('**/animalese.wav', r => r.abort());
    await p.locator('.nav a[href="#tv"]').click();
    assert.equal(await p.locator('.tv-live-host').count(), 4, await p.locator('#status').textContent());
    assert.equal(await p.locator('.tv-speech').count(), 1);
    assert.equal(await p.locator('.is-speaking').count(), 0);
    await p.locator('#tvStagePlay').click();
    await p.waitForFunction(() =>
      document.getElementById('tvDiscussionStatus').textContent.includes('Voice unavailable')
    );
    assert.equal(await p.locator('.is-speaking').count(), 1);
    await p.locator('#tvPlay').click();
    assert.equal(await p.locator('.is-speaking').count(), 0);
    assert.equal(await p.locator('#tvStagePlay').isVisible(), true);
    assert.deepEqual(errors, []);
    await other.close();
    await context.close();
    console.log(
      'Broadcast checks passed: centered idle play overlay, explicit episode start, idle Next Story navigation, four decoded distinct voices, active-host bobbing, no automatic story advance, speech turns, pause/navigation cancellation, silent playback, mobile, backdrop backup/import, and sample-load failure recovery.'
    );
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
