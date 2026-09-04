import 'pixi.js/unsafe-eval';
import { Application, Texture, ImageSource, BufferImageSource, Ticker } from 'pixi.js';
import { TiledMapRenderer } from '../src/renderer/src/scene/office/TiledMapRenderer.ts';
import { Camera } from '../src/renderer/src/scene/office/Camera.ts';
import { createRoomRenderer } from '../theme/roomRenderer.mjs';
import manifest from '../art/manifest.json';
import creditsUrl from '../art/lpc-office/Credits.txt?url';
import './style.css';
import { createDemoWorkers } from './workers.mjs';

const assetUrls = import.meta.glob('../art/lpc-office/*.png', { eager: true, query: '?url', import: 'default' });
const host = document.querySelector('#room');
const status = document.querySelector('#status');
const fit = document.querySelector('#fit');
const motion = document.querySelector('#motion');
let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelector('#credits').href = creditsUrl;
const abort = new AbortController();
const textures = new Map();
const bitmaps = [];
const app = new Application();
let scene, workers, observer, initialized = false, disposed = false;
function dispose() {
  if (disposed) return;
  disposed = true;
  abort.abort(); observer?.disconnect();
  fit.disabled = true;
  motion.disabled = true;
  workers?.dispose();
  scene?.dispose();
  if (initialized) app.destroy(true, { children: true });
  for (const texture of textures.values()) texture.destroy(true);
  for (const bitmap of bitmaps) bitmap.close();
}
window.addEventListener('pagehide', dispose, { once: true });
try {
  await app.init({ background: '#0e1720', antialias: false, preference: 'webgl',
    width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight),
    resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
  initialized = true;
  if (disposed) { app.destroy(true); throw new DOMException('Closed', 'AbortError'); }
  for (const entry of manifest.entries.filter(e => e.path.endsWith('.png'))) {
    const url = assetUrls[`../${entry.path}`];
    if (!url) throw new Error('Local artwork is missing from the build');
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) throw new Error('Local artwork could not be loaded');
    const bitmap = await createImageBitmap(await response.blob());
    if (disposed) { bitmap.close(); throw new DOMException('Closed', 'AbortError'); }
    bitmaps.push(bitmap);
    textures.set(entry.path, new Texture({ source: new ImageSource({ resource: bitmap, scaleMode: 'nearest' }) }));
  }
  scene = createRoomRenderer({ Texture, BufferImageSource }, TiledMapRenderer, manifest.entries, textures);
  app.stage.addChild(scene.renderer.getContainer());
  app.canvas.setAttribute('role', 'img');
  app.canvas.setAttribute('aria-label', 'Office with three simulated robot workers. Demo animations, not live agents.');
  host.appendChild(app.canvas);
  const camera = new Camera(scene.renderer.getContainer());
  camera.setMapSize(scene.renderer.width * 16, scene.renderer.height * 16);
  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    app.renderer.resize(width, height); camera.setViewSize(width, height);
  };
  resize();
  // Settle the initial fit before displaying the first frame.
  for (let i = 0; i < 180; i++) camera.update(0);
  workers = createDemoWorkers(scene, paused);
  app.ticker.add(ticker => {
    camera.update(ticker.deltaMS / 1000);
    if (!paused) workers.update(ticker.deltaMS / 1000);
  });
  const syncMotion = () => {
    motion.textContent = paused ? 'Play demo' : 'Pause demo';
    motion.setAttribute('aria-pressed', String(!paused));
    if (paused) Ticker.shared.stop(); else Ticker.shared.start();
  };
  syncMotion();
  motion.addEventListener('click', () => { paused = !paused; syncMotion(); }, { signal: abort.signal });
  motion.disabled = false;
  observer = new ResizeObserver(resize); observer.observe(host);
  fit.addEventListener('click', () => camera.fitToScreen(), { signal: abort.signal });
  fit.disabled = false;
  status.textContent = 'Demo only: three original robot workers walk to desks and take coffee breaks. No live agents.';
} catch (error) {
  dispose();
  if (error?.name !== 'AbortError') {
    status.setAttribute('role', 'alert');
    status.textContent = 'Room could not load. Check local asset availability and WebGL support, then reload.';
    console.error('Room preview initialization failed', error);
  }
}
