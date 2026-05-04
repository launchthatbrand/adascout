"use client";

import { stratify, tree } from "d3-hierarchy";

export interface HierarchyLayoutNode {
  id: string;
  parentId?: string;
}

export interface HierarchyLayoutPoint {
  x: number;
  y: number;
}

export interface HierarchyLayoutOptions {
  rootId: string;
  canvasWidth: number;
  nodeWidth: number;
  levelHeight: number;
  topOffset?: number;
  siblingSpacing?: number;
}

export const computeHierarchyLayout = (
  nodes: HierarchyLayoutNode[],
  options: HierarchyLayoutOptions,
): Record<string, HierarchyLayoutPoint> => {
  const {
    rootId,
    canvasWidth,
    nodeWidth,
    levelHeight,
    topOffset = 40,
    siblingSpacing = 120,
  } = options;

  const uniqueById = new Map<string, HierarchyLayoutNode>();
  for (const node of nodes) {
    uniqueById.set(node.id, node);
  }
  if (!uniqueById.has(rootId)) {
    uniqueById.set(rootId, { id: rootId });
  }

  const virtualRootId = "__virtual_root__";
  const stratifyRows = [
    { id: virtualRootId, parentId: undefined as string | undefined },
    ...Array.from(uniqueById.values()).map((node) => ({
      id: node.id,
      parentId: node.parentId ?? virtualRootId,
    })),
  ];

  const root = stratify<{ id: string; parentId?: string }>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(stratifyRows);

  const layout = tree<{ id: string; parentId?: string }>().nodeSize([
    nodeWidth + siblingSpacing,
    levelHeight,
  ]);
  const positioned = layout(root);

  const points: Record<string, HierarchyLayoutPoint> = {};
  for (const node of positioned.descendants()) {
    const id = String(node.id);
    if (id === virtualRootId) continue;
    points[id] = {
      x: canvasWidth / 2 + node.x - nodeWidth / 2,
      y: topOffset + Math.max(0, node.y - levelHeight),
    };
  }
  return points;
};
