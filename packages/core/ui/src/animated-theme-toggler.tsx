"use client";

import * as React from "react";

import { Moon, Sun } from "lucide-react";

import { Button } from "./button";
import { cn } from "./lib/utils";
import { flushSync } from "react-dom";
import { useTheme } from "./theme";

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const toggleTheme = React.useCallback(async () => {
    if (!buttonRef.current) return;

    const apply = () => {
      flushSync(() => {
        setTheme(isDark ? "light" : "dark");
      });
    };

    const startViewTransition = (document as any).startViewTransition as
      | undefined
      | ((cb: () => void) => { ready: Promise<void> });

    if (startViewTransition) {
      // Some browsers require `startViewTransition` to be called with `document`
      // as the receiver (otherwise you can get "Illegal invocation").
      await startViewTransition.call(document, apply).ready;
    } else {
      apply();
    }

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const maxRadius = Math.hypot(
      Math.max(left, window.innerWidth - left),
      Math.max(top, window.innerHeight - top),
    );

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  }, [duration, isDark, setTheme]);

  return (
    <Button
      ref={buttonRef}
      onClick={toggleTheme}
      type="button"
      variant="ghost"
      className={cn(
        "relative h-9 w-9 rounded-md border border-border/60 text-foreground/80 shadow-xs",
        className,
      )}
      {...props}
    >
      {/* Render both icons to avoid SSR/CSR hydration mismatches when system theme differs. */}
      <Sun className="absolute h-4 w-4 scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
      <Moon className="absolute h-4 w-4 scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
