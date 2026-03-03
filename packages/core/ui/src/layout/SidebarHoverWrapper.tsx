"use client";

import * as React from "react";

import { useSidebar } from "../sidebar";

export function SidebarHoverWrapper(props: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { enabled, children } = props;
  const { open, setOpen, isMobile } = useSidebar();
  const openedByHoverRef = React.useRef(false);
  const closeTimeoutRef = React.useRef<number | null>(null);

  const debugHover =
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    Boolean((window as unknown as { __DEBUG_SIDEBAR_HOVER__?: boolean }).__DEBUG_SIDEBAR_HOVER__);

  const log = React.useCallback(
    (...args: unknown[]) => {
      if (!debugHover) return;
      // eslint-disable-next-line no-console
      console.log("[SidebarHoverWrapper]", ...args);
    },
    [debugHover],
  );

  const hasOpenPortaledDropdown = React.useCallback((): boolean => {
    if (typeof document === "undefined") return false;
    // Our DropdownMenuContent adds data-slot="dropdown-menu-content" and Radix adds data-state="open".
    return Boolean(
      document.querySelector(
        '[data-slot="dropdown-menu-content"][data-state="open"], [data-slot="dropdown-menu-content"][data-state="open"] *',
      ),
    );
  }, []);

  const isPortaledPopoverTarget = React.useCallback(
    (target: EventTarget | null): boolean => {
      if (!target || typeof target !== "object") return false;
      const el = target as HTMLElement;
      // Radix renders popper content in a portal and wraps it in a positioned div.
      // When the user moves the cursor from the sidebar into a portaled menu,
      // `relatedTarget` is often the wrapper, not the inner menu content node.
      return Boolean(
        el.closest?.(
          [
            '[data-radix-popper-content-wrapper]',
            '[data-slot="dropdown-menu-content"]',
          ].join(","),
        ),
      );
    },
    [],
  );

  // If the sidebar closes for any reason, clear the hover-open flag.
  React.useEffect(() => {
    if (!open) {
      openedByHoverRef.current = false;
    }
  }, [open]);

  React.useEffect(() => {
    log("state", {
      enabled,
      isMobile,
      open,
      openedByHover: openedByHoverRef.current,
    });
  }, [enabled, isMobile, log, open]);

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
      log("mouseenter: canceled pending close");
    }
    if (!open) {
      openedByHoverRef.current = true;
      log("mouseenter: opening (was closed)");
      setOpen(true);
    } else {
      log("mouseenter: already open");
    }
  };

  const handleMouseLeave = (event: MouseEvent) => {
    if (!openedByHoverRef.current) return;

    const related = event.relatedTarget as HTMLElement | null;
    const relatedInfo = related
      ? {
          tag: related.tagName,
          id: related.id,
          className: related.className,
          dataSlot: related.getAttribute?.("data-slot") ?? undefined,
          radixWrapper: related.closest?.("[data-radix-popper-content-wrapper]") ? true : false,
        }
      : null;

    // When interacting with portaled popovers/menus (e.g. TeamSwitcher), the cursor can
    // move from the sidebar into content rendered in a portal.
    // Treat that as "still hovering" to prevent open/close flicker.
    const isPortaled = isPortaledPopoverTarget(event.relatedTarget);
    const dropdownOpen = hasOpenPortaledDropdown();
    log("mouseleave", {
      open,
      openedByHover: openedByHoverRef.current,
      relatedTarget: relatedInfo,
      isPortaled,
      dropdownOpen,
    });
    if (isPortaled || dropdownOpen) return;

    // Add a small delay before collapsing. This prevents the sidebar from
    // "chasing" the cursor while its width is transitioning, and gives time
    // for quick interactions (like clicking a dropdown trigger) without
    // immediately collapsing on incidental mouseleave.
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      if (!openedByHoverRef.current) return;
      log("close timeout fired: closing sidebar");
      openedByHoverRef.current = false;
      setOpen(false);
    }, 225);
  };

  React.useEffect(() => {
    if (!enabled || isMobile || typeof document === "undefined") return;
    // Desktop sidebar root has data-slot=sidebar and data-variant/state attrs.
    const sidebarEl = document.querySelector<HTMLElement>(
      '[data-slot="sidebar"][data-variant][data-state]',
    );
    if (!sidebarEl) {
      log("attach: sidebar element not found");
      return;
    }
    log("attach: sidebar listeners");
    sidebarEl.addEventListener("mouseenter", handleMouseEnter);
    sidebarEl.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      log("detach: sidebar listeners");
      sidebarEl.removeEventListener("mouseenter", handleMouseEnter);
      sidebarEl.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enabled, isMobile, handleMouseEnter, handleMouseLeave, log]);

  // Do not introduce an extra wrapper node here:
  // inset styling relies on sidebar + inset being sibling peers.
  // Hover handlers are attached to sidebar DOM via useEffect above.
  return <>{children}</>;
}

