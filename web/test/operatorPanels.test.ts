import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AgentContextPanel from "../components/AgentContextPanel";
import WorkspaceReviewPanel from "../components/WorkspaceReviewPanel";
import WorkflowProposalPanel from "../components/WorkflowProposalPanel";
import ReplayBar from "../components/ReplayBar";

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

test("replay bar exposes timeline seeking, bookmarks, and event filters", () => {
  const html = renderToStaticMarkup(React.createElement(ReplayBar, { task: "test", current: 2, total: 5, speed: 1, playing: false, onStop() {}, onSpeedChange() {}, onTogglePlaying() {}, onSeek() {}, onStep() {}, bookmarked: true, onToggleBookmark() {}, onRemoveBookmark() {}, bookmarkFrames: [1,4], eventTypes: ["node-started"], eventFilter: "all", onEventFilterChange() {} }));
  assert.match(html, /Replay timeline/);
  assert.match(html, /Previous replay frame/);
  assert.match(html, /Next replay frame/);
  assert.match(html, />Play</);
  assert.match(html, /Edit replay bookmark/);
  assert.match(html, /Remove replay bookmark/);
  assert.match(html, /Replay event filter/);
});
