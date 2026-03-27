"use client";

import * as React from "react";

import {
  Building2,
  ChevronsUpDown,
  Globe,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@acme/ui/sidebar";

import Link from "next/link";

export interface TeamSwitcherOrganization {
  id: string;
  name: string;
  slug?: string;
  customDomain?: string;
  role?: string;
  badgeLabel?: string;
  badgeDescription?: string;
  logoUrl?: string | null;
}

interface TeamSwitcherProps {
  organizations: TeamSwitcherOrganization[];
  className?: string;
  activeOrganizationId?: string | null;
  onSelect?: (organization: TeamSwitcherOrganization) => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  switchingOrganizationId?: string | null;
  createHref?: string;
  onCreate?: () => void;
  createLabel?: string;
  menuLabel?: string;
  emptyLabel?: string;
  loadingLabel?: string;
  triggerPlaceholder?: {
    title: string;
    description?: string;
  };
  /**
   * Utility class for the trigger icon wrapper size.
   * Example: "size-10" or "size-14".
   */
  triggerIconSizeClass?: string;
}

const DEFAULT_PLACEHOLDER = {
  title: "No organization",
  description: "Select an organization",
};

export function TeamSwitcher({
  className,
  organizations = [],
  activeOrganizationId,
  onSelect,
  isLoading,
  isDisabled,
  switchingOrganizationId,
  createHref,
  onCreate,
  createLabel = "Add organization",
  menuLabel = "Organizations",
  emptyLabel = "No organizations found",
  loadingLabel = "Loading organizations…",
  triggerPlaceholder = DEFAULT_PLACEHOLDER,
  triggerIconSizeClass = "size-12",
}: TeamSwitcherProps) {
  const { isMobile } = useSidebar();

  const platformOrg = React.useMemo(() => {
    return organizations.find((org) => org.id === "__platform") ?? null;
  }, [organizations]);
  const nonPlatformOrganizations = React.useMemo(() => {
    return organizations.filter((org) => org.id !== "__platform");
  }, [organizations]);

  const activeOrganization =
    organizations.find((org) => org.id === activeOrganizationId) ??
    organizations[0] ??
    null;
  const hasOrganizations = organizations.length > 0;

  let isTriggerDisabled = isDisabled ?? false;
  if (!isTriggerDisabled && !hasOrganizations && !onSelect) {
    isTriggerDisabled = true;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent h-auto data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-14! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center disabled:opacity-100"
              disabled={isTriggerDisabled}
            >
              <div
                className={`flex aspect-square ${triggerIconSizeClass} items-center justify-center rounded-xl bg-transparent ring-1 ring-sidebar-ring text-sidebar-foreground`}
              >
                {activeOrganization?.logoUrl ? (
                  <img
                    src={activeOrganization.logoUrl}
                    alt={activeOrganization.name}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <Building2 className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium text-sidebar-foreground">
                  {activeOrganization?.name ?? triggerPlaceholder.title}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {activeOrganization?.slug ??
                    triggerPlaceholder.description ??
                    ""}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-80 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {platformOrg ? (
              <>
                <DropdownMenuItem
                  key={platformOrg.id}
                  disabled={
                    switchingOrganizationId === platformOrg.id || !onSelect || isLoading
                  }
                  onClick={() => onSelect?.(platformOrg)}
                  className="gap-2 p-2"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-white/5">
                    {platformOrg.logoUrl ? (
                      <img
                        src={platformOrg.logoUrl}
                        alt={platformOrg.name}
                        className="h-full w-full rounded-md object-cover"
                      />
                    ) : (
                      <Globe className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{platformOrg.name}</span>
                    <span className="text-xs text-muted-foreground">Global view</span>
                  </div>
                  {activeOrganization?.id === platformOrg.id && (
                    <span className="ml-auto rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                      Active
                    </span>
                  )}
                  {switchingOrganizationId === platformOrg.id && (
                    <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}

            <div className="flex items-center justify-between px-2 py-1">
              <DropdownMenuLabel className="p-0 text-xs text-muted-foreground">
                {menuLabel}
              </DropdownMenuLabel>
              {(createHref || onCreate) &&
                (createHref ? (
                  <Link href={createHref}>
                    <button
                      type="button"
                      className="hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded-md border"
                      aria-label={createLabel}
                      title={createLabel}
                    >
                      <Plus className="size-4" />
                    </button>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCreate?.()}
                    className="hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded-md border"
                    aria-label={createLabel}
                    title={createLabel}
                  >
                    <Plus className="size-4" />
                  </button>
                ))}
            </div>
            {isLoading && (
              <DropdownMenuItem className="gap-2 p-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {loadingLabel}
              </DropdownMenuItem>
            )}
            {!isLoading && !hasOrganizations && (
              <DropdownMenuItem className="gap-2 p-2 text-sm">
                {emptyLabel}
              </DropdownMenuItem>
            )}
            {nonPlatformOrganizations.map((org) => {
              const isActive = activeOrganization?.id === org.id;
              return (
                <DropdownMenuItem
                  key={org.id}
                  disabled={
                    switchingOrganizationId === org.id || !onSelect || isLoading
                  }
                  onClick={() => onSelect?.(org)}
                  className="gap-2 p-2"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="h-full w-full rounded-md object-cover"
                      />
                    ) : (
                      org.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  {org.name}
                  <DropdownMenuShortcut>
                    ⌘{nonPlatformOrganizations.indexOf(org) + 1}
                  </DropdownMenuShortcut>
                  {org.role && (
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <ShieldCheck className="size-3" />
                      {org.role}
                    </span>
                  )}
                  {isActive && (
                    <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                      Active
                    </span>
                  )}
                  {switchingOrganizationId === org.id && (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
