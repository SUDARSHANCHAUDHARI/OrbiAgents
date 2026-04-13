import { TileType } from "../types";

export function isWalkable(
  col: number, row: number,
  tileMap: TileType[][],
  blocked: Set<string> = new Set(),
): boolean {
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const t = tileMap[row][col];
  if (t === TileType.WALL || t === TileType.VOID) return false;
  if (blocked.has(`${col},${row}`)) return false;
  return true;
}

export function findPath(
  startCol: number, startRow: number,
  endCol: number, endRow: number,
  tileMap: TileType[][],
  blocked: Set<string> = new Set(),
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return [];
  if (!isWalkable(endCol, endRow, tileMap, blocked)) return [];

  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set<string>([key(startCol, startRow)]);
  const parent = new Map<string, string>();
  const queue = [{ col: startCol, row: startRow }];
  const dirs = [{ dc:0,dr:-1 },{ dc:0,dr:1 },{ dc:-1,dr:0 },{ dc:1,dr:0 }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.col === endCol && curr.row === endRow) {
      const path: Array<{ col: number; row: number }> = [];
      let k = key(endCol, endRow);
      while (parent.has(k)) {
        const [c, r] = k.split(",").map(Number);
        path.unshift({ col: c, row: r });
        k = parent.get(k)!;
      }
      return path;
    }
    for (const { dc, dr } of dirs) {
      const nc = curr.col + dc, nr = curr.row + dr;
      const nk = key(nc, nr);
      if (!visited.has(nk) && isWalkable(nc, nr, tileMap, blocked)) {
        visited.add(nk);
        parent.set(nk, key(curr.col, curr.row));
        queue.push({ col: nc, row: nr });
      }
    }
  }
  return [];
}
