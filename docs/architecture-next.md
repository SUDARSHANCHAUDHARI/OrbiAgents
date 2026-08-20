# Architecture: implemented foundation and next steps

## Implemented in this branch

### Local-first state

OrbiAgents uses its existing Prisma/SQLite database for user-scoped memory and mailbox records. Memory supports per-agent and shared project scopes. Mailbox messages include sender, recipient, kind, conversation, reply, status, and hop count.

### Runtime boundary

`RuntimeAdapter` separates agent prompts from execution. `ApiRuntimeAdapter` preserves the existing Anthropic, OpenAI, and Gemini behavior. `LocalCliRuntimeAdapter` can run Codex or Claude Code through an allowlisted, no-shell process runner when the server operator explicitly enables it. Dynamic workflow nodes receive isolated Git worktrees; API execution remains the default.

### Supervisor and safety

Orbi-Prime emits workflow/node lifecycle events and observes retries and circuit openings. `WorkflowCircuitBreaker` limits runtime, retries, tokens, cost, and consecutive failures. Mailbox validation separately limits message hops.

### Parallel DAG scheduler

The dynamic runner maintains dependency counts, starts ready nodes up to `MAX_PARALLEL_AGENTS`, and releases successors only after every predecessor completes. Result steps retain stable topological order even when completion order differs.

### Workspace isolation boundary

`WorkspaceIsolation` represents acquisition and release of a coding workspace. The default no-op implementation preserves API-agent behavior. `GitWorktreeIsolation` validates and scopes paths through an injected command runner. The operator UI can inspect registered dirty worktrees and explicitly discard them, but it never merges, commits, or pushes changes automatically.

### Observability

Supervisor events are broadcast through the authenticated WebSocket and persisted with session replay. The web dashboard shows live supervisor state, active agents, recent lifecycle events, concurrent work, and mailbox delivery using original OrbiAgents visuals.

## Deliberately not claimed as complete

- Persistent discovery of preserved worktrees after a server restart
- Patch-level review and selective merge flows for dirty agent worktrees
- Autonomous supervisor changes to user workflows
- Automatic memory extraction, semantic retrieval, or prompt injection
- Editing or deleting existing memory entries and threaded mailbox replies
- Exact event-to-frame replay synchronization

These boundaries keep existing API workflows safe and working while providing tested extension points for local coding agents.
