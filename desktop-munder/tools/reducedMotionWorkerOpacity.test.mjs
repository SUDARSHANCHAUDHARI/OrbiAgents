import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const pixi = require('pixi.js');
const ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new Map();

function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.require = (name) => {
    if (name === 'pixi.js') return pixi;
    const target = name.startsWith('@/')
      ? resolve(root, 'src/renderer/src', name.slice(2))
      : resolve(dirname(filename), name);
    return load(extname(target) ? target : `${target}.ts`);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

test('workers enter at target opacity without a reduced-motion fade', () => {
  assert.match(character, /const reducedMotion = this\.prefersReducedMotion\(\);\s*this\.sprite\.setAlpha\(reducedMotion \? this\.targetAlpha : 0\)/);
  assert.match(character, /this\.fadeDirection = reducedMotion \? null : 'in'/);
});

test('delayed worker removal keeps its delay then detaches atomically', () => {
  assert.match(character, /if \(this\.prefersReducedMotion\(\)\) \{\s*this\.sprite\.setAlpha\(0\);\s*this\.finishFade\(true\);\s*return;/);
  assert.match(character, /if \(delay > 0\) this\.hideTimer = setTimeout\(begin, delay\);\s*else begin\(\)/);
  assert.match(character, /private finishFade\(reachedZero: boolean\): void \{[\s\S]*?this\.sprite\.container\.parent\?\.removeChild[\s\S]*?this\.thoughtBubble\.container\.parent\?\.removeChild[\s\S]*?this\.workGlow\.parent\?\.removeChild[\s\S]*?this\.selectionRing\.parent\?\.removeChild[\s\S]*?this\.deskCup\.parent\?\.removeChild/);
});

test('live reduced-motion changes settle fades and ghost opacity immediately', () => {
  assert.match(character, /if \(reducedMotion\) \{\s*const reachedZero = this\.fadeDirection === 'out';\s*this\.sprite\.setAlpha\(reachedZero \? 0 : this\.targetAlpha\);\s*this\.finishFade\(reachedZero\)/);
  assert.match(character, /if \(reducedMotion\) \{\s*if \(a !== this\.targetAlpha\) this\.sprite\.setAlpha\(this\.targetAlpha\);\s*\} else if \(Math\.abs/);
});

test('actual reduced-motion character applies opacity and cleanup atomically', () => {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const textures = Array.from({ length: 12 }, () =>
    new pixi.Texture({ source: new pixi.TextureSource({ width: 18, height: 32 }) }));
  const frames = Array.from({ length: 4 }, (_, direction) =>
    textures.slice(direction * 3, direction * 3 + 3));
  const mapRenderer = {
    width: 48,
    height: 32,
    tileSize: 16,
    tileToPixel: (x, y) => ({ x: x * 16, y: y * 16 }),
    pixelToTile: (x, y) => ({ x: Math.floor(x / 16), y: Math.floor(y / 16) }),
    isWalkable: () => true,
  };
  let worker;
  try {
    const { Character } = load(resolve(root, 'src/renderer/src/scene/office/Character.ts'));
    worker = new Character({
      agentId: 'steady-worker',
      mapRenderer,
      frames,
      seatTile: { x: 4, y: 4 },
      glowColor: 0x5cdbcf,
      prefersReducedMotion: () => true,
    });
    const layer = new pixi.Container();
    worker.show(layer);
    assert.equal(worker.sprite.container.alpha, 1);
    worker.setBaseAlpha(0.5);
    worker.update(0.01);
    assert.equal(worker.sprite.container.alpha, 0.5);
    worker.hide();
    assert.equal(worker.sprite.container.parent, null);
    assert.equal(worker.isVisible, false);
    layer.destroy({ children: true });
  } finally {
    worker?.destroy();
    for (const texture of textures) texture.destroy(true);
    pixi.Ticker.shared.stop();
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});
