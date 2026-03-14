"use client";

import Link from "next/link";

import AppHeader from "@acme/ui/layout/AppHeader";
import { ThemeToggleButton } from "@acme/ui/theme";

export default function TemplateHeader() {
  return (
    <AppHeader
      appName="ADA Scout"
      sidebarToggle
      className="bg-background sticky top-0 z-50"
      rightSlot={
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-4 text-sm md:flex">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/blog"
              className="text-muted-foreground hover:text-foreground"
            >
              Blog
            </Link>
          </nav>
          <ThemeToggleButton />
        </div>
      }
    />
  );
}
