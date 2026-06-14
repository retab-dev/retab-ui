import { DataCell } from "@/components/ui/data-cell"
import { createJsonTableDataCellProps } from "@/components/json-table/json-table-data-cell-model"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export type JsonTableDisplayCellProps = {
  fieldMetadata: FieldMetadata
  value: unknown
}

export function JsonTableDisplayCell({
  fieldMetadata,
  value,
}: JsonTableDisplayCellProps) {
  const dataCellProps = createJsonTableDataCellProps({
    fieldMetadata,
    value,
  })

  return <DataCell {...dataCellProps} />
}
