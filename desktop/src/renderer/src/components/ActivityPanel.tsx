import type { ActivityEvent } from "../../../shared/contracts";

export function ActivityPanel({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="activity-panel" aria-label="Agent activity">
      <div className="section-title">Live activity</div>
      {events.length === 0 ? <p className="empty">Activity appears when an agent starts.</p> : null}
      <ol>
        {events.slice().reverse().map((event) => (
          <li key={event.id}>
            <time dateTime={new Date(event.timestamp).toISOString()}>{new Date(event.timestamp).toLocaleTimeString()}</time>
            <span><strong>{event.state ?? event.type.replaceAll("-", " ")}</strong>{event.summary} <small>{event.source}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
