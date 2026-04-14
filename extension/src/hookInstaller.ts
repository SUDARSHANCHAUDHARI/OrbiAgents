import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const HOOK_SCRIPTS_DIR = path.join(os.homedir(), ".orbiagents", "hooks");
const HOOK_SCRIPT_NAME = "claude-hook.js";
// String present in every hook command we install — used to identify our entries
const HOOK_SCRIPT_MARKER = "claude-hook.js";

const CLAUDE_HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "Stop",
  "PermissionRequest",
  "Notification",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "SubagentStop",
] as const;

interface ClaudeHookEntry {
  matcher: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

interface ClaudeSettings {
  hooks?: Record<string, ClaudeHookEntry[]>;
  [key: string]: unknown;
}

function readSettings(): ClaudeSettings {
  try {
    if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf-8")) as ClaudeSettings;
    }
  } catch (e) {
    console.error(`[OrbiAgents] Failed to read Claude settings: ${e}`);
  }
  return {};
}

function writeSettings(settings: ClaudeSettings): void {
  const dir = path.dirname(CLAUDE_SETTINGS_PATH);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = CLAUDE_SETTINGS_PATH + ".orbiagents-tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
    fs.renameSync(tmpPath, CLAUDE_SETTINGS_PATH);
  } catch (e) {
    console.error(`[OrbiAgents] Failed to write Claude settings: ${e}`);
  }
}

function isOurEntry(entry: ClaudeHookEntry): boolean {
  return entry.hooks.some((h) => h.command.includes(HOOK_SCRIPT_MARKER));
}

function makeHookEntry(): ClaudeHookEntry {
  return {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: `node "${path.join(HOOK_SCRIPTS_DIR, HOOK_SCRIPT_NAME)}"`,
        timeout: 5,
      },
    ],
  };
}

/** Returns true if all 11 hook events have an OrbiAgents entry in Claude settings. */
export function areHooksInstalled(): boolean {
  const settings = readSettings();
  if (!settings.hooks) return false;
  return CLAUDE_HOOK_EVENTS.every((event) => {
    const entries = settings.hooks?.[event];
    return Array.isArray(entries) && entries.some(isOurEntry);
  });
}

/**
 * Install OrbiAgents hook entries in ~/.claude/settings.json.
 * Idempotent: removes any existing OrbiAgents entries before inserting fresh ones
 * (handles the case where the script path changed between extension versions).
 */
export function installHooks(): void {
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};

  let changed = false;
  for (const event of CLAUDE_HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
    const entries = settings.hooks[event];
    const filtered = entries.filter((e) => !isOurEntry(e));
    filtered.push(makeHookEntry());
    if (JSON.stringify(filtered) !== JSON.stringify(entries)) {
      settings.hooks[event] = filtered;
      changed = true;
    }
  }

  if (changed) {
    writeSettings(settings);
    console.log("[OrbiAgents] Hooks installed in ~/.claude/settings.json");
  }
}

/** Remove all OrbiAgents hook entries from ~/.claude/settings.json. Cleans up empty arrays. */
export function uninstallHooks(): void {
  const settings = readSettings();
  if (!settings.hooks) return;

  let changed = false;
  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;
    const filtered = entries.filter((e) => !isOurEntry(e));
    if (filtered.length !== entries.length) {
      settings.hooks[event] = filtered;
      changed = true;
    }
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  if (changed) {
    writeSettings(settings);
    console.log("[OrbiAgents] Hooks removed from ~/.claude/settings.json");
  }
}

/**
 * Copy the compiled hook script from the extension's out/hooks/ to ~/.orbiagents/hooks/.
 * Called after hookServer.start() so the script is in place before any Claude session fires.
 */
export function copyHookScript(extensionPath: string): void {
  const src = path.join(extensionPath, "out", "hooks", HOOK_SCRIPT_NAME);
  const dst = path.join(HOOK_SCRIPTS_DIR, HOOK_SCRIPT_NAME);

  try {
    if (!fs.existsSync(HOOK_SCRIPTS_DIR)) {
      fs.mkdirSync(HOOK_SCRIPTS_DIR, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(src)) {
      console.warn(`[OrbiAgents] Hook script not found at ${src} — run pnpm build first`);
      return;
    }
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, 0o700);
    console.log(`[OrbiAgents] Hook script copied to ${dst}`);
  } catch (e) {
    console.error(`[OrbiAgents] Failed to copy hook script: ${e}`);
  }
}
