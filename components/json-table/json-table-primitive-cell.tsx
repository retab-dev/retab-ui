import * as React from "react"

import { DataCell, type DataCellValueMeta } from "@/components/ui/data-cell"
import { createJsonTableDataCellProps } from "@/components/json-table/json-table-data-cell-model"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"

export function JsonTablePrimitiveCell({
  effectiveValue,
  fieldMetadata,
  isActive,
  isEditable,
  onActiveChange,
  onCommit,
  onEditingEnd,
}: {
  effectiveValue: unknown
  fieldMetadata: FieldMetadata
  isActive: boolean
  isEditable: boolean
  onActiveChange: (active: boolean) => void
  onCommit: (value: unknown, meta: DataCellValueMeta) => void
  onEditingEnd: () => void
}) {
  const cellRootRef = React.useRef<HTMLDivElement>(null)
  const dataCellProps = createJsonTableDataCellProps({
    active: isActive,
    autoFocus: isActive,
    fieldMetadata,
    isEditable,
    onActiveChange,
    onCommit,
    onEditingEnd,
    value: effectiveValue,
  })

  useElevatedVirtualRow({
    cellRootRef,
    isElevated: isActive,
  })

  return (
    <div ref={cellRootRef} className="relative z-20 h-full w-full">
      <DataCell {...dataCellProps} />
    </div>
  )
}
