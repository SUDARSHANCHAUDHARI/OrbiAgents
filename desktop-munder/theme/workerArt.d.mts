export const WORKER_WIDTH: number;
export const WORKER_HEIGHT: number;
export const WORKER_COLORS: number[];
export const WORKER_NAMES: string[];
export function workerColor(name: string): number;
export function workerFrame(direction: string, step: number, accent: number): Uint8Array;
