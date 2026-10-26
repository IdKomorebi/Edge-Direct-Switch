# Microsoft Edge Add-ons listing

Everything entered in Partner Center for the store listing, kept here so updates stay consistent.
Images: `npm run store` (after `npm run test:browser` in both languages) writes them next to this file.

| Field                  | Value                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| Package                | `dist/direct-switch-<version>.zip` (`npm run pack`)                              |
| Visibility / markets   | Public · all markets                                                             |
| Category               | Productivity                                                                     |
| Personal data          | **No** — the extension does not access, collect or transmit personal information |
| Privacy policy URL     | https://github.com/IdKomorebi/Edge-Direct-Switch/blob/main/PRIVACY.md            |
| Website                | https://github.com/IdKomorebi/Edge-Direct-Switch                                 |
| Support                | https://github.com/IdKomorebi/Edge-Direct-Switch/issues                          |
| Mature content         | No                                                                               |
| Store logo (300×300)   | `logo-300.png`                                                                   |
| Small promo (440×280)  | `<lang>/promo-small-440x280.png`                                                 |
| Large promo (1400×560) | `<lang>/promo-large-1400x560.png`                                                |
| Screenshots (1280×800) | `<lang>/screenshot-1.png` … `screenshot-3.png`                                   |

Submitted 2026-10-26 (version 2.3.2), in review.

| Identifier         | Value                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Microsoft Store ID | `0RDCKGM7767G`                                                                                             |
| CRX ID             | `mjannkajnlaailcolbpbgjmgimlaeoji`                                                                         |
| Listing URL        | `https://microsoftedge.microsoft.com/addons/detail/mjannkajnlaailcolbpbgjmgimlaeoji` (live once published) |

On the submit page, answer "testers need other information" with **yes** so the certification notes below can be entered (no account is required; the notes are testing steps). Notes are required again with every submission.

Name and short description come from the package (`_locales`): 网站直连开关 / Direct Switch.

## 简体中文 (zh-CN)

### Description

```text
代理一直开着，某个网站打不开时，点一下让它单独直连，其他网站继续走代理。

为了访问海外服务，很多人的代理软件（Clash、v2rayN 等）全天开着；但学校和单位的系统、政务网站、部分有地区版权限制的视频网站，经过代理反而打不开。不用再去代理软件里切换模式或加规则，在浏览器里点一下就好。

主要功能
• 本页直连：当前网站立即改为直连并自动刷新，关闭这个标签页后自动恢复代理。
• 包含整个站点：连同同一站点的其他子域名一起直连（如 xjtu.edu.cn 及其所有子域名），界面会写明实际范围。
• 常驻直连：常用的网站加入列表，以后打开就是直连；一个总开关统一启用或停用整个列表。
• 代理软件关闭时自动直连（可关闭），局域网地址直连（可关闭）。
• 浅色 / 深色外观，可跟随系统；中英文界面。

工作方式
扩展通过浏览器的代理接口写入一段本地 PAC 规则：列表中的网站直连，其他网站发往你填写的代理端口。只有存在生效的直连规则时才接管浏览器的代理，没有时完全不碰代理设置；不修改 Windows 系统代理，也不影响其他软件。扩展后台空闲时自动休眠。

使用前请在设置中确认代理端口与你的代理软件一致（默认 HTTP 127.0.0.1:7890，内置 Clash / Clash Verge / v2rayN 常用端口）。

注意：代理软件开启 TUN（虚拟网卡）模式时，浏览器直连无法绕过它，需要在代理软件中为该网站添加直连规则。

隐私：不读取网页内容，没有内容脚本，扩展自身不发出任何网络请求，没有统计和云同步，设置只保存在本机。

开源（MIT）：https://github.com/IdKomorebi/Edge-Direct-Switch
```

### Search terms

`直连` · `代理切换` · `绕过代理` · `网站直连` · `PAC` · `Clash` · `proxy`

## English (en-US)

### Description

```text
Keep your proxy on. When one website won't load through it, connect just that site directly with one click — every other site keeps using the proxy.

Many people run a local proxy client (Clash, v2rayN …) all day. Some websites — campus and workplace portals, government services, region-locked video — refuse connections that arrive through the proxy. Instead of switching modes in the proxy client, open this extension and send only that site directly.

Features
• Connect directly: switches the current site and reloads it; the proxy comes back when you close the tab.
• Whole site: also include the site's other subdomains (e.g. xjtu.edu.cn and all its subdomains); the exact scope is always shown.
• Saved sites: keep sites you use often on a list, with one master switch to turn the whole list on or off.
• Go direct if the proxy is unreachable (optional); bypass the local network (optional).
• Light and dark appearance or follow the system; English and Simplified Chinese.

How it works
The extension gives the browser a small local PAC script through the proxy API: listed sites go DIRECT, everything else goes to the proxy port you enter. It takes control of the browser's proxy only while a direct rule is active and leaves it alone otherwise. Windows proxy settings and other apps are never touched. The background worker sleeps when idle.

Before use, check in Settings that the proxy port matches your proxy client (default HTTP 127.0.0.1:7890; common Clash / Clash Verge / v2rayN ports are one click away).

Note: if your proxy client runs in TUN / virtual adapter mode, browser DIRECT cannot bypass it; add a DIRECT rule in the client instead.

Privacy: no page access, no content scripts, no network requests of its own, no analytics or sync. Settings stay on your device.

Open source (MIT): https://github.com/IdKomorebi/Edge-Direct-Switch
```

### Search terms

`proxy bypass` · `direct connection` · `proxy switch` · `per-site proxy` · `PAC` · `Clash` · `bypass proxy`

## Notes for certification

```text
Purpose: lets users who keep a local proxy client running send selected websites DIRECT while all other traffic keeps using their proxy. Single purpose, no remote code, no data collection.

Permissions
- proxy: installs a local PAC script (DIRECT for the user's chosen sites, the user's own local proxy port for the rest) and releases it when no direct rule is active.
- activeTab: reads the current tab's host name when the user opens the popup.
- storage: keeps settings and the user's saved-site list locally.

How to test (no proxy server needed)
1. Open any website, e.g. https://www.example.com, and click the toolbar icon.
2. Click "Connect directly" (本页直连). The page reloads; the popup shows "Direct · this time". edge://net-internals/#proxy now shows a PAC script containing the host.
3. Close that tab: the rule is removed and, with no other rules, the extension releases the proxy setting (net-internals shows the system settings again).
4. Turn on "Always connect directly" to add a saved site; manage the list and the proxy port in Settings. Turning "Saved sites" off releases the proxy when nothing else is active.
With "Go direct if the proxy is unreachable" (on by default), browsing keeps working on a machine without a local proxy.

Source and tests: https://github.com/IdKomorebi/Edge-Direct-Switch
```
