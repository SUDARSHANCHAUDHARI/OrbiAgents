# OrbiAgents direct-code migration — baseline only

This directory contains the actual Munder source at the revision in `UPSTREAM.json`, not a reimplementation. It is deliberately not in the root pnpm workspace yet. The existing `desktop/` app remains the default.

Run `node tools/verify-baseline.mjs` here to verify imported provenance and exclusions. `ADAPTATIONS.json` records exact intentional source edits; the checker reverses those edits in memory and verifies the original upstream hashes. Unrecorded changes fail. `dev`, `build`, and `start` deliberately fail until replacement art and runtime boundaries are adapted. The upstream package manifest, lockfile, compiler/build configs and build helper are preserved under `baseline/` as reference data, not active configuration. No upstream dependencies were installed and the upstream application test suite has not been executed.

Fresh configuration now defaults automatic permissions, telemetry and automatic updates to false. The hidden Claude helper no longer adds a permission-bypass argument; its existing tool restrictions remain. These changes do not override previously persisted true settings or guarantee that every network/provider path is disabled. Hidden calls may now wait for approval or time out. App identity/data isolation, hook trust, update destinations and live-provider acceptance remain unresolved. Do not activate the runtime yet.

Source license: MIT, copyright Chaitanya Giri, retained in `baseline/LICENSE`. Bundled font notices and SIL OFL text remain beside the fonts. No paid tilesets, maps, upstream branding artwork, GitHub workflows or agent instruction files were imported. Source files still reference missing upstream art: the next slice must replace those references with an original OrbiAgents theme; do not fill them with paid assets.

The shared spawn entry now rejects caller shell scripts, noncanonical executable names and nonempty caller environment overrides. This is an input boundary only: PATH resolution, inherited/application-generated environment and other launch paths still require review. Custom command paths are intentionally unavailable in this migration until reviewed.

Before activating runtime code, inspect and adapt at minimum:

- `src/main/config.ts`: auto mode and telemetry defaults.
- `src/main/hiddenClaude.ts`: helper permission bypass.
- `src/main/hive.ts`: provider hook trust and provider-profile handling.
- `baseline/electron.vite.config.ts`: environment-injected analytics key.
- `baseline/electron-builder.yml`: upstream app ID, update publisher, protocol and signing hook.

These are known review targets, not a completed security audit. No application was launched, no credentials were read, and no user agent configuration was changed by the import.

Implementation and visual acceptance plan: `../docs/munder-direct-migration.md`.
