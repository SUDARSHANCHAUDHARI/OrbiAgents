import type { ReactNode } from "react";

export function PixelPanel({ title, titleId, eyebrow, action, ariaLabel, className = "", children }: { title?: string; titleId?: string; eyebrow?: string; action?: ReactNode; ariaLabel?: string; className?: string; children: ReactNode }) {
  return <section className={`pixel-panel ${className}`.trim()} aria-label={ariaLabel}>
    {title ? <header className="pixel-panel__header"><div>{eyebrow ? <span>{eyebrow}</span> : null}<h2 id={titleId}>{title}</h2></div>{action}</header> : null}
    <div className="pixel-panel__body">{children}</div>
  </section>;
}
