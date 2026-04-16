"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";

import { AuroraText } from "../../aurora-text";
import { cn } from "../../lib/utils";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
  /**
   * CSS selector or "window" for the element whose scroll drives the
   * collapse animation. Defaults to `[data-layout-scroll-container]`,
   * falling back to window scroll if the element isn't found.
   */
  scrollContainer?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

export interface NavSubItem {
  name: string;
  link: string;
  description?: string;
}

export interface NavItemDef {
  name: string;
  link: string;
  submenu?: NavSubItem[];
}

interface NavItemsProps {
  items: NavItemDef[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({
  children,
  className,
  scrollContainer = "[data-layout-scroll-container]",
}: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [hasResolvedScrollContainer, setHasResolvedScrollContainer] = useState(false);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    if (scrollContainer === "window") {
      scrollContainerRef.current = null;
      setHasResolvedScrollContainer(false);
      return;
    }
    const el = document.querySelector<HTMLElement>(scrollContainer);
    scrollContainerRef.current = el;
    setHasResolvedScrollContainer(Boolean(el));
  }, [scrollContainer]);

  const { scrollY } = useScroll({
    container: hasResolvedScrollContainer
      ? (scrollContainerRef as React.RefObject<HTMLElement>)
      : undefined,
  });

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 100) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  });

  return (
    <motion.div
      ref={ref}
      className={cn("sticky inset-x-0 top-20 z-40 w-full", className)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
            child as React.ReactElement<{ visible?: boolean }>,
            { visible },
          )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(10px)" : "none",
        boxShadow: visible
          ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
          : "none",
        width: visible ? "40%" : "100%",
        y: visible ? 20 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      style={{
        minWidth: "800px",
      }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start rounded-full bg-transparent px-4 py-2 lg:flex dark:bg-transparent",
        visible && "bg-white/80 dark:bg-neutral-950/80",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const submenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmenuEnter = (idx: number) => {
    if (submenuTimeout.current) {
      clearTimeout(submenuTimeout.current);
      submenuTimeout.current = null;
    }
    setOpenSubmenu(idx);
    setHovered(idx);
  };

  const handleSubmenuLeave = () => {
    submenuTimeout.current = setTimeout(() => {
      setOpenSubmenu(null);
    }, 150);
  };

  return (
    <motion.div
      onMouseLeave={() => {
        setHovered(null);
        handleSubmenuLeave();
      }}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium text-zinc-600 transition duration-200 hover:text-zinc-800 lg:flex lg:space-x-2",
        className,
      )}
    >
      {items.map((item, idx) => {
        const hasSubmenu = item.submenu && item.submenu.length > 0;

        return (
          <div
            key={`nav-${idx}`}
            className="relative"
            onMouseEnter={() => {
              setHovered(idx);
              if (hasSubmenu) handleSubmenuEnter(idx);
            }}
            onMouseLeave={() => {
              if (hasSubmenu) handleSubmenuLeave();
            }}
          >
            <a
              onClick={onItemClick}
              className="relative flex items-center gap-1 px-4 py-2 text-neutral-600 dark:text-neutral-300"
              href={item.link}
            >
              {hovered === idx && (
                <motion.div
                  layoutId="hovered"
                  className="absolute inset-0 h-full w-full rounded-full bg-gray-100 dark:bg-neutral-800"
                />
              )}
              <span className="relative z-20">{item.name}</span>
              {hasSubmenu ? (
                <svg
                  className="relative z-20 h-3.5 w-3.5 transition-transform duration-200"
                  style={{
                    transform: openSubmenu === idx ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              ) : null}
            </a>

            {/* Submenu dropdown */}
            <AnimatePresence>
              {hasSubmenu && openSubmenu === idx ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  onMouseEnter={() => handleSubmenuEnter(idx)}
                  onMouseLeave={handleSubmenuLeave}
                  className="absolute left-1/2 top-full z-[70] mt-2 min-w-[200px] -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95"
                >
                  {item.submenu!.map((sub, subIdx) => (
                    <a
                      key={`sub-${subIdx}`}
                      href={sub.link}
                      onClick={onItemClick}
                      className="group flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800"
                    >
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {sub.name}
                      </span>
                      {sub.description ? (
                        <span className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {sub.description}
                        </span>
                      ) : null}
                    </a>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(10px)" : "none",
        boxShadow: visible
          ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
          : "none",
        width: visible ? "90%" : "100%",
        paddingRight: visible ? "12px" : "0px",
        paddingLeft: visible ? "12px" : "0px",
        borderRadius: visible ? "4px" : "2rem",
        y: visible ? 20 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between bg-transparent px-0 py-2 lg:hidden",
        visible && "bg-white/80 dark:bg-neutral-950/80",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-4 rounded-lg bg-white px-4 py-8 shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset] dark:bg-neutral-950",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return isOpen ? (
    <IconX className="text-black dark:text-white" onClick={onClick} />
  ) : (
    <IconMenu2 className="text-black dark:text-white" onClick={onClick} />
  );
};

export const NavbarLogo = ({ title, subtitle, className }: { title: string; subtitle: string; className?: string }) => {
  return (
    <a
      href="#"
      className="relative z-20 mr-4 flex gap-2 items-center space-x-0 px-2 py-1 text-sm font-normal text-foreground"
    >
      <img
        src="https://assets.aceternity.com/logo-dark.png"
        alt="logo"
        width={30}
        height={30}
      />
      <div className={cn("flex gap-0 tracking-wider", className)}>

        <span className="text-lg font-medium">{title}</span>
        <span className="text-lg font-extrabold">{subtitle}</span>
      </div>
    </a>
  );
};

export const NavbarButton = ({
  href,
  as,
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
} & (
    | React.ComponentPropsWithoutRef<"a">
    | React.ComponentPropsWithoutRef<"button">
  )) => {
  const baseStyles =
    "px-4 py-2 rounded-md bg-white button bg-white text-black text-sm font-bold relative cursor-pointer hover:-translate-y-0.5 transition duration-200 inline-block text-center";

  const variantStyles = {
    primary:
      "shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
    secondary: "bg-transparent shadow-none dark:text-white",
    dark: "bg-black text-white shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
    gradient:
      "bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]",
  };

  const Tag = as ?? (href ? "a" : "button");
  const isAnchor = Tag === "a";
  const tagProps = isAnchor
    ? { href: href || undefined }
    : { type: "button" as const };

  return (
    <Tag
      {...tagProps}
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      {children}
    </Tag>
  );
};
