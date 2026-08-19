import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkflowActivityPanel from "../components/WorkflowActivityPanel";
import { buildMessageFlightPath, describeWorkflowEvent, isSupervisorActive } from "../lib/observability";

test("observability labels expose real node and retry details", () => {
  assert.equal(
    describeWorkflowEvent({ type: "node-retrying", timestamp: 1, nodeId: "review", detail: "attempt 2" }),
    "Orbi-Prime scheduled a retry · review · attempt 2"
  );
});

test("activity panel renders real supervisor and agent events", () => {
  const html = renderToStaticMarkup(React.createElement(WorkflowActivityPanel, {
    agents: [{
      id: "2", name: "Orbi-Beta", state: "coding", task: "Implementing", paused: false,
      tokensUsed: 3, inputTokens: 1, outputTokens: 2, costUsd: 0.01,
      lastAction: "Writing code", logs: [], x: 0, y: 0,
    }],
    events: [
      { type: "workflow-started", timestamp: 1 },
      { type: "node-started", timestamp: 2, nodeId: "code", detail: "Coder" },
    ],
  }));
  assert.match(html, /Orbi-Prime/);
  assert.match(html, /supervising/);
  assert.match(html, /Orbi-Beta · coding/);
  assert.match(html, /Agent started work · code · Coder/);
});

test("mailbox events produce a route between real agent positions", () => {
  const path = buildMessageFlightPath(
    { type: "mailbox-message", timestamp: 1, senderAgentId: "3", recipientAgentId: "2" },
    { "3": { x: 10, y: 30 }, "2": { x: 90, y: 50 } }
  );
  assert.equal(path, "M 10 30 Q 50 -30 90 50");
});

test("supervisor activity follows workflow terminal events", () => {
  assert.equal(isSupervisorActive([{ type: "workflow-started", timestamp: 1 }]), true);
  assert.equal(isSupervisorActive([
    { type: "workflow-started", timestamp: 1 },
    { type: "workflow-failed", timestamp: 2 },
  ]), false);
});
