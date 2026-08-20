# Architecture: implemented foundation and safety boundaries

## Implemented in this branch

### Local-first state

OrbiAgents uses its existing Prisma/SQLite database for user-scoped memory, mailbox records, and preserved-workspace registry metadata. Memory supports per-agent and shared project scopes. Mailbox messages include sender, recipient, kind, conversation, reply, status, and hop count. Registered dirty worktrees remain discoverable across server restarts.

### Runtime boundary

`RuntimeAdapter` separates agent prompts from execution. `ApiRuntimeAdapter` preserves the existing Anthropic, OpenAI, and Gemini behavior. `LocalCliRuntimeAdapter` can run Codex or Claude Code through an allowlisted, no-shell process runner when the server operator explicitly enables it. Dynamic workflow nodes receive isolated Git worktrees; API execution remains the default.

### Supervisor and safety

Orbi-Prime emits workflow/node lifecycle events, explicitly selects bounded retry-or-stop recovery, and observes retries and circuit openings. `WorkflowCircuitBreaker` limits runtime, retries, tokens, cost, and consecutive failures. Mailbox validation separately limits message hops.

### Parallel DAG scheduler

The dynamic runner maintains dependency counts, starts ready nodes up to `MAX_PARALLEL_AGENTS`, and releases successors only after every predecessor completes. Result steps retain stable topological order even when completion order differs.

### Workspace isolation boundary

`WorkspaceIsolation` represents acquisition and release of a coding workspace. The default no-op implementation preserves API-agent behavior. `GitWorktreeIsolation` validates and scopes paths through an injected command runner. The operator UI can inspect registered dirty worktrees, apply selected tracked-file patches after a clean-target preflight, or explicitly discard them. It never commits, pushes, or deletes branches automatically.

### Observability

Supervisor events are broadcast through the authenticated WebSocket and persisted with session replay. The web dashboard shows live supervisor state, active agents, recent lifecycle events, concurrent work, and mailbox delivery using original OrbiAgents visuals. Replay uses recorded frame intervals, reveals events only when their recorded frame time is reached, and supports play/pause, stepping, timeline seeking, in-session bookmarks, and event-type filtering.

Orbi-Prime proposes bounded, validated changes one at a time. Operators can enable role insertion, duplicate-role removal, and label normalization independently; proposals and their applied/dismissed status are retained in user-scoped history. Each proposal includes an exact change list and cannot alter the active workflow until the user confirms it. Memory retrieval remains local-first: it ranks a bounded candidate set by deterministic text-vector similarity and filters expired entries. Operators may opt into OpenAI embeddings; vectors are cached in user-scoped local SQLite records with TTL and count bounds, authenticated metrics/clear controls, and local-ranking fallback on any failure. Replay bookmarks persist per authenticated user and session, support labels, and remain private unless individually included with a shared replay. Preserved worktrees expose untracked files separately with bounded text previews, binary metadata, or inline previews for recognized images under 64 KB; each new regular file must be selected explicitly and passes size, symlink, destination, and clean-target checks before copying.

## Deliberately not claimed as complete

- Autonomous supervisor changes to user workflows without approval
- Automatic memory extraction or a hosted vector database
- General rendering of untrusted binary content (only bounded, signature-recognized raster images are previewed)
- Arbitrary or destructive recovery actions

These boundaries keep existing API workflows safe and working while providing tested extension points for local coding agents.

## Release posture

The planned architecture foundation is complete. Further features require a concrete product requirement. Maintenance work should prioritize compatibility, user isolation, bounded resource use, migration safety, and evidence-backed fixes instead of generating an open-ended sequence of roadmap additions.
