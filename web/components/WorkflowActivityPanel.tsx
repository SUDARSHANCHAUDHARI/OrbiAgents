"use client";

import React from "react";
import type { Agent, WorkflowEvent } from "@/lib/types";
import { describeWorkflowEvent, isSupervisorActive } from "@/lib/observability";
import { buildCoworkingZones, resolveAgentZone, summarizeZoneActivity } from "../../shared/world/coworking";

interface Props {
  agents: Agent[];
  events: WorkflowEvent[];
}

export default function WorkflowActivityPanel({ agents, events }: Props) {
  const activeAgents = agents.filter((agent) => !["idle", "done"].includes(agent.state));
  const recent = events.slice(-5).reverse();
  const supervisorActive = isSupervisorActive(events);
  const zoneActivity = summarizeZoneActivity(agents);
  const zoneLabels = Object.fromEntries(buildCoworkingZones(20, 15).map((zone) => [zone.id, zone.label]));

  return (
    <section className="orbi-observability" aria-label="Live workflow activity" aria-live="polite">
      <div className="orbi-observability__header">
        <div className={`orbi-prime ${supervisorActive ? "orbi-prime--active" : ""}`} aria-hidden="true">◆</div>
        <div>
          <strong>Orbi-Prime</strong>
          <span>{supervisorActive ? "supervising" : "standing by"}</span>
        </div>
        <span className="orbi-observability__count">{activeAgents.length} active</span>
      </div>
      <div className="orbi-observability__agents">
        {agents.map((agent) => (
          <span key={agent.id} className={`orbi-agent-chip orbi-agent-chip--${agent.state}`} title={agent.lastAction}>
            <i /> {agent.name} · {agent.state} · {zoneLabels[resolveAgentZone(agent.state, agent.paused)]}
          </span>
        ))}
      </div>
      <div className="orbi-observability__zones" aria-label="Zone activity">
        {Object.entries(zoneActivity).map(([zoneId, count]) => (
          <span key={zoneId}><b>{count}</b> {zoneLabels[zoneId]}</span>
        ))}
      </div>
      <ol className="orbi-observability__events">
        {recent.length === 0 ? (
          <li className="orbi-observability__empty">Run a workflow to see real activity.</li>
        ) : recent.map((event, index) => (
          <li key={`${event.timestamp}-${event.type}-${index}`}>
            <time>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
            <span>{describeWorkflowEvent(event)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
