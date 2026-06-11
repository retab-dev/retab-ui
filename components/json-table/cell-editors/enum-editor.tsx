import { cn } from "@/lib/utils"
import { CellDisplay } from "@/components/json-table/cell-display"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-retab/select"

export function EnumEditor({
  identity,
  field,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  const { fieldMetadata, effectiveValue } = field

  if (!overlays.showInput) {
    return (
      <CellDisplay className="items-start py-2">
        {effectiveValue === null ||
        effectiveValue === undefined ||
        effectiveValue === "__null__"
          ? "—"
          : String(effectiveValue)}
      </CellDisplay>
    )
  }

  return (
    <Select
      key={`${identity.fieldPath}-${field.value}`}
      onOpenChange={(open) => {
        overlays.setIsSelectOpen(open)
        focus.setFocusedField(open ? fieldFocusId(identity) : null)
        focus.setIsInputFocused(open)
      }}
      value={
        effectiveValue === null || effectiveValue === undefined
          ? "__null__"
          : String(effectiveValue)
      }
      disabled={!field.isEditable}
      onValueChange={(newValue) => {
        if (newValue === "__null__" && fieldMetadata.isNullable) {
          commit.onCommit(null)
          return
        }

        if (fieldMetadata.kind === "integer") {
          const parsed = parseInt(newValue, 10)
          commit.onCommit(Number.isNaN(parsed) ? null : parsed)
        } else if (fieldMetadata.kind === "number") {
          const parsed = parseFloat(newValue)
          commit.onCommit(Number.isNaN(parsed) ? null : parsed)
        } else {
          commit.onCommit(newValue)
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "h-6 w-full rounded-none border-none px-2 text-xs leading-none text-inherit shadow-none",
          "disabled:opacity-100"
        )}
        onFocus={() => {
          focus.setFocusedField(fieldFocusId(identity))
          focus.setIsInputFocused(true)
        }}
        onBlur={() => {
          if (!overlays.isSelectOpen) {
            focus.setFocusedField(null)
            focus.setIsInputFocused(false)
          }
        }}
      >
        <SelectValue
          placeholder={fieldMetadata.isNullable ? "Select..." : undefined}
        />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[60]">
        {fieldMetadata.isNullable && (
          <SelectItem
            key="__null__"
            value="__null__"
            className="text-xs text-muted-foreground"
          >
            <em>No selection</em>
          </SelectItem>
        )}
        {fieldMetadata.enumValues
          .filter(
            (enumVal) =>
              enumVal !== undefined &&
              enumVal !== null &&
              !(typeof enumVal === "string" && enumVal === "")
          )
          .map((option) => (
            <SelectItem
              key={String(option)}
              value={String(option)}
              className="text-xs"
            >
              {String(option)}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
