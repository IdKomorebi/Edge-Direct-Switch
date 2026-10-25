import {
  defaultState,
  validateProxy,
  normalizeRule,
  normalizeDomain,
  activeTemps,
  buildPac,
  routeForHost,
  TEMP_MS,
  MAX_RULES,
} from './core.mjs';

export class Controller {
  constructor(api, now = () => Date.now()) {
    this.api = api;
    this.now = now;
  }
  async load() {
    const [{ state }, session] = await Promise.all([
      this.api.storage.local.get('state'),
      this.api.storage.session.get('token'),
    ]);
    this.token = session.token || crypto.randomUUID();
    if (!session.token) await this.api.storage.session.set({ token: this.token });
    const result = { ...defaultState(), ...state };
    result.proxy = validateProxy(result.proxy);
    result.permanent = result.permanent.map(normalizeRule);
    result.temporary = activeTemps(result, this.token, this.now());
    return result;
  }
  async proxyStatus() {
    return this.api.proxy.settings.get({ incognito: false });
  }
  assertControl(status) {
    if (status.levelOfControl === 'controlled_by_other_extensions')
      throw new Error('代理由其他扩展控制，请先停用 ZeroOmega 等代理扩展，再重试。');
    if (status.levelOfControl === 'not_controllable')
      throw new Error('代理被组织策略锁定，扩展无法修改。');
  }
  async setProxy(state) {
    if (!state.enabled) {
      await this.api.proxy.settings.clear({ scope: 'regular' });
      return;
    }
    this.assertControl(await this.proxyStatus());
    await this.api.proxy.settings.set({
      scope: 'regular',
      value: {
        mode: 'pac_script',
        pacScript: { data: buildPac(state, this.token, this.now()), mandatory: true },
      },
    });
  }
  async commit(next) {
    const previous = await this.proxyStatus();
    await this.setProxy(next);
    try {
      await this.api.storage.local.set({ state: next });
    } catch (error) {
      if (previous.levelOfControl === 'controlled_by_this_extension')
        await this.api.proxy.settings.set({ scope: 'regular', value: previous.value });
      else await this.api.proxy.settings.clear({ scope: 'regular' });
      throw error;
    }
    await this.schedule(next);
    return next;
  }
  async schedule(state) {
    await this.api.alarms.clear('expire-direct-rules');
    if (state.temporary.length)
      await this.api.alarms.create('expire-direct-rules', {
        when: Math.max(this.now() + 1000, Math.min(...state.temporary.map((r) => r.expiresAt))),
      });
  }
  async reconcile() {
    const state = await this.load();
    // Do not compete with a proxy extension or an enterprise policy.
    const status = await this.proxyStatus();
    if (
      state.enabled &&
      ['not_controllable', 'controlled_by_other_extensions'].includes(status.levelOfControl)
    )
      return state;
    return this.commit(state);
  }
  async snapshot(host) {
    const state = await this.load();
    const status = await this.proxyStatus();
    const effective =
      state.enabled &&
      status.levelOfControl === 'controlled_by_this_extension' &&
      status.value.mode === 'pac_script' &&
      status.value.pacScript?.data === buildPac(state, this.token, this.now());
    return {
      state,
      levelOfControl: status.levelOfControl,
      effective,
      route: host ? routeForHost(state, this.token, normalizeDomain(host), this.now()) : null,
    };
  }
  async mutate(message) {
    const state = await this.load();
    switch (message.type) {
      case 'enable':
        state.enabled = message.enabled === true;
        break;
      case 'settings':
        state.proxy = validateProxy(message.proxy);
        state.bypassPrivate = message.bypassPrivate === true;
        break;
      case 'add': {
        const rule = normalizeRule(message.rule);
        state.enabled = true;
        if (message.lifetime === 'temporary') {
          if (!Number.isInteger(message.tabId) || message.tabId < 0)
            throw new Error('临时规则需要一个有效的标签页。');
          await this.api.tabs.get(message.tabId);
          state.temporary = state.temporary.filter(
            (r) =>
              !(
                r.domain === rule.domain &&
                r.tabId === message.tabId &&
                r.includeSubdomains === rule.includeSubdomains
              ),
          );
          state.temporary.push({
            ...rule,
            id: crypto.randomUUID(),
            tabId: message.tabId,
            token: this.token,
            expiresAt: this.now() + TEMP_MS,
          });
        } else if (message.lifetime === 'permanent') {
          state.permanent = state.permanent.filter(
            (r) => !(r.domain === rule.domain && r.includeSubdomains === rule.includeSubdomains),
          );
          state.permanent.push(rule);
          state.temporary = state.temporary.filter(
            (r) => !(r.domain === rule.domain && r.includeSubdomains === rule.includeSubdomains),
          );
        } else throw new Error('规则有效期无效。');
        if (state.permanent.length + state.temporary.length > MAX_RULES)
          throw new Error('最多支持 500 条规则，请先删除不再使用的规则。');
        break;
      }
      case 'remove':
        if (message.temporaryId)
          state.temporary = state.temporary.filter((r) => r.id !== message.temporaryId);
        else {
          const rule = normalizeRule(message.rule);
          state.permanent = state.permanent.filter(
            (r) => !(r.domain === rule.domain && r.includeSubdomains === rule.includeSubdomains),
          );
        }
        break;
      case 'tabClosed':
        state.temporary = state.temporary.filter((r) => r.tabId !== message.tabId);
        break;
      case 'expire':
        break; // load() already filters expired / previous browser session entries.
      default:
        throw new Error('不支持的操作。');
    }
    return this.commit(state);
  }
}
