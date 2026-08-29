const { execFileSync } = require("node:child_process");
const { lstatSync, readdirSync, rmSync } = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const productName = context.packager.appInfo.productFilename;
  const app = path.join(context.appOutDir, `${productName}.app`);
  const architectures = execFileSync("lipo", ["-archs", path.join(app, "Contents", "MacOS", productName)], { encoding: "utf8" }).trim().split(/\s+/);
  if (!architectures.includes("arm64") || architectures.length !== 1) throw new Error("OrbiAgents macOS packaging currently supports arm64 only");
  const prebuilds = path.join(app, "Contents", "Resources", "app.asar.unpacked", "node_modules", "node-pty", "prebuilds");
  for (const name of readdirSync(prebuilds)) {
    const target = path.join(prebuilds, name);
    if (lstatSync(target).isSymbolicLink()) throw new Error(`Refusing symbolic node-pty prebuild path: ${name}`);
    if (name !== "darwin-arm64") rmSync(target, { recursive: true });
  }
};
