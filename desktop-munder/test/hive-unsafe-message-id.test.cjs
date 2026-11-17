'use strict';

/**
 * Outbox JSON is agent-written. Its `id` becomes an inbox filename and its `to`
 * an agents/<to> directory, so neither may carry path separators or '.'/'..'.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager, isSafeMessageSegment } = loadTs('src/main/hive.ts');

async function floor(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-unsafe-id-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'worker-1', name: 'Creed', provider: 'claude', cwd: home });
  return { home, hive, outbox: path.join(home, 'hive', 'agents', 'worker-1', 'outbox') };
}

function listJson(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJson(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

test('isSafeMessageSegment accepts generated ids and rejects traversal', () => {
  for (const ok of ['2026-05-30T14-03-11-123Z-a1b2c3', 'msg-001', 'god', 'worker-abc.1_x']) {
    assert.equal(isSafeMessageSegment(ok), true, ok);
  }
  for (const bad of ['.', '..', '', '../x', 'a/b', 'a\\b', '../../../../tmp/evil', 'a b', null, undefined, 7]) {
    assert.equal(isSafeMessageSegment(bad), false, String(bad));
  }
});

test('a traversal id is regenerated and lands only in the recipient inbox', async (t) => {
  const { home, hive, outbox } = await floor(t);
  fs.writeFileSync(path.join(outbox, 'm.json'), JSON.stringify({
    id: '../../../../escaped', to: 'god', act: 'inform', subject: 's', body: 'b'
  }));
  assert.equal(hive.routeOnce(), 1);
  const inbox = hive.inbox('god-1');
  assert.equal(inbox.length, 1);
  assert.notEqual(inbox[0].id, '../../../../escaped');
  assert.equal(isSafeMessageSegment(inbox[0].id), true);
  assert.equal(listJson(home).some((p) => path.basename(p) === 'escaped.json'), false);
});

test('a traversal recipient is not written outside agents/ and bounces to god', async (t) => {
  const { home, hive, outbox } = await floor(t);
  // agents/../../outside resolves to <home>/outside, whose inbox/ exists.
  fs.mkdirSync(path.join(home, 'outside', 'inbox'), { recursive: true });
  fs.writeFileSync(path.join(outbox, 'm.json'), JSON.stringify({
    id: 'evil', to: '../../outside', act: 'inform', subject: 's', body: 'b'
  }));
  assert.equal(hive.routeOnce(), 1);
  // The router assigns its own id, so the agent's 'evil' never names a file anywhere.
  assert.deepEqual(listJson(home).filter((p) => path.basename(p) === 'evil.json'), []);
  assert.deepEqual(fs.readdirSync(path.join(home, 'outside', 'inbox')), []);
  assert.equal(hive.inbox('god-1').length, 1);
  assert.match(hive.inbox('god-1')[0].subject, /undeliverable/);
  assert.ok(hive.logTail(50).some((e) => e.kind === 'drop' && e.reason === 'no-inbox' && e.to === '../../outside'));
});
