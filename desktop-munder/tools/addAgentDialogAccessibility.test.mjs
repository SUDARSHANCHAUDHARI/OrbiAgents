import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/renderer/src/components/AddAgentModal.tsx', import.meta.url), 'utf8');

test('Add Agent exposes a translated modal dialog and takes focus', () => {
  assert.match(modal, /role="dialog"\s+aria-modal="true"\s+aria-label=\{tr\('addAgent\.title'\)\}\s+tabIndex=\{-1\}/);
  assert.match(modal, /dialogRef\.current\?\.focus\(\);/);
});

test('Add Agent restores the Hire Agent control after closing', () => {
  assert.match(modal, /openerRef\.current = document\.activeElement instanceof HTMLElement/);
  assert.match(modal, /return \(\) => \{ openerRef\.current\?\.focus\(\); \};/);
});

test('Add Agent contains Tab navigation while preserving captured Escape handling', () => {
  assert.match(modal, /window\.addEventListener\('keydown', onKey, true\)/);
  assert.match(modal, /dialog\.querySelectorAll<HTMLElement>/);
  assert.match(modal, /e\.shiftKey && \(document\.activeElement === first \|\| document\.activeElement === dialog\)/);
  assert.match(modal, /e\.stopImmediatePropagation\(\);\s+onClose\(\);/);
});
