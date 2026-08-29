import { listPackage } from "@electron/asar";
import { execFile } from "node:child_process";
import { access, lstat, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const releaseRoot = path.resolve("release");
const packageMetadata = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
if (typeof packageMetadata.version !== "string" || !/^\d+\.\d+\.\d+$/.test(packageMetadata.version)) throw new Error("Desktop package version is invalid");
const version = packageMetadata.version;
const allowUnsigned = process.argv.includes("--allow-unsigned");
const appOnly = process.argv.includes("--app-only");
const requireReleaseSignature = process.argv.includes("--require-release-signature");
if (allowUnsigned === requireReleaseSignature) throw new Error("Choose exactly one signature verification mode");

const app = await findApp(releaseRoot);
const contents = path.join(app, "Contents");
const resources = path.join(contents, "Resources");
const executable = path.join(contents, "MacOS", "OrbiAgents");
const asar = path.join(resources, "app.asar");
await required(executable); await required(asar);
await expectPlist(contents, "CFBundleIdentifier", "com.sudarshantechlabs.orbiagents");
await expectPlist(contents, "CFBundleShortVersionString", version);
await expectArchitecture(executable, "arm64");

const packaged = listPackage(asar);
for (const expected of ["/out/main/index.js", "/out/preload/index.js", "/out/renderer/index.html", "/package.json"]) if (!packaged.includes(expected)) throw new Error(`ASAR is missing ${expected}`);
const forbidden = packaged.find((entry) => /(^|\/)(\.env[^/]*|[^/]+\.(pem|p12|p8|key|jks|keystore))$/i.test(entry));
if (forbidden) throw new Error(`Forbidden sensitive file path found in ASAR: ${forbidden}`);

const nativeRoot = path.join(resources, "app.asar.unpacked", "node_modules", "node-pty");
const nativeFiles = await findFiles(nativeRoot, (name) => name.endsWith(".node"));
const activeNative = path.join(nativeRoot, "prebuilds", "darwin-arm64", "pty.node");
await required(activeNative); await expectArchitecture(activeNative, "arm64");
const nativeRelative = nativeFiles.map((file) => path.relative(nativeRoot, file));
const allowedNative = new Set([path.join("build", "Release", "pty.node"), path.join("prebuilds", "darwin-arm64", "pty.node")]);
if (nativeRelative.some((file) => !allowedNative.has(file))) throw new Error(`Package contains unexpected node-pty native binaries: ${nativeRelative.join(", ")}`);
for (const file of nativeFiles) await expectArchitecture(file, "arm64");

if (!appOnly) {
  for (const extension of ["dmg", "zip"]) {
    const artifact = path.join(releaseRoot, `OrbiAgents-${version}-arm64.${extension}`);
    if ((await stat(artifact)).size < 1_000_000) throw new Error(`${extension.toUpperCase()} artifact is unexpectedly small`);
  }
}

if (requireReleaseSignature) {
  await run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
  const signature = await run("codesign", ["-dv", "--verbose=2", app]);
  if (!/Authority=Developer ID Application:/i.test(signature.stderr)) throw new Error("Package is not signed with a Developer ID Application identity");
  await run("spctl", ["--assess", "--type", "exec", "--verbose=2", app]);
  await run("xcrun", ["stapler", "validate", app]);
} else {
  const signature = await run("codesign", ["-dv", "--verbose=2", app]);
  if (/Authority=Developer ID Application:/i.test(signature.stderr) || !/TeamIdentifier=not set/i.test(signature.stderr)) throw new Error("Unsigned validation found a distribution signing identity");
  try { await run("codesign", ["--verify", "--deep", "--strict", app]); throw new Error("Unsigned validation unexpectedly found a valid signature"); }
  catch (error) { if (error instanceof Error && error.message.includes("unexpectedly")) throw error; }
}

console.log(`Verified ${path.basename(app)} (${allowUnsigned ? "unsigned local artifact" : "Developer ID signed and notarized"})`);

async function findApp(root) {
  for (const directory of (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    const candidate = path.join(root, directory, "OrbiAgents.app");
    try { if ((await lstat(candidate)).isDirectory()) return candidate; } catch { /* continue */ }
  }
  throw new Error("Packaged OrbiAgents.app was not found");
}
async function findFiles(root, match) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name); const info = await lstat(candidate);
    if (info.isSymbolicLink()) throw new Error(`Unexpected symbolic link in native module: ${candidate}`);
    if (info.isDirectory()) output.push(...await findFiles(candidate, match)); else if (info.isFile() && match(entry.name)) output.push(candidate);
  }
  return output;
}
async function expectPlist(contents, key, expected) { const { stdout } = await run("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, path.join(contents, "Info.plist")]); if (stdout.trim() !== expected) throw new Error(`${key} is ${stdout.trim()}, expected ${expected}`); }
async function expectArchitecture(file, expected) { const { stdout } = await run("lipo", ["-archs", file]); if (!stdout.trim().split(/\s+/).includes(expected)) throw new Error(`${path.basename(file)} does not include ${expected}`); }
async function required(file) { await access(file); if (!(await lstat(file)).isFile()) throw new Error(`Required package file is invalid: ${file}`); }
