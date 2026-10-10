/* Named saves: create one, update it, refuse files that don't belong to it, keep career saves apart,
   open a save without its file and delete one. */
const { launchBrowser, samplePath } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const base = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    const copy = edit => {
      const save = structuredClone(base);
      edit?.(save);
      return save;
    };
    const choose = async (data, name = 'league.json') => {
      await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
      await page
        .locator('#saveFile')
        .setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    };
    const upload = async data => {
      await choose(data);
      await page.waitForFunction(() => document.getElementById('saveFile').disabled);
      await page.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 300000 });
    };
    const refused = async (data, pattern) => {
      await choose(data);
      await page.locator('#noticeDialog[open]').waitFor();
      assert.match(await page.locator('#noticeText').textContent(), pattern);
      await page.click('#noticeOk');
    };
    const archived = () =>
      page.evaluate(async () => {
        const a = await new HoopWireArchive().open();
        try {
          const [saves, stories] = await Promise.all([a.all('saves'), a.all('stories')]);
          const counts = {};
          for (const s of stories) counts[s.fingerprint] = (counts[s.fingerprint] || 0) + 1;
          return { saves: saves.map(s => ({ name: s.name, mode: s.mode, ids: s.leagueIds })), counts };
        } finally {
          a.db.close();
        }
      });
    const welcome = async () => {
      await page.evaluate(() => (location.hash = '#welcome'));
      await page.locator('#welcome').waitFor();
    };

    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    assert.equal(await page.locator('#loadTitle').textContent(), 'Upload save file');
    assert.equal(await page.locator('#savesCard').isVisible(), false);

    // A file that isn't a Hoop Land save says so, plainly.
    for (const buffer of [Buffer.from('not json'), Buffer.from(JSON.stringify({ leagues: [] }))]) {
      await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
      await page.evaluate(() => (document.getElementById('status').textContent = ''));
      await page.locator('#saveFile').setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer });
      await page.waitForFunction(() => document.getElementById('status').textContent.trim().length > 0);
      assert.equal((await page.locator('#status').textContent()).trim(), 'This is not a Hoop Land save file.');
    }
    assert.deepEqual((await archived()).saves, []);

    // Choose the file: the save takes the pro league's name, and the newsroom opens.
    await upload(base);
    await page.locator('.wire-lead').waitFor();
    const first = await archived();
    assert.deepEqual(first.saves, [
      { name: 'New League', mode: 0, ids: ['hw-smallpro-franchise', 'hw-smallcollege-franchise'] },
    ]);

    // The save keeps the exact file, compressed, and Export hands it back byte for byte.
    const stored = await page.evaluate(async () => {
      const a = await new HoopWireArchive().open();
      try {
        const [file] = await a.all('savefiles');
        return { name: file.name, gzip: file.gzip, bytes: file.data.byteLength };
      } finally {
        a.db.close();
      }
    });
    const original = Buffer.from(JSON.stringify(base));
    assert.equal(stored.name, 'league.json');
    assert.ok(stored.gzip && stored.bytes < original.length / 5, `stored in ${stored.bytes} bytes`);
    await page.evaluate(() => (location.hash = '#welcome'));
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('.saves-list button[aria-label="Export New League, Franchise"]'),
    ]);
    assert.equal(download.suggestedFilename(), 'league.json');
    assert.ok(fs.readFileSync(await download.path()).equals(original), 'the exported file is identical');
    // A backup carries the file too.
    assert.equal(
      await page.evaluate(async () => {
        const a = await new HoopWireArchive().open();
        try {
          return (await a.exportData()).savefiles.length;
        } finally {
          a.db.close();
        }
      }),
      1
    );

    // The welcome screen now updates the open save, and lists it.
    await welcome();
    assert.equal(await page.locator('#loadTitle').textContent(), 'Update save');
    assert.match(
      await page.locator('.saves-list li').textContent(),
      /New League.*Franchise · NL, NL · 2026 · Day \d+ · \d+ stories/
    );

    // Files that don't belong to this save are refused, and say why.
    await refused(
      copy(s => s.seasonLeagues.forEach(l => (l.season.mode = 2))),
      /^This is a Career save, not a Franchise save\.$/
    );
    await refused(
      copy(s => (s.seasonLeagues[0].commissioner.tag = 'hoopwire:hw-someoneelse')),
      /^This file is from a different save\.$/
    );
    await refused(
      copy(s => s.seasonLeagues.pop()),
      /^This file is missing New League\.$/
    );

    // The same league after an expansion team and a renamed team still updates it.
    await upload(
      copy(s => {
        const pro = s.seasonLeagues[0],
          expansion = structuredClone(pro.teams[0]);
        Object.assign(expansion, { id: 999, city: 'Seattle', name: 'Expansion', shortName: 'SEA', roster: [] });
        pro.teams.push(expansion);
        Object.assign(pro.teams[1], { city: 'Moved City', name: 'Renamed', shortName: 'REN' });
      })
    );
    const updated = await archived();
    assert.deepEqual(updated.saves, first.saves);
    assert.deepEqual(Object.keys(updated.counts).sort(), Object.keys(first.counts).sort());
    // A league renamed in Hoop Land keeps its save, and the save takes the new name.
    await upload(copy(s => (s.seasonLeagues[0].leagueName = 'Renamed League')));
    assert.deepEqual(
      (await archived()).saves.map(s => s.name),
      ['Renamed League']
    );
    await upload(base);

    // A second save of the same league in the same mode is refused; a career save gets its own.
    await welcome();
    await page.click('#newSaveButton');
    await refused(base, /^You already have a save for New League\.$/);
    await upload(copy(s => s.seasonLeagues.forEach(l => (l.season.mode = 2))));
    const both = await archived();
    assert.deepEqual(both.saves.map(s => [s.name, s.mode]).sort(), [
      ['New League', 0],
      ['New League', 2],
    ]);
    assert.deepEqual(both.saves.find(s => s.mode === 2).ids, ['hw-smallpro-career', 'hw-smallcollege-career']);
    for (const [id, count] of Object.entries(updated.counts)) assert.equal(both.counts[id], count);
    // The newsroom shows only the open save.
    const shown = async () =>
      new Set(await page.locator('[data-story-id]').evaluateAll(n => n.map(x => x.dataset.storyId.split(':')[0])));
    await page.locator('.wire-lead').waitFor();
    assert.deepEqual([...(await shown())].sort(), ['hw-smallcollege-career', 'hw-smallpro-career']);

    // Open the first save from the list, without its file.
    await welcome();
    await page.click('.saves-list button[aria-label="Open New League, Franchise"]');
    await page.waitForFunction(() => location.hash === '#newsroom');
    await page.locator('.wire-lead').waitFor();
    assert.deepEqual([...(await shown())].sort(), ['hw-smallcollege-franchise', 'hw-smallpro-franchise']);
    // It is still the open save after a reload.
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await welcome();
    assert.match(await page.locator('#loadText').textContent(), /“New League” \(Franchise\)/);
    assert.equal(await page.locator('.saves-list li.is-current strong').textContent(), 'New League');

    // Delete the career save: its stories go, the other save's stay.
    await page.click('.saves-list button[aria-label="Delete New League, Career"]');
    await page.locator('#resetDialog[open]').waitFor();
    assert.match(await page.locator('#resetTitle').textContent(), /Delete the Career save “New League”\?/);
    await page.click('#confirmReset');
    await page.waitForFunction(() => document.querySelectorAll('.saves-list li').length === 1);
    const after = await archived();
    assert.deepEqual(
      after.saves.map(s => [s.name, s.mode]),
      [['New League', 0]]
    );
    assert.equal(after.counts['hw-smallpro-career'], undefined);
    assert.equal(after.counts['hw-smallpro-franchise'], updated.counts['hw-smallpro-franchise']);

    // A file without HoopWire tags still starts a save; its leagues are known by their name and teams.
    const untagged = edit =>
      copy(s => {
        s.seasonLeagues.forEach(l => (l.commissioner.tag = ''));
        edit?.(s);
      });
    await welcome();
    await page.click('#newSaveButton');
    await upload(untagged());
    await page.locator('.wire-lead').waitFor();
    const plain = (await archived()).saves.find(s => !s.ids[0].startsWith('hw-'));
    assert.equal(plain?.name, 'New League');
    assert.equal(plain.ids.length, 2);
    assert.ok(plain.ids.every(id => id.endsWith('-franchise')));
    // The same file updates it; renamed teams make it look like another league.
    await welcome();
    await upload(untagged());
    assert.deepEqual((await archived()).saves.find(s => s.ids[0] === plain.ids[0]).ids, plain.ids);
    await refused(
      untagged(s => (s.seasonLeagues[0].teams[1].name = 'Renamed')),
      /^This file is from a different save\.$/
    );
    assert.deepEqual(errors, []);
    console.log(
      'Save checks passed: named saves, export of the original file, untagged saves, refused different-mode, different-league and duplicate files, updates through an expansion, open without the file, reload and delete.'
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
