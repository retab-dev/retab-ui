import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"

export function useJsonTableCellProfiler({
  props,
  cellField,
}: {
  props: JsonTableCellProps
  cellField: JsonTableCellField
}) {
  recordJsonTableRender(
    "EditableJsonTableCell",
    cellField.materializedFieldPath ?? props.column.key,
    {
      primitiveActiveFieldPath: cellField.primitiveActiveCell?.fieldPath ?? null,
      structuredEditSessionFieldPath:
        props.structuredEditSession?.fieldPath ?? null,
      fieldKind: cellField.fieldMetadata?.kind ?? null,
      isEditable: cellField.isJsonEditable,
      isEditing: cellField.isCellEditing,
      valueType:
        cellField.cellValue === null ? "null" : typeof cellField.cellValue,
    }
  )
}
