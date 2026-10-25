## Edge Direct Switch 2.0.0 · 网站直连开关

代理一直开着，某个网站打不开时，点一下让它单独直连。
Keep your proxy on and let one website connect directly with one click.

### 新变化 / What's new

- 只有存在生效的直连网站时才接管 Edge 代理，其余时间完全跟随系统代理。
  Controls Edge's proxy only while a direct rule is active.
- 「本页直连」在关闭标签页后结束，不再 30 分钟后中途失效。
  One-time direct ends when its tab closes.
- 「常驻直连」总开关；代理软件关闭时自动直连；可选包含整个站点。
  Saved-sites master switch, DIRECT fallback, whole-site option.
- 全新简洁界面，支持深色模式，中英文界面。
  New compact UI with dark mode, English and Chinese.

1.x 的设置和常驻网站会自动迁移。/ 1.x settings migrate automatically.

### 安装 / Install

下载 `edge-direct-switch-2.0.0.zip` 并解压到固定文件夹 → 打开 `edge://extensions` → 开启「开发人员模式」→「加载解压缩的扩展」→ 选择包含 `manifest.json` 的文件夹。之后在设置里确认代理端口。

Download and extract the ZIP, open `edge://extensions`, enable Developer mode, choose **Load unpacked** and select the extracted folder. Then check the proxy port in Settings.

`SHA256SUMS.txt` lists the ZIP checksum (integrity only, not a code signature).
