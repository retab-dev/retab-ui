import * as React from "react"

import { DataCellControl } from "@/components/ui/data-cell"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"

const JSON_TABLE_NUMBER_KEY = /^[0-9.+-]$/

export function NumberEditor({
  cell,
  editSession,
  draftValue,
  setDraftValue,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  const isInteger = cell.fieldMetadata.kind === "integer"

  React.useEffect(() => {
    if (editSession.intent.type !== "keyboard") return
    if (!JSON_TABLE_NUMBER_KEY.test(editSession.intent.key)) return
    setDraftValue(editSession.intent.key)
  }, [editSession.id, editSession.intent, setDraftValue])

  return (
    <DataCellControl
      kind={isInteger ? "integer" : "number"}
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
