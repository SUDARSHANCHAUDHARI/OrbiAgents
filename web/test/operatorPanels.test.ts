import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AgentContextPanel from "../components/AgentContextPanel";
import WorkspaceReviewPanel from "../components/WorkspaceReviewPanel";

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
