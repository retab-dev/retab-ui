import * as React from "react";

import { jsonTableDisplayText } from "@/components/json-table/json-table-display-value";
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler";
import {
  projectDocumentRows,
  type ProjectedRow,
} from "@/components/json-table/lib/document-projection";
import { shareProjectedRows } from "@/components/json-table/lib/projected-row-sharing";
import type { TableDocument } from "@/components/json-table/lib/projects-types";
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata";

export type SingleFileTableProjectionModel = {
  projectedRows: ProjectedRow[];
  rowCount: number;
};

export function useSingleFileTableProjectionModel({
  document,
  isJsonEditable,
  visibleFieldMetadata,
  visibleKeys,
}: {
  document: TableDocument;
  isJsonEditable: boolean;
  visibleFieldMetadata: (FieldMetadata | undefined)[];
  visibleKeys: string[];
}): SingleFileTableProjectionModel {
  const projectedRowsCacheRef = React.useRef<ProjectedRow[]>([]);

  const projectedRows = React.useMemo(() => {
    markJsonTableProfile("project-rows-start", {
      visiblePaths: visibleKeys.length,
      isJsonEditable,
    });
    const rows = projectDocumentRows({
      document,
      visiblePaths: visibleKeys,
      includeArrayAddRows: isJsonEditable,
    });
    if (!isJsonEditable) {
      for (const row of rows) {
        for (
          let columnIndex = 0;
          columnIndex < row.cells.length;
          columnIndex++
        ) {
          const cell = row.cells[columnIndex];
          if (!cell) continue;

          const fieldMetadata = visibleFieldMetadata[columnIndex];
          if (!fieldMetadata) continue;

          cell.displayValue = jsonTableDisplayText({
            fieldMetadata,
            jsonValue: cell.value,
          });
        }
      }
    }
    const sharedRows = shareProjectedRows(projectedRowsCacheRef.current, rows);
    projectedRowsCacheRef.current = sharedRows;
    markJsonTableProfile("project-rows-end", {
      rowCount: sharedRows.length,
    });
    return sharedRows;
  }, [document, visibleFieldMetadata, visibleKeys, isJsonEditable]);

  return React.useMemo(
    () => ({
      projectedRows,
      rowCount: Math.max(projectedRows.length, 1),
    }),
    [projectedRows],
  );
}
