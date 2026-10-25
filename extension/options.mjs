import { siteRule } from './core.mjs';
import {
  $,
  t,
  localize,
  request,
  toast,
  busy,
  enhanceSwitches,
  applyTheme,
  markReady,
} from './ui.mjs';

let snap;

function ruleRow(rule, onRemove) {
  const row = document.createElement('div');
  row.className = 'row';
  const text = document.createElement('span');
  text.className = 'row-text';
  const name = document.createElement('strong');
  name.textContent = rule.domain;
  const scope = document.createElement('small');
  scope.textContent = t(rule.subdomains ? 'scopeWide' : 'scopeExact');
  text.append(name, scope);
  const remove = document.createElement('button');
  remove.className = 'remove';
  remove.textContent = t('btnRemove');
  remove.setAttribute('aria-label', t('ariaRemove', rule.domain));
  remove.addEventListener('click', () => busy(() => update(onRemove(rule))));
  row.append(text, remove);
  return row;
}

function render(fillForm = false) {
  const { settings, temps, conflict } = snap;
  applyTheme(settings.theme);
  for (const button of $('theme').querySelectorAll('button'))
    button.setAttribute('aria-pressed', String(button.dataset.themeValue === settings.theme));
  $('alwaysOn').checked = settings.alwaysOn;
  for (const key of ['fallbackDirect', 'bypassPrivate', 'autoReload'])
    $(key).checked = settings[key];
  if (fillForm) {
    $('scheme').value = settings.proxy.scheme;
    $('proxy-host').value = settings.proxy.host;
    $('port').value = settings.proxy.port;
  }

  const sites = [...settings.sites].sort((a, b) => a.domain.localeCompare(b.domain));
  $('sites').replaceChildren(
    ...sites.map((rule) => ruleRow(rule, (r) => ({ type: 'removeSite', rule: r }))),
  );
  $('sites').classList.toggle('off', !settings.alwaysOn);
  if (!sites.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = t('emptySaved');
    $('sites').append(empty);
  }

  $('temps-card').hidden = !temps.length;
  $('temps').replaceChildren(
    ...temps.map((rule) => ruleRow(rule, (r) => ({ type: 'removeTemp', rule: r }))),
  );
  if (conflict) toast(t(conflict), 'error');
}

async function update(message, fillForm = false) {
  snap = await request(message);
  render(fillForm);
}

const saveSettings = (proxy = snap.settings.proxy, extra = {}) =>
  update({
    type: 'settings',
    proxy,
    ...extra,
    fallbackDirect: $('fallbackDirect').checked,
    bypassPrivate: $('bypassPrivate').checked,
    autoReload: $('autoReload').checked,
  });

$('alwaysOn').addEventListener('change', (event) =>
  busy(() => update({ type: 'alwaysOn', value: event.target.checked })).finally(
    () => snap && render(),
  ),
);
for (const key of ['fallbackDirect', 'bypassPrivate', 'autoReload'])
  $(key).addEventListener('change', () =>
    busy(() => saveSettings()).finally(() => snap && render()),
  );

// Show exactly what will be added, so "whole site" is never a surprise.
function preview() {
  let text = '';
  try {
    const rule = siteRule($('domain').value, $('subdomains').checked);
    text = rule.subdomains ? t('previewWide', rule.domain) : t('previewExact', rule.domain);
  } catch {}
  $('preview').textContent = $('domain').value.trim() ? text : '';
}
$('domain').addEventListener('input', preview);
$('subdomains').addEventListener('change', preview);

for (const button of $('theme').querySelectorAll('button'))
  button.addEventListener('click', () => {
    applyTheme(button.dataset.themeValue); // instant feedback, then persist
    busy(() => saveSettings(undefined, { theme: button.dataset.themeValue }));
  });

$('add-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const domain = $('domain').value;
  const subdomains = $('subdomains').checked;
  busy(async () => {
    await update({ type: 'addSite', rule: { domain, subdomains } });
    // Only clear what was submitted; the user may already be typing the next one.
    if ($('domain').value === domain) {
      $('domain').value = '';
      $('subdomains').checked = false;
      preview();
    }
  });
});

$('proxy-form').addEventListener('submit', (event) => {
  event.preventDefault();
  busy(async () => {
    await saveSettings({
      scheme: $('scheme').value,
      host: $('proxy-host').value,
      port: $('port').value,
    });
    render(true);
    toast(t('msgSaved'));
  });
});
for (const preset of document.querySelectorAll('.presets button'))
  preset.addEventListener('click', () => {
    $('scheme').value = preset.dataset.scheme;
    $('port').value = preset.dataset.port;
    $('proxy-host').value ||= '127.0.0.1';
    $('proxy-form').requestSubmit();
  });

localize();
enhanceSwitches();
$('version').textContent = `v${chrome.runtime.getManifest().version}`;
busy(() => update({ type: 'snapshot' }, true)).then(markReady);
// Keep the page current when the popup changes something in another window.
chrome.storage.onChanged.addListener(() => busy(() => update({ type: 'snapshot' })));
