import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/renderer/src/components/EditAgentModal.tsx', import.meta.url), 'utf8');

test('Edit Agent exposes a named modal dialog and takes focus', () => {
  assert.match(modal, /role="dialog"\s+aria-modal="true"\s+aria-label=\{`Edit \$\{agent\.name\}`\}\s+tabIndex=\{-1\}/);
  assert.match(modal, /dialogRef\.current\?\.focus\(\);/);
});

test('Edit Agent restores its opener after closing', () => {
  assert.match(modal, /openerRef\.current = document\.activeElement instanceof HTMLElement/);
  assert.match(modal, /return \(\) => \{ openerRef\.current\?\.focus\(\); \};/);
});

test('Edit Agent contains tab focus and supports Escape dismissal', () => {
  assert.match(modal, /event\.key === 'Escape'[\s\S]*?event\.preventDefault\(\);\s+onClose\(\);/);
  assert.match(modal, /dialog\.querySelectorAll<HTMLElement>/);
  assert.match(modal, /event\.shiftKey && \(document\.activeElement === first \|\| document\.activeElement === dialog\)/);
  assert.match(modal, /document\.removeEventListener\('keydown', onKeyDown\)/);
});
