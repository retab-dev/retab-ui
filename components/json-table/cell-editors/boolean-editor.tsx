import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { DataCell } from "@/components/ui/data-cell"

export function BooleanEditor({
  identity,
  field,
  focus,
  commit,
}: CellEditorProps) {
  return (
    <DataCell
      kind="boolean"
      editable={field.isEditable}
      value={Boolean(field.effectiveValue)}
      disabled={!field.isEditable}
      onValueCommit={(value) => {
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
      className="h-full rounded-none border-0 py-1"
    />
  )
}
