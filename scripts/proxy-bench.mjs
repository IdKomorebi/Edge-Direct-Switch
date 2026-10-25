// Does an active direct rule slow down or destabilise sites that still go through the proxy?
//
// Compares, in a real Edge with an isolated profile:
//   baseline   – no extension, Edge started with a fixed proxy (--proxy-server): the same
//                fixed-proxy path a proxy client's "system proxy" mode gives Edge
//   pac        – this extension in control (one direct rule active), DIRECT fallback on
//   pac-strict – the same with the DIRECT fallback off
// against a local HTTPS "overseas site" reached through a local CONNECT proxy whose behaviour
// is scripted: stable, jittery, or failing a share of tunnels in different ways.
// The site answers PROXY when reached via the proxy and DIRECT otherwise, so every request's
// real route is counted. Nothing external is contacted.
//
// Usage: npm run bench   (requires Microsoft Edge and openssl on PATH)
import { createRequire } from 'node:module';
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { connect } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = path.join(root, 'test-results');
const certDir = path.join(results, 'bench-cert');
await mkdir(certDir, { recursive: true });
if (!existsSync(path.join(certDir, 'cert.pem')))
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3',
    '-keyout', path.join(certDir, 'key.pem'), '-out', path.join(certDir, 'cert.pem'),
    '-subj', '/CN=route.test', '-addext', 'subjectAltName=DNS:*.route.test',
  ]); // prettier-ignore
const tls = {
  key: await readFile(path.join(certDir, 'key.pem')),
  cert: await readFile(path.join(certDir, 'cert.pem')),
};

const N = Number(process.env.BENCH_N || 120);
const SCENARIOS = {
  stable: { delay: [0, 0], fail: 0 },
  jitter: { delay: [20, 150], fail: 0 },
  'reset 10%': { delay: [20, 150], fail: 0.1, mode: 'reset' },
  '502 10%': { delay: [20, 150], fail: 0.1, mode: '502' },
  'drop 10%': { delay: [20, 150], fail: 0.1, mode: 'drop' },
  'proxy down': { down: true, n: 15 },
};
const CONFIGS = ['baseline', 'pac', 'pac-strict'];

const site = (label) =>
  createHttps(tls, (req, res) => {
    res.writeHead(200, { 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end(label);
  });
const listen = (server) =>
  new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const direct = site('DIRECT'); // reached when Edge connects directly
const viaProxy = site('PROXY'); // reached through the proxy tunnel
const directPort = await listen(direct);
const proxiedPort = await listen(viaProxy);

let scenario = SCENARIOS.stable;
const tunnels = { total: 0, failed: 0 };
const proxy = createHttp();
proxy.on('connect', (req, socket, head) => {
  tunnels.total++;
  socket.on('error', () => {});
  const [lo, hi] = scenario.delay;
  const failing = Math.random() < scenario.fail;
  if (failing) tunnels.failed++;
  setTimeout(
    () => {
      if (failing && scenario.mode === 'reset') return socket.destroy();
      if (failing && scenario.mode === '502')
        return socket.end('HTTP/1.1 502 Bad Gateway\r\ncontent-length: 0\r\n\r\n');
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (failing && scenario.mode === 'drop') return setTimeout(() => socket.destroy(), 5);
      const upstream = connect(proxiedPort, '127.0.0.1', () => {
        if (head?.length) upstream.write(head);
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
      upstream.on('error', () => socket.destroy());
    },
    lo + Math.random() * (hi - lo),
  );
});
const proxyPort = await listen(proxy);
// A port with nothing listening: what Edge sees when the proxy client is closed.
const spare = createHttp();
const deadPort = await listen(spare);
spare.close();

async function run(config, name) {
  scenario = SCENARIOS[name];
  tunnels.total = tunnels.failed = 0;
  const profile = await mkdtemp(path.join(results, 'bench-profile-'));
  const extension = path.join(root, 'extension');
  const port = scenario.down ? deadPort : proxyPort;
  const baseline = config === 'baseline';
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.TEST_BROWSER || 'msedge',
    headless: false,
    ignoreDefaultArgs: baseline ? [] : ['--disable-extensions'],
    args: [
      '--headless=new',
      ...(baseline
        ? [`--proxy-server=http://127.0.0.1:${port}`]
        : [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]),
      '--host-resolver-rules=MAP *.route.test 127.0.0.1',
      '--ignore-certificate-errors',
      '--disable-background-networking',
      '--no-first-run',
    ],
  });
  try {
    if (!baseline) {
      let worker = context.serviceWorkers()[0];
      if (!worker) worker = await context.waitForEvent('serviceworker');
      // The extension in control, with one direct rule active (the page that runs the test).
      const page = await context.newPage(); // the service worker cannot message itself
      await page.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
      for (const message of [
        {
          type: 'settings',
          proxy: { scheme: 'http', host: '127.0.0.1', port },
          fallbackDirect: config === 'pac',
          bypassPrivate: true,
          autoReload: false,
        },
        { type: 'addSite', rule: { domain: 'home.route.test' } },
      ]) {
        const r = await page.evaluate((m) => chrome.runtime.sendMessage(m), message);
        if (!r?.ok) throw new Error(r?.error);
      }
      await page.close();
    }
    const log = (m) => process.env.BENCH_DEBUG && console.log(`  [${config}] ${m}`);
    log('configured');
    const page = await context.newPage();
    // The test page is the direct site in the pac configs; in baseline it may hit an injected
    // failure on the way in, so retry, and fall back to a blank page if the proxy is down.
    let loaded = false;
    for (let i = 0; i < (scenario.down ? 2 : 8) && !loaded; i++)
      loaded = await page
        .goto(`https://home.route.test:${directPort}/`, { timeout: 15000 })
        .then((r) => !!r?.ok())
        .catch(() => false);
    log(`goto done (loaded=${loaded})`);
    if (!loaded) {
      // Run from a local blank document instead (its fetches still use the proxy settings).
      await page.waitForLoadState().catch(() => {});
      await page.goto('data:text/html,<title>bench</title>');
      log('blank page');
    }
    log(`page ready (loaded=${loaded})`);
    const samples = await page.evaluate(
      async ({ n, port }) => {
        const out = [];
        // Distinct hosts: every request needs a new tunnel (worst case for proxy overhead).
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          try {
            const r = await fetch(`https://h${i}.route.test:${port}/?${Math.random()}`, {
              cache: 'no-store',
              signal: AbortSignal.timeout(10000),
            });
            out.push({ kind: 'new', via: await r.text(), ms: performance.now() - t0 });
          } catch {
            out.push({ kind: 'new', via: 'ERROR', ms: performance.now() - t0 });
          }
        }
        // One host: connection reuse, so this mostly measures per-request routing cost.
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          try {
            const r = await fetch(`https://same.route.test:${port}/?${i}`, {
              cache: 'no-store',
              signal: AbortSignal.timeout(10000),
            });
            out.push({ kind: 'same', via: await r.text(), ms: performance.now() - t0 });
          } catch {
            out.push({ kind: 'same', via: 'ERROR', ms: performance.now() - t0 });
          }
        }
        return out;
      },
      { n: scenario.n ?? N, port: directPort },
    );
    return { config, scenario: name, tunnels: { ...tunnels }, samples };
  } finally {
    await context.close();
  }
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : NaN;
};
const summary = (samples, kind) => {
  const xs = samples.filter((s) => s.kind === kind);
  const ok = xs.filter((s) => s.via !== 'ERROR');
  return {
    p50: pct(
      ok.map((s) => s.ms),
      50,
    ),
    p95: pct(
      ok.map((s) => s.ms),
      95,
    ),
    proxied: xs.filter((s) => s.via === 'PROXY').length / xs.length,
    direct: xs.filter((s) => s.via === 'DIRECT').length / xs.length,
    errors: xs.filter((s) => s.via === 'ERROR').length / xs.length,
  };
};

const rows = [];
const only = process.env.BENCH_ONLY?.split(',');
for (const name of Object.keys(SCENARIOS).filter((k) => !only || only.includes(k)))
  for (const config of CONFIGS) {
    process.stdout.write(`${name} / ${config} … `);
    const started = Date.now();
    const r = await run(config, name);
    const row = {
      scenario: name,
      config,
      new: summary(r.samples, 'new'),
      same: summary(r.samples, 'same'),
    };
    rows.push({ ...row, tunnels: r.tunnels });
    console.log(`${((Date.now() - started) / 1000).toFixed(1)} s`);
  }

await writeFile(path.join(results, 'proxy-bench.json'), JSON.stringify(rows, null, 2));
const f = (x) => (Number.isNaN(x) ? '   –' : x.toFixed(0).padStart(4));
const p = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
console.log(
  '\nscenario     config      | new host: p50  p95 proxied direct error | same host: p50  p95 proxied direct error',
);
for (const r of rows)
  console.log(
    `${r.scenario.padEnd(12)} ${r.config.padEnd(11)} |           ${f(r.new.p50)} ${f(r.new.p95)}    ${p(r.new.proxied)}   ${p(r.new.direct)}  ${p(r.new.errors)} |            ${f(r.same.p50)} ${f(r.same.p95)}    ${p(r.same.proxied)}   ${p(r.same.direct)}  ${p(r.same.errors)}`,
  );
direct.close();
viaProxy.close();
proxy.close();
