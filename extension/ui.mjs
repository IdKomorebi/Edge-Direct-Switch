export const $ = (id) => document.getElementById(id);

export const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

// Errors from core/controller carry message keys such as `errInvalidDomain`.
export const errorText = (error) =>
  /^err\w+$/.test(error?.message) ? t(error.message) : String(error?.message || error);

export function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]'))
    el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  }
}

export async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'errNoResponse');
  return response.data;
}

let timer;
export function toast(text, kind = 'info') {
  const el = $('message');
  clearTimeout(timer);
  el.textContent = text;
  el.className = `toast ${kind}`;
  el.hidden = !text;
  if (text && kind === 'info') timer = setTimeout(() => (el.hidden = true), 2400);
}

// Runs actions one after another (never dropped) and reports failures in the toast.
let queue = Promise.resolve();
let pending = 0;
export function busy(task) {
  pending++;
  document.body.classList.add('busy');
  queue = queue
    .then(task)
    .catch((error) => toast(errorText(error), 'error'))
    .finally(() => {
      if (--pending === 0) document.body.classList.remove('busy');
    });
  return queue;
}
