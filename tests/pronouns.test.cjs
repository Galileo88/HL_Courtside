const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const { fullSamplePath } = require('./helpers.cjs');
const C = require('../js/coverage/core.js'),
  S = require('../js/coverage/season-coverage.js'),
  R = require('../js/coverage/records-coverage.js'),
  N = require('../js/coverage/news-coverage.js'),
  P = require('../js/coverage/performance-coverage.js'),
  K = require('../js/coverage/career-coverage.js'),
  B = require('../js/broadcast/broadcast-content.js');

test('pronoun helpers follow the save and fall back to the name', () => {
  assert.deepEqual(C.pronouns({ gender: 1 }, 'Lee'), { he: 'she', him: 'her', his: 'her' });
  assert.deepEqual(C.pronouns({ gender: 0 }, 'Lee'), { he: 'he', him: 'him', his: 'his' });
  assert.deepEqual(C.pronouns({}, 'Lee'), { he: 'Lee', him: 'Lee', his: "Lee's" });
  assert.equal(C.squad({ roster: [{ gender: 1 }, { gender: 1 }, { gender: 0 }] }), 'players');
  assert.equal(C.squad({ roster: [{ gender: 0 }] }), 'guys');
});

test("a women's league is covered without male pronouns or men's wording", () => {
  const save = JSON.parse(fs.readFileSync(fullSamplePath, 'utf8'));
  const names = new Set();
  const walk = o => {
    if (!o || typeof o !== 'object') return;
    if ('gender' in o && ('fn' in o || 'ln' in o)) {
      o.gender = 1;
      names.add(C.playerDisplay(o));
    }
    Object.values(o).forEach(walk);
  };
  walk(save);
  const leagues = save.seasonLeagues;
  const male = /\b(he|his|him|himself|guy|guys|man|men)\b/i;
  for (const l of leagues) {
    const fp = C.buildFingerprint(l),
      snapshots = new Map(C.captureSnapshots(l).map(s => [s.id, s]));
    const stories = [
      ...C.candidates(l, fp, snapshots, 'full').map(ctx => C.generateArticle(ctx, fp, true)),
      ...[
        ...S.candidates(l, leagues),
        ...R.candidates(l),
        ...N.candidates(l, leagues),
        ...N.offseason(l, leagues),
        ...P.candidates(l),
        ...K.candidates(l),
      ].map(x => x.story),
    ];
    for (const story of stories) {
      const lines = [story.headline, ...(story.paragraphs || []), ...B.script(story).map(t => t.text)];
      for (let line of lines) {
        for (const name of names) line = line.split(name).join('');
        assert.doesNotMatch(line, male, `${story.headline}: ${line}`);
      }
    }
  }
});
