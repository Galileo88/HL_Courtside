const { chromium } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const root = path.resolve(__dirname, '..');
const common = {
  kind: 'season',
  fingerprint: 'editorial-test',
  season: 2026,
  day: 82,
  importance: 100,
  createdAt: '2026-10-07T12:00:00Z',
  paragraphs: ['Old statistical list.'],
  relatedTeams: [
    { id: 1, name: 'Stars' },
    { id: 2, name: 'Moons' },
  ],
};
const stories = [
  {
    ...common,
    id: 'review',
    type: 'Regular-season review',
    headline: 'The regular season in review',
    seasonSnapshot: {
      teamRecords: [
        { teamId: 1, record: { seasonStats: { GP: 82, W: 64, L: 18, PTS: 9020, OPP: 8200 } } },
        { teamId: 2, record: { seasonStats: { GP: 82, W: 62, L: 20, PTS: 8610, OPP: 8282 } } },
      ],
    },
  },
  {
    ...common,
    id: 'leaders',
    type: 'Season leaders',
    headline: 'The statistical leaders',
    seasonSnapshot: {
      rows: [
        ['PTS', 'Alex Star', 3000, 82],
        ['REB', 'Sam Moon', 1000, 82],
        ['BLK', 'Sam Moon', 200, 82],
        ['AST', 'Pat Sky', 800, 82],
        ['STL', 'Lee Sun', 164, 82],
      ],
      leaderProfiles: [
        { name: 'Alex Star', s: { GP: 82, PTS: 3000, FGM: 900, FGA: 2000 } },
        { name: 'Pat Sky', s: { GP: 82, AST: 800, TO: 160 } },
      ],
    },
  },
];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0])));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    'Content-Type',
    { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] ||
      'application/octet-stream'
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    await page.evaluate(async stories => {
      const a = await new HoopWireArchive().open();
      try {
        await a.write({
          stories,
          leagues: [{ id: 'editorial-test', name: 'Test League' }],
          meta: [{ id: 'active-leagues', ids: ['editorial-test'] }],
        });
      } finally {
        a.db.close();
      }
    }, stories);
    await page.goto(url + '/#story/review');
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('saveFile').disabled);
    const body = page.locator('.article-body');
    assert.equal(await body.locator(':scope > p').count(), 2);
    assert.match(await body.textContent(), /(?:owned|set the pace in).*outscored opponents by/s);
    assert.equal(await body.locator(':scope > :first-child').evaluate(e => e.tagName), 'P');
    assert.equal(await body.locator('table').count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    await body.screenshot({ path: path.join(root, 'artifacts/season-review-article.png') });
    await page.goto(url + '/#story/leaders');
    await page.waitForFunction(
      () => document.querySelector('.article-headline')?.textContent === 'The statistical leaders'
    );
    assert.equal(await body.locator('p').count(), 3);
    assert.match(await body.textContent(), /clean ratio for a lead playmaker/);
    assert.doesNotMatch(await body.textContent(), /Old statistical list/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('Archived reviews and leaders render full articles; prose precedes reference tables and fits mobile.');
  } finally {
    await browser?.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
