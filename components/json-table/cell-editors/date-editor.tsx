import { format } from "date-fns"

import { DataCellControl } from "@/components/ui/data-cell"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"

function safeParseISO(dateString: string | null | undefined): Date | undefined {
  return parseDateStringAsLocal(dateString) ?? undefined
}

export function DateEditor({
  cell,
  editSession,
  draftValue,
  setDraftValue,
  setOverlayOpen,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  const date = safeParseISO(draftValue)

  return (
    <DataCellControl
      kind="date"
      value={draftValue || null}
      draftValue={draftValue}
      activationIntent={editSession.intent}
      isPickerOpen={editSession.isOverlayOpen}
      autoFocus
      className={jsonTableDataCellClass}
      disabled={!cell.isEditable}
      formatValue={() => (date ? format(date, "PP") : "")}
      placeholder="Pick a date"
      onDraftValueChange={setDraftValue}
      onPickerOpenChange={setOverlayOpen}
      onCommit={(value) => {
        const convertedDate = dateStringToFormat(
          typeof value === "string" ? value : "",
          "2000-01-01"
        )
        commitValue(convertedDate || null)
      }}
      onEditingEnd={closeEditSession}
    />
  )
}
