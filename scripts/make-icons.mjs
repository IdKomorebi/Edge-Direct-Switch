// Renders extension/icons/*.png from the SVG below. Maintainers only: `node scripts/make-icons.mjs`.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A straight arrow (direct) passing under a faded detour (proxy).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7474f2"/><stop offset="1" stop-color="#4b4bc8"/></linearGradient></defs>
  <rect width="128" height="128" rx="30" fill="url(#g)"/>
  <path d="M30 80 C30 38, 98 38, 98 62" fill="none" stroke="#fff" stroke-opacity=".45"
    stroke-width="9" stroke-linecap="round" stroke-dasharray="1 17"/>
  <path d="M28 82 H88" stroke="#fff" stroke-width="13" stroke-linecap="round"/>
  <path d="M82 64 L104 82 L82 100 Z" fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
</svg>`;

const browser = await chromium.launch({ channel: process.env.TEST_BROWSER || 'msedge' });
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({
    path: path.join(root, 'extension/icons', `${size}.png`),
    omitBackground: true,
  });
}
await browser.close();
