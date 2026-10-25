export const DEFAULT_PROXY = Object.freeze({ scheme: 'http', host: '127.0.0.1', port: 7892 });
export const TEMP_MS = 30 * 60 * 1000;
export const MAX_RULES = 500;
export function defaultState() {
  return {
    version: 1,
    enabled: false,
    proxy: { ...DEFAULT_PROXY },
    bypassPrivate: true,
    permanent: [],
    temporary: [],
  };
}

export function normalizeDomain(input) {
  const raw = String(input ?? '').trim();
  if (!raw || raw.length > 2048 || /[\s*;"'\\]/u.test(raw))
    throw new Error('请输入有效域名或 HTTP(S) 网址，不支持通配符。');
  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    throw new Error('域名格式无效。');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname)
    throw new Error('只支持不含用户名和密码的 HTTP(S) 网址。');
  const domain = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    domain.length > 253 ||
    (!domain.startsWith('[') &&
      !domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))
  )
    throw new Error('域名格式无效。');
  return domain;
}

export function validateProxy(input) {
  const scheme = input?.scheme;
  if (!['http', 'https', 'socks5'].includes(scheme))
    throw new Error('代理协议必须是 HTTP、HTTPS 或 SOCKS5。');
  const rawHost = String(input?.host ?? '').trim();
  if (!rawHost || /[\s/@?#;"'\\]/u.test(rawHost))
    throw new Error('代理地址只填写主机名或 IP，不含协议和端口。');
  const host = normalizeDomain(rawHost);
  if (rawHost.toLowerCase().replace(/\.$/, '') !== host)
    throw new Error('代理地址只填写主机名或 IP；IPv6 请加方括号。');
  const port = Number(input.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('代理端口必须是 1–65535 之间的整数。');
  return { scheme, host, port };
}

export function normalizeRule(input) {
  return {
    domain: normalizeDomain(input?.domain),
    includeSubdomains: input?.includeSubdomains === true,
  };
}
export function matchesRule(host, rule) {
  return (
    host === rule.domain ||
    (rule.includeSubdomains && !rule.domain.startsWith('[') && host.endsWith(`.${rule.domain}`))
  );
}
export function activeTemps(state, token, now = Date.now()) {
  return state.temporary.filter((r) => r.token === token && r.expiresAt > now);
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

export function buildPac(state, token, now = Date.now()) {
  const proxy = validateProxy(state.proxy);
  const rules = [...state.permanent, ...activeTemps(state, token, now)].map(normalizeRule);
  const fallback = `${{ http: 'PROXY', https: 'HTTPS', socks5: 'SOCKS5' }[proxy.scheme]} ${proxy.host}:${proxy.port}`;
  // Only validated host data is interpolated; PAC has no network dependencies or DNS probes.
  return `function FindProxyForURL(url, host) {
  host = host.toLowerCase().replace(/^\\[|\\]$/g, '').replace(/\\.$/, '');
  var rules = ${JSON.stringify(rules)};
  for (var i = 0; i < rules.length; i++) {
    var domain = rules[i].domain.replace(/^\\[|\\]$/g, '');
    if (host === domain || (rules[i].includeSubdomains && domain.indexOf(':') < 0 && host.slice(-(domain.length + 1)) === '.' + domain)) return 'DIRECT';
  }
  ${state.bypassPrivate ? `if ((${isPrivateHost.toString()})(host)) return 'DIRECT';` : ''}
  return ${JSON.stringify(fallback)};
}`;
}

export function routeForHost(state, token, host, now = Date.now()) {
  if (!state.enabled) return { kind: 'system', label: '跟随系统代理' };
  const permanent = state.permanent.find((r) => matchesRule(host, r));
  if (permanent) return { kind: 'permanent', label: '始终直连', rule: permanent };
  const temporary = activeTemps(state, token, now).find((r) => matchesRule(host, r));
  if (temporary) return { kind: 'temporary', label: '临时直连', rule: temporary };
  if (state.bypassPrivate && isPrivateHost(host)) return { kind: 'private', label: '局域网直连' };
  return { kind: 'proxy', label: '使用代理' };
}
