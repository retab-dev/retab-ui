import * as React from "react"

import { DataCellControl } from "@/components/ui/data-cell"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"

export function TextEditor({
  cell,
  editSession,
  draftValue,
  setDraftValue,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  React.useEffect(() => {
    if (editSession.intent.type !== "keyboard") return
    if (editSession.intent.key.length !== 1) return
    setDraftValue(editSession.intent.key)
  }, [editSession.id, editSession.intent, setDraftValue])

  return (
    <DataCellControl
      kind="text"
      value={draftValue || null}
      draftValue={draftValue}
      activationIntent={editSession.intent}
      autoFocus
      className={jsonTableDataCellClass}
      disabled={!cell.isEditable}
      onDraftValueChange={setDraftValue}
      onCommit={commitValue}
      onEditingEnd={closeEditSession}
    />
  )
}
