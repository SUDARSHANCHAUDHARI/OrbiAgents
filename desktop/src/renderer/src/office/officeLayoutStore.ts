import type { OrbitalCamera, OrbitalFloorId } from "./orbitalWorld";

export const OFFICE_LAYOUT_STORAGE_KEY = "orbiagents.office-layout.v1";
type CameraState = Pick<OrbitalCamera, "x" | "y" | "zoom">;
export interface OfficeLayout { floorId: OrbitalFloorId; cameras: Record<OrbitalFloorId, CameraState>; }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }

const DEFAULT_CAMERA: CameraState = { x: 0, y: 0, zoom: 1 };
const FLOOR_IDS: OrbitalFloorId[] = ["operations", "engineering", "support"];

export function defaultOfficeLayout(): OfficeLayout {
  return { floorId: "operations", cameras: { operations: { ...DEFAULT_CAMERA }, engineering: { ...DEFAULT_CAMERA }, support: { ...DEFAULT_CAMERA } } };
}

export function loadOfficeLayout(storage: StorageLike): OfficeLayout {
  try {
    const value: unknown = JSON.parse(storage.getItem(OFFICE_LAYOUT_STORAGE_KEY) ?? "null");
    if (!isRecord(value) || !FLOOR_IDS.includes(value.floorId as OrbitalFloorId) || !isRecord(value.cameras)) return defaultOfficeLayout();
    const persistedCameras = value.cameras;
    const cameras = Object.fromEntries(FLOOR_IDS.map((floorId) => [floorId, readCamera(persistedCameras[floorId])])) as OfficeLayout["cameras"];
    return { floorId: value.floorId as OrbitalFloorId, cameras };
  } catch { return defaultOfficeLayout(); }
}

export function saveOfficeLayout(storage: StorageLike, layout: OfficeLayout): void {
  try { storage.setItem(OFFICE_LAYOUT_STORAGE_KEY, JSON.stringify(layout)); } catch { /* Persistence is optional when storage is unavailable. */ }
}

function readCamera(value: unknown): CameraState {
  if (!isRecord(value) || typeof value.x !== "number" || typeof value.y !== "number" || !Number.isFinite(value.x) || !Number.isFinite(value.y) || (value.zoom !== 1 && value.zoom !== 2)) return { ...DEFAULT_CAMERA };
  const x = value.x; const y = value.y;
  if (Math.abs(x) > 10_000 || Math.abs(y) > 10_000) return { ...DEFAULT_CAMERA };
  return { x, y, zoom: value.zoom };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
