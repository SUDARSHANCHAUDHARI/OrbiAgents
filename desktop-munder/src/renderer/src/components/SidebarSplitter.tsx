import { useEffect, useRef, useState } from 'react';

export interface SidebarSplitterProps {
  /** Current sidebar width in px. */
  width: number;
  /** Called with the new width (already clamped externally). */
  onChange: (px: number) => void;
  /** Containing viewport width — used to clamp delta to a sane max. */
  viewportWidth: number;
  min?: number;
  max?: number;
}

/**
 * Vertical drag handle. Sits between the floor canvas (left) and the sidebar
 * (right). Drag left → wider sidebar. Cursor + pixel-stripe affordance.
 */
export function SidebarSplitter({
  width, onChange, viewportWidth, min = 320, max = 1200
}: SidebarSplitterProps) {
  const startRef = useRef<{ clientX: number; width: number } | null>(null);
  const [active, setActive] = useState(false);
  const clampMax = Math.min(max, Math.max(min, viewportWidth - 360));
  const splitterTitle = 'Drag to resize · double-click to reset';

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!startRef.current) return;
      const delta = startRef.current.clientX - e.clientX; // left drag = positive delta → grow sidebar
      const next = Math.min(clampMax, Math.max(min, startRef.current.width + delta));
      onChange(next);
    };
    const onUp = () => {
      startRef.current = null;
      setActive(false);
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    if (active) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'ew-resize';
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [active, viewportWidth, min, max, onChange]);

  return (
    <div
      role="separator"
      aria-label={splitterTitle}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={clampMax}
      aria-valuenow={width}
      tabIndex={0}
      onMouseDown={(e) => {
        startRef.current = { clientX: e.clientX, width };
        setActive(true);
        e.preventDefault();
      }}
      onKeyDown={(e) => {
        let next: number | null = null;
        if (e.key === 'ArrowLeft') next = Math.min(clampMax, width + 20);
        else if (e.key === 'ArrowRight') next = Math.max(min, width - 20);
        else if (e.key === 'Home') next = min;
        else if (e.key === 'End') next = clampMax;
        if (next === null) return;
        e.preventDefault();
        onChange(next);
      }}
      onDoubleClick={() => onChange(Math.min(clampMax, Math.max(min, 420)))}
      title={splitterTitle}
      style={{
        width: 10,
        cursor: 'ew-resize',
        flexShrink: 0,
        position: 'relative',
        background: active ? 'var(--cth-cream-300)' : 'transparent'
      }}
    >
      {/* The visible 2px stripe with hash marks in the middle */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 4,
        width: 2,
        background: active ? 'var(--cth-ink-900)' : 'var(--cth-ink-300)'
      }} />
      <div style={{
        position: 'absolute',
        top: '50%', left: 2, transform: 'translateY(-50%)',
        width: 6, height: 24,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <span style={{ height: 2, background: 'var(--cth-ink-900)' }} />
        <span style={{ height: 2, background: 'var(--cth-ink-900)' }} />
        <span style={{ height: 2, background: 'var(--cth-ink-900)' }} />
      </div>
    </div>
  );
}
