import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppDataMigrator } from "../src/main/persistence/appDataMigrator";

async function fixture(): Promise<string> { return mkdtemp(path.join(os.tmpdir(), "orbi-migration-")); }

test("migration creates a verified backup and advances the schema", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "agents.json"), "before", "utf8");
  const migrator = new AppDataMigrator(root, ["agents.json", "hive"], [{ fromVersion: 0, toVersion: 1, async migrate(appData) { await writeFile(path.join(appData, "agents.json"), "after", "utf8"); } }], { now: () => 100 });
  const result = await migrator.run(1);
  assert.equal(result.migrated, true);
  assert.equal(await readFile(path.join(root, "agents.json"), "utf8"), "after");
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "schema.json"), "utf8")), { version: 1, migratedAt: 100 });
  const backup = JSON.parse(await readFile(path.join(root, "migration-backups", result.backupId!, "backup.json"), "utf8"));
  assert.equal(backup.files[0].path, "agents.json");
  assert.equal(backup.files[0].bytes, 6);
});

test("failed migration restores existing state and removes newly-created managed state", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "agents.json"), "before", "utf8");
  const migrator = new AppDataMigrator(root, ["agents.json", "hive"], [{ fromVersion: 0, toVersion: 1, async migrate(appData) { await writeFile(path.join(appData, "agents.json"), "damaged", "utf8"); await mkdir(path.join(appData, "hive")); await writeFile(path.join(appData, "hive", "new.json"), "new", "utf8"); throw new Error("planned failure\nsecret detail"); } }], { now: () => 200 });
  await assert.rejects(migrator.run(1), /rolled back/);
  assert.equal(await readFile(path.join(root, "agents.json"), "utf8"), "before");
  await assert.rejects(readFile(path.join(root, "hive", "new.json"), "utf8"), { code: "ENOENT" });
  assert.deepEqual(await migrator.readFailure(), { backupId: (await migrator.readFailure())!.backupId, fromVersion: 0, toVersion: 1, failedAt: 200, message: "planned failure secret detail", rollbackCompleted: true });
});

test("corrupt schema and symbolic links fail closed before migration", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "schema.json"), "{", "utf8");
  let called = false;
  const migration = { fromVersion: 0, toVersion: 1, async migrate() { called = true; } };
  await assert.rejects(new AppDataMigrator(root, ["agents.json"], [migration]).run(1));
  assert.equal(called, false);
  await writeFile(path.join(root, "schema.json"), JSON.stringify({ version: 0, migratedAt: 0 }), "utf8");
  await symlink(path.join(root, "schema.json"), path.join(root, "agents.json"));
  await assert.rejects(new AppDataMigrator(root, ["agents.json"], [migration]).run(1), /Symbolic links/);
  assert.equal(called, false);
});

test("missing and ambiguous migration paths are rejected without changing schema", async () => {
  const root = await fixture();
  const migrator = new AppDataMigrator(root, ["agents.json"], []);
  await assert.rejects(migrator.run(1), /Missing app data migration/);
  await assert.rejects(readFile(path.join(root, "schema.json"), "utf8"), { code: "ENOENT" });
  assert.throws(() => new AppDataMigrator(root, ["agents.json"], [{ fromVersion: 0, toVersion: 2, async migrate() {} }]));
  assert.throws(() => new AppDataMigrator(root, ["hive", "hive/tasks.json"], []), /cannot overlap/);
});

test("rollback verifies backup checksums before removing current managed state", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "agents.json"), "before", "utf8");
  const migrator = new AppDataMigrator(root, ["agents.json"], [{ fromVersion: 0, toVersion: 1, async migrate(appData) {
    await writeFile(path.join(appData, "agents.json"), "changed", "utf8");
    const [backup] = await (await import("node:fs/promises")).readdir(path.join(appData, "migration-backups"));
    await writeFile(path.join(appData, "migration-backups", backup, "data", "agents.json"), "tampered", "utf8");
    throw new Error("failure");
  } }]);
  await assert.rejects(migrator.run(1), /rollback was incomplete/);
  assert.equal(await readFile(path.join(root, "agents.json"), "utf8"), "changed");
  assert.equal((await migrator.readFailure())?.rollbackCompleted, false);
});
