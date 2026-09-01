# Desktop parity audit

Compared on 2026-08-31 against `chaitanyagiri/munder-difflin` commit `49126393` (v0.4.6). “Built” means verified in this repository; it does not claim identical implementation or artwork.

| Capability | OrbiAgents status | Evidence / boundary |
| --- | --- | --- |
| Electron, React, PixiJS, xterm, node-pty desktop | Built | `desktop/`; sandboxed preload and fixed IPC |
| 12 built-in agent engines and custom adapters | Built | Runtime catalog, setup checks, launch validation |
| Real PTY agents and per-agent worktrees | Built | PTY lifecycle, guarded apply/discard, recovery inventory |
| Visual office and live agent state | Built | Multi-floor orbital office, locator, activity paths, retained layout |
| Supervisor, tasks, mailbox, blackboard, approvals | Built | Durable local Orbi Hive and Orbi-Prime coordination |
| Scheduled missions and heartbeat | Built | Explicit approval and run controls; disabled by default |
| Markdown memory, search, condensation | Built | Project-partitioned bounded memory store |
| Knowledge relationships | Built (local deterministic) | UI maps records sharing verified text concepts; not an enterprise document-ingestion graph |
| Monaco editor and Git history | Built | Safe file broker, save conflict checks, revisions, read-only repository summary |
| GitHub issues and CI | Built | Operator-triggered, bounded, local `gh` access |
| Skills catalog and removal | Built | Searches installed metadata without execution; confirmed removal moves only a freshly verified skill directory to OS Trash |
| Trusted remote catalog review | Built | Operator-triggered HTTPS review pins publisher and Ed25519 key identity, verifies signed strict manifests, rejects redirects/private destinations, and bounds caching and response size |
| Remote skill installation | Built (constrained package) | Requires a fresh trusted review and explicit confirmation; exact size and SHA-256 are enforced before atomic installation of a bounded text-only JSON skill package under managed app data, with publisher/key/catalog provenance persisted and no execution during installation |
| Runtime usage and cost controls | Built with provider limits | Sanitized session signals and elapsed time plus an integrity-checked estimate ledger; no fabricated token totals |
| Local LLM endpoints and BYOK | Built | Loopback-only endpoints and OS-encrypted write-only credentials |
| First-run setup and recovery | Built | Read-only prerequisite checks and bounded interrupted-work report |
| Application updater | Built, publication unproven | Explicit check/download/install, stable-only, downgrade rejection, workload blockers |
| Shareable hire profiles | Built (clipboard) | Versioned bounded links exclude workspace paths and credentials; import only prefills the form and never launches |
| OS hire-link registration / local gallery | Built | Packaged single-instance protocol handling reuses strict validation and only opens a prefilled form; three local presets ship in-app |
| Hosted agent gallery | Built client; publication external | Signed `hire-profile` catalog artifacts are size/checksum verified and strictly validated before prefilling the normal hiring form; they cannot carry workspace paths, credentials, commands, or launch authority. Publishing and moderating a production catalog remains an operator-owned external service |
| Inbound webhooks | Built (local foundation) | Operator-enabled loopback receiver with per-launch secret, constant-time Bearer verification, replay IDs, bounded payloads, and an in-memory event inbox; secrets never enter renderer state |
| Slack integration | Not built | Requires provider credentials, OAuth/secret lifecycle, scopes, and an operator-approved external network boundary |
| Voice consent and retention foundation | Built | Explicit persisted consent and bounded retention choices fail closed; revocation clears retention and capture remains disabled |
| Voice capture and transcription | Not built | Microphone permission remains deliberately denied until a transcription provider and deletion implementation are selected |
| English/Chinese/Arabic localization and RTL | Built, translation review pending | Typed lazy-loaded catalogs, explicit locale selection, RTL direction, IME-safe commands, and localized canvas/DOM controls; native system fallback fonts are used pending licensed bundled-font selection |
| Signed/notarized release-to-release update | Blocked externally | Requires Apple Developer ID/notary credentials and publication of a later signed release |
| Windows/Linux distribution | Outside current macOS release scope | Current desktop release target is Apple Silicon macOS |

## Completion boundary

The local macOS product now covers the core terminal-agent office, coordination, memory, IDE, Git/GitHub, skills, telemetry, setup, recovery, and controlled-update workflows. The remaining rows are not safe “polish” tasks: they require product decisions, external credentials/services, translations or platform expansion. They must not be presented as completed until those inputs and their acceptance tests exist.
