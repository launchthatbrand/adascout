"use client";

import {
  AnimatedThemeToggler,
  NavbarButton,
  Separator,
} from "@launchthatapp/ui";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

interface NavItem {
  name: string;
  link: string;
  submenu?: { name: string; link: string; description?: string }[];
}

const navItems: NavItem[] = [
  { name: "Home", link: "/" },
  { name: "Blog", link: "/blog" },
  { name: "About", link: "/about" },
];

export default function HeaderDefault() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="absolute top-0 left-0 z-10 w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-2.5 pt-2">
        <div className="hidden items-center justify-between rounded-full bg-background/70 px-4 py-2 shadow-sm backdrop-blur-md md:flex">
          <Link href="/" className="flex items-center gap-2">
            <div className="text-foreground text-lg font-medium tracking-wide">
              <span className="font-bold">ADA Scout</span>
            </div>
          </Link>

          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.link}
                href={item.link}
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="relative flex items-center gap-4">
            <div className="flex h-full min-h-10 flex-1 items-stretch">
              <AnimatedThemeToggler className="bg-background h-full min-h-10" />
            </div>
            <Separator
              orientation="vertical"
              className="bg-border mx-2 flex h-full min-h-10 items-center data-[orientation=vertical]:h-4"
            />
            <NavbarButton variant="primary">Get Started</NavbarButton>
          </div>
        </div>

        <div className="md:hidden">
          <div className="flex items-center justify-between rounded-full bg-background/70 px-4 py-2 shadow-sm backdrop-blur-md">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-foreground text-lg font-medium tracking-wide">
                <span className="font-bold">ADA Scout</span>
              </div>
            </Link>
            <button
              type="button"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="text-foreground inline-flex items-center justify-center rounded-md p-2"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {isMobileMenuOpen ? (
            <div className="bg-background/95 border-border mt-2 flex w-full flex-col gap-4 rounded-xl border px-4 py-5 shadow-lg backdrop-blur-md">
              {navItems.map((item) => (
                <Link
                  key={item.link}
                  href={item.link}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                >
                  {item.name}
                </Link>
              ))}
              <div className="mt-2 flex w-full flex-col gap-4">
                <NavbarButton
                  onClick={() => setIsMobileMenuOpen(false)}
                  variant="primary"
                  className="w-full"
                >
                  Get Started
                </NavbarButton>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
