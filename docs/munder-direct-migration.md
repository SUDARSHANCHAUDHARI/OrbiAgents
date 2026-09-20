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

Reduced-motion worker sprites (2026-09-17): each worker sprite now receives the OS motion preference before its first playback decision. Typing, reading, and idle loops pin to their first representative frame under reduced motion, while walking remains animated because it communicates actual movement through the floor. Existing workers freeze or resume immediately when the preference changes; paths, facing, status signals, selection, and lifecycle effects remain unchanged. Focused regressions protect initial and live preference handling plus the walking exception; subjective pose recognition remains a human review step.

Reduced-motion ambient displays (2026-09-16): the copier scanner strip, six-cell operations display, and boardroom briefing beacon now pin themselves to their first clear frame when the OS requests reduced motion, including on a live preference change. Returning to normal motion resumes their existing frame sequences. Artwork, semantic placement, animation speeds, room visibility, and all worker animation remain unchanged. Focused regressions protect all three registrations and the live freeze/resume path; subjective frame choice remains a human review step.

Reduced-motion worker statuses (2026-09-16): working halos now hold at their existing midpoint instead of breathing, blocked exclamation marks stay continuously visible instead of blinking, compacting boxes hold their midpoint size, and looping warnings show a stable four-dot orange ring when the OS requests reduced motion. Normal-motion animation, selection, worker movement, and the brief success/cheer lifecycle acknowledgements remain unchanged. Focused regressions protect both steady states and the retained short cues; subjective status recognition remains a human review step.

Reduced-motion activity effects (2026-09-16): the entrance cue now holds a stable outline instead of flashing, while sink suds, coffee steam, errand overlays, cigar smoke, and watering droplets are suppressed when the OS requests reduced motion. Operational context remains visible through worker movement, thoughts, carried objects, the running-water mark, and a static cigar/ember. Live preference changes clear active scene overlays immediately without restarting or shortening the underlying activity. Focused regressions protect the scene and character boundaries; subjective cue clarity remains a human review step.

Reduced-motion attention indicators (2026-09-16): the continuously breathing Hire kiosk and waiting-question Ask Me frame now become stable, clearly visible outlines when the OS requests reduced motion. Their hover labels, click actions, pending-question notes, and normal-motion pulses remain unchanged. Live preference changes redraw both indicators immediately without restarting the scene; worker activity and short lifecycle cues stay outside this bounded slice. Focused tests protect static contrast, stopped pulse clocks, and live redraw behavior; subjective contrast acceptance remains a human review step.

Reduced-motion-safe worker focus (2026-09-16): the Pixi office now honors the live `prefers-reduced-motion` setting for worker selection. Selection rings and command-panel state remain intact, while camera spotlights are skipped when reduction is already enabled; enabling it mid-spotlight cancels the motion and snaps back to the fitted office immediately. The media-query listener is removed with scene teardown. Focused tests protect initial preference, live changes, retained selection, immediate reset, and cleanup; assistive-technology acceptance remains a human review step.

Selected-worker camera spotlight (2026-09-16): choosing a worker now gives the existing selection ring a short, responsive camera spotlight that tracks the worker's live position at 1.35x fitted zoom, then eases back to the whole-office view. A cleared selection restores the fit immediately. The durable selected-agent state, command panels, worker movement, and initial camera snap remain unchanged. Focused tests protect live tracking, bounded duration, zoom, and release behavior; subjective motion acceptance remains a human review step.

Persistent floor-control affordances (2026-09-16): the semantic Triggers calendar, Tasks boards, Ask Me board, and Close clock now retain quiet pixel outlines before hover instead of becoming discoverable only by pointer accident. Hover strengthens the same outline and reveals the existing localized placard; click targets, navigation, close behavior, room artwork, and the separately pulsing Hire kiosk remain unchanged. Focused tests protect idle/hover states and reviewed actions; subjective outline contrast remains a human review step.

Contained floor failure state (2026-09-16): GPU and initialization failures now remain positioned inside the office panel instead of allowing their absolute fallback message to escape across unrelated application chrome. The shared fallback is also exposed as a polite status region while preserving its actionable text and normal canvas layout. Focused tests protect containment and accessible announcement; live GPU-loss acceptance remains a human review step.

Immediate initial camera fit (2026-09-16): the first composed office frame now snaps directly to the centered fit instead of easing in from the camera's default world origin. Resize and worker-focus transitions retain their existing smooth motion; only initial scene presentation changes. Focused tests protect the explicit startup snap and the unchanged responsive refit path; live first-paint acceptance remains a human review step.

Responsive nameplate edge clamp (2026-09-15): counter-scaled worker identity plates now slide horizontally inside the 768 px room instead of clipping at east/west edges. The center clamp uses the retained plate width and live zoom compensation, refreshes after rename, zoom, and movement, and leaves the worker, vertical overlay stack, and camera unchanged. Focused tests protect the map-bound calculation and all refresh paths; live narrow-window acceptance remains a human review step.

Status-colored identity frames (2026-09-15): active worker nameplate borders now share the retained lamp's live status color instead of remaining cyan for every state. Name changes preserve the current status color, status changes redraw the existing frame in place, and unknown values retain the idle fallback; plate dimensions, visibility, and worker motion are unchanged. Focused tests protect the shared palette and retained redraw path; subjective palette acceptance remains a human review step.

Worker overlay stack (2026-09-15): live thought clouds now sit above transient status glyphs and identity nameplates instead of letting their two-puff tail paint through both overlays. The cloud anchor moves from −38 to −60, preserving text wrapping, edge clamping, counter-scaling, overlap resolution, and worker coordinates. A focused source regression protects the cloud-tail geometry; dense live-cloud acceptance remains a human review step.

Nameplate/glyph clearance (2026-09-15): blocked, success, compacting, and looping glyphs now render above the worker identity plate rather than through its y = −39…−29 band. The glyph anchor moves from −34 to −48 while nameplate, sprite, selection, status semantics, and animation remain unchanged. A focused geometry regression protects the clearance; live bubble-density acceptance remains a human review step.

Active worker identity visibility (2026-09-15): workers in thinking, working, waiting, blocked, success, compacting, or looping states now keep their nameplate and status lamp visible without requiring pointer hover. Idle and ghost workers remain visually quiet unless hovered or selected, and activity visibility does not draw a false selection ring. Focused tests protect state-driven visibility, immediate redraw, and selection independence; density at large live fleet sizes remains a human review step.

Live worker status lamps (2026-09-15): hover and selected worker nameplates now include a compact pixel lamp driven by the agent's current status. All stored runtime states have distinct operational colors, unknown values fall back to idle, and updates occur before the activity-state short circuit without recreating or moving the worker. Focused tests protect the complete status palette, retained graphics path, and live floor wiring; subjective color acceptance remains a human review step.

Orbital mug rack (2026-09-13): the finite clean-cup stock now sits on an original transparent orbital rack instead of floating over a generic counter cell. Room composition derives the rack from `coffee.trayTile`, requires the existing blocked connected-counter surface beneath it, and leaves the adjacent tray stand reachable; the live cup sprites and stock transitions remain unchanged above the rack. Atlas, room, and integration tests protect artwork, semantic placement, counter coexistence, collision, and runtime map wiring; live cup pickup/return remains a human review step.

Dual viewport breeze errands (2026-09-13): both original east-wing viewports now participate in idle worker choreography. The active theme resolves the boardroom and cafeteria viewport contracts independently, registers one breeze errand for each reachable stand, and fails closed if either semantic prop is missing; the shared errand director continues to reserve each spot independently. Room and integration tests protect both placements and their exact stand/facing/effect wiring; live selection cadence remains a human review step.

Room-owned sink animation (2026-09-13): washing no longer redraws a generic vector basin and faucet over the approved LPC sink already placed by room composition. The transient Pixi layer now contains only running water and suds while `sinkBusy` is active; cup stock, washing timing, sink coordinates, collision, and reachability remain unchanged. Focused source and room integration checks protect the approved sink GID and FX-only boundary; live washing remains a human review step.

Semantic human-question board (2026-09-13): the live Ask Me surface now has an original lilac 2×2 pixel-art frame and cork base in the room atlas instead of rebuilding stable furniture every redraw. Its theme-relative placement remains beside the task boards, while the scene retains only the empty watermark, live question notes, attention pulse, click action, and human-tab routing. Atlas, room, integration, source, collision, and provenance checks protect the split; live pulse and answer flow remain a human review step.

Semantic task-board furniture (2026-09-13): the two live task boards and archive cabinet now have original pixel-art bases in the room atlas instead of being rebuilt entirely as transient vector shapes. Room composition owns their placement and exports the board anchor to the theme; the scene retains only status headers, live notes, pins, completed-document stacks, click handling, and worker choreography. Atlas, room, integration, and source-provenance checks protect the split; live task transitions remain a human review step.

Semantic wall controls (2026-09-13): the command-room calendar and orbital clock now exist as original transparent pixel-art tiles in the room atlas rather than runtime vector decoration or an invisible click target. Room composition owns their verified blocked-wall placement and exposes their anchors to the active theme; transparent Pixi hit targets preserve the triggers and closing-time actions without duplicating coordinates. Atlas, room, and integration tests protect artwork, placement, collision, and adapter wiring; live interaction remains a human review step.

Six-seat boardroom (2026-09-13): the 5×2 boardroom table now has six semantic overflow seats—two side chairs, two north chairs, and two south chairs—instead of only the side pair. A new original transparent down-facing chair completes the directional furniture set, while the existing up/left/right variants are reused. Layout, atlas, room, and integration tests protect seat names, complete placement, orientation, collision, reachability, and runtime spawn discovery; live seated composition remains a human review step.

Orbital cold-storage inspection (2026-09-13): the cafeteria now contains an original two-tile cold-storage unit beside the connected kitchen counter, with a blocked semantic footprint and reachable front stand. The active theme derives its `fridge` errand stand, facing, and open-door light anchor from that layout contract, activating the imported inspection behavior without renderer coordinates. Layout, atlas, room, and integration tests protect artwork transparency, placement, collision, reachability, and runtime wiring; live light-cone timing remains a human review step.

Orbital archive browsing (2026-09-13): the workspace edge now contains an original 2×2 illuminated archive rack with a blocked semantic footprint and reachable browsing stand. The active theme derives its `shelf` errand stand, facing, and glint-effect anchor from that layout contract, activating the imported browsing behavior without renderer coordinates. Layout, atlas, room, and integration tests protect artwork transparency, exact placement, collision, reachability, and runtime wiring; live animation timing remains a human review step.

Viewport breeze errand (2026-09-13): the active theme now connects the boardroom's existing original orbital viewport to the imported `window` idle errand. Room composition exposes each semantic viewport's wall position, interior stand, facing, and effect anchor; the theme consumes that contract instead of duplicating map coordinates. Room and integration tests protect both viewport artworks, clear and reachable stands, and exact runtime wiring; live breeze timing remains a human review step.

Orbital planter watering (2026-09-12): the workspace edge now contains an original two-tile orbital planter with a collision-safe semantic footprint and reachable watering stand. The active theme derives its `water` errand stand, facing, and effect anchor from that layout contract, activating the imported character watering animation without renderer coordinates. Layout, atlas, room, and integration tests protect artwork transparency, exact placement, collision, stand access, and live theme wiring; animation timing remains a human review step.

Original workstation chairs (2026-09-12): all 15 semantic workstation seats now render the existing original up-facing pixel chair beneath seated or absent workers. Placement comes from each named desk spawn and its adjacent blocked desk, rather than duplicated room coordinates; all chair cells remain walkable and pathfinding is unchanged. Room tests protect the complete desk-to-seat mapping, chair orientation, and collision state; live seated composition remains a human review step.

Orbi Prime command console (2026-09-12): the focal `desk-ceo` workstation now replaces its ordinary left-side accessory with an original two-tile illuminated command-console wing while retaining the approved ornate desk and the existing four-tile animated monitor. Both console cells remain inside the desk's established collision footprint, and the semantic seat remains walkable. Atlas and room tests protect transparency, exact desk-relative placement, live-monitor coexistence, collision, and reachability; live visual acceptance remains a human review step.

Orbi Prime command platform (2026-09-12): the semantic `desk-ceo` workstation now sits on a distinct original 5×5 command platform with a gold perimeter and technical inner deck. Its placement derives from the desk geometry rather than a renderer coordinate; desk artwork, animated monitor, seat, and collision remain unchanged. Atlas and room tests protect full opacity, exact 16/9 border-to-center coverage, semantic placement, and seat walkability; live visual acceptance remains a human review step.

Deterministic Pixi Node test environment (2026-09-12): migration tests now preload a test-only minimal `navigator.userAgent` shim before importing Pixi's CommonJS bundle. This fixes the five Pixi test-file crashes under the repository's active Node 20 shell without changing renderer or packaged runtime behavior. The full migration suite, design-system checks, accessibility checks, typechecks, and production build protect the boundary.

Original east-wing viewports (2026-09-12): the boardroom and cafeteria now each receive a two-tile illuminated orbital viewport on their shared exterior perimeter. Positions derive from the right edge and vertical center of each semantic zone, while the underlying wall and collision remain intact. Atlas and room tests protect transparent pixel content, complete top/bottom coverage, zone-relative placement, exterior-wall ownership, and unchanged collision; live visual acceptance remains a human review step.

Original entrance airlock (2026-09-12): the semantic entrance and its floor runner now terminate at a visible three-tile original orbital airlock on the bottom perimeter. Placement derives from the entrance spawn, the interior approach remains open, and the existing boundary collision stays intact. Atlas and room tests protect transparent pixel content, complete left/center/right coverage, spawn alignment, wall ownership, and unchanged approach/perimeter walkability; live visual acceptance remains a human review step.

Original semantic zone signs (2026-09-12): workspace, boardroom, and cafeteria zones now receive distinct original transparent pixel signs on existing blocked walls. Positions derive from the map's semantic zone rectangles rather than unrelated scene coordinates, and glyphs distinguish a work grid, meeting table, and café mug. Atlas and room tests protect transparency, unique GIDs, zone-relative placement, wall ownership, and unchanged collision; live visual acceptance remains a human review step.

Café refreshment dispenser (2026-09-12): the existing `cafe-stand-vending` interaction point now has a visible two-tile dispenser directly above it, using a distinct model from the approved LPC water-cooler sheet. It replaces two counter-end cells without changing the kitchen collision footprint, keeps the stand reachable, and preserves the separate workspace cooler. Furniture and room tests protect the exact source variant, placement, GIDs, collision, and stand alignment; live visual acceptance remains a human review step.

Original connected kitchen counter (2026-09-12): all 15 previously generic fallback cells around the coffee maker and sink now use original left, middle, and right countertop/facade pixel tiles. The approved appliances remain intact, the full 9×2 collision footprint is unchanged, and connected edge treatments replace the repeated flat blocks. Atlas and room tests protect opacity, exact edge GIDs, appliance coexistence, collision, and removal of the generic counter fallback; live visual acceptance remains a human review step.

Coherent café table (2026-09-12): the café's full 4×2 collision footprint now uses a complete table assembled from the approved card-table sheet's left, repeated center, and right cells instead of ending in a generic fallback column. All four semantic café seats remain adjacent and walkable. Layout, furniture, and room tests protect exact source-cell composition, collision coverage, chair orientation, and reachability; live visual acceptance remains a human review step.

Coherent boardroom table (2026-09-12): the boardroom's oversized generic 5×4 obstacle is replaced by a complete 5×2 table assembled from the approved card-table sheet's left, repeatable center, and right cells. Its two semantic seats remain adjacent and walkable while six formerly reserved floor cells reopen for natural movement. Layout and furniture tests protect exact collision, source-cell composition, placement, and reachability; live visual acceptance remains a human review step.

Animated operations display (2026-09-12): the approved LPC widescreen sheet's powered-off, color-broadcast, and three static states now cycle across the north-wall display as one synchronized 3×2 image. The scene validates the sheet geometry, discovers the placed display through its top-left furniture GID, and assembles all six animated cells without embedding the Orbi room coordinate. Invalid or incomplete frames fail closed. Provenance, placement, source, type, and build checks protect the integration; live animation pacing remains a human review step.

Original shared-space chairs (2026-09-12): the boardroom and café now place six original transparent pixel chairs beneath their existing worker seats. Each chair faces its adjacent table, is derived from the semantic shared-seat spawn contract, and leaves collision and pathfinding unchanged. Atlas and room tests protect transparency, directional placement, valid GIDs, and walkable seat cells; live visual acceptance remains a human review step.

Original worker chassis variety (2026-09-12): the procedural OrbiAgents worker family now uses five original head silhouettes—single antenna, twin antenna, side receivers, crown sensor, and reinforced sensor bar—plus matching chest-panel details. The 18×32 texture contract, three walking directions, persisted roster keys, and the first three established accent identities remain unchanged. Source tests protect five distinct opaque silhouettes across the 15-color roster and all direction/step combinations; live pixel-art quality remains a human review step.

Copier scanner activity (2026-09-12): the previously unused approved eight-frame copier-light strip now animates over the copier's scanner bed. The scene discovers the light and body sheets from active theme metadata, locates the body through its furniture-layer GID, and offsets the overlay to its top-right tile; no room coordinate is embedded in the renderer. Missing or incomplete frames are destroyed instead of leaving partial scene resources. Provenance, source, map-placement, type, and build checks protect the integration; live animation quality remains a human review step.

Theme-relative human board (2026-09-11, clearance corrected 2026-09-12): the interactive Ask Me board now shares the active theme's north-wall board band instead of floating at the imported office's workspace coordinate. In the original OrbiAgents room it occupies empty tiles 35–36/2 between the mailbox bank and task-board ensemble, directly above the copier without overlapping it, while retaining its pulse and click behavior. Source, collision, and furniture-layer regression tests plus reversible provenance protect the placement; live interaction remains a human review step.

Theme-relative task-board choreography (2026-09-11): workers carrying new, assigned, or completed task cards now walk beside the active theme's rendered board ensemble instead of stale upstream tiles. For the original OrbiAgents room, blocker, todo, and archive actions resolve to the verified walkable tiles 39/4, 41/4, and 43/4 beneath the board at 38/2. Source and collision regression tests plus reversible provenance protect the binding; live choreography timing remains a human review step.

Theme-relative coffee steam (2026-09-11): the brewing animation now derives its position and depth from the active theme's coffee-machine stand instead of the imported office's hard-coded tile. In the original OrbiAgents room it therefore appears above the machine at tile 38/16 rather than unrelated workspace tile 26/17. A source regression test and reversible provenance entry protect the theme-relative binding; live visual timing remains a human review step.

Original desk variety (2026-09-11): the 15 workstations now alternate between both complete horizontal designs on the approved ornate-desk sheet instead of repeating one silhouette throughout the workspace. Every desk retains its original 3×2 collision footprint, seat, accessory, and live-monitor coordinates. Furniture tests protect both crop families and their deterministic 8/7 distribution; visual acceptance remains a human review step.

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
Visual-density slice: the cafeteria's empty southeast wall bay now has a second original orbital planter, with collision-safe semantic placement and a reachable watering stand. The live idle director rotates through both watering destinations. Layout, room-atlas and theme-integration tests cover the duplicated prop without adding external artwork.

Cafeteria lounge slice: an original low orbital table and two directional chairs fill the lower café bay. Both new spawn points are walkable, automatically join the live café reservation/pairing system, and preserve the east-wing doorway and existing interaction stands.

Boardroom briefing slice: a three-frame original orbital beacon animates from the semantic center of the existing conference table. The theme exposes its anchor, the renderer resolves contiguous atlas frames from the placed GID, and the prop consumes no additional walkable space.

Entrance launch-kiosk slice: an original two-by-two orbital console fills the previously empty arrival platform beside a reachable stand. Its semantic scene hit target opens the same reviewed hire modal as the existing chrome controls, without duplicating spawn logic or bypassing consent.

Airlock arrival slice: every admitted worker now triggers a short cyan/gold pulse across the semantic entrance airlock before walking to its assigned seat. The effect is scene-owned, ticker-driven, pause-safe, and consumes no timers or new artwork.

Airlock departure slice: removed workers release their seat and office resources, then remain in a dedicated ticked departure collection while walking to the semantic entrance. Arrival pulses the airlock before a fade/destroy sequence; an eight-second watchdog handles unreachable routes, and teardown clears all departure timers.

Hire-kiosk affordance slice: the in-world launch console now carries a subtle ticker-driven cyan breathing outline and brightens gold on pointer hover. The visual signal shares the existing semantic hit target and preserves the reviewed hire-modal action.

Hire-kiosk placard slice: hovering the launch console now reveals an original pixel-styled, localized add-agent placard above the kiosk. It names the interaction before activation, ignores pointer events itself, and leaves the existing reviewed hire-modal action unchanged.

Calendar trigger-affordance slice: hovering the semantic wall calendar now draws a gold focus frame and reveals a localized `TRIGGERS` placard. The overlay does not intercept input and preserves the existing orchestrator selection and Command Center navigation.

Task-board affordance slice: hovering the live cork-board ensemble now draws a gold frame and reveals a localized `TASKS` placard. Its dedicated child overlay survives note redraws without intercepting input or changing task-tab navigation.

Office-clock affordance slice: hovering the semantic wall clock now draws a coral frame and reveals a localized close placard, distinguishing the exit entry point from gold navigation controls. The existing renderer close request and guarded main-process quit flow remain unchanged.

Ask-me board affordance slice: hovering the human-question board now draws a lilac frame and reveals a localized `ASK ME` placard. Its dedicated child overlay survives pending-question pulse redraws without intercepting input or changing human-tab navigation.

Agent selection-feedback slice: worker sprites now show a light cyan ground ring on hover and retain a stronger ring while selected. Selection synchronizes for existing and newly arriving workers while preserving click selection, movement, activity glow, and camera nudging.

Agent identity-nameplate slice: hovering or selecting a worker now reveals a compact cyan nameplate above the sprite using the agent's human-readable name. Blank names fall back to the stable agent ID, long labels are ellipsized, and activity remains in the separate thought-bubble layer.

Nameplate zoom-readability slice: worker identity labels now share the activity bubble's below-1× counter-scaling rule. A bottom-center pivot keeps each label centered above its worker as it compensates for a fitted, zoomed-out room, while 1× and enlarged views remain unchanged.

Live nameplate-sync slice: renaming a running agent now redraws its existing floor nameplate in place, including stable-ID fallback, ellipsis, background width, and centered pivot. The idempotent update runs before activity-state short-circuiting and does not recreate or reposition the worker.

Reduced-motion worker-bubble slice (2026-09-17): worker thought and tool bubbles now skip entrance and exit fades when reduced motion is active, while keeping their existing linger timing and content lifecycle. Animated thinking dots become a stable full ellipsis, and live preference changes settle bubbles already fading or thinking without rebuilding the worker.

Reduced-motion recent-message slice (2026-09-17): the worker detail typewriter now reveals the complete recent response immediately when reduced motion is active. Enabling the preference mid-stream completes the current response, disabling it does not replay unchanged text, later response seeds retain normal animation, and the media-query listener is released with the hook.

Reduced-motion message-delivery slice (2026-09-17): hive handoffs keep their full envelope arc and arrival burst in normal mode, but reduced motion now presents a steady envelope briefly at the recipient with no travel, bob, scale, or fade. Enabling the preference mid-flight snaps the existing cue to that bounded arrival state, and its lifetime remains owned by the scene ticker rather than a new timer.

Reduced-motion worker-opacity slice (2026-09-17): worker entrance, departure, and ghost-opacity transitions retain their existing eased behavior in normal mode but settle immediately when reduced motion is active. Delayed departures preserve their lifecycle delay before atomically detaching the sprite, thought bubble, work glow, selection ring, and desk cup; enabling the preference during an active fade settles that same cleanup path.

Deterministic DOM reduced-motion slice (2026-09-17): the renderer's global media query now removes animations and transitions outright for elements and pseudo-elements instead of assigning zero duration to still-running infinite keyframes and staggered delays. Smooth scrolling is disabled in the same mode, while the existing pixel keyframes and component states remain unchanged for normal motion.

Keyboard-accessible floor-actions slice (2026-09-20): the five semantic fixtures painted inside the office canvas now have a compact native-button dock for keyboard and assistive-technology access. Hire, triggers, tasks, human approvals, and application close reuse the same reviewed actions as their Pixi pointer targets; localized toolbar labels, visible focus states, RTL-safe placement, and a distinct destructive close state preserve the floor as the primary visual surface without making its product actions pointer-only.

Keyboard-accessible worker-task slice (2026-09-20): a worker card's live-task sticky note is now a native, translated, named button rather than a mouse-only span. Keyboard activation opens the same first task detail as pointer activation, focus uses the existing global visible ring, and propagation remains stopped so opening a task never also changes the selected worker.

Keyboard-accessible file-tree slice (2026-09-20): every lazy IDE folder and file row is now a native button rather than a mouse-only div. Folder buttons expose expanded state, active files expose current-page state, disclosure glyphs are decorative, and Copy Path remains an independent native action; lazy loading, indentation, selection color, and file-opening behavior are unchanged.

Keyboard-accessible Git-file slice (2026-09-20): history and branch-comparison file changes now use full-width native buttons rather than mouse-only divs. Keyboard activation opens the same revision diff, status glyphs remain visual context, and the compact transparent row treatment preserves both pane layouts.
