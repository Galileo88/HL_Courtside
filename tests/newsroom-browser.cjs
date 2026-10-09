const { seasonSamplePath, launchBrowser } = require('./helpers.cjs');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const root = path.resolve(__dirname, '..'),
  save = JSON.parse(fs.readFileSync(seasonSamplePath, 'utf8'));
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page
      .locator('#saveFile')
      .setInputFiles({ name: 'league.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page.locator('.wire-lead').waitFor();
    assert.equal(await page.locator('.article-card:visible').count(), 0);
    const ids = await page.locator('[data-story-id]').evaluateAll(nodes => nodes.map(n => n.dataset.storyId));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(
      new Set(await page.locator('[data-story-id]').evaluateAll(nodes => nodes.map(n => n.dataset.leagueId))).size,
      2
    );
    await page.waitForFunction(() => document.querySelector('.wire-product-art')?.dataset.ready === 'true');
    await page.locator('.wire-sidebar').screenshot({ path: path.join(root, 'artifacts/newsroom-sidebar-ads.png') });
    for (const product of [
      'suit',
      'drink',
      'movie-drama',
      'movie-thriller',
      'shoes',
      'airways',
      'streaming',
      'food',
      'apparel',
      'automotive',
      'beer',
    ]) {
      await page.evaluate(product => {
        const demo = HoopWireNewsroomPromos.render({ product });
        demo.id = 'ad-preview';
        demo.style.width = '300px';
        document.body.append(demo);
      }, product);
      await page.waitForFunction(
        () => document.querySelector('#ad-preview .wire-product-art')?.dataset.ready === 'true'
      );
      await page.waitForFunction(() =>
        [...document.querySelectorAll('#ad-preview img')].every(img => img.complete && img.naturalWidth > 0)
      );
      if (product === 'beer')
        assert.equal(await page.locator('#ad-preview .wire-ad-responsibility').textContent(), 'Drink responsibly.');
      await page.locator('#ad-preview').screenshot({ path: path.join(root, `artifacts/${product}-ad-preview.png`) });
      await page.locator('#ad-preview').evaluate(e => e.remove());
    }
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.wire-image')].every(i => i.tagName !== 'IMG' || i.complete)
    );
    await page.screenshot({ path: path.join(root, 'artifacts/newsroom-home-desktop.png'), fullPage: true });
    assert.equal(await page.locator('.wire-tv-airtime').textContent(), 'Nightly · 10 PM');
    assert.equal(await page.locator('.wire-tv button').textContent(), 'Watch Now!');
    assert.equal(await page.locator('.wire-tv-logo').getAttribute('src'), 'assets/brand/hoopwire_logo.png');
    await page.locator('.wire-tv').screenshot({ path: path.join(root, 'artifacts/tv-show-promo-desktop.png') });
    const spacing = await page.evaluate(() => {
      const lead = document.querySelector('.wire-lead').getBoundingClientRect(),
        support = document.querySelector('.wire-supporting').getBoundingClientRect(),
        section = document.querySelector('.wire-section').getBoundingClientRect(),
        opening = document.querySelector('.wire-opening').getBoundingClientRect();
      return {
        leadGap: support.top - lead.bottom,
        sectionGap: section.top - opening.bottom,
        sectionWidth: section.width,
        openingWidth: opening.width,
      };
    });
    assert.ok(Math.abs(spacing.leadGap - 24) < 1);
    assert.ok(Math.abs(spacing.sectionGap - 28) < 1);
    assert.ok(Math.abs(spacing.sectionWidth - spacing.openingWidth) < 1);
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.locator('.wire-sidebar .wire-tv-ad').isVisible(), true);
      const gap = await page.evaluate(
        () =>
          document.querySelector('.wire-opening').getBoundingClientRect().bottom -
          document.querySelector('.wire-supporting').getBoundingClientRect().bottom
      );
      assert.ok(gap <= 24, `Featured trailing space at ${width}: ${gap}`);
    }
    await page.locator('.wire-lead').focus();
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement.matches('.wire-supporting a')));
    await page.locator('.wire-headlines a').first().focus();
    assert.equal(
      await page
        .locator('.wire-headlines a')
        .first()
        .evaluate(e => getComputedStyle(e).outlineStyle),
      'solid'
    );
    const href = await page.locator('.wire-lead').getAttribute('href'),
      leagueHref = await page.locator('#leagueButtons a').first().getAttribute('href');
    await page.locator('.wire-lead').click();
    await page.locator('.article-card:visible').waitFor();
    assert.match(new URL(page.url()).hash, /^#story\//);
    assert.equal(await page.locator('.article-card:visible').count(), 1);
    await page.locator('.article-back').click();
    await page.locator('.wire-lead').waitFor();
    await page.evaluate(() => scrollTo(0, 350));
    await page.locator('.wire-supporting a').first().click();
    await page.locator('.article-back').click();
    await page.waitForFunction(() => scrollY >= 340);
    await page.locator('.wire-supporting a').first().click();
    await page.goBack();
    await page.locator('.wire-lead').waitFor();
    await page.waitForFunction(() => scrollY >= 340);
    assert.ok((await page.evaluate(() => scrollY)) >= 340);
    await page.goto(url + '/' + leagueHref);
    await page.locator('.wire-lead').waitFor();
    const leagueIds = await page.locator('[data-story-id]').evaluateAll(nodes => nodes.map(n => n.dataset.leagueId));
    assert.equal(new Set(leagueIds).size, 1);
    await page.screenshot({ path: path.join(root, 'artifacts/newsroom-league-desktop.png'), fullPage: true });
    await page.reload();
    await page.locator('.wire-lead').waitFor();
    assert.equal(await page.locator('#leagueButtons a').count(), 2);
    await page.goto(url + '/#newsroom');
    await page.locator('.wire-lead').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    const leadBox = await page.locator('.wire-lead').boundingBox(),
      headlinesBox = await page.locator('.wire-headlines').boundingBox(),
      supportBox = await page.locator('.wire-supporting').boundingBox();
    assert.ok(Math.abs(leadBox.width - 390) < 1);
    assert.ok(headlinesBox.y >= leadBox.y + leadBox.height);
    assert.ok(supportBox.y >= headlinesBox.y + headlinesBox.height);
    await page.screenshot({ path: path.join(root, 'artifacts/newsroom-home-mobile.png'), fullPage: true });
    await page.screenshot({ path: path.join(root, 'artifacts/newsroom-mobile-viewport.png') });
    const airtimeBox = await page.locator('.wire-tv-airtime').boundingBox(),
      watchBox = await page.locator('.wire-tv button').boundingBox();
    assert.ok(watchBox.x >= airtimeBox.x + airtimeBox.width);
    assert.equal(await page.locator('.wire-tv-episode').count(), 0);
    await page.locator('.wire-tv').screenshot({ path: path.join(root, 'artifacts/tv-show-promo-mobile.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 820, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(root, 'artifacts/newsroom-home-tablet.png'), fullPage: true });
    await page.goto(url + '/' + href);
    await page.locator('.article-card').waitFor();
    await page.reload();
    await page.locator('.article-card').waitFor();
    assert.equal(await page.locator('.article-card:visible').count(), 1);
    await page.goto(url + '/#league-1');
    await page.locator('.wire-lead').waitFor();
    assert.equal(
      new Set(await page.locator('[data-story-id]').evaluateAll(nodes => nodes.map(n => n.dataset.leagueId))).size,
      1
    );
    await page.goto(url + '/#newsroom');
    await page.locator('.wire-tv button').click();
    await page.locator('#tv').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#tvStagePlay').isVisible(), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(root, 'artifacts/tv-navigation-desktop.png'), fullPage: true });
    const previous = await page.locator('#tvPrevious').boundingBox(),
      next = await page.locator('#tvNext').boundingBox(),
      stage = await page.locator('#tvStage').boundingBox();
    assert.ok(Math.abs(previous.width - next.width) < 1);
    assert.ok(Math.abs(previous.x - stage.x) < 1);
    assert.ok(Math.abs(next.x + next.width - stage.x - stage.width) < 1);
    await page.locator('#tvNext').click();
    assert.equal(await page.locator('#tvStagePlay').isVisible(), true);
    await page.locator('#tvPrevious').click();
    assert.equal(await page.locator('#tvStagePlay').isVisible(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(root, 'artifacts/tv-navigation-mobile.png'), fullPage: true });

    await page.goto(url + '/#story/missing');
    await page.getByText('This story is not available in the active archive.', { exact: false }).waitFor();
    await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        const stories = await a.all('stories'),
          chosen = stories.find(s => s.type === 'Season leaders');
        for (const league of await a.all('leagues')) await a.reset(league.id);
        await a.write({
          leagues: [{ id: chosen.fingerprint, name: chosen.leagueName }],
          stories: [{ ...chosen, imageBlob: null }],
        });
        // The open save now covers only that league.
        const [save] = await a.all('saves');
        await a.write({
          saves: [{ ...save, leagueIds: [chosen.fingerprint] }],
          meta: [{ id: 'active-save', save: save.id }],
        });
      } finally {
        a.db.close();
      }
    });
    await page.goto(url + '/#newsroom');
    await page.reload();
    await page.locator('.wire-placeholder').waitFor();
    assert.equal(await page.locator('.wire-card').count(), 1);
    assert.equal(await page.locator('.wire-tv').count(), 0);
    assert.equal(await page.locator('#leagueButtons a').count(), 1);
    await page.locator('.wire-lead').click();
    await page.locator('.article-card').waitFor();
    await page.locator('.article-back').click();
    await page.locator('.wire-placeholder').waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'Front-page browser checks passed: mixed coverage, league filtering, articles, back/scroll, archived refresh, legacy links, responsive layouts and TV.'
    );
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e.stack);
  process.exitCode = 1;
});
