import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version, 'Package and manifest versions must match');
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'alarms', 'proxy', 'storage']);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.content_scripts, undefined);
for (const file of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons),
]) {
  await readFile(path.join(root, 'extension', file));
}
const forbidden = /(?:node_modules|test-results|\.test-profile|\.git)(?:\/|$)/;
async function verifyDirectory(folder, prefix = '') {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = prefix + entry.name;
    assert.equal(forbidden.test(name), false, `Unexpected runtime file: ${name}`);
    if (entry.isDirectory()) await verifyDirectory(path.join(folder, entry.name), name + '/');
  }
}
await verifyDirectory(path.join(root, 'extension'));
console.log(
  `Package structure verified: v${manifest.version}, minimal permissions, no development artifacts.`,
);
