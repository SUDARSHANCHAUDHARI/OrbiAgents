# Direct Munder migration

## Current status (2026-09-06)

The migrated application is now the repository's default desktop target. Root
`desktop:dev`, `desktop:build`, `desktop:test`, `desktop:typecheck`, and macOS
packaging commands route to `desktop-munder`; the previous implementation is
retained behind `desktop:legacy:*` commands.

Ordinary packaged launch is enabled. Dependencies remain isolated and pinned,
native SQLite and PTY probes run before packaging, and the durable unsigned app
is written to `desktop-munder/release/mac-arm64/OrbiAgents.app`. A controlled
fresh-data startup has verified main, preload, renderer, file assets, storage
isolation, and updater suppression. The historical entries below describe the
incremental migration and may mention blockers that were subsequently closed.

Still external: subjective visual acceptance, real provider credentials and
services, Apple Developer ID signing/notarization, and public publication. None
of those can be certified by source or local automated checks.

Imported-suite harness (2026-09-06): all 96 upstream test files now run through
the pinned temporary dependency environment. Orbi-owned hero, release-notes,
builder, and telemetry fixtures replace excluded upstream product files. The
upstream PR-evidence policy is created only inside a disposable suite copy; no
GitHub Actions workflow is added to this repository. The complete imported
suite passes without skipped or weakened assertions.

Packaging audit (2026-09-07): the main/preload build now records the external
packages it actually imports, and packaging prunes the isolated compile tree to
that exact pinned runtime set. Already-bundled Monaco, React Icons, Pixi, React,
and other renderer libraries are no longer duplicated in `app.asar`. The local
unsigned app decreased from 710 MB to 386 MB; archive verification, native
SQLite/PTY probes, and isolated renderer startup pass after pruning.

Dependency-alert hygiene (2026-09-07): the byte-identical upstream lockfile is
retained for provenance as `baseline/package-lock.snapshot.json`, not as an
installable manifest. Import and integrity tools preserve and verify that name.
The active pnpm workspace audit reports zero known vulnerabilities; historical
upstream dependency metadata is never installed by OrbiAgents tooling.

Upstream security update (2026-09-07): imported Munder commit
`70cf9ab507706d0ec176d3262a015c821f511a99` protects every workspace file and
git-content operation against symlink escapes, dangling-link writes, FIFO hangs,
and final-component replacement races. Per-file provenance records the newer
upstream commit while retaining the original migration baseline revision.

Hook framing hardening (2026-09-07): imported the final reviewed state from
Munder commits `72c1d5fe0a95d9eec4e1938f9434da1d470d13f3` and
`718668312266f58a1d7416893d4732134fc71d98`. Hook requests now preserve split
UTF-8 characters, enforce bounded newline-delimited byte frames, and log
oversized-frame rejection before closing the one-request connection.

Process identity guard (2026-09-07): imported Munder commit
`7e1ce3c2d75519ef98beb011e98f9769183fe2df`. A delayed POSIX process-group
cleanup now snapshots member start times and rechecks identity before SIGKILL,
preventing a recycled PGID from terminating unrelated processes while retaining
the orphan cleanup fallback when process inspection itself fails.

Abnormal-exit diagnostics (2026-09-08): imported Munder commit
`de85b5528af8d0863ceb24e586ae6a0669ff5c11`. Signal deaths and non-zero exits
now create a durable structured lifecycle event. A bounded raw PTY tail is saved
locally under the hive's gitignored `crashes/` directory, keeping possible tokens,
paths, and prompt fragments out of committed history while preserving crash clues.

Malformed-outbox recovery (2026-09-08): imported Munder commit
`ce684c58d3e2c01f24e80d158ba093cc89940015`. The router narrowly repairs literal
CR/LF bytes inside JSON strings, logs successful repairs, and quarantines other
malformed files with a structured drop event that excludes raw payload details.

Claude-config preservation (2026-09-08): imported Munder commit
`1ea876c1cba7bb308f0c9bfae7cdff3b02e39764`. Existing malformed, unreadable, or
non-object Claude configuration is no longer replaced by generated permission
state; the global and project files are handled as independent safe-write boundaries.

Hive Git-lock recovery (2026-09-08): imported Munder commit
`8cb110fe28f9ca5efa777b11522da847769fd6bf`. Hive commits now clear stale
`HEAD.lock` as well as `index.lock`, retain the existing age threshold, and warn
when retry exhaustion or another Git failure prevents durable history.

Provider-hook path quoting (2026-09-08): imported the merged Munder state at
`c212970e0b06e326467f336bdafbd170a138e616`, incorporating commits `008a83d6`
and `21d40011`. On POSIX, Codex, Gemini, and Antigravity hook commands now retain
quoted launcher and shim paths when the selected hive directory contains spaces;
Windows retains its existing command shape.

Edge-triggered worker wake (2026-09-08): imported Munder commit
`8c73ccacf4ac62d3709f539e8c766aafbf68fe4a`. The main process now supplies
undrained message IDs instead of only a count, so an idle worker is nudged for
new mail without re-announcing the same backlog every cooldown. Draining the
inbox or tearing down the worker resets the bounded announcement state.

Slack stop persistence (2026-09-08): imported Munder commit
`087e32d90f441988ace8a41b524de6521a803d4f`. A user-initiated Stop now persists
`slackEnabled: false` before server teardown and immediately updates the Settings
toggle, while quit, reset, and hive-home lifecycle teardown leave the preference
unchanged.

Workers-only onboarding engines (2026-09-08): imported Munder commit
`fd1120eba241935084637d58dc943d84c3c497e2`. Kimi and Copilot now remain visible
as disabled, explained worker-only rows during orchestrator setup instead of
appearing unsupported; inbox-capable engines remain the only selectable choices.

Task-ID visibility (2026-09-09): imported Munder commit
`6c759a240f0ed115daf3205e78dde7dd61295362`. Kanban cards and task details now
show the complete task identifier used in messages and dispatches, without
requiring the operator to open each card to identify it.

Busy-terminal hold status (2026-09-09): imported Munder commit
`2ef48bba1da43acecc339a7d898054cf0aee7a47`. Queued-message status now reports
terminal drafts, command pickers, and exited terminals even while an agent is
busy, instead of hiding the actionable blocker behind a generic queued label.

Repository-root skill resolution (2026-09-09): imported Munder commit
`586bf7021a02ec32a2d3736f3d41b3be451aae49`. GitHub repository-root catalog
entries now resolve the directory containing `SKILL.md` before applying download
limits, preventing small nested skills from being rejected as oversized repos.

Remote model catalog (2026-09-09): adapted Munder PR #440 merge
`4a0baaa3fefdea398ce3b2676f2b0ee784cd9bac` to an Orbi-owned endpoint. Model
pickers use validated six-hour cached data with bundled and stale-cache fallbacks,
and Settings provides an accessible manual refresh with honest offline status.

Synchronous Hive Git maintenance (2026-09-09): imported Munder PR #406 merge
`216094195973ce69c071c7f4cfaf0ee4918a8cf2`. Hive Git commands disable detached
automatic garbage collection so commit completion is a true quiescent boundary
for immediate reads and teardown.

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

Original wall depth (2026-09-11): the procedural room atlas now gives the outer horizontal perimeter, side perimeter, east-wing divider, and doorway jambs distinct original pixel treatments. Existing floor and live-monitor GIDs, collision cells, and both east-wing passages remain unchanged. Structural tests protect opacity, wall roles, and open doorway centers; visual acceptance remains a human review step.

Original desk accessories (2026-09-11): every workstation now has a deterministic laptop, rotary phone, or coffee-cup overlay drawn from the approved LPC sheets. Accessories occupy the desk column beside the existing four-tile live monitor, so animated screens, collision geometry, and worker paths remain unchanged. Structural tests protect valid tile ownership, all three accessory families, monitor coverage, and required-asset failures; visual acceptance remains a human review step.

Original room wall landmarks (2026-09-11): an operations display and team mailbox bank now use approved LPC crops on the already-blocked top perimeter. They add recognizable destinations to the boardroom/workspace boundary without consuming walkable floor area or changing navigation. Furniture tests protect their exact coverage and required-asset behavior.

Approved room furniture density (2026-09-11): the boardroom table, café table, and kitchen sink now use grid-aligned crops from the already-approved LPC office sheets instead of generic procedural obstacle blocks. Every crop remains inside its existing collision footprint, so navigation and worker behavior are unchanged. Furniture tests protect exact tile coverage, required assets, and all prior reachable spawn points.

Original room floor hierarchy (2026-09-11): the procedural OrbiAgents atlas now distinguishes workspace aisles, boardroom, café, entrance runner, and east-wing thresholds with eight original pixel-floor treatments. Stable monitor GIDs and collision geometry remain unchanged. Structural tests protect tile validity, full opacity, zone identity, and both doorway connections; visual acceptance remains a human review step.

Pi custom-model propagation (2026-09-11): each isolated Pi worker directory now receives the operator's `~/.pi/agent/models.json` and `models-store.json` when those files exist. Missing files remain absent so Pi can use its defaults; no other global Pi data is copied. Three isolated-home regressions cover both files, neither file, and a partial configuration.

Tool-key collision regressions (2026-09-11): the imported SHA-256 tool-call key now has the upstream long-common-prefix and 4,096-byte-boundary regression cases. Different Bash commands whose distinguishing text appears beyond the old 200-character horizon remain distinct, while genuinely identical long commands and deliberately capped strings still trip consistently.

Human-conversation breaker progress (2026-09-11): each `UserPromptSubmit` hook now stamps an expiring five-minute progress clock. Prose-only answers no longer look stalled merely because they touch no tools or workspace files; stale prompts still permit the no-progress breaker, and loop, error-storm, velocity, and budget arms remain independent.

Work-token agent caps (2026-09-11): per-agent ceilings now measure input, output, and cache-creation tokens while excluding cache reads, preventing large reused contexts from prematurely stopping productive agents. Floor-wide budgets continue to count every token kind for cost protection. Command-center meters and localized limit guidance use the same distinction, with focused regressions covering cached reads, cache writes, cap reasons, and floor accounting.

Workspace-aware breaker progress (2026-09-09): the no-progress circuit now considers recent activity in each agent's own working directory alongside coordination files and tool events. The main beat samples only fixed workspace/Git metadata paths, avoiding directory walks; recent work prevents false trips while stale or unavailable signals retain the prior behavior.

Isolated-worktree dependency parity (2026-09-09): newly created worker worktrees reuse an existing base-checkout `node_modules` through a platform-appropriate link, avoiding redundant installs while preserving isolation. Cleanup removes only a symlink whose resolved target is proven to be that base dependency directory, before dirty/integration checks; real or foreign dependency entries are left untouched.

Race-safe realtime task mutations (2026-09-09): voice create, assign, update, and delete actions now call the Hive's atomic task operations instead of writing a potentially stale whole-ledger snapshot. Failed atomic mutations return explicit spoken errors, and the existing task-mutation contract now covers the realtime action path.

Per-file transcript usage cache parity (2026-09-09): each physical transcript tail is parsed once and accumulated into an unfiltered total plus per-session buckets, eliminating repeated parsing when several agents share a workspace. Filtered totals preserve input, output, cache read/write, model, and cost fields; records without a session ID remain unfiltered-only. Manual benchmark media and scripts were intentionally excluded from product source.

Cross-platform power onboarding parity (2026-09-09): the reliability step now selects macOS, Windows, or Linux guidance from the isolated preload platform value. macOS and Windows expose their OS-owned power-settings deep links through the restricted allowlist; Linux shows desktop-environment guidance without a nonfunctional button. English, Arabic, and Simplified Chinese carry the complete platform-specific copy. Focused source contracts protect the platform routing, safe schemes, and locale keys.

Standing-goal delivery parity (2026-09-09): durable agent briefings are delivered once per live session instead of being repeated on every prompt. Edits are injected once at the next prompt, clearing a goal explicitly revokes the previous briefing, and delivery state remains isolated per agent. Six focused regressions mirror upstream PR #367.

Room-life parity (2026-09-06): all 15 desks now paint original procedural off-monitor blocks that the imported `DeskScreen` replaces with animated lit screens while workers are seated. The replacement room also stamps licensed LPC water-cooler, copier and bin props into collision-safe positions; three reachable dispenser/bin anchors activate the imported idle-errand director. No excluded artwork or new binary asset was added. Structural tests verify GIDs, transparency, prop crops, collisions and reachable stands; visual quality still requires human review.

English onboarding identity (2026-09-05): the first-run persona screen and title-bar logo now identify OrbiAgents and describe its local orbital crew/command-center product instead of Munder Difflin. A focused test rejects Munder branding anywhere in the English onboarding object. Other locales and visible settings/update/Slack/realtime references are explicitly outside this slice and remain to migrate; internal protocol/storage compatibility identifiers remain unchanged.

English application chrome identity (2026-09-05): release notes, Settings identity and repository actions, update guidance, IDE/focus-mode titles, and realtime app descriptions now identify OrbiAgents. A focused source test protects these visible surfaces and repository links. Paid Pro/founders promotion, Slack-facing copy, and non-English locales remain separate migration slices; internal protocol and storage compatibility identifiers remain unchanged.

Neutral Settings identity (2026-09-05): the Settings hero now uses the compiled-in local operating description and no longer fetches remote promotional copy. Paid Pro, founders, sponsor, upgrade, and upstream Discord surfaces are removed while OrbiAgents release, repository, issue, and changelog actions remain. The compatibility hero IPC/parser remains imported but is no longer called by Settings; localization cleanup and Slack-facing copy remain separate slices.

Bundled locale identity (2026-09-05): English, Simplified Chinese, and Arabic onboarding, open-model guidance, update copy, and organization messaging now identify OrbiAgents. Chinese and Arabic onboarding descriptions express the same orbital-crew/local-command-center product as English. Translation keys used only by the retired Pro, founders, sponsor, and upstream Discord surfaces were removed from all three locales. A focused test rejects the upstream product name and those retired keys across every bundled locale; Slack-facing copy remains separate.

Slack identity (2026-09-05): the in-app Slack connection walkthrough now tells users to create and invite an OrbiAgents bot, and the bundled loopback reply helper documentation identifies the OrbiAgents main process. Existing `md-*` helper filenames, environment variables, headers, and authenticated loopback protocol remain unchanged for compatibility.

Runtime product identity (2026-09-06): Electron window titles, update repository/artifact URLs and install guidance, fallback release content, organization copy, provider command guidance, copyable hire prompts, agent runtime context, and local-model help destinations now identify OrbiAgents. Update checks target `SUDARSHANCHAUDHARI/OrbiAgents`; local-model help falls back to the OrbiAgents README until dedicated guides exist. Existing `munderdifflin://` links, `munder-difflin/hire@1`, `munder-*` integration namespaces, storage paths, and environment/header names remain unchanged compatibility contracts.

Original floor dialogue (2026-09-06): the imported television-character quotations and suggestive running gag were replaced wholesale with original, short OrbiAgents operations dialogue for coffee, vending, snack, table, and paired exchanges. All 15 persisted worker keys and the deterministic scene-facing `pickSoloLine`/`pickExchange` exports remain intact. A focused source contract rejects representative copied-show language and protects the replacement API/key coverage.

Local Settings identity endpoint (2026-09-06): the retained `hero:payload` compatibility bridge now returns the compiled OrbiAgents identity payload directly. It no longer contacts the upstream repository or reads/writes a promotional cache; its function and IPC result shapes remain stable for imported callers.

Original packaged app icon (2026-09-06): the macOS verification packager derives a complete iconset and `.icns` from the repository's original OrbiAgents robot/orbit SVG using native macOS tooling. Packaged review builds no longer fall back to Electron's default icon, and no generated bitmap or copied upstream artwork is stored in source.

Localized floor chatter (2026-09-06): the active strategy-break, status, and worker-conversation pools in English, Simplified Chinese, and Arabic now use neutral OrbiAgents operations language. Copied-show boss, mug, cigar, declaration, and workplace-gossip jokes were removed while every locale key and fixed pool length remains compatible with the existing animation selector.

Fresh orchestrator identity (2026-09-06): new installations now default the orchestrator's display name to `Orbi Prime`. Fresh-spawn orientation, onboarding fallback copy, and realtime voice identity use the resolved live name rather than hardcoding the upstream character. Existing persisted renames and compatibility IDs such as the `michael` portrait key and `michael-voice` action actor remain unchanged.

Neutral runtime orchestrator copy (2026-09-06): simulated release notes, Slack autonomous-work instructions, assistant enrichment instructions, and microphone-permission errors now refer to Orbi Prime or the orchestrator instead of the upstream character. Internal component/type names, the `michael` persisted portrait key, the `michael-voice` action actor, and legacy targeting aliases remain unchanged compatibility contracts.

Lazy workspace editor (2026-09-06): the Monaco-powered IDE is now loaded through a React lazy boundary only when the workspace overlay opens. Startup no longer eagerly evaluates the editor surface; a full-window loading panel preserves immediate feedback while its chunk loads. In the isolated production build, startup JavaScript fell from 6.1 MB on disk / 1.82 MB gzip to 3.05 MB / 964 kB gzip, while the optional IDE emitted as a separate 3.36 MB / 860 kB gzip chunk and its 130.51 kB stylesheet also left startup. These are build artifact measurements, not interactive performance or visual-acceptance results.

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
