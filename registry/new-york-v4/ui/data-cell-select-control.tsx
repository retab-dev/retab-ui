"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { dataCellPickerTriggerClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import type {
  DataCellProps,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

const DATA_CELL_SELECT_CLOSE_DELAY_MS = 24

export type DataCellSelectControlProps = DataCellProps & { kind: "select" }

function selectValueMeta(value: string | null): DataCellValueMeta {
  return {
    kind: "select",
    rawValue: value ?? "",
    isEmpty: value === null || value === "",
    isValid: true,
  }
}

export function DataCellSelectControl({
  kind,
  value,
  editable: _editable,
  active: _active,
  mode: _mode,
  disabled = false,
  name: _name,
  placeholder = "Select...",
  dateTimeZone: _dateTimeZone,
  showPickerIcon: _showPickerIcon,
  className,
  formatValue,
  draftValue: _draftValue,
  autoFocus,
  activationIntent,
  isPickerOpen,
  selectOptions,
  onDraftValueChange: _onDraftValueChange,
  onCommit,
  onEditingEnd,
  onActiveChange: _onActiveChange,
  onPickerOpenChange,
  onEditorHandleChange,
  onFocus: _onFocus,
  onBlur: _onBlur,
  onKeyDown: _onKeyDown,
  onClick: _onClick,
  onDoubleClick: _onDoubleClick,
  ...props
}: DataCellSelectControlProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const closeTimerRef = React.useRef<ReturnType<
    typeof globalThis.setTimeout
  > | null>(null)
  const clearSkipAutoFocusCloseTimerRef = React.useRef<ReturnType<
    typeof globalThis.setTimeout
  > | null>(null)
  const shouldSkipAutoFocusClose =
    Boolean(autoFocus) &&
    activationIntent !== undefined &&
    activationIntent.type !== "keyboard"
  const skipAutoFocusCloseRef = React.useRef(shouldSkipAutoFocusClose)
  const lastCommittedValueRef = React.useRef<string | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = isPickerOpen ?? uncontrolledOpen
  const selectedValue = value ?? null
  const selectedOption = selectOptions.find((option) => option.value === value)
  const displayValue =
    formatValue?.(selectedValue, { kind }) ?? selectedOption?.label ?? ""
  const isEmpty = displayValue === ""

  const cancelScheduledClose = React.useCallback(() => {
    if (closeTimerRef.current === null) return
    globalThis.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const cancelScheduledSkipAutoFocusCloseClear = React.useCallback(() => {
    if (clearSkipAutoFocusCloseTimerRef.current === null) return
    globalThis.clearTimeout(clearSkipAutoFocusCloseTimerRef.current)
    clearSkipAutoFocusCloseTimerRef.current = null
  }, [])

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (isPickerOpen === undefined) setUncontrolledOpen(nextOpen)
      onPickerOpenChange?.(nextOpen)
    },
    [isPickerOpen, onPickerOpenChange]
  )

  const closeAfterDismiss = React.useCallback(() => {
    cancelScheduledClose()
    closeTimerRef.current = globalThis.setTimeout(() => {
      closeTimerRef.current = null
      onEditingEnd?.()
    }, DATA_CELL_SELECT_CLOSE_DELAY_MS)
  }, [cancelScheduledClose, onEditingEnd])

  const commitSelectValue = React.useCallback(
    (nextValue: string) => {
      if (lastCommittedValueRef.current === nextValue) return
      lastCommittedValueRef.current = nextValue
      cancelScheduledClose()
      onCommit?.(nextValue, selectValueMeta(nextValue))
      onEditingEnd?.()
    },
    [cancelScheduledClose, onCommit, onEditingEnd]
  )

  const closeSelectEditor = React.useCallback(() => {
    cancelScheduledClose()
    setOpen(false)
    onEditingEnd?.()
  }, [cancelScheduledClose, onEditingEnd, setOpen])

  React.useLayoutEffect(() => {
    onEditorHandleChange?.({
      finish: closeSelectEditor,
      cancel: closeSelectEditor,
    })
    return () => onEditorHandleChange?.(null)
  }, [closeSelectEditor, onEditorHandleChange])

  React.useLayoutEffect(() => {
    if (!autoFocus) return
    lastCommittedValueRef.current = null
    cancelScheduledSkipAutoFocusCloseClear()
    skipAutoFocusCloseRef.current = shouldSkipAutoFocusClose
    triggerRef.current?.focus({ preventScroll: true })
    setOpen(true)
    clearSkipAutoFocusCloseTimerRef.current = globalThis.setTimeout(() => {
      skipAutoFocusCloseRef.current = false
      clearSkipAutoFocusCloseTimerRef.current = null
    }, 0)
  }, [
    autoFocus,
    cancelScheduledSkipAutoFocusCloseClear,
    setOpen,
    shouldSkipAutoFocusClose,
  ])

  React.useEffect(() => {
    if (open) cancelScheduledClose()
  }, [cancelScheduledClose, open])

  React.useEffect(() => cancelScheduledClose, [cancelScheduledClose])

  React.useEffect(
    () => cancelScheduledSkipAutoFocusCloseClear,
    [cancelScheduledSkipAutoFocusCloseClear]
  )

  return (
    <Select
      open={open}
      value={selectedValue ?? undefined}
      disabled={disabled}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
          cancelScheduledClose()
          return
        }
        if (skipAutoFocusCloseRef.current) {
          skipAutoFocusCloseRef.current = false
          setOpen(true)
          return
        }
        closeAfterDismiss()
      }}
      onValueChange={(nextValue) => {
        if (nextValue === null) return
        commitSelectValue(nextValue)
      }}
    >
      <SelectTrigger
        {...props}
        ref={triggerRef}
        data-slot="data-cell"
        data-kind={kind}
        data-mode="edit"
        autoFocus={autoFocus}
        className={cn(dataCellPickerTriggerClass, className)}
      >
        <span
          data-slot="select-value"
          className={cn("flex-1 truncate", isEmpty && "text-muted-foreground")}
        >
          {isEmpty ? placeholder : displayValue}
        </span>
      </SelectTrigger>
      <SelectContent className="z-[60]">
        {selectOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={option.className}
            onPointerUp={() => commitSelectValue(option.value)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
