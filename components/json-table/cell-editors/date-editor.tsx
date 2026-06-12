import { format } from "date-fns"

import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"

function safeParseISO(dateString: string | null | undefined): Date | undefined {
  return parseDateStringAsLocal(dateString) ?? undefined
}

export function DateEditor({
  identity,
  field,
  textDraft,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)
  const date = safeParseISO(textDraft.activeTextValue)

  return (
    <JsonTableScalarCell
      kind="date"
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={textDraft.activeTextValue ?? null}
      draftValue={textDraft.activeTextValue}
      formatValue={() => (date ? format(date, "PP") : "")}
      placeholder="Pick a date"
      onDraftValueChange={textDraft.setDraftTextValue}
      onCommit={(value) => {
        const convertedDate = dateStringToFormat(
          typeof value === "string" ? value : "",
          "2000-01-01"
        )
        commit.onCommit(convertedDate || null)
      }}
      onFocus={() => {
        textDraft.setDraftTextValue(textDraft.committedTextValue)
        focus.setFocusedField(focusId)
        focus.setIsInputFocused(true)
      }}
      onBlur={() => {
        focus.setFocusedField(null)
        focus.setIsInputFocused(false)
      }}
      disabled={!field.isEditable}
    />
  )
}
