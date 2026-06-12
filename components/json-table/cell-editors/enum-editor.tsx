import { cn } from "@/lib/utils"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import {
  JsonTableDataCell,
  jsonTableSelectDataCellClass,
} from "@/components/json-table/json-table-data-cell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NULL_SELECT_VALUE = "__json_table_null__"

function enumOptionValue(index: number): string {
  return `option:${index}`
}

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right) return false
  if (left === null || right === null) return false
  if (typeof left !== "object" || typeof right !== "object") return false

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    return (
      left.length === right.length &&
      left.every((item, index) => areJsonValuesEqual(item, right[index]))
    )
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key)
    ) &&
    leftKeys.every((key) =>
      areJsonValuesEqual(leftRecord[key], rightRecord[key])
    )
  )
}

function getEnumSelectValue(value: unknown, enumValues: unknown[]): string {
  if (value === null || value === undefined) return NULL_SELECT_VALUE
  const matchingIndex = enumValues.findIndex((enumValue) =>
    areJsonValuesEqual(enumValue, value)
  )
  return matchingIndex === -1 ? String(value) : enumOptionValue(matchingIndex)
}

function getEnumCommitValue(newValue: string, enumValues: unknown[]): unknown {
  if (!newValue.startsWith("option:")) return newValue
  const optionIndex = Number(newValue.slice("option:".length))
  return Number.isInteger(optionIndex) && optionIndex in enumValues
    ? enumValues[optionIndex]
    : newValue
}

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
      <JsonTableDataCell
        kind="text"
        value={effectiveValue == null ? "" : String(effectiveValue)}
        className="items-start py-2"
      />
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
      value={getEnumSelectValue(effectiveValue, fieldMetadata.enumValues)}
      disabled={!field.isEditable}
      onValueChange={(newValue) => {
        if (newValue === null) return
        if (newValue === NULL_SELECT_VALUE && fieldMetadata.isNullable) {
          commit.onCommit(null)
          return
        }

        commit.onCommit(getEnumCommitValue(newValue, fieldMetadata.enumValues))
      }}
    >
      <SelectTrigger
        data-slot="data-cell"
        data-kind="text"
        data-mode="edit"
        className={cn(
          jsonTableSelectDataCellClass,
          "h-full py-2 leading-none",
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
      <SelectContent className="z-[60]">
        {fieldMetadata.isNullable && (
          <SelectItem
            key={NULL_SELECT_VALUE}
            value={NULL_SELECT_VALUE}
            className="text-xs text-muted-foreground"
          >
            <em>No selection</em>
          </SelectItem>
        )}
        {fieldMetadata.enumValues
          .map((option, optionIndex) => ({ option, optionIndex }))
          .filter(
            ({ option }) =>
              option !== undefined &&
              option !== null &&
              !(typeof option === "string" && option === "")
          )
          .map(({ option, optionIndex }) => {
            return (
              <SelectItem
                key={enumOptionValue(optionIndex)}
                value={enumOptionValue(optionIndex)}
                className="text-xs"
              >
                {String(option)}
              </SelectItem>
            )
          })}
      </SelectContent>
    </Select>
  )
}
