export const $ = (id) => document.getElementById(id);

export function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {}
}

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

// Enable transitions only after the first render, so saved states appear without animating.
export const markReady = () =>
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.documentElement.classList.add('ready')),
  );

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

// Makes `.switch` checkboxes draggable like a native toggle: the thumb follows the pointer and
// lands on the nearer side; a tap toggles. Pointer input is handled here end to end and the
// browser's own click toggle is cancelled, so a gesture can never toggle twice. Keyboard
// (Space) still uses the native behavior.
export function enhanceSwitches(root = document) {
  for (const input of root.querySelectorAll('input.switch')) {
    let start = null;
    let ownClick = false;
    const travel = () => parseFloat(getComputedStyle(input).getPropertyValue('--travel')) || 20;
    const set = (next) => {
      if (next === input.checked) return;
      input.checked = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const reset = () => {
      start = null;
      input.classList.remove('pressed', 'dragging');
      input.style.removeProperty('--p');
    };
    input.addEventListener('pointerdown', (event) => {
      if (input.disabled || event.button !== 0) return;
      start = {
        x: event.clientX,
        p: input.checked ? 1 : 0,
        p2: input.checked ? 1 : 0,
        moved: false,
      };
      input.setPointerCapture(event.pointerId);
      input.classList.add('pressed');
    });
    input.addEventListener('pointermove', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      if (!start.moved && Math.abs(dx) < 3) return;
      start.moved = true;
      start.p2 = Math.min(1, Math.max(0, start.p + dx / travel()));
      input.classList.add('dragging');
      input.style.setProperty('--p', start.p2);
    });
    input.addEventListener('pointerup', () => {
      if (!start) return;
      const next = start.moved ? start.p2 >= 0.5 : !input.checked;
      reset();
      ownClick = true; // the click that follows this pointerup belongs to us
      setTimeout(() => (ownClick = false), 0);
      set(next);
    });
    input.addEventListener('pointercancel', reset);
    input.addEventListener(
      'click',
      (event) => {
        if (!ownClick) return;
        ownClick = false;
        event.preventDefault();
      },
      true,
    );
  }
}
