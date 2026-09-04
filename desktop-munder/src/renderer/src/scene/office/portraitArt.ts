// Original robot portraits and compatibility frames share the scene recipe.
import type { OfficeCharacterName } from './cast';
import { workerFrame, workerColor } from '../../../../../theme/workerArt.mjs';

export const PORTRAIT_W = 18;
export const PORTRAIT_H = 28;
export const SCENE_W = 18;
export const SCENE_H = 32;
export interface SceneFrames { front: Uint8ClampedArray[]; back: Uint8ClampedArray[]; }
export function sceneFrameBufs(name: OfficeCharacterName): SceneFrames {
  const frames = (direction: string) => [0, 1, 2].map(step =>
    new Uint8ClampedArray(workerFrame(direction, step, workerColor(name))));
  return { front: frames('down'), back: frames('up') };
}
/** Crop the same front-facing robot to the existing card portrait dimensions. */
export function portraitPixels(name: OfficeCharacterName): Uint8Array {
  return workerFrame('down', 0, workerColor(name)).slice(0, PORTRAIT_W * PORTRAIT_H * 4);
}
export function paintPortrait(ctx: CanvasRenderingContext2D, name: OfficeCharacterName, scale = 2): void {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid portrait scale');
  const stage = document.createElement('canvas');
  stage.width = PORTRAIT_W; stage.height = PORTRAIT_H;
  const source = stage.getContext('2d');
  if (!source) throw new Error('Portrait canvas unavailable');
  const image = source.createImageData(PORTRAIT_W, PORTRAIT_H);
  image.data.set(portraitPixels(name));
  source.putImageData(image, 0, 0);
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, PORTRAIT_W * scale, PORTRAIT_H * scale);
    ctx.drawImage(stage, 0, 0, PORTRAIT_W, PORTRAIT_H, 0, 0, PORTRAIT_W * scale, PORTRAIT_H * scale);
  } finally { ctx.restore(); }
}
