"use client";

import type { ReactNode } from "react";
import { useDndContext, useDroppable } from "@dnd-kit/core";

import { cx } from "../utils/cx";

export interface DropzoneProps {
  id: string;
  acceptedTypes: string[];
  kind: string;
  data?: Record<string, unknown>;
  className?: string;
  activeClassName?: string;
  disabledClassName?: string;
  enabledText?: string;
  disabledText?: string;
  children?: ReactNode;
}

export const Dropzone = ({
  id,
  acceptedTypes,
  kind,
  data = {},
  className,
  activeClassName = "border-primary bg-primary/10",
  disabledClassName = "border-dashed border-muted/30 bg-muted/5 opacity-50 cursor-not-allowed",
  enabledText = "Drop here",
  disabledText = "Cannot drop here",
  children,
}: DropzoneProps) => {
  const { active } = useDndContext();
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { kind, type: `dropzone-${id}`, ...data },
    disabled:
      !active || !acceptedTypes.includes(active.data.current?.type as string),
  });

  const isActiveType =
    active && acceptedTypes.includes(active.data.current?.type as string);
  const isDisabled = !isActiveType;

  const currentClassName = cx(
    "flex min-h-[60px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-all duration-150",
    className,
    isDisabled && active ? disabledClassName : "border-muted-foreground/30",
    isOver && isActiveType ? activeClassName : "",
  );

  const currentText = isDisabled && active ? disabledText : enabledText;

  return (
    <div ref={setNodeRef} className={currentClassName} data-dropzone-id={id}>
      <span
        className={cx(
          "text-xs font-medium",
          isDisabled && active ? "text-muted-foreground" : "text-primary",
        )}
      >
        {currentText}
      </span>
      {children}
    </div>
  );
};
