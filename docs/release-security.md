# Release security baseline

OrbiAgents maintains five independent pnpm lockfiles: the root design application, API server, main web dashboard, VS Code extension, and extension webview. Release checks must audit each tree separately; auditing only the repository root does not cover the shipped server, dashboard, or extension.

All five first-party package manifests use the repository release version. Internal packages remain independently installed and locked; matching version metadata does not turn them into a publishable workspace or change their deployment boundaries.

## Dependency baseline

The August 2026 hardening pass moved every affected package to a patched, compatibility-tested line:

| Surface | Security-relevant baseline |
|---|---|
| Root application | Next.js 16.2.11, PostCSS 8.5.26, Nano ID 3.3.18, Sharp 0.35.3 |
| API server | Anthropic SDK 0.91.1, Express 4.22.1, WebSocket 8.21.3, body-parser 1.20.6, qs 6.15.2 |
| Web dashboard | Next.js 15.5.21, React 19.2.8, PostCSS 8.5.26, Nano ID 3.3.18, Sharp 0.35.3 |
| VS Code extension | esbuild 0.28.2 |
| Extension webview | Vite 6.4.3, esbuild 0.25.12, PostCSS 8.5.26, Nano ID 3.3.18, Babel 7.29.7 |

Overrides are deliberately narrow and exist only where a framework's compatible dependency range otherwise resolves to a vulnerable transitive version. Major upgrades to Prisma, Express, TypeScript, Tailwind, or the extension runtime are not bundled into security maintenance without a separate compatibility requirement.

## Application protections

- JWT verification accepts HS256 tokens with a non-empty string subject.
- Production startup rejects the development JWT secret.
- Authentication and workflow limits use server-resolved client addresses. Forwarded headers are trusted only when `TRUST_PROXY=true` explicitly configures one proxy hop.
- Request logs omit query strings.
- Browser WebSocket authentication uses the subprotocol header rather than a URL query parameter. Query-token authentication remains temporarily supported for existing clients.
- API responses set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: DENY`.
- Local CLI processes remain allowlisted, shell-free, abortable, output-bounded, and worktree-isolated.

## Release verification

Before release, run `pnpm audit --json` in all five package roots, then run the server and web tests, TypeScript checks, production builds, Prisma generation/migration status, and the VS Code extension build. A zero-advisory result describes the registry state at audit time; newly published advisories require a fresh audit.
