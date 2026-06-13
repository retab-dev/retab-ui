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
const CLOSE_WITHOUT_SELECTION_DELAY_MS = 24

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
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const closeTimerRef = React.useRef<ReturnType<
    typeof globalThis.setTimeout
  > | null>(null)
  const skipActivationTriggerClickRef = React.useRef(false)
  const isActivationTriggerClickRef = React.useRef(false)
  const lastCommittedValueRef = React.useRef<string | null>(null)

  const cancelScheduledClose = React.useCallback(() => {
    if (closeTimerRef.current === null) return
    globalThis.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const scheduleClose = React.useCallback(() => {
    cancelScheduledClose()
    closeTimerRef.current = globalThis.setTimeout(() => {
      closeTimerRef.current = null
      closeEditSession()
    }, CLOSE_WITHOUT_SELECTION_DELAY_MS)
  }, [cancelScheduledClose, closeEditSession])

  const commitSelectValue = React.useCallback(
    (newValue: string) => {
      if (lastCommittedValueRef.current === newValue) return
      lastCommittedValueRef.current = newValue
      cancelScheduledClose()
      if (newValue === NULL_SELECT_VALUE && fieldMetadata.isNullable) {
        commitValue(null)
        closeEditSession()
        return
      }

      commitValue(getEnumCommitValue(newValue, fieldMetadata.enumValues))
      closeEditSession()
    },
    [
      cancelScheduledClose,
      closeEditSession,
      commitValue,
      fieldMetadata.enumValues,
      fieldMetadata.isNullable,
    ]
  )

  React.useLayoutEffect(() => {
    if (!cell.isEditable) return
    lastCommittedValueRef.current = null
    skipActivationTriggerClickRef.current = editSession.intent.type === "pointer"
    triggerRef.current?.focus({ preventScroll: true })
    setOverlayOpen(true)
  }, [cell.isEditable, editSession.id, editSession.intent, setOverlayOpen])

  React.useEffect(() => {
    if (editSession.isOverlayOpen) cancelScheduledClose()
  }, [cancelScheduledClose, editSession.isOverlayOpen])

  React.useEffect(() => cancelScheduledClose, [cancelScheduledClose])

  return (
    <Select
      key={`${cell.fieldPath}-${cell.value}`}
      open={editSession.isOverlayOpen}
      onOpenChange={(open) => {
        if (open) {
          setOverlayOpen(true)
          cancelScheduledClose()
          return
        }
        if (isActivationTriggerClickRef.current) {
          isActivationTriggerClickRef.current = false
          setOverlayOpen(true)
          cancelScheduledClose()
          return
        }
        scheduleClose()
      }}
      value={getEnumSelectValue(effectiveValue, fieldMetadata.enumValues)}
      disabled={!cell.isEditable}
      onValueChange={(newValue) => {
        if (newValue === null) return
        commitSelectValue(newValue)
      }}
    >
      <SelectTrigger
        ref={triggerRef}
        data-slot="data-cell"
        data-kind="text"
        data-mode="edit"
        autoFocus
        className={cn(jsonTableSelectDataCellClass, "disabled:opacity-100")}
        onClickCapture={() => {
          if (!skipActivationTriggerClickRef.current) return
          skipActivationTriggerClickRef.current = false
          isActivationTriggerClickRef.current = true
          globalThis.setTimeout(() => {
            isActivationTriggerClickRef.current = false
          }, 0)
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
            onPointerUp={() => commitSelectValue(NULL_SELECT_VALUE)}
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
                onPointerUp={() => commitSelectValue(enumOptionValue(optionIndex))}
              >
                {String(option)}
              </SelectItem>
            )
          })}
      </SelectContent>
    </Select>
  )
}
