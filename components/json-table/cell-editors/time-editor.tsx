import { cn } from "@/lib/utils"
import { CellDisplay } from "@/components/json-table/cell-display"
import { cellEditorClass } from "@/components/json-table/cell-editors/editor-classes"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { DoubleClickInput } from "@/components/json-table/cell-editors/primitive-editor"
import {
  dateStringToFormat,
  dateToHTMLTimeString,
} from "@/components/json-table/lib/date-display-formatting"

export function TimeEditor({
  identity,
  field,
  textDraft,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)

  if (!overlays.showInput) {
    return (
      <CellDisplay className="items-center py-2">
        {dateToHTMLTimeString(textDraft.activeTextValue || "") || "—"}
      </CellDisplay>
    )
  }

  return (
    <DoubleClickInput
      type="time"
      value={dateToHTMLTimeString(textDraft.activeTextValue || "")}
      onChange={(event) => textDraft.setDraftTextValue(event.target.value)}
      onBlur={() => {
        let finalValue = textDraft.draftTextValue
        if (
          textDraft.draftTextValue &&
          /^\d{1,2}:\d{2}$/.test(textDraft.draftTextValue)
        ) {
          finalValue = textDraft.draftTextValue + ":00"
          textDraft.setDraftTextValue(finalValue)
        }
        const convertedDate = dateStringToFormat(finalValue, "00:00")
        commit.onCommit(convertedDate || null)
        textDraft.setDraftTextValue(convertedDate || "")
        focus.setFocusedField(null)
        focus.setIsInputFocused(false)
      }}
      onFocus={() => {
        textDraft.setDraftTextValue(textDraft.committedTextValue)
        focus.setFocusedField(focusId)
        focus.setIsInputFocused(true)
      }}
      disabled={!field.isEditable}
      className={cn(
        cellEditorClass,
        !field.effectiveValue && "text-muted-foreground",
        focus.focusedField === focusId && "absolute top-0 left-0 z-10"
      )}
    />
  )
}
