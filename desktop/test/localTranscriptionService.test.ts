import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalTranscriptionService } from "../src/main/voice/localTranscriptionService";
import { VoicePolicyStore } from "../src/main/voice/voicePolicyStore";

test("local voice requires consent and retains only the configured transcript lifetime", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-local-voice-"));
  const whisper = path.join(root, "whisper-cli"); const ffmpeg = path.join(root, "ffmpeg"); const model = path.join(root, "ggml-base.bin");
  await writeFile(ffmpeg, "#!/bin/sh\ncp \"$5\" \"${11}\"\n");
  await writeFile(whisper, "#!/bin/sh\nprintf 'private local transcript\\n' > \"${7}.txt\"\n");
  await Promise.all([chmod(ffmpeg, 0o700), chmod(whisper, 0o700), writeFile(model, Buffer.alloc(1_000_000))]);
  const policy = new VoicePolicyStore(path.join(root, "policy.json"), () => 1_000); await policy.load();
  const service = new LocalTranscriptionService(path.join(root, "model.json"), path.join(root, "transcripts"), policy, { PATH: root }, () => 1_000);
  assert.equal((await service.load()).available, false);
  assert.equal((await service.setModel(model)).available, true);
  await assert.rejects(service.transcribe({ audio: new Uint8Array(200), mimeType: "audio/webm" }), /consent/);
  await policy.update({ consent: true, retention: "24-hours" });
  assert.deepEqual(await service.transcribe({ audio: new Uint8Array(200), mimeType: "audio/webm" }), { text: "private local transcript", createdAt: 1_000, retainedUntil: 86_401_000 });
  const retained = await readdir(path.join(root, "transcripts")); assert.equal(retained.length, 1); assert.equal((await readFile(path.join(root, "transcripts", retained[0]), "utf8")).trim(), "private local transcript");
  await service.clearRetained(); await assert.rejects(readdir(path.join(root, "transcripts")));
});

test("local voice rejects unbounded recordings and invalid model files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-local-voice-")); const policy = new VoicePolicyStore(path.join(root, "policy.json")); await policy.load();
  const service = new LocalTranscriptionService(path.join(root, "model.json"), path.join(root, "transcripts"), policy, { PATH: root }); await service.load();
  await assert.rejects(service.setModel(path.join(root, "missing.bin")), /invalid/);
  await policy.update({ consent: true, retention: "none" });
  await assert.rejects(service.transcribe({ audio: new Uint8Array(99), mimeType: "audio/webm" }), /invalid/);
});

test("local voice discovers the standard private multilingual model", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-local-voice-")); const bin = path.join(root, "bin"); const models = path.join(root, "models");
  await Promise.all([mkdir(bin), mkdir(models)]);
  const whisper = path.join(bin, "whisper-cli"); const ffmpeg = path.join(bin, "ffmpeg");
  await Promise.all([writeFile(whisper, "#!/bin/sh\n"), writeFile(ffmpeg, "#!/bin/sh\n"), writeFile(path.join(models, "ggml-base.bin"), Buffer.alloc(1_000_000))]);
  await Promise.all([chmod(whisper, 0o700), chmod(ffmpeg, 0o700)]);
  const policy = new VoicePolicyStore(path.join(root, "policy.json")); await policy.load();
  const service = new LocalTranscriptionService(path.join(root, "voice-model.json"), path.join(root, "transcripts"), policy, { PATH: bin });
  assert.deepEqual(await service.load(), { available: true, modelConfigured: true, modelName: "ggml-base.bin", detail: "Local transcription is ready." });
});

test("revoking and restoring consent discards an in-flight transcript and deletes its audio", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-voice-revoke-"));
  const marker = path.join(root, "started"); const release = path.join(root, "release");
  const whisper = path.join(root, "whisper-cli"); const ffmpeg = path.join(root, "ffmpeg"); const model = path.join(root, "ggml-base.bin");
  try {
    await writeFile(ffmpeg, "#!/bin/sh\ncp \"$5\" \"${11}\"\n");
    await writeFile(whisper, `#!/bin/sh\nprintf '%s' "$7" > '${marker}'\nwhile [ ! -f '${release}' ]; do sleep 0.01; done\nprintf 'discard this transcript' > "${7}.txt"\n`);
    await Promise.all([chmod(ffmpeg, 0o700), chmod(whisper, 0o700), writeFile(model, Buffer.alloc(1_000_000))]);
    const policy = new VoicePolicyStore(path.join(root, "policy.json")); await policy.load();
    const transcripts = path.join(root, "transcripts");
    const service = new LocalTranscriptionService(path.join(root, "model.json"), transcripts, policy, { PATH: root });
    await service.load(); await service.setModel(model); await policy.update({ consent: true, retention: "24-hours" });
    const rejected = assert.rejects(service.transcribe({ audio: new Uint8Array(200), mimeType: "audio/webm" }), /Local transcription failed/);
    let output = "";
    for (let attempt = 0; attempt < 200 && !output; attempt += 1) { output = await readFile(marker, "utf8").catch(() => ""); if (!output) await new Promise((resolve) => setTimeout(resolve, 10)); }
    try {
      assert.ok(output, "transcription reached the controlled in-flight boundary");
      await policy.update({ consent: false, retention: "none" }); await service.clearRetained();
      await policy.update({ consent: true, retention: "24-hours" });
    } finally { await writeFile(release, "continue"); }
    await rejected;
    assert.deepEqual(await readdir(transcripts).catch(() => []), []);
    await assert.rejects(readdir(path.dirname(output)), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
