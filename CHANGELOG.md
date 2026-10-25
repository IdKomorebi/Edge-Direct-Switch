# Changelog

## 1.0.0 — 2026-10-25

Initial public release.

- Domain-based direct routing with HTTP, HTTPS and SOCKS5 proxy endpoints.
- Temporary rules lasting up to 30 minutes, with source-tab close and browser-session cleanup.
- Permanent rules, optional subdomain matching and optional local-network bypass.
- Pause/resume, proxy ownership checks and rollback if saving settings fails.
- Local-only storage, minimal permissions and no remote scripts or telemetry.
- Chinese UI, Chinese/English documentation, troubleshooting and contributor guides.
- Unit tests, an isolated real-browser routing test, reproducible ZIP packaging and release checksums.

Known limitations: same-domain tabs share routing; HTTPS paths are not a reliable matching input; browser DIRECT does not bypass TUN/VPN routing. See the README for details.
