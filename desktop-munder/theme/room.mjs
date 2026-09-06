import { createOfficeFurniture } from './furniture.mjs';

// Original procedural surfaces, not derived from the excluded upstream atlas.
// Six opaque surface tiles plus transparent 2x2 off/on monitor overlays.
export function createRoomAtlas() {
  const width = 224, height = 16;
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
  const pixel = (tile, x, y, color) => {
    const offset = (y * width + tile * 16 + x) * 4;
    pixels.set(color, offset);
  };
  const drawMonitor = (firstTile, lit) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      let color;
      if (x >= 2 && x <= 29 && y >= 3 && y <= 20) color = [31, 40, 49, 255];
      if (x >= 5 && x <= 26 && y >= 6 && y <= 17) color = lit ? [48, 126, 167, 255] : [13, 23, 30, 255];
      if (x >= 14 && x <= 17 && y >= 21 && y <= 26) color = [46, 55, 62, 255];
      if (x >= 9 && x <= 22 && y >= 27 && y <= 29) color = [55, 65, 72, 255];
      if (!color) continue;
      const tile = firstTile + Math.floor(y / 16) * 2 + Math.floor(x / 16);
      pixel(tile, x % 16, y % 16, color);
    }
  };
  drawMonitor(6, false);
  drawMonitor(10, true);
  return { width, height, pixels, tileset: {
    firstgid: 1, image: 'orbi-original-room', imagewidth: width, imageheight: height,
    tilewidth: 16, tileheight: 16, columns: 14, tilecount: 14,
  } };
}

export function createOfficeRoom(entries) {
  const result = createOfficeFurniture(entries);
  const { map, walls } = result;
  const floor = Array(map.width * map.height).fill(0);
  const wallTiles = Array(floor.length).fill(0);
  const furniture = map.layers.find(l => l.name === 'furniture-below').data;
  const furnitureAbove = Array(floor.length).fill(0);
  const collision = map.layers.find(l => l.name === 'collision').data;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    floor[i] = x > 33 ? (y >= 14 ? 2 : 3) : 1;
    if (walls[i]) wallTiles[i] = 4;
    // Make every remaining reserved table/counter footprint visible.
    if (collision[i] && !walls[i] && !furniture[i])
      furniture[i] = x >= 36 && x < 45 && y >= 15 && y < 17 ? 6 : 5;
  }
  // Every desk gets the original procedural off-monitor block. DeskScreen
  // overlays gids 11..14 while its worker is seated and animates inside it.
  for (const desk of result.desks) {
    const x = desk.x + 1, y = desk.y;
    furnitureAbove[y * map.width + x] = 7;
    furnitureAbove[y * map.width + x + 1] = 8;
    furnitureAbove[(y + 1) * map.width + x] = 9;
    furnitureAbove[(y + 1) * map.width + x + 1] = 10;
  }
  const atlas = createRoomAtlas();
  return { ...result, atlas, map: { ...map,
    tilesets: [atlas.tileset, ...map.tilesets],
    layers: [
      { name: 'floor', type: 'tilelayer', data: floor },
      { name: 'walls', type: 'tilelayer', data: wallTiles }, ...map.layers,
      { name: 'furniture-above', type: 'tilelayer', data: furnitureAbove },
    ],
  } };
}
