import { cn } from "@/lib/utils"
import { CellDisplay } from "@/components/json-table/cell-display"
import { cellEditorClass } from "@/components/json-table/cell-editors/editor-classes"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { DoubleClickInput } from "@/components/json-table/cell-editors/primitive-editor"
import {
  dateStringToFormat,
  dateToHTMLDateTimeString,
} from "@/components/json-table/lib/date-display-formatting"

export function DateTimeEditor({
  identity,
  textDraft,
  focus,
  overlays,
  field,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)

  if (!overlays.showInput) {
    return (
      <CellDisplay className="items-center py-0">
        {dateToHTMLDateTimeString(textDraft.activeTextValue || "") || "—"}
      </CellDisplay>
    )
  }

  return (
    <DoubleClickInput
      type="datetime-local"
      value={dateToHTMLDateTimeString(textDraft.activeTextValue || "")}
      onChange={(event) => textDraft.setDraftTextValue(event.target.value)}
      onFocus={() => {
        textDraft.setDraftTextValue(textDraft.committedTextValue)
        focus.setFocusedField(focusId)
        focus.setIsInputFocused(true)
      }}
      onBlur={() => {
        const convertedDate = dateStringToFormat(
          textDraft.draftTextValue,
          "2000-01-01T00:00:00"
        )
        commit.onCommit(convertedDate || null)
        focus.setFocusedField(null)
        focus.setIsInputFocused(false)
      }}
      disabled={!field.isEditable}
      className={cn(
        cellEditorClass,
        focus.focusedField === focusId &&
          "absolute top-0 left-0 z-10 bg-background"
      )}
    />
  )
}
