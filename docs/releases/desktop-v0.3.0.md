# OrbiAgents Desktop v0.3.0 release candidate

Status: branded icon and unsigned local package verified; public release blocked on Developer ID signing, notarization, and manual acceptance.

## Highlights

- Sandboxed Electron command center with fixed typed preload operations and no renderer Node.js access.
- Built-in Codex, Claude, and Gemini CLI agents plus operator-allowlisted custom adapters.
- Real PTY terminals, normalized runtime activity, isolated Git worktrees, file/history review, and guarded Monaco editing.
- Orbi-Prime durable tasks, mailboxes, approvals, memory, scheduled missions, and local GitHub issue/Actions ingestion.
- First-run prerequisite checks and reusable Setup view.
- Verified migration backups and rollback, observational startup recovery, and a checksum-chained idempotent ledger of authorized cost estimates.
- Recovery and Costs Command Center views with explicit integrity and non-billing language.
- Apple-silicon DMG, ZIP, and app packaging with ASAR, Electron ABI rebuilds, and verified arm64 `node-pty` placement.

## Security and operator controls

- Context isolation, renderer sandboxing, navigation blocking, fixed trusted-sender IPC, bounded validation, no shell-based runtime invocation, and OS-backed local credential encryption.
- Renderer Node integration and webview tags are disabled; new windows, navigation, and permission requests are denied; CSP blocks objects, frames, forms, and base-URL rewriting.
- Scheduled work cannot execute without a matching operator spend approval.
- Recovery never restarts commands or decides approvals automatically.
- Package rules exclude secret-like paths and project/user state; packaging never publishes implicitly.
- Production packaging is configured to fail without code signing and to require post-build Developer ID, Gatekeeper, and stapler validation.

## Known release gates

- The verified local artifacts are unsigned. They are not public release artifacts.
- Original branded artwork is committed as a 1024×1024 source and ICNS container; final artwork acceptance remains part of manual release review.
- Signed/notarized verification and clean-account installation have not yet been performed.
- Update checks and installation are not implemented.
- Intel, universal, Windows, Linux, and Mac App Store packages are outside this release candidate.
- Live CLI/provider acceptance requires locally authenticated tools and remains manual.
- Manual keyboard and screen-reader acceptance remains required; the completed audit is source/build based and does not claim assistive-technology certification.

## Final audit measurements

- Security source gate: 39 IPC handlers require trusted senders; Electron isolation, navigation, permission, CSP, and release-signing constraints pass.
- Accessibility source gate: 18 renderer components and 26 form controls pass naming/semantic checks; onboarding modality, focus visibility, reduced motion, terminal screen-reader mode, Monaco labels, and canvas alternatives are present.
- Renderer entry JavaScript: 600,610 bytes raw / 108,648 gzip, reduced from 1,877,594 raw / 381,578 gzip. PixiJS, xterm, and Monaco are separate lazy chunks. Because Floor is the default view, its PixiJS chunk begins loading after shell startup; the measurement describes the entry/bootstrap reduction, not a claim that all startup transfer is 600,610 bytes.
- Renderer CSS: 19,481 bytes raw / 5,278 gzip.
- Detailed evidence and limitations: `docs/releases/desktop-v0.3.0-audit.md`.

## Verified local artifacts

- `desktop/release/mac-arm64/OrbiAgents.app`
- `desktop/release/OrbiAgents-0.3.0-arm64.dmg`
- `desktop/release/OrbiAgents-0.3.0-arm64.zip`

These paths are generated and Git-ignored. Rebuild them with `pnpm --dir desktop package:mac:unsigned`; do not upload the unsigned outputs.
