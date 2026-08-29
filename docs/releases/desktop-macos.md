# OrbiAgents Desktop macOS release runbook

## Current target

- Direct distribution outside the Mac App Store
- Apple silicon (`arm64`) only
- Bundle identifier: `com.sudarshantechlabs.orbiagents`
- Artifact formats: DMG for installation and ZIP for a future signed update feed
- Desktop version source: `desktop/package.json`

The web/server repository release remains separately versioned. Do not tag or publish a repository release solely because the desktop package builds.

## Credential-free local package

Run:

```bash
pnpm --dir desktop package:mac:unsigned
```

This command always passes `--publish never`, explicitly disables Developer ID signing and notarization, and verifies the generated app, DMG, and ZIP. Outputs are under `desktop/release/` and are ignored by Git. They are local QA artifacts, not public distribution artifacts; Gatekeeper distribution requires Developer ID signing and notarization.

The verifier checks the bundle identifier and version, arm64 application executable, ASAR entry points, secret-like paths, active and rebuilt arm64 `node-pty` binaries, artifact presence, and expected unsigned state.

## Production signing and notarization

Public direct distribution requires:

1. A branded 1024×1024 source icon converted to `desktop/build/icon.icns`.
2. Apple Developer Program membership and a Developer ID Application identity.
3. One notarization credential set supported by Electron Builder:
   - App Store Connect API key environment names (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`), or
   - Apple ID environment names (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), or
   - a pre-stored `notarytool` keychain profile named by `APPLE_KEYCHAIN_PROFILE`.
4. A signing identity available from the macOS keychain or `CSC_LINK` plus `CSC_KEY_PASSWORD`.

Never place credential values, `.p8`, `.p12`, or private keys in this repository. The release preflight checks presence only and does not print values.

Run:

```bash
pnpm --dir desktop package:mac:release
```

The production configuration has `forceCodeSigning: true`, Hardened Runtime, explicit Electron entitlements, and notarization enabled. It still passes `--publish never`. After packaging, the verifier requires all of the following to pass:

- strict deep `codesign` verification;
- a Developer ID Application authority;
- Gatekeeper assessment with `spctl`;
- stapled notarization ticket validation;
- the same bundle, ASAR, architecture, native-module, and artifact checks as the unsigned path.

Do not claim a signed or notarized release until this credential-backed command completes successfully on the exact artifacts intended for release.

## Updater design (not implemented)

The repository origin is GitHub, but no update provider or runtime updater is configured yet. `electron-updater` is intentionally not installed and no background check, download, or install occurs.

A future updater must satisfy these gates:

1. Only consume signed update metadata and Developer ID signed/notarized ZIP artifacts from an explicitly configured release provider.
2. Check on explicit operator action initially; do not poll silently.
3. Show version, release notes, artifact size, and signature/integrity state before download.
4. Never install while agents are running, approvals are pending, a scheduled run is claimed, or an isolated workspace awaits review.
5. Require explicit operator confirmation before restart/install and preserve the startup recovery inventory.
6. Retain the previous notarized installer and document manual rollback. Never perform an automatic schema downgrade.
7. Start with a pre-release channel and staged rollout; stable users must not receive preview builds.
8. Treat missing/invalid metadata, signature failure, downgrade attempts, or provider errors as non-destructive failures that leave the current version running.

Provider selection, release-channel policy, operator UX, and rollback acceptance must be agreed before adding `electron-updater`.

## Manual acceptance before publication

- Replace the default Electron icon with accepted branded artwork.
- Run the signed release command and retain its successful verifier output.
- Install from the DMG on a clean macOS user account.
- Launch through Finder and confirm Gatekeeper shows the verified developer without an override.
- Run onboarding, launch a real local CLI agent in a disposable repository, verify terminal input/output and `node-pty`, preserve/review an isolated worktree, and restart to inspect recovery.
- Confirm Costs, approvals, scheduled missions, local model credentials, and GitHub ingestion behave as documented.
- Confirm no secrets or user data exist in the mounted DMG, ZIP, app resources, or ASAR.
- Obtain explicit approval before tagging, pushing, publishing a GitHub release, or enabling update distribution.

References: [Electron Builder macOS signing](https://www.electron.build/code-signing-mac), [notarization](https://www.electron.build/notarize.html), and [auto update](https://www.electron.build/auto-update.html).
