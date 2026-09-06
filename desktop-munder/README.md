# OrbiAgents desktop

This is the default OrbiAgents desktop application. It uses the pinned Munder
application source recorded in `UPSTREAM.json`, with every intentional source
change recorded reversibly in `ADAPTATIONS.json`.

Paid upstream maps and tilesets are excluded. The office uses original OrbiAgents
room and robot artwork plus approved OGA-BY-3.0 LPC office props recorded in
`art/manifest.json`. The upstream MIT source license is retained in
`baseline/LICENSE`; font and artwork notices ship in the package.

## Commands

Run from the repository root:

```sh
pnpm desktop:test
pnpm desktop:typecheck
pnpm desktop:build
pnpm desktop:package:mac
pnpm desktop:dev
```

`desktop:package:mac` creates an unsigned local app at
`desktop-munder/release/mac-arm64/OrbiAgents.app`. `desktop:dev` performs the
same verified build and opens it. After a package exists, `pnpm --dir
desktop-munder start` opens it without rebuilding.

Dependencies are installed without lifecycle scripts into a fresh temporary
directory for each build. Native SQLite is rebuilt explicitly for Electron and
the PTY helper is checked before packaging. No package command signs, notarizes,
publishes, reads credentials, or modifies the legacy `desktop/` implementation.

Fresh settings keep automatic permissions, telemetry, and automatic updates
off. Application data is stored separately under `OrbiAgents-Migration`; no
legacy data is copied automatically. Provider CLIs can access their own normal
authentication only after the operator hires or starts an agent.

The legacy desktop remains available through `desktop:legacy:dev` and
`desktop:legacy:build`. Migration history and remaining external acceptance
boundaries are documented in `../docs/munder-direct-migration.md`.
