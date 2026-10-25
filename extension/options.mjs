import { $, request, showMessage, busy, controlWarning } from './ui.mjs';
let snapshot;
async function render(fillForm = false) {
  showMessage('');
  snapshot = await request({ type: 'snapshot' });
  const { state } = snapshot;
  $('status').textContent = state.enabled
    ? snapshot.effective
      ? '已启用网站分流'
      : '分流未生效'
    : '正在跟随系统代理';
  $('toggle').textContent = state.enabled ? '暂停分流' : '启用分流';
  if (fillForm) {
    $('scheme').value = state.proxy.scheme;
    $('proxy-host').value = state.proxy.host;
    $('port').value = state.proxy.port;
    $('private').checked = state.bypassPrivate;
  }
  $('rules').replaceChildren();
  const rules = [
    ...state.permanent.map((rule) => ({ ...rule, temporary: false })),
    ...state.temporary.map((rule) => ({ ...rule, temporary: true })),
  ];
  $('count').textContent = `${rules.length} 条`;
  if (!rules.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '还没有直连规则。浏览网站时，点击工具栏图标即可添加。';
    $('rules').append(empty);
  }
  for (const rule of rules) {
    const row = document.createElement('div');
    row.className = 'rule-row';
    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = rule.domain;
    const detail = document.createElement('span');
    detail.textContent = `${rule.includeSubdomains ? '含子域名' : '仅此域名'} · ${rule.temporary ? `临时，至 ${new Date(rule.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '始终直连'}`;
    info.append(title, detail);
    const remove = document.createElement('button');
    remove.className = 'text-button danger';
    remove.textContent = '删除';
    remove.setAttribute('aria-label', `删除 ${rule.domain}${rule.temporary ? ' 临时规则' : ''}`);
    remove.addEventListener('click', () =>
      busy(async () => {
        await request({ type: 'remove', rule, temporaryId: rule.temporary ? rule.id : undefined });
        await render();
        showMessage('规则已删除，请刷新受影响的网站。');
      }),
    );
    row.append(info, remove);
    $('rules').append(row);
  }
  const warning = controlWarning(snapshot);
  if (warning) showMessage(warning, true);
}
async function add(domain, includeSubdomains = false) {
  await request({ type: 'add', rule: { domain, includeSubdomains }, lifetime: 'permanent' });
  await render();
  showMessage('直连规则已添加，分流已启用。请刷新对应网站。');
}
$('toggle').addEventListener('click', () =>
  busy(async () => {
    await request({ type: 'enable', enabled: !snapshot.state.enabled });
    await render();
    showMessage(snapshot.state.enabled ? '分流已启用。' : '分流已暂停，Edge 已释放代理控制。');
  }),
);
$('proxy-form').addEventListener('submit', (event) => {
  event.preventDefault();
  busy(async () => {
    await request({
      type: 'settings',
      proxy: { scheme: $('scheme').value, host: $('proxy-host').value, port: $('port').value },
      bypassPrivate: $('private').checked,
    });
    await render(true);
    showMessage('代理设置已保存。');
  });
});
$('rule-form').addEventListener('submit', (event) => {
  event.preventDefault();
  busy(async () => {
    await add($('domain').value, $('subdomains').checked);
    $('domain').value = '';
  });
});
$('preset-xjtu').addEventListener('click', () => busy(() => add('gmis.xjtu.edu.cn')));
$('preset-contest').addEventListener('click', () => busy(() => add('cpipc.acge.org.cn')));
busy(() => render(true));
