import { format } from "date-fns"

import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import { DataCell } from "@/components/ui/data-cell"

function safeParseISO(dateString: string | null | undefined): Date | undefined {
  return parseDateStringAsLocal(dateString) ?? undefined
}

export function DateEditor({
  identity,
  field,
  textDraft,
  focus,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)
  const date = safeParseISO(textDraft.activeTextValue)

  return (
    <DataCell
      kind="date"
      editable={field.isEditable}
      value={textDraft.activeTextValue ?? null}
      draftValue={textDraft.activeTextValue}
      formatValue={() => (date ? format(date, "PP") : "")}
      placeholder="Pick a date"
      onDraftValueChange={textDraft.setDraftTextValue}
      onValueCommit={(value) => {
        const convertedDate = dateStringToFormat(
          typeof value === "string" ? value : "",
          "2000-01-01"
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
      className="h-full rounded-none border-0 px-2 text-xs data-[mode=display]:items-center data-[mode=display]:py-2 data-[mode=edit]:py-0 data-[mode=edit]:leading-none data-[mode=edit]:shadow-none data-[mode=edit]:focus-visible:ring-0 data-[mode=edit]:focus-visible:ring-offset-0"
    />
  )
}
