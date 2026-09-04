import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("office renderer installs Pixi CSP compatibility without relaxing script policy", () => {
  const component = readFileSync(new URL("../src/renderer/src/components/PixelOffice.tsx", import.meta.url), "utf8");
  const html = readFileSync(new URL("../src/renderer/index.html", import.meta.url), "utf8");
  assert.match(component, /import "pixi\.js\/unsafe-eval";/);
  assert.match(html, /script-src 'self';/);
  assert.match(component, /catch\(\(\) => \{ if \(!cancelled\) setRenderFailed\(true\)/);
  assert.match(component, /renderFailed \? <p role="alert">/);
});

test("Pixi initialization checks pass with dynamic code generation blocked only after compatibility install", () => {
  // Exercise installed Pixi code in a fresh VM, not a browser or a GPU mock.
  // The navigator stub only supplies Pixi's platform-detection input.
  execFileSync(process.execPath, ["--disallow-code-generation-from-strings", "--input-type=module", "-e", `
    import assert from "node:assert/strict";
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node-test" }, configurable: true });
    const { AbstractRenderer, GlUboSystem } = await import("pixi.js");
    assert.throws(() => AbstractRenderer.prototype._unsafeEvalCheck(), /unsafe-eval/);
    assert.throws(() => GlUboSystem.prototype._systemCheck(), /unsafe-eval/);
    await import("pixi.js/unsafe-eval");
    assert.doesNotThrow(() => AbstractRenderer.prototype._unsafeEvalCheck());
    assert.doesNotThrow(() => GlUboSystem.prototype._systemCheck());
    assert.throws(() => new Function("return 1"), /Code generation/);
  `], { cwd: new URL("..", import.meta.url), timeout: 10_000, stdio: "pipe" });
});
