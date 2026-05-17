# OrbiAgents 🤖🌐

**Design multi-agent AI systems from a single goal — get a complete agent network blueprint with roles, tools, workflow steps, and implementation code.**

Describe what you want your agent system to accomplish, pick a framework, and get a full multi-agent architecture: system name, overview, per-agent cards (name, role, tools, responsibilities), a numbered workflow, and a collapsible implementation code block in your chosen framework.

---

## 🌟 Features

### 🤖 Core Features
- ✅ **Goal Input** — describe the system goal in natural language
- ✅ **Framework Selector** — CrewAI, AutoGen, LangGraph, Custom, OpenAI Swarm
- ✅ **System Name + Overview** — AI-generated name and one-paragraph system description
- ✅ **Agent Cards Grid** — 2-column grid of agent cards
- ✅ **Per-Agent Detail** — name, role, tools list, responsibilities list
- ✅ **Workflow Steps** — numbered sequential workflow with circle step indicators
- ✅ **Implementation Code** — collapsible code block in the selected framework
- ✅ **Show/Hide Code** — toggle code visibility

### 🤖 AI Features
- ✅ **Claude Sonnet 4.6** — designs optimal agent decomposition for the stated goal
- ✅ **Framework-native code** — CrewAI output differs from AutoGen and LangGraph
- ✅ **Role specialization** — agents get distinct, non-overlapping responsibilities
- ✅ **Tool assignment** — each agent gets appropriate tools for its role
- ✅ **Workflow sequencing** — steps reflect realistic agent handoff patterns

### ⚙️ Technical Features
- ✅ **Next.js 15 App Router** — server + client components
- ✅ **TypeScript strict mode** — fully typed agent and result interfaces
- ✅ **Tailwind CSS** — dark violet theme with agent card grid

---

## 🏗️ Architecture

```
OrbiAgents/
├── 📁 app/
│   ├── 📄 page.tsx          # Main UI — goal input + agent system blueprint
│   ├── 📄 layout.tsx        # Root layout with dark background
│   ├── 📄 globals.css       # Global styles
│   └── 📁 api/
│       └── 📁 design/
│           └── 📄 route.ts  # POST /api/design — Claude agent system designer
├── 📁 public/               # Static assets
├── 📄 .env.example          # Environment variable template
├── 📄 package.json
└── 📄 README.md
```

---

## 🖥️ UI Overview

| Section | Description |
|---|---|
| **Goal Textarea** | Describe the multi-agent system goal (28-row textarea) |
| **Framework Chips** | CrewAI / AutoGen / LangGraph / Custom / OpenAI Swarm |
| **Design Agent System** | Triggers Claude system design |
| **System Name** | AI-generated system name |
| **Overview** | One-paragraph system description |
| **Agent Cards** | 2-column grid: name, role, tools chips, responsibilities list |
| **Workflow Steps** | Numbered steps with violet circle indicators |
| **Implementation Code** | Collapsible — Show/Hide toggle |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SUDARSHANCHAUDHARI/OrbiAgents.git
   cd OrbiAgents
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your ANTHROPIC_API_KEY
   ```

4. **Run dev server**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

---

## 📜 Scripts

```bash
pnpm dev      # Start development server (Turbopack)
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # ESLint check
```

---

## 🔑 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | ✅ Yes |

Get your key at [console.anthropic.com](https://console.anthropic.com). Add it to `.env.local` — this file is gitignored and never committed.

---

## 📊 Current Status

| Property | Value |
|---|---|
| **Version** | 1.0.0 |
| **Status** | ✅ MVP Complete |
| **Model** | claude-sonnet-4-6 |
| **Frameworks** | 5 (CrewAI, AutoGen, LangGraph, Custom, OpenAI Swarm) |

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS |
| **AI** | Claude API — claude-sonnet-4-6 |
| **Package Manager** | pnpm |

---

## 🔒 Security

- `ANTHROPIC_API_KEY` lives in `.env.local` — gitignored, never committed
- `.env.example` contains placeholder values only
- API key sent directly to Anthropic — no intermediate server
- Goal input not stored or logged server-side

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feat/your-feature`)
5. Open a Pull Request

---

## 📞 Support

- 🐛 Issues: [GitHub Issues](https://github.com/SUDARSHANCHAUDHARI/OrbiAgents/issues)

---

<div align="center">

**Made with ❤️ by [SUDARSHANCHAUDHARI](https://github.com/SUDARSHANCHAUDHARI)**

[⭐ Star this repo](https://github.com/SUDARSHANCHAUDHARI/OrbiAgents) · [🐛 Report Issue](https://github.com/SUDARSHANCHAUDHARI/OrbiAgents/issues)

</div>
