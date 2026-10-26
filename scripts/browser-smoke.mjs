// End-to-end check in a real browser with an isolated profile and local marker servers.
// Usage: npm run test:browser            (TEST_LANG=en for English UI screenshots)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = path.join(root, 'test-results');
const lang = process.env.TEST_LANG || 'zh-CN';
// README screenshots; TEST_SCREENSHOTS=0 skips them (e.g. older Chromium builds).
const shots = process.env.TEST_SCREENSHOTS !== '0';
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
      '--host-resolver-rules=MAP *.route.test 127.0.0.1, MAP *.xjtu.edu.cn 127.0.0.1',
      '--disable-background-networking',
      '--no-first-run',
      ...(process.env.TEST_ARGS?.split(' ').filter(Boolean) ?? []),
    ],
    viewport: { width: 1000, height: 900 },
  });
  // Chromium builds may run their own component extensions; pick ours by its script name.
  const ours = (w) => w.url().endsWith('/background.mjs');
  let worker = context.serviceWorkers().find(ours);
  if (!worker)
    worker = await context.waitForEvent('serviceworker', { predicate: ours, timeout: 20000 });
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
    await popup.setViewportSize({ width: 330, height: 440 });
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

  // README image: the popup before and after "Connect directly", with an arrow between.
  async function composeFlow() {
    const img = async (name) =>
      `data:image/png;base64,${(await readFile(path.join(results, name))).toString('base64')}`;
    const [before, after] = await Promise.all([
      img(`popup-${lang}.png`),
      img(`popup-direct-${lang}.png`),
    ]);
    const caption =
      lang === 'en'
        ? ['① Click “Connect directly”', '② Direct until you close the tab']
        : ['① 打开网站，点「本页直连」', '② 已直连，关闭标签页后恢复代理'];
    const page = await context.newPage();
    await page.setViewportSize({ width: 900, height: 600 });
    await page.setContent(`<style>
      body{margin:0;font:600 15px 'Segoe UI','Microsoft YaHei UI',sans-serif;color:#3b3e55}
      .wrap{display:inline-flex;align-items:center;gap:28px;padding:28px 36px;border-radius:28px;
        background:#ececf0}
      figure{margin:0;display:grid;gap:12px;justify-items:center}
      img{width:330px;border-radius:22px;box-shadow:0 0 0 1px rgb(0 0 0/.06),0 16px 36px -18px rgb(0 0 0/.35)}
      .arrow{font-size:38px;color:#5856d6;margin-bottom:34px}
    </style><div class="wrap"><figure><img src="${before}"><figcaption>${caption[0]}</figcaption></figure>
      <div class="arrow">➜</div>
      <figure><img src="${after}"><figcaption>${caption[1]}</figcaption></figure></div>`);
    if (shots)
      await page.locator('.wrap').screenshot({
        path: path.join(results, `flow-${lang}.png`),
        omitBackground: true,
      });
    await page.close();
  }

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
  if (shots)
    await popup.locator('body').screenshot({ path: path.join(results, `popup-${lang}.png`) });
  assert.equal(await reloaded(site, popup.locator('#toggle').click()), 'DIRECT');
  // "Whole site" is on by default: a redirect to a sibling login host must be direct as well.
  assert.equal(await visit(other, 'login.xjtu.edu.cn'), 'DIRECT', 'sibling subdomain is direct');
  // Scope picker: "This host" narrows the live rule, "Whole site" widens it again.
  await reloaded(site, popup.locator('[data-wide=false]').click());
  assert.equal(
    await visit(other, 'login.xjtu.edu.cn'),
    'PROXY',
    'this-host scope excludes siblings',
  );
  assert.equal(await body(site), 'DIRECT');
  await reloaded(site, popup.locator('[data-wide=true]').click());
  assert.equal(await visit(other, 'login.xjtu.edu.cn'), 'DIRECT', 'whole-site scope again');
  assert.equal(await visit(other, 'other.route.test'), 'PROXY');
  if (shots)
    await popup
      .locator('body')
      .screenshot({ path: path.join(results, `popup-direct-${lang}.png`) });
  await popup.emulateMedia({ colorScheme: 'dark' });
  if (shots)
    await popup.locator('body').screenshot({ path: path.join(results, `popup-dark-${lang}.png`) });
  await popup.close();
  if (shots) await composeFlow();

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

  // 9. Switches: only the switch toggles (not its label), and dragging works.
  const autoReload = options.locator('#autoReload');
  const stored = async () =>
    (await options.evaluate(() => chrome.runtime.sendMessage({ type: 'snapshot' }))).data.settings
      .autoReload;
  await options.locator('#autoReload-label').click();
  assert.equal(await autoReload.isChecked(), true, 'label text must not toggle');
  const box = await autoReload.boundingBox();
  const cy = box.y + box.height / 2;
  await options.mouse.move(box.x + box.width - 8, cy);
  await options.mouse.down();
  await options.mouse.move(box.x + 4, cy, { steps: 8 });
  await options.mouse.up();
  await options.locator('#autoReload:not(:checked)').waitFor();
  for (let i = 0; i < 20 && (await stored()) !== false; i++) await options.waitForTimeout(100);
  assert.equal(await stored(), false, 'drag left turns the switch off');
  // A drag that returns to where it started changes nothing.
  await options.mouse.move(box.x + 8, cy);
  await options.mouse.down();
  await options.mouse.move(box.x + box.width - 4, cy, { steps: 5 });
  await options.mouse.move(box.x + 6, cy, { steps: 5 });
  await options.mouse.up();
  await options.waitForTimeout(300);
  assert.equal(await autoReload.isChecked(), false);
  await autoReload.click();
  await options.locator('#autoReload:checked').waitFor();

  // Proxy port help: "?" opens an explanation, "Got it" closes it.
  await options.locator('.help').click();
  await options.locator('#port-help').waitFor({ state: 'visible' });
  if (shots) await options.screenshot({ path: path.join(results, `port-help-${lang}.png`) });
  await options.locator('#port-help .primary').click();
  await options.locator('#port-help').waitFor({ state: 'hidden' });

  // 10. Appearance: an explicit choice overrides the system and survives a reload.
  await options.locator('[data-theme-value=dark]').click();
  await options.locator('html[data-theme=dark]').waitFor({ state: 'attached' });
  await options.reload();
  await options.locator('html[data-theme=dark]').waitFor({ state: 'attached' });
  if (shots)
    await options.screenshot({
      path: path.join(results, `options-dark-${lang}.png`),
      fullPage: true,
    });
  await options.locator('[data-theme-value=system]').click();
  await options.locator('[data-theme-value=system][aria-pressed=true]').waitFor();
  assert.equal(await options.locator('html').getAttribute('data-theme'), null);

  // 11. Documentation screenshot with example entries only.
  await options.getByRole('button', { name: /anchor\.route\.test/ }).click();
  await options.locator('#domain').fill('gmis.xjtu.edu.cn');
  await options.locator('#add-form button').click();
  await options.getByText('gmis.xjtu.edu.cn', { exact: true }).waitFor();
  await options.locator('#domain').fill('cpipc.acge.org.cn');
  await options.locator('#subdomains').check();
  await options.locator('#preview').filter({ hasText: 'acge.org.cn' }).waitFor();
  await options.locator('#add-form button').click();
  // "Whole site" from the settings page means the same as in the popup.
  await options.getByText('acge.org.cn', { exact: true }).waitFor();
  await options.locator('#port').fill('7890');
  await options.locator('#proxy-form button[type=submit]').click();
  await options.locator('#message:not([hidden])').waitFor();
  await options.locator('#message').waitFor({ state: 'hidden' });
  if (shots)
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
