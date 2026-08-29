import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const desktopRoot = new URL("..", import.meta.url).pathname;
const read = (path) => readFile(join(desktopRoot, path), "utf8");
const failures = [];
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`Missing ${label}`);
};

const [main, html, ipc, packageJson, builder] = await Promise.all([
  read("src/main/index.ts"),
  read("src/renderer/index.html"),
  read("src/main/ipc/registerIpc.ts"),
  read("package.json"),
  read("electron-builder.yml"),
]);

for (const [text, label] of [
  ["contextIsolation: true", "context isolation"],
  ["nodeIntegration: false", "disabled Node integration"],
  ["sandbox: true", "renderer sandbox"],
  ["webviewTag: false", "disabled webview tags"],
  ["setWindowOpenHandler(() => ({ action: \"deny\" }))", "new-window denial"],
  ["will-navigate", "navigation denial"],
  ["setPermissionRequestHandler", "permission denial"],
]) requireText(main, text, label);

for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'"]) {
  requireText(html, directive, `CSP directive ${directive}`);
}
if (html.includes("'unsafe-eval'")) failures.push("CSP allows unsafe-eval");

const handlers = ipc.split("ipcMain.handle(").slice(1);
if (handlers.length === 0) failures.push("No IPC handlers found");
for (const [index, handler] of handlers.entries()) {
  const body = handler.split("ipcMain.handle(")[0];
  if (!body.includes("assertTrustedSender")) failures.push(`IPC handler ${index + 1} does not assert a trusted sender`);
}

const prohibited = [
  ["dangerouslySetInnerHTML", "dangerous HTML injection"],
  ["webSecurity: false", "disabled web security"],
  ["shell: true", "shell-enabled child process"],
  ["new Function(", "dynamic Function evaluation"],
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx|html)$/.test(entry.name)) files.push(path);
  }
  return files;
}

for (const path of await sourceFiles(join(desktopRoot, "src"))) {
  const source = await readFile(path, "utf8");
  for (const [needle, label] of prohibited) {
    if (source.includes(needle)) failures.push(`${label} in ${relative(desktopRoot, path)}`);
  }
}

requireText(packageJson, "--publish never", "non-publishing package scripts");
requireText(builder, "forceCodeSigning: true", "release code-signing requirement");

if (failures.length > 0) {
  console.error(`Security boundary check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Security boundary check passed: ${handlers.length} IPC handlers require trusted senders; Electron isolation, navigation, permissions, CSP, and release signing constraints are present.`);
