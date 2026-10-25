## Edge Direct Switch 1.0.0 · 网站直连开关

Select websites that should bypass your browser proxy while keeping other websites on your configured local proxy endpoint.

### Install / 安装

Download `edge-direct-switch-1.0.0.zip`, extract it to a permanent directory, then open `edge://extensions`, enable Developer mode and choose **Load unpacked**. Select the extracted folder containing `manifest.json`.

下载 ZIP 后解压，在 Edge 扩展管理页开启开发人员模式，加载包含 `manifest.json` 的目录。默认代理地址为示例值 `127.0.0.1:7892`，请先确认与你的客户端一致。

### Included

- Temporary and permanent domain-based DIRECT rules.
- Optional subdomain matching and local-network bypass.
- Source-tab cleanup, session cleanup, pause/resume and proxy ownership checks.
- HTTP, HTTPS and SOCKS5 proxy endpoint configuration.
- Local-only settings; no telemetry, remote scripts or page-content access.
- Chinese interface, bilingual documentation and an MIT License.

### Scope and validation

Rules affect **all tabs for a matching domain** in the Edge profile. This is not per-tab isolation or HTTPS path matching. DIRECT does not override TUN/VPN routing. The extension has not been published to the Edge Add-ons store.

Unit tests pass. Real Edge 155.0.4283.45 routing was verified against local HTTP target/proxy marker servers, including selected-domain DIRECT, other-domain PROXY, rule deletion, temporary cleanup and pause. External example sites and every proxy/VPN combination were not tested.

See [installation and limitations](https://github.com/IdKomorebi/Edge-Direct-Switch#readme) and [troubleshooting](https://github.com/IdKomorebi/Edge-Direct-Switch/blob/main/docs/TROUBLESHOOTING.md).

`SHA256SUMS.txt` contains the SHA-256 digest of the extension ZIP. This is an integrity checksum, not a code-signing certificate.
