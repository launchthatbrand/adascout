export { DraggableItem } from "./components/DraggableItem";
export type { DraggableItemProps } from "./components/DraggableItem";

export { Dropzone } from "./components/Dropzone";
export type { DropzoneProps } from "./components/Dropzone";

export { DroppableArea } from "./components/DroppableArea";
export type { DroppableAreaProps } from "./components/DroppableArea";

export { BuilderDndProvider } from "./providers/BuilderDndProvider";

export { SortableItem } from "./components/SortableItem";
export type { SortableItemProps } from "./components/SortableItem";

export { SortableList } from "./components/SortableList";
export type { SortableListProps } from "./components/SortableList";

export { DragOverlayPreview } from "./components/DragOverlayPreview";
export type {
  DragOverlayPreviewProps,
  DragOverlayItem,
} from "./components/DragOverlayPreview";

export { NestedSortableList } from "./components/NestedSortableList";
export type { NestedSortableListProps } from "./components/NestedSortableList";

export { computeHierarchyLayout } from "./layout/hierarchy";
export type {
  HierarchyLayoutNode,
  HierarchyLayoutOptions,
  HierarchyLayoutPoint,
} from "./layout/hierarchy";

// Re-export commonly used dnd-kit helpers/types so apps can depend on `@acme/dnd`
// instead of importing directly from `@dnd-kit/*`.
export type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
export type { SortingStrategy } from "@dnd-kit/sortable";
export { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
