import {
  $,
  t,
  localize,
  request,
  toast,
  busy,
  enhanceSwitches,
  enhanceButtons,
  applyTheme,
  markReady,
} from './ui.mjs';

let tab, snap;
// "Whole site" defaults to on: portals often redirect to sibling subdomains (gmis.xjtu.edu.cn →
// login.xjtu.edu.cn), which a single-host rule would leave on the proxy. The last choice is kept.
const storedWide = () => {
  try {
    return localStorage.getItem('wideChoice') !== 'false';
  } catch {
    return true;
  }
};
let wideChoice = storedWide(); // scope used when the page is switched to direct

const DIRECT = ['temporary', 'saved'];
const isDirect = (s) => DIRECT.includes(s?.route?.kind);
const routeKey = (s) =>
  isDirect(s) ? `${s.route.rule.domain}|${s.route.rule.subdomains}` : 'proxy';

function render() {
  const { settings, route, host, root, conflict } = snap;
  applyTheme(settings.theme);
  $('alwaysOn').checked = settings.alwaysOn;
  $('count').textContent = t('siteCount', String(settings.sites.length));

  $('host').textContent = host || t('unsupported');
  $('avatar').textContent = host ? host.replace(/^www\./, '')[0].toUpperCase() : '·';

  const kind = route?.kind ?? 'unsupported';
  const direct = isDirect(snap);
  const status = {
    proxy: 'statusProxy',
    temporary: 'statusTemporary',
    saved: 'statusSaved',
    savedOff: 'statusSavedOff',
    private: 'statusPrivate',
    unsupported: 'unsupportedHint',
  }[kind];
  $('status').querySelector('span').textContent = t(status);
  document.body.dataset.state = direct || kind === 'private' ? 'direct' : kind;

  const toggle = $('toggle');
  toggle.disabled = !host || kind === 'private';
  toggle.textContent = t(direct ? 'btnRestore' : 'btnDirect');
  toggle.className = `big ${direct ? 'secondary' : 'primary'}`;
  const hint = {
    proxy: ['hintProxy', 'info'],
    savedOff: ['hintProxy', 'info'],
    temporary: ['hintTemporary', 'clock'],
    saved: ['hintSaved', 'check'],
    private: ['hintPrivate', 'check'],
  }[kind] ?? ['unsupportedHint', 'info'];
  $('hint').querySelector('span').textContent = t(hint[0]);
  $('hint').dataset.icon = hint[1];

  $('options').hidden = !host || kind === 'private';
  // Scope applies to both actions. "Whole site" covers the registrable domain; say exactly
  // what the current choice includes. Hidden for IP addresses, which have no site.
  const wideRoot = direct && route.rule.subdomains ? route.rule.domain : root;
  const wide = direct ? route.rule.subdomains : wideChoice;
  $('scope').hidden = !host || kind === 'private' || !wideRoot;
  $('scope-desc').textContent = wide
    ? t('optWideDesc', wideRoot ?? '')
    : t('scopeHostDesc', host ?? '');
  for (const button of $('scope').querySelectorAll('[data-wide]'))
    button.setAttribute('aria-checked', String((button.dataset.wide === 'true') === wide));
  $('remember').checked = ['saved', 'savedOff'].includes(kind);
  $('remember').disabled = !settings.alwaysOn;
  $('rememberHint').hidden = settings.alwaysOn;

  if (conflict) toast(t(conflict), 'error');
}

// Apply a change, then reload the page if its route actually changed.
async function change(message) {
  const before = routeKey(snap);
  snap = await request({ ...message, host: snap.host });
  render();
  if (snap.settings.autoReload && before !== routeKey(snap) && tab?.id != null) {
    try {
      await chrome.tabs.reload(tab.id);
    } catch {
      toast(t('reloadFailed'));
    }
  }
}

// Re-render even on failure so switches never show a state that was not saved.
const act = (task) =>
  busy(async () => {
    try {
      await task();
    } finally {
      if (snap) render();
    }
  });

const setPage = (direct, remember, wide) =>
  change({ type: 'setPage', tabId: tab?.id, direct, remember, wide });

$('toggle').addEventListener('click', () =>
  act(() => (isDirect(snap) ? setPage(false) : setPage(true, false, wideChoice))),
);
for (const button of $('scope').querySelectorAll('[data-wide]'))
  button.addEventListener('click', () =>
    act(async () => {
      const next = button.dataset.wide === 'true';
      const current = isDirect(snap) ? snap.route.rule.subdomains : wideChoice;
      if (next === current) return;
      wideChoice = next;
      try {
        localStorage.setItem('wideChoice', String(wideChoice));
      } catch {}
      if (isDirect(snap)) await setPage(true, snap.route.kind === 'saved', wideChoice);
    }),
  );
// "Always" only changes persistence: turning it off keeps the page direct for this tab.
$('remember').addEventListener('change', (event) =>
  act(() =>
    setPage(true, event.target.checked, isDirect(snap) ? snap.route.rule.subdomains : wideChoice),
  ),
);
$('alwaysOn').addEventListener('change', (event) =>
  act(() => change({ type: 'alwaysOn', value: event.target.checked })),
);
$('openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('count').addEventListener('click', () => chrome.runtime.openOptionsPage());

localize();
enhanceSwitches();
enhanceButtons();
$('version').textContent = `v${chrome.runtime.getManifest().version}`;
busy(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = /^https?:\/\//.test(tab?.url ?? '') ? new URL(tab.url).hostname : null;
  snap = await request({ type: 'snapshot', host });
  render();
  markReady();
});
