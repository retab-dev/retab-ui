import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

export interface JsonTableHeaderNode {
  key: string;
  label: string;
  propName: string;
  parentPath: string;
  rawSchema: JSONSchema7Definition;
  schema: JSONSchema7;
  effectiveType: string;
  itemEffectiveType?: string;
  isObject: boolean;
  isArray: boolean;
  canFold: boolean;
  isExpanded: boolean;
  isArrayValuePlaceholder?: boolean;
  children?: JsonTableHeaderNode[];
}

/** Leaf descendants of a header node, or `[node]` when it has no children. */
export function getLeafHeaderNodes(
  node: JsonTableHeaderNode,
): JsonTableHeaderNode[] {
  if (node.children && node.children.length > 0) {
    return node.children.flatMap(getLeafHeaderNodes);
  }
  return [node];
}

export function flattenHeaderNodes(
  nodes: JsonTableHeaderNode[],
): JsonTableHeaderNode[] {
  return nodes.flatMap((node) =>
    node.children && node.children.length > 0
      ? flattenHeaderNodes(node.children)
      : [node],
  );
}

/** Number of header rows = the deepest nesting level of the header tree. */
export function headerTreeDepth(nodes: JsonTableHeaderNode[]): number {
  let max = 0;
  for (const node of nodes) {
    const depth =
      node.children && node.children.length > 0
        ? 1 + headerTreeDepth(node.children)
        : 1;
    if (depth > max) max = depth;
  }
  return max;
}

export interface HeaderGridCell {
  node: JsonTableHeaderNode;
  /** Number of leaf columns this cell spans. */
  colSpan: number;
  /** Leaf count, used to size the cell width. */
  leafCount: number;
  /** Empty continuation cell beneath a shallower leaf, used for grid alignment. */
  isContinuation: boolean;
}

/**
 * Flatten the header tree into visual rows. A group spans its leaves and sits in
 * its own row; a leaf renders in its row and leaves empty continuation cells in
 * every row beneath it so columns stay aligned.
 */
export function buildHeaderGridRows(
  nodes: JsonTableHeaderNode[],
): HeaderGridCell[][] {
  const depth = headerTreeDepth(nodes);
  const rows: HeaderGridCell[][] = Array.from({ length: depth }, () => []);

  const walk = (items: JsonTableHeaderNode[], rowIndex: number) => {
    for (const node of items) {
      const leafCount = Math.max(1, getLeafHeaderNodes(node).length);
      const isGroup = !!(node.children && node.children.length > 0);
      if (isGroup) {
        rows[rowIndex].push({
          node,
          colSpan: leafCount,
          leafCount,
          isContinuation: false,
        });
        walk(node.children as JsonTableHeaderNode[], rowIndex + 1);
      } else {
        rows[rowIndex].push({
          node,
          colSpan: 1,
          leafCount: 1,
          isContinuation: false,
        });
        for (let nextRow = rowIndex + 1; nextRow < depth; nextRow++) {
          rows[nextRow].push({
            node,
            colSpan: 1,
            leafCount: 1,
            isContinuation: true,
          });
        }
      }
    }
  };

  walk(nodes, 0);
  return rows;
}
