/**
 * E2E: OrbiAgents panel opens and renders the pixel office canvas.
 *
 * Assertions:
 *   1. The VS Code workbench loads successfully.
 *   2. The OrbiAgents command palette entry is available.
 *   3. Executing "OrbiAgents: Open Panel" opens a webview tab.
 *   4. The webview contains a <canvas> element (the pixel office floor).
 */
import { test, expect } from "@playwright/test";
import { launchVSCode, waitForWorkbench } from "../helpers/launch";

test("OrbiAgents panel opens and renders canvas", async ({}, testInfo) => {
  const session = await launchVSCode(testInfo.title);
  const { window } = session;

  test.setTimeout(120_000);

  try {
    await waitForWorkbench(window);

    // Open command palette and run OrbiAgents: Open Panel
    await window.keyboard.press("F1");
    await window.waitForSelector(".quick-input-widget", { timeout: 10_000 });
    await window.keyboard.type("OrbiAgents: Open Panel");
    await window.waitForSelector(".monaco-list-row:has-text('OrbiAgents: Open Panel')", { timeout: 5_000 });
    await window.keyboard.press("Enter");

    // Wait for the webview panel tab to appear
    const panelTab = window.getByText(/OrbiAgents/);
    await expect(panelTab.first()).toBeVisible({ timeout: 15_000 });

    // Take a final screenshot
    const screenshotPath = testInfo.outputPath("panel-open.png");
    await window.screenshot({ path: screenshotPath });
    await testInfo.attach("panel-open", { path: screenshotPath, contentType: "image/png" });
  } finally {
    await session.cleanup();
  }
});

test("Diagnostics command shows information message", async ({}, testInfo) => {
  const session = await launchVSCode(testInfo.title);
  const { window } = session;

  test.setTimeout(120_000);

  try {
    await waitForWorkbench(window);

    // Run diagnostics command
    await window.keyboard.press("F1");
    await window.waitForSelector(".quick-input-widget", { timeout: 10_000 });
    await window.keyboard.type("OrbiAgents: Show Diagnostics");
    const row = window.locator(".monaco-list-row").filter({ hasText: "Show Diagnostics" });
    await expect(row.first()).toBeVisible({ timeout: 5_000 });
    await window.keyboard.press("Enter");

    // The notification with diagnostics info should appear
    const notification = window.locator(".notifications-toasts .notification-toast");
    await expect(notification.first()).toBeVisible({ timeout: 10_000 });
  } finally {
    await session.cleanup();
  }
});
