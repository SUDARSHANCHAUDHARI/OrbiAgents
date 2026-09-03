import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop packaging declares macOS, Windows, and Linux release targets", async () => {
  const config = await readFile(new URL("../electron-builder.yml", import.meta.url), "utf8");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(config, /^mac:/m); assert.match(config, /^win:/m); assert.match(config, /^linux:/m);
  assert.match(config, /- nsis/); assert.match(config, /- portable/); assert.match(config, /- AppImage/);
  assert.match(pkg.scripts["package:win:release"], /--win nsis portable --x64/);
  assert.match(pkg.scripts["package:linux:release"], /--linux AppImage --x64/);
  assert.match(pkg.scripts["package:linux:release"], /verify-linux-package\.mjs/);
  assert.equal(pkg.desktopName, "OrbiAgents"); assert.match(config, /syncDesktopName: true/);
  assert.equal(config.includes("!node_modules/node-pty/prebuilds/win32-"), false);
});
