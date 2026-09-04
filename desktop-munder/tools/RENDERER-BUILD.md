# Isolated renderer build

This builds the actual renderer, not Electron main/preload or a distributable app.
No dev server, provider or app process is started. The normal migration commands
remain blocked. Existing `desktop/` dependencies supply Vite; the renderer uses
the separate dependency set below. Full typechecking is not part of this command.

From the repository root, prepare a fresh temporary directory:

```sh
orbi_deps_dir=$(mktemp -d /private/tmp/orbi-renderer-deps.XXXXXX)
cp desktop-munder/tools/renderer-dependencies.json "$orbi_deps_dir/package.json"
cp desktop-munder/tools/renderer-dependencies.lock.json "$orbi_deps_dir/package-lock.json"
npm ci --ignore-scripts --no-fund --prefix "$orbi_deps_dir"
node desktop-munder/tools/build-renderer.mjs "$orbi_deps_dir"
```

Direct versions come from the pinned upstream lock. Main-process dependencies
(Electron, PTY, SQLite, updater, telemetry and tunnels) are excluded from the
direct manifest. The separate lock pins transitive resolution. Install scripts
must stay disabled. Do not copy these dependencies into the existing app.

Verified 2026-09-04: npm reported zero known vulnerabilities in this isolated
266-package audit. This is not a security audit or a clearance of repository-wide
dependency alerts. The renderer build succeeded with a roughly 6.4 MB minified
main chunk and mixed static/dynamic import warnings; performance remains pending.

Build output goes to a new temporary directory and includes source/font/art
notices. Approved PNG hashes are checked. Rendering and live behavior are not
verified by this build. Temporary directories are not removed automatically.
