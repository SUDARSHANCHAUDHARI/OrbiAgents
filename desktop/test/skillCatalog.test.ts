import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseSkill, SkillCatalog } from "../src/main/skills/skillCatalog";

test("skill catalog discovers bounded metadata and searches without exposing absolute paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-skills-"));
  await mkdir(path.join(root, "build-task"));
  await writeFile(path.join(root, "build-task", "SKILL.md"), "---\nname: build-task\ndescription: Build one safe change.\n---\nsecret body", "utf8");
  await mkdir(path.join(root, "broken"));
  await writeFile(path.join(root, "broken", "SKILL.md"), "not frontmatter", "utf8");
  await symlink(path.join(root, "build-task"), path.join(root, "linked"));
  const catalog = new SkillCatalog([{ label: "personal", path: root }]);
  assert.deepEqual(await catalog.list("safe"), [{ id: "personal:build-task/SKILL.md", name: "build-task", description: "Build one safe change.", source: "personal", relativePath: "build-task/SKILL.md" }]);
  assert.equal(JSON.stringify(await catalog.list()).includes(root), false);
});

test("skill frontmatter parser rejects missing and unbounded metadata", () => {
  assert.deepEqual(parseSkill("---\nname: test\ndescription: useful\n---\n"), { name: "test", description: "useful" });
  assert.equal(parseSkill("# no frontmatter"), null);
  assert.equal(parseSkill(`---\nname: ${"x".repeat(121)}\ndescription: useful\n---\n`), null);
});

test("skill removal accepts only a freshly discovered directory and delegates to Trash", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-skills-remove-")); await mkdir(path.join(root, "review")); await writeFile(path.join(root, "review", "SKILL.md"), "---\nname: review\ndescription: Review work.\n---\n"); const trashed: string[] = [];
  const catalog = new SkillCatalog([{ label: "personal", path: root }], { async trash(target) { trashed.push(target); } }); const [entry] = await catalog.list(); await catalog.remove(entry!.id); assert.deepEqual(trashed, [path.join(root, "review")]); await assert.rejects(catalog.remove("personal:missing/SKILL.md"), /not found/);
});
