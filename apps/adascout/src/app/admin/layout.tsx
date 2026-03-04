import type { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <div className="bg-muted/20 flex min-h-0 flex-1">{children}</div>;
}
