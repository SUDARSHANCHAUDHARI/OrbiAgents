import path from "path";
import { defineConfig } from "@playwright/test";

const artifactsDir = path.join(__dirname, "../test-results/e2e");

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  timeout: 120_000,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.join(__dirname, "../playwright-report/e2e"),
        open: "never",
      },
    ],
  ],
  outputDir: artifactsDir,
  use: {},
  // VS Code extension tests don't parallelize well on a single display
  workers: 1,
});
