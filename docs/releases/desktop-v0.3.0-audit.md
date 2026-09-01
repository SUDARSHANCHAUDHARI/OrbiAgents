# OrbiAgents Desktop v0.3.0 final audit

Date: 2026-08-29

Scope: M6 desktop security, accessibility, performance, documentation, and macOS packaging readiness. This report records code/build evidence; it does not certify signed distribution or manual assistive-technology behavior.

## Dependency advisory update — 2026-08-30

The zero-advisory statements below record the registry result on the original audit date and are no longer the current dependency status. `electron-vite` is now 3.1.0, removing vulnerable esbuild 0.21.5 and resolving GHSA-67mh-4wv8-2f99. One high advisory remains: Electron transitively installs `extract-zip` 2.0.1, affected by GHSA-jmr9-qjv8-65gv. The registry reports no patched `extract-zip` release, and current Electron 44.0.0 still declares the affected dependency range. This upstream blocker remains visible and unsuppressed.

## Security

Resolved hardening findings:

- Explicitly disable Electron webview tags.
- Deny all Electron permission requests in addition to denying new windows and navigation.
- Extend renderer CSP with `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, and `frame-src 'none'`.
- Pin the transitive DOMPurify dependency to 3.4.13 after production advisory review.

Repeatable checks enforce context isolation, sandboxing, disabled Node integration/webviews, navigation/window/permission denial, CSP restrictions, trusted-sender checks on all 39 IPC handlers, no unsafe evaluation, no shell-enabled child process, non-publishing package scripts, and required production code signing. The production dependency audit reports no known vulnerabilities. No known high- or critical-severity finding remains in the audited desktop scope.

Secrets and signing material are excluded from package inputs and must not be committed. Production preflight intentionally fails without branded icon/signing/notarization inputs; unsigned artifacts are local QA outputs only.

## Accessibility

Resolved findings:

- Add explicit accessible names to compact launch, settings, filter, selector, and checkbox controls.
- Expose first-run onboarding as a labelled modal dialog and make the background header/workspace inert while it is active.
- Add visible global keyboard focus styling.
- Enable xterm screen-reader mode and disable terminal cursor blinking when reduced motion is requested.
- Label Monaco editor and diff surfaces.
- Label office zoom controls and retain the keyboard-accessible DOM agent list as the alternative to the `aria-hidden` canvas.

The source gate passes 18 renderer components and 26 named form controls. Verified contrast ratios for the audited text palette range from 5.55:1 to 16.15:1 against their configured backgrounds, above the 4.5:1 normal-text target.

Limitations: no browser automation, live screen-reader traversal, screenshot, recording, or captured desktop session was used. Manual VoiceOver, keyboard-only, zoom/reflow, and real packaged-app acceptance remains required before public distribution.

## Performance

Production build measurements:

| Asset | Raw | Gzip |
|---|---:|---:|
| Initial renderer entry, baseline | 1,877,594 B | 381,578 B |
| Initial renderer entry, audited | 600,610 B | 108,648 B |
| Renderer CSS, original audit | 19,481 B | 5,278 B |

The post-audit grouped Command Center, installed-skills catalog, and three locale-specific bundled font declarations are constrained by a 35,000-byte raw / 10,000-byte gzip CSS ceiling. Current measurements are emitted by `check-renderer-budget.mjs`; the original audit measurement above remains historical evidence rather than a current bundle claim.

The initial entry is 68.0% smaller raw and 71.5% smaller gzip. Monaco, xterm, and PixiJS were moved behind React lazy boundaries. The enforced entry budgets are 700,000 bytes raw and 130,000 bytes gzip; CSS budgets are 30,000 and 10,000 bytes. File editor, terminal, and office chunks must remain separately emitted.

The Floor is the default view, so the PixiJS chunk starts after shell rendering. These numbers demonstrate reduced entry parsing/bootstrap cost, not a claim that the entire default-view transfer is only the entry size. Runtime CPU/memory profiling remains a manual packaged-app acceptance item.

## Release decision

The implementation and static hardening portion of M6 is complete. Public macOS release is not approved yet. It remains blocked on accepted branded icon artwork, Developer ID signing credentials, successful notarization/Gatekeeper/stapler verification, clean-account install and upgrade checks, manual accessibility review, and real locally authenticated CLI acceptance. Windows and Linux remain deferred until macOS acceptance passes.

## Final verification

- Desktop tests: 106 passed, 0 failed.
- Strict desktop TypeScript checks: node and renderer passed.
- Security, accessibility, and renderer budget gates: passed.
- Production desktop build: passed.
- Production dependency audit: no known vulnerabilities found.
- Unsigned arm64 app/DMG/ZIP package verifier: passed; app bundle contains 233 files and occupies 362 MB on disk.
- DMG: 126,838,718 bytes, SHA-256 `bca88e2ade1b335039fe05eecde0135f6468a6501a15623085e2e4767554b7c8`.
- ZIP: 126,888,326 bytes, SHA-256 `a3bc79857c4d2e628ce7fa43340c9e100ba946116973a01ca8032293157ce954`.
- Production release preflight: expected failure because `desktop/build/icon.icns` is intentionally absent until accepted artwork is supplied.
- Diff whitespace check: passed. The filename-only signing/secret scan found only the three committed `.env.example` templates; generated package verification also found no secret-like paths.
