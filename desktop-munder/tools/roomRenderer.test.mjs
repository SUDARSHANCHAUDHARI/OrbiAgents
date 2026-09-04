import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createRoomRenderer } from '../theme/roomRenderer.mjs';

const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const pixi = require('pixi.js');
const ts = require('typescript');
// Compile the actual pinned renderer, not a copied implementation or mock.
const filename = fileURLToPath(new URL('../src/renderer/src/scene/office/TiledMapRenderer.ts', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const rendererModule = new Module(filename);
rendererModule.filename = filename;
rendererModule.paths = require.resolve.paths('pixi.js');
rendererModule._compile(compiled, filename);
const { TiledMapRenderer } = rendererModule.exports;
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));
function textures() {
  return new Map(entries.filter(e => e.path.endsWith('.png')).map(e => [e.path,
    new pixi.Texture({ source: new pixi.TextureSource({ width: e.width, height: e.height }) })]));
}

test('actual upstream renderer builds all room layers with valid frames and seats', () => {
  const sheets = textures();
  const scene = createRoomRenderer(pixi, TiledMapRenderer, entries, sheets);
  try {
    const { renderer, room } = scene;
    assert.equal(renderer.width, 48); assert.equal(renderer.height, 32);
    for (const name of ['floor', 'walls', 'furniture-below']) {
      const container = renderer.getContainer().children.find(c => c.label === name);
      const data = room.map.layers.find(l => l.name === name).data;
      assert.equal(container.children.length, data.filter(Boolean).length);
      for (const sprite of container.children) {
        const { frame, source } = sprite.texture;
        assert.equal(frame.width, 16); assert.equal(frame.height, 16);
        assert.ok(frame.x >= 0 && frame.y >= 0);
        assert.ok(frame.x + frame.width <= source.width && frame.y + frame.height <= source.height);
      }
    }
    for (const name of room.primarySeatNames) {
      const p = renderer.getSpawnPoint(name);
      assert.ok(p && renderer.isWalkable(p.x, p.y), name);
    }
    assert.equal(renderer.getContainer().children.at(-1), renderer.getCharacterContainer());
    const root = renderer.getContainer();
    scene.dispose(); scene.dispose();
    assert.equal(root.destroyed, true);
    for (const texture of sheets.values()) assert.equal(texture.source.destroyed, false);
  } finally {
    scene.dispose();
    for (const texture of sheets.values()) texture.destroy(true);
  }
});

test('missing sheet fails before altering any supplied texture', () => {
  const sheets = textures();
  const last = [...sheets.keys()].at(-1);
  const removed = sheets.get(last);
  sheets.delete(last);
  try {
    assert.throws(() => createRoomRenderer(pixi, TiledMapRenderer, entries, sheets), /Missing or invalid/);
    for (const texture of sheets.values()) assert.equal(texture.source.resolution, 1);
  } finally {
    removed.destroy(true);
    for (const texture of sheets.values()) texture.destroy(true);
  }
});
