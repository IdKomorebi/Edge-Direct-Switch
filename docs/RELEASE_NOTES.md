## Edge Direct Switch 2.2.0 · 网站直连开关

代理一直开着，某个网站打不开时，点一下让它单独直连。
Keep your proxy on and let one website connect directly with one click.

### 2.2 新变化 / What's new in 2.2

- 玻璃质感开关：更长，按住时圆钮变成透明玻璃并折射底下的轨道，带弹性回弹；主按钮有跟随鼠标的柔光。
  Glass switches with spring motion; a soft pointer light on primary buttons.
- 实测：接管后走代理的网站没有额外延迟，节点波动也不会触发直连兜底（README 有数据）。
  Measured: no added latency for proxied sites, and proxy hiccups never trigger the DIRECT fallback.

### 2.1 新变化 / What's new in 2.1

- 「包含整个站点」在弹窗和设置页含义统一，并直接显示实际范围。
  “Whole site” now means the same in the popup and Settings, with the scope shown.
- 外观可选：跟随系统 / 浅色 / 深色。Appearance: System / Light / Dark.
- 开关可拖动、更大，点击文字不再误触。Draggable, larger switches; labels no longer toggle.

### 2.0 主要变化 / Highlights of 2.0

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

下载 `edge-direct-switch-2.2.0.zip` 并解压到固定文件夹 → 打开 `edge://extensions` → 开启「开发人员模式」→「加载解压缩的扩展」→ 选择包含 `manifest.json` 的文件夹。之后在设置里确认代理端口。

Download and extract the ZIP, open `edge://extensions`, enable Developer mode, choose **Load unpacked** and select the extracted folder. Then check the proxy port in Settings.

`SHA256SUMS.txt` lists the ZIP checksum (integrity only, not a code signature).
