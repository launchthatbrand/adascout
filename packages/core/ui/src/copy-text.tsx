"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "./lib/utils";

interface CopyTextProps {
  value: string;
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  successDuration?: number;
  onCopy?: (value: string) => void;
}

export const CopyText: React.FC<CopyTextProps> = ({
  value,
  className,
  iconClassName,
  children,
  showIcon = true,
  successDuration = 1500,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.(value);

      setTimeout(() => {
        setCopied(false);
      }, successDuration);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        onCopy?.(value);
        setTimeout(() => {
          setCopied(false);
        }, successDuration);
      } catch (fallbackErr) {
        console.error("Fallback copy failed: ", fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div
      className={cn(
        "group inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-gray-50",
        className,
      )}
      onClick={handleCopy}
      title={`Copy ${value}`}
    >
      <span className="flex-1">{children ?? value}</span>
      {showIcon && (
        <span
          className={cn(
            "flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
            iconClassName,
          )}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3 text-gray-400" />
          )}
        </span>
      )}
    </div>
  );
};
