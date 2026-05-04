"use client";

import * as React from "react";
import { DesktopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons"
import * as z from "zod/v4";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const ThemeModeSchema = z.enum(["light", "dark", "auto"]);

const themeKey = "theme-mode";

export type ThemeMode = z.output<typeof ThemeModeSchema>;
export type ResolvedTheme = Exclude<ThemeMode, "auto">;

const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return "auto";
  try {
    const storedTheme = localStorage.getItem(themeKey);
    return ThemeModeSchema.parse(storedTheme);
  } catch {
    return "auto";
  }
};

const setStoredThemeMode = (theme: ThemeMode) => {
  try {
    const parsedTheme = ThemeModeSchema.parse(theme);
    localStorage.setItem(themeKey, parsedTheme);
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

const getSystemTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const updateThemeClass = (themeMode: ThemeMode) => {
  const root = document.documentElement;
  root.classList.remove("light", "dark", "auto");
  const newTheme = themeMode === "auto" ? getSystemTheme() : themeMode;
  root.classList.add(newTheme);

  if (themeMode === "auto") {
    root.classList.add("auto");
  }
};

const setupPreferredListener = () => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => updateThemeClass("auto");
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
};

const getNextTheme = (current: ThemeMode): ThemeMode => {
  const themes: ThemeMode[] =
    getSystemTheme() === "dark"
      ? ["auto", "light", "dark"]
      : ["auto", "dark", "light"];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return themes[(themes.indexOf(current) + 1) % themes.length]!;
};

export const themeDetectorScript = (function () {
  function themeFn() {
    // Ensure we don't end up with both "dark" and "light" on the root element.
    // This can happen on client navigations where the root already has a theme
    // class and the detector script runs again.
    document.documentElement.classList.remove("light", "dark", "auto");

    const isValidTheme = (theme: string): theme is ThemeMode => {
      const validThemes = ["light", "dark", "auto"] as const;
      return validThemes.includes(theme as ThemeMode);
    };

    const storedTheme = localStorage.getItem("theme-mode") ?? "auto";
    const validTheme = isValidTheme(storedTheme) ? storedTheme : "auto";

    if (validTheme === "auto") {
      const autoTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      document.documentElement.classList.add(autoTheme, "auto");
    } else {
      document.documentElement.classList.add(validTheme);
    }
  }
  return `(${themeFn.toString()})();`;
})();

interface ThemeContextProps {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleMode: () => void;
}
const ThemeContext = React.createContext<ThemeContextProps | undefined>(
  undefined,
);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [themeMode, setThemeMode] = React.useState(getStoredThemeMode);

  // Ensure theme classes are applied after hydration too.
  // Next.js hydration can overwrite <html class="..."> back to the SSR markup,
  // so we re-apply on mount and whenever the stored mode changes.
  React.useLayoutEffect(() => {
    updateThemeClass(themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    if (themeMode !== "auto") return;
    return setupPreferredListener();
  }, [themeMode]);

  const resolvedTheme = themeMode === "auto" ? getSystemTheme() : themeMode;

  const setTheme = (newTheme: ThemeMode) => {
    setThemeMode(newTheme);
    setStoredThemeMode(newTheme);
    updateThemeClass(newTheme);
  };

  const toggleMode = () => {
    setTheme(getNextTheme(themeMode));
  };

  return (
    <ThemeContext
      value={{
        themeMode,
        resolvedTheme,
        setTheme,
        toggleMode,
      }}
    >
      <script
        dangerouslySetInnerHTML={{ __html: themeDetectorScript }}
        suppressHydrationWarning
      />
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = React.use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Single-button toggle between light and dark mode.
 *
 * - No dropdown
 * - Icon animates (rotate/scale) when switching
 * - Clicking always sets an explicit light/dark mode (exits "auto")
 */
export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative [&>svg]:absolute [&>svg]:size-5"
    >
      <SunIcon className="scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="[&>svg]:absolute [&>svg]:size-5 [&>svg]:scale-0"
        >
          <SunIcon className="light:scale-100! auto:scale-0!" />
          <MoonIcon className="auto:scale-0! dark:scale-100!" />
          <DesktopIcon className="auto:scale-100!" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("auto")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
