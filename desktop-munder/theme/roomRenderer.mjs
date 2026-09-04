import { createOfficeRoom } from './room.mjs';
import { prepareLpcTexture } from './lpcTextures.mjs';

/** Bind the original room to the upstream TiledMapRenderer.
 * Caller supplies the app's Pixi classes and imported TiledMapRenderer class,
 * plus dedicated, full-sheet LPC textures keyed by manifest path.
 * LPC textures remain caller-owned; dispose releases only scene-owned objects.
 */
export function createRoomRenderer({ Texture, BufferImageSource }, TiledMapRenderer, entries, lpcTextures) {
  const room = createOfficeRoom(entries);
  const sheets = room.map.tilesets.slice(1);
  // Validate every sheet before changing any supplied texture.
  for (const sheet of sheets) {
    const texture = lpcTextures.get(sheet.image);
    if (!texture || texture.destroyed || !texture.noFrame || texture.source.destroyed ||
        texture.source.pixelWidth !== sheet.imagewidth * 2 || texture.source.pixelHeight !== sheet.imageheight * 2)
      throw new Error(`Missing or invalid room texture: ${sheet.image}`);
  }
  const { atlas } = room;
  const structure = new Texture({ source: new BufferImageSource({
    resource: atlas.pixels, width: atlas.width, height: atlas.height,
    format: 'rgba8unorm', scaleMode: 'nearest',
  }) });
  let renderer;
  try {
    const textures = [structure, ...sheets.map(sheet => prepareLpcTexture(lpcTextures.get(sheet.image), sheet))];
    renderer = new TiledMapRenderer(room.map, textures);
  } catch (error) {
    structure.destroy(true);
    throw error;
  }
  let disposed = false;
  return {
    renderer, room,
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.getContainer().destroy({ children: true, texture: true, textureSource: false });
      structure.destroy(true);
    },
  };
}
