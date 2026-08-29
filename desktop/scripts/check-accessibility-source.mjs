import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const rendererRoot = path.resolve("src", "renderer", "src");
const files = await collect(rendererRoot, ".tsx");
let controls = 0;
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/<(input|select|textarea)\b[^>]*>/gs)) {
    controls += 1;
    if (!/aria-(?:label|labelledby)=/.test(match[0])) throw new Error(`${path.relative(rendererRoot, file)} has an unnamed ${match[1]} control`);
  }
  if (/<(?:div|span)\b[^>]*\bonClick=/.test(source)) throw new Error(`${path.relative(rendererRoot, file)} uses a non-semantic clickable element`);
  if (/tabIndex=\{?[1-9]/.test(source)) throw new Error(`${path.relative(rendererRoot, file)} uses a positive tab order`);
}

const app = await readFile(path.join(rendererRoot, "App.tsx"), "utf8");
required(app, "role=\"dialog\"", "first-run dialog role"); required(app, "aria-modal=\"true\"", "modal semantics"); required(app, "inert={firstRun}", "background isolation"); required(app, "lazy(() => import", "heavy surface lazy loading");
const terminal = await readFile(path.join(rendererRoot, "components", "TerminalPanel.tsx"), "utf8");
required(terminal, "screenReaderMode: true", "terminal screen-reader mode"); required(terminal, "prefers-reduced-motion: reduce", "terminal reduced motion");
const editor = await readFile(path.join(rendererRoot, "components", "FileEditorPanel.tsx"), "utf8");
required(editor, "originalAriaLabel", "diff editor labels"); required(editor, "ariaLabel: `Editor for", "editor label");
const office = await readFile(path.join(rendererRoot, "components", "PixelOffice.tsx"), "utf8");
required(office, "aria-hidden", "decorative canvas hiding"); required(office, "Accessible office agent controls", "canvas DOM alternative");
const css = await readFile(path.join(rendererRoot, "styles", "global.css"), "utf8");
required(css, ":focus-visible", "visible keyboard focus"); required(css, "@media (prefers-reduced-motion: reduce)", "reduced-motion CSS");
const html = await readFile(path.resolve("src", "renderer", "index.html"), "utf8"); required(html, "<html lang=\"en\">", "document language");

for (const [foreground, background, label] of [["#e5edf8", "#08101d", "primary text"], ["#9fb0c6", "#0b1524", "secondary text"], ["#7890aa", "#0b1524", "empty-state text"], ["#8fa6c0", "#0b1524", "section labels"], ["#fecaca", "#451a1a", "errors"]]) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) throw new Error(`${label} contrast ${ratio.toFixed(2)} is below 4.5:1`);
}
console.log(`Accessibility source checks passed for ${files.length} components and ${controls} named form controls`);

async function collect(directory, extension) { const output = []; for (const entry of await readdir(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); if (entry.isDirectory()) output.push(...await collect(target, extension)); else if (entry.isFile() && entry.name.endsWith(extension)) output.push(target); } return output; }
function required(source, value, label) { if (!source.includes(value)) throw new Error(`Missing ${label}`); }
function contrast(foreground, background) { const a = luminance(foreground); const b = luminance(background); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
function luminance(hex) { const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4); return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]; }
