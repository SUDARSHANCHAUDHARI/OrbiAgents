const { execFileSync } = require("node:child_process");
const { lstatSync, readdirSync, rmSync } = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName;
  const resources = platform === "darwin"
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
    : path.join(context.appOutDir, "resources");
  if (platform === "darwin") {
    const productName = context.packager.appInfo.productFilename;
    const executable = path.join(context.appOutDir, `${productName}.app`, "Contents", "MacOS", productName);
    const architectures = execFileSync("lipo", ["-archs", executable], { encoding: "utf8" }).trim().split(/\s+/);
    if (!architectures.includes("arm64") || architectures.length !== 1) throw new Error("OrbiAgents macOS packaging currently supports arm64 only");
  }
  const expectedPrebuild = { darwin: "darwin-arm64", win32: "win32-x64", linux: "linux-x64" }[platform];
  if (!expectedPrebuild) throw new Error(`Unsupported package platform: ${platform}`);
  const prebuilds = path.join(resources, "app.asar.unpacked", "node_modules", "node-pty", "prebuilds");
  for (const name of readdirSync(prebuilds)) {
    const target = path.join(prebuilds, name);
    if (lstatSync(target).isSymbolicLink()) throw new Error(`Refusing symbolic node-pty prebuild path: ${name}`);
    if (name !== expectedPrebuild) rmSync(target, { recursive: true });
  }
};
