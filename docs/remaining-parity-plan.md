# Remaining desktop parity work

Agreed scope: desktop main/preload/renderer, desktop tests and verification scripts, and project documentation. Preserve existing local files. No browser automation, captures, workflow expansion, Windows work, credentials or external publication.

## Success criteria

- Saved loopback model endpoints support bounded, cancellable inference without leaking credentials or following redirects.
- A brief produces a bounded reviewable supervisor plan; approved sequential tasks route to one running project agent. Scoped callbacks record worker reports and advance the plan. Reports remain worker assertions, not independent certification.
- Voice transcripts can be edited and explicitly dispatched to a chosen running agent. Recording alone never executes work.
- New controls have accessible names, useful empty/error/loading states and localized labels.
- Focused regression tests, full desktop tests, type checks, source security/accessibility/localization checks and build are run and recorded.

## Order

1. Local inference API, IPC, cancellation and renderer controls.
2. Supervisor planning and reviewed task dispatch.
3. Confirmed voice dispatch.
4. Quality pass and updated evidence/boundaries.

## External acceptance

Apple signing/notarization, live Slack credentials/forwarding, production gallery hosting, human language/UI review and native graphical Linux acceptance are not completed by local unit tests. Local inference and planning have now passed against installed Ollama `qwen2.5-coder:7b`; other models remain unverified. The callback protocol has not been exercised through a real provider CLI. General-purpose tool execution by local models and parallel multi-agent scheduling are not implemented by this bounded workflow.

## Implemented

- Cancellable inference, redirect denial, bounded input/output/concurrency and redacted failures.
- Model-generated review plan, explicit approval, sequential task dispatch and expiring one-task callback capabilities, replay/concurrency rejection, worker-result summaries, operator-reviewed retry and cancellation.
- Retry budget enforced before delivery, not only when marking work started.
- Editable, confirmed voice dispatch with a separate provider-retention warning.
- Localized controls, task-board refresh on supervisor changes, and CSS minification without relaxing performance budgets.

## Verification record

Verified locally on 2026-09-03:

- Full desktop suite: 218 passed, 0 failed, 0 skipped. Real loopback tests required execution outside the network-restricted sandbox.
- Node and renderer TypeScript checks passed.
- Security source checks passed: 88 trusted-sender IPC handlers.
- Accessibility source checks passed: 34 components, 65 named controls. This is not screen-reader or visual acceptance.
- Localization checks passed: 617 matching message keys and three pinned font families. Human translation review remains open.
- Design-system source checks passed.
- Renderer performance budgets passed unchanged: entry JS 642,849 bytes raw / 118,684 gzip; CSS 30,870 raw / 7,286 gzip.
- Production build and `package:mac:dir` passed. The local artifact is `desktop/release/mac-arm64/OrbiAgents.app`, unsigned and not notarized. Packaging required approved network access for the Electron download; nothing was published.
- Focused quality review corrected early-cancellation races, retry rejection occurring after delivery, stale reporting capabilities, task-board refresh and the CSS budget overrun. No browser automation or session capture was used.

### Follow-up: live local-model acceptance (2026-09-03)

- The first live run passed inference but failed strict plan parsing. Planning now requests OpenAI-compatible JSON-object output explicitly; plain text inference is unchanged, and the strict plan validator remains intact.
- The repeatable smoke check passed against already-installed Ollama `qwen2.5-coder:7b`: model discovery, inference marker and a valid two-step review plan. No worker was dispatched, no model downloaded, no cloud credits used, and temporary endpoint data was removed.
- Run from `desktop`: `node --import tsx scripts/check-local-model-acceptance.ts qwen2.5-coder:7b`. An optional second argument selects another loopback `/v1` endpoint; this script does not load application credentials or project files.
- Added an integration regression using real HTTP inference and task-report transports, real Hive persistence and a simulated worker. It checks review-before-dispatch, sequential advancement, report replay rejection, and exclusion of reporting capabilities from durable task records. It is not real provider-CLI acceptance.
- Full desktop suite: 220 passed, zero failures/skips. Desktop and smoke-script typechecks passed. The previously recorded unsigned package predates this follow-up; packaged UI acceptance remains open.
