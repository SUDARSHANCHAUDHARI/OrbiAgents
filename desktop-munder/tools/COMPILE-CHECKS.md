# Migration compile checks — not runtime clearance

From the repository root:

```sh
orbi_compile_dir=$(mktemp -d /private/tmp/orbi-compile-deps.XXXXXX)
cp desktop-munder/tools/compile-dependencies.json "$orbi_compile_dir/package.json"
cp desktop-munder/tools/compile-dependencies.lock.json "$orbi_compile_dir/package-lock.json"
npm ci --ignore-scripts --no-fund --prefix "$orbi_compile_dir"
node desktop-munder/tools/typecheck.mjs "$orbi_compile_dir" web
node desktop-munder/tools/typecheck.mjs "$orbi_compile_dir" node
node desktop-munder/tools/build-main.mjs
```

Do not enable install scripts or launch these dependencies. The isolated compile
environment includes pinned packages for their declarations only, with the
dependency remediation below applied to the original upstream set.
TypeScript/esbuild come from the existing desktop toolchain. Typechecks retain
the baseline strict settings and skipLibCheck setting, use isolated dependency
resolution, and emit no files. Vite client declarations are supplied for the web
check; the inactive electron-vite build-config type reference is not included.

Verified 2026-09-04: web (173 root files) and node (86 root files) typechecks pass.
Main/preload source bundles and the two required CJS sidecars emit to a fresh
temporary directory. Package imports remain external; native binaries, sidecar
execution, application startup and packaged assets have NOT been verified.

## Runtime blockers discovered

The original compile environment reported six high-severity package findings.
On 2026-09-05 the remediated install reports zero known vulnerabilities:

- Electron declarations move from 32.3.3 to 41.10.3, matching the version installed
  in the existing desktop app. This does not verify the migration under Electron.
- Unused localtunnel and its typings are removed. No references were found in the
  migration source or imported tests; the active Tunnelmole integration remains.
- Tunnelmole 2.4.0 has a scoped TOML 4.2.0 override. Its installed JS/TS files have
  no TOML references; the dependency is declared in its manifest. Patched parsing
  was checked with valid/invalid input and null-prototype output. The override is
  outside Tunnelmole's declared TOML 3.x range; live tunnel behavior remains untested.

Both typechecks and 37 migration tests pass with this change. No forced audit
upgrade was applied, and the inert upstream lock remains unchanged. Zero audit
findings do not establish security or clear repository-wide dependency alerts.
Do not adopt the compile manifest as a runtime manifest without native/runtime
verification.

posthog-node 5.48.2 also requires Node ^20.20.0 or >=22.22.0, while this check ran
with Node 22.14.0. It was not executed. This engine warning is another runtime
compatibility limitation, not a TypeScript failure.

The normal migration launch gate stays in place. No existing app data or desktop
dependencies are modified. Temporary dependency/build directories remain for
inspection and are not automatically deleted.
