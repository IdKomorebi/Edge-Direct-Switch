# Changelog

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
