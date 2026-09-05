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

English onboarding identity (2026-09-05): the first-run persona screen and title-bar logo now identify OrbiAgents and describe its local orbital crew/command-center product instead of Munder Difflin. A focused test rejects Munder branding anywhere in the English onboarding object. Other locales and visible settings/update/Slack/realtime references are explicitly outside this slice and remain to migrate; internal protocol/storage compatibility identifiers remain unchanged.

English application chrome identity (2026-09-05): release notes, Settings identity and repository actions, update guidance, IDE/focus-mode titles, and realtime app descriptions now identify OrbiAgents. A focused source test protects these visible surfaces and repository links. Paid Pro/founders promotion, Slack-facing copy, and non-English locales remain separate migration slices; internal protocol and storage compatibility identifiers remain unchanged.

Neutral Settings identity (2026-09-05): the Settings hero now uses the compiled-in local operating description and no longer fetches remote promotional copy. Paid Pro, founders, sponsor, upgrade, and upstream Discord surfaces are removed while OrbiAgents release, repository, issue, and changelog actions remain. The compatibility hero IPC/parser remains imported but is no longer called by Settings; localization cleanup and Slack-facing copy remain separate slices.

Bundled locale identity (2026-09-05): English, Simplified Chinese, and Arabic onboarding, open-model guidance, update copy, and organization messaging now identify OrbiAgents. Chinese and Arabic onboarding descriptions express the same orbital-crew/local-command-center product as English. Translation keys used only by the retired Pro, founders, sponsor, and upstream Discord surfaces were removed from all three locales. A focused test rejects the upstream product name and those retired keys across every bundled locale; Slack-facing copy remains separate.

Slack identity (2026-09-05): the in-app Slack connection walkthrough now tells users to create and invite an OrbiAgents bot, and the bundled loopback reply helper documentation identifies the OrbiAgents main process. Existing `md-*` helper filenames, environment variables, headers, and authenticated loopback protocol remain unchanged for compatibility.

Runtime product identity (2026-09-06): Electron window titles, update repository/artifact URLs and install guidance, fallback release content, organization copy, provider command guidance, copyable hire prompts, agent runtime context, and local-model help destinations now identify OrbiAgents. Update checks target `SUDARSHANCHAUDHARI/OrbiAgents`; local-model help falls back to the OrbiAgents README until dedicated guides exist. Existing `munderdifflin://` links, `munder-difflin/hire@1`, `munder-*` integration namespaces, storage paths, and environment/header names remain unchanged compatibility contracts.

Isolated manual-review mode (2026-09-05): an explicit packaged-app command validates the executable, creates a fresh temporary review root, passes only an explicit environment allowlist, validates the same main/preload/renderer and data-path boundary as the auto-exit probe, suppresses updater activity, and then leaves the window open for human visual and interaction review. Ordinary package launch remains disabled. This enables acceptance testing without replacing the installed app or migrating its data; it does not itself establish visual parity or certify manually launched provider CLIs.

Interaction-readiness contract (2026-09-05): all 161 statically named preload request channels have main-process registrations. The packaged startup probe now requires an explicit preload-ready signal from the same web contents that finishes loading the renderer, proving the packaged bridge executed rather than inferring it from HTML load alone. Both TypeScript surfaces, packaging and controlled startup pass. This is structural interaction readiness, not click automation or proof that every handler's live provider/filesystem/network behavior succeeds; those and visual acceptance remain manual/live verification.

Controlled packaged startup (2026-09-05): the unsigned macOS arm64 package loaded its actual main, preload and renderer from ASAR using a fresh sentinel-marked temporary app-data root, recorded canonical userData/sessionData beneath that root, then exited automatically. An initial probe exposed upstream's unconditional release-page request; explicit verification mode now retains updater IPC but suppresses updater writes/network work, and the verifier requires no config, updater log or version stamp. Ordinary package launch remains default-deny. This establishes isolated fresh-config startup, not interactive features, provider/webhook behavior, visual acceptance, signing or release readiness.

Unsigned packaging (2026-09-05): temporary macOS arm64 app assembles successfully with a default-deny entry point. Fixed renderer file-loading URLs and staged the preload at upstream's expected filename. Prepacked ASAR avoids the dependency-collection heap failure. Archive checks verify the launch gate, app ID, bundles, notices, all 13 approved PNG hashes, and unpacked native modules/helper. Forty-one focused tests and provenance checks pass. The full prepared dependency tree and default Electron icon are still included. No app was launched, installed, signed or published; full startup isolation, ASAR runtime behavior, providers and visual acceptance remain pending. See `desktop-munder/tools/PACKAGING.md`.

Runtime compatibility probes (2026-09-05): Electron 41.10.3 / Node 24.18.0 / ABI 145 on macOS arm64 satisfies PostHog's engine range. SQLite 11.10.0 failed native compilation; isolated pin 13.0.3 passes in-memory CRUD, transaction and rollback checks after explicit rebuild. PTY echo passes after restoring its isolated helper's executable permission. The isolated install audit remains at zero known vulnerabilities. Shell Node 22.14.0 still warns; no global Node change was made. Full app startup, packaged assets, live providers/tunnels, real database migration and visual acceptance remain unverified; launch gate remains disabled. See `desktop-munder/tools/RUNTIME-SMOKE.md`.

Dependency remediation (2026-09-05): isolated compile dependency audit now reports zero known vulnerabilities after removing unreferenced localtunnel/typings, aligning Electron declarations to 41.10.3, and scoping Tunnelmole's TOML override to 4.2.0. Both typechecks and 37 migration tests pass. This does not clear the inert upstream lock/repository-wide alerts or verify live tunneling/native modules. The host Node/PostHog engine warning remains; runtime launch stays blocked. See `desktop-munder/tools/COMPILE-CHECKS.md` for compatibility limits.

Compilation slice: strict baseline-based web (173 root files) and node (86 root files) typechecks now pass against isolated pinned declarations. Main/preload source bundles emit with external packages and required CJS sidecars, without executing app code. This is not native-runtime or packaging verification. The wider compile environment reports six high-severity dependency findings and a PostHog Node engine mismatch; see `desktop-munder/tools/COMPILE-CHECKS.md`. These remain activation blockers. No forced upgrades or runtime launch occurred.

Isolated renderer-build slice resolves the missing dependency blocker using a separately pinned renderer-only manifest/lock with install scripts disabled. The actual renderer now builds through Vite, using all application modules rather than just the room preview. npm reports zero known vulnerabilities for the isolated 266-package audit; this does not clear repository-wide alerts. The ~6.4 MB minified main chunk remains a performance concern. Main/preload build, complete typechecking, packaging, runtime and visual acceptance remain unverified. Reproduction instructions: `desktop-munder/tools/RENDERER-BUILD.md`.

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
