import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { Checkbox } from "@/components/ui-retab/checkbox"

export function BooleanEditor({
  identity,
  field,
  focus,
  commit,
}: CellEditorProps) {
  return (
    <div className="flex h-full items-center justify-center py-1">
      <Checkbox
        checked={Boolean(field.effectiveValue)}
        disabled={!field.isEditable}
        onCheckedChange={(checked) => {
          if (field.isEditable) commit.onCommit(checked)
        }}
        onFocus={() => {
          focus.setFocusedField(fieldFocusId(identity))
          focus.setIsInputFocused(true)
        }}
        onBlur={() => {
          focus.setFocusedField(null)
          focus.setIsInputFocused(false)
        }}
        className="rounded-sm disabled:opacity-100"
      />
    </div>
  )
}
