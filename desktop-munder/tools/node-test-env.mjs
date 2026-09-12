// Pixi performs browser-family detection while its CommonJS bundle loads.
// Tests exercise textures and scene objects under Node, so provide only the
// navigator field that import-time detection requires. Production never loads
// this module.
if (!('navigator' in globalThis)) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: Object.freeze({ userAgent: `Node.js/${process.versions.node}` }),
  });
}
