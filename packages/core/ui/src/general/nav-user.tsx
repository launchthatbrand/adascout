"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@acme/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "../drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { cn } from "../lib/utils";

interface NavUserProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null;
  className?: string;
  isAuthenticated?: boolean;
  onSignIn?: () => void;
  signInLabel?: string;
  onSignOut?: () => void;
  menuItems?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
  }[];
  unauthenticatedSlot?: ReactNode;
}

export function NavUser({
  user,
  className,
  isAuthenticated,
  onSignIn,
  signInLabel = "Sign In",
  onSignOut,
  menuItems,
  unauthenticatedSlot,
}: NavUserProps = {}) {
  const { isMobile } = useSidebar();
  const authenticated = isAuthenticated ?? Boolean(user);
  const displayName = user?.name ?? "User";
  const email = user?.email ?? "";
  const avatar = user?.avatar ?? undefined;
  const fallbackInitial = displayName.trim().charAt(0) || "U";
  const [isOpen, setIsOpen] = useState(false);

  if (!authenticated) {
    if (unauthenticatedSlot) {
      return <>{unauthenticatedSlot}</>;
    }
    return (
      <button
        className="ml-auto flex items-center justify-center rounded-md bg-linear-to-r from-orange-400 via-pink-500 to-purple-600 px-4 py-1 text-sm font-medium text-white transition-colors hover:from-pink-600 hover:to-purple-600 disabled:opacity-60"
        onClick={onSignIn}
        disabled={!onSignIn}
        type="button"
      >
        {signInLabel}
      </button>
    );
  }

  const trigger = (
    <SidebarMenuButton
      size="lg"
      className={cn(
        "h-10 rounded-lg bg-linear-to-r from-pink-500/20 to-purple-500/20 p-1 hover:from-pink-500/30 hover:to-purple-500/30",
        className,
      )}
    >
      <Avatar className="border-gradient-to-r h-8 w-8 rounded-lg border-2 from-pink-500 to-purple-500">
        <AvatarImage src={avatar} />
        <AvatarFallback className="bg-linear-to-r from-pink-500 to-purple-500">
          {fallbackInitial}
        </AvatarFallback>
      </Avatar>
      <div className="hidden flex-1 text-left text-sm leading-tight md:grid">
        <span className="truncate font-semibold text-black">{displayName}</span>
      </div>
      <ChevronsUpDown className="ml-auto size-4 text-black/70" />
    </SidebarMenuButton>
  );

  if (isMobile) {
    return (
      <SidebarMenu className="w-auto">
        <SidebarMenuItem>
          <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent className="p-0">
              <div className="bg-background">
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="border-gradient-to-r h-10 w-10 rounded-lg border-2 from-pink-500 to-purple-500">
                      <AvatarImage src={avatar} />
                      <AvatarFallback className="bg-linear-to-r from-pink-500 to-purple-500">
                        {fallbackInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {displayName}
                      </span>
                      {email ? (
                        <span className="truncate text-xs text-black/70">
                          {email}
                        </span>
                      ) : null}
                    </div>
                    <DrawerClose asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-sm"
                      >
                        Close
                      </button>
                    </DrawerClose>
                  </div>
                </div>
                <div className="px-2 pb-4">
                  {menuItems && menuItems.length > 0 ? (
                    <div className="space-y-1">
                      {menuItems.map((item) => (
                        <DrawerClose asChild key={item.label}>
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm"
                            onClick={item.onClick}
                          >
                            {item.icon ? (
                              <item.icon className="h-4 w-4 text-pink-500" />
                            ) : null}
                            <span>{item.label}</span>
                          </button>
                        </DrawerClose>
                      ))}
                    </div>
                  ) : null}

                  {onSignOut ? (
                    <div
                      className={
                        menuItems && menuItems.length > 0 ? "mt-2" : ""
                      }
                    >
                      <DrawerClose asChild>
                        <button
                          type="button"
                          onClick={onSignOut}
                          className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm"
                        >
                          <LogOut className="h-4 w-4 text-pink-500" />
                          <span>Log out</span>
                        </button>
                      </DrawerClose>
                    </div>
                  ) : null}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu className="w-auto">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg border border-white/10 bg-linear-to-r from-pink-500/30 to-purple-500/30 text-black backdrop-blur-xl"
            side={isMobile ? "bottom" : "bottom"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 rounded-t-lg bg-linear-to-r from-pink-500/10 to-purple-500/10 px-3 py-2">
                <Avatar className="border-gradient-to-r h-8 w-8 rounded-lg border-2 from-pink-500 to-purple-500">
                  <AvatarImage src={avatar} />
                  <AvatarFallback className="bg-linear-to-r from-pink-500 to-purple-500">
                    {fallbackInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  {email ? (
                    <span className="truncate text-xs">{email}</span>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/8" />
            {menuItems && menuItems.length > 0 ? (
              <>
                <DropdownMenuGroup>
                  {menuItems.map((item) => (
                    <DropdownMenuItem
                      key={item.label}
                      className="focus:bg-linear-to-r focus:from-pink-500/20 focus:to-purple-500/20"
                      onClick={item.onClick}
                    >
                      {item.icon ? (
                        <item.icon className="mr-2 h-4 w-4 text-pink-500" />
                      ) : null}
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/8" />
              </>
            ) : null}
            {onSignOut ? (
              <DropdownMenuItem
                onClick={onSignOut}
                className="focus:bg-linear-to-r focus:from-pink-500/20 focus:to-purple-500/20"
              >
                <LogOut className="mr-2 h-4 w-4 text-pink-500" />
                <span>Log out</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
