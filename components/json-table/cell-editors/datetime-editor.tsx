import { DataCellControl } from "@/components/ui/data-cell"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"

export function DateTimeEditor({
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
      kind="date-time"
      value={draftValue || null}
      dateTimeZone="preserve"
      draftValue={draftValue}
      activationIntent={editSession.intent}
      isPickerOpen={editSession.isOverlayOpen}
      autoFocus
      className={jsonTableDataCellClass}
      disabled={!cell.isEditable}
      onDraftValueChange={setDraftValue}
      onPickerOpenChange={setOverlayOpen}
      onCommit={(value) => {
        const convertedDate = dateStringToFormat(
          typeof value === "string" ? value : "",
          "2000-01-01T00:00:00"
        )
        commitValue(convertedDate || null)
      }}
      onEditingEnd={closeEditSession}
    />
  )
}
