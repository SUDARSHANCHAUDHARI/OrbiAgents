# Replacement office artwork

The `lpc-office/` files are unmodified selections from **LPC Revised — The Office**, by **Eliza Wyatt and Lanea Zimmerman (Sharm)**. Their original per-file credits are preserved in `lpc-office/Credits.txt`.

- Source: https://opengameart.org/content/lpc-revised-the-office
- License: **OGA-BY 3.0**, https://static.opengameart.org/OGA-BY-3.0.txt
- File hashes and original image dimensions: `manifest.json`.
- Modifications: none; selection only. Portraits and shopping-cart artwork were omitted.

This bundle contains office props, not a finished scene or worker sprite sheet. It is not wired into the renderer yet. Atlas crops, scale, collision footprints and animation frames must be authored and validated before use. Retain this attribution and the original credits when distributing the application; document subsequent image modifications.

Import is reproducible with `node tools/import-office-art.mjs <archive-path>` from the migration package, before the destination exists. The importer accepts only the recorded archive SHA-256 and explicit filenames. It never performs unrestricted archive extraction.
