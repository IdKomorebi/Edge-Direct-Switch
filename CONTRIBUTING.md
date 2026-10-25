# Contributing / 参与贡献

Bug reports, translations, UI polish and focused fixes are welcome. 欢迎反馈问题、翻译和改进。

## Setup

1. Node.js 20+, then `npm ci`.
2. Load `extension/` in Edge: `edge://extensions` → Developer mode → Load unpacked. After editing, click the reload icon on the extension card.
3. Before a pull request: `npm test`, `npm run check`, `npm run format:check`, and if you touched routing or UI, `npm run test:browser`.

## Code map

| File                       | Role                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `extension/core.mjs`       | Pure logic: validation, PAC generation, matching, migration |
| `extension/controller.mjs` | Storage, proxy ownership, applying changes                  |
| `extension/background.mjs` | Event wiring (messages, tab close, startup)                 |
| `extension/popup.*`        | Toolbar popup                                               |
| `extension/options.*`      | Settings page                                               |
| `extension/_locales/*`     | UI text — every locale must have the same keys              |

## Guidelines

- Keep the extension dependency-free and permissions minimal; explain any new permission.
- Routing or lifecycle changes need a test that fails without the fix.
- UI changes: include a screenshot, check dark mode and keyboard use, and add text to **every** locale (`npm run check` verifies this).
- Update both `README.md` (Chinese) and `README.en.md` when behavior or installation changes.
- Never commit real browser profiles, credentials or private URLs.

New language? Copy `extension/_locales/en/messages.json` to `_locales/<locale>/` and translate the `message` values.

By contributing you agree that your work is licensed under the MIT License.
