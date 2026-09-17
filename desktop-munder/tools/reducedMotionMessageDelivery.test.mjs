import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const envelope = readFileSync(new URL('../src/renderer/src/scene/office/MessageEnvelope.ts', import.meta.url), 'utf8');
const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
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

test('message envelopes receive the live floor motion preference', () => {
  assert.match(envelope, /prefersReducedMotion: \(\) => boolean = \(\) => false/);
  assert.match(floor, /new MessageEnvelope\(from, to, act, needsHuman, \(\) => prefersReducedMotion\)/);
});

test('reduced motion shows a steady arrival cue without travel or burst animation', () => {
  assert.match(envelope, /private enterSteadyArrival\(\): void \{[\s\S]*?this\.body\.rotation = 0;[\s\S]*?this\.burst\.visible = false;[\s\S]*?this\.container\.alpha = 1;[\s\S]*?this\.setPos\(this\.ex, this\.ey\);/);
  assert.match(envelope, /if \(this\.prefersReducedMotion\(\)\) this\.enterSteadyArrival\(\)/);
  assert.match(envelope, /if \(!this\.steadyArrival && this\.prefersReducedMotion\(\)\) this\.enterSteadyArrival\(\)/);
});

test('steady arrival stays visible for a bounded ticker-owned lifetime', () => {
  assert.match(envelope, /const STEADY_DURATION = 0\.6/);
  assert.match(envelope, /if \(this\.steadyArrival\) \{\s*this\.steadyElapsed \+= dt;\s*if \(this\.steadyElapsed >= STEADY_DURATION\) this\.finished = true;\s*return this\.finished;/);
  assert.doesNotMatch(envelope, /setTimeout|setInterval/);
});

test('actual envelope snaps to a steady recipient cue and expires without animation', () => {
  const { MessageEnvelope } = load(resolve(root, 'src/renderer/src/scene/office/MessageEnvelope.ts'));
  let reducedMotion = false;
  const delivery = new MessageEnvelope(
    { x: 20, y: 40 },
    { x: 120, y: 80 },
    'request',
    false,
    () => reducedMotion,
  );
  assert.equal(delivery.container.x, 20);
  assert.equal(delivery.container.y, 18);
  assert.equal(delivery.update(0.1), false);
  reducedMotion = true;
  assert.equal(delivery.update(0.01), false);
  assert.equal(delivery.container.x, 120);
  assert.equal(delivery.container.y, 58);
  assert.equal(delivery.container.alpha, 1);
  assert.equal(delivery.container.children[0].rotation, 0);
  assert.equal(delivery.container.children[1].visible, false);
  assert.equal(delivery.update(0.58), false);
  assert.equal(delivery.update(0.01), true);
  delivery.destroy();
});
