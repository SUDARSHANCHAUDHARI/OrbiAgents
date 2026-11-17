'use strict';

/**
 * The per-provider base URL for a proxy-tier CLI (qwen) is that spawn's upstream
 * only. It used to be written to process.env, so it leaked into every later agent.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

test('ensureAgent uses the per-spawn upstream and leaves process.env alone', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-proxy-upstream-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const before = process.env.OPENAI_BASE_URL;
  const hive = new HiveManager(() => home, () => true);
  const upstreams = [];
  hive.startProxyBridge = async (_id, o) => { upstreams.push(o.upstream); return 43210; };

  const inj = await hive.ensureAgent(
    { id: 'qwen-1', name: 'Qwen', provider: 'qwen', cwd: home },
    { upstreamBaseUrl: 'http://127.0.0.1:11434/v1' }
  );

  assert.deepEqual(upstreams, ['http://127.0.0.1:11434/v1']);
  assert.equal(inj.env.OPENAI_BASE_URL, 'http://127.0.0.1:43210');
  assert.equal(process.env.OPENAI_BASE_URL, before);
});
