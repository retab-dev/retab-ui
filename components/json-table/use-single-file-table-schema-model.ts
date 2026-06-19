import * as React from "react";
import type { JSONSchema7 } from "json-schema";

import { buildFixedGridColumns } from "@/components/ui/fixed-grid-columns";
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types";
import { flattenHeaderNodes } from "@/components/json-table/lib/header-nodes";
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes";
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata";
import { buildHeaderNodesFromSchema } from "@/components/json-table/lib/schema-header-nodes";
import {
  getColumnWidthPx,
  useSheetOptionsStore,
} from "@/components/json-table/table-options-store";
import type { ColumnWidth } from "@/components/json-table/table-options-store";

export type SingleFileTableSchemaModel = {
  columnWidth: ColumnWidth;
  draggedItemKeyRef: React.RefObject<string | null>;
  draggedItemParentPathRef: React.RefObject<string | null>;
  headerNodes: JsonTableHeaderNode[];
  stopAt: string[];
  setStopAt: (stopAt: string[]) => void;
  visibleColumns: VisibleColumn[];
  visibleFieldMetadata: (FieldMetadata | undefined)[];
  visibleKeys: string[];
};

export function useSingleFileTableSchemaModel({
  columnWidth: propColumnWidth,
  schema,
}: {
  columnWidth?: ColumnWidth;
  schema: JSONSchema7;
}): SingleFileTableSchemaModel {
  const { columnWidth: storeColumnWidth } = useSheetOptionsStore();
  const columnWidth = propColumnWidth ?? storeColumnWidth;
  const [stopAt, setStopAt] = React.useState<string[]>([]);
  const draggedItemKeyRef = React.useRef<string | null>(null);
  const draggedItemParentPathRef = React.useRef<string | null>(null);

  const [headerNodes] = React.useMemo(() => {
    return buildHeaderNodesFromSchema(schema, stopAt);
  }, [schema, stopAt]);

  const visibleKeys = React.useMemo(() => {
    return flattenHeaderNodes(headerNodes).map((node) => node.key);
  }, [headerNodes]);

  const visibleFieldMetadata = React.useMemo(() => {
    return visibleKeys.map((key) => getFieldMetadata(schema, key));
  }, [schema, visibleKeys]);

  const visibleColumns = React.useMemo(() => {
    const widthPx = getColumnWidthPx(columnWidth);
    return buildFixedGridColumns({
      items: visibleKeys,
      getKey: (key) => key,
      getWidthPx: (key) => (key.endsWith("__delete") ? 50 : widthPx),
      getMetadata: (_key, index) => visibleFieldMetadata[index],
    }).map((column) => ({
      ...column,
      fieldMetadata: column.metadata,
    }));
  }, [columnWidth, visibleFieldMetadata, visibleKeys]);

  return React.useMemo(
    () => ({
      columnWidth,
      draggedItemKeyRef,
      draggedItemParentPathRef,
      headerNodes,
      stopAt,
      setStopAt,
      visibleColumns,
      visibleFieldMetadata,
      visibleKeys,
    }),
    [
      columnWidth,
      headerNodes,
      stopAt,
      visibleColumns,
      visibleFieldMetadata,
      visibleKeys,
    ],
  );
}
