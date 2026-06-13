import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"

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

  return (
    <JsonTableScalarCell
      kind={isInteger ? "integer" : "number"}
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={textDraft.activeTextValue ?? null}
      autoFocus={overlays.autoFocus}
      draftValue={textDraft.activeTextValue}
      onDraftValueChange={textDraft.setDraftTextValue}
      onCommit={commit.onCommit}
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
