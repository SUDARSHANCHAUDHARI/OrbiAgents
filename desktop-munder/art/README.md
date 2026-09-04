# Replacement office artwork

The `lpc-office/` files are unmodified selections from **LPC Revised — The Office**, by **Eliza Wyatt and Lanea Zimmerman (Sharm)**. Their original per-file credits are preserved in `lpc-office/Credits.txt`.

- Source: https://opengameart.org/content/lpc-revised-the-office
- License: **OGA-BY 3.0**, https://static.opengameart.org/OGA-BY-3.0.txt
- File hashes and original image dimensions: `manifest.json`.
- Modifications: none; selection only. Portraits and shopping-cart artwork were omitted.

This bundle contains office props, not a finished scene or worker sprite sheet. It is not wired into the renderer yet. Atlas crops, scale, collision footprints and animation frames must be authored and validated before use. Retain this attribution and the original credits when distributing the application; document subsequent image modifications.

`theme/lpcTextures.mjs` now provides the 32px-source to 16px-world scale adapter and non-overlapping Tiled GIDs (starting at 257, reserving lower IDs for original structure). It changes Pixi texture resolution, not image bytes. Supply dedicated full-sheet textures before creating subtextures, then pass the returned tileset metadata and prepared textures to the upstream map renderer in matching order. Actual furniture stamps, visual layers and theme registration remain pending.

Run `node --test desktop-munder/tools/*.test.mjs` from the repo root. Texture tests use the existing installed `desktop/` Pixi dependency; run the normal desktop dependency setup first. They check texture geometry/UVs without launching Electron or claiming visual acceptance.

Import is reproducible with `node tools/import-office-art.mjs <archive-path>` from the migration package, before the destination exists. The importer accepts only the recorded archive SHA-256 and explicit filenames. It never performs unrestricted archive extraction.
