import * as React from "react"

import type {
  DataCellActivationIntent,
  DataCellEditorHandle,
  DataCellValueMeta,
} from "@/components/ui/data-cell"
import { JsonTableDataCell } from "@/components/json-table/json-table-display-cell"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"

export type JsonTablePrimitiveCellProps = {
  activationRequest?: DataCellActivationIntent
  effectiveValue: unknown
  fieldMetadata: FieldMetadata
  isActive: boolean
  isEditable: boolean
  onActiveChange: (active: boolean) => void
  onCommit: (value: unknown, meta: DataCellValueMeta) => void
  onEditingEnd: () => void
  onEditorHandleChange: (handle: DataCellEditorHandle | null) => void
}

export function JsonTablePrimitiveCell({
  activationRequest,
  effectiveValue,
  fieldMetadata,
  isActive,
  isEditable,
  onActiveChange,
  onCommit,
  onEditingEnd,
  onEditorHandleChange,
}: JsonTablePrimitiveCellProps) {
  const cellRootRef = React.useRef<HTMLDivElement>(null)

  useElevatedVirtualRow({
    cellRootRef,
    isInputFocused: isActive,
    isSelectOpen: false,
  })

  return (
    <div ref={cellRootRef} className="relative z-20 h-full w-full">
      <JsonTableDataCell
        fieldMetadata={fieldMetadata}
        value={effectiveValue}
        mode={isActive ? "edit" : "display"}
        active={isActive}
        isEditable={isEditable}
        activationIntent={activationRequest}
        autoFocus={isActive}
        onActiveChange={onActiveChange}
        onEditorHandleChange={onEditorHandleChange}
        onCommit={onCommit}
        onEditingEnd={onEditingEnd}
      />
    </div>
  )
}
