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
| Remote skill installation | Not built | Requires a trusted catalog, package verification, and provenance policy |
| Runtime usage and cost controls | Built with provider limits | Sanitized session signals and elapsed time plus an integrity-checked estimate ledger; no fabricated token totals |
| Local LLM endpoints and BYOK | Built | Loopback-only endpoints and OS-encrypted write-only credentials |
| First-run setup and recovery | Built | Read-only prerequisite checks and bounded interrupted-work report |
| Application updater | Built, publication unproven | Explicit check/download/install, stable-only, downgrade rejection, workload blockers |
| Shareable hire profiles | Built (clipboard) | Versioned bounded links exclude workspace paths and credentials; import only prefills the form and never launches |
| OS hire-link registration / gallery | Not built | Requires an OS protocol threat model and hosted gallery scope |
| Slack and inbound webhooks | Not built | Requires provider credentials, secret lifecycle, replay protection, and an operator-approved network boundary |
| Voice control | Not built | Microphone permission is deliberately denied; provider, consent, retention, and transcription behavior are undecided |
| Full English/Chinese/Arabic localization and RTL | Not built | Requires complete string extraction, bundled fonts, translation review, and RTL/IME acceptance |
| Signed/notarized release-to-release update | Blocked externally | Requires Apple Developer ID/notary credentials and publication of a later signed release |
| Windows/Linux distribution | Outside current macOS release scope | Current desktop release target is Apple Silicon macOS |

## Completion boundary

The local macOS product now covers the core terminal-agent office, coordination, memory, IDE, Git/GitHub, skills, telemetry, setup, recovery, and controlled-update workflows. The remaining rows are not safe “polish” tasks: they require product decisions, external credentials/services, translations or platform expansion. They must not be presented as completed until those inputs and their acceptance tests exist.
