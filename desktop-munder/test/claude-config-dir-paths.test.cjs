'use strict';

/**
 * Claude Code reads projects/ and skills/ from $CLAUDE_CONFIG_DIR when it is set
 * (else ~/.claude). Transcript and skill paths must follow the same rule as
 * config.ts's claudeConfigDir().
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { projectDir } = loadTs('src/main/transcript.ts');
const { uninstallSkill } = loadTs('src/main/skills.ts');

function withEnv(t, vars) {
  const prev = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  t.after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-claude-config-dir-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('projectDir resolves under $CLAUDE_CONFIG_DIR/projects when set', (t) => {
  const config = tmpdir(t);
  withEnv(t, { CLAUDE_CONFIG_DIR: config });
  assert.equal(path.dirname(projectDir('/work/app')), path.join(config, 'projects'));
});

test('projectDir falls back to ~/.claude/projects when unset', (t) => {
  const home = tmpdir(t);
  withEnv(t, { HOME: home, CLAUDE_CONFIG_DIR: undefined });
  assert.equal(path.dirname(projectDir('/work/app')), path.join(home, '.claude', 'projects'));
});

test('a skill under $CLAUDE_CONFIG_DIR/skills is a managed user skill', (t) => {
  const config = tmpdir(t);
  withEnv(t, { CLAUDE_CONFIG_DIR: config });
  const skill = path.join(config, 'skills', 'demo');
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: demo\n---\n');
  assert.equal(uninstallSkill(skill, { cwds: [] }).ok, true);
  assert.ok(!fs.existsSync(skill));
});
