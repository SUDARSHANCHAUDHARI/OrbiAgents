import { listPackage } from "@electron/asar";
import { access, lstat, open, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const releaseRoot = path.resolve("release");
const metadata = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
if (typeof metadata.version !== "string" || !/^\d+\.\d+\.\d+$/.test(metadata.version)) throw new Error("Desktop package version is invalid");

const appRoot = path.join(releaseRoot, "linux-unpacked");
const executable = path.join(appRoot, "orbiagents-desktop");
const resources = path.join(appRoot, "resources");
const asar = path.join(resources, "app.asar");
const artifact = path.join(releaseRoot, `OrbiAgents-${metadata.version}-x86_64.AppImage`);
for (const file of [executable, asar, artifact]) await required(file);
if ((await stat(artifact)).size < 1_000_000) throw new Error("AppImage artifact is unexpectedly small");
await expectX64Elf(executable);
await expectX64Elf(artifact);

const packaged = listPackage(asar);
for (const expected of ["/out/main/index.js", "/out/preload/index.js", "/out/renderer/index.html", "/package.json"]) if (!packaged.includes(expected)) throw new Error(`ASAR is missing ${expected}`);
const forbidden = packaged.find((entry) => /(^|\/)(\.env[^/]*|[^/]+\.(pem|p12|p8|key|jks|keystore))$/i.test(entry));
if (forbidden) throw new Error(`Forbidden sensitive file path found in ASAR: ${forbidden}`);

const nativeRoot = path.join(resources, "app.asar.unpacked", "node_modules", "node-pty");
const nativeFiles = await findFiles(nativeRoot, (name) => name.endsWith(".node"));
const activeNative = path.join(nativeRoot, "build", "Release", "pty.node");
await required(activeNative);
const nativeRelative = nativeFiles.map((file) => path.relative(nativeRoot, file));
const allowedNative = new Set([path.join("build", "Release", "pty.node"), path.join("prebuilds", "linux-x64", "pty.node")]);
if (nativeRelative.some((file) => !allowedNative.has(file))) throw new Error(`Package contains unexpected node-pty native binaries: ${nativeRelative.join(", ")}`);
for (const file of nativeFiles) await expectX64Elf(file);

console.log(`Verified ${path.basename(artifact)} (Linux x64 AppImage with ${nativeFiles.length} native PTY binary)`);

async function findFiles(root, match) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name); const info = await lstat(candidate);
    if (info.isSymbolicLink()) throw new Error(`Unexpected symbolic link in native module: ${candidate}`);
    if (info.isDirectory()) output.push(...await findFiles(candidate, match)); else if (info.isFile() && match(entry.name)) output.push(candidate);
  }
  return output;
}
async function expectX64Elf(file) {
  const handle = await open(file, "r"); const header = Buffer.alloc(20);
  try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
  const isElf = header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  if (!isElf || header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62) throw new Error(`${path.basename(file)} is not a Linux x64 ELF binary`);
}
async function required(file) { await access(file); if (!(await lstat(file)).isFile()) throw new Error(`Required package file is invalid: ${file}`); }
