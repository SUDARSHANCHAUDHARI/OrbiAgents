import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode", "fsevents"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("Watching...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
