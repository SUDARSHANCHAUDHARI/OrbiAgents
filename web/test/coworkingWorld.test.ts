import assert from "node:assert/strict";
import test from "node:test";
import {
  assignCoworkingTiles,
  buildCoworkingZones,
  resolveAgentZone,
  summarizeZoneActivity,
} from "../../shared/world/coworking";

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
