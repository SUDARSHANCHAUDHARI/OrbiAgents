import { readFile } from "node:fs/promises";
import path from "node:path";

const renderer = path.resolve("src", "renderer", "src");
const read = (file) => readFile(path.join(renderer, file), "utf8");
const [tokens, css, main, app, roster, activity, onboarding, recovery, costs, panel, button, badge] = await Promise.all([
  read("styles/tokens.css"), read("styles/global.css"), read("main.tsx"), read("App.tsx"),
  read("components/AgentRoster.tsx"), read("components/ActivityPanel.tsx"), read("components/OnboardingPanel.tsx"),
  read("components/RecoveryPanel.tsx"), read("components/CostPanel.tsx"), read("components/ui/PixelPanel.tsx"),
  read("components/ui/PixelButton.tsx"), read("components/ui/StatusBadge.tsx"),
]);

const requiredTokens = ["--orbi-void", "--orbi-space", "--orbi-deck", "--orbi-panel", "--orbi-edge", "--orbi-ink", "--orbi-muted", "--orbi-signal", "--orbi-energy", "--orbi-alert", "--orbi-shadow", "--orbi-unit"];
for (const token of requiredTokens) requireText(tokens, token, `token ${token}`);
requireText(main, 'import "./styles/tokens.css"', "token stylesheet import");
if (main.indexOf("tokens.css") > main.indexOf("global.css")) throw new Error("Token stylesheet must load before global styles");
for (const [source, value, label] of [
  [app, "<PixelButton", "shell PixelButton"], [roster, "<PixelPanel", "roster PixelPanel"], [roster, "<StatusBadge", "roster StatusBadge"],
  [activity, "<PixelPanel", "activity PixelPanel"], [onboarding, "<PixelPanel", "onboarding PixelPanel"], [recovery, "<PixelPanel", "recovery PixelPanel"], [costs, "<PixelPanel", "cost PixelPanel"],
  [panel, "pixel-panel", "panel primitive"], [button, "pixel-button", "button primitive"], [badge, "status-badge", "status primitive"],
  [css, "box-shadow: inset", "layered panel edge"], [css, "translateY(2px)", "pressed button state"], [css, "@media (prefers-reduced-motion: reduce)", "reduced motion"],
  [css, ".command-tab-group", "grouped command navigation"], [css, ".command-context", "command context header"], [app, "COMMAND_GROUPS", "command information architecture"],
]) requireText(source, value, label);

for (const [file, source] of [["PixelPanel.tsx", panel], ["PixelButton.tsx", button], ["StatusBadge.tsx", badge]]) {
  if (/#[0-9a-f]{3,8}\b/i.test(source)) throw new Error(`${file} contains an ad-hoc color instead of a tokenized class`);
}

for (const [foreground, background, label] of [["#f4eedf", "#070b14", "primary ink"], ["#aab6c8", "#0d1424", "muted ink"], ["#5eead4", "#0d1424", "signal"], ["#ffd166", "#070b14", "energy"]]) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) throw new Error(`${label} contrast ${ratio.toFixed(2)} is below 4.5:1`);
}

console.log(`Design-system source checks passed: ${requiredTokens.length} core tokens, 3 primitives, 5 migrated shell surfaces`);

function requireText(source, value, label) { if (!source.includes(value)) throw new Error(`Missing ${label}`); }
function contrast(foreground, background) { const a = luminance(foreground); const b = luminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }
function luminance(hex) { const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4); return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]; }
