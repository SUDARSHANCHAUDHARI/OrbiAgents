'use strict';

/**
 * Outbox JSON is agent-written and the router runs on a timer in main. These
 * cases pin the router's handling of reused ids, a missing outbox/.sent,
 * oversize files, and control sequences bound for another agent's PTY.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager, terminalSafeText } = loadTs('src/main/hive.ts');

async function floor(t, emit) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-outbox-hardening-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home, emit);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'worker-1', name: 'Creed', provider: 'claude', cwd: home });
  return { hive, outbox: path.join(home, 'hive', 'agents', 'worker-1', 'outbox') };
}

function drops(hive, reason) {
  return hive.logTail(500).filter((e) => e.kind === 'drop' && e.reason === reason);
}

test('two messages reusing one agent id both reach the inbox with harness ids', async (t) => {
  const { hive, outbox } = await floor(t);
  fs.writeFileSync(path.join(outbox, 'a.json'), JSON.stringify({ id: 'msg-001', to: 'god', body: 'first' }));
  fs.writeFileSync(path.join(outbox, 'b.json'), JSON.stringify({ id: 'msg-001', to: 'god', body: 'second' }));

  assert.equal(hive.routeOnce(), 2);
  const inbox = hive.inbox('god-1');
  assert.deepEqual(inbox.map((m) => m.body).sort(), ['first', 'second']);
  assert.equal(new Set(inbox.map((m) => m.id)).size, 2);
  assert.equal(inbox.some((m) => m.id === 'msg-001'), false);
});

test('voiceMessages returns a routed agent-id message once, under the harness id', async (t) => {
  const { hive, outbox } = await floor(t);
  fs.writeFileSync(path.join(outbox, 'v.json'), JSON.stringify({ id: 'agent-chosen', to: 'god', subject: 'hi', body: 'once' }));

  assert.equal(hive.routeOnce(), 1);
  const [delivered] = hive.inbox('god-1');
  const all = hive.voiceMessages({ limit: 40 }).filter((m) => m.body === 'once');
  assert.equal(all.length, 1);
  assert.equal(all[0].id, delivered.id);
  assert.notEqual(all[0].id, 'agent-chosen');
  assert.deepEqual(hive.voiceMessages({ id: 'agent-chosen' }), []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outbox, '.sent', 'v.json'), 'utf8')).id, delivered.id);
  assert.equal(fs.existsSync(path.join(outbox, 'v.json')), false);
});

test('a deleted outbox/.sent is recreated so a message is delivered once', async (t) => {
  const { hive, outbox } = await floor(t);
  fs.rmSync(path.join(outbox, '.sent'), { recursive: true, force: true });
  fs.writeFileSync(path.join(outbox, 'm.json'), JSON.stringify({ to: 'god', body: 'once' }));

  assert.equal(hive.routeOnce(), 1);
  assert.equal(hive.routeOnce(), 0);
  assert.equal(hive.inbox('god-1').length, 1);
  assert.equal(fs.existsSync(path.join(outbox, '.sent', 'm.json')), true);
});

test('an oversize outbox file is quarantined unread and logged', async (t) => {
  const { hive, outbox } = await floor(t);
  const body = 'x'.repeat(1024 * 1024);
  fs.writeFileSync(path.join(outbox, 'big.json'), JSON.stringify({ to: 'god', body }));

  assert.equal(hive.routeOnce(), 0);
  assert.equal(hive.inbox('god-1').length, 0);
  assert.equal(fs.existsSync(path.join(outbox, '.sent', 'bad-big.json')), true);
  assert.equal(drops(hive, 'oversize').length, 1);
});

test('terminalSafeText removes paste-ending and keystroke controls but keeps tab and newline', () => {
  assert.equal(terminalSafeText('a\x1b[201~\rrm -rf ~\x03\x9bX\tb\nc'), 'a[201~rm -rf ~X\tb\nc');
  assert.equal(terminalSafeText(undefined), '');
  assert.equal(terminalSafeText(7), '7');
});

test('a terminal handoff carries no control sequences from the sender', async (t) => {
  const events = [];
  const { hive, outbox } = await floor(t, (channel, payload) => { events.push({ channel, payload }); return true; });
  // A hookless provider takes mail through the terminal handoff.
  await hive.ensureAgent({ id: 'term-1', name: 'Term', provider: 'claude', cwd: hive.root() });
  const regPath = path.join(hive.root(), 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  reg.agents['term-1'].provider = 'custom';
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
  fs.writeFileSync(path.join(outbox, 'h.json'), JSON.stringify({
    to: 'term-1', act: 'request\x1b[201~', subject: 's\r', body: 'line1\x1b[201~\r/quit\nline2'
  }));

  assert.equal(hive.routeOnce(), 1);
  const handoff = events.find((e) => e.channel === 'hive:terminalHandoff');
  assert.ok(handoff, 'handoff emitted');
  const { payload } = handoff;
  assert.equal(payload.body, 'line1[201~/quit\nline2');
  assert.equal(payload.subject, 's');
  assert.equal(payload.act, 'request[201~');
  for (const v of [payload.id, payload.from, payload.createdAt]) assert.doesNotMatch(v, /[\x00-\x08\x0b-\x1f\x7f-\x9f]/);
});
