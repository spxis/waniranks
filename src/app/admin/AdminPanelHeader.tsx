import type { ReactNode } from "react";

type AdminPanelHeaderProps = {
  label: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export default function AdminPanelHeader({
  label,
  title,
  description,
  actions,
}: AdminPanelHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-foreground/60">{label}</p>
        <h2 className="mt-1 text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-foreground/70">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
