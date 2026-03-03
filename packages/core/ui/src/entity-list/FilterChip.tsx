"use client";

import { X } from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

export interface FilterChipProps {
  /** Filter label to display */
  label: string;

  /** Filter value to display */
  value: string;

  /** Callback when filter is removed */
  onRemove: () => void;

  /** Custom CSS class */
  className?: string;

  /** Variant of the badge */
  variant?: "default" | "secondary" | "outline" | "destructive";
}

/**
 * FilterChip component displays an active filter with a remove button
 */
export function FilterChip({
  label,
  value,
  onRemove,
  className = "",
  variant = "outline",
}: FilterChipProps) {
  return (
    <Badge
      variant={variant}
      className={`group flex items-center gap-1 px-2 py-1 ${className}`}
    >
      <span className="mr-1 font-medium">{label}:</span>
      <span>{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-1 h-4 w-4 rounded-full p-0 text-muted-foreground hover:bg-background/80 hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </Button>
    </Badge>
  );
}
