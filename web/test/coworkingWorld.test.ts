import assert from "node:assert/strict";
import test from "node:test";
import {
  assignCoworkingTiles,
  buildCoworkingZones,
  resolveAgentZone,
  summarizeZoneActivity,
} from "../../shared/world/coworking";
import { calculateViewport, layoutAgents } from "../lib/dashboardLayout";
import type { Agent } from "../lib/types";

function agent(state: Agent["state"]): Agent {
  return {
    id: "2", name: "Orbi-Beta", state, task: "Working", paused: false,
    tokensUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
    lastAction: "", logs: [], x: 0, y: 0,
  };
}

test("agent states map to purposeful coworking zones", () => {
  assert.equal(resolveAgentZone("thinking"), "planning");
  assert.equal(resolveAgentZone("coding"), "focus");
  assert.equal(resolveAgentZone("reviewing"), "collaboration");
  assert.equal(resolveAgentZone("done"), "lounge");
  assert.equal(resolveAgentZone("coding", true), "lounge");
});

test("coworking assignment keeps agents inside their zone and on unique tiles", () => {
  const agents = [
    { id: "planner", state: "thinking" },
    { id: "coder-a", state: "coding" },
    { id: "coder-b", state: "debugging" },
    { id: "reviewer", state: "reviewing" },
    { id: "idle", state: "idle" },
  ];
  const definitions = Object.fromEntries(buildCoworkingZones(60, 30).map((zone) => [zone.id, zone]));
  const assignment = assignCoworkingTiles(agents, 60, 30);
  const positions = Object.values(assignment.tiles).map((tile) => `${tile.col}:${tile.row}`);

  assert.equal(new Set(positions).size, agents.length);
  agents.forEach((agent) => {
    const zone = definitions[assignment.zones[agent.id]];
    const tile = assignment.tiles[agent.id];
    assert.ok(tile.col >= zone.minCol && tile.col <= zone.maxCol);
    assert.ok(tile.row >= zone.minRow && tile.row <= zone.maxRow);
  });
});

test("zone activity summary reflects live and paused agent state", () => {
  assert.deepEqual(summarizeZoneActivity([
    { id: "1", state: "thinking" },
    { id: "2", state: "coding" },
    { id: "3", state: "testing" },
    { id: "4", state: "coding", paused: true },
  ]), {
    focus: 1,
    planning: 1,
    collaboration: 1,
    lounge: 1,
  });
});

test("agent state changes move the agent without moving the coworking world", () => {
  const viewport = calculateViewport(1200, 720);
  const planning = layoutAgents([agent("thinking")], viewport);
  const focus = layoutAgents([agent("coding")], viewport);

  assert.notDeepEqual(planning.homeTiles["2"], focus.homeTiles["2"]);
  assert.deepEqual(planning.contentBounds, focus.contentBounds);
  assert.deepEqual(planning.furniture, focus.furniture);
});
