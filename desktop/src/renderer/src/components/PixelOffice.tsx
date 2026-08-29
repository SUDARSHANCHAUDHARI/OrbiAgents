import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import type { ActivityEvent, AgentActivityState, AgentSession, HiveSnapshot } from "../../../shared/contracts";
import { buildOfficeAgents, buildOfficeLinks, OFFICE_ZONES, type OfficeAgent, type OfficeLink } from "../office/officeModel";

interface AgentView { container: Container; targetX: number; targetY: number; }

export function PixelOffice({ agents, activity, hive, selectedId, onSelect }: { agents: AgentSession[]; activity: ActivityEvent[]; hive: HiveSnapshot | null; selectedId: string | null; onSelect(id: string): void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const zoneLayerRef = useRef<Container | null>(null);
  const hiveLayerRef = useRef<Container | null>(null);
  const agentLayerRef = useRef<Container | null>(null);
  const viewsRef = useRef(new Map<string, AgentView>());
  const previousRef = useRef(new Map<string, { x: number; y: number }>());
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const [zoom, setZoom] = useState(1);
  const [sizeVersion, setSizeVersion] = useState(0);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion); reducedRef.current = reducedMotion;
  const states = useMemo(() => latestStates(activity), [activity]);
  const officeAgents = useMemo(() => buildOfficeAgents(agents, states), [agents, states]);
  const officeLinks = useMemo(() => buildOfficeLinks(hive, new Set(officeAgents.map((agent) => agent.id))), [hive, officeAgents]);

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
      app.ticker.add(() => viewsRef.current.forEach((view) => {
        const factor = reducedRef.current ? 1 : 0.14;
        view.container.x += (view.targetX - view.container.x) * factor;
        view.container.y += (view.targetY - view.container.y) * factor;
      }));
      setSizeVersion((value) => value + 1);
    });
    const observer = new ResizeObserver(() => setSizeVersion((value) => value + 1)); observer.observe(host);
    return () => {
      cancelled = true;
      observer.disconnect();
      viewsRef.current.clear();
      if (appRef.current === app) appRef.current = null;
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => {
    const app = appRef.current; const zones = zoneLayerRef.current; const hiveLayer = hiveLayerRef.current; const layer = agentLayerRef.current;
    if (!app || !zones || !hiveLayer || !layer || !app.screen.width || !app.screen.height) return;
    drawZones(zones, app.screen.width, app.screen.height);
    drawHive(hiveLayer, officeAgents, officeLinks, app.screen.width, app.screen.height, hive);
    layer.removeChildren().forEach((child) => child.destroy({ children: true })); viewsRef.current.clear();
    for (const agent of officeAgents) {
      const view = drawAgent(agent, agent.id === selectedId, () => onSelectRef.current(agent.id));
      const targetX = agent.x * app.screen.width; const targetY = agent.y * app.screen.height;
      const previous = previousRef.current.get(agent.id);
      view.x = (previous?.x ?? agent.x) * app.screen.width; view.y = (previous?.y ?? agent.y) * app.screen.height;
      layer.addChild(view); viewsRef.current.set(agent.id, { container: view, targetX, targetY });
      previousRef.current.set(agent.id, { x: agent.x, y: agent.y });
    }
    app.stage.scale.set(zoom); app.stage.position.set((app.screen.width * (1 - zoom)) / 2, (app.screen.height * (1 - zoom)) / 2);
  }, [officeAgents, officeLinks, hive, selectedId, sizeVersion, zoom]);

  return <section className="pixel-office" aria-label="OrbiAgents pixel office">
    <header><div><span className="eyebrow">LIVE COMMAND FLOOR</span><h2>Orbi Office</h2></div><div className="office-zoom" aria-label="Office zoom controls"><button aria-label="Zoom office out" type="button" onClick={() => setZoom((value) => Math.max(.8, value - .1))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom office in" type="button" onClick={() => setZoom((value) => Math.min(1.4, value + .1))}>+</button></div></header>
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

function drawZones(layer: Container, width: number, height: number): void {
  layer.removeChildren().forEach((child) => child.destroy({ children: true }));
  for (const zone of OFFICE_ZONES) {
    const x = zone.x * width; const y = zone.y * height; const w = zone.width * width; const h = zone.height * height;
    layer.addChild(new Graphics().roundRect(x, y, w, h, 10).fill({ color: zone.color, alpha: .08 }).stroke({ color: zone.color, alpha: .35, width: 2 }));
    const label = new Text({ text: zone.label.toUpperCase(), style: { fill: zone.color, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", letterSpacing: 1 } }); label.position.set(x + 10, y + 8); layer.addChild(label);
  }
}

function drawHive(layer: Container, agents: OfficeAgent[], links: OfficeLink[], width: number, height: number, hive: HiveSnapshot | null): void {
  layer.removeChildren().forEach((child) => child.destroy({ children: true }));
  const prime = { x: width * .8, y: height * .34 };
  const positions = new Map(agents.map((agent) => [agent.id, { x: agent.x * width, y: agent.y * height }]));
  for (const link of links) {
    const from = positions.get(link.fromAgentId);
    if (!from) continue;
    const color = link.kind === "message" ? 0xfbbf24 : 0x34d399;
    layer.addChild(new Graphics().moveTo(from.x, from.y).lineTo(prime.x, prime.y).stroke({ color, alpha: .6, width: link.kind === "message" ? 2 : 1 }));
    if (link.kind === "message") layer.addChild(new Graphics().roundRect((from.x + prime.x) / 2 - 5, (from.y + prime.y) / 2 - 4, 10, 8, 2).fill(color));
  }
  const pending = hive?.approvals.filter((approval) => approval.status === "pending").length ?? 0;
  layer.addChild(new Graphics().roundRect(prime.x - 28, prime.y - 18, 56, 36, 7).fill(0x172554).stroke({ color: pending ? 0xfbbf24 : 0x818cf8, width: 2 }));
  const label = new Text({ text: "ORBI-PRIME", style: { fill: 0xe0e7ff, fontFamily: "monospace", fontSize: 9, fontWeight: "bold" } }); label.anchor.set(.5); label.position.set(prime.x, prime.y); layer.addChild(label);
}

function drawAgent(agent: OfficeAgent, selected: boolean, select: () => void): Container {
  const container = new Container(); container.eventMode = "static"; container.cursor = "pointer"; container.on("pointertap", select);
  if (selected) container.addChild(new Graphics().circle(0, 0, 25).stroke({ color: 0xffffff, alpha: .9, width: 2 }));
  container.addChild(new Graphics().roundRect(-13, -12, 26, 25, 5).fill(agent.color).stroke({ color: 0x07111f, width: 3 }));
  container.addChild(new Graphics().circle(-5, -3, 2).fill(0x07111f).circle(5, -3, 2).fill(0x07111f).rect(-5, 6, 10, 2).fill(0x07111f));
  const state = new Graphics().circle(10, -10, 5).fill(stateColor(agent.state)).stroke({ color: 0x07111f, width: 2 }); container.addChild(state);
  const name = new Text({ text: agent.name, style: { fill: 0xe5edf8, fontFamily: "monospace", fontSize: 10, fontWeight: "bold" } }); name.anchor.set(.5, 0); name.position.set(0, 18); container.addChild(name);
  return container;
}

function stateColor(state: AgentActivityState): number { return state === "failed" ? 0xfb7185 : state === "permission-waiting" ? 0xfbbf24 : state === "coding" ? 0x60a5fa : state === "done" || state === "idle" ? 0x94a3b8 : 0x34d399; }
function useReducedMotion(): boolean { const [reduced, setReduced] = useState(false); useEffect(() => { const query = window.matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []); return reduced; }
