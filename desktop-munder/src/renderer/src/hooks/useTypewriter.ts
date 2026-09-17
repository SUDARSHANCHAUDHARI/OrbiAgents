import { useEffect, useRef, useState } from 'react';

/**
 * Reveal `text` character by character.
 * `seed` resets the animation when it changes — pass a timestamp so identical
 * strings re-stream when the agent emits the same line twice.
 *
 * @param text  The full string to reveal.
 * @param seed  Any value; changing it restarts the typewriter.
 * @param cps   Characters per second. Default 90.
 */
export function useTypewriter(text: string, seed: unknown, cps = 90): {
  shown: string;
  done: boolean;
} {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const previousReducedMotion = useRef(reducedMotion);
  const previousText = useRef(text);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const wasReduced = previousReducedMotion.current;
    const sameText = previousText.current === text;
    previousReducedMotion.current = reducedMotion;
    previousText.current = text;
    if (!text) { setShown(''); setDone(true); return; }
    if (reducedMotion || (wasReduced && sameText)) {
      setShown(text);
      setDone(true);
      return;
    }
    setShown('');
    setDone(false);
    let i = 0;
    const intervalMs = Math.max(8, Math.floor(1000 / cps));
    const id = window.setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [text, seed, cps, reducedMotion]);

  return { shown, done };
}
