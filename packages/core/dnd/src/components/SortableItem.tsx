"use client";

import type { CSSProperties, PropsWithChildren, ReactNode } from "react";

import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cx } from "../utils/cx";
import { useSortable } from "@dnd-kit/sortable";

export interface SortableItemProps extends PropsWithChildren {
  id: string;
  data?: Record<string, unknown>;
  className?: string;
  handleClassName?: string;
  handlePosition?: "left" | "right";
  hideHandle?: boolean;
  handleLabel?: string;
  isOverlayDragging?: boolean;
  renderHandle?: (handle: ReactNode) => ReactNode;
}

export const SortableItem = ({
  id,
  data = {},
  className,
  handleClassName,
  handlePosition = "left",
  hideHandle = false,
  handleLabel = "Drag to reorder",
  isOverlayDragging,
  renderHandle,
  children,
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isOverlayDragging ? 0.5 : 1,
    zIndex: isDragging || isOverlayDragging ? 100 : "auto",
    position: "relative",
    touchAction: "none",
  };

  const handleContent = (
    <div
      className={cx(
        "text-muted-foreground hover:text-foreground flex h-full cursor-grab items-center justify-center",
        handleClassName,
      )}
      {...listeners}
      data-dnd-handle="true"
      aria-label={handleLabel}
    >
      <GripVertical className="h-4 w-4" />
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cx(
        "bg-card flex items-center rounded-md border text-sm shadow-sm",
        className,
      )}
    >
      {handlePosition === "left" ? (
        <>
          {!hideHandle &&
            (renderHandle ? renderHandle(handleContent) : handleContent)}
          <div className="flex-1">{children}</div>
        </>
      ) : (
        <>
          <div className="flex-1">{children}</div>
          {!hideHandle &&
            (renderHandle ? renderHandle(handleContent) : handleContent)}
        </>
      )}
    </div>
  );
};
