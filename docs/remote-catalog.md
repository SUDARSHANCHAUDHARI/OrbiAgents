# Remote catalog format

OrbiAgents accepts remote catalogs only after an operator supplies an HTTPS manifest URL plus the expected publisher id, key id, and Ed25519 SPKI public key encoded as base64. Catalog review and skill installation are always explicit actions.

## Signed manifest

The manifest is strict JSON with `schemaVersion: 1`, a `publisher` containing only `id` and `keyId`, UTC `issuedAt` and `expiresAt` timestamps, up to 200 entries, and a base64 Ed25519 `signature`. Each entry contains only:

```json
{
  "id": "safe-review",
  "kind": "skill",
  "name": "Safe Review",
  "description": "Review changes safely",
  "version": "1.0.0",
  "artifactUrl": "https://catalog.example/safe-review.json",
  "sha256": "<lowercase hex SHA-256>",
  "size": 1234
}
```

Sign the UTF-8 bytes of the manifest without `signature`, using recursively sorted object keys, original array order, and compact JSON separators. The validity window cannot exceed 31 days. Artifact URLs must share the manifest origin.

## Skill package

Skill artifacts are bounded, text-only JSON packages. Binary files, archive links, permissions, and executable side effects are intentionally unsupported.

```json
{
  "schemaVersion": 1,
  "id": "safe-review",
  "name": "Safe Review",
  "description": "Review changes safely",
  "version": "1.0.0",
  "files": [
    {
      "path": "SKILL.md",
      "content": "---\nname: Safe Review\ndescription: Review changes safely\n---\n"
    }
  ]
}
```

The package metadata and root `SKILL.md` metadata must exactly match the signed catalog entry. Paths must be relative, contain no hidden or traversal segments, and stay within four levels. Packages allow at most 32 files, 256 KiB per file, and 4 MiB of decoded text. The signed entry also caps the complete artifact at 5 MiB.

After a fresh catalog review and operator confirmation, OrbiAgents downloads without redirects, verifies exact byte length and SHA-256, writes into a private temporary directory, records `.orbi-provenance.json`, and atomically renames the directory into managed app data. Installation never loads or executes package content.
