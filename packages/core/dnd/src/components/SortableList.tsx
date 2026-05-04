"use client";

import type { SortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableItem } from "./SortableItem";

export interface SortableListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getId?: (item: T, index: number) => string;
  getData?: (item: T, index: number) => Record<string, unknown>;
  strategy?: SortingStrategy;
  itemClassName?: string;
  type?: string;
}

const fallbackGetId = (item: unknown, index: number): string => {
  if (
    typeof item === "object" &&
    item !== null &&
    ("id" in item || "_id" in item)
  ) {
    const value =
      ("id" in item ? (item as { id?: unknown }).id : undefined) ??
      ("_id" in item ? (item as { _id?: unknown })._id : undefined);
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return `sortable-item-${index}`;
};

export const SortableList = <T,>({
  items,
  renderItem,
  getId,
  getData,
  strategy = verticalListSortingStrategy,
  itemClassName,
  type = "sortable-item",
}: SortableListProps<T>) => {
  const resolveId = getId ?? fallbackGetId;
  const ids = items.map((item, index) => resolveId(item, index));

  return (
    <SortableContext items={ids} strategy={strategy}>
      {items.map((item, index) => {
        const id = ids[index]!;
        const baseData = getData?.(item, index) ?? {};
        return (
          <SortableItem
            key={id}
            id={id}
            className={itemClassName}
            data={{ type, ...baseData }}
          >
            {renderItem(item, index)}
          </SortableItem>
        );
      })}
    </SortableContext>
  );
};
