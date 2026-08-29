import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const renderer = path.resolve("out", "renderer");
const html = await readFile(path.join(renderer, "index.html"), "utf8");
const scriptPath = html.match(/<script[^>]+src="\.\/([^\"]+\.js)"/)?.[1];
const cssPath = html.match(/<link[^>]+href="\.\/([^\"]+\.css)"/)?.[1];
if (!scriptPath || !cssPath) throw new Error("Renderer entry assets were not found in built index.html");
const script = await metrics(path.join(renderer, scriptPath)); const css = await metrics(path.join(renderer, cssPath));
enforce("entry JavaScript raw", script.raw, 700_000); enforce("entry JavaScript gzip", script.gzip, 130_000); enforce("renderer CSS raw", css.raw, 30_000); enforce("renderer CSS gzip", css.gzip, 10_000);
const assets = await readdir(path.join(renderer, "assets"));
for (const prefix of ["FileEditorPanel-", "TerminalPanel-", "PixelOffice-"]) if (!assets.some((name) => name.startsWith(prefix) && name.endsWith(".js"))) throw new Error(`${prefix.slice(0, -1)} is not emitted as a lazy chunk`);
console.log(JSON.stringify({ entryJavaScript: script, css, budgets: { entryRaw: 700_000, entryGzip: 130_000, cssRaw: 30_000, cssGzip: 10_000 } }));

async function metrics(file) { const raw = (await stat(file)).size; const gzip = gzipSync(await readFile(file)).length; return { file: path.basename(file), raw, gzip }; }
function enforce(label, actual, maximum) { if (actual > maximum) throw new Error(`${label} ${actual} exceeds budget ${maximum}`); }
