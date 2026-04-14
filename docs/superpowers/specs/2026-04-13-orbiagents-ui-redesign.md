# OrbiAgents — Full UI Redesign + VS Code Extension

## Summary

Complete rebuild of the OrbiAgents canvas engine to match the pixel-agents reference, plus a new standalone VS Code extension. Both products share a common engine in `shared/`.

## Architecture

```
orbiagents/
├── shared/
│   ├── engine/          ← Tile map, Z-sort renderer, game loop
│   ├── sprites/         ← Sprite data, animation frames, hue shift
│   ├── pathfinding/     ← BFS on tile grid
│   └── types.ts         ← Agent, TileType, SpriteData, Direction
│
├── web/                 ← Existing Next.js app
│   └── components/GameCanvas.tsx  ← Replaced to use shared/engine
│
└── extension/           ← NEW VS Code extension
    ├── src/
    │   ├── extension.ts
    │   ├── agentManager.ts
    │   └── panel.ts
    └── webview-ui/      ← React webview using shared/engine
```

## Phase 1 — Shared Engine

### Tile Map
- 45×30 tile grid, 16×16 px per tile
- TileType enum: FLOOR_WOOD, FLOOR_TILE, FLOOR_CARPET, WALL, VOID
- Office zones:
  - Main wood floor: columns 0–30, all rows
  - Meeting room (tiled floor): columns 31–44, rows 0–17
  - Carpet lounge: columns 31–44, rows 18–29
  - Bookshelf wall: row 0, all columns

### Render Pipeline (`shared/engine/renderer.ts`)
- `requestAnimationFrame` loop at 60fps
- Z-sort: furniture + characters in one drawable list, sorted by `zY`
- Sprite cache: `WeakMap<SpriteData, HTMLCanvasElement>` keyed by zoom
- Outline sprite generator for selected agent (1px white pixel border)

### Character Sprites (`shared/sprites/characters.ts`)
- 16×32 px per frame, Minecraft-style proportions
- States × directions:
  - `walk`: DOWN/UP/LEFT/RIGHT × 4 frames
  - `typing`: DOWN/UP/LEFT/RIGHT × 2 frames
  - `idle`: 1 frame (standing)
  - `done`: 1 frame (arms up)
- 5 unique hue-shifted palettes (one per agent)
- Name label rendered above head
- State badge rendered below name (THINKING / CODING / DONE etc.)

### Pathfinding (`shared/pathfinding/bfs.ts`)
- BFS on 4-connected tile grid
- `findPath(startCol, startRow, endCol, endRow, tileMap, blockedTiles)`
- Each agent has a fixed home desk tile
- Movement: lerp between tiles at 3 tiles/sec
- Direction derived from movement delta → correct walk frame

### Furniture (`shared/sprites/furniture.ts`)
- Desk with monitor (placed at each agent's home position)
- Bookshelf (top wall, repeated)
- Plant (decorative, 3–4 positions)
- Meeting table (in tiled room)
- Lounge chair (in carpet zone)
- All placed as `FurnitureInstance` with grid position + zY for Z-sort

## Phase 2 — Web App Canvas Rebuild

- Replace `web/components/GameCanvas.tsx` with new implementation using `shared/engine`
- Keep all existing props interface: `agents`, `selectedId`, `isReplaying`, `onAgentClick`
- Add pan support (middle mouse drag)
- Add zoom (scroll wheel, clamped 1x–3x)
- Agent positions mapped to desk tiles; agents walk to desk on state change

## Phase 3 — UI Reskin

All panels restyled to match dark wood + pixel font aesthetic:

### SidePanel
- Background: `#0d0907`, border: `2px solid #3D2409`
- Labels: uppercase monospace, color `#7C3AED`
- Values: `#F5CBA7` (warm amber)
- Pause/Resume buttons: pixel-bordered, no border-radius

### ResultPanel
- Same pixel theme as SidePanel
- Tab bar: pixel underline indicator
- Code block: dark `#060402` bg, green monospace text retained

### WorkflowBuilder
- Pixel border panel
- Node boxes: pixel borders, same color coding as now
- Arrow SVGs: retained with flow animation

### Login Page
- Pixel art `O` logo with glow
- Dark wood card (`#0d0907`), pixel input borders
- CRT scanline overlay on background

### Header
- Add file-menu nav: View | Agents | Sessions
- Tighten spacing, ensure pixel font consistency

## Phase 4 — VS Code Extension Scaffold

### Extension Host (`extension/src/`)
- `extension.ts`: registers `orbiagents.openPanel` command, status bar item
- `panel.ts`: creates/shows `WebviewPanel` with `shared/engine` webview
- `agentManager.ts`: manages 5 agents with state, broadcasts to webview via `panel.webview.postMessage`

### Webview UI (`extension/webview-ui/`)
- React + Vite, same pixel office canvas using `shared/engine`
- Sidebar panel mode (160px wide) + Editor panel mode (full)
- Task input + Run button → posts `{ type: 'run', task }` to extension host
- Agent click → inline detail panel (no server needed)

### Build
- `esbuild` for extension host
- `vite` for webview UI
- `package.json` scripts: `build`, `dev`, `watch`

## Phase 5 — Extension Agent Logic

### Transcript Watcher (`extension/src/agentManager.ts`)
- Watches `~/.claude/projects/` for `*.jsonl` transcript files using `vscode.workspace.createFileSystemWatcher`
- Parses Claude Code tool calls → maps to agent states:
  - `bash` / `write` → agent state `coding`
  - `read` / `grep` / `glob` → agent state `thinking`
  - `agent` tool → new sub-agent spawned
  - No activity for 5s → agent state `idle`
- Updates agent state → posts to webview

### Workflow Runner (Active Mode)
- Task submitted from webview → extension host calls Claude API directly
- Planner → Coder chain (same as `server/orchestrator.ts`)
- Uses API key from VS Code setting `orbiagents.anthropicApiKey`
- Results posted back to webview

## Implementation Order

1. `shared/` — engine, sprites, pathfinding, types
2. Web app canvas rebuilt using shared engine
3. UI reskin — all panels
4. VS Code extension scaffold + webview
5. Extension transcript watcher + workflow runner
