import { cn } from "@/lib/utils"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { JsonTableDataCell } from "@/components/json-table/json-table-data-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"

export function DateTimeEditor({
  identity,
  textDraft,
  focus,
  field,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)

  return (
    <JsonTableDataCell
      kind="date-time"
      editable={field.isEditable}
      value={textDraft.activeTextValue ?? null}
      dateTimeZone="preserve"
      draftValue={textDraft.activeTextValue}
      onDraftValueChange={textDraft.setDraftTextValue}
      onCommit={(value) => {
        const convertedDate = dateStringToFormat(
          typeof value === "string" ? value : "",
          "2000-01-01T00:00:00"
        )
        commit.onCommit(convertedDate || null)
      }}
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
        "data-[mode=display]:items-center data-[mode=display]:py-0",
        "data-[mode=edit]:h-full data-[mode=edit]:rounded-none data-[mode=edit]:px-2 data-[mode=edit]:py-0 data-[mode=edit]:!text-xs data-[mode=edit]:leading-none data-[mode=edit]:shadow-none data-[mode=edit]:focus-visible:ring-0 data-[mode=edit]:focus-visible:ring-offset-0",
        focus.focusedField === focusId &&
          "data-[mode=edit]:absolute data-[mode=edit]:top-0 data-[mode=edit]:left-0 data-[mode=edit]:z-10 data-[mode=edit]:bg-background"
      )}
    />
  )
}
