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

// ---------- Switches and buttons ----------
// `.switch` checkboxes can be tapped or dragged. Spring physics drive CSS variables on the
// input (styles.css draws everything); while held, the thumb becomes a glass lens that
// refracts the track through an SVG displacement filter (Chromium supports url() in
// backdrop-filter). Pointer input is handled end to end and the browser's own click toggle is
// cancelled, so a gesture never toggles twice; the keyboard (Space) keeps native behavior.

const SVG = 'http://www.w3.org/2000/svg';

// Displacement map for a capsule lens: pixels near the rim are pulled outward, the centre
// stays put, so whatever is behind the thumb bends at its edge like real glass.
function lensMap(w, h, bezel) {
  const s = 2;
  const canvas = Object.assign(document.createElement('canvas'), { width: w * s, height: h * s });
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const r = h / 2;
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      const x = (px + 0.5) / s;
      const y = (py + 0.5) / s;
      const cx = Math.min(Math.max(x, r), w - r);
      let nx = x - cx;
      let ny = y - r;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const t = Math.max(0, Math.min(1, 1 - (r - len) / bezel));
      const k = t * t * (3 - 2 * t);
      const i = (py * canvas.width + px) * 4;
      img.data[i] = 128 - nx * k * 127;
      img.data[i + 1] = 128 - ny * k * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

const filters = new Map();
function lensFilter(w, h) {
  const id = `eds-lens-${w}x${h}`;
  if (filters.has(id)) return filters.get(id);
  let host = document.getElementById('eds-filters');
  if (!host) {
    host = document.createElementNS(SVG, 'svg');
    host.id = 'eds-filters';
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, { position: 'absolute', width: 0, height: 0 });
    document.body.append(host);
  }
  const filter = document.createElementNS(SVG, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const image = document.createElementNS(SVG, 'feImage');
  for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, result: 'map' }))
    image.setAttribute(k, v);
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('href', lensMap(w, h, Math.round(h * 0.3)));
  const displace = document.createElementNS(SVG, 'feDisplacementMap');
  const attrs = {
    in: 'SourceGraphic',
    in2: 'map',
    scale: Math.round(h * 0.28),
    xChannelSelector: 'R',
    yChannelSelector: 'G',
  };
  for (const [k, v] of Object.entries(attrs)) displace.setAttribute(k, v);
  filter.append(image, displace);
  host.append(filter);
  const value = `url(#${id})`;
  filters.set(id, value);
  return value;
}

const spring = (value) => ({ value, target: value, vel: 0 });
function step(s, dt, k, c) {
  s.vel += (k * (s.target - s.value) - c * s.vel) * dt;
  s.value += s.vel * dt;
  if (Math.abs(s.target - s.value) < 5e-4 && Math.abs(s.vel) < 1e-3) {
    s.value = s.target;
    s.vel = 0;
    return false;
  }
  return true;
}

export function enhanceSwitches(root = document) {
  for (const input of root.querySelectorAll('input.switch')) {
    const css = getComputedStyle(input);
    const num = (name) => parseFloat(css.getPropertyValue(name));
    input.style.setProperty('--lens-filter', lensFilter(num('--lw'), num('--lh')));
    const travel = () => num('--travel') || 20;

    const pos = spring(input.checked ? 1 : 0);
    const lens = spring(0);
    const stretch = spring(0);
    let raf = 0;
    let last = 0;
    let drag = null;
    let ownClick = false;

    const paint = () => {
      const st = Math.max(-0.08, Math.min(0.14, stretch.value));
      input.style.setProperty('--p', pos.value);
      input.style.setProperty('--lens', Math.max(0, lens.value));
      input.style.setProperty('--sx', 1 + st);
      input.style.setProperty('--sy', 1 - st * 0.5);
    };
    const settle = () => {
      input.classList.remove('animating');
      for (const v of ['--p', '--lens', '--sx', '--sy']) input.style.removeProperty(v);
    };
    const tick = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      let moving = step(lens, dt, 420, 30);
      moving = step(stretch, dt, 320, 20) || moving;
      if (!drag) moving = step(pos, dt, 480, 30) || moving;
      paint();
      if (moving || drag) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        settle();
      }
    };
    const kick = () => {
      input.classList.add('animating');
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const set = (next) => {
      pos.target = next ? 1 : 0;
      kick();
      if (next === input.checked) return;
      input.checked = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    input.addEventListener('pointerdown', (event) => {
      if (input.disabled || event.button !== 0) return;
      input.setPointerCapture(event.pointerId);
      pos.value = pos.target = input.checked ? 1 : 0;
      drag = {
        x: event.clientX,
        start: pos.value,
        moved: false,
        lx: event.clientX,
        lt: event.timeStamp,
      };
      lens.target = 1;
      kick();
    });
    input.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 3) return;
      drag.moved = true;
      const raw = drag.start + dx / travel();
      pos.value = raw < 0 ? raw * 0.2 : raw > 1 ? 1 + (raw - 1) * 0.2 : raw; // rubber band
      const v = (event.clientX - drag.lx) / Math.max(1, event.timeStamp - drag.lt);
      stretch.target = Math.min(0.14, Math.abs(v) * 0.08);
      drag.lx = event.clientX;
      drag.lt = event.timeStamp;
    });
    const release = () => {
      if (!drag) return;
      const next = drag.moved ? pos.value >= 0.5 : !input.checked;
      drag = null;
      stretch.target = 0;
      ownClick = true; // the click that follows belongs to this gesture
      setTimeout(() => (ownClick = false), 0);
      set(next);
      setTimeout(() => {
        lens.target = 0; // keep the glass visible while it travels
        kick();
      }, 120);
    };
    input.addEventListener('pointerup', release);
    input.addEventListener('pointercancel', release);
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

// Soft light that follows the pointer on primary buttons, with a small give while held.
export function enhanceButtons(root = document) {
  for (const button of root.querySelectorAll('.primary')) {
    button.addEventListener('pointermove', (event) => {
      const r = button.getBoundingClientRect();
      button.style.setProperty('--mx', `${event.clientX - r.left}px`);
      button.style.setProperty('--my', `${event.clientY - r.top}px`);
    });
    button.addEventListener('pointerdown', () => button.classList.add('held'));
    for (const type of ['pointerup', 'pointerleave', 'pointercancel'])
      button.addEventListener(type, () => button.classList.remove('held'));
  }
}
