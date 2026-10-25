# Testing

## Fast checks

```sh
npm ci
npm test               # core routing logic and controller (Node built-ins only)
npm run check          # manifest, permissions, locale keys, package contents
npm run format:check
npm run pack
```

## Real browser test

Requires Microsoft Edge:

```sh
npm run test:browser
TEST_LANG=en npm run test:browser   # English UI
```

The script launches Edge headlessly with a **new throwaway profile** in `test-results/`, a local "target" server (answers `DIRECT`) and a local marker proxy (answers `PROXY`). Test host names are mapped to `127.0.0.1` with `--host-resolver-rules`, so no external website is contacted.

It drives the real popup and settings page and checks that:

1. Installing and saving settings do not take proxy control.
2. **Connect directly** makes the site DIRECT while another site stays on the proxy.
3. Closing the tab ends the one-time rule.
4. **Always connect directly** survives closing the tab.
5. Turning **Saved sites** off releases control when nothing else is active.
6. One-time rules still work with the master switch off and release control when their tab closes.
7. **Use proxy again** removes a saved site.

Screenshots for the README are written to `test-results/` (`popup-*.png`, `options-*.png`) and copied to `docs/images/` by hand when the UI changes.

Environment variables: `TEST_BROWSER` (Playwright channel, default `msedge`), `TEST_EXECUTABLE` (explicit browser binary), `PLAYWRIGHT_MODULE` (path to an existing Playwright install), `TEST_LANG` (default `zh-CN`).

## Releasing

1. Update the version in `package.json`, `package-lock.json` and `extension/manifest.json`.
2. Update `CHANGELOG.md` and `docs/RELEASE_NOTES.md`.
3. Run all checks, commit, then push a `v<version>` tag. The release workflow rebuilds the ZIP and publishes it with `SHA256SUMS.txt`.
