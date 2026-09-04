import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = process.argv[2];
assert.ok(archive, 'Pass the vetted LPC Office zip path');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const archiveHash = '697b688de1c18ca71ee5851ca925c4cfea8be810a82551c3595990d1e6266aaa';
assert.equal(sha256(readFileSync(archive)), archiveHash, 'Unexpected archive revision');
const destination = join(root, 'art/lpc-office');
assert.ok(!existsSync(destination), 'Refusing to overwrite imported artwork');
// Explicit entries only: no archive paths are extracted onto the filesystem.
const names = ['Bins.png', 'Card Table.png', 'Coffee Cup.png', 'Coffee Maker.png',
  'Copy Machine - Copy Light.png', 'Copy Machine.png', 'Desk, Ornate.png',
  'Laptop.png', 'Mailboxes.png', 'Rotary Phones.png', 'Sink.png',
  'TV, Widescreen.png', 'Water Cooler.png', 'Credits.txt'];
const files = names.map((name) => ({ name, bytes: execFileSync('unzip', ['-p', resolve(archive), name]) }));
const entries = files.map(({ name, bytes }) => {
  const entry = { path: `art/lpc-office/${name}`, sha256: sha256(bytes) };
  if (name.endsWith('.png')) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    entry.width = bytes.readUInt32BE(16);
    entry.height = bytes.readUInt32BE(20);
  }
  return entry;
});
mkdirSync(destination, { recursive: true });
for (const { name, bytes } of files) writeFileSync(join(destination, name), bytes, { flag: 'wx' });
writeFileSync(join(root, 'art/manifest.json'), JSON.stringify({
  source: 'https://opengameart.org/content/lpc-revised-the-office',
  archive: 'https://opengameart.org/sites/default/files/lpc_-_the_office.zip',
  archiveSha256: archiveHash,
  license: 'OGA-BY-3.0',
  licenseUrl: 'https://static.opengameart.org/OGA-BY-3.0.txt',
  attribution: 'Eliza Wyatt and Lanea Zimmerman (Sharm)',
  modifications: 'None. Selected original files copied byte-for-byte.',
  entries,
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Imported ${entries.length} credited files; no image modifications.`);
