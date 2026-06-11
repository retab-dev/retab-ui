import type * as React from "react";

import type { TableDocument } from "@/components/json-table/lib/projects-types";

/**
 * Local replacements for the few `@tanstack/react-table` shapes the JSON table
 * actually used. The table only ever needed a nested column tree to draw the
 * header and the document to render cells — never sorting, filtering, a row
 * model, or `flexRender`. These plain types cover that surface with no library.
 */

/** What a body cell reads off the "row": just the document. */
export interface RowLike {
  original: TableDocument;
}

/** The slice of the old TanStack `Column` API our header renderers call. */
export interface HeaderColumnApi {
  /** Leaf descendants of this column (used only for `.length`). */
  getLeafColumns: () => TableColumn[];
}

/** A node in the schema-derived header tree. */
export interface TableColumn {
  accessorKey?: string;
  /** Renders the header cell. Receives a {@link HeaderColumnApi} shim. */
  header?: (ctx: { column: HeaderColumnApi }) => React.ReactNode;
  /** Child columns, when this node is a group (object/array). */
  columns?: TableColumn[];
  /** Vestigial flag carried on the node; not read by the renderer. */
  foldable?: boolean;
}

/** Leaf descendants of a column node, or `[col]` when it has no children. */
export function getLeafColumns(col: TableColumn): TableColumn[] {
  if (col.columns && col.columns.length > 0) {
    return col.columns.flatMap(getLeafColumns);
  }
  return [col];
}

/** Number of header rows = the deepest nesting level of the column tree. */
export function columnTreeDepth(columns: TableColumn[]): number {
  let max = 0;
  for (const col of columns) {
    const d =
      col.columns && col.columns.length > 0
        ? 1 + columnTreeDepth(col.columns)
        : 1;
    if (d > max) max = d;
  }
  return max;
}

/** A single rendered header cell within a header row. */
export interface HeaderCell {
  col: TableColumn;
  /** Number of leaf columns this cell spans. */
  colSpan: number;
  /** Leaf count, used to size the cell width. */
  leafCount: number;
  /** True for the empty continuation cells beneath a shallow leaf. */
  placeholder: boolean;
}

/**
 * Flatten the column tree into header rows (top → bottom), reproducing what
 * TanStack's `getHeaderGroups()` produced for this table: a group spans its
 * leaves and sits in its own row; a leaf renders in its row and leaves empty
 * placeholder cells in every row beneath it so columns stay aligned.
 */
export function buildHeaderRows(columns: TableColumn[]): HeaderCell[][] {
  const depth = columnTreeDepth(columns);
  const rows: HeaderCell[][] = Array.from({ length: depth }, () => []);

  const walk = (cols: TableColumn[], d: number) => {
    for (const col of cols) {
      const leafCount = Math.max(1, getLeafColumns(col).length);
      const isGroup = !!(col.columns && col.columns.length > 0);
      if (isGroup) {
        rows[d].push({ col, colSpan: leafCount, leafCount, placeholder: false });
        walk(col.columns as TableColumn[], d + 1);
      } else {
        rows[d].push({ col, colSpan: 1, leafCount: 1, placeholder: false });
        for (let r = d + 1; r < depth; r++) {
          rows[r].push({ col, colSpan: 1, leafCount: 1, placeholder: true });
        }
      }
    }
  };

  walk(columns, 0);
  return rows;
}
