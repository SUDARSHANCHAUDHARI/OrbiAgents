// Original OrbiAgents robot design. No TV-character recipes or external pixels.
export const WORKER_WIDTH = 18;
export const WORKER_HEIGHT = 32;
export const WORKER_COLORS = [0x57c8bd, 0xe3b45f, 0xaa95d8];
export function workerFrame(direction, step, accent) {
  if (!['down', 'up', 'right'].includes(direction) || ![0, 1, 2].includes(step) || !WORKER_COLORS.includes(accent))
    throw new Error('Unsupported worker frame recipe');
  const data = new Uint8Array(WORKER_WIDTH * WORKER_HEIGHT * 4);
  const rect = (x, y, w, h, color) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const i = (row * WORKER_WIDTH + col) * 4;
      data.set([(color >> 16) & 255, (color >> 8) & 255, color & 255, 255], i);
    }
  };
  const ink = 0x263b49, shell = 0xc4cdc9, shade = 0x829c9e;
  const left = step === 1 ? 1 : 0, right = step === 2 ? 1 : 0;
  rect(5, 23 + left, 3, 6, shade); rect(10, 23 + right, 3, 6, shade);
  rect(4, 28 + left, 4, 2, ink); rect(10, 28 + right, 4, 2, ink);
  rect(4, 13, 10, 12, ink); rect(5, 14, 8, 9, shell);
  rect(5, 22, 8, 2, accent); rect(3, 15 + right, 2, 8, shade); rect(13, 15 + left, 2, 8, shade);
  rect(7, 11, 4, 3, shade); rect(3, 3, 12, 9, ink); rect(4, 4, 10, 7, shell);
  rect(8, 1, 2, 3, shade); rect(8, 1, 2, 1, accent);
  if (direction === 'up') {
    rect(5, 6, 8, 4, shade); rect(7, 16, 4, 5, ink); rect(8, 17, 2, 3, accent);
  } else if (direction === 'right') {
    rect(10, 5, 4, 4, ink); rect(12, 6, 2, 2, accent); rect(11, 16, 2, 3, accent);
  } else {
    rect(5, 5, 8, 4, ink); rect(6, 6, 2, 2, accent); rect(10, 6, 2, 2, accent);
    rect(7, 10, 4, 1, shade); rect(7, 16, 4, 4, accent); rect(8, 17, 2, 2, ink);
  }
  return data;
}

export function createWorkerTextures({ Texture, BufferImageSource }, accent) {
  const owned = [];
  const frames = ['down', 'up', 'right'].map(direction => {
    const row = [0, 1, 2].map(step => {
      const texture = new Texture({ source: new BufferImageSource({
        resource: workerFrame(direction, step, accent), width: WORKER_WIDTH, height: WORKER_HEIGHT,
        format: 'rgba8unorm', scaleMode: 'nearest',
      }) });
      owned.push(texture); return texture;
    });
    return [...row, row[0], row[0], row[0], row[0]];
  });
  return { frames, dispose() { for (const texture of owned) if (!texture.destroyed) texture.destroy(true); } };
}
