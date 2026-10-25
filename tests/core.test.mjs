import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPac,
  defaultSettings,
  isPrivateHost,
  matches,
  migrate,
  normalizeHost,
  routeFor,
  siteRoot,
  siteRule,
  validateProxy,
} from '../extension/core.mjs';

// Evaluate the generated PAC exactly like a PAC host would.
const pacFor = (settings, temps = []) =>
  new Function(`${buildPac(settings, temps)}; return FindProxyForURL;`)();

test('normalizeHost accepts URLs and hosts, rejects wildcards and credentials', () => {
  assert.equal(normalizeHost('https://GMIS.xjtu.edu.cn/pyxx/'), 'gmis.xjtu.edu.cn');
  assert.equal(normalizeHost('cpipc.acge.org.cn.'), 'cpipc.acge.org.cn');
  assert.equal(normalizeHost('http://[::1]:8080/'), '[::1]');
  for (const bad of ['', '*.example.com', 'ftp://example.com', 'https://u:p@example.com', 'a b'])
    assert.throws(() => normalizeHost(bad), /errInvalidDomain/);
});

test('validateProxy checks scheme, host and port', () => {
  assert.deepEqual(validateProxy({ scheme: 'socks5', host: '127.0.0.1', port: '10808' }), {
    scheme: 'socks5',
    host: '127.0.0.1',
    port: 10808,
  });
  assert.throws(() => validateProxy({ scheme: 'ftp', host: 'a', port: 1 }), /errProxyScheme/);
  assert.throws(() => validateProxy({ scheme: 'http', host: 'http://a', port: 1 }), /errProxyHost/);
  assert.throws(() => validateProxy({ scheme: 'http', host: 'a', port: 70000 }), /errProxyPort/);
});

test('siteRoot finds the registrable domain and respects public suffixes', () => {
  assert.equal(siteRoot('cpipc.acge.org.cn'), 'acge.org.cn');
  assert.equal(siteRoot('gmis.xjtu.edu.cn'), 'xjtu.edu.cn');
  assert.equal(siteRoot('xjtu.edu.cn'), 'xjtu.edu.cn'); // never edu.cn
  assert.equal(siteRoot('www.bilibili.com'), 'bilibili.com');
  assert.equal(siteRoot('github.com'), 'github.com');
  assert.equal(siteRoot('news.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(siteRoot('docs.alice.github.io'), 'alice.github.io'); // not all of github.io
  assert.equal(siteRoot('10.0.0.1'), null);
  assert.equal(siteRoot('[::1]'), null);
});

test('siteRule: "whole site" means the same thing everywhere', () => {
  assert.deepEqual(siteRule('https://cpipc.acge.org.cn/login', true), {
    domain: 'acge.org.cn',
    subdomains: true,
  });
  assert.deepEqual(siteRule('cpipc.acge.org.cn', false), {
    domain: 'cpipc.acge.org.cn',
    subdomains: false,
  });
  assert.deepEqual(siteRule('10.0.0.1', true), { domain: '10.0.0.1', subdomains: true });
});

test('matches handles exact and subdomain rules without suffix confusion', () => {
  const wide = { domain: 'xjtu.edu.cn', subdomains: true };
  assert.ok(matches('gmis.xjtu.edu.cn', wide));
  assert.ok(matches('xjtu.edu.cn', wide));
  assert.ok(!matches('notxjtu.edu.cn', wide));
  assert.ok(!matches('gmis.xjtu.edu.cn', { domain: 'xjtu.edu.cn', subdomains: false }));
});

test('PAC: listed sites go DIRECT, the rest use the proxy with optional DIRECT fallback', () => {
  const settings = {
    ...defaultSettings(),
    sites: [{ domain: 'gmis.xjtu.edu.cn', subdomains: false }],
  };
  const pac = pacFor(settings, [{ domain: 'acge.org.cn', subdomains: true, tabId: 1 }]);
  assert.equal(pac('', 'gmis.xjtu.edu.cn'), 'DIRECT');
  assert.equal(pac('', 'GMIS.XJTU.EDU.CN.'), 'DIRECT');
  assert.equal(pac('', 'cpipc.acge.org.cn'), 'DIRECT');
  assert.equal(pac('', 'chatgpt.com'), 'PROXY 127.0.0.1:7890; DIRECT');
  assert.equal(pac('', '192.168.1.1'), 'DIRECT');

  const strict = pacFor({ ...settings, fallbackDirect: false, bypassPrivate: false });
  assert.equal(strict('', 'chatgpt.com'), 'PROXY 127.0.0.1:7890');
  assert.equal(strict('', '192.168.1.1'), 'PROXY 127.0.0.1:7890');
});

test('PAC: the master switch turns saved sites off but keeps one-time rules', () => {
  const settings = {
    ...defaultSettings(),
    alwaysOn: false,
    sites: [{ domain: 'saved.example', subdomains: false }],
  };
  const pac = pacFor(settings, [{ domain: 'once.example', subdomains: false, tabId: 1 }]);
  assert.match(pac('', 'saved.example'), /^PROXY/);
  assert.equal(pac('', 'once.example'), 'DIRECT');
});

test('PAC uses the right keyword per proxy scheme', () => {
  for (const [scheme, word] of [
    ['http', 'PROXY'],
    ['https', 'HTTPS'],
    ['socks5', 'SOCKS5'],
  ]) {
    const pac = pacFor({
      ...defaultSettings(),
      fallbackDirect: false,
      proxy: { scheme, host: 'proxy.lan', port: 1080 },
    });
    assert.equal(pac('', 'example.com'), `${word} proxy.lan:1080`);
  }
});

test('isPrivateHost', () => {
  for (const host of ['localhost', 'intranet', '10.1.2.3', '172.20.0.1', '192.168.0.1', '[::1]'])
    assert.ok(isPrivateHost(host), host);
  for (const host of ['example.com', '172.32.0.1', '8.8.8.8', '1.2.3.4.5'])
    assert.ok(!isPrivateHost(host), host);
});

test('routeFor reports why a host is direct', () => {
  const settings = { ...defaultSettings(), sites: [{ domain: 'a.example', subdomains: false }] };
  const temps = [{ domain: 'b.example', subdomains: false, tabId: 3 }];
  assert.equal(routeFor(settings, temps, 'a.example').kind, 'saved');
  assert.equal(routeFor({ ...settings, alwaysOn: false }, temps, 'a.example').kind, 'savedOff');
  assert.equal(routeFor(settings, temps, 'b.example').kind, 'temporary');
  assert.equal(routeFor(settings, temps, 'localhost').kind, 'private');
  assert.equal(routeFor(settings, temps, 'c.example').kind, 'proxy');
});

test('migrate upgrades 1.x state and drops invalid entries', () => {
  const v2 = migrate({
    version: 1,
    enabled: true,
    proxy: { scheme: 'http', host: '127.0.0.1', port: 7892 },
    bypassPrivate: false,
    permanent: [
      { domain: 'gmis.xjtu.edu.cn', includeSubdomains: false },
      { domain: 'gmis.xjtu.edu.cn', includeSubdomains: false },
      { domain: '*.bad', includeSubdomains: true },
    ],
    temporary: [{ domain: 'x.example', tabId: 1 }],
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.alwaysOn, true);
  assert.equal(v2.proxy.port, 7892);
  assert.equal(v2.bypassPrivate, false);
  assert.deepEqual(v2.sites, [{ domain: 'gmis.xjtu.edu.cn', subdomains: false }]);
  assert.equal(migrate({ version: 1, enabled: false, permanent: [] }).alwaysOn, false);
  assert.deepEqual(migrate(undefined), defaultSettings());
  assert.deepEqual(migrate({ version: 2, proxy: { scheme: 'x' } }).proxy, defaultSettings().proxy);
});
