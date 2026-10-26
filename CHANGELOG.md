# Changelog

## 2.3.3 — 2026-10-26

- **"Whole site" is now on by default in the popup**, and the last choice is remembered. Tested on real portals: `gmis.xjtu.edu.cn` redirects to `org.xjtu.edu.cn` and `login.xjtu.edu.cn`, so a single-host "Connect directly" left those on the proxy and the page still failed. The browser test now checks that a sibling subdomain is direct.

## 2.3.2 — 2026-10-26

- Drop the optional `short_name` from the manifest: "Direct Switch" exceeds the 12-character limit flagged by the Edge Add-ons validator. The full name is used instead; the popup header is unchanged.

## 2.3.1 — 2026-10-26

- Settings: a clear warning that the proxy port must match your proxy app, and a "?" next to the heading that explains why the port is needed.
- Microsoft Edge Add-ons listing materials in `store/edge/` (`npm run store`).

## 2.3.0 — 2026-10-26

- **Works in Google Chrome as well as Microsoft Edge** — one package for both. The English name is now **Direct Switch** (Chinese: 网站直连开关) and the download is `direct-switch-x.y.z.zip`.
- CI runs the real-browser test in both Edge and Chromium.
- FAQ: what is left after uninstalling (nothing), and how to upgrade without losing settings.

## 2.2.0 — 2026-10-26

- **Glass switches:** longer, spring-animated, and while held the thumb turns into a clear lens that refracts the track beneath it; dragging stretches it slightly. Primary buttons get a soft light that follows the pointer.
- **Measured routing impact** (`npm run bench`): with a direct rule active, proxied sites showed no extra latency against a plain fixed proxy, and proxy hiccups (reset / 502 / dropped tunnels) never caused a fallback to DIRECT. The fallback only kicks in when the proxy port cannot be reached at all.
- Docs explain exactly when the extension takes control of Edge's proxy.

## 2.1.0 — 2026-10-25

- **“Whole site” means the same everywhere.** The settings page used to extend a rule only below the typed host (`*.cpipc.acge.org.cn`), while the popup covered the whole site (`*.acge.org.cn`). Both now use the site, the exact scope is shown, and Settings previews what will be added. Shared-hosting suffixes such as `github.io` are recognized.
- **Appearance setting:** System / Light / Dark. Light is now neutral grey with frosted surfaces (no colored backdrop); dark keeps a subtle glow.
- **Switches can be dragged** as well as tapped, are larger, and only the switch reacts — clicking a label no longer toggles it.
- Clearer status pill, settings and count buttons in the popup; larger corner radii.
- Fix: a gap could appear at the popup edge; switches no longer animate when a page opens.

## 2.0.0 — 2026-10-25

A redesign focused on a smaller footprint and a simpler popup.

- **Controls Edge's proxy only while a direct rule is active.** With nothing to bypass, control is handed back and Edge follows the system proxy. 1.x kept control as soon as routing was enabled.
- **One-time direct ends when its tab closes** (or Edge restarts) instead of after 30 minutes, so a page no longer switches back mid-use. The `alarms` permission is gone.
- **Saved sites master switch**: turn the whole always-direct list on or off; one-time direct keeps working either way.
- **Fallback to DIRECT when the proxy is unreachable** (on by default), so closing the proxy client doesn't break Edge.
- **Whole-site option** (`*.xjtu.edu.cn`) for sites that use several subdomains.
- New compact popup and settings page, dark mode, new icon, English + Simplified Chinese UI.
- The background worker no longer rewrites the proxy setting on every wake-up; identical settings are not re-applied.
- 1.x settings and permanent rules are migrated automatically.

## 1.0.0 — 2026-10-25

Initial release: temporary (30 min) and permanent domain rules, pause/resume, HTTP/HTTPS/SOCKS5 endpoints.
