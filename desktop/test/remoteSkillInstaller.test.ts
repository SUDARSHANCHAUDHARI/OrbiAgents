import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { RemoteCatalogClient, VerifiedCatalogArtifact } from "../src/main/catalog/remoteCatalogClient";
import { RemoteSkillInstaller } from "../src/main/skills/remoteSkillInstaller";

const catalog = { url: "https://catalog.example/catalog.json", publisherId: "publisher", keyId: "key-1", publicKey: "a".repeat(44) };
const skill = { id: "safe-review", name: "Safe Review", description: "Review changes safely", version: "1.0.0", files: [{ path: "SKILL.md", content: "---\nname: Safe Review\ndescription: Review changes safely\n---\n\n# Safe Review\n" }, { path: "references/checks.md", content: "# Checks\n" }] };

function artifact(value: unknown = { schemaVersion: 1, ...skill }): VerifiedCatalogArtifact { const bytes = new TextEncoder().encode(JSON.stringify(value)); return { bytes, publisherId: "publisher", keyId: "key-1", catalogUrl: catalog.url, entry: { id: skill.id, kind: "skill", name: skill.name, description: skill.description, version: skill.version, artifactUrl: "https://catalog.example/safe-review.json", size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") } }; }
function client(value: VerifiedCatalogArtifact): RemoteCatalogClient { return { downloadReviewedArtifact: async () => value } as unknown as RemoteCatalogClient; }

test("verified skill install writes constrained files and provenance without execution", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-skill-install-")); try { const result = await new RemoteSkillInstaller(client(artifact()), root, () => 1234).install({ catalog, entryId: skill.id, confirmed: true }); assert.equal(result.skill.source, "Orbi"); assert.match(await readFile(path.join(root, skill.id, "SKILL.md"), "utf8"), /Safe Review/); const provenance = JSON.parse(await readFile(path.join(root, skill.id, ".orbi-provenance.json"), "utf8")); assert.equal(provenance.sha256, result.provenance.sha256); assert.equal(provenance.installedAt, 1234); await assert.rejects(new RemoteSkillInstaller(client(artifact()), root).install({ catalog, entryId: skill.id, confirmed: true }), /already installed/); } finally { await rm(root, { recursive: true, force: true }); }
});

test("verified skill install requires confirmation and rejects unsafe or mismatched packages", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-skill-install-")); try { await assert.rejects(new RemoteSkillInstaller(client(artifact()), root).install({ catalog, entryId: skill.id, confirmed: false }), /invalid|confirmation/); await assert.rejects(new RemoteSkillInstaller(client(artifact({ schemaVersion: 1, ...skill, files: [{ path: "../SKILL.md", content: skill.files[0].content }] })), root).install({ catalog, entryId: skill.id, confirmed: true }), /path is unsafe/); await assert.rejects(new RemoteSkillInstaller(client(artifact({ schemaVersion: 1, ...skill, version: "2.0.0" })), root).install({ catalog, entryId: skill.id, confirmed: true }), /metadata does not match/); } finally { await rm(root, { recursive: true, force: true }); }
});
