import type { DataCellKind } from "@/components/ui/data-cell";
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types";
import {
  jsonTableCellId,
  type JsonTableCellId,
  type JsonTablePrimitiveActiveCell,
} from "@/components/json-table/json-table-edit-session";
import { useJsonTablePrimitiveActiveCell } from "@/components/json-table/json-table-primitive-active-cell-store";
import { jsonTablePrimitiveKind } from "@/components/json-table/json-table-primitive-kind";
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata";

export type JsonTableCellField = {
  cellId: JsonTableCellId | null;
  cellValue: unknown;
  cellWidth: number;
  dataCellKind: DataCellKind | null;
  fieldMetadata: FieldMetadata | undefined;
  isCellEditing: boolean;
  isJsonEditable: boolean;
  isPrimitiveActive: boolean;
  isPrimitiveCell: boolean;
  isStructuredActive: boolean;
  materializedFieldPath: string | undefined;
  primitiveActiveCell: JsonTablePrimitiveActiveCell | null;
};

export function useJsonTableCellField(
  props: JsonTableCellProps,
): JsonTableCellField {
  const { cellProjection, primitiveEditing, structuredEditing } = props;
  const materializedFieldPath =
    cellProjection.projectedCell?.materializedFieldPath;
  const fieldMetadata =
    cellProjection.column.fieldMetadata ??
    (materializedFieldPath
      ? getFieldMetadata(cellProjection.schema, materializedFieldPath)
      : undefined);
  const dataCellKind = fieldMetadata
    ? jsonTablePrimitiveKind(fieldMetadata)
    : null;
  const cellId = materializedFieldPath
    ? jsonTableCellId(cellProjection.docId, materializedFieldPath)
    : null;
  const isPrimitiveCell = Boolean(dataCellKind);
  const isJsonEditable = cellProjection.isJsonEditable;
  const primitiveActiveCell = useJsonTablePrimitiveActiveCell({
    cellId,
    store: primitiveEditing.activeCellStore,
  });
  const isPrimitiveActive = Boolean(isJsonEditable && primitiveActiveCell);
  const isStructuredActive = Boolean(
    isJsonEditable && cellId && structuredEditing.session?.cellId === cellId,
  );

  return {
    cellId,
    cellValue: cellProjection.projectedCell?.value,
    cellWidth: cellProjection.column.widthPx,
    dataCellKind,
    fieldMetadata,
    isCellEditing: isPrimitiveCell ? isPrimitiveActive : isStructuredActive,
    isJsonEditable,
    isPrimitiveActive,
    isPrimitiveCell,
    isStructuredActive,
    materializedFieldPath,
    primitiveActiveCell,
  };
}
