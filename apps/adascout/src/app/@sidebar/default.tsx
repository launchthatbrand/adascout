"use client";

import {
  FileCheck2,
  FileText,
  FolderSearch2,
  Home,
  LayoutDashboard,
  ShieldCheck,
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

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "ADA Dashboard", icon: LayoutDashboard },
  { href: "/admin/assets", label: "Assets", icon: FolderSearch2 },
  { href: "/admin/scans", label: "Scans", icon: ShieldCheck },
  { href: "/admin/reports", label: "Reports", icon: FileCheck2 },
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About", icon: FileText },
] as const;

export default function TemplateSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border/60 p-4">
        <div className="text-sm font-semibold">ADA Scount</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Routes</SidebarGroupLabel>
          <SidebarMenu>
            {links.map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === link.href || pathname.startsWith(`${link.href}/`)
                  }
                >
                  <Link href={link.href}>
                    <link.icon className="h-4 w-4" />
                    <span>{link.label}</span>
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
