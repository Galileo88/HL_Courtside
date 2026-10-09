const { samplePath, launchBrowser, expectedStoryCount } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const C = require('../js/coverage/core.js');
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0])
  );
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'Content-Type',
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.json': 'application/json',
    }[path.extname(file)] || 'text/plain'
  );
  fs.createReadStream(file).pipe(res);
});
async function openArchive(page) {
  await page.locator('#siteMenuButton').click();
  await page.locator('#siteMenu a[href="#archive"]').click();
}
async function ready(page) {
  await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
}
async function upload(page, data) {
  await page
    .locator('#saveFile')
    .setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await ready(page);
  assert.equal(new URL(page.url()).hash, '#newsroom');
  assert.match(await page.locator('#status').textContent(), /^Save loaded/);
}
// Starts another named save from the welcome screen.
async function newSave(page, data, name) {
  await page.evaluate(() => (location.hash = '#welcome'));
  await page.locator('#newSaveButton').click();
  await page.locator('#saveName').fill(name);
  await upload(page, data);
}
async function openSave(page, name) {
  await page.evaluate(() => (location.hash = '#welcome'));
  await page.locator(`.saves-list button[aria-label="Open ${name}"]`).click();
  await page.waitForFunction(() => location.hash === '#newsroom');
  await ready(page);
}
async function records(page, store = 'stories') {
  const rows = await page.evaluate(async name => {
    const a = await new HoopWireArchive().open();
    try {
      const rows = await a.all(name);
      if (name !== 'stories') return rows;
      return await Promise.all(
        rows.map(async s => ({
          ...s,
          imageBlob: undefined,
          imageBytes: s.imageBlob ? Array.from(new Uint8Array(await s.imageBlob.arrayBuffer())) : null,
        }))
      );
    } finally {
      a.db.close();
    }
  }, store);
  // Compare the JSON backup representation: undefined optional fields do not survive export.
  return JSON.parse(JSON.stringify(rows));
}
async function openPage(browser, url, seed) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  if (seed) await context.addInitScript(s => localStorage.setItem('hoopwire.archive.v1', JSON.stringify(s)), seed);
  const page = await context.newPage();
  await page.goto(url);
  await ready(page);
  return { page, context };
}
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const { page, context } = await openPage(browser, url),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    assert.equal(await page.locator('.menu-action[href="#newsroom"]').count(), 0);
    assert.equal(await page.locator('.menu-action[href="#archive"]').count(), 0);
    await page.goto(url + '/#newsroom');
    await ready(page);
    assert.equal(new URL(page.url()).hash, '#welcome');
    await page.goto(url + '/#archive');
    await ready(page);
    assert.equal(new URL(page.url()).hash, '#welcome');
    assert.equal(await page.locator('.nav').isVisible(), false);
    assert.equal(await page.locator('#coverageSelect,#quoteToggle,#generateButton').count(), 0);
    await page.screenshot({ path: path.join(root, 'artifacts/welcome-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(root, 'artifacts/welcome-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await upload(page, sample);
    assert.equal(await page.locator('#newsroomLeague option').count(), sample.seasonLeagues.length);
    // Both test leagues are called New League, so each league's link is found by its address.
    const leagueLink = league =>
      page.locator(`#leagueButtons a[href="#league/${encodeURIComponent(C.buildFingerprint(league))}"]`);
    await leagueLink(sample.seasonLeagues[1]).click();
    assert.ok((await page.locator('.wire-card:visible').count()) > 0);
    await page.waitForFunction(
      id => [...document.querySelectorAll('[data-league-id]')].every(n => n.dataset.leagueId === id),
      C.buildFingerprint(sample.seasonLeagues[1])
    );
    assert.equal(await page.locator('.article-card:visible').count(), 0);
    await leagueLink(sample.seasonLeagues[0]).click();
    const original = await records(page);
    const expected = expectedStoryCount(sample);
    assert.equal(original.length, expected);
    assert.ok(original.every(s => s.imageBytes.length && (s.gameSummary || s.seasonSnapshot || s.performanceSnapshot)));
    assert.equal(await page.locator('#archive').isVisible(), false);
    await upload(page, sample);
    assert.deepEqual(await records(page), original);
    await openArchive(page);
    await page.locator('#feed').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#archiveTitle').textContent(), sample.seasonLeagues[0].leagueName + ' Archive');
    assert.equal(await page.locator('#archive .controls:visible').count(), 0);
    const team = page.locator('.archive-team').first();
    await team.locator(':scope > summary').click();
    await team.locator('.archive-year > summary').first().click();
    await team.locator('button').filter({ hasText: 'Read stories' }).first().click();
    assert.equal(new URL(page.url()).hash, '#stories');
    assert.ok((await page.locator('.article-card:visible').count()) > 0);
    await page.locator('a[href="#archive"]').last().click();
    await team.locator('button').filter({ hasText: 'Watch TV' }).first().click();
    assert.equal(new URL(page.url()).hash, '#tv');
    assert.equal(await page.locator('#tvStagePlay').isVisible(), true);
    assert.ok((await page.locator('#tvSegment .tv-story-kicker').count()) > 0);
    assert.ok((await page.locator('#tvSegment h2').textContent()).trim().length > 0);
    assert.equal(await page.locator('#archive').isVisible(), false);
    await openArchive(page);
    await page.locator('#archive').screenshot({ path: path.join(root, 'artifacts/archive-tree.png') });
    await page.locator('#resetArchive').click();
    await page.locator('#cancelReset').click();
    assert.deepEqual(await records(page), original);
    const later = structuredClone(sample),
      l = later.seasonLeagues[0],
      g = structuredClone(
        l.season.schedule
          .flatMap(d => d.results || [])
          .filter(r => r.winner && l.teams.some(t => t.id === r.winner))
          .at(-1)
      );
    g.gId = 90001;
    g.homeScore += 5;
    l.season.schedule.push({ results: [g] });
    l.teams.find(t => t.id === g.winner).roster[0].appearance.hairC = '00FF00';
    await upload(page, later);
    const expanded = await records(page),
      recap = expanded.find(s => s.gid === 90001);
    assert.equal(recap.playerStats, null);
    assert.equal(recap.sceneInputs.kind, 'action');
    assert.deepEqual(
      expanded.filter(s => original.some(o => o.id === s.id)),
      original
    );
    const upgradedSave = structuredClone(later);
    upgradedSave.seasonLeagues[0].teams.find(t => t.id === g.winner).roster[0].gameStats.PTS += 5;
    await upload(page, upgradedSave);
    const upgraded = await records(page);
    assert.ok(upgraded.find(s => s.gid === 90001).playerStats);
    assert.deepEqual(
      upgraded.filter(s => original.some(o => o.id === s.id)),
      original
    );
    const rollover = structuredClone(sample);
    rollover.seasonLeagues[0].season.currentYear = 2027;
    await upload(page, rollover);
    let all = await records(page);
    assert.deepEqual(
      all.filter(s => s.season !== 2027),
      upgraded
    );
    // A different league is a save of its own.
    const different = structuredClone(sample);
    different.seasonLeagues = [different.seasonLeagues[0]];
    different.seasonLeagues[0].leagueName = 'Separate League';
    different.seasonLeagues[0].commissioner.tag = 'hoopwire:hw-separate';
    const otherId = C.buildFingerprint(different.seasonLeagues[0]);
    await newSave(page, different, 'Separate');
    assert.deepEqual(
      (await records(page)).filter(s => s.fingerprint !== otherId),
      all
    );
    await openArchive(page);
    assert.equal(await page.locator('#archiveTitle').textContent(), 'Separate League Archive');
    assert.equal(await page.locator('#archiveLeague option').count(), 1);
    assert.ok(
      await page
        .locator('.archive-team')
        .evaluateAll((nodes, id) => nodes.every(n => n.dataset.key.startsWith(id + ':')), otherId)
    );
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('#archiveTitle').textContent(), 'Separate League Archive');
    assert.equal(await page.locator('#archiveLeague option').count(), 1);
    const scoped = await page.evaluate(async id => {
      const a = await new HoopWireArchive().open();
      try {
        return await a.exportData(id);
      } finally {
        a.db.close();
      }
    }, otherId);
    assert.ok(scoped.stories.every(s => s.fingerprint === otherId));
    assert.equal(scoped.leagues.length, 1);
    const emptyLeague = structuredClone(different);
    emptyLeague.seasonLeagues[0].leagueName = 'League Without Coverage';
    emptyLeague.seasonLeagues[0].commissioner.tag = 'hoopwire:hw-empty';
    emptyLeague.seasonLeagues[0].season.schedule = [];
    emptyLeague.seasonLeagues[0].season.news = [];
    emptyLeague.seasonLeagues[0].season.totalGames = 0;
    emptyLeague.seasonLeagues[0].season.playoffs = [];
    for (const t of emptyLeague.seasonLeagues[0].teams) delete t.championships;
    await newSave(page, emptyLeague, 'Empty');
    assert.equal(await page.locator('#siteMenu a[href="#archive"]').getAttribute('aria-disabled'), 'true');
    await page.evaluate(() => (location.hash = '#archive'));
    await page.waitForFunction(() => location.hash === '#welcome');
    // Back to the first save, opened from the list, then updated.
    await openSave(page, `${sample.seasonLeagues[0].shortName} Franchise`);
    await upload(page, rollover);
    all = await records(page);
    await page.reload();
    await ready(page);
    assert.deepEqual(await records(page), all);
    const backup = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        return JSON.parse(JSON.stringify(await a.exportData()));
      } finally {
        a.db.close();
      }
    });
    const fresh = await openPage(browser, url);
    await fresh.page.locator('#importFile').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await ready(fresh.page);
    await fresh.page.goto(url + '/#archive');
    await ready(fresh.page);
    assert.deepEqual(await records(fresh.page), all);
    const roundtrip = await fresh.page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        return JSON.parse(JSON.stringify(await a.exportData()));
      } finally {
        a.db.close();
      }
    });
    assert.deepEqual(roundtrip, backup);
    const invalid = structuredClone(backup);
    invalid.stories[0].day = -1;
    await fresh.page
      .locator('#importFile')
      .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
    await ready(fresh.page);
    assert.match(await fresh.page.locator('#status').textContent(), /invalid article/);
    assert.deepEqual(await records(fresh.page), all);
    await fresh.page.evaluate(() => {
      window.savedReset = HoopWireArchive.prototype.resetAll;
      HoopWireArchive.prototype.resetAll = async () => {
        throw Error('Reset storage failure');
      };
    });
    await fresh.page.locator('#resetArchive').click();
    await fresh.page.locator('#confirmReset').click();
    await ready(fresh.page);
    assert.match(await fresh.page.locator('#status').textContent(), /Reset storage failure/);
    assert.deepEqual(await records(fresh.page), all);
    const resetLeague = await fresh.page.locator('#archiveLeague').inputValue();
    const beforeSnaps = await records(fresh.page, 'snapshots'),
      beforeLeagues = await records(fresh.page, 'leagues');
    await fresh.page.evaluate(() => (HoopWireArchive.prototype.resetAll = window.savedReset));
    await fresh.page.locator('#resetArchive').click();
    await fresh.page.locator('#confirmReset').click();
    await ready(fresh.page);
    assert.ok(resetLeague && beforeSnaps.length && beforeLeagues.length > 1);
    assert.deepEqual(await records(fresh.page), []);
    assert.deepEqual(await records(fresh.page, 'snapshots'), []);
    assert.deepEqual(await records(fresh.page, 'leagues'), []);
    await fresh.page.reload();
    await ready(fresh.page);
    assert.deepEqual(await records(fresh.page), []);
    await fresh.context.close();
    const legacy = { ...original[0] };
    delete legacy.imageBytes;
    delete legacy.imageBlob;
    delete legacy.gameSummary;
    delete legacy.sceneInputs;
    legacy.paragraphs = ['Original archived wording.'];
    legacy.templateVersion = 2;
    const migrated = await openPage(browser, url, { [legacy.id]: legacy });
    assert.equal((await records(migrated.page))[0].paragraphs[0], 'Original archived wording.');
    // A reset clears the migrated stories and never brings the old copy back. (Stories from the old
    // format belong to no named save, so this resets the archive directly.)
    await migrated.page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        await a.resetAll();
      } finally {
        a.db.close();
      }
    });
    await migrated.page.reload();
    await ready(migrated.page);
    assert.equal((await records(migrated.page)).length, 0);
    assert.ok(await migrated.page.evaluate(() => localStorage.getItem('hoopwire.archive.v1')));
    await migrated.context.close();
    const failure = await openPage(browser, url);
    await failure.page.evaluate(() => {
      HoopWireArchive.prototype.write = async () => {
        throw Error('Storage quota exceeded');
      };
    });
    await failure.page
      .locator('#saveFile')
      .setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sample)) });
    await ready(failure.page);
    assert.match(await failure.page.locator('#status').textContent(), /Storage quota exceeded/);
    assert.equal((await records(failure.page)).length, 0);
    await failure.context.close();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      'Browser checks passed: automatic Full coverage in all leagues, always-on quotes, repeat uploads, frozen images/stats, current-day upgrades, rollover, nested team/year/day navigation, historical TV, backups, migration, reset cancellation/failure/success, legacy reset persistence, and storage errors.'
    );
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
