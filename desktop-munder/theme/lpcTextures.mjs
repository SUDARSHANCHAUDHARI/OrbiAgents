// LPC's 32px source grid maps onto the upstream engine's 16px world grid.
// Resolution changes sampling coordinates only; source image bytes stay intact.
export function createLpcTilesets(entries) {
  let firstgid = 257; // Leave 1..256 for original room structure.
  const seen = new Set();
  return entries.filter(entry => entry.path.endsWith('.png')).map(entry => {
    if (!/^art\/lpc-office\/[^/]+\.png$/.test(entry.path) || seen.has(entry.path))
      throw new Error('Invalid or duplicate LPC image path');
    seen.add(entry.path);
    if (![entry.width, entry.height].every(n => Number.isSafeInteger(n) && n > 0 && n % 32 === 0))
      throw new Error(`LPC dimensions must align with the 32px source grid: ${entry.path}`);
    const columns = entry.width / 32, tilecount = columns * entry.height / 32;
    const tileset = {
      image: entry.path, firstgid, columns, tilecount,
      tilewidth: 16, tileheight: 16,
      imagewidth: entry.width / 2, imageheight: entry.height / 2,
    };
    firstgid += tilecount;
    return tileset;
  });
}

/** Use only with a dedicated, full-sheet Pixi Texture before making tile views.
 * Do not apply to already-framed textures or shared sprites from another scene.
 */
export function prepareLpcTexture(texture, tileset) {
  if (!texture.noFrame || texture.destroyed || texture.source.destroyed)
    throw new Error('LPC preparation requires a live full-sheet texture');
  const source = texture.source;
  if (source.pixelWidth !== tileset.imagewidth * 2 || source.pixelHeight !== tileset.imageheight * 2)
    throw new Error(`LPC image dimensions do not match catalog: ${tileset.image}`);
  source.resolution = 2;
  source.scaleMode = 'nearest';
  // Pixi's resolution setter updates the source size but does not emit resize.
  // Refresh the full-sheet frame and UVs explicitly before the map slices it.
  texture.update();
  return texture;
}
