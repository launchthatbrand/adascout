"use client";

import type {
  CollisionDetection,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  SensorDescriptor,
} from "@dnd-kit/core";
import type { PropsWithChildren } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface BuilderDndProviderProps extends PropsWithChildren {
  sensors?: SensorDescriptor<any>[];
  pointerActivationDistance?: number;
  collisionDetection?: CollisionDetection;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
}

export const BuilderDndProvider = ({
  children,
  sensors: overrideSensors,
  pointerActivationDistance = 8,
  collisionDetection = closestCenter,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: BuilderDndProviderProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint:
        pointerActivationDistance > 0
          ? { distance: pointerActivationDistance }
          : undefined,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      sensors={overrideSensors ?? sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {children}
    </DndContext>
  );
};
