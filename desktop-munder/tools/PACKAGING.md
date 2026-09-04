# Unsigned migration packaging

This is a validation artifact, not an installable release or a usable app. Its
entry point prints a warning and quits. It does not load application main.
Do not replace the installed desktop app or remove the launch gate.

Prepare the isolated compile dependencies and native probes as documented in
`COMPILE-CHECKS.md` and `RUNTIME-SMOKE.md`, then run from the repo root:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false node desktop-munder/tools/package-macos.mjs "$orbi_deps_dir"
```

Only macOS arm64 is supported by this tool. It checks direct dependency pins,
runs the SQLite/PTy probe with the pinned local Electron, builds main/preload
and renderer, then writes a new temporary `orbi-package-*` directory. It does
not install dependencies, launch the app, sign, notarize, publish, or modify
the existing app and user data. Temporary outputs are retained for inspection.

Renderer URLs are relative for `loadFile`. Staging provides `preload/index.js`
at the path expected by upstream. The prepared dependency tree is archived
directly with native libraries and PTY helpers unpacked. Electron-builder's
prepacked-ASAR path avoids its dependency collection, which exhausted the
default Node heap in the initial attempt. No memory-limit increase is needed.
The archive currently includes the full prepared dependency tree; dependency
pruning, package size, and replacing the default Electron icon remain work.

The final archive verifier runs automatically, or can be repeated:

```sh
node desktop-munder/tools/verify-package.mjs '/absolute/path/OrbiAgents Migration.app'
```

It checks the exact disabled launcher, separate app ID, main/preload/sidecars,
relative renderer asset references, source/font/art notices, all 13 approved
PNG hashes, unpacked macOS arm64 native modules and executable PTY helper.

Verified 2026-09-05: unsigned package assembled with Electron 41.10.3 and
electron-builder 26.15.3; archive verification and 41 focused tests pass.
Native probes passed before packaging. The packaged app was not launched;
ASAR runtime loading, full startup isolation, live providers and visual quality
are not established by these checks. Signing/notarization/publication remain
outside this slice.
