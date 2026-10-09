/* A league keeps its archive when it gains a Hoop League Studio ID, an expansion team or a renamed team,
   and a career save of the same league never shares it. */
const { launchBrowser, samplePath } = require('./helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.HOOPWIRE_URL || 'http://127.0.0.1:8123';

const upload = async (page, data, name) => {
  await page
    .locator('#saveFile')
    .setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.waitForFunction(() => document.getElementById('saveFile').disabled);
  await page.waitForFunction(() => !document.getElementById('saveFile').disabled, null, { timeout: 180000 });
  assert.equal(await page.locator('#status').textContent(), 'Save loaded.');
};
const archived = page =>
  page.evaluate(async () => {
    const a = await new HoopWireArchive().open();
    try {
      const [leagues, stories] = await Promise.all([a.all('leagues'), a.all('stories')]);
      const counts = {};
      for (const s of stories) counts[s.fingerprint] = (counts[s.fingerprint] || 0) + 1;
      return {
        leagues: leagues.map(l => ({ id: l.id, name: l.name })),
        fingerprints: [...new Set(stories.map(s => s.fingerprint))],
        counts,
      };
    } finally {
      a.db.close();
    }
  });

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    const save = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    await upload(page, save, 'HL_LEAGUE_SAVE_FILE_01');
    const before = await archived(page);
    assert.equal(before.leagues.length, 2);

    const ids = async () => (await archived(page)).leagues.map(l => l.id).sort();
    const same = async () => {
      const after = await archived(page);
      assert.deepEqual(after.leagues.map(l => l.id).sort(), before.leagues.map(l => l.id).sort());
      assert.deepEqual(after.fingerprints.sort(), before.fingerprints.sort());
    };

    // Studio stamps an ID on the pro league: it keeps the archive it already had.
    const pro = save.seasonLeagues[0];
    pro.commissioner.tag = 'hoopwire:hw-a10d6139c4b6';
    await upload(page, save, 'HL_LEAGUE_SAVE_FILE_01');
    await same();

    // The pro league expands and one of its teams relocates under a new name.
    const expansion = structuredClone(pro.teams[0]);
    Object.assign(expansion, { id: 999, city: 'Seattle', name: 'Expansion', shortName: 'SEA', roster: [] });
    pro.teams.push(expansion);
    Object.assign(pro.teams[1], { city: 'Moved City', name: 'Renamed', shortName: 'REN' });
    await upload(page, save, 'HL_LEAGUE_SAVE_FILE_01');
    await same();

    // The same league under another ID is a separate league.
    pro.commissioner.tag = 'hoopwire:hw-000000000001';
    await upload(page, save, 'OTHER_SAVE_FILE_02');
    assert.equal((await ids()).length, 3);
    assert.ok((await ids()).includes('hw-000000000001'));

    // A career started from the same league file gets archives of its own; the commissioner ones are untouched.
    const commissioner = await archived(page);
    for (const league of save.seasonLeagues) league.season.mode = 2;
    await upload(page, save, 'HL_CAREER_SAVE_FILE_01');
    const career = await archived(page);
    assert.equal(career.leagues.length, commissioner.leagues.length + 2);
    assert.ok(career.leagues.some(l => l.id === 'hw-000000000001-career'));
    for (const [id, count] of Object.entries(commissioner.counts)) assert.equal(career.counts[id], count);
    assert.ok(career.counts['hw-000000000001-career'] > 0);
    const labels = await page.$$eval('#archiveLeague option', o => o.map(x => x.textContent));
    assert.ok(labels.some(l => l.endsWith('(Career)')));
    assert.deepEqual(errors, []);
    console.log(
      'League identity checks passed: a new ID, expansion and renamed teams keep the archive; another ID and a career save get their own.'
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
