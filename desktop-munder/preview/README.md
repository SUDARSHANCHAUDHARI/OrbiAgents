# Isolated room preview

This is a browser-only preview of the migration room, not the replacement app. It imports the actual upstream tile renderer and camera, loads the approved local PNGs, and fits the room to its viewport. No Electron main process, provider, telemetry client, or app-data store is imported.

From the repository root, with existing desktop dependencies installed:

```sh
node desktop-munder/tools/preview.mjs build
node desktop-munder/tools/preview.mjs serve
```

`build` writes to a newly created temporary directory and verifies that all 13 original PNGs plus Credits.txt are present byte-for-byte. `serve` builds first, then serves only that output at http://127.0.0.1:4174. It does not open a browser. Stop with Ctrl+C. No upstream dependencies or install scripts are executed.

The preview has loading/error status, resize-to-fit, a Fit room button, attribution links, and disposal of scene textures and image bitmaps. Three original robot designs now use the imported Character controller to walk to desks and take coffee breaks. These are explicitly simulated workers, not live agents. Play/Pause controls the demo; reduced-motion preference starts paused with workers at their desks. Remaining decorative/interactive props are pending. The migration's normal dev/build/start commands remain blocked.

Verification to date: production preview build and 14 migration tests pass. Tests cover original frame data, actual Character routes and cleanup, room geometry and Pixi scene-graph integration, not browser bitmap decoding, WebGL presentation or visual quality. Manual on-screen review is still required.
