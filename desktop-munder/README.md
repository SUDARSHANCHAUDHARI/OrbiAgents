# OrbiAgents direct-code migration — baseline only

This directory contains the actual Munder source at the revision in `UPSTREAM.json`, not a reimplementation. It is deliberately not in the root pnpm workspace yet. The existing `desktop/` app remains the default.

Run `node tools/verify-baseline.mjs` here to verify the imported file hashes and exclusions. `dev`, `build`, and `start` deliberately fail until replacement art and runtime boundaries are adapted. The upstream package manifest, lockfile, compiler/build configs and build helper are preserved under `baseline/` as reference data, not active configuration. No dependencies were installed and upstream tests have not been executed.

Source license: MIT, copyright Chaitanya Giri, retained in `baseline/LICENSE`. Bundled font notices and SIL OFL text remain beside the fonts. No paid tilesets, maps, upstream branding artwork, GitHub workflows or agent instruction files were imported. Source files still reference missing upstream art: the next slice must replace those references with an original OrbiAgents theme; do not fill them with paid assets.

Before activating runtime code, inspect and adapt at minimum:

- `src/main/config.ts`: auto mode and telemetry defaults.
- `src/main/hiddenClaude.ts`: helper permission bypass.
- `src/main/hive.ts`: provider hook trust and provider-profile handling.
- `baseline/electron.vite.config.ts`: environment-injected analytics key.
- `baseline/electron-builder.yml`: upstream app ID, update publisher, protocol and signing hook.

These are known review targets, not a completed security audit. No application was launched, no credentials were read, and no user agent configuration was changed by the import.

Implementation and visual acceptance plan: `../docs/munder-direct-migration.md`.
