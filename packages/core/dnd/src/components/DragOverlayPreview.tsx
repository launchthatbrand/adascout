"use client";

import type { Active } from "@dnd-kit/core";
import type { ReactNode } from "react";

import { cx } from "../utils/cx";

export interface DragOverlayItem {
  id: string;
  label: ReactNode;
  type?: string;
  className?: string;
  metadata?: Record<string, unknown>;
}

export interface DragOverlayPreviewProps {
  active: Active | null;
  resolveItem: (active: Active) => DragOverlayItem | null | undefined;
  renderItem?: (item: DragOverlayItem) => ReactNode;
  fallback?: ReactNode;
  className?: string;
}

const defaultRenderItem = (item: DragOverlayItem, className?: string) => (
  <div
    className={cx(
      "pointer-events-none cursor-grabbing rounded border bg-white px-3 py-2 text-sm shadow-lg",
      className,
      item.className,
    )}
  >
    {item.label}
  </div>
);

export const DragOverlayPreview = ({
  active,
  resolveItem,
  renderItem,
  fallback = null,
  className,
}: DragOverlayPreviewProps) => {
  if (!active) {
    return null;
  }

  const item = resolveItem(active);
  if (!item) {
    return <>{fallback}</>;
  }

  const content = renderItem
    ? renderItem(item)
    : defaultRenderItem(item, className);

  return <>{content}</>;
};
