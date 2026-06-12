import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"

export function TimeEditor({
  identity,
  field,
  textDraft,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)

  return (
    <JsonTableScalarCell
      kind="time"
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={textDraft.activeTextValue ?? null}
      draftValue={textDraft.activeTextValue}
      onDraftValueChange={textDraft.setDraftTextValue}
      onCommit={(value) => {
        const rawValue = typeof value === "string" ? value : ""
        const finalValue =
          rawValue && /^\d{1,2}:\d{2}$/.test(rawValue)
            ? `${rawValue}:00`
            : rawValue
        const convertedDate = dateStringToFormat(finalValue, "00:00")
        commit.onCommit(convertedDate || null)
        textDraft.setDraftTextValue(convertedDate || "")
      }}
      onBlur={() => {
        focus.setFocusedField(null)
        focus.setIsInputFocused(false)
      }}
      onFocus={() => {
        textDraft.setDraftTextValue(textDraft.committedTextValue)
        focus.setFocusedField(focusId)
        focus.setIsInputFocused(true)
      }}
      disabled={!field.isEditable}
    />
  )
}
