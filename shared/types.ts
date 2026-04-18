export type SpriteData = string[][];

export enum TileType {
  VOID        = 0,
  FLOOR_WOOD  = 1,
  FLOOR_TILE  = 2,
  FLOOR_CARPET= 3,
  WALL        = 4,
}

export enum Direction {
  DOWN  = "down",
  UP    = "up",
  RIGHT = "right",
  LEFT  = "left",
}

export enum CharacterState {
  IDLE     = "idle",
  WALKING  = "walking",
  TYPING   = "typing",
  READING  = "reading",
  DONE     = "done",
}

export interface TileCoord {
  col: number;
  row: number;
}

export interface FurnitureInstance {
  sprite: SpriteData;
  x: number;       // pixel x (top-left)
  y: number;       // pixel y (top-left)
  zY: number;      // Z-sort Y value
  mirrored?: boolean;
}

export interface Bubble {
  text: string;
  color: string;   // border + dot color
  fill: string;    // background fill
}

export interface CharacterRenderState {
  id: string;
  name: string;
  agentState: string; // "idle" | "thinking" | "reading" | "coding" | "permission-waiting" | "done" etc.
  paused: boolean;
  col: number;        // current tile col (float during interpolation)
  row: number;        // current tile row (float during interpolation)
  direction: Direction;
  charState: CharacterState;
  animFrame: number;  // 0-3
  paletteIndex: number; // 0-4
  selected: boolean;
  bubble?: Bubble;
  activeToolName?: string;
}
