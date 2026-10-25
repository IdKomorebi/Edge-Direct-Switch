<p align="center"><img src="extension/icons/128.png" width="80" alt="Edge Direct Switch icon"></p>

# Edge Direct Switch

**Keep your proxy on. Connect selected websites directly.**

让指定网站直连，其他网站继续使用代理。

[简体中文](README.zh-CN.md) · [Download](https://github.com/IdKomorebi/Edge-Direct-Switch/releases/latest) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Contributing](CONTRIBUTING.md)

[![Tests](https://github.com/IdKomorebi/Edge-Direct-Switch/actions/workflows/test.yml/badge.svg)](https://github.com/IdKomorebi/Edge-Direct-Switch/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/IdKomorebi/Edge-Direct-Switch)](https://github.com/IdKomorebi/Edge-Direct-Switch/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-087f70.svg)](LICENSE)

A small Manifest V3 extension for desktop Microsoft Edge. Add temporary or permanent **domain-based DIRECT rules** from the toolbar while every other website uses your configured HTTP, HTTPS or SOCKS5 proxy endpoint.

Useful when you keep a local proxy client running but occasionally need to access a campus portal, workplace system, regional streaming service or another site through your normal network connection.

> Rules affect all matching domains in the Edge profile, including other tabs. This is **not per-tab isolation**. Browser DIRECT does not override a system-level VPN or TUN route.

## Features

- Temporary direct connection: expires after 30 minutes or when its source tab closes.
- Permanent rules: exact host matching, with optional subdomains.
- Pause and resume: release Edge proxy control without deleting rules.
- Optional local-network bypass for private IP literals, localhost and single-label hosts.
- Local-only settings: no telemetry, remote scripts, cloud sync or page-content access.
- No runtime npm dependencies. The current interface is in **Simplified Chinese**; English UI translation contributions are welcome.

## Install in Edge

The extension is distributed through GitHub, **not the Edge Add-ons store**.

1. Download `edge-direct-switch-1.0.0.zip` from the [latest release](https://github.com/IdKomorebi/Edge-Direct-Switch/releases/latest).
2. Extract it into a directory you will keep. Do not load the ZIP directly.
3. Open `edge://extensions` in Microsoft Edge and enable **Developer mode**.
4. Click **Load unpacked** and select the extracted directory containing `manifest.json`.
5. Pin the extension from the Extensions menu, open its settings and verify the proxy endpoint.

If you download the repository source ZIP instead, select its **`extension/` subdirectory**.

The default endpoint, **HTTP `127.0.0.1:7892`**, is an example. Change it to the address and port exposed by your proxy client. Installation starts with routing disabled; adding your first rule or choosing Enable routing activates it.

## Use it

1. Open the website you want to connect to directly and click the extension icon.
2. Choose **临时直连 30 分钟** (temporary) or **始终直连此网站** (permanent).
3. Optionally include subdomains. A rule for `portal.example.edu` does not automatically include `example.edu`.
4. Refresh the affected page. Automatic refresh is selected by default; turn it off if you have unsaved form data.

Use **删除此直连规则** to remove the matching rule, or **暂停分流** to pause routing. The settings page lists every rule and allows manual additions.

![The settings page with example rules](docs/images/settings.png)

_Actual Edge settings UI with example rules. Routing tests use local marker servers; the screenshot does not establish that these external sites are reachable._

## How routing works

```text
Matching explicit domain rule       → DIRECT
Optional local-network bypass       → DIRECT
All other URLs                      → Your configured proxy endpoint
```

The extension installs a self-contained local PAC script in the current Edge profile. It does not modify Windows proxy settings or other apps. Pausing releases its setting and restores the next applicable configuration, usually the system proxy.

While enabled, the extension uses a **fixed proxy endpoint**, not a live copy of the system PAC or automatic-detection settings. Update the extension if your client changes ports. Rules inside your proxy client can still operate on traffic sent to that endpoint.

## Limits to understand

| Situation                                        | What to expect                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Two tabs use the same domain                     | Both share the routing rule. The source tab only determines temporary-rule cleanup.                |
| One HTTPS path should be direct                  | HTTPS paths are normally stripped before PAC evaluation; path-specific matching is not supported.  |
| TUN, VPN or transparent routing is enabled       | DIRECT only skips the explicit browser proxy. Add a DIRECT rule in the client if needed.           |
| Login, CAPTCHA, API or video uses another domain | Add the required domain separately after checking the failed request.                              |
| Another extension or policy controls the proxy   | A conflict is shown. The extension does not repeatedly fight for control.                          |
| InPrivate                                        | No independent InPrivate support; the browser may inherit regular-window proxy settings.           |
| Proxy endpoint is unavailable                    | Unlisted sites fail instead of silently falling back to DIRECT. Pause routing or fix the endpoint. |

Existing requests and long-lived connections are not cancelled when rules change. Browser sleep can delay temporary-rule cleanup. Internal campus systems may require a campus network or institutional VPN.

See [troubleshooting](docs/TROUBLESHOOTING.md) for practical checks.

## Permissions and privacy

| Permission  | Purpose                                                    |
| ----------- | ---------------------------------------------------------- |
| `proxy`     | Set and release browser proxy routing                      |
| `activeTab` | Read the current website URL when you invoke the extension |
| `storage`   | Keep explicitly added rules and settings locally           |
| `alarms`    | Schedule temporary-rule cleanup                            |

No `<all_urls>`, `tabs` or `webRequest` permission; no content scripts. The extension does not read page contents, forms, passwords, cookies or browsing history. Your chosen proxy endpoint still handles proxied traffic as usual. See [PRIVACY.md](PRIVACY.md).

## Development and testing

Node.js **20+**:

```sh
npm ci
npm test
npm run format:check
npm run test:browser  # requires Microsoft Edge
npm run pack
```

Unit tests and packaging use Node.js built-ins and also work without installing development dependencies. ZIPs in `dist/` contain only extension files, with `manifest.json` at the root.

The browser test uses an isolated profile and local marker target/proxy servers. It verifies DIRECT/PROXY routing, removal, source-tab cleanup and pause behavior. **Windows + Edge 155.0.4283.45** passed on 2026-10-25. External example sites, every VPN configuration and real SOCKS5 services were not tested. See [testing details](docs/TESTING.md).

## Alternatives and references

For a full proxy-profile manager, consider [ZeroOmega](https://github.com/zero-peak/ZeroOmega). For system-wide or TUN routing, prefer your proxy client's domain rules. Edge Direct Switch is an independent implementation, not a fork of ZeroOmega.

Technical references: [Edge APIs](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support), [proxy API](https://developer.chrome.com/docs/extensions/reference/api/proxy), [Chromium PAC behavior](https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md), [setting precedence and lifecycle](https://developer.chrome.com/docs/extensions/reference/api/types).

Bug reports, translations and focused pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and the [changelog](CHANGELOG.md).

## License

[MIT](LICENSE) · Maintained by [IdKomorebi](https://github.com/IdKomorebi)
