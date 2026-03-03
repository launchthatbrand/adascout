"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { createContext, useContext, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import Link from "next/link";
/* eslint-disable prefer-const */
import type { MotionValue } from "motion/react";
import { cn } from "@acme/ui";

type DockItem = {
  href: string;
  icon: React.ReactNode;
  /** Prefer `label` going forward (desktop tooltip). */
  label?: string;
  /** Back-compat for older callers. */
  title?: string;
};

const getItemLabel = (item: DockItem): string => item.label ?? item.title ?? "";

const DockTouchContext = createContext<{ touchGestureActive: boolean } | null>(
  null,
);

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: DockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

export const FloatingDockMobile = ({
  items,
  className,
}: {
  items: DockItem[];
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="nav"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={getItemLabel(item)}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 10,
                  transition: {
                    delay: idx * 0.05,
                  },
                }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <a
                  href={item.href}
                  key={getItemLabel(item)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <div className="h-4 w-4">{item.icon}</div>
                </a>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      >
        <IconLayoutNavbarCollapse className="h-5 w-5" />
      </button>
    </div>
  );
};

export const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: DockItem[];
  className?: string;
}) => {
  let mouseX = useMotionValue(Infinity);
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [touchGestureActive, setTouchGestureActive] = useState(false);
  const gestureStartedOnItemRef = useRef(false);
  const touchGestureActiveRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchPointerIdRef = useRef<number | null>(null);

  const ctxValue = useMemo(
    () => ({ touchGestureActive }),
    [touchGestureActive],
  );

  const startTouchGesture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;

    const target = e.target as Element | null;
    const startedOnItem = !!target?.closest?.('a[data-dock-item="true"]');
    if (!startedOnItem) return;

    gestureStartedOnItemRef.current = true;
    touchGestureActiveRef.current = false;
    setTouchGestureActive(false);
    touchStartRef.current = { x: e.clientX, y: e.clientY };
    touchPointerIdRef.current = e.pointerId;
    mouseX.set(e.pageX);
  };

  const moveTouchGesture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!gestureStartedOnItemRef.current) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;

    const start = touchStartRef.current;
    const isActive = touchGestureActiveRef.current;

    if (!isActive && start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      // Only activate "slide to select" after a small movement threshold.
      // This preserves normal tap-to-navigate behavior.
      if (dx > 6 || dy > 6) {
        touchGestureActiveRef.current = true;
        setTouchGestureActive(true);
        // Keep receiving pointer events even if the finger leaves the dock.
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }

    if (touchGestureActiveRef.current) {
      mouseX.set(e.pageX);
      // Prevent page scroll while sliding across the dock.
      e.preventDefault();
    }
  };

  const endTouchGesture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!gestureStartedOnItemRef.current) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;

    gestureStartedOnItemRef.current = false;
    const wasSliding = touchGestureActiveRef.current;
    touchGestureActiveRef.current = false;
    setTouchGestureActive(false);
    touchStartRef.current = null;
    touchPointerIdRef.current = null;

    // For simple taps, allow the underlying Link click to navigate normally.
    if (!wasSliding) {
      mouseX.set(Infinity);
      return;
    }

    const container = containerRef.current;
    const anchors = container?.querySelectorAll<HTMLAnchorElement>(
      'a[data-dock-item="true"]',
    );
    if (!anchors || anchors.length === 0) {
      mouseX.set(Infinity);
      return;
    }

    const x = e.clientX;
    // Use a synchronous loop (not `forEach`) so TypeScript can see `bestHref`
    // is potentially assigned before the `if`.
    let bestHref: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const a of Array.from(anchors)) {
      const rect = a.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(x - center);
      const href = a.getAttribute("href");
      if (!href) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestHref = href;
      }
    }

    if (bestHref) {
      router.push(bestHref);
    }

    // Reset the dock sizing back to default after releasing the gesture,
    // otherwise the last-touched icon stays expanded.
    mouseX.set(Infinity);
  };

  return (
    <DockTouchContext.Provider value={ctxValue}>
      <motion.div
        ref={containerRef}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        onPointerDown={startTouchGesture}
        onPointerMove={moveTouchGesture}
        onPointerUp={endTouchGesture}
        onPointerCancel={endTouchGesture}
        className={cn(
          "mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-gray-50 px-4 pb-3 dark:bg-neutral-900 md:flex",
          // Allow "slide across icons" without triggering browser scroll/zoom.
          "touch-none select-none",
          className,
        )}
      >
        {items.map((item) => (
          <IconContainer
            mouseX={mouseX}
            key={getItemLabel(item)}
            currentPathname={pathname}
            {...item}
          />
        ))}
      </motion.div>
    </DockTouchContext.Provider>
  );
};

function IconContainer({
  mouseX,
  label,
  title,
  icon,
  href,
  currentPathname,
}: {
  mouseX: MotionValue;
  label?: string;
  title?: string;
  icon: React.ReactNode;
  href: string;
  currentPathname: string;
}) {
  let ref = useRef<HTMLDivElement>(null);

  let distance = useTransform(mouseX, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };

    return val - bounds.x - bounds.width / 2;
  });

  let widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  let heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);

  let widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);
  let heightTransformIcon = useTransform(
    distance,
    [-150, 0, 150],
    [20, 40, 20],
  );

  let width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  let height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  let widthIcon = useSpring(widthTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  let heightIcon = useSpring(heightTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const [hovered, setHovered] = useState(false);
  const resolvedLabel = label ?? title ?? "";
  const touchCtx = useContext(DockTouchContext);
  const touchGestureActive = touchCtx?.touchGestureActive === true;

  const isActiveRoute =
    currentPathname === href ||
    (href.length > 1 && currentPathname.startsWith(`${href}/`));

  // While sliding on touch, show ALL labels:
  // - closest label is largest/brightest
  // - others stay visible but smaller/dimmer
  const touchLabelOpacity = useTransform(
    distance,
    [-220, -120, 0, 120, 220],
    [0.35, 0.65, 1, 0.65, 0.35],
  );
  const touchLabelScale = useTransform(
    distance,
    [-220, -120, 0, 120, 220],
    [0.88, 0.98, 1.16, 0.98, 0.88],
  );

  const handlePointerUp: React.PointerEventHandler<HTMLAnchorElement> = (e) => {
    // On iOS Safari, tapped links can retain :focus until the next tap,
    // which feels "stuck" for a bottom tab bar. Blur after touch/pen taps,
    // but preserve keyboard focus and normal desktop mouse behavior.
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      e.currentTarget.blur();
    }
  };

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    // When we're doing a touch slide gesture, navigation is handled by the parent
    // on pointer release. Prevent the anchor's default click to avoid double-nav.
    if (touchCtx?.touchGestureActive) {
      e.preventDefault();
    }
  };

  return (
    <Link
      href={href}
      aria-label={resolvedLabel}
      aria-current={isActiveRoute ? "page" : undefined}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onContextMenu={(e) => {
        // Prevent iOS long-press "copy/open in new tab" style menus on dock icons.
        e.preventDefault();
      }}
      data-dock-item="true"
      className={cn(
        "inline-flex rounded-full outline-none",
        // Remove iOS tap highlight; prefer explicit active styles.
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        // Avoid text selection / callouts on long press.
        "select-none [-webkit-touch-callout:none] [-webkit-user-select:none]",
        // Only show focus styles for keyboard navigation.
        "focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
      )}
    >
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-full bg-neutral-800",
          // Make taps feel more "native".
          "active:scale-95",
          // Active route highlight.
          isActiveRoute
            ? "ring-2 ring-orange-500/50 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]"
            : null,
        )}
      >
        {touchGestureActive ? (
          <motion.div
            style={{ opacity: touchLabelOpacity, scale: touchLabelScale }}
            className="pointer-events-none absolute -top-9 left-1/2 w-fit -translate-x-1/2 whitespace-pre rounded-md border border-gray-200 bg-gray-100 px-2.5 py-1 text-sm font-medium text-neutral-800 shadow-sm dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
          >
            {resolvedLabel}
          </motion.div>
        ) : (
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 10, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, y: 2, x: "-50%" }}
                transition={{ duration: 0.12 }}
                className="absolute -top-9 left-1/2 w-fit whitespace-pre rounded-md border border-gray-200 bg-gray-100 px-2.5 py-1 text-sm font-medium text-neutral-800 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
              >
                {resolvedLabel}
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <motion.div
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </Link>
  );
}
