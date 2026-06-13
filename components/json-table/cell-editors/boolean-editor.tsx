import * as React from "react"

import { DataCellControl } from "@/components/ui/data-cell"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import { isPointerActivationIntent } from "@/components/json-table/json-table-edit-session"

export function BooleanEditor({
  cell,
  editSession,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  const checked = Boolean(cell.effectiveValue)

  React.useEffect(() => {
    const shouldToggle =
      isPointerActivationIntent(editSession.intent) ||
      editSession.intent.type === "programmatic" ||
      (editSession.intent.type === "keyboard" && editSession.intent.key === " ")
    if (!cell.isEditable || !shouldToggle) return

    commitValue(!checked)
    closeEditSession()
  }, [
    cell.isEditable,
    checked,
    closeEditSession,
    commitValue,
    editSession.id,
    editSession.intent,
  ])

  return (
    <DataCellControl
      kind="boolean"
      value={checked}
      activationIntent={editSession.intent}
      autoFocus
      className={jsonTableDataCellClass}
      disabled={!cell.isEditable}
      onCommit={(value) => {
        commitValue(value)
        closeEditSession()
      }}
      onEditingEnd={closeEditSession}
    />
  )
}
