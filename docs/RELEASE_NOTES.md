## Direct Switch 2.3.0 · 网站直连开关 · Edge & Chrome

代理一直开着，某个网站打不开时，点一下让它单独直连。**Edge 和 Chrome 通用，同一个安装包。**
Keep your proxy on and let one website connect directly with one click. **One package for both Microsoft Edge and Google Chrome.**

### 安装 / Install

1. 下载 `direct-switch-2.3.0.zip`，解压到一个不会删除的文件夹。/ Download and extract it to a folder you will keep.
2. **Edge**：打开 `edge://extensions` → 开启「开发人员模式」→「加载解压缩的扩展」。
   **Chrome**：打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」。
3. 选择包含 `manifest.json` 的文件夹，然后在设置里确认代理端口。/ Choose the folder containing `manifest.json`, then check the proxy port in Settings.

**从旧版本升级 / Upgrading**：把新文件覆盖到原来的文件夹，再在扩展管理页点「重新加载」，设置会保留；换文件夹安装会被当成新扩展。
Overwrite the files in the original folder and click Reload to keep your settings.

### 2.3 新变化 / What's new in 2.3

- 支持 Google Chrome；英文名改为 **Direct Switch**。/ Chrome support; English name is now Direct Switch.
- CI 在 Edge 和 Chromium 上都运行真实浏览器测试。/ CI tests in both Edge and Chromium.

### 近期版本 / Recent highlights

- 2.2：玻璃质感开关；实测接管后走代理的网站没有额外延迟，节点波动不会触发直连兜底。/ Glass switches; measured no added latency and no false DIRECT fallback.
- 2.1：「包含整个站点」含义统一；外观可选浅色 / 深色。/ Consistent whole-site scope; light/dark appearance.
- 2.0：只在有直连规则时才接管代理；单次直连在关闭标签页后结束。/ Proxy control only while a rule is active.

`SHA256SUMS.txt` lists the ZIP checksum (integrity only, not a code signature).
