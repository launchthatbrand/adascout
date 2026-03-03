"use client";

import type { ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export interface DraggableItemProps {
  id: string;
  type: string;
  children: ReactNode;
  className?: string;
  data?: Record<string, unknown>;
}

export const DraggableItem = ({
  id,
  type,
  children,
  className,
  data = {},
}: DraggableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: { type, ...data },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={className}
      aria-label={`Draggable ${type}: ${id}`}
    >
      {children}
    </div>
  );
};
