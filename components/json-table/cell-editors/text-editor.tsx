import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"

export function TextEditor({
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
      kind="text"
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={textDraft.activeTextValue ?? null}
      autoFocus={overlays.autoFocus}
      formatValue={() =>
        field.effectiveValue === null || field.effectiveValue === undefined
          ? ""
          : String(field.effectiveValue)
      }
      draftValue={textDraft.activeTextValue}
      onDraftValueChange={textDraft.setDraftTextValue}
      onCommit={commit.onCommit}
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
