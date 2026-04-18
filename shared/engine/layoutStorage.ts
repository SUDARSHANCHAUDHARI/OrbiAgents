import type { SpriteData, FurnitureInstance } from "../types";
import {
  DESK_SPRITE,
  BOOKSHELF_SPRITE,
  PLANT_SPRITE,
  MEETING_TABLE_SPRITE,
  CHAIR_SPRITE,
  WHITEBOARD_SPRITE,
  SOFA_SPRITE,
  COFFEE_MACHINE_SPRITE,
} from "../sprites/furniture";
import { TILE_SIZE } from "./tileMap";

export type SpriteKey =
  | "desk"
  | "bookshelf"
  | "plant"
  | "meeting_table"
  | "chair"
  | "whiteboard"
  | "sofa"
  | "coffee_machine";

export const SPRITE_MAP: Record<SpriteKey, SpriteData> = {
  desk: DESK_SPRITE,
  bookshelf: BOOKSHELF_SPRITE,
  plant: PLANT_SPRITE,
  meeting_table: MEETING_TABLE_SPRITE,
  chair: CHAIR_SPRITE,
  whiteboard: WHITEBOARD_SPRITE,
  sofa: SOFA_SPRITE,
  coffee_machine: COFFEE_MACHINE_SPRITE,
};

export const SPRITE_LABELS: Record<SpriteKey, string> = {
  desk: "Desk",
  bookshelf: "Bookshelf",
  plant: "Plant",
  meeting_table: "Meeting Table",
  chair: "Chair",
  whiteboard: "Whiteboard",
  sofa: "Sofa",
  coffee_machine: "Coffee",
};

export interface CustomFurnitureItem {
  spriteKey: SpriteKey;
  col: number;
  row: number;
}

const STORAGE_KEY = "orbiagents_layout_v1";

export function loadCustomFurniture(): CustomFurnitureItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomFurnitureItem[];
  } catch {
    return [];
  }
}

export function saveCustomFurniture(items: CustomFurnitureItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage unavailable
  }
}

export function customItemToFurnitureInstance(item: CustomFurnitureItem): FurnitureInstance {
  const sprite = SPRITE_MAP[item.spriteKey];
  const spriteH = sprite.length;
  return {
    sprite,
    x: item.col * TILE_SIZE,
    y: item.row * TILE_SIZE,
    zY: (item.row + Math.ceil(spriteH / TILE_SIZE)) * TILE_SIZE,
  };
}
