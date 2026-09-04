import type { HarnessConfig } from '@/store/config';

/** Only one replacement theme ships. Viewing settings never alters agents. */
export function OfficeThemePicker({ config: _config }: { config: HarnessConfig }) {
  return (
    <section aria-label="Office theme" style={{ fontSize: 13, lineHeight: '20px' }}>
      <h3 style={{ margin: '0 0 8px', color: 'var(--cth-ink-900)' }}>OrbiAgents office</h3>
      <p style={{ margin: '0 0 8px', color: 'var(--cth-ink-700)' }}>
        Original orbital room and robot workers with credited LPC office furniture.
      </p>
      <p style={{ margin: 0, color: 'var(--cth-ink-500)' }}>
        This is the only available theme. Legacy theme selections use this room.
        No agents or settings are changed here.
      </p>
    </section>
  );
}
