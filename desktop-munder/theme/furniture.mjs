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
  for (const desk of layout.desks)
    stamp(desk.name, 'Desk, Ornate.png', 0, 0, 3, 2, desk.x, desk.y);
  stamp('coffee-machine', 'Coffee Maker.png', 0, 0, 1, 1,
    layout.coffee.machineStand.x, layout.coffee.machineStand.y - 1);
  return {
    ...layout, placements,
    map: { ...map, tilesets, layers: [
      { name: 'furniture-below', type: 'tilelayer', data }, ...map.layers,
    ] },
  };
}
