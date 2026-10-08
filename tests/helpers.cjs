const path = require('node:path');

const samplePath = path.join(__dirname, 'fixtures', 'sample_save');

// Browser scripts use Playwright from NODE_PATH. HOOPWIRE_BROWSER picks the channel (default: msedge).
function launchBrowser() {
  const { chromium } = require('playwright');
  return chromium.launch({ channel: process.env.HOOPWIRE_BROWSER || 'msedge', headless: true });
}

// The number of stories a fresh upload of this save archives, from the same sources the app uses.
function expectedStoryCount(save) {
  const C = require('../js/coverage/core.js'),
    S = require('../js/coverage/season-coverage.js'),
    R = require('../js/coverage/records-coverage.js'),
    N = require('../js/coverage/news-coverage.js'),
    P = require('../js/coverage/performance-coverage.js');
  const leagues = save.seasonLeagues;
  return leagues.reduce((sum, l) => {
    const snapshots = new Map(C.captureSnapshots(l).map(s => [s.id, s]));
    const games = C.candidates(l, C.buildFingerprint(l), snapshots, 'full').length;
    const milestones = [
      ...S.candidates(l, leagues),
      ...R.candidates(l),
      ...N.candidates(l, leagues),
      ...N.offseason(l, leagues),
      ...P.candidates(l),
    ];
    return sum + games + new Set(milestones.map(x => x.story.id)).size;
  }, 0);
}

module.exports = { samplePath, launchBrowser, expectedStoryCount };
