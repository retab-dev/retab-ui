import { DataCellControl } from "@/components/ui/data-cell"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"

export function TimeEditor({
  cell,
  editSession,
  draftValue,
  setDraftValue,
  setOverlayOpen,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  return (
    <DataCellControl
      kind="time"
      value={draftValue || null}
      draftValue={draftValue}
      activationIntent={editSession.intent}
      isPickerOpen={editSession.isOverlayOpen}
      autoFocus
      className={jsonTableDataCellClass}
      disabled={!cell.isEditable}
      onDraftValueChange={setDraftValue}
      onPickerOpenChange={setOverlayOpen}
      onCommit={(value) => {
        const rawValue = typeof value === "string" ? value : ""
        const finalValue =
          rawValue && /^\d{1,2}:\d{2}$/.test(rawValue)
            ? `${rawValue}:00`
            : rawValue
        const convertedDate = dateStringToFormat(finalValue, "00:00")
        commitValue(convertedDate || null)
        setDraftValue(convertedDate || "")
      }}
      onEditingEnd={closeEditSession}
    />
  )
}
