import type { ActivityEvent } from "../../../shared/contracts";
import { PixelPanel } from "./ui/PixelPanel";

export function ActivityPanel({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="activity-panel" aria-label="Agent activity">
      <PixelPanel title="Signal log" eyebrow="live telemetry" className="activity-panel__frame">
        {events.length === 0 ? <p className="empty">Runtime signals will appear here.</p> : null}
        <ol>
          {events.slice().reverse().map((event) => (
            <li key={event.id}>
              <time dateTime={new Date(event.timestamp).toISOString()}>{new Date(event.timestamp).toLocaleTimeString()}</time>
              <span><strong>{event.state ?? event.type.replaceAll("-", " ")}</strong>{event.summary} <small>{event.source}</small></span>
            </li>
          ))}
        </ol>
      </PixelPanel>
    </section>
  );
}
