import type { ReactNode } from "react";

type CalloutType = "info" | "tip" | "warning";

interface CalloutProps {
  title?: string;
  type?: CalloutType;
  children: ReactNode;
}

const typeStyles: Record<CalloutType, string> = {
  info: "border-blue-500/40 bg-blue-500/10",
  tip: "border-emerald-500/40 bg-emerald-500/10",
  warning: "border-amber-500/40 bg-amber-500/10",
};

export const Callout = ({ title, type = "info", children }: CalloutProps) => {
  return (
    <aside className={`my-8 rounded-xl border p-4 ${typeStyles[type]}`}>
      {title ? <p className="mb-2 text-sm font-semibold text-foreground">{title}</p> : null}
      <div className="text-sm leading-6 text-foreground/90">{children}</div>
    </aside>
  );
};
