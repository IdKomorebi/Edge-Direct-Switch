# Testing

## Fast checks

Use Node.js 20+:

```sh
npm ci
npm test
npm run format:check
npm run pack
```

The unit tests and ZIP packager use Node.js built-ins. Development dependencies provide code formatting and the optional browser driver; no npm packages are shipped with the extension.

## Real browser test

With Microsoft Edge installed:

```sh
npm run test:browser
```

The test launches Edge headlessly with a **new, isolated profile** under `test-results/`. It starts a local HTTP target and marker proxy on ephemeral loopback ports. Test domains under `.route.test` resolve to the local target; no external target website is required.

Checks:

1. Installation starts without taking proxy control.
2. Unlisted domains use the configured marker proxy.
3. A selected domain connects directly while another domain remains proxied.
4. Removing its rule restores proxy routing.
5. Temporary rules connect directly and are removed when their source tab closes.
6. Pause releases the extension's proxy setting.

The script also captures the actual settings UI. Screenshots contain example rules only. Test profiles, screenshots and request logs stay in ignored `test-results/`; only selected documentation screenshots are committed.

Optional environment variables: `TEST_BROWSER=msedge` (default), `TEST_EXECUTABLE` for an explicit browser binary, and `PLAYWRIGHT_MODULE` for an externally installed Playwright module. Use the same extension-loading support as the installed browser; some Chrome versions restrict command-line loading.

## Recorded local verification

On 2026-10-25, the browser routing test passed using Windows and Microsoft Edge **155.0.4283.45**. This verifies real Edge routing against the local marker servers. It does **not** verify access to the example university/competition sites, campus networks, external proxy services, SOCKS5 servers or every VPN/TUN combination.

Unit tests cover matching, invalid input, temporary expiry/session cleanup, ownership conflicts and storage rollback. HTTP/HTTPS/SOCKS5 PAC output is checked at the unit level; only HTTP marker routing is exercised by the browser test.

## Before publishing

Run all checks, ensure `package.json` and `extension/manifest.json` versions agree, update the changelog and release notes, then push a `v<version>` tag. The release workflow verifies the version, rebuilds the ZIP and publishes it with `SHA256SUMS.txt`.
