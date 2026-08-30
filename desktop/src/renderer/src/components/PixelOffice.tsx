import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import type { ActivityEvent, AgentActivityState, AgentSession, HiveSnapshot } from "../../../shared/contracts";
import { activityBubbleForState, pointOnOfficeLink } from "../office/officeEffects";
import { loadOfficeLayout, saveOfficeLayout } from "../office/officeLayoutStore";
import { buildOfficeAgents, buildOfficeLinks, type OfficeAgent, type OfficeLink } from "../office/officeModel";
import { clampOrbitalCamera, createOrbitalWorld, findOrbitalPath, floorForState, ORBITAL_FLOORS, ORBITAL_TILE_SIZE, stationById, type OrbitalCamera, type OrbitalFloorId, type OrbitalPosition, type OrbitalTileKind, type OrbitalWorld } from "../office/orbitalWorld";

interface AgentView { container: Container; actor: Container; route: OrbitalPosition[]; phase: number; targetX: number; targetY: number; }
interface AgentSprite { container: Container; actor: Container; }
interface TrafficView { container: Container; from: { x: number; y: number }; to: { x: number; y: number }; phase: number; speed: number; }
export function PixelOffice({ agents, activity, hive, selectedId, onSelect }: { agents: AgentSession[]; activity: ActivityEvent[]; hive: HiveSnapshot | null; selectedId: string | null; onSelect(id: string): void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const zoneLayerRef = useRef<Container | null>(null);
  const hiveLayerRef = useRef<Container | null>(null);
  const agentLayerRef = useRef<Container | null>(null);
  const viewsRef = useRef(new Map<string, AgentView>());
  const trafficRef = useRef<TrafficView[]>([]);
  const elapsedRef = useRef(0);
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const [layout, setLayout] = useState(() => loadOfficeLayout(window.localStorage));
  const floorId = layout.floorId;
  const camera = layout.cameras[floorId];
  const [sizeVersion, setSizeVersion] = useState(0);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion); reducedRef.current = reducedMotion;
  const states = useMemo(() => latestStates(activity), [activity]);
  const world = useMemo(() => createOrbitalWorld(floorId), [floorId]);
  const allOfficeAgents = useMemo(() => buildOfficeAgents(agents, states), [agents, states]);
  const officeAgents = useMemo(() => buildOfficeAgents(agents, states, world, floorId), [agents, states, world, floorId]);
  const officeLinks = useMemo(() => buildOfficeLinks(hive, new Set(officeAgents.map((agent) => agent.id))), [hive, officeAgents]);

  useEffect(() => saveOfficeLayout(window.localStorage, layout), [layout]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    void app.init({ resizeTo: host, background: 0x07111f, antialias: false, resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true }).then(() => {
      initialized = true;
      if (cancelled) return void app.destroy(true, { children: true });
      app.canvas.setAttribute("aria-hidden", "true");
      app.canvas.style.imageRendering = "pixelated";
      host.prepend(app.canvas);
      const zones = new Container(); const hiveLayer = new Container(); const agentLayer = new Container();
      app.stage.addChild(zones, hiveLayer, agentLayer);
      zoneLayerRef.current = zones; hiveLayerRef.current = hiveLayer; agentLayerRef.current = agentLayer; appRef.current = app;
      app.ticker.add((ticker) => {
        elapsedRef.current += ticker.deltaMS;
        viewsRef.current.forEach((view) => {
        const factor = reducedRef.current ? 1 : 0.14;
        if (Math.abs(view.targetX - view.container.x) < 1 && Math.abs(view.targetY - view.container.y) < 1 && view.route.length) {
          const next = view.route.shift()!;
          view.targetX = tileCenter(next.column); view.targetY = tileCenter(next.row);
        }
        const direction = Math.sign(view.targetX - view.container.x);
        if (direction) view.actor.scale.x = direction;
        view.container.x += (view.targetX - view.container.x) * factor;
        view.container.y += (view.targetY - view.container.y) * factor;
        const moving = Math.abs(view.targetX - view.container.x) > 1 || Math.abs(view.targetY - view.container.y) > 1;
        view.actor.y = reducedRef.current ? 0 : Math.round(Math.sin(elapsedRef.current / (moving ? 90 : 260) + view.phase) * (moving ? 2 : 1));
        });
        for (const traffic of trafficRef.current) {
          if (!reducedRef.current) traffic.phase = (traffic.phase + ticker.deltaMS * traffic.speed) % 1;
          const point = pointOnOfficeLink(traffic.from, traffic.to, reducedRef.current ? .5 : traffic.phase);
          traffic.container.position.set(Math.round(point.x), Math.round(point.y));
        }
      });
      setSizeVersion((value) => value + 1);
    });
    const observer = new ResizeObserver(() => setSizeVersion((value) => value + 1)); observer.observe(host);
    return () => {
      cancelled = true;
      observer.disconnect();
      viewsRef.current.clear();
      trafficRef.current = [];
      if (appRef.current === app) appRef.current = null;
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => {
    const app = appRef.current; const zones = zoneLayerRef.current; const hiveLayer = hiveLayerRef.current; const layer = agentLayerRef.current;
    if (!app || !zones || !hiveLayer || !layer || !app.screen.width || !app.screen.height) return;
    drawWorld(zones, world);
    trafficRef.current = drawHive(hiveLayer, officeAgents, officeLinks, hive, world);
    const currentPositions = new Map([...viewsRef.current].map(([id, view]) => [id, { x: view.container.x, y: view.container.y }]));
    layer.removeChildren().forEach((child) => child.destroy({ children: true })); viewsRef.current.clear();
    for (const agent of officeAgents) {
      const sprite = drawAgent(agent, agent.id === selectedId, () => onSelectRef.current(agent.id));
      const destination = { column: agent.column, row: agent.row };
      const current = currentPositions.get(agent.id);
      const previous = current ? positionFromPixels(current.x, current.y, world) : destination;
      const route = findOrbitalPath(world, previous, destination).slice(1);
      sprite.container.position.set(current?.x ?? tileCenter(previous.column), current?.y ?? tileCenter(previous.row));
      const firstTarget = route.shift() ?? destination;
      layer.addChild(sprite.container);
      viewsRef.current.set(agent.id, { ...sprite, route, phase: stablePhase(agent.id), targetX: tileCenter(firstTarget.column), targetY: tileCenter(firstTarget.row) });
    }
    const bounded = clampOrbitalCamera({ ...camera, viewportWidth: app.screen.width, viewportHeight: app.screen.height }, world);
    app.stage.scale.set(bounded.zoom); app.stage.position.set(bounded.x, bounded.y);
  }, [officeAgents, officeLinks, hive, selectedId, sizeVersion, camera, world]);

  function moveCamera(dx: number, dy: number): void {
    const app = appRef.current; if (!app) return;
    setLayout((current) => ({ ...current, cameras: { ...current.cameras, [floorId]: clampOrbitalCamera({ ...current.cameras[floorId], x: current.cameras[floorId].x + dx, y: current.cameras[floorId].y + dy, viewportWidth: app.screen.width, viewportHeight: app.screen.height }, world) } }));
  }

  function toggleZoom(): void {
    const app = appRef.current; if (!app) return;
    setLayout((current) => ({ ...current, cameras: { ...current.cameras, [floorId]: clampOrbitalCamera({ ...current.cameras[floorId], zoom: current.cameras[floorId].zoom === 1 ? 2 : 1, viewportWidth: app.screen.width, viewportHeight: app.screen.height }, world) } }));
  }

  function selectFloor(next: OrbitalFloorId): void { viewsRef.current.clear(); setLayout((current) => ({ ...current, floorId: next })); }

  return <section className="pixel-office" aria-label="OrbiAgents pixel office">
    <header><div><span className="eyebrow">LIVE ORBITAL DECK</span><h2>Orbi Operations</h2></div><div className="office-zoom" aria-label="Office floor and camera controls"><select aria-label="Orbital office floor" value={floorId} onChange={(event) => selectFloor(event.target.value as OrbitalFloorId)}>{ORBITAL_FLOORS.map((floor) => <option key={floor.id} value={floor.id}>{floor.label} ({allOfficeAgents.filter((agent) => floorForState(agent.state) === floor.id).length})</option>)}</select><button aria-label="Pan office left" type="button" onClick={() => moveCamera(96, 0)}>←</button><button aria-label="Pan office up" type="button" onClick={() => moveCamera(0, 96)}>↑</button><button aria-label="Pan office down" type="button" onClick={() => moveCamera(0, -96)}>↓</button><button aria-label="Pan office right" type="button" onClick={() => moveCamera(-96, 0)}>→</button><button aria-label={`Set office zoom to ${camera.zoom === 1 ? 2 : 1}x`} type="button" onClick={toggleZoom}>{camera.zoom}×</button></div></header>
    <div ref={hostRef} className="pixel-office-canvas" />
    <div className="office-hive-status" aria-live="polite">{hive ? `${hive.tasks.length} tasks · ${hive.primeInbox.length} messages · ${hive.approvals.filter((approval) => approval.status === "pending").length} pending approvals` : "No project Hive selected"}</div>
    <div className="office-agent-controls" aria-label="Accessible office agent controls">{officeAgents.map((agent) => <button type="button" key={agent.id} className={agent.id === selectedId ? "selected" : ""} onClick={() => onSelect(agent.id)}><i style={{ background: `#${agent.color.toString(16).padStart(6, "0")}` }} /><span>{agent.name}<small>{agent.state} · {agent.zone}</small></span></button>)}</div>
  </section>;
}

function latestStates(events: ActivityEvent[]): Record<string, AgentActivityState | undefined> {
  const states: Record<string, AgentActivityState | undefined> = {};
  for (const event of events) if (event.state) states[event.agentId] = event.state;
  return states;
}

function drawWorld(layer: Container, world: OrbitalWorld): void {
  layer.removeChildren().forEach((child) => child.destroy({ children: true }));
  const tiles = new Graphics();
  for (const tile of world.tiles) {
    if (tile.kind === "void") continue;
    const x = tile.column * world.tileSize; const y = tile.row * world.tileSize;
    const color = tileColor(tile.kind, tile.variant);
    tiles.rect(x, y, world.tileSize, world.tileSize).fill(color);
    if (tile.kind === "wall") tiles.rect(x + 3, y + 3, world.tileSize - 6, world.tileSize - 6).stroke({ color: 0x526887, alpha: .65, width: 2 });
    else tiles.moveTo(x, y + world.tileSize).lineTo(x + world.tileSize, y + world.tileSize).stroke({ color: 0x070b14, alpha: .34, width: 1 });
  }
  layer.addChild(tiles);
  for (const room of world.rooms) {
    const label = new Text({ text: room.label.toUpperCase(), style: { fill: room.accent, fontFamily: "monospace", fontSize: 10, fontWeight: "bold", letterSpacing: 1 } });
    label.position.set((room.column + 1) * world.tileSize, (room.row + 1) * world.tileSize); layer.addChild(label);
  }
  for (const station of world.stations) {
    const x = station.column * world.tileSize; const y = station.row * world.tileSize;
    layer.addChild(new Graphics().rect(x + 3, y + 5, world.tileSize - 6, world.tileSize - 8).fill(0x151f33).stroke({ color: station.color, width: 2 }).rect(x + 8, y + 9, world.tileSize - 16, 4).fill(station.color));
  }
}

function drawHive(layer: Container, agents: OfficeAgent[], links: OfficeLink[], hive: HiveSnapshot | null, world: OrbitalWorld): TrafficView[] {
  layer.removeChildren().forEach((child) => child.destroy({ children: true }));
  const traffic: TrafficView[] = [];
  const primeStation = stationById(world, "prime"); const prime = { x: (primeStation.column + .5) * world.tileSize, y: (primeStation.row + .5) * world.tileSize };
  const positions = new Map(agents.map((agent) => [agent.id, { x: tileCenter(agent.column), y: tileCenter(agent.row) }]));
  for (const link of links) {
    const from = positions.get(link.fromAgentId);
    if (!from) continue;
    const color = link.kind === "message" ? 0xfbbf24 : 0x34d399;
    layer.addChild(new Graphics().moveTo(from.x, from.y).lineTo(prime.x, prime.y).stroke({ color, alpha: .6, width: link.kind === "message" ? 2 : 1 }));
    const packet = new Graphics();
    if (link.kind === "message") packet.roundRect(-5, -4, 10, 8, 2).fill(color).rect(-3, -2, 6, 1).fill(0x07111f);
    else packet.circle(0, 0, 3).fill(color);
    layer.addChild(packet);
    traffic.push({ container: packet, from, to: prime, phase: stablePhase(link.id) / (Math.PI * 2), speed: link.kind === "message" ? .00022 : .00014 });
  }
  const pending = hive?.approvals.filter((approval) => approval.status === "pending").length ?? 0;
  layer.addChild(new Graphics().roundRect(prime.x - 28, prime.y - 18, 56, 36, 7).fill(0x172554).stroke({ color: pending ? 0xfbbf24 : 0x818cf8, width: 2 }));
  const label = new Text({ text: "ORBI-PRIME", style: { fill: 0xe0e7ff, fontFamily: "monospace", fontSize: 9, fontWeight: "bold" } }); label.anchor.set(.5); label.position.set(prime.x, prime.y); layer.addChild(label);
  return traffic;
}

function tileColor(kind: OrbitalTileKind, variant: number): number {
  if (kind === "wall") return variant % 2 ? 0x243451 : 0x1c2940;
  if (kind === "corridor") return variant % 2 ? 0x26364e : 0x2b3c56;
  if (kind === "threshold") return 0x8b621c;
  return variant % 2 ? 0x111b2d : 0x151f33;
}

function drawAgent(agent: OfficeAgent, selected: boolean, select: () => void): AgentSprite {
  const container = new Container(); container.eventMode = "static"; container.cursor = "pointer"; container.on("pointertap", select);
  if (selected) container.addChild(new Graphics().circle(0, 0, 25).stroke({ color: 0xffffff, alpha: .9, width: 2 }));
  const actor = new Container();
  actor.addChild(new Graphics().roundRect(-13, -12, 26, 25, 5).fill(agent.color).stroke({ color: 0x07111f, width: 3 }));
  actor.addChild(new Graphics().circle(-5, -3, 2).fill(0x07111f).circle(5, -3, 2).fill(0x07111f).rect(-5, 6, 10, 2).fill(0x07111f));
  actor.addChild(new Graphics().circle(10, -10, 5).fill(stateColor(agent.state)).stroke({ color: 0x07111f, width: 2 }));
  container.addChild(actor);
  const bubbleText = activityBubbleForState(agent.state);
  const bubble = new Container(); bubble.position.set(16, -32);
  bubble.addChild(new Graphics().roundRect(0, 0, bubbleText.length * 6 + 10, 17, 4).fill(0x07111f).stroke({ color: stateColor(agent.state), width: 1 }).moveTo(4, 17).lineTo(1, 21).lineTo(9, 17).fill(0x07111f));
  const bubbleLabel = new Text({ text: bubbleText, style: { fill: 0xe5edf8, fontFamily: "monospace", fontSize: 8, fontWeight: "bold" } }); bubbleLabel.position.set(5, 4); bubble.addChild(bubbleLabel); container.addChild(bubble);
  const name = new Text({ text: agent.name, style: { fill: 0xe5edf8, fontFamily: "monospace", fontSize: 10, fontWeight: "bold" } }); name.anchor.set(.5, 0); name.position.set(0, 18); container.addChild(name);
  return { container, actor };
}

function stateColor(state: AgentActivityState): number { return state === "failed" ? 0xfb7185 : state === "permission-waiting" ? 0xfbbf24 : state === "coding" ? 0x60a5fa : state === "done" || state === "idle" ? 0x94a3b8 : 0x34d399; }
function tileCenter(coordinate: number): number { return (coordinate + .5) * ORBITAL_TILE_SIZE; }
function positionFromPixels(x: number, y: number, world: OrbitalWorld): OrbitalPosition { return { column: Math.max(0, Math.min(world.columns - 1, Math.floor(x / ORBITAL_TILE_SIZE))), row: Math.max(0, Math.min(world.rows - 1, Math.floor(y / ORBITAL_TILE_SIZE))) }; }
function stablePhase(value: string): number { return [...value].reduce((total, character) => total + character.charCodeAt(0), 0) % 628 / 100; }
function useReducedMotion(): boolean { const [reduced, setReduced] = useState(false); useEffect(() => { const query = window.matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []); return reduced; }
