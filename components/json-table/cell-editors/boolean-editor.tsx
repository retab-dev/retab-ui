import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"

export function BooleanEditor({
  identity,
  field,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  return (
    <JsonTableScalarCell
      kind="boolean"
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={Boolean(field.effectiveValue)}
      autoFocus={overlays.autoFocus}
      disabled={!field.isEditable}
      onCommit={(value) => {
        if (field.isEditable) commit.onCommit(value)
      }}
      onFocus={() => {
        focus.setFocusedField(fieldFocusId(identity))
        focus.setIsInputFocused(true)
      }}
      onBlur={() => {
        focus.setFocusedField(null)
        focus.setIsInputFocused(false)
      }}
    />
  )
}
