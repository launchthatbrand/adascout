"use client";

import {
  FileCheck2,
  FileText,
  FolderSearch2,
  Home,
  LayoutDashboard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@acme/ui/sidebar";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ICON_CLASS =
  "text-sidebar-foreground/70 transition-colors group-hover/menu-button:text-sidebar-foreground group-data-[active=true]/menu-button:text-blue-600 dark:group-data-[active=true]/menu-button:text-blue-400";

const links = [
  { href: "/admin", label: "ADA Dashboard", icon: LayoutDashboard },
  { href: "/admin/assets", label: "Assets", icon: FolderSearch2 },
  { href: "/admin/reports", label: "Reports", icon: FileCheck2 },
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About", icon: FileText },
] as const;

export default function TemplateSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="overflow-hidden border-border/40 text-sidebar-foreground"
    >
      <SidebarHeader className="border-b border-sidebar-border/60 p-4">
        <Link
          href="/admin"
          className="text-sidebar-foreground flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Image
            src="/adascout_logo_dark_500.png"
            alt="ADA Scout logo"
            width={50}
            height={50}
            className="block rounded-sm dark:hidden"
            priority
          />
          <Image
            src="/adascout_logo_light_500.png"
            alt="ADA Scout logo"
            width={50}
            height={50}
            className="hidden rounded-sm dark:block"
            priority
          />
          <span className="group-data-[collapsible=icon]:hidden">ADA Scout</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 px-4 pt-2 text-xs tracking-wide uppercase">
            Routes
          </SidebarGroupLabel>
          <SidebarMenu className="gap-2 p-3 group-data-[collapsible=icon]:items-center">
            {links.map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.label}
                  isActive={
                    pathname === link.href || pathname.startsWith(`${link.href}/`)
                  }
                  className="h-11 rounded-xl text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-blue-500/35 data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-11! [&>svg]:size-6!"
                >
                  <Link
                    href={link.href}
                    className="gap-3 font-medium tracking-tight group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                  >
                    <link.icon className={`h-6 w-6 ${NAV_ICON_CLASS}`} />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {link.label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
