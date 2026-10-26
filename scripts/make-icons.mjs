// Renders extension/icons/*.png from scripts/icon.svg. Maintainers only: `npm run icons`.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// scripts/icon.svg: a straight arrow (direct) passing under a faded detour (proxy).
const svg = await readFile(path.join(root, 'scripts/icon.svg'), 'utf8');

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
