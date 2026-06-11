import { cn } from "@/lib/utils"
import { CellDisplay } from "@/components/json-table/cell-display"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import { DoubleClickTextarea } from "@/components/json-table/cell-editors/primitive-editor"

export function TextEditor({
  identity,
  field,
  textDraft,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)

  if (!overlays.isTextEditing) {
    return (
      <CellDisplay
        className={cn("items-start py-2", field.isEditable && "cursor-text")}
        onClick={() => {
          if (field.isEditable) overlays.setIsTextEditing(true)
        }}
      >
        {field.effectiveValue !== null && field.effectiveValue !== undefined
          ? String(field.effectiveValue)
          : ""}
      </CellDisplay>
    )
  }

  return (
    <DoubleClickTextarea
      autoFocus
      value={textDraft.activeTextValue ?? null}
      onChange={(event) => textDraft.setDraftTextValue(event.target.value)}
      onBlur={() => {
        commit.onCommit(textDraft.draftTextValue || null)
        focus.setFocusedField(null)
        focus.setIsInputFocused(false)
        overlays.setIsTextEditing(false)
      }}
      onFocus={() => {
        textDraft.setDraftTextValue(textDraft.committedTextValue)
        focus.setFocusedField(focusId)
        focus.setIsInputFocused(true)
      }}
      disabled={!field.isEditable}
      className={cn(
        "h-full w-full rounded-none px-2 py-2 text-xs leading-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
        !field.effectiveValue && "text-muted-foreground",
        focus.focusedField === focusId &&
          "absolute top-[1px] left-[1px] z-10 h-64 min-w-[200px] bg-background shadow-md outline-1 outline-primary"
      )}
      style={{
        resize: "none",
      }}
    />
  )
}
