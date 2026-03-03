import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@acme/ui/sidebar";

import React from "react";

export function AppSidebar({
  sidebar,
  ...props
}: React.ComponentProps<typeof Sidebar> & { sidebar: React.ReactNode }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {sidebar}
      <SidebarRail />
      {/* <SidebarHeader className="h-14 justify-center bg-red-100">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
       <NavMain items={data.navMain} />
         <NavDocuments items={data.documents} />
          <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>{/* <NavUser user={data.user} /></SidebarFooter> */}
    </Sidebar>
  );
}
