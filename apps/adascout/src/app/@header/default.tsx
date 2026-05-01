"use client";

import { useState } from "react";
import Link from "next/link";

import {
  AnimatedThemeToggler,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  Navbar,
  NavbarButton,
  NavBody,
  NavItems,
  Separator,
} from "@launchthatapp/ui";

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
    <div className="absolute top-0 left-0 w-full">
      <Navbar className="top-0">
        <NavBody className="px-2.5">
          <Link href="/" className="flex items-center gap-2">
            <div className="text-foreground text-lg font-medium tracking-wide">
              <span className="font-bold">ADA Scout</span>
            </div>
          </Link>

          <NavItems items={navItems} />
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
        </NavBody>

        <MobileNav>
          <MobileNavHeader className="px-4 py-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-foreground text-lg font-medium tracking-wide">
                <span className="font-bold">ADA Scout</span>
              </div>
            </Link>
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item, idx) => (
              <div key={`mobile-link-${idx}`}>
                <a
                  href={item.link}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="relative text-neutral-600 dark:text-neutral-300"
                >
                  <span className="block">{item.name}</span>
                </a>
              </div>
            ))}
            <div className="mt-4 flex w-full flex-col gap-4">
              <NavbarButton
                onClick={() => setIsMobileMenuOpen(false)}
                variant="primary"
                className="w-full"
              >
                Get Started
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </div>
  );
}
