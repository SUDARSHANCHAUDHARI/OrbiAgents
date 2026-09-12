import { createOfficeFurniture } from './furniture.mjs';

// Original procedural surfaces, not derived from the excluded upstream atlas.
// Six opaque surface tiles plus transparent monitor and shared-chair overlays.
export function createRoomAtlas() {
  const width = 688, height = 16;
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
  // Original architectural wall faces. Existing monitor and floor GIDs stay
  // stable; these variants only replace the old single-color wall tile.
  fillTile(22, [48, 66, 78], (x, y, b) => y < 3 ? [86, 108, 119] : y > 12 ? [28, 42, 51] : x % 8 === 0 ? [55, 75, 87] : b);
  fillTile(23, [45, 62, 74], (x, y, b) => x < 3 ? [79, 101, 113] : x > 12 ? [27, 40, 49] : y % 8 === 0 ? [52, 71, 83] : b);
  fillTile(24, [61, 70, 91], (x, y, b) => x < 2 ? [103, 92, 123] : x > 12 ? [35, 38, 57] : y % 6 === 0 ? [70, 79, 101] : b);
  fillTile(25, [117, 91, 48], (x, y, b) => x < 3 || x > 12 ? [174, 139, 65] : y < 2 ? [150, 119, 57] : y > 12 ? [70, 52, 33] : b);

  const chair = {
    outline: [28, 38, 47, 255], frame: [65, 83, 94, 255],
    cushion: [86, 150, 155, 255], highlight: [112, 181, 182, 255],
  };
  const rect = (tile, left, top, right, bottom, color) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) pixel(tile, x, y, color);
  };
  // Transparent original pixel chairs: up-facing, left-facing, right-facing.
  rect(26, 3, 5, 12, 6, chair.outline); rect(26, 4, 7, 11, 9, chair.cushion);
  rect(26, 3, 10, 12, 11, chair.frame); rect(26, 4, 12, 11, 13, chair.outline);
  rect(26, 4, 14, 5, 15, chair.frame); rect(26, 10, 14, 11, 15, chair.frame);
  rect(27, 8, 4, 10, 11, chair.frame); rect(27, 9, 5, 11, 9, chair.cushion);
  rect(27, 5, 10, 10, 12, chair.outline); rect(27, 6, 11, 9, 12, chair.highlight);
  rect(27, 5, 13, 6, 15, chair.frame); rect(27, 9, 13, 10, 15, chair.frame);
  rect(28, 5, 4, 7, 11, chair.frame); rect(28, 4, 5, 6, 9, chair.cushion);
  rect(28, 5, 10, 10, 12, chair.outline); rect(28, 6, 11, 9, 12, chair.highlight);
  rect(28, 5, 13, 6, 15, chair.frame); rect(28, 9, 13, 10, 15, chair.frame);

  // Original two-row kitchen counter with distinct left, middle, and right edges.
  for (let tile = 29; tile < 32; tile++) fillTile(tile, [104, 119, 122], (x, y, b) => {
    if (y < 3) return [181, 169, 143];
    if (y === 3) return [61, 72, 76];
    if ((tile === 29 && x < 2) || (tile === 31 && x > 13)) return [54, 68, 73];
    return (x + y) % 9 === 0 ? [115, 132, 134] : b;
  });
  for (let tile = 32; tile < 35; tile++) fillTile(tile, [75, 91, 96], (x, y, b) => {
    if (y < 2) return [94, 111, 114];
    if (y > 13) return [43, 54, 59];
    if ((tile === 32 && x < 2) || (tile === 34 && x > 13)) return [49, 63, 68];
    if (x === 7 || x === 8) return [61, 76, 81];
    return b;
  });

  const sign = { frame: [29, 42, 51, 255], face: [183, 164, 104, 255], mark: [47, 74, 82, 255] };
  for (let tile = 35; tile < 38; tile++) {
    rect(tile, 1, 2, 14, 13, sign.frame); rect(tile, 2, 3, 13, 12, sign.face);
  }
  // Workspace grid, boardroom table, and café mug glyphs.
  for (const [x, y] of [[4, 5], [9, 5], [4, 9], [9, 9]]) rect(35, x, y, x + 2, y + 2, sign.mark);
  rect(36, 4, 6, 11, 8, sign.mark); rect(36, 3, 9, 4, 11, sign.mark); rect(36, 11, 9, 12, 11, sign.mark);
  rect(37, 4, 6, 10, 10, sign.mark); rect(37, 10, 7, 12, 9, sign.mark); rect(37, 5, 11, 9, 11, sign.mark);

  const airlock = { frame: [31, 47, 57, 255], panel: [72, 96, 105, 255],
    light: [92, 211, 200, 255], seam: [20, 31, 39, 255] };
  rect(38, 2, 1, 15, 15, airlock.frame); rect(38, 5, 3, 15, 14, airlock.panel);
  rect(38, 13, 3, 15, 14, airlock.seam); rect(38, 4, 5, 5, 7, airlock.light);
  rect(39, 0, 1, 15, 15, airlock.frame); rect(39, 1, 3, 14, 14, airlock.panel);
  rect(39, 7, 3, 8, 14, airlock.seam); rect(39, 3, 5, 5, 6, airlock.light);
  rect(39, 10, 5, 12, 6, airlock.light);
  rect(40, 0, 1, 13, 15, airlock.frame); rect(40, 0, 3, 10, 14, airlock.panel);
  rect(40, 0, 3, 2, 14, airlock.seam); rect(40, 10, 5, 11, 7, airlock.light);

  const viewport = { frame: [27, 43, 54, 255], rim: [83, 111, 119, 255],
    glass: [38, 91, 116, 255], star: [157, 226, 215, 255] };
  rect(41, 2, 1, 13, 15, viewport.frame); rect(41, 4, 3, 11, 15, viewport.rim);
  rect(41, 5, 4, 10, 15, viewport.glass); rect(41, 7, 7, 7, 7, viewport.star);
  rect(42, 2, 0, 13, 14, viewport.frame); rect(42, 4, 0, 11, 12, viewport.rim);
  rect(42, 5, 0, 10, 11, viewport.glass); rect(42, 9, 4, 9, 4, viewport.star);
  return { width, height, pixels, tileset: {
    firstgid: 1, image: 'orbi-original-room', imagewidth: width, imageheight: height,
    tilewidth: 16, tileheight: 16, columns: 43, tilecount: 43,
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
    if (walls[i]) {
      if (x === 33) wallTiles[i] = [10, 14, 22, 26, 30].includes(y) ? 26 : 25;
      else if (y <= 1 || y === map.height - 1) wallTiles[i] = 23;
      else wallTiles[i] = 24;
    }
    // Fill uncovered appliance-counter cells with original connected surfaces.
    if (collision[i] && !walls[i] && !furniture[i]) {
      if (x >= 36 && x < 45 && y >= 15 && y < 17) {
        const edge = x === 36 ? 0 : x === 44 ? 2 : 1;
        furniture[i] = (y === 15 ? 30 : 33) + edge;
      } else furniture[i] = 5;
    }
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
  const spawnObjects = map.layers.find(l => l.name === 'spawn-points').objects;
  const sharedSeatNames = ['warroom-1', 'warroom-2', ...result.cafeSeatNames];
  for (const name of sharedSeatNames) {
    const spawn = spawnObjects.find(point => point.name === name);
    if (!spawn) throw new Error(`Missing shared-seat spawn: ${name}`);
    const x = spawn.x / map.tilewidth, y = spawn.y / map.tileheight;
    const blocked = (dx, dy) => Boolean(collision[(y + dy) * map.width + x + dx]);
    const tile = blocked(0, -1) ? 26 : blocked(-1, 0) ? 27 : blocked(1, 0) ? 28 : -1;
    if (tile < 0) throw new Error(`Shared seat has no supported table-facing direction: ${name}`);
    furnitureAbove[y * map.width + x] = atlas.tileset.firstgid + tile;
  }
  const zoneObjects = map.layers.find(l => l.name === 'zones').objects;
  const zoneSignTiles = { workspace: 35, boardroom: 36, cafeteria: 37 };
  for (const zone of zoneObjects) {
    const tile = zoneSignTiles[zone.name];
    if (tile === undefined) continue;
    const zoneX = zone.x / map.tilewidth, zoneY = zone.y / map.tileheight;
    const x = zone.name === 'workspace' ? zoneX + 1 : zoneX - 1;
    const y = zone.name === 'workspace' ? zoneY - 1 : zoneY + 2;
    const index = y * map.width + x;
    if (!walls[index] || furnitureAbove[index]) throw new Error(`Zone sign has no clear wall: ${zone.name}`);
    furnitureAbove[index] = atlas.tileset.firstgid + tile;
  }
  const entrance = spawnObjects.find(point => point.name === 'entrance');
  if (!entrance) throw new Error('Missing entrance spawn');
  const entranceX = entrance.x / map.tilewidth;
  const airlockY = map.height - 1;
  for (let offset = -1; offset <= 1; offset++) {
    const index = airlockY * map.width + entranceX + offset;
    if (!walls[index] || furnitureAbove[index]) throw new Error('Entrance airlock has no clear wall');
    furnitureAbove[index] = atlas.tileset.firstgid + 39 + offset;
  }
  for (const zone of zoneObjects.filter(({ name }) => name === 'boardroom' || name === 'cafeteria')) {
    const x = (zone.x + zone.width) / map.tilewidth;
    const centerY = (zone.y + zone.height / 2) / map.tileheight;
    for (let offset = -1; offset <= 0; offset++) {
      const y = centerY + offset;
      const index = y * map.width + x;
      if (!walls[index] || furnitureAbove[index]) throw new Error(`Zone viewport has no clear wall: ${zone.name}`);
      furnitureAbove[index] = atlas.tileset.firstgid + 42 + offset;
    }
  }
  return { ...result, atlas, map: { ...map,
    tilesets: [atlas.tileset, ...map.tilesets],
    layers: [
      { name: 'floor', type: 'tilelayer', data: floor },
      { name: 'walls', type: 'tilelayer', data: wallTiles }, ...map.layers,
      { name: 'furniture-above', type: 'tilelayer', data: furnitureAbove },
    ],
  } };
}
