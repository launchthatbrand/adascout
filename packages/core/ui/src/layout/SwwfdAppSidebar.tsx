"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  Handshake,
  Plug,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";

import { cn } from "../lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "../sidebar";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const buildItems = (section: "admin" | "dashboard"): Array<NavItem> => {
  if (section === "admin") {
    return [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Contractors", href: "/admin/contractors", icon: UserRound },
      { label: "Job Seekers", href: "/admin/job-seekers", icon: Users },
      { label: "Partners", href: "/admin/partners", icon: Handshake },
      { label: "Job Listings", href: "/admin/job-listings", icon: BriefcaseBusiness },
      { label: "Integrations", href: "/admin/integrations", icon: Plug },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Automations", href: "/admin/automations", icon: Workflow },
    ];
  }

  return [{ label: "Dashboard", href: "/dashboard", icon: BriefcaseBusiness }];
};

export const SwwfdAppSidebar = (props: { section: "admin" | "dashboard" }) => {
  const pathname = usePathname();
  const items = buildItems(props.section);
  const stableSidebarVars = {
    "--sidebar": "oklch(0.145 0 0)",
    "--sidebar-foreground": "oklch(0.985 0 0)",
    "--sidebar-primary": "oklch(0.985 0 0)",
    "--sidebar-primary-foreground": "oklch(0.145 0 0)",
    "--sidebar-accent": "oklch(0.205 0 0)",
    "--sidebar-accent-foreground": "oklch(0.985 0 0)",
    "--sidebar-border": "oklch(1 0 0 / 10%)",
    "--sidebar-ring": "oklch(0.556 0 0)",
  } as React.CSSProperties;

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="overflow-hidden border-white/10 text-white"
      style={stableSidebarVars}
    >
      <SidebarHeader className="p-1">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/60 group-data-[collapsible=icon]:hidden">
          {props.section === "admin" ? "Admin" : "Dashboard"}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="gap-2 p-3 group-data-[collapsible=icon]:items-center">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.label}
                  isActive={active}
                  size="default"
                  className={cn(
                    "h-11 rounded-xl text-white/85 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:size-11! [&>svg]:size-6!",
                    active ? "data-[active=true]:bg-white/15 data-[active=true]:text-white" : "",
                  )}
                >
                  <Link
                    href={item.href}
                    className="gap-3 font-medium tracking-tight group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                  >
                    <Icon className="text-white/75 transition-colors group-hover/menu-button:text-white" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <SidebarSeparator className="w-[90%]! bg-white/15" />
      </SidebarContent>
    </Sidebar>
  );
};
