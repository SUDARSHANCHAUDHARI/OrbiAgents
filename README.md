<div align="center">

# OrbiAgents

### Visual multi-agent workflow orchestration, execution, and replay

**Design an AI team, define how its agents collaborate, run the workflow, watch it execute in real time, and inspect what happened afterward.**

OrbiAgents is a visual multi-agent workflow engineering workspace. It combines workflow composition, specialized AI agents, live agent state, session replay, multiple model providers, saved workflows, usage guardrails, and a VS Code extension.

[Features](#features) · [Architecture](#architecture) · [Getting started](#getting-started) · [Current status](#current-status) · [Roadmap](#roadmap)

Release candidate: **v0.2.0**. See the [changelog](CHANGELOG.md) and [acceptance checklist](docs/releases/v0.2.0.md).

</div>

---

![OrbiAgents dashboard](docs/assets/screenshots/orbi-dashboard.png)

## Table of Contents

- [What OrbiAgents is](#what-orbiagents-is)
- [Features](#features)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [API and runtime highlights](#api-and-runtime-highlights)
- [Current status](#current-status)
- [Product direction](#product-direction)
- [Roadmap](#roadmap)
- [Why OrbiAgents](#why-orbiagents)
- [Security notes](#security-notes)
- [Contributing](#contributing)
- [Inspiration and credits](#inspiration-and-credits)
- [License](#license)
- [Project links](#project-links)
- [About](#about)

## What OrbiAgents is

OrbiAgents models work as a directed agent workflow.

A workflow can use specialized agents such as:

- **Orbi-Alpha / Planner** — breaks down the goal and proposes an implementation path
- **Orbi-Beta / Coder** — produces implementation output from the task and upstream context
- **Orbi-Gamma / Tester** — evaluates the latest implementation output
- **Orbi-Delta / Reviewer** — reviews implementation quality and risks
- **Orbi-Epsilon / Debugger** — uses code and review/test context to produce a corrected result

The workflow engine resolves dependencies between nodes, passes predecessor output forward, streams execution state to the UI, records cost and token usage, and stores sessions for replay.

```text
                 Planner
                    │
                    ▼
                  Coder
                 /     \
                ▼       ▼
             Tester   Reviewer
                \       /
                 ▼     ▼
                 Debugger
```

OrbiAgents also includes a simpler fixed Planner → Coder execution path.

> **Current runtime model:** OrbiAgents executes specialist agents through Anthropic, OpenAI, and Gemini APIs by default. Operators can explicitly enable local Claude Code or Codex CLI adapters; those runs use allowlisted, no-shell process execution and isolated Git worktrees.

## Features

### Workflow orchestration

- Fixed Planner → Coder execution path
- Dynamic DAG-based workflows
- Planner, Coder, Tester, Reviewer, and Debugger node types
- Bounded parallel execution of dependency-ready DAG branches
- Cycle detection
- Per-node streaming progress
- Pause and resume agent state
- Workflow cancellation
- Saved workflow APIs
- Maximum workflow-node guardrail

### Multi-provider AI

The orchestration server supports multiple providers behind one streaming interface:

- Anthropic Claude
- OpenAI
- Google Gemini

Provider availability is determined by which API keys are configured on the server, so the workflow runtime is not tied to one model vendor.

### Live observability

- WebSocket-powered agent state updates
- Agent status including idle, thinking, reading, coding, testing, reviewing, debugging, and done
- Current task and last action
- Per-agent logs
- Token usage tracking
- Estimated USD cost tracking
- Per-user runtime isolation
- Live workflow result delivery
- Pixel-office / coworking visual workspace
- Orbi-Prime supervisor activity and retry/circuit events
- Animated mailbox delivery and concurrent-agent indicators driven by real events
- Reduced-motion support

### Sessions and replay

- Record workflow sessions
- Capture agent-state frames during execution
- Persist supervisor and workflow observability events
- Replay completed sessions
- List previous sessions
- Record cost per run
- Generate shareable replay links
- Public replay endpoint using generated share tokens

### Accounts, persistence, and guardrails

- Email/password signup and login
- JWT-based authentication
- Persistent saved workflows
- Persistent per-agent and shared project memory
- Durable agent-to-agent mailbox messages outside workflow edges
- User-scoped workflow and session access
- Authentication rate limiting
- Workflow rate limiting
- Maximum workflow node count
- Maximum runs per hour
- Daily cost cap
- Runtime, retry, token, cost, message-hop, and consecutive-failure circuit breakers
- Protection against multiple workflows running at the same time for one user

### VS Code extension

The repository includes a separate VS Code extension that brings the OrbiAgents pixel-office experience into the editor.

Current extension capabilities include:

- Open the OrbiAgents panel
- Pixel Office webview
- Pick a workspace folder
- Diagnostics command
- Explicit Claude launch command
- Playwright end-to-end test setup

## Architecture

OrbiAgents is no longer a single Next.js MVP. The repository contains multiple product surfaces around one orchestration concept.

```text
┌─────────────────────────────────────────────────────┐
│                   Next.js Web App                   │
│        workflow UI · replay · visualization         │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP + authenticated WebSocket
                        ▼
┌─────────────────────────────────────────────────────┐
│                 OrbiAgents Server                   │
│            Express · WebSocket · TypeScript         │
│                                                     │
│  auth      workflows      sessions      runtimes    │
│  memory    mailbox        supervisor    safety      │
└───────────────┬─────────────────────────────────────┘
                │
       ┌────────┼─────────┐
       ▼        ▼         ▼
   Anthropic  OpenAI    Gemini
                │
                ▼
    Runtime Adapter + Dynamic DAG Runtime
                │
 Planner → Coder → Tester ∥ Reviewer → Debugger
                │
                ▼
 state · messages · events · cost · replay
```

## Repository structure

```text
OrbiAgents/
├── app/                         # Next.js application
│   └── api/design/              # Agent-system design API route
├── server/                      # Express + WebSocket orchestration backend
│   ├── agents/                  # Planner/Coder/Tester/Reviewer/Debugger
│   ├── test/                    # Server tests
│   ├── ai.ts                    # Anthropic/OpenAI/Gemini abstraction
│   ├── runtimeAdapter.ts        # API and guarded local-CLI contracts
│   ├── workspaceIsolation.ts    # No-op and Git-worktree isolation hooks
│   ├── memoryStore.ts           # Per-agent/shared memory persistence
│   ├── mailboxStore.ts          # Independent agent messages
│   ├── supervisor.ts            # Orbi-Prime execution events
│   ├── circuitBreaker.ts        # Workflow safety budgets
│   ├── auth.ts                  # Authentication helpers
│   ├── index.ts                 # HTTP + WebSocket server
│   ├── orchestrator.ts          # Fixed Planner → Coder runtime
│   ├── runtimeState.ts          # Per-user runtime state
│   ├── sessionStore.ts          # Session/replay persistence
│   ├── workflowRunner.ts        # Dynamic DAG workflow runtime
│   └── workflowTypes.ts         # Workflow node and edge model
├── extension/                   # VS Code extension
│   ├── src/
│   ├── webview-ui/
│   └── e2e/                     # Playwright E2E tests
├── docs/
│   ├── assets/screenshots/
│   ├── architecture-next.md
│   └── coworking-space-roadmap.md
├── docker-compose.prod.yml
└── README.md
```

## Tech stack

| Area | Technology |
|---|---|
| Web dashboard | Next.js 14, React 18, TypeScript |
| Root design app | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS |
| Server | Node.js, Express, WebSocket |
| AI providers | Anthropic SDK, OpenAI SDK, Google Generative AI |
| Data layer | Prisma |
| Authentication | JWT, bcrypt |
| VS Code integration | VS Code Extension API, webview UI |
| Desktop foundation | Electron, electron-vite, React, node-pty, xterm.js |
| E2E | Playwright |
| Deployment | Docker / Docker Compose |
| Package manager | pnpm |

## Getting started

### Prerequisites

- Node.js 20+ recommended
- pnpm
- At least one supported AI provider API key

### 1. Clone the repository

```bash
git clone https://github.com/SUDARSHANCHAUDHARI/OrbiAgents.git
cd OrbiAgents
```

### 2. Run the web app

```bash
pnpm install
pnpm dev
```

The web app runs at `http://localhost:3000` by default.

### 3. Configure and run the orchestration server

In a second terminal:

```bash
cd server
cp .env.example .env
pnpm install
pnpm dev
```

The server runs at `http://localhost:4000` by default.

Configure one or more provider keys in `server/.env`:

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Runtime controls can also be configured:

```bash
APP_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=change-me
DEFAULT_PROVIDER=anthropic
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_WORKFLOW_MAX=12
MAX_RUNS_PER_HOUR=30
MAX_DAILY_COST_USD=10
MAX_WORKFLOW_NODES=12
MAX_PARALLEL_AGENTS=3
TRUST_PROXY=false
LOCAL_CLI_ENABLED=false
# LOCAL_CLI_REPO_PATH=/absolute/path/to/repository
# LOCAL_CLI_WORKTREE_ROOT=/absolute/path/to/orbi-worktrees
```

Use a strong `JWT_SECRET` outside local development.
Set `TRUST_PROXY=true` only when the server is directly behind one trusted reverse proxy. Leaving it disabled prevents clients from spoofing forwarded addresses to evade rate limits.

### 4. Run server tests

```bash
cd server
pnpm test
```

The server test suite covers integration behavior, runtime state, session storage, and workflow execution logic.

### 5. Build the VS Code extension

```bash
cd extension
pnpm install
pnpm build
```

Run its Playwright E2E suite with:

```bash
pnpm e2e
```

### 6. Run the desktop foundation

The macOS-first desktop workspace is the first delivery milestone of the local agent-office roadmap. It currently provides a sandboxed Electron window, a typed preload bridge, built-in Codex, Claude, and Gemini PTY sessions, operator-allowlisted custom adapters, a dynamic agent roster, and embedded xterm terminals.

From the repository root:

```bash
pnpm install
pnpm desktop:check:security
pnpm desktop:check:accessibility
pnpm desktop:typecheck
pnpm desktop:test
pnpm desktop:build
pnpm desktop:check:performance
pnpm desktop:dev
```

Enter an existing absolute workspace path, select a configured runtime, and launch the agent. Built-in CLIs must already be installed and available on `PATH`. Custom adapters are added explicitly in Settings using an existing absolute executable path and bounded literal arguments. The renderer cannot inject a launch command, shell string, custom environment, or credentials; runtime descriptors are persisted and resolved by the desktop main process.

The desktop workspace now includes the Orbi Hive and Orbi-Prime operator foundation plus the PixiJS orbital office: real normalized agent states determine movement between planning, focus, collaboration, and lounge zones, while active Hive tasks and delivered mailbox messages draw real collaboration paths to the Orbi-Prime station. The grouped Command Center provides keyboard-accessible Floor, Terminals, Files, Repository, Tasks, Messages, Approvals, Memory, Skills, Activity, Usage, Recovery, Workspaces, Settings, Updates, and Setup views, a real selected-agent detail header, and a dependency-aware task board. Usage reports measured sanitized runtime signals and elapsed agent time separately from the integrity-checked authorization-estimate ledger; it does not invent token or invoice data. Repository intelligence adds bounded read-only local Git changes/history alongside operator-triggered GitHub issue and CI ingestion. Project memory includes deterministic text-derived relationships, and the installed-skill catalog searches bounded metadata without executing skills. Trusted remote catalogs can be reviewed against a pinned Ed25519 publisher identity; confirmed skill installs enforce exact artifact size and SHA-256, atomically write a constrained text-only package under managed app data, and retain provenance without executing the skill. Zoom, pointer selection, equivalent DOM controls, live Hive counts, and reduced-motion behavior are included. Agent worktree isolation is opt-in and enabled by default in the launch form: clean worktrees are removed after exit, while dirty worktrees are preserved with bounded tracked/untracked change metadata. Operators can select individual tracked and new files to apply after a clean-target preflight, or explicitly confirm permanent worktree discard. Restart recovery never presents a dead PTY as running and re-inspects preserved worktrees under the managed desktop root. Activity has one sanitized state/source contract. Claude sessions receive runtime-scoped hooks through an authenticated loopback receiver without rewriting global Claude settings. Codex rollout files are watched in bounded increments and attached only when their session metadata identifies exactly one matching live agent workspace. Provider prompt, command, and response content is not retained in activity events.

Orbi Hive persists project-partitioned inboxes, outboxes, task state, blackboard results, approvals, and append-only delivery events under Electron user data rather than dirtying project repositories. Orbi-Prime can assign durable work to a running project agent, deliver it through the owned PTY, acknowledge only successful delivery, control task start/block/retry/completion, coordinate multiple agents, and synthesize completed results. Failed PTY delivery remains inspectable and unacknowledged. Spending increases, destructive operations, and scope expansion enter the operator approval queue. The PixiJS office and expanded Command Center are tracked in `.flow/PLAN.md`.

Project memory is markdown-first and stored inside the same hashed Electron user-data partition, never in the selected repository. Operators can explicitly capture and search records from the Memory tab. Records and total bytes are bounded; retention creates a deterministic condensed record, malformed indexes rebuild from valid markdown, and deterministic text search remains available without embeddings.

Scheduled missions are also project-partitioned and disabled by default. A single desktop heartbeat marks due runs and requests a spend approval bound to that exact run; it never launches an agent. After approval, the operator must explicitly run the mission, and its configured project agent must already be running. Failed PTY delivery keeps the same pending task available for a safe retry instead of creating duplicate work.

Local OpenAI-compatible model endpoints can be configured in desktop Settings. Only loopback HTTP(S) URLs ending in `/v1` are accepted. Optional API keys are read directly by the main process from the system clipboard and encrypted with Electron `safeStorage`; plaintext credentials never enter renderer state or the endpoint metadata returned over IPC. A bounded `/models` probe verifies endpoint compatibility without exposing response bodies or credential-bearing network errors.

The desktop Files tab embeds Monaco for recorded agent workspaces. Its file tree is bounded and excludes dependency/build directories, symlinks, common credential files, binaries, and files over 1 MB. Existing text files can be saved only after operator confirmation and an exact SHA-256 version match, using atomic replacement. Bounded Git history supplies validated commit hashes for a read-only Monaco comparison view; the editor never stages, commits, pushes, deletes, renames, or creates files.

The desktop GitHub tab provides explicit, read-only issue and Actions ingestion through the locally authenticated `gh` CLI. Authentication checks and repository refreshes run only when the operator clicks them. Repository identity comes from the selected recorded agent workspace; fixed no-shell commands fetch at most 50 open issues and 30 recent runs. GitHub token environment overrides, command stderr, auth details, workflow mutations, login automation, and background polling are excluded.

First-run onboarding checks macOS support, Git, Codex/Claude/Gemini CLI availability, GitHub CLI availability, and operating-system credential encryption. Checks inspect executable access directly without running version or authentication commands, include standard Homebrew/user-local macOS paths, and classify missing optional tools separately. Onboarding never installs software or blocks the Command Center, persists only a version and acknowledgment timestamp, and can be rerun from the Setup tab.

Desktop app data now has an explicit schema boundary. Before adopting or upgrading managed state, OrbiAgents creates an owner-only, size-bounded backup of its agent, adapter, model-endpoint, onboarding, and Hive data; rejects links and unsafe paths; records SHA-256 checksums; and restores the verified snapshot if migration fails. Project repositories and managed worktrees are deliberately outside this rollback boundary.

At startup, OrbiAgents also records a bounded recovery inventory before scheduled-mission heartbeats begin. It reports processes interrupted by the previous app exit, unfinished Hive tasks, pending operator approvals, and claimed mission runs. Recovery is observational: it preserves isolated workspaces and durable records but never restarts commands, delivers tasks, or makes approval decisions automatically.

Approved scheduled missions are recorded in an owner-only append-only cost ledger before task creation or delivery. Entries are explicitly labeled as operator-authorized estimates—not provider invoices or actual charges—and use stable event keys plus a checksum chain. Retrying a run or restarting OrbiAgents cannot add the same authorization twice; an integrity failure preserves the readable prefix and blocks further appends for operator review.

The Command Center exposes both systems through fixed, argument-free, read-only preload methods. The Recovery tab shows interrupted sessions and unfinished durable work; the Costs tab shows verified authorization estimates, bounded history, integrity warnings, and aggregate authorized estimates without inventing token counts or actual billing data.

Apple-silicon macOS packaging now produces locally verified app, DMG, and ZIP artifacts with ASAR and rebuilt arm64 `node-pty`. Original OrbiAgents icon artwork and its ICNS package are included. The unsigned command is QA-only and cannot publish; the production command still requires Developer ID signing, notarization, Gatekeeper/stapler verification, and final artwork acceptance. See `docs/releases/desktop-macos.md` and `docs/releases/desktop-v0.3.0.md`.

The M6 source audit now enforces the Electron sandbox, context isolation, disabled Node/webview access, navigation/window/permission denial, trusted-sender IPC, and restrictive CSP. Every audited compact form control has an accessible name; first-run onboarding is modal to assistive technology; focus, reduced motion, terminal screen-reader mode, Monaco labels, and a DOM alternative to the office canvas are present. Production chunking reduced the initial renderer entry from 1,877,594 bytes to 600,610 bytes raw (381,578 to 108,648 gzip), with PixiJS, xterm, and Monaco delivered as separate lazy chunks. This is a code/build audit, not a substitute for the manual screen-reader, keyboard, signed-package, clean-account, and real-CLI acceptance listed in the macOS runbook.

## API and runtime highlights

The server currently exposes runtime capabilities for:

- health checking
- signup and login
- available AI providers
- usage reporting
- fixed workflow execution
- dynamic workflow execution
- workflow cancellation
- saved workflow CRUD
- persistent agent/shared memory
- agent-to-agent mailbox messaging
- session listing and replay
- replay sharing
- authenticated WebSocket state updates
- supervisor and circuit-breaker observability events

The implementation in `server/` is the source of truth for current runtime behavior.

### Opt-in local coding runtimes

After setting the three `LOCAL_CLI_*` variables above and restarting the server, `GET /runtimes` lists the enabled adapters. Select one on a dynamic workflow request with `"runtimeId": "codex-cli"` or `"runtimeId": "claude-cli"`. Omitting `runtimeId` keeps the existing provider API path.

Local commands are spawned without a shell from a fixed allowlist. Each node runs in a dedicated branch and Git worktree outside the source repository. Clean worktrees are removed after the node finishes; worktrees containing agent changes are preserved, and their path is returned in the corresponding workflow result step for operator review. OrbiAgents does not automatically commit, merge, push, or delete those changes.

The web workspace lists the runtime adapters enabled by the server, displays preserved worktrees, shows their changed-file and patch summaries, and can apply explicitly selected tracked files only after confirmation and a clean-target check. Its Context panel supports agent/shared memory editing and deletion, typed threaded mailbox replies, inbox review, and read status. Preserved-workspace registry entries are stored in the same local Prisma/SQLite database, so registered dirty worktrees remain discoverable after a server restart.

Memory prompt injection is disabled by default. A user can enable it for a run; OrbiAgents then supplies a bounded set of unexpired shared and per-agent memories. Memory entries can optionally carry retention periods.

## Current status

| Capability | Status |
|---|---|
| Visual multi-agent workspace | ✅ Built |
| Planner / Coder / Tester / Reviewer / Debugger | ✅ Built |
| Dynamic DAG workflows | ✅ Built |
| Anthropic / OpenAI / Gemini provider layer | ✅ Built |
| Live WebSocket agent state | ✅ Built |
| Authentication and per-user runtime | ✅ Built |
| Saved workflows | ✅ Built |
| Session replay | ✅ Built |
| Shareable replay | ✅ Built |
| Cost / usage guardrails | ✅ Built |
| VS Code extension | ✅ Built |
| Electron command center + interactive PTY/Hive/office | ✅ M6 implementation and static hardening complete; signed/manual release gates remain |
| Server tests | ✅ Built |
| Extension Playwright E2E setup | ✅ Built |
| Bounded parallel execution of independent DAG branches | ✅ Built |
| Persistent per-agent and shared memory | ✅ Built |
| Direct agent mailbox / messaging | ✅ Built |
| Orbi-Prime supervisor policy and event layer | ✅ Built |
| Circuit breakers for runtime/retries/tokens/cost/failures | ✅ Built |
| API runtime adapter | ✅ Built and default |
| Codex and Claude Code CLI adapters | ✅ Opt-in for dynamic workflows; disabled by default |
| Git worktree isolation | ✅ Required for local CLI nodes; dirty worktrees are preserved |
| Runtime and preserved-workspace operator UI | ✅ Built |
| Restart-persistent preserved-workspace registry | ✅ Built |
| Agent/shared memory and mailbox operator UI | ✅ Built |
| Bounded supervisor retry/stop recovery selection | ✅ Built |
| Approval-gated Orbi-Prime workflow proposals | ✅ Built |
| Local memory relevance retrieval and retention presets | ✅ Built |
| Explicit untracked-file workspace review/application | ✅ Built |
| Replay seeking and timeline controls | ✅ Built |
| Replay bookmarks and event-type filters | ✅ Built |
| Optional OpenAI embedding memory retrieval with local fallback | ✅ Built; opt-in |
| Text preview and binary classification for new workspace files | ✅ Built |
| Duplicate-role removal with validated dependency rewiring | ✅ Built; approval-gated |
| Persistent local embedding cache | ✅ Built; user-scoped |
| Persistent replay bookmarks per user/session | ✅ Built |
| Bounded PNG/JPEG/GIF/WebP preview metadata | ✅ Built |
| Configurable supervisor proposal policies and history | ✅ Built |
| Bounded embedding-cache retention and metrics | ✅ Built |
| Labeled private/shared replay bookmarks | ✅ Built |
| Proposal comparison and restore previews | ✅ Built; approval-gated |
| Dashboard embedding-cache metrics | ✅ Built |
| Previous/next bookmark navigation | ✅ Built |
| Large-graph proposal diff details | ✅ Built |
| In-place bookmark editing | ✅ Built |
| Content-free embedding cache hit telemetry | ✅ Built |
| Purposeful planning/focus/collaboration/lounge zones | ✅ Built; shared across web and VS Code |
| Agent-state-driven zone movement and micro-animation | ✅ Built; replay-aware |
| Live zone occupancy and active pair-work signals | ✅ Built from workflow state |
| Autonomous supervisor workflow mutation | 🧭 Not enabled |

## Product direction

The goal is not simply to display agents in an office.

The visual environment is an **observability surface for the workflow**: agent runtime states now move workers among planning, focus, collaboration, and lounge zones; active workflow relationships and mailbox deliveries are animated; and live/replay occupancy is visible in both the map and activity panel. Detailed outputs, cost, failures, and execution history remain available through the existing operator panels and replay controls.

That direction is captured in the [coworking-space roadmap](docs/coworking-space-roadmap.md), which explores zone-aware agent behavior, collaboration states, session analytics, workflow-aware placement, and shared visual concepts across the web app and VS Code extension.

## Roadmap

The agreed architecture foundation is implemented. The current priority is release stability: preserving API workflow compatibility, validating migrations, maintaining user isolation, and fixing verified defects.

No additional feature batch is implicitly committed here. Future work should begin from a concrete user need or tracked issue rather than extending this roadmap automatically. Autonomous workflow mutation and general untrusted binary rendering remain deliberately disabled safety boundaries.

## Why OrbiAgents

OrbiAgents is built around a workflow-first idea:

> **Design the AI team, define how it works, watch it execute, inspect exactly what happened, and improve the workflow.**

Rather than hiding orchestration behind a chat window, OrbiAgents makes the workflow itself visible and inspectable.

## Security notes

- Keep provider API keys server-side and out of source control
- Do not commit `server/.env`
- Use a strong production `JWT_SECRET`
- Protected endpoints require authentication
- User workflows and sessions are scoped by user ID
- WebSocket connections require a valid token
- Browser WebSocket tokens are sent as a subprotocol instead of being placed in URLs; legacy query-token clients remain accepted for compatibility
- Request logs omit query strings so credentials and share parameters are not retained accidentally
- Known package advisories are checked independently in the root, server, web, extension, and extension-webview lockfiles
- Configure rate limits and usage caps for the deployment environment
- Treat public replay links as shareable access to the associated replay
- Desktop security, accessibility, and renderer budget gates are available as `pnpm desktop:check:security`, `pnpm desktop:check:accessibility`, and `pnpm desktop:check:performance`

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a focused feature branch
3. Make and test your changes
4. Open a pull request with the problem, approach, and validation clearly described

## Inspiration and credits

The coworking-space presentation and its animated sense of agent activity were inspired in part by **Munder** and by the pixel-art environment work of **LimeZu**. Thank you to their creators for demonstrating how a shared virtual workspace can make collaboration feel understandable and alive.

OrbiAgents' current interface, animations, and visual assets are original implementations. No Munder or LimeZu artwork, source assets, branding, or other third-party files are included in this repository. Their respective projects and assets remain subject to their own license terms.

## License

MIT License. See [LICENSE](LICENSE).

## Project links

- [GitHub Issues](https://github.com/SUDARSHANCHAUDHARI/OrbiAgents/issues)
- [Coworking Space Roadmap](docs/coworking-space-roadmap.md)

---

<div align="center">

Built by [SUDARSHANCHAUDHARI](https://github.com/SUDARSHANCHAUDHARI)

</div>

---

## About

I'm Sudarshan Chaudhari, a Senior Quality Engineer, Test Automation specialist, and AI systems builder based in Bangkok, Thailand.

I have 13+ years of experience in software quality engineering, working across SaaS, fintech, gaming, web, mobile, cloud, and digital signage platforms. My background combines hands-on test automation with QA leadership, test strategy, CI/CD, release quality, production investigation, and cross-platform validation.

Alongside my professional QA career, I run [SudarshanTechLabs](https://sudarshantechlabs.com/), my independent engineering and product lab where I design, build, test, and ship software across Android, web, AI, cybersecurity, developer tooling, and cross-platform applications.

### What I work on

- ⚙️ **Quality Engineering & Test Automation** — Playwright, Selenium, Cypress, Appium, API testing, automation frameworks, end-to-end testing, CI/CD, release gates, GitHub Actions, risk-based testing, and production validation
- 🤖 **AI Systems & Automation** — AI agents, multi-agent orchestration, MCP servers, AI-assisted QA, prompt tooling, developer workflows, automation systems, and Claude Code plugins
- 📱 **Mobile & Cross-Platform Applications** — Android applications built with Kotlin and Jetpack Compose, Google Play releases, automated build and publishing pipelines, and cross-platform development spanning iOS, web, Windows, and macOS
- 🌐 **Web Applications & Platforms** — Full-stack applications using Next.js, TypeScript, Firebase, Cloudflare, REST APIs, and modern web infrastructure
- 🛠️ **Developer Tooling & CLI Engineering** — Rust, Python, TypeScript, CLI utilities, multi-repository tooling, build automation, release tooling, and engineering productivity systems
- 🛡️ **Cybersecurity & Observability** — Threat detection, log analysis, security auditing, vulnerability assessment, monitoring, and security-focused developer tools
- 📺 **Digital Signage & Device Platforms** — Content validation, playback testing, device compatibility, production investigation, monitoring, and QA across diverse hardware and operating-system environments

My work sits at the intersection of quality engineering, automation, AI, and software development. I approach products with a QA mindset from the beginning: understanding failure modes, designing for testability, automating repetitive work, and building release confidence into the engineering process.

Through SudarshanTechLabs, I also build products and tools from idea to production, covering architecture, development, testing, CI/CD, release automation, monitoring, and ongoing maintenance.

🌐 [sudarshantechlabs.com](https://sudarshantechlabs.com/) · 💼 [LinkedIn](https://linkedin.com/in/sudarshan-chaudhari) · 🐙 [GitHub](https://github.com/SUDARSHANCHAUDHARI) · ✉️ [sunny.sudarshan@gmail.com](mailto:sunny.sudarshan@gmail.com)
