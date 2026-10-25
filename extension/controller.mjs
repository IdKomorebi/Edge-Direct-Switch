import {
  MAX_SITES,
  THEMES,
  activeRules,
  buildPac,
  matches,
  migrate,
  normalizeHost,
  normalizeRule,
  routeFor,
  sameRule,
  siteRoot,
  siteRule,
  validateProxy,
} from './core.mjs';

// Saved settings live in storage.local. One-time ("this time only") rules live in
// storage.session, so a browser restart always clears them.
//
// The extension holds Edge's proxy setting only while at least one DIRECT rule is active.
// With nothing to bypass it releases control and Edge follows the system proxy again.
export class Controller {
  constructor(api) {
    this.api = api;
  }

  async load() {
    const [local, session] = await Promise.all([
      this.api.storage.local.get(['settings', 'state']),
      this.api.storage.session.get('temps'),
    ]);
    const settings = migrate(local.settings ?? local.state);
    if (!local.settings && local.state) {
      // One-time upgrade from 1.x.
      await this.api.storage.local.set({ settings });
      await this.api.storage.local.remove('state');
    }
    return { settings, temps: Array.isArray(session.temps) ? session.temps : [] };
  }

  status() {
    return this.api.proxy.settings.get({ incognito: false });
  }

  // Bring Edge's proxy setting in line with the desired state. Returns true when it changed.
  async apply(settings, temps) {
    const status = await this.status();
    const ours = status.levelOfControl === 'controlled_by_this_extension';
    if (!activeRules(settings, temps).length) {
      if (!ours) return false;
      await this.api.proxy.settings.clear({ scope: 'regular' });
      return true;
    }
    if (status.levelOfControl === 'controlled_by_other_extensions')
      throw new Error('errOtherExtension');
    if (status.levelOfControl === 'not_controllable') throw new Error('errPolicy');
    const data = buildPac(settings, temps);
    if (ours && status.value?.mode === 'pac_script' && status.value.pacScript?.data === data)
      return false;
    await this.api.proxy.settings.set({
      scope: 'regular',
      value: { mode: 'pac_script', pacScript: { data, mandatory: true } },
    });
    return true;
  }

  async commit(settings, temps) {
    const previous = await this.status();
    await this.apply(settings, temps);
    try {
      await Promise.all([
        this.api.storage.local.set({ settings }),
        this.api.storage.session.set({ temps }),
      ]);
    } catch (error) {
      if (previous.levelOfControl === 'controlled_by_this_extension')
        await this.api.proxy.settings.set({ scope: 'regular', value: previous.value });
      else await this.api.proxy.settings.clear({ scope: 'regular' });
      throw error;
    }
  }

  // Called on browser start / install. Never fights another extension or a policy.
  async reconcile() {
    const { settings, temps } = await this.load();
    try {
      await this.apply(settings, temps);
    } catch (error) {
      if (!['errOtherExtension', 'errPolicy'].includes(error.message)) throw error;
    }
  }

  async snapshot(rawHost) {
    const { settings, temps } = await this.load();
    const status = await this.status();
    const needed = activeRules(settings, temps).length > 0;
    const ours = status.levelOfControl === 'controlled_by_this_extension';
    let conflict = null;
    if (needed && !ours)
      conflict =
        status.levelOfControl === 'not_controllable'
          ? 'errPolicy'
          : status.levelOfControl === 'controlled_by_other_extensions'
            ? 'errOtherExtension'
            : 'errNotApplied';
    let host = null;
    try {
      host = rawHost ? normalizeHost(rawHost) : null;
    } catch {}
    return {
      settings,
      temps,
      conflict,
      host,
      route: host ? routeFor(settings, temps, host) : null,
      root: host ? siteRoot(host) : null,
    };
  }

  async mutate(message) {
    const { settings, temps } = await this.load();
    let nextTemps = temps;
    switch (message.type) {
      case 'setPage': {
        // Declarative: the popup sends the state it wants for this page.
        const host = normalizeHost(message.host);
        const remember = message.remember === true && settings.alwaysOn;
        nextTemps = temps.filter((r) => !matches(host, r));
        if (settings.alwaysOn) settings.sites = settings.sites.filter((r) => !matches(host, r));
        if (message.direct === true) {
          const rule = siteRule(host, message.wide === true);
          if (remember) settings.sites.push(rule);
          else {
            if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error('errTab');
            await this.api.tabs.get(message.tabId);
            nextTemps.push({ ...rule, tabId: message.tabId });
          }
        }
        break;
      }
      case 'alwaysOn':
        settings.alwaysOn = message.value === true;
        break;
      case 'settings':
        settings.proxy = validateProxy(message.proxy);
        for (const key of ['fallbackDirect', 'bypassPrivate', 'autoReload'])
          if (typeof message[key] === 'boolean') settings[key] = message[key];
        if (message.theme !== undefined) {
          if (!THEMES.includes(message.theme)) throw new Error('errUnsupported');
          settings.theme = message.theme;
        }
        break;
      case 'addSite': {
        const rule = siteRule(message.rule?.domain, message.rule?.subdomains === true);
        settings.sites = settings.sites.filter((r) => !sameRule(r, rule));
        settings.sites.push(rule);
        break;
      }
      case 'removeSite': {
        const rule = normalizeRule(message.rule);
        settings.sites = settings.sites.filter((r) => !sameRule(r, rule));
        break;
      }
      case 'removeTemp': {
        const rule = normalizeRule(message.rule);
        nextTemps = temps.filter((r) => !sameRule(r, rule));
        break;
      }
      case 'tabClosed':
        nextTemps = temps.filter((r) => r.tabId !== message.tabId);
        if (nextTemps.length === temps.length) return; // nothing to do, stay idle
        break;
      default:
        throw new Error('errUnsupported');
    }
    if (settings.sites.length > MAX_SITES) throw new Error('errTooMany');
    await this.commit(settings, nextTemps);
  }
}
