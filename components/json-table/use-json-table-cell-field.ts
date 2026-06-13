import type { DataCellKind } from "@/components/ui/data-cell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import {
  jsonTableCellId,
  type JsonTableCellId,
} from "@/components/json-table/json-table-edit-session"
import { jsonTablePrimitiveKind } from "@/components/json-table/json-table-primitive-kind"
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata"

export type JsonTableCellField = {
  cellId: JsonTableCellId | null
  cellValue: unknown
  cellWidth: number
  dataCellKind: DataCellKind | null
  fieldMetadata: FieldMetadata | undefined
  isCellEditing: boolean
  isJsonEditable: boolean
  isPrimitiveActive: boolean
  isPrimitiveCell: boolean
  isStructuredActive: boolean
  materializedFieldPath: string | undefined
}

export function useJsonTableCellField(
  props: JsonTableCellProps
): JsonTableCellField {
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const fieldMetadata =
    props.column.fieldMetadata ??
    (materializedFieldPath
      ? getFieldMetadata(props.schema, materializedFieldPath)
      : undefined)
  const dataCellKind = fieldMetadata
    ? jsonTablePrimitiveKind(fieldMetadata)
    : null
  const cellId = materializedFieldPath
    ? jsonTableCellId(props.docId, materializedFieldPath)
    : null
  const isPrimitiveCell = Boolean(dataCellKind)
  const isJsonEditable = props.isJsonEditable
  const isPrimitiveActive = Boolean(
    isJsonEditable && cellId && props.primitiveActiveCell?.cellId === cellId
  )
  const isStructuredActive = Boolean(
    isJsonEditable && cellId && props.structuredEditSession?.cellId === cellId
  )

  return {
    cellId,
    cellValue: props.projectedCell?.value,
    cellWidth: props.column.widthPx,
    dataCellKind,
    fieldMetadata,
    isCellEditing: isPrimitiveCell ? isPrimitiveActive : isStructuredActive,
    isJsonEditable,
    isPrimitiveActive,
    isPrimitiveCell,
    isStructuredActive,
    materializedFieldPath,
  }
}
