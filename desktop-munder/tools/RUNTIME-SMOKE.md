# Isolated macOS arm64 runtime probes

Prepare the dependency directory using `COMPILE-CHECKS.md` with scripts disabled.
Then, from the repository root:

```sh
node desktop-munder/tools/prepare-native.mjs "$orbi_compile_dir"
ELECTRON_RUN_AS_NODE=1 desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron desktop-munder/tools/runtime-smoke.cjs "$orbi_compile_dir"
```

Preparation explicitly rebuilds only better-sqlite3 for the pinned Electron ABI
using the existing desktop's electron-rebuild tooling. It may download Electron
headers/prebuilt bindings and requires command-line build tools. It restores the
executable bit on the isolated macOS arm64 PTY helper. It does not run the upstream
postinstall or modify existing desktop dependencies. Other OS/architectures are
not supported by this preparation command yet.

Verified 2026-09-05 on macOS arm64:

- Electron 41.10.3 bundles Node 24.18.0, native-module ABI 145.
- Node 24.18.0 satisfies posthog-node 5.48.2's engine range. No PostHog client is
  instantiated and no telemetry is sent. The shell's Node 22.14.0 still produces
  an npm engine warning; that is distinct from the verified Electron runtime.
- better-sqlite3 11.10.0 failed to compile against the newer V8 API. The isolated
  pin is now 13.0.3; in-memory queries, inserts, updates, deletes, transactions and
  rollback pass under Electron. Existing user databases are never opened.
- node-pty 1.1.0 successfully runs `/bin/echo` with a minimal environment and a
  temporary working directory after its helper permission is corrected.
- The updated isolated install reports zero known vulnerabilities.

These probes do not launch the application, use user credentials, verify live
providers/tunnels, test a packaged app or establish visual quality. The normal
migration launch gate remains unchanged. Upgrading SQLite across major versions
still requires real persistence/migration acceptance before user data is used.
