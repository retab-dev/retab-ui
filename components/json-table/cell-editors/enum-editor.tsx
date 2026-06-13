import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { jsonTableSelectDataCellClass } from "@/components/json-table/json-table-data-cell"

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

function getEnumDisplayValue(value: unknown, isNullable: boolean): string {
  if (value === null || value === undefined) {
    return isNullable ? "No selection" : ""
  }
  return String(value)
}

export function EnumEditor({
  cell,
  editSession,
  setOverlayOpen,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  const { fieldMetadata, effectiveValue } = cell
  const displayValue = getEnumDisplayValue(
    effectiveValue,
    fieldMetadata.isNullable
  )

  React.useLayoutEffect(() => {
    if (!cell.isEditable) return
    setOverlayOpen(true)
  }, [cell.isEditable, editSession.id, setOverlayOpen])

  return (
    <Select
      key={`${cell.fieldPath}-${cell.value}`}
      open={editSession.isOverlayOpen}
      onOpenChange={(open) => {
        setOverlayOpen(open)
        if (!open) closeEditSession()
      }}
      value={getEnumSelectValue(effectiveValue, fieldMetadata.enumValues)}
      disabled={!cell.isEditable}
      onValueChange={(newValue) => {
        if (newValue === null) return
        if (newValue === NULL_SELECT_VALUE && fieldMetadata.isNullable) {
          commitValue(null)
          closeEditSession()
          return
        }

        commitValue(getEnumCommitValue(newValue, fieldMetadata.enumValues))
        closeEditSession()
      }}
    >
      <SelectTrigger
        data-slot="data-cell"
        data-kind="text"
        data-mode="edit"
        autoFocus
        className={cn(jsonTableSelectDataCellClass, "disabled:opacity-100")}
        onBlur={() => {
          if (!editSession.isOverlayOpen) closeEditSession()
        }}
      >
        <span
          data-slot="select-value"
          className={cn(
            "flex-1 truncate",
            !displayValue && "text-muted-foreground"
          )}
        >
          {displayValue || "Select..."}
        </span>
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
