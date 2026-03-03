"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  MailIcon,
  MoveLeftIcon,
  PlusCircleIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../collapsible";
import { cn } from "../lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "../sidebar";

interface SubItem {
  title: string;
  url: string;
  items?: {
    title: string;
    url: string;
  }[];
}

export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: SubItem[];
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

interface NavMainProps {
  items?: NavItem[];
  sections?: NavSection[];
  labelBehavior?: "default" | "ticker";
}

const TickerText = ({
  text,
  enabled,
  className,
}: {
  text: string;
  enabled: boolean;
  className?: string;
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setOverflow(0);
      return;
    }
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;

    const recompute = () => {
      const nextOverflow = Math.max(0, inner.scrollWidth - container.clientWidth);
      setOverflow(nextOverflow);
    };

    recompute();

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(recompute) : null;
    if (ro) {
      ro.observe(container);
      ro.observe(inner);
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", recompute);
    }

    return () => {
      if (ro) ro.disconnect();
      else if (typeof window !== "undefined") window.removeEventListener("resize", recompute);
    };
  }, [enabled, text]);

  const pxPerSecond = 60;
  const durationSeconds =
    overflow > 0 ? Math.max(1.0, overflow / pxPerSecond) : 0;

  const animateClass =
    enabled && overflow > 0
      ? "group-hover:[animation:ticker-reveal_var(--ticker-duration)_linear_forwards]"
      : "";

  return (
    <span
      ref={containerRef}
      className={cn("min-w-0 overflow-hidden whitespace-nowrap", className)}
    >
      <span
        ref={textRef}
        className={cn("inline-block will-change-transform", animateClass)}
        style={
          enabled && overflow > 0
            ? ({
                ["--ticker-shift" as any]: `-${overflow}px`,
                ["--ticker-duration" as any]: `${durationSeconds}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
};

export function NavMain({ items, sections, labelBehavior = "default" }: NavMainProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPathnameRef = useRef<string>(pathname);
  const [focusedSectionLabel, setFocusedSectionLabel] = useState<string | null>(
    null,
  );

  // Check if a given path is active
  const isActive = (url: string) => {
    // If this is a same-origin URL with query params, match on pathname + query subset.
    // This is important for routes like `/admin/edit?plugin=x&page=y` where pathname alone
    // is not enough to determine active nav state.
    if (url.includes("?")) {
      try {
        const parsed = new URL(url, "http://localhost");
        if (parsed.pathname !== pathname) {
          return false;
        }
        for (const [key, value] of parsed.searchParams.entries()) {
          if (searchParams.get(key) !== value) {
            return false;
          }
        }
        return true;
      } catch {
        // fall through to pathname-based matching
      }
    }

    // Exact match for dashboard or root paths
    if (url === "/dashboard" || url === "/") {
      return pathname === url;
    }

    // For other paths, check if the current path starts with the URL
    // This ensures that sub-pages also activate their parent menu item
    return pathname.startsWith(url);
  };

  // Check if any sub-item is active
  const hasActiveChild = (itemUrl: string, subItems?: SubItem[]) => {
    if (!subItems) return false;

    // If the parent URL is active, return true
    if (isActive(itemUrl)) return true;

    // Check if any child URL is active
    return subItems.some((subItem) => isActive(subItem.url));
  };

  const normalizedSections: NavSection[] =
    sections && sections.length > 0
      ? sections
      : items && items.length > 0
        ? [{ items }]
        : [];

  const visibleSections =
    focusedSectionLabel != null
      ? normalizedSections.filter(
          (section) => section.label === focusedSectionLabel,
        )
      : normalizedSections;

  if (normalizedSections.length === 0) {
    return null;
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollContainer =
      container.closest<HTMLElement>("[data-sidebar='content']") ?? container;

    const target =
      scrollContainer.querySelector<HTMLElement>("[data-nav-exact='true']") ??
      scrollContainer.querySelector<HTMLElement>("[data-nav-active='true']");

    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [pathname]);

  useEffect(() => {
    const lastPathname = lastPathnameRef.current;
    if (lastPathname === pathname) {
      return;
    }
    lastPathnameRef.current = pathname;

    if (!isMobile) return;
    if (!openMobile) return;
    setOpenMobile(false);
  }, [isMobile, openMobile, pathname, setOpenMobile]);

  const handleNavigate = () => {
    if (!isMobile) return;
    setOpenMobile(false);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const scrollContainer =
      container.closest<HTMLElement>("[data-sidebar='content']") ?? container;

    const storageKey = "admin-sidebar-scroll";
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) {
        scrollContainer.scrollTop = parsed;
      }
    }

    const handleScroll = () => {
      window.sessionStorage.setItem(
        storageKey,
        String(scrollContainer.scrollTop),
      );
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const useTickerLabels = labelBehavior === "ticker";

  const renderMenuItems = (menuItems: NavItem[]) => (
    <SidebarMenu>
      {menuItems.map((item) => {
        const itemActive = isActive(item.url);
        const childActive = hasActiveChild(item.url, item.items);
        const isCurrentActive = itemActive || childActive;

        if (item.items && item.items.length > 0) {
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isCurrentActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    isActive={isCurrentActive}
                    tooltip={item.title}
                    data-nav-active={isCurrentActive ? "true" : undefined}
                    data-nav-exact={itemActive ? "true" : undefined}
                  >
                    <Link
                      href={item.url}
                      onClick={handleNavigate}
                      className="group flex flex-1 items-center gap-2 [&>svg]:size-4 [&>svg]:shrink-0"
                    >
                      {item.icon && <item.icon />}
                      <TickerText enabled={useTickerLabels} text={item.title} className="flex-1" />
                    </Link>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => {
                      const subItemActive = isActive(subItem.url);

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            className={cn(
                              subItemActive &&
                                "bg-accent/50 text-accent-foreground font-medium",
                            )}
                            data-nav-active={subItemActive ? "true" : undefined}
                            data-nav-exact={subItemActive ? "true" : undefined}
                          >
                            <Link
                              href={subItem.url}
                              onClick={handleNavigate}
                              className="group flex min-w-0 items-center"
                            >
                              <TickerText enabled={useTickerLabels} text={subItem.title} className="flex-1" />
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        }

        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              tooltip={item.title}
              asChild
              className={cn(itemActive && "bg-accent text-accent-foreground")}
              data-nav-active={itemActive ? "true" : undefined}
              data-nav-exact={itemActive ? "true" : undefined}
            >
              <Link href={item.url} onClick={handleNavigate} className="group flex min-w-0 items-center gap-2">
                {item.icon && <item.icon />}
                <TickerText enabled={useTickerLabels} text={item.title} className="flex-1" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  const sectionIsActive = (section: NavSection) =>
    section.items.some((item) => {
      if (isActive(item.url)) return true;
      return item.items?.some((sub) => isActive(sub.url));
    });

  const tickerStyle = useMemo(() => {
    if (!useTickerLabels) return null;
    return (
      <style>{`
        @keyframes ticker-reveal {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(var(--ticker-shift));
          }
        }
      `}</style>
    );
  }, [useTickerLabels]);

  return (
    <SidebarGroup className="mb-20 overflow-y-auto">
      <SidebarGroupContent
        ref={containerRef}
        className="flex flex-col gap-4 overflow-y-auto"
      >
        {focusedSectionLabel && (
          <button
            type="button"
            onClick={() => setFocusedSectionLabel(null)}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors"
          >
            <MoveLeftIcon className="h-4 w-4" />
            Go Back
          </button>
        )}

        {visibleSections.map((section, index) => {
          if (!section.label) {
            return (
              <div key={`section-${index}`} className="flex flex-col gap-2">
                {renderMenuItems(section.items)}
              </div>
            );
          }

          const isSectionActive = sectionIsActive(section);

          const label = section.label!; // safe because of the earlier guard

          const handleFocusSection = () => {
            if (focusedSectionLabel === label) {
              setFocusedSectionLabel(null);
              return;
            }
            setFocusedSectionLabel(label);
          };

          return (
            <div
              key={section.label}
              className="group/collapsible flex flex-col gap-2"
            >
              {renderMenuItems(section.items)}
            </div>
          );
        })}
        {tickerStyle}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
