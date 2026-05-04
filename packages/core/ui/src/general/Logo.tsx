"use client";

import Image from "next/image";

import { cn } from "../lib/utils";

interface LogoProps {
  className?: string;
  appName?: string;
  image?: string;
}

export function Logo({
  className,
  appName = "Wall Street Academy",
  image,
}: LogoProps) {
  const [firstPart, ...rest] = appName.split(" ");
  const secondPart = rest.join(" ");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {image ? (
        <Image src={image} alt={appName} width={40} height={40} />
      ) : null}
      {appName ? (
        <div className="hidden gap-1 md:flex">
          <span className="font-semibold text-[#2b0e4d] dark:text-white">
            {firstPart}
          </span>
          <span className="font-light text-[#FC653C] dark:text-white">
            {secondPart}
          </span>
        </div>
      ) : null}
    </div>
  );
}
