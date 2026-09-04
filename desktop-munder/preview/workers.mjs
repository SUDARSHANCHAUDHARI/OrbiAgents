import { Texture, BufferImageSource } from 'pixi.js';
import { Character } from '../src/renderer/src/scene/office/Character.ts';
import { createWorkerTextures, WORKER_COLORS } from '../theme/workerArt.mjs';

export function createDemoWorkers(scene, reducedMotion = false) {
  const workers = [];
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const { actor, art } of workers) { actor.destroy(); art.dispose(); }
  }
  try {
    for (let i = 0; i < 3; i++) {
      const seat = scene.renderer.getSpawnPoint(scene.room.primarySeatNames[i * 6]);
      const art = createWorkerTextures({ Texture, BufferImageSource }, WORKER_COLORS[i]);
      let actor;
      try {
        actor = new Character({ agentId: `demo-robot-${i + 1}`, frames: art.frames,
          mapRenderer: scene.renderer, seatTile: seat,
          spawnTile: reducedMotion ? seat : { x: 22 + i, y: 29 },
          seatDirection: 'up', glowColor: WORKER_COLORS[i] });
      } catch (error) { art.dispose(); throw error; }
      workers.push({ actor, art, phase: 'desk', elapsed: -i * 4 });
      actor.show(scene.renderer.getCharacterContainer());
      actor.sitAtDesk(!reducedMotion);
      if (reducedMotion) actor.update(1);
    }
  } catch (error) { dispose(); throw error; }
  return {
    update(dt) {
      if (disposed) return;
      for (const worker of workers) {
        const { actor } = worker;
        actor.update(Math.min(dt, 0.05));
        if (worker.phase === 'desk' && actor.isSitting()) {
          worker.elapsed += Math.min(dt, 0.05);
          if (worker.elapsed >= 12) {
            worker.phase = 'walking'; worker.elapsed = 0;
            actor.walkToAndThen(scene.room.coffee.machineStand, () => {
              if (disposed) return;
              actor.setCarryingCup(true); actor.faceDirection('up'); worker.phase = 'coffee';
            });
          }
        } else if (worker.phase === 'coffee') {
          worker.elapsed += Math.min(dt, 0.05);
          if (worker.elapsed >= 4) {
            actor.setCarryingCup(false); actor.sitAtDesk(true);
            worker.phase = 'desk'; worker.elapsed = 0;
          }
        }
      }
    }, dispose,
  };
}
