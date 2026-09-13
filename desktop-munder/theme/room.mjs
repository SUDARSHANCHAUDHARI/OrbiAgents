import { createOfficeFurniture } from './furniture.mjs';

// Original procedural surfaces, not derived from the excluded upstream atlas.
// Six opaque surface tiles plus transparent monitor and shared-chair overlays.
export function createRoomAtlas() {
  const width = 1072, height = 16;
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
  fillTile(43, [99, 79, 40], (x, y, b) => x < 2 || x > 13 || y < 2 || y > 13
    ? [172, 139, 65] : (x + y) % 6 === 0 ? [116, 94, 48] : b);
  fillTile(44, [52, 72, 82], (x, y, b) => x === 0 || y === 0
    ? [89, 117, 124] : (x + y) % 8 === 0 ? [64, 88, 97] : b);
  const console = { frame: [25, 37, 45, 255], panel: [55, 76, 84, 255],
    glow: [92, 211, 200, 255], gold: [190, 151, 65, 255] };
  // Original two-tile command console wing. The right side remains the live
  // DeskScreen, so Orbi Prime keeps the same runtime monitor choreography.
  rect(45, 2, 1, 13, 15, console.frame); rect(45, 4, 3, 11, 13, console.panel);
  rect(45, 5, 5, 10, 8, console.glow); rect(45, 5, 10, 6, 11, console.gold);
  rect(45, 8, 10, 10, 11, console.gold);
  rect(46, 3, 0, 12, 13, console.frame); rect(46, 5, 1, 10, 10, console.panel);
  rect(46, 5, 3, 6, 8, console.glow); rect(46, 8, 3, 10, 8, console.gold);
  rect(46, 4, 14, 11, 15, console.frame);
  const plant = { outline: [25, 42, 43, 255], leaf: [67, 132, 91, 255],
    light: [98, 167, 111, 255], pot: [154, 104, 61, 255], rim: [201, 151, 81, 255] };
  // Original two-tile orbital planter: foliage above a compact illuminated pot.
  rect(47, 7, 1, 8, 14, plant.outline); rect(47, 3, 3, 7, 6, plant.leaf);
  rect(47, 8, 5, 12, 8, plant.light); rect(47, 5, 8, 9, 11, plant.leaf);
  rect(48, 3, 0, 12, 3, plant.rim); rect(48, 4, 4, 11, 13, plant.pot);
  rect(48, 5, 5, 10, 6, plant.rim); rect(48, 6, 14, 9, 15, plant.outline);
  const shelf = { frame: [27, 39, 47, 255], casework: [73, 91, 96, 255],
    gold: [184, 145, 61, 255], cyan: [78, 174, 174, 255], dark: [37, 53, 60, 255] };
  for (let tile = 49; tile < 53; tile++) rect(tile, 1, 1, 14, 15, shelf.frame);
  rect(49, 3, 3, 15, 15, shelf.casework); rect(50, 0, 3, 12, 15, shelf.casework);
  rect(51, 3, 0, 15, 12, shelf.casework); rect(52, 0, 0, 12, 12, shelf.casework);
  for (const tile of [49, 50, 51, 52]) {
    rect(tile, 3, 6, 12, 7, shelf.dark); rect(tile, 3, 11, 12, 12, shelf.dark);
    rect(tile, 5, 4, 6, 5, shelf.cyan); rect(tile, 9, 9, 11, 10, shelf.gold);
  }
  const cold = { frame: [25, 39, 48, 255], door: [78, 103, 111, 255],
    light: [168, 221, 211, 255], seam: [39, 59, 67, 255], gold: [185, 146, 62, 255] };
  rect(53, 2, 1, 13, 15, cold.frame); rect(53, 4, 3, 11, 14, cold.door);
  rect(53, 5, 4, 10, 6, cold.light); rect(53, 10, 8, 11, 12, cold.gold);
  rect(54, 2, 0, 13, 13, cold.frame); rect(54, 4, 0, 11, 11, cold.door);
  rect(54, 4, 1, 11, 2, cold.seam); rect(54, 10, 5, 11, 9, cold.gold);
  rect(54, 4, 12, 11, 13, cold.seam); rect(54, 5, 14, 6, 15, cold.frame);
  rect(54, 10, 14, 11, 15, cold.frame);
  // Down-facing chair completes the directional set for north-side table seats.
  rect(55, 4, 2, 11, 3, chair.frame); rect(55, 3, 4, 12, 5, chair.outline);
  rect(55, 4, 6, 11, 9, chair.cushion); rect(55, 5, 6, 10, 6, chair.highlight);
  rect(55, 3, 10, 12, 11, chair.frame); rect(55, 4, 12, 5, 15, chair.frame);
  rect(55, 10, 12, 11, 15, chair.frame);
  const wallControl = { frame: [29, 42, 51, 255], paper: [231, 224, 202, 255],
    red: [190, 74, 72, 255], ink: [74, 80, 83, 255], glow: [102, 202, 192, 255] };
  // Original wall calendar and orbital clock. Runtime keeps their hit targets,
  // while the durable pixel artwork now belongs to the room composition.
  rect(56, 2, 1, 13, 14, wallControl.frame); rect(56, 3, 3, 12, 13, wallControl.paper);
  rect(56, 3, 3, 12, 5, wallControl.red); rect(56, 5, 1, 5, 3, wallControl.ink);
  rect(56, 10, 1, 10, 3, wallControl.ink);
  for (const [x, y] of [[5, 7], [8, 7], [11, 7], [5, 10], [8, 10], [11, 10]])
    rect(56, x, y, x + 1, y + 1, wallControl.ink);
  rect(56, 8, 10, 9, 11, wallControl.red);
  rect(57, 2, 1, 13, 14, wallControl.frame); rect(57, 4, 3, 11, 12, wallControl.paper);
  rect(57, 7, 5, 8, 8, wallControl.ink); rect(57, 8, 8, 10, 9, wallControl.ink);
  rect(57, 7, 2, 8, 3, wallControl.glow); rect(57, 7, 12, 8, 13, wallControl.glow);
  const board = { frame: [78, 58, 43, 255], cork: [190, 158, 111, 255],
    edge: [117, 86, 57, 255], table: [112, 88, 62, 255], front: [79, 61, 47, 255] };
  // One reusable 2×2 cork-board base plus a one-tile archive cabinet. Live
  // headers, notes and document stacks remain scene overlays driven by tasks.
  rect(58, 0, 0, 15, 15, board.frame); rect(59, 0, 0, 13, 15, board.frame);
  rect(60, 0, 0, 15, 5, board.frame); rect(61, 0, 0, 13, 5, board.frame);
  rect(58, 2, 2, 15, 15, board.cork); rect(59, 0, 2, 11, 15, board.cork);
  rect(60, 2, 0, 15, 5, board.cork); rect(61, 0, 0, 13, 5, board.cork);
  rect(58, 2, 14, 15, 15, board.edge); rect(59, 0, 14, 13, 15, board.edge);
  rect(62, 1, 5, 14, 8, board.table); rect(62, 1, 9, 14, 13, board.front);
  rect(62, 2, 14, 4, 15, board.frame); rect(62, 11, 14, 13, 15, board.frame);
  const humanBoard = { frame: [77, 59, 89, 255], cork: [190, 158, 111, 255],
    edge: [132, 105, 145, 255] };
  rect(63, 0, 8, 15, 15, humanBoard.frame); rect(64, 0, 8, 13, 15, humanBoard.frame);
  rect(65, 0, 0, 15, 13, humanBoard.frame); rect(66, 0, 0, 13, 13, humanBoard.frame);
  rect(63, 2, 10, 15, 15, humanBoard.cork); rect(64, 0, 10, 11, 15, humanBoard.cork);
  rect(65, 2, 0, 15, 11, humanBoard.cork); rect(66, 0, 0, 11, 11, humanBoard.cork);
  rect(63, 2, 10, 15, 12, humanBoard.edge); rect(64, 0, 10, 11, 12, humanBoard.edge);
  return { width, height, pixels, tileset: {
    firstgid: 1, image: 'orbi-original-room', imagewidth: width, imageheight: height,
    tilewidth: 16, tileheight: 16, columns: 67, tilecount: 67,
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
  const planter = result.planter;
  for (let row = 0; row < planter.height; row++)
    furniture[(planter.y + row) * map.width + planter.x] = 48 + row;
  const archiveShelf = result.archiveShelf;
  for (let row = 0; row < archiveShelf.height; row++) {
    for (let col = 0; col < archiveShelf.width; col++)
      furniture[(archiveShelf.y + row) * map.width + archiveShelf.x + col] = 50 + row * 2 + col;
  }
  const coldStorage = result.coldStorage;
  for (let row = 0; row < coldStorage.height; row++)
    furniture[(coldStorage.y + row) * map.width + coldStorage.x] = 54 + row;
  const commandDesk = result.desks.find(desk => desk.name === 'desk-ceo');
  if (!commandDesk) throw new Error('Missing command desk');
  for (let y = commandDesk.y - 1; y <= commandDesk.y + commandDesk.height + 1; y++) {
    for (let x = commandDesk.x - 1; x <= commandDesk.x + commandDesk.width; x++) {
      const border = x === commandDesk.x - 1 || x === commandDesk.x + commandDesk.width
        || y === commandDesk.y - 1 || y === commandDesk.y + commandDesk.height + 1;
      floor[y * map.width + x] = border ? 44 : 45;
    }
  }
  // Every desk gets the original procedural off-monitor block. DeskScreen
  // overlays gids 11..14 while its worker is seated and animates inside it.
  const atlas = createRoomAtlas();
  const accessories = [
    ['Laptop.png', 0, 0],
    ['Rotary Phones.png', 1, 0],
    ['Coffee Cup.png', 0, 0],
  ];
  for (const [index, desk] of result.desks.entries()) {
    if (desk.name === 'desk-ceo') {
      furnitureAbove[desk.y * map.width + desk.x] = atlas.tileset.firstgid + 45;
      furnitureAbove[(desk.y + 1) * map.width + desk.x] = atlas.tileset.firstgid + 46;
    } else {
      const [image, sx, sy] = accessories[index % accessories.length];
      furnitureAbove[desk.y * map.width + desk.x] = accessoryGid(image, sx, sy);
    }
    const x = desk.x + 1, y = desk.y;
    furnitureAbove[y * map.width + x] = 7;
    furnitureAbove[y * map.width + x + 1] = 8;
    furnitureAbove[(y + 1) * map.width + x] = 9;
    furnitureAbove[(y + 1) * map.width + x + 1] = 10;
  }
  const spawnObjects = map.layers.find(l => l.name === 'spawn-points').objects;
  const seatNames = [...result.primarySeatNames, ...result.warroomSeatNames, ...result.cafeSeatNames];
  for (const name of seatNames) {
    const spawn = spawnObjects.find(point => point.name === name);
    if (!spawn) throw new Error(`Missing seat spawn: ${name}`);
    const x = spawn.x / map.tilewidth, y = spawn.y / map.tileheight;
    const blocked = (dx, dy) => Boolean(collision[(y + dy) * map.width + x + dx]);
    const tile = blocked(0, -1) ? 26 : blocked(-1, 0) ? 27
      : blocked(1, 0) ? 28 : blocked(0, 1) ? 55 : -1;
    if (tile < 0) throw new Error(`Seat has no supported furniture-facing direction: ${name}`);
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
  const wallControls = {
    calendar: { x: 4, y: 1, tile: 56 },
    clock: { x: 24, y: 1, tile: 57 },
  };
  for (const [name, control] of Object.entries(wallControls)) {
    const index = control.y * map.width + control.x;
    if (!walls[index] || furnitureAbove[index]) throw new Error(`Wall control has no clear wall: ${name}`);
    furnitureAbove[index] = atlas.tileset.firstgid + control.tile;
  }
  const taskBoards = {
    anchor: { x: 38, y: 2 },
    boards: [{ x: 39, y: 2 }, { x: 41, y: 2 }],
    archive: { x: 43, y: 2 },
    human: { x: 35, y: 1, offsetY: 8 },
  };
  for (const origin of taskBoards.boards) {
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      const index = (origin.y + row) * map.width + origin.x + col;
      if (furnitureAbove[index]) throw new Error('Task board overlaps room furniture');
      furnitureAbove[index] = atlas.tileset.firstgid + 58 + row * 2 + col;
    }
  }
  const archiveIndex = taskBoards.archive.y * map.width + taskBoards.archive.x;
  if (furnitureAbove[archiveIndex]) throw new Error('Task archive overlaps room furniture');
  furnitureAbove[archiveIndex] = atlas.tileset.firstgid + 62;
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const index = (taskBoards.human.y + row) * map.width + taskBoards.human.x + col;
    if (furnitureAbove[index]) throw new Error('Human board overlaps room furniture');
    furnitureAbove[index] = atlas.tileset.firstgid + 63 + row * 2 + col;
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
  const viewports = [];
  for (const zone of zoneObjects.filter(({ name }) => name === 'boardroom' || name === 'cafeteria')) {
    const x = (zone.x + zone.width) / map.tilewidth;
    const centerY = (zone.y + zone.height / 2) / map.tileheight;
    viewports.push({ name: zone.name, x, topY: centerY - 1,
      stand: { x: x - 1, y: centerY }, facing: 'right', fx: { x, y: centerY - 1 } });
    for (let offset = -1; offset <= 0; offset++) {
      const y = centerY + offset;
      const index = y * map.width + x;
      if (!walls[index] || furnitureAbove[index]) throw new Error(`Zone viewport has no clear wall: ${zone.name}`);
      furnitureAbove[index] = atlas.tileset.firstgid + 42 + offset;
    }
  }
  return { ...result, viewports, wallControls, taskBoards, atlas, map: { ...map,
    tilesets: [atlas.tileset, ...map.tilesets],
    layers: [
      { name: 'floor', type: 'tilelayer', data: floor },
      { name: 'walls', type: 'tilelayer', data: wallTiles }, ...map.layers,
      { name: 'furniture-above', type: 'tilelayer', data: furnitureAbove },
    ],
  } };
}
