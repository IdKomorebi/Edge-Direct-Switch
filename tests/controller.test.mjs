import test from 'node:test';
import assert from 'node:assert/strict';
import { Controller } from '../extension/controller.mjs';

function fixture({ level = 'controllable_by_this_extension', local: initial = {} } = {}) {
  const local = structuredClone(initial),
    session = {},
    calls = [];
  let failLocal = false;
  const proxy = { levelOfControl: level, value: { mode: 'system' } };
  const area = (data, isLocal) => ({
    async get(keys) {
      const out = {};
      for (const key of [keys].flat()) if (key in data) out[key] = structuredClone(data[key]);
      return out;
    },
    async set(values) {
      if (isLocal && failLocal) throw new Error('storage failed');
      Object.assign(data, structuredClone(values));
    },
    async remove(key) {
      delete data[key];
    },
  });
  const api = {
    storage: { local: area(local, true), session: area(session, false) },
    proxy: {
      settings: {
        async get() {
          return structuredClone(proxy);
        },
        async set({ value }) {
          calls.push('set');
          proxy.value = structuredClone(value);
          proxy.levelOfControl = 'controlled_by_this_extension';
        },
        async clear() {
          calls.push('clear');
          proxy.value = { mode: 'system' };
          proxy.levelOfControl = 'controllable_by_this_extension';
        },
      },
    },
    tabs: {
      async get(id) {
        if (id === 999) throw new Error('No tab with id: 999');
        return { id };
      },
    },
  };
  return {
    controller: new Controller(api),
    local,
    session,
    calls,
    proxy,
    failLocal: (v) => (failLocal = v),
  };
}

const page = (host, extra) => ({ type: 'setPage', host, tabId: 7, direct: true, ...extra });

test('installing does not touch the proxy', async () => {
  const f = fixture();
  await f.controller.reconcile();
  assert.deepEqual(f.calls, []);
  assert.equal(f.proxy.levelOfControl, 'controllable_by_this_extension');
});

test('one-time direct takes control; closing its tab releases control', async () => {
  const f = fixture();
  await f.controller.mutate(page('gmis.xjtu.edu.cn'));
  assert.equal(f.proxy.levelOfControl, 'controlled_by_this_extension');
  assert.deepEqual(f.session.temps, [{ domain: 'gmis.xjtu.edu.cn', subdomains: false, tabId: 7 }]);
  const snap = await f.controller.snapshot('https://gmis.xjtu.edu.cn/pyxx/');
  assert.equal(snap.route.kind, 'temporary');
  assert.equal(snap.conflict, null);

  await f.controller.mutate({ type: 'tabClosed', tabId: 8 }); // unrelated tab: no work
  assert.deepEqual(f.calls, ['set']);
  await f.controller.mutate({ type: 'tabClosed', tabId: 7 });
  assert.deepEqual(f.calls, ['set', 'clear']);
  assert.equal(f.proxy.levelOfControl, 'controllable_by_this_extension');
});

test('"whole site" uses the registrable domain with subdomains', async () => {
  const f = fixture();
  await f.controller.mutate(page('cpipc.acge.org.cn', { wide: true }));
  assert.deepEqual(f.session.temps[0], { domain: 'acge.org.cn', subdomains: true, tabId: 7 });
});

test('remember saves the site; turning remember off keeps it direct for this tab', async () => {
  const f = fixture();
  await f.controller.mutate(page('gmis.xjtu.edu.cn', { remember: true }));
  assert.deepEqual(f.local.settings.sites, [{ domain: 'gmis.xjtu.edu.cn', subdomains: false }]);
  assert.deepEqual(f.session.temps, []);
  await f.controller.mutate(page('gmis.xjtu.edu.cn', { remember: false }));
  assert.deepEqual(f.local.settings.sites, []);
  assert.equal(f.session.temps.length, 1);
  await f.controller.mutate(page('gmis.xjtu.edu.cn', { direct: false }));
  assert.deepEqual(f.session.temps, []);
  assert.equal(f.proxy.levelOfControl, 'controllable_by_this_extension');
});

test('master switch off: saved sites stop applying and stay untouched by page actions', async () => {
  const f = fixture();
  await f.controller.mutate({ type: 'addSite', rule: { domain: 'saved.example' } });
  assert.equal(f.proxy.levelOfControl, 'controlled_by_this_extension');
  await f.controller.mutate({ type: 'alwaysOn', value: false });
  assert.equal(f.proxy.levelOfControl, 'controllable_by_this_extension'); // nothing active
  assert.equal((await f.controller.snapshot('saved.example')).route.kind, 'savedOff');

  // One-time direct still works and must not delete the saved entry.
  await f.controller.mutate(page('saved.example', { remember: true }));
  assert.deepEqual(f.local.settings.sites, [{ domain: 'saved.example', subdomains: false }]);
  assert.equal(f.session.temps.length, 1);
  await f.controller.mutate(page('saved.example', { direct: false }));
  assert.deepEqual(f.local.settings.sites, [{ domain: 'saved.example', subdomains: false }]);
});

test('identical PAC is not re-applied', async () => {
  const f = fixture();
  await f.controller.mutate(page('a.example'));
  await f.controller.reconcile();
  await f.controller.mutate({ type: 'alwaysOn', value: true });
  assert.deepEqual(f.calls, ['set']);
});

test('a temporary rule needs a live tab', async () => {
  const f = fixture();
  await assert.rejects(f.controller.mutate(page('a.example', { tabId: 999 })), /No tab/);
  await assert.rejects(f.controller.mutate(page('a.example', { tabId: undefined })), /errTab/);
  assert.deepEqual(f.calls, []);
});

test('never fights another extension or policy', async () => {
  for (const [level, error] of [
    ['controlled_by_other_extensions', /errOtherExtension/],
    ['not_controllable', /errPolicy/],
  ]) {
    const f = fixture({ level });
    await assert.rejects(f.controller.mutate(page('a.example')), error);
    assert.deepEqual(f.calls, []);
    assert.equal(f.session.temps, undefined);
    // Startup with saved sites while another extension owns the proxy: stay quiet.
    const g = fixture({
      level,
      local: { settings: { version: 2, sites: [{ domain: 'a.example', subdomains: false }] } },
    });
    await g.controller.reconcile();
    assert.deepEqual(g.calls, []);
    assert.match((await g.controller.snapshot()).conflict, error);
  }
});

test('storage failure rolls the proxy setting back', async () => {
  const f = fixture();
  f.failLocal(true);
  await assert.rejects(f.controller.mutate(page('a.example')), /storage failed/);
  assert.deepEqual(f.calls, ['set', 'clear']);
  assert.equal(f.proxy.levelOfControl, 'controllable_by_this_extension');
});

test('settings validate input and only change the proxy while rules are active', async () => {
  const f = fixture();
  const proxy = { scheme: 'socks5', host: '127.0.0.1', port: 10808 };
  await f.controller.mutate({ type: 'settings', proxy, fallbackDirect: false });
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.local.settings.proxy, proxy);
  assert.equal(f.local.settings.fallbackDirect, false);
  await assert.rejects(
    f.controller.mutate({ type: 'settings', proxy: { ...proxy, port: 0 } }),
    /errProxyPort/,
  );
  await f.controller.mutate(page('a.example'));
  assert.match(f.proxy.value.pacScript.data, /SOCKS5 127\.0\.0\.1:10808"/);
});

test('1.x state is migrated once and the old key removed', async () => {
  const f = fixture({
    local: {
      state: {
        version: 1,
        enabled: true,
        proxy: { scheme: 'http', host: '127.0.0.1', port: 7892 },
        bypassPrivate: true,
        permanent: [{ domain: 'gmis.xjtu.edu.cn', includeSubdomains: true }],
        temporary: [],
      },
    },
  });
  const { settings } = await f.controller.load();
  assert.deepEqual(settings.sites, [{ domain: 'gmis.xjtu.edu.cn', subdomains: true }]);
  assert.equal(f.local.state, undefined);
  assert.equal(f.local.settings.proxy.port, 7892);
});

test('removeSite and removeTemp', async () => {
  const f = fixture();
  await f.controller.mutate({ type: 'addSite', rule: { domain: 'a.example', subdomains: true } });
  await f.controller.mutate(page('b.example'));
  await f.controller.mutate({
    type: 'removeSite',
    rule: { domain: 'a.example', subdomains: true },
  });
  await f.controller.mutate({ type: 'removeTemp', rule: { domain: 'b.example' } });
  assert.deepEqual(f.local.settings.sites, []);
  assert.deepEqual(f.session.temps, []);
  assert.equal(f.proxy.levelOfControl, 'controllable_by_this_extension');
});
