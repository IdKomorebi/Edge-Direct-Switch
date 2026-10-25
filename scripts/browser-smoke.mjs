// Optional end-to-end verification. Install Playwright separately; it is not shipped in the extension.
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
await mkdir(results, { recursive: true });
const profile = await mkdtemp(path.join(results, 'edge-profile-'));
const hits = [];
const target = createServer((req, res) => {
  hits.push({ via: 'DIRECT', host: req.headers.host });
  res.end('<html><body>DIRECT</body></html>');
});
const proxy = createServer((req, res) => {
  hits.push({ via: 'PROXY', url: req.url });
  res.end('<html><body>PROXY</body></html>');
});
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
await listen(target);
await listen(proxy);
let context;
try {
  const extension = path.join(root, 'extension');
  console.log('Launching isolated browser…');
  context = await chromium.launchPersistentContext(profile, {
    ...(process.env.TEST_EXECUTABLE
      ? { executablePath: process.env.TEST_EXECUTABLE }
      : { channel: process.env.TEST_BROWSER || 'msedge' }),
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    timeout: 30000,
    args: [
      '--headless=new',
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--host-resolver-rules=MAP *.route.test 127.0.0.1',
      '--disable-background-networking',
      '--no-first-run',
    ],
    viewport: { width: 1100, height: 950 },
  });
  console.log('Browser launched. Waiting for extension worker…');
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20000 });
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  const options = await context.newPage();
  await options.goto(`${base}/options.html`);
  await options.getByRole('heading', { name: '正在跟随系统代理' }).waitFor();
  await options.locator('#proxy-host').fill('127.0.0.1');
  await options.locator('#port').fill(String(proxy.address().port));
  await options.getByRole('button', { name: '保存代理设置' }).click();
  await options.getByRole('status').filter({ hasText: '代理设置已保存' }).waitFor();
  await options.getByRole('button', { name: '启用分流', exact: true }).click();
  await options.getByRole('heading', { name: '已启用网站分流' }).waitFor();
  const page = await context.newPage(),
    other = await context.newPage();
  const url = (host) => `http://${host}:${target.address().port}/?time=${Date.now()}`;
  await page.goto(url('selected.route.test'));
  assert.equal((await page.locator('body').innerText()).trim(), 'PROXY');
  await options.locator('#domain').fill('selected.route.test');
  await options.getByRole('button', { name: '添加并启用分流', exact: true }).click();
  await options.getByRole('status').filter({ hasText: '直连规则已添加' }).waitFor();
  await page.goto(url('selected.route.test'));
  assert.equal((await page.locator('body').innerText()).trim(), 'DIRECT');
  await other.goto(url('other.route.test'));
  assert.equal((await other.locator('body').innerText()).trim(), 'PROXY');
  await options.getByRole('button', { name: '删除 selected.route.test', exact: true }).click();
  await options.getByRole('status').filter({ hasText: '规则已删除' }).waitFor();
  await page.goto(url('selected.route.test'));
  assert.equal((await page.locator('body').innerText()).trim(), 'PROXY');
  // Exercise the actual runtime and proxy API for a temporary rule bound to a live tab.
  const tabId = await options.evaluate(async () => {
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
    return tab.id;
  });
  await options.evaluate(async (tabId) => {
    const result = await chrome.runtime.sendMessage({
      type: 'add',
      lifetime: 'temporary',
      tabId,
      rule: { domain: 'selected.route.test', includeSubdomains: false },
    });
    if (!result.ok) throw new Error(result.error);
  }, tabId);
  await page.goto(url('selected.route.test'));
  assert.equal((await page.locator('body').innerText()).trim(), 'DIRECT');
  await options.evaluate((tabId) => chrome.tabs.remove(tabId), tabId);
  await options.reload();
  await options.getByText('还没有直连规则。浏览网站时，点击工具栏图标即可添加。').waitFor();
  await other.goto(url('selected.route.test'));
  assert.equal((await other.locator('body').innerText()).trim(), 'PROXY');
  await options.getByRole('button', { name: '西交研究生系统', exact: true }).click();
  await options.getByRole('status').filter({ hasText: '直连规则已添加' }).waitFor();
  await options.getByRole('button', { name: '研究生创新实践大赛', exact: true }).click();
  await options.getByText('cpipc.acge.org.cn', { exact: true }).waitFor();
  // Restore the documented example endpoint for screenshots after all routing assertions.
  await options.locator('#port').fill('7892');
  await options.getByRole('button', { name: '保存代理设置', exact: true }).click();
  await options.getByRole('status').filter({ hasText: '代理设置已保存' }).waitFor();
  await options.screenshot({ path: path.join(results, 'options.png'), fullPage: true });
  await options.getByRole('button', { name: '暂停分流', exact: true }).click();
  await options.getByRole('heading', { name: '正在跟随系统代理' }).waitFor();
  const setting = await worker.evaluate(() => chrome.proxy.settings.get({ incognito: false }));
  assert.notEqual(setting.levelOfControl, 'controlled_by_this_extension');
  await writeFile(
    path.join(results, 'browser-smoke.json'),
    JSON.stringify(
      {
        browser: context.browser().version(),
        checks: [
          'initial system mode',
          'real proxy requests',
          'selected domain DIRECT',
          'other domain remains PROXY',
          'rule removal',
          'temporary rule',
          'tab-close cleanup',
          'pause releases control',
        ],
        hits,
      },
      null,
      2,
    ),
  );
  console.log('PASS: real browser extension, proxy routing, temporary cleanup and pause.');
} finally {
  await context?.close();
  target.close();
  proxy.close();
}
