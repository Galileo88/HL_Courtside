const path = require('node:path');

const samplePath = path.join(__dirname, 'fixtures', 'sample_save');

// Browser scripts use Playwright from NODE_PATH. HOOPWIRE_BROWSER picks the channel (default: msedge).
function launchBrowser() {
  const { chromium } = require('playwright');
  return chromium.launch({ channel: process.env.HOOPWIRE_BROWSER || 'msedge', headless: true });
}

module.exports = { samplePath, launchBrowser };
