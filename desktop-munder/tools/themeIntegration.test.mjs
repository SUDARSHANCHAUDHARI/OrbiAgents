import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const { build } = await import(require.resolve('vite'));
const pixi = require('pixi.js');
const entry = fileURLToPath(new URL('../src/renderer/src/scene/office/themeLoader.ts', import.meta.url));
// Bundle the actual registry and loader, including Vite's local image imports.
const result = await build({ configFile: false, logLevel: 'silent',
  build: { ssr: entry, write: false, assetsInlineLimit: 0, rollupOptions: { external: ['pixi.js'], output: { format: 'cjs' } } },
});
const mod = new Module(entry);
mod.filename = entry;
mod.paths = require.resolve.paths('pixi.js');
mod._compile(result.output.find(item => item.type === 'chunk' && item.isEntry).code, entry);
const { loadTheme, resolveThemeMap } = mod.exports;
const entries = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url))).entries.filter(e => e.path.endsWith('.png'));
function loader() {
  const textures = [];
  return { textures, load: async url => {
    assert.ok(url.endsWith('.png'));
    const entry = entries[textures.length];
    const texture = new pixi.Texture({ source: new pixi.TextureSource({ width: entry.width, height: entry.height }) });
    textures.push(texture);
    return texture;
  } };
}

test('actual registry resolves legacy IDs to original room, scaled LPC sheets and robot frames', async () => {
  const theme = await loadTheme('brooklyn99');
  const other = await loadTheme('office');
  assert.notEqual(theme, other);
  const images = loader();
  try {
    assert.equal(theme.id, 'office');
    const map = resolveThemeMap(theme);
    assert.equal(map.width, 48); assert.equal(map.height, 32);
    const textures = await theme.loadTextures(images.load);
    assert.equal(textures.length, map.tilesets.length);
    map.tilesets.forEach((sheet, i) => {
      assert.equal(textures[i].width, sheet.imagewidth);
      assert.equal(textures[i].height, sheet.imageheight);
    });
    assert.equal(theme.primarySeatNames.length, 15);
    const warroomSeats = map.layers.find(layer => layer.name === 'spawn-points').objects
      .filter(point => point.name.startsWith('warroom-'));
    assert.equal(warroomSeats.length, 6);
    assert.equal(theme.monitor.offTopLeftGid, 7);
    assert.deepEqual(theme.monitor.onGids, [[11, 0, 0], [12, 1, 0], [13, 0, 1], [14, 1, 1]]);
    assert.deepEqual(theme.anchors.calendar, { x: 4, y: 1 });
    assert.deepEqual(theme.anchors.clock, { x: 24, y: 1 });
    assert.deepEqual(theme.anchors.boards, { x: 38, y: 2 });
    const roomAbove = map.layers.find(layer => layer.name === 'furniture-above').data;
    assert.equal(roomAbove[theme.anchors.calendar.y * map.width + theme.anchors.calendar.x], 57);
    assert.equal(roomAbove[theme.anchors.clock.y * map.width + theme.anchors.clock.x], 58);
    assert.equal(roomAbove[2 * map.width + 39], 59);
    assert.deepEqual([roomAbove[1 * map.width + 35], roomAbove[1 * map.width + 36]], [64, 65]);
    assert.equal(roomAbove[theme.coffee.trayTile.y * map.width + theme.coffee.trayTile.x], 68);
    assert.deepEqual(theme.errandSpots.map(spot => spot.kind),
      ['water', 'water', 'window', 'window', 'shelf', 'fridge', 'dispenser', 'bin', 'bin']);
    assert.deepEqual(theme.errandSpots[0], {
      kind: 'water', stand: { x: 30, y: 4 }, facing: 'right', fx: { x: 31, y: 4 }, duration: 4.2,
    });
    assert.deepEqual(theme.errandSpots[1], {
      kind: 'water', stand: { x: 45, y: 28 }, facing: 'right', fx: { x: 46, y: 28 }, duration: 4.2,
    });
    assert.deepEqual(theme.errandSpots[2], {
      kind: 'window', stand: { x: 46, y: 8 }, facing: 'right', fx: { x: 47, y: 7 }, duration: 3.8,
    });
    assert.deepEqual(theme.errandSpots[3], {
      kind: 'window', stand: { x: 46, y: 22 }, facing: 'right', fx: { x: 47, y: 21 }, duration: 3.8,
    });
    assert.deepEqual(theme.errandSpots[4], {
      kind: 'shelf', stand: { x: 30, y: 24 }, facing: 'right', fx: { x: 31, y: 23 }, duration: 4.5,
    });
    assert.deepEqual(theme.errandSpots[5], {
      kind: 'fridge', stand: { x: 45, y: 17 }, facing: 'up', fx: { x: 45, y: 16 }, duration: 3.6,
    });
    const frames = await theme.cast.getFrames('jim');
    assert.equal(frames.length, 3);
    assert.equal(frames[0][0].width, 18);
    theme.dispose(); theme.dispose();
    assert.ok(textures.every(t => t.destroyed));
    assert.ok(frames.flat().every(t => t.destroyed));
    await assert.rejects(theme.cast.getFrames('jim'), /disposed/);
  } finally { theme.dispose(); other.dispose(); }
});

test('failed and cancelled image loads release textures', async () => {
  const theme = await loadTheme('office');
  const images = loader();
  await assert.rejects(theme.loadTextures(async url => {
    if (images.textures.length === 1) throw new Error('image failure');
    return images.load(url);
  }), /image failure/);
  assert.ok(images.textures.every(t => t.destroyed));
  const cancelled = await loadTheme('office');
  let release;
  const pending = cancelled.loadTextures(() => new Promise(resolve => { release = resolve; }));
  cancelled.dispose();
  const late = await loader().load('late.png');
  release(late);
  await assert.rejects(pending, /disposed/);
  assert.ok(late.destroyed);
});
