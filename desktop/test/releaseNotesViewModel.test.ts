import assert from "node:assert/strict";
import test from "node:test";
import { releaseNoteBlocks } from "../src/renderer/src/command/releaseNotesViewModel";

test("release notes produce bounded safe structured blocks", () => {
  assert.deepEqual(releaseNoteBlocks("## Highlights\n- **Safer** updates\nRead the [guide](https://example.com)."), [
    { kind: "heading", text: "Highlights" }, { kind: "item", text: "Safer updates" }, { kind: "paragraph", text: "Read the guide." },
  ]);
  assert.equal(releaseNoteBlocks(Array.from({ length: 120 }, (_, index) => `Line ${index}`).join("\n")).length, 100);
});
