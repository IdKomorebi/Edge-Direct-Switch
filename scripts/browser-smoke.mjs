// End-to-end check in a real browser with an isolated profile and local marker servers.
// Usage: npm run test:browser            (TEST_LANG=en for English UI screenshots)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = path.join(root, 'test-results');
const lang = process.env.TEST_LANG || 'zh-CN';
await mkdir(results, { recursive: true });
const profile = await mkdtemp(path.join(results, 'profile-'));

// "target" answers DIRECT requests, "proxy" answers proxied ones.
const target = createServer((req, res) => res.end('<title>site</title><body>DIRECT</body>'));
const proxy = createServer((req, res) => res.end('<title>site</title><body>PROXY</body>'));
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
await listen(target);
await listen(proxy);
const url = (host) => `http://${host}:${target.address().port}/?t=${Date.now()}`;

let context;
try {
  const extension = path.join(root, 'extension');
  context = await chromium.launchPersistentContext(profile, {
    ...(process.env.TEST_EXECUTABLE
      ? { executablePath: process.env.TEST_EXECUTABLE }
      : { channel: process.env.TEST_BROWSER || 'msedge' }),
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    timeout: 30000,
    args: [
      '--headless=new',
      `--lang=${lang}`,
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      // Map test hosts to the local target. No external website is contacted.
      '--host-resolver-rules=MAP *.route.test 127.0.0.1, MAP gmis.xjtu.edu.cn 127.0.0.1',
      '--disable-background-networking',
      '--no-first-run',
    ],
    viewport: { width: 1000, height: 900 },
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20000 });
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  const level = () =>
    worker.evaluate(async () => (await chrome.proxy.settings.get({})).levelOfControl);
  const body = async (page) => (await page.locator('body').innerText()).trim();
  const visit = async (page, host) => {
    await page.goto(url(host));
    return body(page);
  };

  // Let the popup act on a chosen tab, as if opened from the toolbar there. Clicking the
  // toolbar grants activeTab (the tab URL); a test page cannot click it, so pass the URL in.
  await context.addInitScript(() => {
    const params = new URLSearchParams(location.search);
    if (location.protocol === 'chrome-extension:' && params.has('tab'))
      chrome.tabs.query = async () => [{ id: Number(params.get('tab')), url: params.get('url') }];
  });
  const tabIdOf = async (page) => {
    await page.bringToFront();
    return worker.evaluate(
      async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id,
    );
  };
  async function openPopup(page) {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 320, height: 420 });
    const query = new URLSearchParams({ tab: await tabIdOf(page), url: page.url() });
    await popup.goto(`${base}/popup.html?${query}`);
    await popup.locator('#toggle:enabled').waitFor();
    return popup;
  }
  // Wait for the popup-triggered reload of the site tab.
  const reloaded = (page, action) =>
    Promise.all([page.waitForEvent('load'), action]).then(() => body(page));

  const released = async () => {
    for (let i = 0; i < 50 && (await level()) === 'controlled_by_this_extension'; i++)
      await new Promise((r) => setTimeout(r, 100));
    return (await level()) !== 'controlled_by_this_extension';
  };

  // 1. Installing changes nothing.
  assert.notEqual(await level(), 'controlled_by_this_extension');

  // 2. Point the extension at the marker proxy. With no rules it still stays out of the way.
  const options = await context.newPage();
  await options.goto(`${base}/options.html`);
  await options.locator('#port').fill(String(proxy.address().port));
  await options.locator('#proxy-form button[type=submit]').click();
  await options.locator('#message:not([hidden])').waitFor();
  assert.notEqual(await level(), 'controlled_by_this_extension', 'no rules → no control');

  // An unrelated saved site makes the extension own routing, so no test request ever
  // reaches the machine's real system proxy.
  await options.locator('#domain').fill('anchor.route.test');
  await options.locator('#add-form button').click();
  await options.getByText('anchor.route.test', { exact: true }).waitFor();
  assert.equal(await level(), 'controlled_by_this_extension');

  const site = await context.newPage();
  const other = await context.newPage();
  assert.equal(await visit(site, 'gmis.xjtu.edu.cn'), 'PROXY');

  // 3. Popup: "Connect directly" for this time only.
  let popup = await openPopup(site);
  await popup.locator('body').screenshot({ path: path.join(results, `popup-${lang}.png`) });
  assert.equal(await reloaded(site, popup.locator('#toggle').click()), 'DIRECT');
  assert.equal(await visit(other, 'other.route.test'), 'PROXY');
  await popup.locator('body').screenshot({ path: path.join(results, `popup-direct-${lang}.png`) });
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.locator('body').screenshot({ path: path.join(results, `popup-dark-${lang}.png`) });
  await popup.close();

  // 4. Closing the tab ends the one-time rule.
  const siteUrl = site.url();
  await site.close();
  for (let i = 0; i < 50 && (await visit(other, 'gmis.xjtu.edu.cn')) !== 'PROXY'; i++)
    await new Promise((r) => setTimeout(r, 100));
  assert.equal(await body(other), 'PROXY', 'tab close ends one-time rule');

  // 5. "Always connect directly" survives closing the tab.
  const site2 = await context.newPage();
  await site2.goto(siteUrl);
  popup = await openPopup(site2);
  assert.equal(await reloaded(site2, popup.locator('#remember').click()), 'DIRECT');
  await popup.close();
  await site2.close();
  assert.equal(await visit(other, 'gmis.xjtu.edu.cn'), 'DIRECT');
  assert.equal(await visit(other, 'other.route.test'), 'PROXY');

  // 6. Master switch off: saved sites stop applying; with nothing active control is released.
  await options.reload();
  await options.locator('#alwaysOn').click();
  await options.locator('#alwaysOn:not(:checked)').waitFor();
  assert.ok(await released(), 'master off releases control');

  // 7. One-time rules still work while the master switch is off, and end with their tab.
  const blank = await context.newPage();
  await options.evaluate(
    async (tabId) => {
      const r = await chrome.runtime.sendMessage({
        type: 'setPage',
        host: 'x.route.test',
        direct: true,
        tabId,
      });
      if (!r.ok) throw new Error(r.error);
    },
    await tabIdOf(blank),
  );
  assert.equal(await level(), 'controlled_by_this_extension');
  await blank.close();
  assert.ok(await released(), 'closing the tab releases control');

  // 8. Master on again, then "Use proxy again" in the popup removes the saved site.
  await options.locator('#alwaysOn').click();
  await options.locator('#alwaysOn:checked').waitFor();
  assert.equal(await level(), 'controlled_by_this_extension');
  await other.goto(url('gmis.xjtu.edu.cn'));
  popup = await openPopup(other);
  assert.equal(await reloaded(other, popup.locator('#toggle').click()), 'PROXY');
  await popup.close();

  // 9. Documentation screenshot with example entries only.
  await options.getByRole('button', { name: /anchor\.route\.test/ }).click();
  await options.locator('#domain').fill('gmis.xjtu.edu.cn');
  await options.locator('#add-form button').click();
  await options.getByText('gmis.xjtu.edu.cn', { exact: true }).waitFor();
  await options.locator('#domain').fill('cpipc.acge.org.cn');
  await options.locator('#subdomains').check();
  await options.locator('#add-form button').click();
  await options.getByText('cpipc.acge.org.cn', { exact: true }).waitFor();
  await options.locator('#port').fill('7890');
  await options.locator('#proxy-form button[type=submit]').click();
  await options.locator('#message:not([hidden])').waitFor();
  await options.locator('#message').waitFor({ state: 'hidden' });
  await options.screenshot({ path: path.join(results, `options-${lang}.png`), fullPage: true });

  await writeFile(
    path.join(results, 'browser-smoke.json'),
    JSON.stringify({ browser: context.browser()?.version() ?? 'unknown', lang }, null, 2),
  );
  console.log('PASS: popup flow, real DIRECT/PROXY routing, tab-close cleanup, master switch.');
} finally {
  await context?.close();
  target.close();
  proxy.close();
}
