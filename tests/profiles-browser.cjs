/* Names in articles open player, coach and team pages built from the uploaded save. */
const { launchBrowser, samplePath } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // An archive from before profiles existed upgrades in place.
    await page.goto(url + '/scripts/');
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('hoopwire.daily.v1', 1);
          req.onupgradeneeded = () => {
            for (const name of ['stories', 'snapshots', 'leagues', 'meta'])
              req.result.createObjectStore(name, { keyPath: 'id' });
          };
          req.onsuccess = () => {
            req.result.close();
            resolve();
          };
          req.onerror = () => reject(req.error);
        })
    );
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page.locator('#saveFile').setInputFiles(samplePath);
    await page.waitForFunction(() => document.getElementById('saveFile').disabled);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 180000 });
    const stored = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        const [profiles, leagues, stories] = await Promise.all([a.all('profiles'), a.all('leagues'), a.all('stories')]);
        return {
          kinds: [...new Set(profiles.map(p => p.kind))].sort(),
          indexed: leagues.every(l => l.people?.length > 0),
          story: stories.find(s => s.gid && s.paragraphs.length > 3 && /coach/.test(s.paragraphs.join(' '))).id,
        };
      } finally {
        a.db.close();
      }
    });
    assert.deepEqual(stored.kinds, ['coach', 'player', 'team']);
    assert.ok(stored.indexed);

    const openStory = async () => {
      await page.evaluate(id => (location.hash = '#story/' + encodeURIComponent(id)), stored.story);
      await page.waitForSelector('.article-body .entity-link');
    };
    await openStory();
    const hrefs = await page.$$eval('.article-body .entity-link', as => as.map(a => a.getAttribute('href')));
    assert.equal(new Set(hrefs).size, hrefs.length, 'each name links once');
    assert.ok(hrefs.some(h => h.startsWith('#player/')) && hrefs.some(h => h.startsWith('#team/')));
    assert.equal(await page.locator('.article-headline .entity-link').count(), 0);
    // Names in the story's stat cards open the same pages.
    assert.ok((await page.locator('.article-body .tv-board .board-link[href^="#player/"]').count()) > 0);

    // Players and coaches get a portrait in the game's sprite; it has to actually draw.
    const portrait = async name => {
      await page.waitForFunction(() => {
        const c = document.querySelector('.profile-portrait');
        if (!c) return false;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let filled = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) filled++;
        return filled > 1000;
      });
      await page
        .locator('.profile-header')
        .screenshot({ path: path.join(root, `artifacts/profile-${name}-header.png`) });
    };
    await page.click('.article-body .entity-link[href^="#player/"]');
    await page.waitForSelector('.profile-header');
    await portrait('player');
    assert.deepEqual(await page.locator('.profile-portrait').evaluate(c => [c.clientWidth, c.clientHeight]), [95, 90]);
    // On a phone the portrait keeps four screen pixels per sprite pixel beside the name.
    const desktop = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.deepEqual(await page.locator('.profile-portrait').evaluate(c => [c.clientWidth, c.clientHeight]), [76, 72]);
    await page
      .locator('.profile-header')
      .screenshot({ path: path.join(root, 'artifacts/profile-player-header-mobile.png') });
    await page.setViewportSize(desktop);
    const player = await page.textContent('.profile');
    // College players read by class; pros by years in the league.
    const profileLines = await page.locator('.profile-line').allTextContents();
    assert.match(profileLines[0], / · (?:Fr\.|So\.|Jr\.|Sr\.|Rookie|Years Pro: (?:[2-9]|\d{2,}))$/);
    assert.doesNotMatch(player, /college season|pro season|Freshman|Years Pro: 1\b/);
    // Heights read 6'4".
    assert.match(profileLines[1], /^\d'\d{1,2}" · /);
    assert.match(player, /Player ·/);
    assert.match(player, /Game log/);
    assert.doesNotMatch(player, /Latest game/);
    assert.match(player, /Career/);
    assert.match(player, /In the news/);
    assert.doesNotMatch(player, /rating|potential|undefined|NaN/i);
    await page.click('.article-back');
    await page.waitForSelector('.article-body .entity-link');
    assert.match(page.url(), /#story\//);

    if (hrefs.some(h => h.startsWith('#coach/'))) {
      await page.click('.article-body .entity-link[href^="#coach/"]');
      await page.waitForSelector('.profile-header');
      await portrait('coach');
      assert.match(await page.textContent('.profile'), /Head coach[\s\S]*Coaching record/);
      await openStory();
    }
    await page.click('.article-body .entity-link[href^="#team/"]');
    await page.waitForSelector('.profile-header');
    const team = await page.textContent('.profile');
    assert.equal(await page.locator('.profile-portrait').count(), 0);
    assert.match(team, /Team ·[\s\S]*team stats[\s\S]*League rank[\s\S]*Roster[\s\S]*Results/i);
    // Roster names open player pages.
    await page.click('.profile .board-link[href^="#player/"]');
    await page.waitForFunction(() =>
      /^Player/.test(document.querySelector('.profile .article-meta')?.textContent || '')
    );
    assert.match(await page.textContent('.profile'), /Player ·/);

    // A pro rookie, a third-year pro and a college freshman from the save.
    for (const [hash, label] of [
      ['#player/hw-smallpro-franchise/38', 'Rookie'],
      ['#player/hw-smallpro-franchise/2', 'Years Pro: 3'],
      ['#player/hw-smallcollege-franchise/6', 'Fr.'],
    ]) {
      await page.evaluate(h => (location.hash = h), hash);
      await page.waitForFunction(h => location.hash === h && document.querySelector('.profile-line'), hash);
      // The experience ends the first line, after the team.
      const first = (await page.locator('.profile-line').first().textContent()).trim();
      assert.ok(first.endsWith(` · ${label}`), `${hash}: ${first}`);
      // Positions are abbreviated, and the experience never splits across lines.
      assert.match(first, /^#\d+ · (?:PG|G|SG|G\/F|SF|F|PF|F\/C|C) · /);
      assert.equal(await page.locator('.profile-line .profile-nowrap').evaluate(e => e.getClientRects().length), 1);
    }
    // A missing profile says so instead of breaking.
    await page.evaluate(() => (location.hash = '#player/nope/1'));
    await page.waitForSelector('.panel.muted');
    assert.match(await page.textContent('.panel.muted'), /not in the archive/);

    // Backups carry profiles.
    const backup = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        return (await a.exportData()).profiles.length;
      } finally {
        a.db.close();
      }
    });
    assert.ok(backup > 0);
    assert.deepEqual(errors, []);
    console.log(
      'Profile checks passed: first-mention links, player, coach and team pages, back navigation, upgrade and backup.'
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
