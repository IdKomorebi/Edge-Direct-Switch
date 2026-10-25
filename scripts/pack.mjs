import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'extension');
const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
const table = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc = (buf) => {
  let n = 0xffffffff;
  for (const b of buf) n = table[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
};
const chunks = [],
  central = [];
let offset = 0,
  count = 0;
async function add(folder, prefix = '') {
  const entries = (await readdir(folder, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) {
      await add(path.join(folder, entry.name), name + '/');
      continue;
    }
    const bytes = await readFile(path.join(folder, entry.name)),
      compressed = deflateRawSync(bytes),
      filename = Buffer.from(name),
      checksum = crc(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    chunks.push(header, filename, compressed);
    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x800, 8);
    index.writeUInt16LE(8, 10);
    index.writeUInt16LE(0x21, 14);
    index.writeUInt32LE(checksum, 16);
    index.writeUInt32LE(compressed.length, 20);
    index.writeUInt32LE(bytes.length, 24);
    index.writeUInt16LE(filename.length, 28);
    index.writeUInt32LE(offset, 42);
    central.push(index, filename);
    offset += header.length + filename.length + compressed.length;
    count++;
  }
}
await add(dir);
const centralData = Buffer.concat(central),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(count, 8);
end.writeUInt16LE(count, 10);
end.writeUInt32LE(centralData.length, 12);
end.writeUInt32LE(offset, 16);
await mkdir(path.join(root, 'dist'), { recursive: true });
const output = path.join(root, 'dist', `edge-direct-switch-${manifest.version}.zip`);
await writeFile(output, Buffer.concat([...chunks, centralData, end]));
console.log(output);
