import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { WORKER_NAMES, workerColor, workerFrame } from '../theme/workerArt.mjs';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const { build } = await import(require.resolve('vite'));
async function bundle(path) {
  const entry = fileURLToPath(new URL('../src/renderer/src/' + path, import.meta.url));
  const result = await build({ configFile: false, logLevel: 'silent', esbuild: { jsx: 'automatic' },
    build: { ssr: entry, write: false, rollupOptions: {
      external: ['pixi.js', 'react/jsx-runtime'], output: { format: 'cjs' },
    } },
  });
  const mod = new Module(entry);
  mod.filename = entry; mod.paths = require.resolve.paths('pixi.js');
  mod._compile(result.output.find(x => x.type === 'chunk' && x.isEntry).code, entry);
  return mod.exports;
}
const portraits = await bundle('scene/office/portraitArt.ts');
const cast = await bundle('scene/office/cast.ts');
const picker = await bundle('components/OfficeThemePicker.tsx');

test('all persisted roster keys retain original robot portrait and accent mapping', () => {
  assert.equal(WORKER_NAMES.length, 15);
  assert.deepEqual(cast.OFFICE_CAST.map(c => c.name), WORKER_NAMES);
  for (const [i, name] of WORKER_NAMES.entries()) {
    const pixels = portraits.portraitPixels(name);
    assert.equal(pixels.length, 18 * 28 * 4);
    assert.deepEqual(pixels, workerFrame('down', 0, workerColor(name)).slice(0, pixels.length));
    assert.equal(cast.CAST_BY_NAME[name].displayName, `Orbi-${i + 1}`);
    assert.equal(cast.CAST_BY_NAME[name].shirt, '#' + workerColor(name).toString(16));
    const frames = portraits.sceneFrameBufs(name);
    assert.deepEqual(new Uint8Array(frames.back[2]), workerFrame('up', 2, workerColor(name)));
  }
});

test('portrait painter preserves canvas state and scales without smoothing', () => {
  const previous = globalThis.document;
  let saved = 0, restored = 0, drawn;
  const source = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => source }) };
  try {
    let smoothing;
    const context = { save() { saved++; smoothing = this.imageSmoothingEnabled; },
      restore() { restored++; this.imageSmoothingEnabled = smoothing; }, clearRect() {},
      drawImage(...args) { assert.equal(this.imageSmoothingEnabled, false); drawn = args; }, imageSmoothingEnabled: true };
    portraits.paintPortrait(context, 'jim', 2.5);
    assert.equal(saved, 1); assert.equal(restored, 1);
    assert.equal(context.imageSmoothingEnabled, true);
    assert.deepEqual(drawn.slice(-2), [45, 70]);
    assert.throws(() => portraits.paintPortrait(context, 'jim', NaN), /scale/);
  } finally { globalThis.document = previous; }
});

test('theme summary renders one available room without destructive controls', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(picker.OfficeThemePicker, {
    config: { officeTheme: 'brooklyn99', tvShowOffices: true },
  }));
  assert.match(html, /OrbiAgents office/);
  assert.match(html, /only available theme/);
  assert.doesNotMatch(html, /<button|<input|Dunder Mifflin|Brooklyn Nine-Nine/);
});
