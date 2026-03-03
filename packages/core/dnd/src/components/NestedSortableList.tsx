"use client";

import type { ReactNode } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableItem } from "./SortableItem";

type BaseItem = { _id: string };

export interface NestedSortableListProps<
  TItem extends BaseItem,
  TLessonId extends string = string,
> {
  title: string;
  items: readonly TItem[];
  emptyMessage: string;
  renderItem: (item: TItem) => ReactNode;
  DropzoneComponent: React.ComponentType<{
    id: string;
    lessonId: TLessonId;
    children: ReactNode;
  }>;
  lessonId: TLessonId;
  dropzoneType: string;
  getSortableData?: (item: TItem) => Record<string, unknown>;
  getItemId?: (item: TItem, index: number) => string;
  className?: string;
  dropzoneDescription?: string;
}

const defaultGetItemId = <TItem extends BaseItem>(item: TItem): string =>
  item._id;

const defaultDropzoneDescription = "Drop and release here to attach new items";

export const NestedSortableList = <
  TItem extends BaseItem,
  TLessonId extends string = string,
>({
  title,
  items,
  emptyMessage,
  renderItem,
  DropzoneComponent,
  lessonId,
  dropzoneType,
  getSortableData,
  getItemId = defaultGetItemId,
  className,
  dropzoneDescription = defaultDropzoneDescription,
}: NestedSortableListProps<TItem, TLessonId>) => {
  const dropzoneId = `${lessonId}-${dropzoneType}`;
  const dropzone = (
    <DropzoneComponent id={dropzoneId} lessonId={lessonId}>
      <p className="text-muted-foreground text-sm">
        {items.length === 0 ? emptyMessage : dropzoneDescription}
      </p>
    </DropzoneComponent>
  );

  const typeForItem = dropzoneType === "topicDropzone" ? "topic" : "quiz";

  return (
    <div className={className ?? "mt-4"}>
      <h4 className="text-md mb-2 font-semibold">{title}:</h4>
      {items.length > 0 ? (
        <>
          <SortableContext
            items={items.map((item, index) => getItemId(item, index))}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item, index) => (
              <SortableItem
                key={getItemId(item, index)}
                id={getItemId(item, index)}
                className="bg-white"
                data={{
                  type: typeForItem,
                  item,
                  ...(getSortableData?.(item) ?? {}),
                }}
              >
                {renderItem(item)}
              </SortableItem>
            ))}
          </SortableContext>
          {dropzone}
        </>
      ) : (
        dropzone
      )}
    </div>
  );
};
