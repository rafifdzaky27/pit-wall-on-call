import type { ReactNode } from "react";

/** libadwaita-style boxed groups and rows (polish spec S22), shared by the Settings pages. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="group" aria-label={title}>
      <h3 className="group-title">{title}</h3>
      <div className="boxed">{children}</div>
    </section>
  );
}

export function Row({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </div>
      {children && <div className="row-control">{children}</div>}
    </div>
  );
}
