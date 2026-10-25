import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  defaultState,
  normalizeDomain,
  validateProxy,
  buildPac,
  routeForHost,
  isPrivateHost,
} from '../extension/core.mjs';

function pacFor(state, token = 'session', now = 1000) {
  const ctx = vm.createContext({});
  vm.runInContext(buildPac(state, token, now), ctx);
  return (host) => ctx.FindProxyForURL(`https://${host}/`, host);
}
test('normalize URLs, IDNs and IPs; reject schemes and script injection', () => {
  assert.equal(normalizeDomain('https://GMIS.XJTU.EDU.CN/pyxx/?a=1'), 'gmis.xjtu.edu.cn');
  assert.equal(normalizeDomain('例子.中国'), 'xn--fsqu00a.xn--fiqs8s');
  assert.equal(normalizeDomain('[::1]'), '[::1]');
  for (const input of [
    '',
    '*.example.com',
    'https://user:pass@example.com',
    'javascript:alert(1)',
    'http://x";return DIRECT',
    'https://a b.com',
    '-bad.test',
  ])
    assert.throws(() => normalizeDomain(input));
});
test('proxy configuration rejects credentials, embedded ports and unsafe values', () => {
  assert.deepEqual(validateProxy({ scheme: 'socks5', host: '[::1]', port: '1080' }), {
    scheme: 'socks5',
    host: '[::1]',
    port: 1080,
  });
  for (const input of [
    { scheme: 'ftp', host: 'localhost', port: 80 },
    { scheme: 'http', host: 'host:80', port: 80 },
    { scheme: 'http', host: 'http://localhost', port: 80 },
    { scheme: 'http', host: 'localhost', port: 0 },
    { scheme: 'http', host: 'localhost', port: 65536 },
    { scheme: 'http', host: 'localhost', port: 80.5 },
  ])
    assert.throws(() => validateProxy(input));
});
test('PAC routes selected hosts directly, preserves proxy for overseas sites and suffix lookalikes', () => {
  const s = defaultState();
  s.enabled = true;
  s.permanent = [
    { domain: 'gmis.xjtu.edu.cn', includeSubdomains: false },
    { domain: 'acge.org.cn', includeSubdomains: true },
  ];
  const route = pacFor(s);
  for (const host of ['gmis.xjtu.edu.cn', 'acge.org.cn', 'cpipc.acge.org.cn', 'a.b.acge.org.cn'])
    assert.equal(route(host), 'DIRECT');
  for (const host of [
    'chatgpt.com',
    'claude.ai',
    'a.gmis.xjtu.edu.cn',
    'evilacge.org.cn',
    'acge.org.cn.attacker.test',
  ])
    assert.equal(route(host), 'PROXY 127.0.0.1:7892');
  assert.equal(route('GMIS.XJTU.EDU.CN.'), 'DIRECT');
});
test('temporary rules expire and cannot survive a browser session change', () => {
  const s = defaultState();
  s.temporary = [
    { domain: 'temp.test', includeSubdomains: false, expiresAt: 2000, token: 'session', tabId: 1 },
  ];
  assert.equal(pacFor(s)('temp.test'), 'DIRECT');
  assert.equal(pacFor(s, 'session', 2000)('temp.test'), 'PROXY 127.0.0.1:7892');
  assert.equal(pacFor(s, 'new-session')('temp.test'), 'PROXY 127.0.0.1:7892');
});
test('private literal handling agrees between UI and PAC and can be disabled', () => {
  const s = defaultState();
  s.enabled = true;
  const route = pacFor(s);
  for (const host of [
    'localhost',
    'a.localhost',
    'intranet',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '127.2.0.1',
    '169.254.1.1',
    '[::1]',
    '[fd00::1]',
    '[fe80::1]',
  ]) {
    assert.equal(isPrivateHost(host), true, host);
    assert.equal(route(host), 'DIRECT', host);
    assert.equal(routeForHost(s, 'session', host).kind, 'private');
  }
  for (const host of [
    '172.32.0.1',
    '192.169.1.1',
    '8.8.8.8',
    'example.com',
    'localhost.evil.test',
    '[2001:4860::1]',
  ]) {
    assert.equal(isPrivateHost(host), false, host);
    assert.notEqual(route(host), 'DIRECT', host);
  }
  s.bypassPrivate = false;
  assert.equal(pacFor(s)('10.0.0.1'), 'PROXY 127.0.0.1:7892');
});
test('HTTP, HTTPS, SOCKS5 endpoints; no automatic direct fallback', () => {
  const s = defaultState();
  s.bypassPrivate = false;
  for (const [scheme, prefix] of [
    ['http', 'PROXY'],
    ['https', 'HTTPS'],
    ['socks5', 'SOCKS5'],
  ]) {
    s.proxy.scheme = scheme;
    assert.equal(pacFor(s)('example.com'), `${prefix} 127.0.0.1:7892`);
  }
});
test('explicit IPv6 direct rules work with unbracketed PAC hosts', () => {
  const s = defaultState();
  s.bypassPrivate = false;
  s.permanent = [{ domain: '[2001:db8::1]', includeSubdomains: false }];
  assert.equal(pacFor(s)('2001:db8::1'), 'DIRECT');
});
