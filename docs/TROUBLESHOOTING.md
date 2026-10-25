# 常见问题 / FAQ

## 开启直连后，其他网站都打不开了

设置里的**代理端口**和代理软件不一致。打开代理软件查看本地监听端口（常见：Clash / Mihomo `7890`，Clash Verge Rev `7897`，v2rayN `10808`），在设置页改正后保存。HTTP 和 SOCKS5 端口可能不同；不确定时选 HTTP + 混合端口（mixed port）。

临时解决：在弹窗里点「恢复代理」，所有直连都恢复后扩展会交还代理控制。

_Other sites stop loading → the proxy port in Settings doesn't match your client. Fix it, or restore all sites to hand control back._

## 已经显示「已直连」，网站还是打不开

1. 刷新或重新打开页面，结束已有的连接。
2. 代理软件是否开着 **TUN / 虚拟网卡 / 增强模式**？这时浏览器直连无法绕过它，请在代理软件的规则里给该域名加 `DIRECT`。
3. 只有部分内容失败（登录、验证码、视频）？这些资源可能在别的域名上。打开「包含整个站点」，或按 F12 → 网络面板找到失败的域名，在设置页添加。
4. 校内系统可能本身就要求校园网或学校 VPN，这与代理无关。

_Browser DIRECT does not bypass TUN mode, and some resources live on other domains._

## 为什么另一个标签页也直连了？

Edge 的代理规则按域名判断，拿不到“是哪个标签页”。同一网站的所有标签页共用规则；“关闭标签页后恢复”指的是**发起直连的那个**标签页关闭时。

## 关掉代理软件后，Edge 还能用吗？

能。默认开启的「代理软件关闭时自动直连」会让连不上代理时改为直连。注意：代理连不上之后，Edge 会在几分钟内暂时不再尝试它，所以刚重新打开代理软件时，需要代理的网站可能要稍等片刻（或重启浏览器）才恢复。不需要这个行为可以在设置里关闭。

## 提示「另一个扩展正在控制代理」

ZeroOmega、FoxyProxy 等代理扩展与本扩展不能同时控制代理。停用其中一个即可。被组织策略锁定时，扩展无法修改代理设置。

## 从 1.x 升级

设置和常驻网站会自动迁移。1.x 的「临时直连 30 分钟」改为「关闭标签页后结束」，不再中途自动失效。

## 报告问题

请在 [Issues](https://github.com/IdKomorebi/Edge-Direct-Switch/issues) 中提供 Edge 版本、扩展版本、代理软件及模式（系统代理 / TUN）和复现步骤。不要粘贴密码、Cookie 或内网地址。
