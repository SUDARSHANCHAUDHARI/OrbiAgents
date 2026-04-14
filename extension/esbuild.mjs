import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

// Extension host bundle — external: vscode (provided by VS Code runtime)
const extCtx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode", "fsevents"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  logLevel: "info",
});

// Hook script bundle — standalone CJS, no externals, runs in plain node
const hookCtx = await esbuild.context({
  entryPoints: ["src/hooks/claude-hook.ts"],
  bundle: true,
  outfile: "out/hooks/claude-hook.js",
  format: "cjs",
  platform: "node",
  sourcemap: false,
  logLevel: "info",
});

if (watch) {
  await extCtx.watch();
  await hookCtx.watch();
  console.log("Watching...");
} else {
  await extCtx.rebuild();
  await hookCtx.rebuild();
  await extCtx.dispose();
  await hookCtx.dispose();
}
