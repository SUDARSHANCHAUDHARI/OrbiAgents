import { Texture, BufferImageSource } from 'pixi.js';
import { createOfficeRoom } from '../../../../../theme/room.mjs';
import { prepareLpcTexture } from '../../../../../theme/lpcTextures.mjs';
import { createWorkerTextures, WORKER_COLORS, WORKER_NAMES, workerColor } from '../../../../../theme/workerArt.mjs';
import manifest from '../../../../../art/manifest.json';

const urls = import.meta.glob('../../../../../art/lpc-office/*.png', { eager: true, query: '?url', import: 'default' });
// Keep persisted character keys compatible; scene appearance is original.
const names = WORKER_NAMES;
export function createOrbiTheme() {
  const room = createOfficeRoom(manifest.entries);
  const owned = [], workers = new Map();
  let disposed = false;
  const dispose = () => {
    disposed = true;
    for (const texture of owned) if (!texture.destroyed) texture.destroy(true);
    for (const worker of workers.values()) worker.dispose();
  };
  return {
    id: 'office', mapRaw: JSON.stringify(room.map),
    tilesets: room.map.tilesets.map(sheet => ({ ...sheet, url: urls[`../../../../../${sheet.image}`] ?? '' })),
    primarySeatNames: room.primarySeatNames, cafeSeatNames: room.cafeSeatNames,
    cafeStands: [['cafe-stand-coffee', 'coffee'], ['cafe-stand-vending', 'vending']],
    coffee: room.coffee,
    anchors: { calendar: { x: 4, y: 1 }, boards: { x: 38, y: 2 }, clock: { x: 24, y: 1 } },
    errandSpots: [
      { kind: 'dispenser', stand: { x: 29, y: 28 }, facing: 'right', fx: { x: 30, y: 27 }, duration: 3.5 },
      { kind: 'bin', stand: { x: 3, y: 28 }, facing: 'left', fx: { x: 2, y: 28 }, duration: 2.6 },
      { kind: 'bin', stand: { x: 44, y: 27 }, facing: 'right', fx: { x: 45, y: 27 }, duration: 2.6 },
    ],
    monitor: { offTopLeftGid: 7, onGids: [[11, 0, 0], [12, 1, 0], [13, 0, 1], [14, 1, 1]] },
    palette: { background: 0x0e1720, noteColors: { todo: 0xf2df8a, doing: 0x9ecbf0, blocked: 0xf0a3a3, done: 0xa8e0b0 } },
    cast: {
      byName: Object.fromEntries(names.map((name, i) => [name, { name, displayName: `Orbi-${i + 1}`, shirt: '#' + workerColor(name).toString(16), blurb: 'Orbital worker' }])),
      defaultCharacter: 'jim',
      async getFrames(name) {
        if (disposed) throw new Error('Theme disposed');
        const index = Math.max(0, names.indexOf(name)) % 3;
        if (!workers.has(index)) workers.set(index, createWorkerTextures({ Texture, BufferImageSource }, WORKER_COLORS[index]));
        return workers.get(index).frames;
      },
    },
    async loadTextures(load) {
      if (disposed || owned.length) throw new Error('Theme textures may only be loaded once');
      try {
        owned.push(new Texture({ source: new BufferImageSource({ resource: room.atlas.pixels, width: room.atlas.width, height: room.atlas.height, format: 'rgba8unorm', scaleMode: 'nearest' }) }));
        for (const sheet of room.map.tilesets.slice(1)) {
          const url = urls[`../../../../../${sheet.image}`];
          if (!url) throw new Error('Missing approved room artwork');
          const texture = await load(url);
          if (disposed) { texture.destroy(true); throw new Error('Theme disposed'); }
          owned.push(texture);
          prepareLpcTexture(texture, sheet);
        }
        return owned;
      } catch (error) { dispose(); throw error; }
    },
    dispose,
  };
}
