"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

import { cx } from "../utils/cx";

export interface DroppableAreaProps {
  id: string;
  type: string;
  className?: string;
  children: ReactNode;
}

export const DroppableArea = ({
  id,
  type,
  className,
  children,
}: DroppableAreaProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type },
  });

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "transition-colors duration-150",
        className,
        isOver && "bg-primary/5 ring-primary/60 ring-2",
      )}
      data-droppable-type={type}
    >
      {children}
    </div>
  );
};
