"use client";

import React from "react";

import { cn } from "./lib/utils";

export const IphoneMock = ({
  children,
  className,
  screenClassName,
}: {
  children: React.ReactNode;
  className?: string;
  screenClassName?: string;
}) => {
  return (
    <div
      className={cn(
        "relative ml-1 h-[600px] w-72 rounded-[45px] border-8 border-zinc-900 shadow-[0_0_2px_2px_rgba(255,255,255,0.1)]",
        className,
      )}
    >
      {/* Notch */}
      <div className="absolute top-2 left-1/2 z-20 h-[22px] w-[90px] -translate-x-1/2 transform rounded-full bg-zinc-900" />

      {/* Inner bezel */}
      <div className="pointer-events-none absolute -inset-[1px] rounded-[37px] border-[3px] border-zinc-700/40" />

      {/* Screen */}
      <div className="relative h-full w-full overflow-hidden rounded-[37px] bg-zinc-900/10">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-orange-500/12 via-transparent to-white/6 opacity-70" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-24 w-12 -translate-x-1/2 -translate-y-1/2 bg-zinc-600 blur-[60px]" />

        <div
          className={cn(
            "relative flex h-full w-full flex-col",
            screenClassName,
          )}
        >
          {children}
        </div>
      </div>

      {/* Buttons */}
      <div className="absolute top-20 left-[-12px] h-8 w-[6px] rounded-l-md bg-zinc-900 shadow-md" />
      <div className="absolute top-36 left-[-12px] h-12 w-[6px] rounded-l-md bg-zinc-900 shadow-md" />
      <div className="absolute top-52 left-[-12px] h-12 w-[6px] rounded-l-md bg-zinc-900 shadow-md" />
      <div className="absolute top-36 right-[-12px] h-16 w-[6px] rounded-r-md bg-zinc-900 shadow-md" />
    </div>
  );
};
