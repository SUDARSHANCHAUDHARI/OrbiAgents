import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const graph = readFileSync(new URL('../src/renderer/src/components/MemoryGraphPanel.tsx', import.meta.url), 'utf8');

test('agent graph nodes expose a named keyboard action without focusing inert nodes', () => {
  assert.match(graph, /role=\{navigable \? 'button' : undefined\}/);
  assert.match(graph, /tabIndex=\{navigable \? 0 : undefined\}/);
  assert.match(graph, /aria-label=\{navigable \? `\$\{n\.label\} · \$\{t\('commandCenter\.tabs\.memory'\)\}` : undefined\}/);
});

test('agent graph nodes support Enter and Space activation', () => {
  assert.match(graph, /e\.key !== 'Enter' && e\.key !== ' '/);
  assert.match(graph, /e\.preventDefault\(\);\s+onJumpToMemory\(n\.id\);/);
});

test('keyboard focus shares node details and has an explicit visual marker', () => {
  assert.match(graph, /setCursor\(\{ x: p\.x, y: p\.y \}\);\s+hoverNode\(n\);/);
  assert.match(graph, /focusedNodeId === n\.id/);
  assert.match(graph, /stroke="var\(--cth-cyan\)" strokeWidth=\{2\}/);
});
