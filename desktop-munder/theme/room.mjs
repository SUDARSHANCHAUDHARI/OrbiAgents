import { createOfficeFurniture } from './furniture.mjs';

// Original procedural surfaces, not derived from the excluded upstream atlas.
// Six 16px tiles: carpet, café stone, meeting-room wood, wall, table, counter.
export function createRoomAtlas() {
  const width = 96, height = 16;
  const pixels = new Uint8Array(width * height * 4);
  const palette = [[66, 78, 87], [160, 153, 134], [112, 82, 61],
    [78, 101, 111], [110, 72, 53], [155, 145, 119]];
  for (let tile = 0; tile < 6; tile++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let shade = 0;
    if (tile === 0) shade = (x + y) % 2 ? -2 : 2;
    if (tile === 1) shade = x === 0 || y === 0 ? -16 : 0;
    if (tile === 2) shade = y % 8 === 0 ? -16 : (x + y * 3) % 11 === 0 ? 5 : 0;
    if (tile === 3) shade = y < 2 ? 25 : y > 12 ? -24 : 0;
    if (tile >= 4) shade = y === 0 ? 18 : y > 12 ? -25 : 0;
    const offset = (y * width + tile * 16 + x) * 4;
    pixels.set([...palette[tile].map(c => c + shade), 255], offset);
  }
  return { width, height, pixels, tileset: {
    firstgid: 1, image: 'orbi-original-room', imagewidth: width, imageheight: height,
    tilewidth: 16, tileheight: 16, columns: 6, tilecount: 6,
  } };
}

export function createOfficeRoom(entries) {
  const result = createOfficeFurniture(entries);
  const { map, walls } = result;
  const floor = Array(map.width * map.height).fill(0);
  const wallTiles = Array(floor.length).fill(0);
  const furniture = map.layers.find(l => l.name === 'furniture-below').data;
  const collision = map.layers.find(l => l.name === 'collision').data;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    floor[i] = x > 33 ? (y >= 14 ? 2 : 3) : 1;
    if (walls[i]) wallTiles[i] = 4;
    // Make every remaining reserved table/counter footprint visible.
    if (collision[i] && !walls[i] && !furniture[i])
      furniture[i] = x >= 36 && x < 45 && y >= 15 && y < 17 ? 6 : 5;
  }
  const atlas = createRoomAtlas();
  return { ...result, atlas, map: { ...map,
    tilesets: [atlas.tileset, ...map.tilesets],
    layers: [
      { name: 'floor', type: 'tilelayer', data: floor },
      { name: 'walls', type: 'tilelayer', data: wallTiles }, ...map.layers,
    ],
  } };
}
