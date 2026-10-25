import test from 'node:test';
import assert from 'node:assert/strict';
import { Controller } from '../extension/controller.mjs';
import { TEMP_MS, MAX_RULES } from '../extension/core.mjs';

function fixture() {
  const local = {},
    session = {},
    calls = [],
    alarms = new Map();
  let failure = false;
  const proxy = { levelOfControl: 'controllable_by_this_extension', value: { mode: 'system' } };
  const area = (data) => ({
    async get(key) {
      return { [key]: structuredClone(data[key]) };
    },
    async set(values) {
      if (data === local && failure) throw new Error('storage failed');
      Object.assign(data, structuredClone(values));
    },
  });
  const api = {
    storage: { local: area(local), session: area(session) },
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
    alarms: {
      async clear(name) {
        alarms.delete(name);
      },
      async create(name, value) {
        alarms.set(name, value);
      },
    },
    tabs: {
      async get(id) {
        if (id === 999) throw new Error('No tab');
        return { id };
      },
    },
  };
  let now = 1000;
  return {
    controller: new Controller(api, () => now),
    local,
    session,
    proxy,
    calls,
    alarms,
    setNow(n) {
      now = n;
    },
    failStorage() {
      failure = true;
    },
  };
}
const add = {
  type: 'add',
  lifetime: 'permanent',
  rule: { domain: 'gmis.xjtu.edu.cn', includeSubdomains: false },
};
test('install defaults to system, adding a rule enables PAC, pause releases control and retains rules', async () => {
  const f = fixture();
  await f.controller.reconcile();
  assert.equal(f.local.state.enabled, false);
  await f.controller.mutate(add);
  let snap = await f.controller.snapshot('gmis.xjtu.edu.cn');
  assert.equal(snap.effective, true);
  assert.equal(snap.route.kind, 'permanent');
  assert.equal(f.proxy.value.pacScript.mandatory, true);
  assert.equal((await f.controller.snapshot('claude.ai')).route.kind, 'proxy');
  await f.controller.mutate({ type: 'enable', enabled: false });
  assert.equal(f.proxy.value.mode, 'system');
  assert.equal(f.local.state.permanent.length, 1);
});
test('temporary rules disappear on source tab close, expiry and browser restart', async () => {
  const f = fixture();
  const temp = { ...add, lifetime: 'temporary', tabId: 1 };
  await f.controller.mutate(temp);
  assert.equal(f.local.state.temporary.length, 1);
  assert.ok(f.alarms.has('expire-direct-rules'));
  await f.controller.mutate({ type: 'tabClosed', tabId: 1 });
  assert.equal(f.local.state.temporary.length, 0);
  await f.controller.mutate(temp);
  f.setNow(1000 + TEMP_MS);
  await f.controller.mutate({ type: 'expire' });
  assert.equal(f.local.state.temporary.length, 0);
  await f.controller.mutate(temp);
  delete f.session.token;
  await f.controller.reconcile();
  assert.equal(f.local.state.temporary.length, 0);
  assert.equal((await f.controller.snapshot('gmis.xjtu.edu.cn')).route.kind, 'proxy');
});
test('rules survive worker restart within a browser session; promoting to permanent removes matching temporary rule', async () => {
  const f = fixture();
  await f.controller.mutate({ ...add, lifetime: 'temporary', tabId: 1 });
  const token = f.session.token;
  await f.controller.reconcile();
  assert.equal(f.session.token, token);
  assert.equal(f.local.state.temporary.length, 1);
  await f.controller.mutate(add);
  await f.controller.mutate(add);
  assert.equal(f.local.state.permanent.length, 1);
  assert.equal(f.local.state.temporary.length, 0);
});
test('refuse other extensions or enterprise policy; do not overwrite settings on startup', async () => {
  for (const level of ['controlled_by_other_extensions', 'not_controllable']) {
    const f = fixture();
    await f.controller.mutate(add);
    f.calls.length = 0;
    f.proxy.levelOfControl = level;
    await assert.rejects(f.controller.mutate(add));
    assert.equal(f.calls.length, 0);
    await f.controller.reconcile();
    assert.equal(f.calls.length, 0);
    assert.equal((await f.controller.snapshot()).effective, false);
  }
});
test('storage failure restores previously effective proxy settings', async () => {
  const f = fixture();
  await f.controller.mutate(add);
  const previous = structuredClone(f.proxy.value);
  f.failStorage();
  await assert.rejects(f.controller.mutate({ ...add, rule: { domain: 'another.test' } }));
  assert.deepEqual(f.proxy.value, previous);
  assert.equal(f.local.state.permanent.length, 1);
});
test('invalid settings and invalid tab cannot change browser proxy', async () => {
  const f = fixture();
  await assert.rejects(
    f.controller.mutate({
      type: 'settings',
      proxy: { scheme: 'http', host: 'bad;host', port: 80 },
    }),
  );
  await assert.rejects(f.controller.mutate({ ...add, lifetime: 'temporary', tabId: 999 }));
  assert.equal(f.calls.length, 0);
});
test('updating a rule at the limit succeeds; a new rule over the limit has no side effects', async () => {
  const f = fixture();
  await f.controller.mutate(add);
  f.local.state.permanent = Array.from({ length: MAX_RULES }, (_, i) => ({
    domain: `site${i}.example`,
    includeSubdomains: false,
  }));
  await f.controller.mutate({ ...add, rule: { domain: 'site0.example' } });
  assert.equal(f.local.state.permanent.length, MAX_RULES);
  const callsBefore = f.calls.length;
  await assert.rejects(f.controller.mutate({ ...add, rule: { domain: 'overflow.example' } }));
  assert.equal(f.calls.length, callsBefore);
  assert.equal(f.local.state.permanent.length, MAX_RULES);
});
