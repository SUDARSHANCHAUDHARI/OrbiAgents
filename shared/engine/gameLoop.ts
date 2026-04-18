import type { Bubble, CharacterRenderState, TileCoord } from "../types";
import { CharacterState, Direction, TileType } from "../types";
import { findPath } from "../pathfinding/bfs";

const MOVE_SPEED = 3; // tiles per second

export interface AgentInput {
  id: string;
  name: string;
  agentState: string;
  paused: boolean;
  paletteIndex: number;
  homeTile: TileCoord;
  activeToolName?: string;
}

const BUBBLE_PERMISSION: Bubble = { text: "...", color: "#F59E0B", fill: "#422006" };
const BUBBLE_DONE: Bubble       = { text: "✓",   color: "#22C55E", fill: "#052E16" };
const DONE_BUBBLE_TTL = 2; // seconds

interface AgentMotion {
  path: TileCoord[];
  pathIdx: number;
  col: number;
  row: number;
  direction: Direction;
  charState: CharacterState;
  animFrame: number;
  animTimer: number;
  homeTile: TileCoord;
  prevAgentState: string;
  doneBubbleTimer: number; // counts down from DONE_BUBBLE_TTL
}

export function createGameLoop(
  tileMap: TileType[][],
  homeTiles: Record<string, TileCoord>,
  onFrame: (chars: CharacterRenderState[]) => void,
) {
  const motions = new Map<string, AgentMotion>();
  let lastAgents: AgentInput[] = [];
  let rafId: number | null = null;
  let lastTime = performance.now();

  function getOrCreateMotion(agent: AgentInput): AgentMotion {
    if (motions.has(agent.id)) return motions.get(agent.id)!;
    const home = agent.homeTile ?? homeTiles[agent.id] ?? { col: 5, row: 5 };
    const motion: AgentMotion = {
      path: [], pathIdx: 0,
      col: home.col, row: home.row,
      direction: Direction.DOWN,
      charState: CharacterState.IDLE,
      animFrame: 0, animTimer: 0,
      homeTile: home,
      prevAgentState: "",
      doneBubbleTimer: 0,
    };
    motions.set(agent.id, motion);
    return motion;
  }

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const chars: CharacterRenderState[] = lastAgents.map((agent, i) => {
      const motion = getOrCreateMotion(agent);
      motion.homeTile = agent.homeTile ?? motion.homeTile;

      if (agent.paused) {
        return toRenderState(agent, motion, i);
      }

      const atHome =
        Math.abs(motion.col - motion.homeTile.col) < 0.1 &&
        Math.abs(motion.row - motion.homeTile.row) < 0.1;

      if (!atHome && motion.path.length === 0) {
        motion.path = findPath(
          Math.round(motion.col), Math.round(motion.row),
          motion.homeTile.col, motion.homeTile.row,
          tileMap,
        );
        motion.pathIdx = 0;
      }

      if (motion.path.length > 0 && motion.pathIdx < motion.path.length) {
        const target = motion.path[motion.pathIdx];
        const dx = target.col - motion.col;
        const dy = target.row - motion.row;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = MOVE_SPEED * dt;

        if (dist <= step) {
          motion.col = target.col;
          motion.row = target.row;
          motion.pathIdx++;
        } else {
          motion.col += (dx / dist) * step;
          motion.row += (dy / dist) * step;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
          motion.direction = dx > 0 ? Direction.RIGHT : Direction.LEFT;
        } else {
          motion.direction = dy > 0 ? Direction.DOWN : Direction.UP;
        }
        motion.charState = CharacterState.WALKING;
      } else {
        motion.path = [];
        motion.charState =
          agent.agentState === "coding" || agent.agentState === "thinking"
            ? CharacterState.TYPING
            : agent.agentState === "reading"
              ? CharacterState.READING
              : CharacterState.IDLE;
        if (agent.agentState !== "idle") {
          motion.direction = Direction.DOWN;
        }
      }

      const animSpeed = motion.charState === CharacterState.TYPING ? 0.3 : 0.2;
      motion.animTimer += dt;
      if (motion.animTimer >= animSpeed) {
        motion.animTimer = 0;
        motion.animFrame = (motion.animFrame + 1) % 4;
      }

      // Bubble lifecycle
      if (agent.agentState === "done" && motion.prevAgentState !== "done") {
        motion.doneBubbleTimer = DONE_BUBBLE_TTL;
      }
      if (motion.doneBubbleTimer > 0) {
        motion.doneBubbleTimer = Math.max(0, motion.doneBubbleTimer - dt);
      }
      motion.prevAgentState = agent.agentState;

      return toRenderState(agent, motion, i);
    });

    onFrame(chars);
    rafId = requestAnimationFrame(tick);
  }

  function toRenderState(
    agent: AgentInput,
    motion: AgentMotion,
    idx: number,
  ): CharacterRenderState {
    let bubble: Bubble | undefined;
    if (agent.agentState === "permission-waiting") {
      bubble = BUBBLE_PERMISSION;
    } else if (motion.doneBubbleTimer > 0) {
      bubble = BUBBLE_DONE;
    }

    return {
      id: agent.id,
      name: agent.name,
      agentState: agent.agentState,
      paused: agent.paused,
      col: motion.col,
      row: motion.row,
      direction: motion.direction,
      charState: motion.charState,
      animFrame: motion.animFrame,
      paletteIndex: agent.paletteIndex % 5,
      selected: false,
      bubble,
      activeToolName: agent.activeToolName,
    };
  }

  return {
    start() {
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    setAgents(agents: AgentInput[]) {
      lastAgents = agents;
    },
  };
}
