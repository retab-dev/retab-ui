import { cn } from "@/lib/utils"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableDataCell } from "@/components/json-table/json-table-data-cell"

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
    <JsonTableDataCell
      kind="text"
      editable={field.isEditable}
      mode={
        overlays.forceEditMode && overlays.showInput && field.isEditable
          ? "edit"
          : undefined
      }
      value={textDraft.activeTextValue ?? null}
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
      className={cn(
        "w-full px-2",
        "data-[mode=display]:items-start data-[mode=display]:py-2",
        field.isEditable && "data-[mode=display]:cursor-text",
        "data-[mode=edit]:h-full data-[mode=edit]:w-full data-[mode=edit]:rounded-none data-[mode=edit]:px-2 data-[mode=edit]:py-2 data-[mode=edit]:text-xs data-[mode=edit]:leading-none data-[mode=edit]:shadow-none data-[mode=edit]:focus-visible:ring-0 data-[mode=edit]:focus-visible:ring-offset-0",
        !field.effectiveValue && "data-[mode=edit]:text-muted-foreground",
        focus.focusedField === focusId &&
          "data-[mode=edit]:absolute data-[mode=edit]:top-[1px] data-[mode=edit]:left-[1px] data-[mode=edit]:z-10 data-[mode=edit]:h-64 data-[mode=edit]:min-w-[200px] data-[mode=edit]:bg-background data-[mode=edit]:shadow-md data-[mode=edit]:outline-1 data-[mode=edit]:outline-primary"
      )}
    />
  )
}
