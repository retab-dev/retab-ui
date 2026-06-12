import { cn } from "@/lib/utils"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableDataCell } from "@/components/json-table/json-table-data-cell"

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
    <JsonTableDataCell
      kind={isInteger ? "integer" : "number"}
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={textDraft.activeTextValue ?? null}
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
      className={cn(
        "data-[mode=display]:items-center data-[mode=display]:py-2",
        "data-[mode=edit]:cursor-default data-[mode=edit]:border-0 data-[mode=edit]:focus:cursor-text data-[mode=edit]:disabled:text-inherit data-[mode=edit]:disabled:opacity-100",
        "data-[mode=edit]:h-full data-[mode=edit]:rounded-none data-[mode=edit]:px-2 data-[mode=edit]:py-0 data-[mode=edit]:!text-xs data-[mode=edit]:leading-none data-[mode=edit]:shadow-none data-[mode=edit]:focus-visible:ring-0 data-[mode=edit]:focus-visible:ring-offset-0",
        focus.focusedField === focusId &&
          "data-[mode=edit]:absolute data-[mode=edit]:top-0 data-[mode=edit]:left-0 data-[mode=edit]:z-10"
      )}
    />
  )
}
