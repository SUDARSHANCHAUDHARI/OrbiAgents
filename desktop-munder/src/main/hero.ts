/** Local Settings identity payload. The IPC shape remains stable for callers
 * while product copy stays compiled-in, deterministic, and offline. */
import { DEFAULT_HERO, type HeroPayload } from '../shared/heroPayload';

export async function loadHero(
  _cachePath: string,
  _opts: { force?: boolean } = {}
): Promise<{ hero: HeroPayload; fetchedAt: number; stale: boolean }> {
  return { hero: DEFAULT_HERO, fetchedAt: 0, stale: false };
}
