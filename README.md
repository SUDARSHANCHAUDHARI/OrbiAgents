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
├── server/        # Express + WebSocket server
├── web/           # Next.js frontend
└── shared/        # Shared type definitions
```

## Run locally

**Terminal 1 — Backend**
```bash
cd server
pnpm install
pnpm dev
```

**Terminal 2 — Frontend**
```bash
cd web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

- Real-time agent state updates via WebSocket
- Click agent → side panel with task, tokens used, last action
- Pause / Resume any agent from the UI
- Dot-grid office floor layout

## Author

**SudarshanTechLabs** — [@SUDARSHANCHAUDHARI](https://github.com/SUDARSHANCHAUDHARI)

## License

MIT
