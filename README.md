# OrbiAgents

AI Agent Control Center — monitor, visualize, and control AI agents in real time.

## What it is

OrbiAgents is a full-stack real-time dashboard that shows your AI agents as live characters in a pixel office. Click any agent to inspect its current task, token usage, and last action. Pause or resume agents from the UI.

Built as the foundation for a larger AI agent observability platform.

## Tech

- **Frontend** — Next.js 14 (App Router) + Tailwind CSS
- **Backend** — Node.js + Express + WebSocket (`ws`)
- **Language** — TypeScript throughout

## Project Structure

```
orbiagents/
├── docs/          # Roadmaps and project notes
├── extension/     # VS Code extension surface
├── server/        # Express + WebSocket server
├── shared/        # Shared engine/types/sprites
└── web/           # Next.js frontend
```

## Run locally

**Terminal 1 — Backend**
```bash
cd server
pnpm install
cp .env.example .env
pnpm dev
```

**Terminal 2 — Frontend**
```bash
cd web
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

Containerized launch is included.

1. Set production values for `JWT_SECRET`, `APP_URL`, `CORS_ORIGIN`, and at least one provider API key.
2. Build and run:

```bash
docker compose -f docker-compose.prod.yml up --build
```

3. Verify health:

```bash
curl http://localhost:4000/health
```

## Environment

`server/.env`
- `APP_URL` — public web app URL used for share links
- `CORS_ORIGIN` — allowed frontend origin for API requests
- `JWT_SECRET` — required outside local dev
- `DEFAULT_PROVIDER` — `anthropic`, `openai`, or `gemini`
- `RATE_LIMIT_AUTH_MAX` — auth requests per minute per user/IP bucket
- `RATE_LIMIT_WORKFLOW_MAX` — workflow start requests per minute per user/IP bucket
- `MAX_RUNS_PER_HOUR` — per-user run guardrail
- `MAX_DAILY_COST_USD` — per-user daily spend cap based on stored session cost
- `MAX_WORKFLOW_NODES` — maximum allowed workflow size

`web/.env.local`
- `NEXT_PUBLIC_API_BASE_URL` — backend base URL
- `NEXT_PUBLIC_WS_BASE_URL` — backend WebSocket base URL

## Launch Checklist

- Set a strong production `JWT_SECRET`
- Configure at least one AI provider key
- Confirm `APP_URL` and `CORS_ORIGIN` match your deployed frontend
- Run server migrations before exposing traffic
- Check `GET /health`
- Ensure CI is green before shipping

## Features

### Core
- Real-time agent state updates via WebSocket
- Click agent → side panel with task, tokens used, last action, live log stream
- Pause / Resume any agent from the UI
- Stop an active workflow from the dashboard
- Pixel office floor with animated agent sprites and pathfinding
- Dynamic workflow builder (drag-and-drop DAG)
- Layout editor for custom office furniture
- **Keyboard shortcuts**: `R` run, `S` stop, `Space` pause/resume selected agent, `Esc` close panel, `L` toggle log panel

### Cost & Budget
- Pre-run cost estimate shown next to the Run button (updates live as you type)
- Daily budget progress bar below the header — green → amber → red as spend approaches limit
- `GET /usage` endpoint returns daily spend, hourly run count, and their caps
- Per-session and per-agent cost breakdown in session details

### Session History & Replay
- Full session history with searchable task list
- Filter sessions by provider (Anthropic / OpenAI / Gemini) and max cost
- Cost trend sparkline and total-spent summary across all sessions
- Per-session cost bar showing relative spend at a glance
- Replay any session frame-by-frame with **0.5× / 1× / 2× / 4× speed control**
- Session details panel: per-agent token breakdown, input/output counts, cost
- **Token heatmap** in session details — agent × time grid coloured by token generation rate
- Export any session as **JSON** (full frame data) or **CSV** (flat agent-per-frame table)

### Sharing
- One-click share link — generates a public replay URL requiring no login
- Share modal displays the full URL with an animated copy button

### Alerts
- Browser notifications when an agent enters an error/debugging state or a workflow fails
- Configurable webhook URL (Slack, Discord, or any HTTP endpoint) for external alerts
- Alert settings accessible from the dashboard header (`🔔 ALERTS` button)

### Multi-agent Observability
- Sub-agent dependency graph: amber bezier lines drawn from parent → child agents in real time
- Workflow edge overlay: blue dashed lines show the configured node execution order
- **Aggregated live log panel** (`≡ LOGS` button or `L`): all agents' log output in a single timestamped stream

### Workflow Builder
- **Built-in templates**: Plan+Code, Plan+Code+Test, Full Pipeline (Plan→Code→Test→Review), Debug Pipeline, Review Only
- Save / load / update named workflows per user account
- Cycle-detection prevents invalid DAGs

## Ops

- `GET /health` returns a lightweight health payload for uptime checks
- `GET /usage` (authenticated) returns daily cost, hourly run count, and guardrail limits
- Server request logs include route, status code, duration, and user context

## Author

**SudarshanTechLabs** — [@SUDARSHANCHAUDHARI](https://github.com/SUDARSHANCHAUDHARI)

## License

MIT
