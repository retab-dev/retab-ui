import { cn } from "@/lib/utils"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableDataCell } from "@/components/json-table/json-table-data-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"

export function TimeEditor({
  identity,
  field,
  textDraft,
  focus,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)

  return (
    <JsonTableDataCell
      kind="time"
      editable={field.isEditable}
      value={textDraft.activeTextValue ?? null}
      draftValue={textDraft.activeTextValue}
      onDraftValueChange={textDraft.setDraftTextValue}
      onCommit={(value) => {
        const rawValue = typeof value === "string" ? value : ""
        const finalValue =
          rawValue && /^\d{1,2}:\d{2}$/.test(rawValue)
            ? `${rawValue}:00`
            : rawValue
        const convertedDate = dateStringToFormat(finalValue, "00:00")
        commit.onCommit(convertedDate || null)
        textDraft.setDraftTextValue(convertedDate || "")
      }}
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
        "data-[mode=display]:items-center data-[mode=display]:py-2",
        "data-[mode=edit]:h-full data-[mode=edit]:rounded-none data-[mode=edit]:px-2 data-[mode=edit]:py-0 data-[mode=edit]:!text-xs data-[mode=edit]:leading-none data-[mode=edit]:shadow-none data-[mode=edit]:focus-visible:ring-0 data-[mode=edit]:focus-visible:ring-offset-0",
        !field.effectiveValue && "data-[mode=edit]:text-muted-foreground",
        focus.focusedField === focusId &&
          "data-[mode=edit]:absolute data-[mode=edit]:top-0 data-[mode=edit]:left-0 data-[mode=edit]:z-10"
      )}
    />
  )
}
