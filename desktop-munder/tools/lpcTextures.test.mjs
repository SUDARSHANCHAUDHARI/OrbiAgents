import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createLpcTilesets, prepareLpcTexture } from '../theme/lpcTextures.mjs';

// Reuse the installed desktop Pixi runtime; no upstream dependencies/scripts.
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const { Texture, TextureSource, Rectangle } = require('pixi.js');
const manifest = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('all licensed sheets have disjoint GIDs and exact source-to-world dimensions', () => {
  const catalog = createLpcTilesets(manifest.entries);
  assert.equal(catalog.length, 13);
  let next = 257;
  for (const sheet of catalog) {
    assert.equal(sheet.firstgid, next);
    next += sheet.tilecount;
    const source = new TextureSource({ width: sheet.imagewidth * 2, height: sheet.imageheight * 2 });
    const texture = new Texture({ source });
    try {
      prepareLpcTexture(texture, sheet);
      prepareLpcTexture(texture, sheet); // Idempotent, not a second halving.
      assert.equal(texture.width, sheet.imagewidth);
      assert.equal(texture.height, sheet.imageheight);
      assert.equal(source.scaleMode, 'nearest');
      assert.equal(texture.uvs.x2, 1);
      assert.equal(texture.uvs.y2, 1);
      const last = new Texture({ source, frame: new Rectangle(sheet.imagewidth - 16, sheet.imageheight - 16, 16, 16) });
      assert.equal(last.uvs.x2, 1);
      assert.equal(last.uvs.y2, 1);
      assert.equal(last.width, 16);
      last.destroy();
    } finally { texture.destroy(true); }
  }
});

test('malformed catalogs, mismatched images and framed textures fail before mutation', () => {
  const entry = manifest.entries[0];
  assert.throws(() => createLpcTilesets([entry, entry]), /duplicate/);
  assert.throws(() => createLpcTilesets([{ ...entry, width: 33 }]), /32px/);
  assert.throws(() => createLpcTilesets([{ ...entry, path: '../secret.png' }]), /path/);
  const sheet = createLpcTilesets([entry])[0];
  const source = new TextureSource({ width: 32, height: 32 });
  const full = new Texture({ source });
  const framed = new Texture({ source, frame: new Rectangle(0, 0, 16, 16) });
  try {
    assert.throws(() => prepareLpcTexture(full, sheet), /dimensions/);
    assert.throws(() => prepareLpcTexture(framed, sheet), /full-sheet/);
    assert.equal(source.resolution, 1);
  } finally { framed.destroy(); full.destroy(true); }
});
