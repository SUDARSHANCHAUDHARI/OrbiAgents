import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/renderer/src/components/QuitWarningModal.tsx', import.meta.url), 'utf8');

test('quit warning is a named modal alert dialog with progress state', () => {
  assert.match(modal, /role="alertdialog"\s+aria-modal="true"/);
  assert.match(modal, /aria-label=\{inClosingTime \? 'Closing time' : 'Quit OrbiAgents'\}/);
  assert.match(modal, /aria-busy=\{inClosingTime && closing\?\.phase !== 'complete'\}/);
});

test('quit warning owns focus and restores the interrupted control', () => {
  assert.match(modal, /openerRef\.current = document\.activeElement instanceof HTMLElement/);
  assert.match(modal, /dialogRef\.current\?\.focus\(\);/);
  assert.match(modal, /return \(\) => \{ openerRef\.current\?\.focus\(\); \};/);
});

test('quit warning contains tab focus and only permits cancellable Escape', () => {
  assert.match(modal, /const canCancel = !busy && closing\?\.phase !== 'complete'/);
  assert.match(modal, /event\.key === 'Escape' && canCancel/);
  assert.match(modal, /dialog\.querySelectorAll<HTMLElement>/);
  assert.match(modal, /document\.removeEventListener\('keydown', onKeyDown\)/);
});
