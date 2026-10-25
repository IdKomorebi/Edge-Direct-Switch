# Contributing / 参与贡献

感谢你帮助改进 Edge Direct Switch。Bug 修复、文档、翻译、无障碍改进和可复现的兼容性报告都很有帮助。

## Before opening an issue

Search existing issues, then include your Edge version, operating system, proxy protocol and a minimal reproduction. State whether the proxy client uses a system proxy, PAC, TUN or VPN. Replace private domains, IP addresses and account details with examples.

本扩展按目标域名分流，无法隔离同域名的两个标签页。TUN/VPN 问题请先查阅 [排障指南](docs/TROUBLESHOOTING.md)。

## Development

1. Fork and clone the repository.
2. Use Node.js 20 or newer.
3. Run `npm ci` for the development formatter. The extension and unit tests have no runtime dependencies.
4. Load `extension/` in Edge using `edge://extensions` → Developer mode → Load unpacked.
5. Run `npm test`, `npm run format:check` and `npm run pack` before submitting a pull request.

Optional browser verification is documented in [docs/TESTING.md](docs/TESTING.md). It uses an isolated profile and local marker servers; never use your everyday browser profile for automated proxy tests.

## Pull requests

- Keep the change focused and explain the user-visible behavior.
- For routing or lifecycle changes, add a regression test that would fail before the fix.
- For UI changes, include a screenshot and check keyboard navigation.
- Keep runtime code self-contained. Avoid new permissions or network dependencies unless the feature requires them, and explain that requirement.
- Update both README languages when changing installation steps or limitations.
- Keep credentials, real browser profiles, private URLs and network logs out of commits.

讨论时请尊重其他贡献者。维护者会根据功能范围、可验证性和维护成本决定是否合并；提交 PR 不保证立即响应或合并。

By contributing, you agree that your contribution is licensed under the repository's MIT License.
