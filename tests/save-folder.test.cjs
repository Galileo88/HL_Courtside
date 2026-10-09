const test = require('node:test'),
  assert = require('node:assert/strict'),
  F = require('../js/app/save-folder.js');

const file = (name, lastModified, text) => ({
  kind: 'file',
  name,
  getFile: async () => ({ name, lastModified, text: async () => text }),
});
const folder = entries => ({
  name: 'Temp Files',
  async *values() {
    yield* entries;
  },
});
const save = (league, year) =>
  JSON.stringify({ seasonLeagues: [{ leagueName: league, season: { currentYear: year } }] });
const isSave = data => Array.isArray(data?.seasonLeagues);
const describe = data => `${data.seasonLeagues[0].leagueName} ${data.seasonLeagues[0].season.currentYear}`;

test('the slot comes from the save name, with or without an extension', () => {
  assert.equal(F.slotOf('UBA_CAREER_Y1_1967_SAVE_FILE_01'), '01');
  assert.equal(F.slotOf('HL_LEAGUE_Y3_2028_SAVE_FILE_12.json'), '12');
  assert.equal(F.slotOf('settings'), null);
});

test("the newest save in this league's slot wins, even when another league saved later", () => {
  const handle = folder([
    file('UBA_CAREER_Y1_1967_SAVE_FILE_01', 1000, save('UBA', 1967)),
    file('UBA_CAREER_Y2_1968_SAVE_FILE_01', 2000, save('UBA', 1968)),
    file('HL_LEAGUE_Y1_2026_SAVE_FILE_02', 9000, save('HL', 2026)),
    file('settings', 9500, '{"volume": 1}'),
    file('screenshot.png', 9900, save('UBA', 1999)),
  ]);
  return Promise.all([
    F.latestSave(handle, isSave, '01').then(f => assert.equal(f.name, 'UBA_CAREER_Y2_1968_SAVE_FILE_01')),
    F.latestSave(handle, isSave, '02').then(f => assert.equal(f.name, 'HL_LEAGUE_Y1_2026_SAVE_FILE_02')),
    F.latestSave(handle, isSave, '03').then(f => assert.equal(f, null)),
  ]);
});

test('each slot is listed once with its newest save, for choosing between leagues', async () => {
  const handle = folder([
    file('HL_LEAGUE_Y1_2026_SAVE_FILE_02', 3000, save('HL', 2026)),
    file('UBA_CAREER_Y1_1967_SAVE_FILE_01', 1000, save('UBA', 1967)),
    file('UBA_CAREER_Y2_1968_SAVE_FILE_01', 2000, save('UBA', 1968)),
    file('BROKEN_SAVE_FILE_03', 4000, 'not json'),
  ]);
  assert.deepEqual(
    (await F.slots(handle, isSave, describe)).map(x => [x.slot, x.label]),
    [
      ['01', 'UBA 1968'],
      ['02', 'HL 2026'],
    ]
  );
  assert.deepEqual(await F.slots(folder([]), isSave, describe), []);
});
