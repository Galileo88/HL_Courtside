const { seasonSamplePath, launchBrowser } = require('./helpers.cjs');
/* Run against the local preview server. Optionally pass a real custom-league save. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sample = JSON.parse(fs.readFileSync(seasonSamplePath, 'utf8'));
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';
async function ready(page) {
  await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
}
async function load(page, data) {
  await page
    .locator('#saveFile')
    .setInputFiles({ name: 'custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await ready(page);
  assert.match(await page.locator('#status').textContent(), /Save loaded/);
}
async function generate(page) {
  await ready(page);
  assert.match(await page.locator('#status').textContent(), /^Save loaded/);
}
async function getStories(page) {
  return page.evaluate(async () => {
    const a = await new HoopWireArchive().open();
    const stories = await a.all('stories');
    a.db.close();
    return stories.map(s => ({ ...s, imageBlob: undefined }));
  });
}
(async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } }),
      page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await ready(page);
    const fixtures = await page.evaluate(() => {
      const court = document.createElement('canvas');
      court.width = 1024;
      court.height = 512;
      const c = court.getContext('2d');
      c.fillStyle = '#538057';
      c.fillRect(0, 0, 1024, 512);
      c.fillStyle = '#fff';
      c.font = 'bold 70px Arial';
      c.fillText('CUSTOM COURT', 520, 210);
      const ads = document.createElement('canvas');
      ads.width = 1024;
      ads.height = 64;
      const a = ads.getContext('2d');
      for (let i = 0; i < 4; i++) {
        a.fillStyle = ['#d71920', '#16964e', '#126bd2', '#8b45c0'][i];
        a.fillRect(i * 256, 0, 256, 64);
        a.fillStyle = '#fff';
        a.font = 'bold 26px Arial';
        a.fillText(`SPONSOR ${i + 1}`, i * 256 + 40, 43);
      }
      return { court: court.toDataURL().split(',')[1], ads: ads.toDataURL().split(',')[1] };
    });
    await page.route('https://court-test.invalid/**', route =>
      route.fulfill({
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.from(fixtures.court, 'base64'),
      })
    );
    await page.route('https://ads-test.invalid/**', route =>
      route.fulfill({
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.from(fixtures.ads, 'base64'),
      })
    );
    const custom = structuredClone(sample);
    for (const l of custom.seasonLeagues) {
      l.media = [{ id: 999, fn: 'Saved', ln: 'Announcer', appearance: {} }];
      for (const t of l.teams) {
        t.court.overlayURL = 'https://court-test.invalid/custom.png';
        t.court.overlayLayer = 1;
        t.frontOffice.adsURL = 'https://ads-test.invalid/ads.png';
        t.frontOffice.adSize = 256;
      }
    }
    await load(page, custom);
    await generate(page);
    const stories = await getStories(page);
    const action = stories.find(s => s.sceneInputs.kind === 'action'),
      interview = stories.find(s => s.sceneInputs.kind === 'interview');
    const jerseyCheck = await page.evaluate(async saved => {
      const scene = structuredClone(saved);
      scene.kind = 'action';
      scene.action = HoopWireScenes.actionDesign(scene.seed, 'drive', 'right');
      scene.pose = 'dribbling';
      scene.player.num = 34;
      const withNumber = await HoopWireScenes.render(scene);
      scene.player.num = -1;
      const withoutNumber = await HoopWireScenes.render(scene);
      async function pixels(blob) {
        const image = await createImageBitmap(blob),
          c = document.createElement('canvas');
        c.width = 768;
        c.height = 432;
        const x = c.getContext('2d');
        x.drawImage(image, 0, 0);
        image.close();
        return x.getImageData(0, 0, 768, 432).data;
      }
      const a = await pixels(withNumber.imageBlob),
        b = await pixels(withoutNumber.imageBlob);
      let changed = 0;
      for (let i = 0; i < a.length; i += 4)
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changed++;
      function ballX(facing) {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 168;
        HoopWirePlayer.draw(c, scene.player, scene.team, scene.uniformIndex, 1, 'dribbling', facing);
        const p = c.getContext('2d').getImageData(0, 0, 128, 168).data;
        let sum = 0,
          count = 0;
        for (let i = 0; i < p.length; i += 4)
          if (p[i] === 227 && p[i + 1] === 112 && p[i + 2] === 51) {
            sum += (i / 4) % 128;
            count++;
          }
        return sum / count;
      }
      return { changed, left: ballX('left'), right: ballX('right') };
    }, action.sceneInputs);
    assert.equal(jerseyCheck.changed, 20, 'All twenty native #34 pixels must survive the final action composition');
    assert.ok(jerseyCheck.right > jerseyCheck.left, 'Ball must face the right-hand hoop when the attacker turns right');
    const variants = await page.evaluate(async saved => {
      const outputs = [];
      for (const variant of HoopWireScenes.actionVariants) {
        const scene = structuredClone(saved);
        scene.action = HoopWireScenes.actionDesign(scene.seed, variant, 'right');
        scene.pose = scene.action.pose;
        const a = await HoopWireScenes.render(scene),
          b = await HoopWireScenes.render(scene);
        const bytes = await a.imageBlob.arrayBuffer(),
          second = await b.imageBlob.arrayBuffer();
        outputs.push({
          variant,
          bytes: bytes.byteLength,
          identical:
            bytes.byteLength === second.byteLength &&
            new Uint8Array(bytes).every((v, i) => v === new Uint8Array(second)[i]),
          hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).join(','),
          camera: scene.action.camera,
          subject: scene.action.subject,
        });
      }
      const palette = HoopWirePlayer.ballPalette({ pri: '12AB34', sec: '56CD78', ter: '90EF12', outline: '231045' });
      return {
        outputs,
        palette,
        selected: HoopWireScenes.actionDesign('same-seed'),
        repeat: HoopWireScenes.actionDesign('same-seed'),
      };
    }, action.sceneInputs);
    assert.equal(new Set(variants.outputs.map(v => v.hash)).size, 10);
    assert.ok(variants.outputs.every(v => v.identical && v.bytes > 0));
    assert.deepEqual(variants.selected, variants.repeat);
    const sides = await page.evaluate(async saved => {
      const chosen = Array.from({ length: 100 }, (_, i) => HoopWireScenes.actionDesign(`story-${i}`).side),
        pairs = [];
      for (const variant of HoopWireScenes.actionVariants) {
        const right = HoopWireScenes.actionDesign(saved.seed, variant, 'right'),
          left = HoopWireScenes.actionDesign(saved.seed, variant, 'left');
        const images = [];
        for (const action of [right, left]) {
          const scene = structuredClone(saved);
          scene.action = action;
          scene.attackDirection = action.side;
          scene.pose = action.pose;
          const image = await HoopWireScenes.render(scene);
          images.push(
            Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await image.imageBlob.arrayBuffer()))).join(
              ','
            )
          );
        }
        pairs.push({ right, left, distinct: images[0] !== images[1] });
      }
      return { chosen, pairs };
    }, action.sceneInputs);
    assert.deepEqual([...new Set(sides.chosen)].sort(), ['left', 'right']);
    for (const pair of sides.pairs) {
      assert.ok(pair.distinct);
      assert.equal(pair.left.subject[0] + pair.right.subject[0], 1024);
      assert.equal(pair.left.camera[0] + pair.right.camera[0] + pair.left.camera[2], 1024);
      assert.equal(pair.left.frame, pair.right.frame);
      if (pair.left.flightBall) assert.equal(pair.left.flightBall[0] + pair.right.flightBall[0], 1024);
    }
    assert.deepEqual(variants.palette['226,150,0'], [18, 171, 52]);
    assert.deepEqual(variants.palette['230,50,0'], [35, 16, 69]);
    assert.deepEqual(variants.palette['227,200,0'], [112, 255, 156]);
    assert.deepEqual(variants.palette['228,255,0'], [230, 255, 29]);
    assert.ok(
      variants.outputs.find(v => v.variant === 'three-point').subject[0] < 639,
      'Shooter must stand behind the native three-point arc'
    );
    const details = await page.evaluate(async saved => {
      const ball = document.createElement('canvas');
      ball.width = ball.height = 8;
      HoopWirePlayer.drawBall(ball);
      const bp = ball.getContext('2d').getImageData(0, 0, 8, 8).data;
      const center = Array.from(bp.slice((4 * 8 + 4) * 4, (4 * 8 + 4) * 4 + 3));
      const scene = structuredClone(saved);
      scene.action = HoopWireScenes.actionDesign(scene.seed, 'drive', 'right');
      scene.pose = 'dribbling';
      scene.action.support[4] = [810, 210];
      const r = await HoopWireScenes.render(scene),
        bitmap = await createImageBitmap(r.imageBlob);
      const actual = document.createElement('canvas');
      actual.width = 768;
      actual.height = 432;
      actual.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close();
      const floor = await HoopWireCourt.render(scene.home, { includeHoops: false });
      const layer = document.createElement('canvas');
      layer.width = 1024;
      layer.height = 512;
      floor.hoopLayers.forEach(h => h.draw(layer.getContext('2d')));
      const expected = document.createElement('canvas');
      expected.width = 768;
      expected.height = 432;
      const e = expected.getContext('2d');
      e.imageSmoothingEnabled = false;
      e.drawImage(layer, 510, 94, 384, 216, 0, 0, 768, 432);
      const ap = actual.getContext('2d').getImageData(0, 0, 768, 432).data,
        ep = e.getImageData(0, 0, 768, 432).data;
      let checked = 0,
        covered = 0;
      for (let y = 148; y < 232; y++)
        for (let x = 568; x < 632; x++) {
          const i = (y * 768 + x) * 4;
          if (ep[i + 3] === 255) {
            checked++;
            if (ap[i] !== ep[i] || ap[i + 1] !== ep[i + 1] || ap[i + 2] !== ep[i + 2]) covered++;
          }
        }
      return { center, checked, covered, dunk: HoopWireScenes.actionDesign(scene.seed, 'dunk', 'right') };
    }, action.sceneInputs);
    assert.deepEqual(details.center, [68, 34, 15], 'Native seam must cross the ball interior');
    assert.ok(details.checked > 20);
    assert.equal(details.covered, 0, 'Rear player must not paint over opaque hoop pixels');
    assert.equal(details.dunk.frame, 0, 'Preserve the original user-preferred dunk pose');
    assert.ok(details.dunk.subject[0] <= 778, 'Keep the dunker farther from the rim');
    assert.equal(action.customCourt.status, 'loaded');
    assert.equal(action.customCourt.width, 1024);
    assert.ok(interview.sceneInputs.coach.isCoach);
    assert.ok(interview.sceneInputs.teammates.length);
    assert.equal(action.sceneInputs.opponents.length, 3);
    assert.equal(action.sceneInputs.teammates.length, 2);
    assert.ok(interview.paragraphs.some(p => p.includes(`coach ${interview.coach.fn} ${interview.coach.ln} said`)));
    assert.ok(interview.sceneInputs.teammates.every(p => p.id !== interview.playerId));
    const studio = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      const l = (await a.all('leagues'))[0];
      a.db.close();
      return Object.values(l.studios)[0];
    });
    assert.equal(studio.adsStatus, 'loaded');
    assert.equal(studio.adsWidth, 1024);
    assert.equal(studio.inputs.hostSource, 'hoopwire');
    assert.deepEqual(
      studio.inputs.announcers.map(p => p.id),
      [0, 1, 2, 3].map(i => `hoopwire-host-${i}`)
    );
    assert.ok(!studio.inputs.announcers.some(p => p.fn === 'Saved'));
    const sameHosts = await page.evaluate(
      () =>
        HoopWireTV.inputs({ leagueName: 'Other', media: [{ fn: 'Different', ln: 'Host', appearance: {} }], teams: [] })
          .announcers
    );
    assert.deepEqual(sameHosts, studio.inputs.announcers);
    const card = s =>
      page.locator('.article-card').filter({ has: page.getByRole('heading', { name: s.headline, exact: true }) });
    await page.evaluate(id => (location.hash = '#story/' + encodeURIComponent(id)), action.id);
    await card(action).screenshot({ path: path.join(root, 'artifacts/custom-action.png') });
    await page.evaluate(id => (location.hash = '#story/' + encodeURIComponent(id)), interview.id);
    await card(interview).screenshot({ path: path.join(root, 'artifacts/group-interview.png') });
    // Refresh an older scene without changing its text, statistics, or creation date.
    const original = stories[0];
    await page.evaluate(async id => {
      const a = await new HoopWireArchive().open();
      const s = await a.get('stories', id);
      s.sceneInputs.version = 1;
      delete s.sceneInputs.teammates;
      delete s.sceneInputs.coach;
      await a.write({ stories: [s] });
      a.db.close();
    }, original.id);
    await page.reload();
    await ready(page);
    await load(page, custom);
    await page.locator('#refreshImagesButton').evaluate(b => b.click());
    await ready(page);
    assert.match(await page.locator('#status').textContent(), /^Refreshed/);
    const refreshed = (await getStories(page)).find(s => s.id === original.id);
    assert.deepEqual(refreshed.paragraphs, original.paragraphs);
    assert.deepEqual(refreshed.playerStats, original.playerStats);
    assert.equal(refreshed.createdAt, original.createdAt);
    assert.ok(refreshed.sceneInputs.coach);
    assert.equal(refreshed.sceneInputs.version, 17);
    await page.locator('.nav a[href="#tv"]').click();
    await page.locator('#tv').screenshot({ path: path.join(root, 'artifacts/tv-with-ads.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, 'artifacts/tv-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    // A failed URL is an explicit fallback and does not taint the saved PNG.
    await page.route('https://missing-court.invalid/**', route => route.abort());
    const fallback = await page.evaluate(async scene => {
      scene.home.court.overlayURL = 'https://missing-court.invalid/image.png';
      const result = await HoopWireScenes.render(scene);
      return { court: result.customCourt, caption: result.imageCaption, bytes: result.imageBlob.size };
    }, action.sceneInputs);
    assert.equal(fallback.court.status, 'unavailable');
    assert.doesNotMatch(fallback.caption, /assets|unavailable|Composed/);
    assert.ok(fallback.bytes > 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      'Scene checks passed: custom overlay and ads, exclusive hosts, group interview and coach quotes, image refresh without text changes, URL fallback, TV navigation, and mobile layout.'
    );
    if (process.argv[2]) {
      const actual = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
      const real = await browser.newContext({ viewport: { width: 1100, height: 1000 } }),
        p = await real.newPage();
      await p.goto(url);
      await ready(p);
      await load(p, actual);
      await generate(p);
      const stories = await getStories(p),
        actions = stories.filter(s => s.sceneInputs.kind === 'action');
      const loaded = actions.filter(s => s.customCourt.status === 'loaded');
      assert.ok(loaded.length, 'No real custom court URL loaded');
      const card = s =>
        p.locator('.article-card').filter({ has: p.getByRole('heading', { name: s.headline, exact: true }) });
      await card(loaded[0]).screenshot({ path: path.join(root, 'artifacts/uba-custom-action.png') });
      const previews = await p.evaluate(async saved => {
        const result = [];
        for (const variant of HoopWireScenes.actionVariants)
          for (const side of ['left', 'right']) {
            const s = structuredClone(saved);
            s.action = HoopWireScenes.actionDesign(s.seed, variant, side);
            s.pose = s.action.pose;
            const r = await HoopWireScenes.render(s);
            const data = await new Promise(resolve => {
              const f = new FileReader();
              f.onload = () => resolve(f.result);
              f.readAsDataURL(r.imageBlob);
            });
            result.push({ variant: `${variant}-${side}`, data });
          }
        return result;
      }, loaded[0].sceneInputs);
      for (const preview of previews)
        fs.writeFileSync(
          path.join(root, `artifacts/action-${preview.variant}.png`),
          Buffer.from(preview.data.split(',')[1], 'base64')
        );
      const group = stories.find(s => s.sceneInputs.kind === 'interview');
      await page.evaluate(id => (location.hash = '#story/' + encodeURIComponent(id)), group.id);
      await card(group).screenshot({ path: path.join(root, 'artifacts/uba-group-interview.png') });
      await p.locator('.nav a[href="#tv"]').click();
      await p.locator('#tv').screenshot({ path: path.join(root, 'artifacts/uba-tv.png') });
      const adsStatus = await p.evaluate(async () => {
        const a = await new HoopWireArchive().open();
        const l = (await a.all('leagues'))[0];
        a.db.close();
        const s = Object.values(l.studios)[0];
        return `${s.adsStatus} (${s.adsWidth}x${s.adsHeight})`;
      });
      console.log(
        `Real custom save: ${loaded.length}/${actions.length} action scenes loaded custom courts; studio ads ${adsStatus}; ${stories.length} archived recaps.`
      );
      await real.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
