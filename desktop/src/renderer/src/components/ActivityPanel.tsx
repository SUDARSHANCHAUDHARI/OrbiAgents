import type { ActivityEvent } from "../../../shared/contracts";
import { PixelPanel } from "./ui/PixelPanel";
import { useI18n } from "../i18n";

export function ActivityPanel({ events }: { events: ActivityEvent[] }) {
  const { t } = useI18n();
  return (
    <section className="activity-panel" aria-label={t("agentActivity")}>
      <PixelPanel title={t("signalLog")} eyebrow={t("liveTelemetry")} className="activity-panel__frame">
        {events.length === 0 ? <p className="empty">{t("emptySignals")}</p> : null}
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
