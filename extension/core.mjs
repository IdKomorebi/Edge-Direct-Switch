// Pure routing logic. No browser APIs here so it can be unit-tested in Node.
// Errors carry i18n message keys; the UI translates them.

export const MAX_SITES = 500;

export function defaultSettings() {
  return {
    version: 2,
    alwaysOn: true, // master switch for the saved "always direct" list
    proxy: { scheme: 'http', host: '127.0.0.1', port: 7890 },
    fallbackDirect: true, // `PROXY x; DIRECT`: keep Edge usable if the proxy client stops
    bypassPrivate: true,
    autoReload: true,
    sites: [],
  };
}

export function normalizeHost(input) {
  const raw = String(input ?? '').trim();
  if (!raw || raw.length > 2048 || /[\s*;"'\\]/u.test(raw)) throw new Error('errInvalidDomain');
  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    throw new Error('errInvalidDomain');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname)
    throw new Error('errInvalidDomain');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    host.length > 253 ||
    (!host.startsWith('[') &&
      !host.split('.').every((label) => /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/.test(label)))
  )
    throw new Error('errInvalidDomain');
  return host;
}

export function validateProxy(input) {
  const scheme = input?.scheme;
  if (!['http', 'https', 'socks5'].includes(scheme)) throw new Error('errProxyScheme');
  const raw = String(input?.host ?? '').trim();
  if (!raw || /[\s/@?#;"'\\]/u.test(raw)) throw new Error('errProxyHost');
  let host;
  try {
    host = normalizeHost(raw);
  } catch {
    throw new Error('errProxyHost');
  }
  if (raw.toLowerCase().replace(/\.$/, '') !== host) throw new Error('errProxyHost');
  const port = Number(input?.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('errProxyPort');
  return { scheme, host, port };
}

export function normalizeRule(input) {
  return { domain: normalizeHost(input?.domain), subdomains: input?.subdomains === true };
}

export const sameRule = (a, b) => a.domain === b.domain && a.subdomains === b.subdomains;

export function matches(host, rule) {
  return (
    host === rule.domain ||
    (rule.subdomains && !rule.domain.startsWith('[') && host.endsWith(`.${rule.domain}`))
  );
}

const isIp = (host) => host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host);
// Second-level labels that are public suffixes under country TLDs (edu.cn, co.uk, com.hk …).
const GENERIC_SLD = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gov',
  'net',
  'org',
  'mil',
  'ne',
  'or',
  'go',
]);

// Best-effort "whole site" suggestion: gmis.xjtu.edu.cn → xjtu.edu.cn, www.bilibili.com → bilibili.com.
// Returns null when the host already is the site root or is an IP address.
export function siteRoot(host) {
  if (isIp(host)) return null;
  const labels = host.split('.');
  const keep =
    labels.length >= 3 && labels.at(-1).length === 2 && GENERIC_SLD.has(labels.at(-2)) ? 3 : 2;
  return labels.length > keep ? labels.slice(-keep).join('.') : null;
}

export function isPrivateHost(host) {
  host = host
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    (!host.includes('.') && !host.includes(':'))
  )
    return true;
  if (host === '::1' || /^(?:fc|fd)[0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host))
    return true;
  const a = host.split('.').map(Number);
  return (
    a.length === 4 &&
    a.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (a[0] === 10 ||
      a[0] === 127 ||
      (a[0] === 192 && a[1] === 168) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
      (a[0] === 169 && a[1] === 254))
  );
}

// Rules that currently make a host DIRECT. Saved sites count only while the master switch is on.
export function activeRules(settings, temps) {
  return [...(settings.alwaysOn ? settings.sites : []), ...temps];
}

export function buildPac(settings, temps) {
  const rules = activeRules(settings, temps).map(normalizeRule);
  const { scheme, host, port } = validateProxy(settings.proxy);
  const proxy = `${{ http: 'PROXY', https: 'HTTPS', socks5: 'SOCKS5' }[scheme]} ${host}:${port}`;
  const fallback = settings.fallbackDirect ? `${proxy}; DIRECT` : proxy;
  // Only validated host data is interpolated. The script performs no DNS lookups.
  return `function FindProxyForURL(url, host) {
  host = host.toLowerCase().replace(/^\\[|\\]$/g, '').replace(/\\.$/, '');
  var rules = ${JSON.stringify(rules.map((r) => [r.domain.replace(/^\[|\]$/g, ''), r.subdomains]))};
  for (var i = 0; i < rules.length; i++) {
    var d = rules[i][0];
    if (host === d || (rules[i][1] && host.slice(-(d.length + 1)) === '.' + d)) return 'DIRECT';
  }
  ${settings.bypassPrivate ? `if ((${isPrivateHost.toString()})(host)) return 'DIRECT';` : ''}
  return ${JSON.stringify(fallback)};
}`;
}

// What the popup shows for a host. `kind` drives both label and styling.
export function routeFor(settings, temps, host) {
  const temp = temps.find((r) => matches(host, r));
  if (temp) return { kind: 'temporary', rule: temp };
  const site = settings.sites.find((r) => matches(host, r));
  if (site) return { kind: settings.alwaysOn ? 'saved' : 'savedOff', rule: site };
  if (settings.bypassPrivate && isPrivateHost(host)) return { kind: 'private' };
  return { kind: 'proxy' };
}

// Accepts v1 state ({ enabled, permanent, includeSubdomains … }) and returns v2 settings.
export function migrate(stored) {
  const base = defaultSettings();
  if (!stored) return base;
  const safe = (fn, fallback) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  const list = stored.version === 2 ? stored.sites : stored.permanent;
  const sites = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const rule = safe(
      () =>
        normalizeRule({
          domain: raw?.domain,
          subdomains: raw?.subdomains ?? raw?.includeSubdomains,
        }),
      null,
    );
    if (rule && !sites.some((r) => sameRule(r, rule))) sites.push(rule);
  }
  const bool = (key) => (typeof stored[key] === 'boolean' ? stored[key] : base[key]);
  return {
    ...base,
    alwaysOn: stored.version === 2 ? bool('alwaysOn') : stored.enabled !== false,
    proxy: safe(() => validateProxy(stored.proxy), base.proxy),
    fallbackDirect: bool('fallbackDirect'),
    bypassPrivate: bool('bypassPrivate'),
    autoReload: bool('autoReload'),
    sites: sites.slice(0, MAX_SITES),
  };
}
