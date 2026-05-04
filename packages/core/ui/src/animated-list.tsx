"use client";

import React, {
  ComponentPropsWithoutRef,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion, MotionProps } from "motion/react";

import { cn } from "./lib/utils";

export function AnimatedListItem({
  children,
  motionProps,
  className,
}: {
  children: React.ReactNode;
  motionProps?: MotionProps;
  className?: string;
}) {
  const animations: MotionProps = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.98 },
    transition: { type: "spring", stiffness: 220, damping: 28, mass: 1.1 },
  };

  return (
    <motion.div
      {...animations}
      layout
      {...motionProps}
      className={cn("mx-auto w-full", className)}
    >
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  delay?: number;
  holdDelay?: number;
  loop?: boolean;
  paused?: boolean;
  itemMotionProps?: MotionProps;
  /**
   * Controls how the list is presented.
   * - "reveal": progressively reveals items in a normal document flow (default)
   * - "iosPush": iOS-style push notifications that enter from the top, push down,
   *   then stack behind the Nth item once the screen is "full".
   */
  variant?: "reveal" | "iosPush";
  /**
   * Number of items to show normally before older items begin overlapping into a "stack".
   * Example: stackAfter={3} → show 3 items normally; 4th+ will stack.
   */
  stackAfter?: number;
  /**
   * How much each stacked item overlaps the previous (px).
   */
  stackOverlapPx?: number;
  /**
   * How much each stacked item scales down by (per depth step).
   */
  stackScaleStep?: number;
  /**
   * How much each stacked item fades by (per depth step).
   */
  stackOpacityStep?: number;
  /**
   * Where stacked (overflow) items should accumulate.
   * - "top": overlap upward (default)
   * - "bottom": overlap behind the bottom-most visible item (iOS-like)
   */
  stackPlacement?: "top" | "bottom";
  /**
   * Used by "iosPush" variant to compute stable positions without measuring DOM.
   * Should match the approximate visual height of each child notification card.
   */
  itemHeightPx?: number;
  /**
   * Used by "iosPush" variant (gap between items).
   */
  itemGapPx?: number;
  /**
   * Used by "iosPush" variant: maximum number of stacked layers shown behind the last visible tile.
   * Example: maxStackDepth={2} shows at most two peeking layers.
   */
  maxStackDepth?: number;
}

export const AnimatedList = React.memo(
  ({
    children,
    className,
    delay = 1000,
    holdDelay = 1500,
    loop = false,
    paused = false,
    itemMotionProps,
    variant = "reveal",
    stackAfter,
    stackOverlapPx = 10,
    stackScaleStep = 0.02,
    stackOpacityStep = 0.12,
    stackPlacement = "top",
    itemHeightPx = 92,
    itemGapPx = 8,
    maxStackDepth = 3,
    ...props
  }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const [phase, setPhase] = useState<"entering" | "exiting">("entering");
    const [cycle, setCycle] = useState(0);
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children],
    );

    useEffect(() => {
      if (paused) return;
      if (!loop) {
        if (index < childrenArray.length - 1) {
          const timeout = setTimeout(() => {
            setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length);
          }, delay);

          return () => clearTimeout(timeout);
        }

        return;
      }

      if (phase !== "entering") return;
      if (childrenArray.length <= 1) return;

      if (index < childrenArray.length - 1) {
        const timeout = setTimeout(() => {
          setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length);
        }, delay);

        return () => clearTimeout(timeout);
      }

      const timeout = setTimeout(() => {
        setPhase("exiting");
      }, holdDelay);

      return () => clearTimeout(timeout);
    }, [index, delay, holdDelay, childrenArray.length, loop, phase, paused]);

    const itemsToShow = useMemo(() => {
      if (loop && phase === "exiting") return [];
      if (variant === "iosPush") {
        // Newest should be at the top (like real push notifications).
        return childrenArray.slice(0, index + 1).reverse();
      }

      const result =
        stackPlacement === "bottom"
          ? childrenArray.slice(0, index + 1)
          : childrenArray.slice(0, index + 1).reverse();
      return result;
    }, [index, childrenArray, loop, phase, stackPlacement, variant]);

    const shouldStack =
      typeof stackAfter === "number" &&
      stackAfter >= 1 &&
      itemsToShow.length > stackAfter;

    const isBottomStackMode = shouldStack && stackPlacement === "bottom";

    if (variant === "iosPush") {
      const visibleCount = stackAfter ?? 3;
      const containerHeight =
        visibleCount * itemHeightPx + Math.max(0, visibleCount - 1) * itemGapPx;

      return (
        <div
          className={cn("relative w-full", className)}
          style={{
            height: containerHeight,
          }}
          {...props}
        >
          <AnimatePresence
            onExitComplete={() => {
              if (!loop) return;
              if (phase !== "exiting") return;
              setIndex(0);
              setPhase("entering");
              setCycle((c) => c + 1);
            }}
          >
            {itemsToShow.map((item, i) => {
              const maxVisible = visibleCount;
              const baseY = i * (itemHeightPx + itemGapPx);

              // Once we have more than maxVisible items, anything beyond the last visible
              // becomes part of the stack behind the last visible tile.
              const isStacked = i >= maxVisible;
              const rawStackDepth = isStacked ? i - maxVisible + 1 : 0;
              const stackDepth = Math.min(
                rawStackDepth,
                Math.max(0, maxStackDepth),
              );

              const y = isStacked
                ? (maxVisible - 1) * (itemHeightPx + itemGapPx) +
                  stackDepth * stackOverlapPx
                : baseY;

              const zIndex = itemsToShow.length - i; // newest (i=0) on top
              const shouldFadeOlder = itemsToShow.length > maxVisible;
              // Smoother curve than linear; older items fade more naturally.
              const ageFadeOpacity = shouldFadeOlder
                ? Math.max(0.35, Math.pow(1 - stackOpacityStep, i))
                : 1;

              return (
                <AnimatedListItem
                  key={`${cycle}:${(item as React.ReactElement).key}`}
                  motionProps={{
                    ...itemMotionProps,
                    layout: false,
                    initial: {
                      ...(typeof itemMotionProps?.initial === "object"
                        ? itemMotionProps.initial
                        : {}),
                      opacity: 0,
                      y: -itemHeightPx,
                    },
                    animate: {
                      ...(typeof itemMotionProps?.animate === "object"
                        ? itemMotionProps.animate
                        : {}),
                      opacity: 1,
                      y,
                    },
                    exit: {
                      opacity: 0,
                      ...(typeof itemMotionProps?.exit === "object"
                        ? itemMotionProps.exit
                        : {}),
                    },
                    style: {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      zIndex,
                      transformOrigin: "top center",
                      ...(itemMotionProps?.style ?? {}),
                      opacity: ageFadeOpacity,
                      ...(isStacked
                        ? {
                            scale: Math.max(
                              0.9,
                              1 - stackScaleStep * stackDepth,
                            ),
                            opacity: Math.min(
                              ageFadeOpacity,
                              Math.max(0.25, 1 - stackOpacityStep * stackDepth),
                            ),
                          }
                        : undefined),
                    },
                  }}
                  className={cn(isStacked && "pointer-events-none")}
                >
                  {item}
                </AnimatedListItem>
              );
            })}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div
        className={cn(`relative flex flex-col items-center gap-4`, className)}
        {...props}
      >
        <AnimatePresence
          onExitComplete={() => {
            if (!loop) return;
            if (phase !== "exiting") return;
            setIndex(0);
            setPhase("entering");
          }}
        >
          {itemsToShow.map((item, visibleIndex) => {
            // For bottom stacking we want "newest at bottom". `itemsToShow` is in
            // chronological order (oldest -> newest), so depth is measured from bottom.
            const depthFromBottom = itemsToShow.length - 1 - visibleIndex;

            const depth =
              shouldStack &&
              stackPlacement === "top" &&
              visibleIndex >= (stackAfter as number)
                ? visibleIndex - (stackAfter as number) + 1
                : 0;

            // Keep the newest item on top during overlap.
            const zIndex = isBottomStackMode
              ? visibleIndex + 1
              : itemsToShow.length - visibleIndex;

            const motionStyle: NonNullable<MotionProps["style"]> = {
              zIndex,
              ...(depth > 0 && stackPlacement === "top"
                ? {
                    marginTop: -stackOverlapPx,
                    scale: Math.max(0.9, 1 - stackScaleStep * depth),
                    opacity: Math.max(0.25, 1 - stackOpacityStep * depth),
                  }
                : undefined),
              ...(isBottomStackMode
                ? {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    // Older items sit "behind" the newest by peeking upward.
                    y: -depthFromBottom * stackOverlapPx,
                    scale: Math.max(0.9, 1 - stackScaleStep * depthFromBottom),
                    opacity: Math.max(
                      0.25,
                      1 - stackOpacityStep * depthFromBottom,
                    ),
                  }
                : undefined),
            };

            return (
              <AnimatedListItem
                key={(item as React.ReactElement).key}
                motionProps={{
                  ...itemMotionProps,
                  style: {
                    ...(itemMotionProps?.style ?? {}),
                    ...motionStyle,
                  },
                }}
                className={cn(
                  (depth > 0 || (isBottomStackMode && depthFromBottom > 0)) &&
                    "pointer-events-none",
                  isBottomStackMode && "will-change-transform",
                )}
              >
                {item}
              </AnimatedListItem>
            );
          })}
        </AnimatePresence>
      </div>
    );
  },
);

AnimatedList.displayName = "AnimatedList";
