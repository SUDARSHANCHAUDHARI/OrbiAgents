import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AgentContextPanel from "../components/AgentContextPanel";
import WorkspaceReviewPanel from "../components/WorkspaceReviewPanel";
import WorkflowProposalPanel from "../components/WorkflowProposalPanel";

test("workspace review panel renders explicit review and close controls", () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceReviewPanel, { onClose() {} }));
  assert.match(html, /Agent workspaces/);
  assert.match(html, /Review local changes/);
  assert.match(html, /Close workspace review/);
});

test("agent context panel renders memory and mailbox controls", () => {
  const html = renderToStaticMarkup(React.createElement(AgentContextPanel, { onClose() {} }));
  assert.match(html, /Agent context/);
  assert.match(html, /MEMORY/);
  assert.match(html, /MAILBOX/);
  assert.match(html, /SAVE MEMORY/);
});

test("workflow proposal panel makes approval gating explicit", () => {
  const html = renderToStaticMarkup(React.createElement(WorkflowProposalPanel, { workflow: { nodes: [{ id: "p", type: "planner" }], edges: [] }, onApply() {}, onClose() {} }));
  assert.match(html, /Orbi-Prime proposal/);
  assert.match(html, /Nothing changes until you explicitly confirm/);
});
