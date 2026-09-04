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

Replacement-art progress: 13 unmodified LPC office prop images plus original `Credits.txt` are imported under `desktop-munder/art/lpc-office/`. Source URL, license URL, archive/file hashes and image dimensions are recorded. Integrity tests reject modified source, modified approved art and unapproved images. These assets are not yet mapped or connected to the renderer; structure tiles, original worker identities and scene integration remain outstanding.

The pinned source import is complete and its integrity checker passes. Launch/build commands deliberately fail pending adaptation; no upstream dependency installation, application tests or launch has occurred. Replacement theme, runtime adaptation, build verification, live provider acceptance and visual acceptance remain incomplete. Source import is not visual parity.
