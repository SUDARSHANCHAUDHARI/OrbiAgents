import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { workerFrame, WORKER_COLORS } from '../theme/workerArt.mjs';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const pixi = require('pixi.js'), ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new Map();
// Exercise actual imported Character/Sprite/Pathfinding code without a browser.
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = name => {
    if (name === 'pixi.js') return pixi;
    const target = name.startsWith('@/') ? resolve(root, 'src/renderer/src', name.slice(2)) : resolve(dirname(filename), name);
    return load(extname(target) ? target : target + '.ts');
  };
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
  }).outputText, filename);
  return mod.exports;
}

test('original robots have distinct directional and walking frames', () => {
  const seen = new Set();
  for (const color of WORKER_COLORS) for (const direction of ['down', 'up', 'right']) for (const step of [0, 1, 2]) {
    const pixels = workerFrame(direction, step, color);
    assert.equal(pixels.length, 18 * 32 * 4);
    assert.ok(pixels.some((v, i) => i % 4 === 3 && v === 255));
    assert.equal(pixels[3], 0);
    seen.add(Buffer.from(pixels).toString('base64'));
  }
  assert.equal(seen.size, 27);
  assert.throws(() => workerFrame('left', 0, WORKER_COLORS[0]), /Unsupported/);
});

test('actual characters reach desks and coffee, then release their scene resources', () => {
  const previousRaf = globalThis.requestAnimationFrame, previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  const { entries } = JSON.parse(readFileSync(resolve(root, 'art/manifest.json'), 'utf8'));
  const textures = new Map(entries.filter(e => e.path.endsWith('.png')).map(e => [e.path,
    new pixi.Texture({ source: new pixi.TextureSource({ width: e.width, height: e.height }) })]));
  let scene, demo;
  try {
    const { TiledMapRenderer } = load(resolve(root, 'src/renderer/src/scene/office/TiledMapRenderer.ts'));
    const { createRoomRenderer } = load(resolve(root, 'theme/roomRenderer.mjs'));
    const { createDemoWorkers } = load(resolve(root, 'preview/workers.mjs'));
    scene = createRoomRenderer(pixi, TiledMapRenderer, entries, textures);
    demo = createDemoWorkers(scene);
    const layer = scene.renderer.getCharacterContainer();
    const initial = layer.children.length;
    assert.ok(initial > 3);
    const positions = new Set();
    for (let i = 0; i < 2400; i++) {
      demo.update(0.05);
      for (const child of layer.children.filter(c => c.children?.[0] instanceof pixi.AnimatedSprite)) {
        const x = Math.floor(child.x / 16), y = Math.floor((child.y - 1) / 16);
        assert.ok(scene.renderer.isWalkable(x, y), `worker entered blocked tile ${x},${y}`);
        positions.add(`${x},${y}`);
      }
    }
    assert.ok(positions.has('38,17'), 'worker reaches coffee machine');
    for (const name of ['desk-ceo', 'pc-6', 'pc-12']) {
      const p = scene.renderer.getSpawnPoint(name);
      assert.ok(positions.has(`${p.x},${p.y}`), name);
    }
    demo.dispose(); demo.dispose();
    assert.equal(layer.children.length, 0);
  } finally {
    demo?.dispose(); scene?.dispose();
    for (const texture of textures.values()) texture.destroy(true);
    pixi.Ticker.shared.stop();
    globalThis.requestAnimationFrame = previousRaf; globalThis.cancelAnimationFrame = previousCancel;
  }
});
