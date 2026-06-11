import { cn } from "@/lib/utils"
import { CellDisplay } from "@/components/json-table/cell-display"
import { cellEditorClass } from "@/components/json-table/cell-editors/editor-classes"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { DoubleClickInput } from "@/components/json-table/cell-editors/primitive-editor"

export function NumberEditor({
  identity,
  field,
  textDraft,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)
  const isInteger = field.fieldMetadata.kind === "integer"

  if (!overlays.showInput) {
    return (
      <CellDisplay className="items-center py-2">
        {textDraft.activeTextValue ?? "—"}
      </CellDisplay>
    )
  }

  return (
    <DoubleClickInput
      type="number"
      value={textDraft.activeTextValue ?? null}
      onChange={(event) => {
        const numValue = isInteger
          ? parseInt(event.target.value)
          : parseFloat(event.target.value)
        textDraft.setDraftTextValue(
          Number.isNaN(numValue) ? "" : numValue.toString()
        )
      }}
      onFocus={() => {
        textDraft.setDraftTextValue(textDraft.committedTextValue)
        focus.setFocusedField(focusId)
        focus.setIsInputFocused(true)
      }}
      onBlur={() => {
        const numValue = isInteger
          ? parseInt(textDraft.draftTextValue)
          : parseFloat(textDraft.draftTextValue)
        commit.onCommit(Number.isNaN(numValue) ? null : numValue)
        focus.setFocusedField(null)
        focus.setIsInputFocused(false)
      }}
      disabled={!field.isEditable}
      className={cn(
        cellEditorClass,
        focus.focusedField === focusId && "absolute top-0 left-0 z-10"
      )}
    />
  )
}
