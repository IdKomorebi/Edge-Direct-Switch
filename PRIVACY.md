# 隐私说明 / Privacy

本扩展没有服务器、账户、统计、广告或云同步，自身不发出任何网络请求。

- 点击扩展图标时，通过 `activeTab` 读取**当前网站的域名**，用于判断和切换直连。不读取网页内容、表单、密码、Cookie 或浏览历史。
- **常驻网站列表和设置**保存在本机（`chrome.storage.local`）。**单次直连**及其所属标签页编号保存在浏览器会话存储中，重启浏览器即清除。
- 未直连的网页请求会按你的设置发往你自己的代理软件；这部分流量由你的代理软件及其服务商处理。
- 卸载扩展时，浏览器会删除上述数据并交还代理设置。

The extension has no server, analytics or sync and makes no network requests of its own. It reads the current site's host name only when you open the popup, stores settings and saved sites locally, and keeps one-time rules in session storage that is cleared when the browser restarts. Uninstalling removes all data and releases the proxy setting.
