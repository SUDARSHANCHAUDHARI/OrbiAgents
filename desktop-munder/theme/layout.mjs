// Original OrbiAgents geometry. No upstream map or artwork is copied here.
// Coordinates are tiles; Tiled object coordinates are pixels (16px tiles).
export function createOfficeLayout() {
  const width = 48, height = 32, tileSize = 16;
  const collision = Array(width * height).fill(0);
  const block = (x, y, w, h) => {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++) collision[row * width + col] = 1;
  };
  block(0, 0, width, 2); block(0, height - 1, width, 1);
  block(0, 0, 1, height); block(width - 1, 0, 1, height);
  // East meeting/café wing with two generous doorways.
  block(33, 2, 1, 9); block(33, 14, 1, 9); block(33, 26, 1, 5);
  const walls = [...collision];
  const spawns = [];
  const spawn = (name, x, y) => spawns.push({ name, x: x * tileSize, y: y * tileSize });
  spawn('entrance', 23, 29);
  const hireKiosk = {
    x: 19, y: 28, width: 2, height: 2,
    stand: { x: 21, y: 29 }, facing: 'left',
  };
  block(hireKiosk.x, hireKiosk.y, hireKiosk.width, hireKiosk.height);
  const desks = [];
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 5; column++) {
      const x = 3 + column * 6, y = 5 + row * 7;
      const name = row === 0 && column === 0 ? 'desk-ceo' : `pc-${row * 5 + column}`;
      desks.push({ name, x, y, width: 3, height: 2 });
      block(x, y, 3, 2);
      spawn(name, x + 1, y + 2);
    }
  }
  block(38, 6, 5, 2); // Extended meeting table, with seats beside its footprint.
  const warroomSeats = [
    ['warroom-1', 37, 6], ['warroom-2', 43, 6],
    ['warroom-3', 39, 5], ['warroom-4', 41, 5],
    ['warroom-5', 39, 8], ['warroom-6', 41, 8],
  ];
  for (const [name, x, y] of warroomSeats) spawn(name, x, y);
  block(38, 19, 4, 2);
  for (const [i, x, y] of [[1, 37, 19], [2, 42, 19], [3, 38, 21], [4, 41, 21]])
    spawn(`cafe-seat-${i}`, x, y);
  const loungeTable = { x: 43, y: 25, width: 1, height: 1 };
  block(loungeTable.x, loungeTable.y, loungeTable.width, loungeTable.height);
  spawn('cafe-seat-5', 43, 24); spawn('cafe-seat-6', 43, 26);
  block(36, 15, 9, 2); // Kitchen counter.
  spawn('cafe-stand-coffee', 38, 17); spawn('cafe-stand-vending', 44, 17);
  const coffee = {
    trayTile: { x: 36, y: 16 }, trayStand: { x: 36, y: 17 },
    machineStand: { x: 38, y: 17 }, sinkTile: { x: 42, y: 16 },
    sinkStand: { x: 42, y: 17 }, maxCups: 4,
  };
  const planter = {
    x: 31, y: 3, width: 1, height: 2,
    stand: { x: 30, y: 4 }, facing: 'right', fx: { x: 31, y: 4 },
  };
  block(planter.x, planter.y, planter.width, planter.height);
  const cafeteriaPlanter = {
    x: 46, y: 27, width: 1, height: 2,
    stand: { x: 45, y: 28 }, facing: 'right', fx: { x: 46, y: 28 },
  };
  block(cafeteriaPlanter.x, cafeteriaPlanter.y, cafeteriaPlanter.width, cafeteriaPlanter.height);
  const archiveShelf = {
    x: 31, y: 23, width: 2, height: 2,
    stand: { x: 30, y: 24 }, facing: 'right', fx: { x: 31, y: 23 },
  };
  block(archiveShelf.x, archiveShelf.y, archiveShelf.width, archiveShelf.height);
  const coldStorage = {
    x: 45, y: 15, width: 1, height: 2,
    stand: { x: 45, y: 17 }, facing: 'up', fx: { x: 45, y: 16 },
  };
  block(coldStorage.x, coldStorage.y, coldStorage.width, coldStorage.height);
  // Licensed LPC props placed on otherwise open tiles. Their adjacent stand
  // points stay walkable so the imported idle-errand director can use them.
  const props = [
    { name: 'water-cooler', image: 'Water Cooler.png', sx: 0, sy: 0, width: 1, height: 2, x: 30, y: 27 },
    { name: 'copy-machine', image: 'Copy Machine.png', sx: 0, sy: 0, width: 2, height: 2, x: 35, y: 3 },
    { name: 'bin-entry', image: 'Bins.png', sx: 0, sy: 0, width: 1, height: 1, x: 2, y: 28 },
    { name: 'bin-cafe', image: 'Bins.png', sx: 1, sy: 0, width: 1, height: 1, x: 45, y: 27 },
  ];
  for (const prop of props) block(prop.x, prop.y, prop.width, prop.height);
  const zone = (name, x, y, w, h) => ({ name, x: x * tileSize, y: y * tileSize, width: w * tileSize, height: h * tileSize });
  return {
    desks, coffee, loungeTable, hireKiosk, planter, cafeteriaPlanter, archiveShelf, coldStorage, props, walls,
    primarySeatNames: desks.map(({ name }) => name),
    warroomSeatNames: warroomSeats.map(([name]) => name),
    cafeSeatNames: [1, 2, 3, 4, 5, 6].map(i => `cafe-seat-${i}`),
    // Collision/spawn contract only. Visual layers and atlas remain separate.
    map: { width, height, tilewidth: tileSize, tileheight: tileSize, tilesets: [], layers: [
      { name: 'collision', type: 'tilelayer', data: collision },
      { name: 'spawn-points', type: 'objectgroup', objects: spawns },
      { name: 'zones', type: 'objectgroup', objects: [
        zone('workspace', 1, 2, 32, 28), zone('boardroom', 34, 2, 13, 12),
        zone('cafeteria', 34, 14, 13, 16),
      ] },
    ] },
  };
}
