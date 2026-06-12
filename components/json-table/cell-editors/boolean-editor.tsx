import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableDataCell } from "@/components/json-table/json-table-data-cell"

export function BooleanEditor({
  identity,
  field,
  focus,
  commit,
}: CellEditorProps) {
  return (
    <JsonTableDataCell
      kind="boolean"
      editable={field.isEditable}
      value={Boolean(field.effectiveValue)}
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
      className="py-1"
    />
  )
}
