# Changelog

All notable OrbiAgents changes are recorded here. The project follows Semantic Versioning for repository releases.

## [0.2.0] - Unreleased

### Added

- Desktop parity completion: steer/constrain/stop circuit breakers, provider-reported token and cost facts, bounded local document graphs, operator-gated webhook workers, commit topology and safe working-tree patches, and clearer onboarding/navigation.

- Persistent per-agent and shared memory with retention controls, optional embedding retrieval, and a bounded local cache.
- Typed agent-to-agent mailboxes with conversations, replies, read state, and hop limits.
- API and opt-in Codex/Claude Code CLI runtime adapters.
- Git worktree isolation, restart-persistent workspace discovery, and explicit tracked/untracked file review.
- Orbi-Prime supervision, approval-gated workflow proposals, bounded recovery, and circuit breakers.
- Parallel dependency-safe DAG execution with cancellation and same-agent serialization.
- Replay seeking, bookmarks, event filters, sharing controls, and workflow/cache observability.
- State-driven coworking zones, pair-work and mailbox animation, live/replay occupancy, and shared web/VS Code visual behavior.

### Changed

- Updated README and architecture documentation to match the implemented platform.
- Hardened authentication, rate-limit address resolution, request logging, security headers, and local process execution.
- Made production server and web containers reproducible with bounded Docker contexts.
- Standardized first-party package metadata on repository release version `0.2.0`.

### Security

- Updated all five independently locked dependency trees to the August 2026 security baseline.
- Kept provider credentials server-side and local CLI execution allowlisted, shell-free, abortable, output-bounded, and worktree-isolated.
- Preserved approval boundaries for workflow mutation and workspace changes.

### Compatibility

- Existing Anthropic, OpenAI, and Gemini API workflows remain the default.
- Local CLI runtimes remain disabled unless explicitly configured by the server operator.
- Autonomous supervisor workflow mutation remains disabled.

[0.2.0]: https://github.com/SUDARSHANCHAUDHARI/OrbiAgents/releases/tag/v0.2.0
