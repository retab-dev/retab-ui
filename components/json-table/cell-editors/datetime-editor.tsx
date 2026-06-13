import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"

export function DateTimeEditor({
  identity,
  textDraft,
  focus,
  field,
  overlays,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)

  return (
    <JsonTableScalarCell
      kind="date-time"
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={textDraft.activeTextValue ?? null}
      dateTimeZone="preserve"
      draftValue={textDraft.activeTextValue}
      autoFocus={overlays.autoFocus}
      onDraftValueChange={textDraft.setDraftTextValue}
      onCommit={(value) => {
        const convertedDate = dateStringToFormat(
          typeof value === "string" ? value : "",
          "2000-01-01T00:00:00"
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
