# 安装与排障 / Troubleshooting

## 安装后其他网站无法联网

确认扩展设置中的协议、主机和端口与代理客户端一致。HTTP 和 SOCKS5 端口可能不同；HTTPS 代理协议也不等于“访问 HTTPS 网站”。绝大多数本地混合端口可使用 HTTP。

点击“暂停分流”可释放扩展控制，恢复较低优先级的代理设置。扩展不会关闭代理客户端，也不会修改 Windows 系统代理。

If other sites stop loading after enabling routing, verify the configured proxy endpoint and protocol. Pause routing to release extension control. The extension does not add a DIRECT fallback when the proxy is unavailable.

## 网站已直连，仍无法打开

1. 刷新当前页，必要时关闭并重新打开该页面，以结束已有连接。
2. 确认客户端是否开启 TUN、VPN 或透明代理。浏览器 DIRECT 无法绕过系统层路由，应在客户端的规则模式中添加直连规则。
3. 查看失败资源是否属于另一个域名：登录、验证码、API、图片和视频 CDN 经常独立部署。
4. 校内系统可能需要校园网或学校 VPN。部分网站自身的维护、证书、DNS 和账户问题也与代理无关。

Browser DIRECT bypasses the explicit browser proxy only. It does not defeat TUN/VPN routing, provide campus-network access, or guarantee a particular website will accept your connection.

## 临时直连为什么影响另一个标签页？

Edge 的代理配置对当前配置文件生效，PAC 接收目标网址和主机名，没有标签页编号。同域名的其他标签页也会直连。创建临时规则的标签页编号只用于决定何时删除规则。

临时规则在到期或创建它的标签页关闭后删除。浏览器休眠可能延迟清理；完整重启后会按新会话重新生成规则。仅关闭窗口而 Edge 后台继续运行，不一定是一次完整重启。

Temporary rules are **domain rules with tab-based cleanup**, not per-tab network isolation.

## 代理由其他扩展或组织控制

请一次只启用一个代理管理扩展。ZeroOmega、FoxyProxy 等可能与本扩展争用代理配置。组织策略优先级高于扩展；本扩展无法绕过管理员策略。

Use one proxy-management extension at a time. Enterprise policies can prevent changes and must be handled by the administrator.

## 删除规则后仍然直连

检查是否还有父域名、子域名范围或另一条临时规则命中该网站。启用了内网直连时，内网 IP、localhost 和单段主机名也会直连。浏览器本身还会对部分本地地址进行隐式代理绕过。

Check overlapping rules and the optional local-network bypass. Existing requests are not cancelled when a rule changes.

## InPrivate / 其他浏览器

本扩展不提供 InPrivate 独立控制。浏览器可能让 InPrivate 继承普通窗口的代理配置。主要测试目标是桌面版 Microsoft Edge；其他 Chromium 浏览器仅属兼容性尝试，不保证通过相同加载方式安装。

The supported target is desktop Microsoft Edge. InPrivate isolation and per-tab proxies are outside the scope of this project.

## 报告问题

提供 Edge 版本、系统、扩展版本、代理协议、是否开启 TUN/VPN 和最小复现步骤。先删去代理密码、Cookie、私人域名和敏感网络日志。
