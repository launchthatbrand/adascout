"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "@launchthatapp/ui/sidebar";

const NAV_ICON_CLASS =
  "text-sidebar-foreground/70 transition-colors group-hover/menu-button:text-sidebar-foreground group-data-[active=true]/menu-button:text-blue-600 dark:group-data-[active=true]/menu-button:text-blue-400";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/assets", label: "Assets", icon: FolderSearch2 },
  { href: "/admin/reports", label: "Reports", icon: FileCheck2 },
  { href: "/admin/workflows", label: "Workflows", icon: FileText },
] as const;

const publicLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About", icon: FileText },
] as const;

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-border/40 text-sidebar-foreground overflow-hidden"
    >
      <SidebarHeader className="border-sidebar-border/60 border-b p-4">
        <Link
          href="/admin"
          className="text-sidebar-foreground flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Image
            src="/adascout_logo_dark_500.png"
            alt="ADA Scout"
            width={32}
            height={32}
            className="block rounded-sm dark:hidden"
            priority
          />
          <Image
            src="/adascout_logo_light_500.png"
            alt="ADA Scout"
            width={32}
            height={32}
            className="hidden rounded-sm dark:block"
            priority
          />
          <span className="group-data-[collapsible=icon]:hidden">
            ADA Scout
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 px-4 pt-2 text-xs tracking-wide uppercase">
            Admin
          </SidebarGroupLabel>
          <SidebarMenu className="gap-2 p-3 group-data-[collapsible=icon]:items-center">
            {adminLinks.map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.label}
                  isActive={
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`)
                  }
                  className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:text-sidebar-accent-foreground h-11 rounded-xl group-data-[collapsible=icon]:size-11! data-[active=true]:bg-blue-500/35 [&>svg]:size-6!"
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 px-4 pt-2 text-xs tracking-wide uppercase">
            Public
          </SidebarGroupLabel>
          <SidebarMenu className="gap-2 p-3 group-data-[collapsible=icon]:items-center">
            {publicLinks.map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.label}
                  isActive={pathname === link.href}
                  className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:text-sidebar-accent-foreground h-11 rounded-xl group-data-[collapsible=icon]:size-11! data-[active=true]:bg-blue-500/35 [&>svg]:size-6!"
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
