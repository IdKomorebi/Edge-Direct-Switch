import { normalizeDomain } from './core.mjs';
import { $, request, showMessage, busy, controlWarning } from './ui.mjs';
let tab, host, snapshot;
async function render() {
  showMessage('');
  snapshot = await request({ type: 'snapshot', host });
  $('host').textContent = host || '此页面不支持分流';
  $('actions').hidden = !host;
  const route = snapshot.route;
  $('route').textContent =
    snapshot.state.enabled && !snapshot.effective
      ? '分流未生效'
      : route?.label || '请打开 HTTP(S) 网站';
  $('route').className =
    `pill ${route && ['permanent', 'temporary', 'private'].includes(route.kind) && snapshot.effective ? 'direct' : ''}`;
  $('scope').textContent = route?.rule
    ? `生效规则：${route.rule.domain}${route.rule.includeSubdomains ? ' 及其子域名' : ''}${route.kind === 'temporary' ? ` · 至 ${new Date(route.rule.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : '只改变指定网站的连接方式';
  $('remove').hidden = !route?.rule;
  const { scheme, host: proxyHost, port } = snapshot.state.proxy;
  $('endpoint').textContent = `${scheme.toUpperCase()} ${proxyHost}:${port}`;
  $('toggle').textContent = snapshot.state.enabled ? '暂停分流' : '启用分流';
  const warning = controlWarning(snapshot);
  if (warning) showMessage(warning, true);
}
async function act(message) {
  await request({ ...message, host });
  await render();
  showMessage('规则已更新。');
  if ($('reload').checked && tab?.id != null) {
    try {
      await chrome.tabs.reload(tab.id);
    } catch {
      showMessage('规则已更新，请手动刷新页面。');
    }
  }
}
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('temporary').addEventListener('click', () =>
  busy(() =>
    act({
      type: 'add',
      rule: { domain: host, includeSubdomains: $('subdomains').checked },
      lifetime: 'temporary',
      tabId: tab.id,
    }),
  ),
);
$('permanent').addEventListener('click', () =>
  busy(() =>
    act({
      type: 'add',
      rule: { domain: host, includeSubdomains: $('subdomains').checked },
      lifetime: 'permanent',
    }),
  ),
);
$('remove').addEventListener('click', () =>
  busy(() =>
    act({ type: 'remove', rule: snapshot.route.rule, temporaryId: snapshot.route.rule.id }),
  ),
);
$('toggle').addEventListener('click', () =>
  busy(async () => {
    await request({ type: 'enable', enabled: !snapshot.state.enabled });
    await render();
    showMessage(snapshot.state.enabled ? '分流已启用。' : '已暂停，Edge 恢复先前代理设置。');
  }),
);
busy(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    if (tab?.url && /^https?:\/\//.test(tab.url)) host = normalizeDomain(tab.url);
  } catch {}
  await render();
});
