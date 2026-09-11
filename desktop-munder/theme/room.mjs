import { createOfficeFurniture } from './furniture.mjs';

// Original procedural surfaces, not derived from the excluded upstream atlas.
// Six opaque surface tiles plus transparent 2x2 off/on monitor overlays.
export function createRoomAtlas() {
  const width = 352, height = 16;
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

  // Original zone flooring. These tiles come after the stable monitor GIDs so
  // DeskScreen's 7..14 contract stays unchanged.
  const fillTile = (tile, base, detail) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const color = detail(x, y, base);
      pixel(tile, x, y, [...color, 255]);
    }
  };
  fillTile(14, [61, 75, 84], (x, y, b) => (x + y) % 8 === 0 ? b.map(c => c + 5) : b);
  fillTile(15, [57, 70, 79], (x, _y, b) => x === 0 || x === 15 ? [76, 91, 99] : b);
  fillTile(16, [64, 83, 96], (x, y, b) => (x + y) % 6 === 0 ? [72, 94, 108] : b);
  fillTile(17, [68, 88, 102], (x, y, b) => x < 2 || y < 2 ? [87, 109, 121] : b);
  fillTile(18, [126, 105, 77], (x, y, b) => (x < 8) === (y < 8) ? [136, 114, 84] : b);
  fillTile(19, [118, 96, 70], (x, y, b) => x === 0 || y === 0 ? [151, 128, 90] : b);
  fillTile(20, [74, 66, 88], (x, y, b) => x < 2 || x > 13 ? [104, 88, 118] : y % 5 === 0 ? [84, 75, 99] : b);
  fillTile(21, [137, 119, 82], (x, y, b) => y < 3 || y > 12 ? [174, 149, 94] : x % 5 === 0 ? [151, 130, 88] : b);
  return { width, height, pixels, tileset: {
    firstgid: 1, image: 'orbi-original-room', imagewidth: width, imageheight: height,
    tilewidth: 16, tileheight: 16, columns: 22, tilecount: 22,
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
  const accessoryGid = (image, sx = 0, sy = 0) => {
    const sheet = map.tilesets.find(t => t.image === `art/lpc-office/${image}`);
    if (!sheet) throw new Error(`Missing desk accessory sheet: ${image}`);
    return sheet.firstgid + sy * sheet.columns + sx;
  };
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    if (x === 33 && ((y >= 11 && y <= 13) || (y >= 23 && y <= 25))) floor[i] = 22;
    else if (x > 33 && y >= 14) floor[i] = (x + y) % 3 === 0 ? 20 : 19;
    else if (x > 33) floor[i] = (x + y) % 4 === 0 ? 18 : 17;
    else if (y >= 28 && x >= 18 && x <= 28) floor[i] = 21;
    else if ([7, 8, 13, 14, 19, 20, 25, 26, 31, 32].includes(x)) floor[i] = 16;
    else floor[i] = (x + y) % 7 === 0 ? 15 : 1;
    if (walls[i]) wallTiles[i] = 4;
    // Make every remaining reserved table/counter footprint visible.
    if (collision[i] && !walls[i] && !furniture[i])
      furniture[i] = x >= 36 && x < 45 && y >= 15 && y < 17 ? 6 : 5;
  }
  // Every desk gets the original procedural off-monitor block. DeskScreen
  // overlays gids 11..14 while its worker is seated and animates inside it.
  const accessories = [
    ['Laptop.png', 0, 0],
    ['Rotary Phones.png', 1, 0],
    ['Coffee Cup.png', 0, 0],
  ];
  for (const [index, desk] of result.desks.entries()) {
    const [image, sx, sy] = accessories[index % accessories.length];
    furnitureAbove[desk.y * map.width + desk.x] = accessoryGid(image, sx, sy);
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
