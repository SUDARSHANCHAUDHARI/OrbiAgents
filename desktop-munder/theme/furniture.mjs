import { createOfficeLayout } from './layout.mjs';
import { createLpcTilesets } from './lpcTextures.mjs';

// Source rectangles measured in 32px LPC cells, not 16px world pixels.
// Use the first front-facing ornate desk and first coffee-maker variant.
export function createOfficeFurniture(entries) {
  const layout = createOfficeLayout();
  const { map } = layout;
  const tilesets = createLpcTilesets(entries);
  const data = Array(map.width * map.height).fill(0);
  const placements = [];
  const stamp = (name, image, sx, sy, width, height, x, y) => {
    const sheet = tilesets.find(t => t.image === `art/lpc-office/${image}`);
    if (!sheet) throw new Error(`Missing furniture sheet: ${image}`);
    if (sx < 0 || sy < 0 || sx + width > sheet.columns || sy + height > sheet.tilecount / sheet.columns)
      throw new Error(`Furniture crop outside sheet: ${name}`);
    if (x < 0 || y < 0 || x + width > map.width || y + height > map.height)
      throw new Error(`Furniture outside map: ${name}`);
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
      const index = (y + row) * map.width + x + col;
      if (data[index]) throw new Error(`Overlapping furniture: ${name}`);
      data[index] = sheet.firstgid + (sy + row) * sheet.columns + sx + col;
    }
    placements.push({ name, image: sheet.image, sx, sy, width, height, x, y });
  };
  const stampColumns = (name, image, sourceColumns, sy, height, x, y) => {
    const sheet = tilesets.find(t => t.image === `art/lpc-office/${image}`);
    if (!sheet) throw new Error(`Missing furniture sheet: ${image}`);
    if (!sourceColumns.length || sourceColumns.some(sx => sx < 0 || sx >= sheet.columns)
      || sy < 0 || sy + height > sheet.tilecount / sheet.columns)
      throw new Error(`Furniture crop outside sheet: ${name}`);
    if (x < 0 || y < 0 || x + sourceColumns.length > map.width || y + height > map.height)
      throw new Error(`Furniture outside map: ${name}`);
    for (let row = 0; row < height; row++) for (const [col, sx] of sourceColumns.entries()) {
      const index = (y + row) * map.width + x + col;
      if (data[index]) throw new Error(`Overlapping furniture: ${name}`);
      data[index] = sheet.firstgid + (sy + row) * sheet.columns + sx;
    }
    placements.push({ name, image: sheet.image, sourceColumns, sy,
      width: sourceColumns.length, height, x, y });
  };
  // Alternate the sheet's two complete horizontal designs to keep the
  // workstation grid legible without repeating one identical silhouette.
  for (const [index, desk] of layout.desks.entries())
    stamp(desk.name, 'Desk, Ornate.png', 0, index % 2 === 0 ? 0 : 2, 3, 2, desk.x, desk.y);
  stamp('coffee-machine', 'Coffee Maker.png', 0, 0, 1, 1,
    layout.coffee.machineStand.x, layout.coffee.machineStand.y - 1);
  // Replace the largest procedural obstacle blocks with approved LPC props.
  // Crops stay entirely inside the existing collision footprints, so this is
  // visual density only and cannot change navigation.
  stampColumns('boardroom-table', 'Card Table.png', [0, 1, 1, 1, 2], 0, 2, 38, 6);
  stampColumns('cafe-table', 'Card Table.png', [0, 1, 1, 2], 2, 2, 38, 19);
  stamp('kitchen-sink', 'Sink.png', 0, 0, 1, 2, 42, 15);
  stamp('cafe-refreshment-dispenser', 'Water Cooler.png', 1, 0, 1, 2, 44, 15);
  // Wall-mounted details sit on the blocked top perimeter and therefore add
  // visual landmarks without consuming a single walkable tile.
  stamp('operations-display', 'TV, Widescreen.png', 0, 0, 3, 2, 38, 0);
  stamp('team-mailboxes', 'Mailboxes.png', 0, 1, 3, 1, 28, 1);
  for (const prop of layout.props)
    stamp(prop.name, prop.image, prop.sx, prop.sy, prop.width, prop.height, prop.x, prop.y);
  return {
    ...layout, placements,
    map: { ...map, tilesets, layers: [
      { name: 'furniture-below', type: 'tilelayer', data }, ...map.layers,
    ] },
  };
}
