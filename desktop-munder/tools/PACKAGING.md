# Unsigned local packaging

This creates a usable local QA build. It remains unsigned, unnotarized, and is
not suitable for public distribution. Ordinary launch loads the application;
the verification arguments retain isolated startup and review modes.

Run from the repository root:

```sh
pnpm desktop:package:mac
```

Only macOS arm64 is supported. The command prepares an isolated dependency
tree, checks direct dependency pins, runs SQLite and PTY probes with the pinned
Electron, builds main/preload and renderer, then promotes the verified app to
`desktop-munder/release/mac-arm64/OrbiAgents.app`. It does not launch, sign,
notarize, publish, or modify legacy application data.

Renderer URLs are relative for `loadFile`. Staging provides `preload/index.js`
at the path expected by upstream. The prepared dependency tree is archived
directly with native libraries and PTY helpers unpacked. Electron-builder's
prepacked-ASAR path avoids its dependency collection, which exhausted the
default Node heap in the initial attempt. No memory-limit increase is needed.
The main/preload build records its actual external package imports. Packaging
uses that generated manifest to prune compile-only and already-bundled renderer
libraries before archiving. The OrbiAgents icon is derived from the original
repository SVG.

The final archive verifier runs automatically, or can be repeated:

```sh
node desktop-munder/tools/verify-package.mjs desktop-munder/release/mac-arm64/OrbiAgents.app
```

It checks the enabled launcher, exact runtime dependency set, absence of large
duplicated renderer libraries, separate app ID, main/preload/sidecars, relative
renderer asset references, source/font/art notices, all 13 approved PNG hashes,
unpacked macOS arm64 native modules and executable PTY helper.

Verified 2026-09-07: unsigned package assembled with Electron 41.10.3 and
electron-builder 26.15.3; archive verification and isolated packaged startup
pass. Native probes pass before packaging. Runtime dependency pruning reduced
the app from 710 MB to 386 MB and `app.asar` from 428 MB to 104 MB. Live
providers and subjective visual quality are not established by these checks.
Signing, notarization and publication remain outside this slice.

## Controlled startup probe

Ordinary launch is enabled. To verify a packaged renderer load without touching
normal application data, run `verify-startup.mjs` with the durable app path. The tool creates a fresh,
sentinel-marked temporary directory. Only the explicit verification argument
allows the gate to load main; the gate redirects Electron app data there before
main imports, suppresses updater writes/network requests, waits for the first
renderer load, records the canonical data paths, and exits automatically.

```sh
node desktop-munder/tools/verify-startup.mjs '/absolute/path/OrbiAgents.app'
```

The verifier rejects escaped data paths, non-file renderer URLs, config writes,
updater logs and updater version stamps. This proves packaged main/preload/
renderer loading with an isolated fresh config. It does not verify user-driven
features, provider launches, webhook/tunnel behavior, artwork appearance or
long-running lifecycle behavior.

`verify-ipc-contract.mjs` separately checks every statically named preload
request against all main-process IPC registrations. The controlled startup also
requires a preload-ready signal from the same web contents that completes the
renderer load. Together these catch missing packaged preload execution and
renamed or omitted request handlers; they do not simulate clicks or prove the
behavior behind each handler.

## Isolated manual review

After package verification, open the real app with an isolated data root for
manual visual and interaction review:

```sh
node desktop-munder/tools/open-review-app.mjs '/absolute/path/OrbiAgents.app'
```

The command validates the packaged executable, creates a fresh temporary review
root, passes only a small environment allowlist, supplies the review-only gate argument and leaves the
window open. The gate verifies main/preload/renderer readiness, writes
`review-ready.json`, and keeps all Electron application state beneath that root.
Updater activity stays suppressed. Closing the app leaves the temporary review
directory available for inspection. Provider CLIs may still use their normal
home-directory authentication/configuration if manually launched; the allowlist
does not pass API keys or tokens from the parent environment. The tool does
not automate, sandbox, or certify them.
