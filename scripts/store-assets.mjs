// Builds the Microsoft Edge Add-ons listing images into store/edge/.
// Run `npm run test:browser` and `TEST_LANG=en npm run test:browser` first: the screenshots are
// composed from the real UI captures in test-results/.
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'store', 'edge');
const shots = path.join(root, 'test-results');

const icon = await readFile(path.join(root, 'scripts/icon.svg'), 'utf8');
const img = async (name) =>
  `data:image/png;base64,${(await readFile(path.join(shots, name))).toString('base64')}`;

const COPY = {
  'zh-CN': {
    name: '网站直连开关',
    s1: ['代理常开，一键让当前网站直连', '学校系统、政务网站、有地区限制的视频，开着代理打不开？点一下「本页直连」，其他网站照常走代理。'],
    s2: ['常驻直连 · 包含整个站点', '常用的网站加入常驻列表，一个总开关统一启停；可连同整个站点的子域名一起直连。'],
    s3: ['浅色、深色，跟随系统', '只在需要时接管代理，关闭标签页自动恢复。不读取网页内容，不联网，不统计。'],
    tagline: '代理常开，一键让当前网站直连',
    short: '一键让当前网站直连',
  },
  en: {
    name: 'Direct Switch',
    s1: ['Keep your proxy on. Connect this site directly.', 'Campus portals, government services, region-locked video: one click on “Connect directly” and every other site keeps using the proxy.'],
    s2: ['Saved sites · whole-site rules', 'Keep sites you use often on a list with one master switch, and include all of a site’s subdomains when needed.'],
    s3: ['Light or dark, or follow the system', 'Takes control of the proxy only while needed and lets go when the tab closes. No page access, no network requests, no analytics.'],
    tagline: 'Keep your proxy on. Connect this site directly.',
    short: 'Connect this site directly',
    large: 'Keep your proxy on, go direct here',
  },
}; // prettier-ignore

const BASE = `<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', 'Microsoft YaHei UI', sans-serif; color: #1d1d1f; }
  .shot { position: relative; width: 1280px; height: 800px; overflow: hidden;
    background: radial-gradient(90% 70% at 50% 0%, #ffffff, #eceef4 70%); }
  .brand { position: absolute; left: 56px; top: 44px; display: flex; gap: 12px; align-items: center;
    font-weight: 650; font-size: 20px; color: #3a3d55; }
  .brand svg { width: 36px; height: 36px; }
  h1 { font-size: 46px; font-weight: 700; letter-spacing: -0.01em; }
  p.sub { margin-top: 14px; font-size: 21px; line-height: 1.55; color: #5d6178; }
  .frame { border-radius: 22px; box-shadow: 0 0 0 1px rgb(0 0 0 / 6%), 0 26px 60px -28px rgb(30 30 80 / 45%); }
</style>`;

const pages = {
  async s1(lang, c) {
    return `<div class="shot"><div class="brand">${icon}${c.name}</div>
      <div style="position:absolute;top:118px;left:0;right:0;text-align:center;padding:0 120px">
        <h1>${c.s1[0]}</h1><p class="sub">${c.s1[1]}</p></div>
      <img src="${await img(`flow-${lang}.png`)}" style="position:absolute;left:50%;bottom:34px;height:470px;transform:translateX(-50%)"></div>`;
  },
  async s2(lang, c) {
    return `<div class="shot"><div class="brand">${icon}${c.name}</div>
      <div style="position:absolute;left:56px;top:250px;width:440px"><h1 style="font-size:38px">${c.s2[0]}</h1><p class="sub">${c.s2[1]}</p></div>
      <div class="frame" style="position:absolute;right:56px;top:70px;width:670px;height:660px;overflow:hidden">
        <img src="${await img(`options-${lang}.png`)}" style="width:900px;margin:-30px 0 0 -105px"></div></div>`;
  },
  async s3(lang, c) {
    return `<div class="shot"><div class="brand">${icon}${c.name}</div>
      <div style="position:absolute;left:56px;top:250px;width:420px"><h1 style="font-size:40px">${c.s3[0]}</h1><p class="sub">${c.s3[1]}</p></div>
      <img class="frame" src="${await img(`popup-${lang}.png`)}" style="position:absolute;left:520px;top:150px;width:330px">
      <img class="frame" src="${await img(`popup-dark-${lang}.png`)}" style="position:absolute;left:880px;top:190px;width:330px"></div>`;
  },
};

const tile = (
  w,
  h,
  c,
  withPopup,
  text = c.tagline,
) => `<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;
    background:linear-gradient(135deg,#6a6af0,#4b4bc8);color:#fff;font-family:'Segoe UI','Microsoft YaHei UI',sans-serif">
  <div style="position:absolute;left:${h * 0.16}px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:${h * 0.08}px">
    <div style="width:${h * 0.34}px;height:${h * 0.34}px;filter:drop-shadow(0 6px 16px rgb(0 0 0/.25))">${icon.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    <div><div style="font-size:${h * 0.15}px;font-weight:700">${c.name}</div>
      <div style="margin-top:${h * 0.03}px;font-size:${h * (withPopup ? 0.062 : 0.07)}px;opacity:.9;line-height:1.35;white-space:nowrap">${text}</div></div></div>
  ${withPopup ? `<img src="${withPopup}" style="position:absolute;right:${h * 0.12}px;top:${h * 0.12}px;height:${h * 0.95}px;border-radius:20px;box-shadow:0 20px 50px rgb(0 0 0/.35)">` : ''}
</div>`;

const browser = await chromium.launch({ channel: process.env.TEST_BROWSER || 'msedge' });
const page = await browser.newPage();
async function render(html, file, width, height, transparent = false) {
  await page.setViewportSize({ width, height });
  await page.setContent(`${BASE}<body style="margin:0">${html}</body>`);
  await page.screenshot({
    path: file,
    clip: { x: 0, y: 0, width, height },
    omitBackground: transparent,
  });
  console.log(path.relative(root, file));
}

await mkdir(out, { recursive: true });
await render(
  `<div style="width:300px;height:300px">${icon.replace('<svg ', '<svg width="300" height="300" ')}</div>`,
  path.join(out, 'logo-300.png'),
  300,
  300,
  true,
);
for (const [lang, c] of Object.entries(COPY)) {
  await mkdir(path.join(out, lang), { recursive: true });
  let n = 1;
  for (const make of Object.values(pages))
    await render(await make(lang, c), path.join(out, lang, `screenshot-${n++}.png`), 1280, 800);
  await render(
    tile(440, 280, c, null, c.short),
    path.join(out, lang, 'promo-small-440x280.png'),
    440,
    280,
  );
  await render(
    tile(1400, 560, c, await img(`popup-direct-${lang}.png`), c.large ?? c.tagline),
    path.join(out, lang, 'promo-large-1400x560.png'),
    1400,
    560,
  );
}
await browser.close();
