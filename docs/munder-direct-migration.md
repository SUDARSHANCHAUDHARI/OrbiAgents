# Direct Munder migration

## Agreed goal

Adopt Munder's actual desktop implementation and visual experience, not another approximation. Preserve OrbiAgents history and local data. Keep changes to upstream behavior minimal and explicit.

## Source and preservation

- Upstream: https://github.com/chaitanyagiri/munder-difflin
- Selected revision: `4ff5a158c253eae3f917a136a80a586e1fc60c2f` (main observed 2026-09-04).
- Migration branch: `codex/munder-direct-base`.
- Existing office CSP fix preserved at `e9d26a1` on `codex/fix-office-csp`.
- Imported 346 pinned source, test, license and reference configuration files into `desktop-munder/`. Existing `desktop/`, root workspace commands and local runtime data were not modified.

## Plan

1. Inspect the selected upstream revision, including its source licenses, asset attribution, build scripts, telemetry, updates and network defaults before executing it.
2. Adopt its desktop source, tests and required build tooling as a coherent implementation. Retain MIT copyright and license notices. Do not import GitHub workflows or upstream agent instructions.
3. Retain the actual upstream office engine and interactions. Replace separately licensed maps/art with a coherent original theme using approved free assets; adapt procedural characters to original OrbiAgents identities.
4. Apply only necessary OrbiAgents identity, packaging and data-directory changes. Do not silently migrate existing agent state or replace operator permissions with broader defaults. Flag required behavior changes before implementing them.
5. Run upstream checks and package locally without publication. User-provided visual evidence must confirm the office framing, workers, animation and controls before claiming visual parity.

## Agreed artwork decision (2026-09-04)

Do not copy LimeZu artwork. Use free replacement artwork and original OrbiAgents details. Preferred office props: Eliza Wyatt's LPC Revised Office pack, whose downloaded Credits.txt identifies OGA-BY 3.0 and credits Eliza Wyatt and Lanea Zimmerman (Sharm). Room structure and worker appearances must be checked separately; the Office archive does not include a worker sprite sheet. Preserve per-file licensing rather than assuming every LPC asset uses the same terms.

## Implementation slices

Execution agreement: continue on `codex/munder-direct-base`, publish a draft PR while work is in progress, and keep it draft until build/runtime verification is complete. No automatic merge, public release, GitHub workflow changes, existing app-data migration or replacement of the default desktop app is included. Work areas are `desktop-munder/` and this plan; preserve unrelated local files. Visual acceptance remains a separate user check, not a claim inferred from tests.

1. **Pinned source baseline:** inspect upstream, preserve provenance and import its actual application into a separate `desktop-munder/` migration package. Do not replace the existing `desktop/` app, runtime data or root commands during this first slice. Exclude paid assets, workflows, upstream agent instructions, marketing sites and release binaries.
2. **Replacement office theme:** create a new map/atlas from permitted LPC props and original structural art. Configure desks, collisions, interactions and worker frames through the upstream theme contract. No paid asset imports may remain reachable from the migration build.
3. **OrbiAgents runtime boundary:** separate app ID/data directory, retain required notices, disable upstream telemetry/publication/automatic update destinations, and inspect launch permissions before executing the app. Do not silently weaken existing operator protections.
4. **Verification and packaging:** run the imported application's focused tests and typechecks, build/package without publication, and verify original OrbiAgents files/data remain unchanged. Source and build success do not establish visual acceptance.
5. **User visual acceptance:** office fills its allotted view, workers and furniture share a coherent scale/palette, movement and seated work are visible, task/terminal controls behave correctly. Only after acceptance consider switching the default desktop entry point.

## Artwork licensing background

Upstream `LICENSE` covers source code under MIT. `LICENSE-ASSETS`, `src/renderer/src/assets/ATTRIBUTION.md`, and `tilesets/LIMEZUASSETS-LICENSE.txt` separately identify LimeZu Modern Interiors Complete Version artwork. The attribution says upstream purchased its license; that does not establish this user's entitlement.

The creator's page permits project use and requires credit, but prohibits distributing the assets themselves. The user chose replacement artwork; do not copy those tilesets into the migration package or purchase anything.

Sources:
- https://github.com/chaitanyagiri/munder-difflin/blob/4ff5a158c253eae3f917a136a80a586e1fc60c2f/LICENSE
- https://github.com/chaitanyagiri/munder-difflin/blob/4ff5a158c253eae3f917a136a80a586e1fc60c2f/LICENSE-ASSETS
- https://limezu.itch.io/moderninteriors

## Completion boundary

Build-readiness slice replaces the two unresolved `@brand/logo.png` imports with a self-contained original SVG and updates the startup title/favicon type. A renderer Vite build attempted with existing local tooling fails resolving `i18next` from `src/renderer/src/i18n/index.ts`; this is a verified dependency blocker, not a successful full build. No dependency install or upstream lifecycle scripts were run. Review and isolate the migration dependency set before retrying; the inert baseline lock and runtime launch gate remain unchanged.

Roster identity slice replaces the card portrait recipes with crops of the original robot scene artwork, shares accent/key mapping with the scene, and gives the 15 compatible stored character keys Orbi display names. The theme picker is now a read-only single-theme summary with no agent termination, archive or configuration-write controls. Bundled portrait/roster tests and server-rendered panel checks cover this boundary; full application typecheck/build and visual acceptance remain outstanding. Other branding and build blockers still require review.

Theme integration slice connects the actual registry and OfficeFloor texture-loading path to the original 48×32 room, approved LPC sheets at 16px world scale and original robot scene frames. Legacy theme IDs fall back to this room; no paid map imports remain in the registry. Scene resources are released on failure, cancellation and teardown. Monitor overlays and optional idle errands are intentionally absent because replacement art/anchors are not implemented. Card portraits, theme-picker wording, remaining branding, full application build and live/visual acceptance remain outstanding. Registry/loader bundle tests are not a full Electron application test.

Caller-input slice rejects noncanonical executable names, caller shell scripts and nonempty environment overrides before shared-spawn setup. Its 26 migration tests pass, including rejected overrides and validation ordering. This does not validate PATH-resolved binaries, inherited environment, application-generated environment or all launch paths. The full runtime remains disabled; no live-provider or visual acceptance is claimed.

Caller-consent slice adds a conservative argument allowlist before shared-spawn installation/workspace setup when autoMode is false. It rejects unknown switches, permission bypass, config overrides and extra-directory flags while allowing recognized model/resume and restricted Claude/Codex permission options. Generated Codex extra-directory grants are removed. Twenty-three migration tests pass. Explicit operator autoMode=true still permits caller flags; environment, provider config, executable identity and generated arguments remain outside this gate. This is not a complete sandbox or activation approval.

Provider hook-trust slice removes the unconditional Codex hook-trust bypass and reports unverified hook telemetry through the existing degraded spawn result. Twenty migration tests pass, including actual-source AST checks and reversible provenance validation. No Codex process was launched and no trust store was changed. Caller-supplied permission flags, writable-directory grants and other provider configuration paths remain review targets; this is not full launch-policy enforcement.

Data-isolation slice: a first-import bootstrap sets the migration app name to OrbiAgents Migration, userData to `<appData>/OrbiAgents-Migration`, and sessionData to its `chromium-session` child before other main-process imports. Tests use temporary directories and reject symlink aliases, relative/root bases and initialization after ready. Nineteen migration tests pass; real Electron startup and bundled import ordering have not been exercised. This does not isolate provider home directories, selected workspaces, harnessHome or all temporary files; those remain review targets. No actual user app data was read or migrated.

First runtime-safety slice: fresh defaults for autoMode, autoUpdate and telemetryEnabled are false; hiddenClaude no longer forces bypassPermissions. Two upstream files have explicit reversible adaptations, verified against their original hashes. Sixteen migration tests pass, including AST checks of actual defaults/arguments. Existing persisted settings are not overridden. Hook trust, app-data isolation, network/update paths and live-provider acceptance remain pending; normal launch stays disabled.

Original-worker slice adds three original robot designs with 27 directional/walking frame buffers, driven by imported Character/CharacterSprite/pathfinding code in the isolated preview. Demo-only status is explicit; play/pause and initially paused reduced-motion behavior are included. Fourteen migration tests and the production preview build pass. Route/cleanup tests execute actual upstream classes; browser visual quality and live-agent integration remain unverified and incomplete.

Isolated preview slice: `preview/` mounts the imported tile renderer/camera and loads actual local PNGs, with viewport fitting, loading/error status and cleanup. `node desktop-munder/tools/preview.mjs build` succeeds and verifies all 14 credited asset files in its temporary output. `serve` serves built output only on loopback without opening a browser. Normal migration launch stays blocked. Browser rendering and bitmap-decoding paths have not been exercised; visual acceptance, workers and runtime adaptation remain pending.

Renderer-binding slice: `theme/roomRenderer.mjs` connects composed room data and prepared LPC textures to the imported TiledMapRenderer, validates all sheets before mutation, and owns scene cleanup. Twelve migration tests pass. The integration test compiles the actual pinned renderer and uses real Pixi objects with dimension-matched texture sources; it does not decode PNGs, perform GPU rendering or establish visual quality. Browser/Electron mounting, original workers and runtime migration remain pending.

Room-structure slice adds original procedural RGBA surfaces and composes floor, wall, table and counter tiles with LPC desks. Ten migration tests pass, including complete floor coverage, valid tile IDs, visible collision footprints and open doorways. No image files or upstream artwork were modified. This map data has not yet been wired into the application or visually reviewed; theme registration, remaining props, original workers and runtime migration remain incomplete.

Furniture composition slice: `theme/furniture.mjs` assigns approved LPC tiles to 15 desks and the coffee machine in the original layout. Desk footprints now match the three-by-two source-cell crop. Eight migration tests cover tile references, blocked footprints, seat clearance, reachability and texture dimensions. Floors, walls, other furniture, original workers and renderer registration are still pending; this is not a complete scene or runnable app.

PR #90 merged the disabled foundation, not a replacement app. Existing desktop verification before that merge: 222 tests, typechecks, build and security-boundary check passed. Texture-scale follow-up adds tested Pixi resolution adaptation and disjoint GIDs for all 13 approved LPC sheets; image bytes remain unchanged. This does not yet supply a complete map/atlas scene.

Geometry slice: `desktop-munder/theme/layout.mjs` defines an original 48×32-tile collision/spawn layout with 15 desks, meeting seats, four café seats and coffee-counter positions. Tests flood-fill from the entrance and verify all destinations are reachable without the renderer's forced-seat overrides. This is geometry only, not a renderable theme: visual layers, atlas assignment and registry integration remain pending.

Replacement-art progress: 13 unmodified LPC office prop images plus original `Credits.txt` are imported under `desktop-munder/art/lpc-office/`. Source URL, license URL, archive/file hashes and image dimensions are recorded. Integrity tests reject modified source, modified approved art and unapproved images. These assets are not yet mapped or connected to the renderer; structure tiles, original worker identities and scene integration remain outstanding.

The pinned source import is complete and its integrity checker passes. Launch/build commands deliberately fail pending adaptation; no upstream dependency installation, application tests or launch has occurred. Replacement theme, runtime adaptation, build verification, live provider acceptance and visual acceptance remain incomplete. Source import is not visual parity.
