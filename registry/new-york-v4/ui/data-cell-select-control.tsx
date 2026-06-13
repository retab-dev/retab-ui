"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  useDataCellOpeningContext,
  type DataCellDismissCause,
} from "@/registry/new-york-v4/ui/data-cell-activation"
import { dataCellPickerTriggerClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import type {
  DataCellProps,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellSelectControlProps = DataCellProps & { kind: "select" }

function selectValueMeta(value: string | null): DataCellValueMeta {
  return {
    kind: "select",
    rawValue: value ?? "",
    isEmpty: value === null || value === "",
    isValid: true,
  }
}

function dataCellSelectDismissCause(
  eventDetails:
    | {
        event?: Event
        reason?: string
      }
    | undefined
): DataCellDismissCause {
  const event = eventDetails?.event
  const reason = eventDetails?.reason
  if (reason === "focus-out") return { kind: "focus-out", event }
  if (reason === "trigger-press") return { kind: "trigger-press", event }
  if (reason === "cancel-open") return { kind: "cancel-open", event }
  if (
    reason === "escape-key" &&
    event instanceof KeyboardEvent &&
    event.key === "Escape"
  ) {
    return { kind: "escape", event }
  }
  return { kind: "unknown", event }
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
  activationSource,
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
  const openingContext = useDataCellOpeningContext(activationSource, {
    enabled: Boolean(autoFocus),
  })
  const lastCommittedValueRef = React.useRef<string | null>(null)
  const didFinishEditingRef = React.useRef(false)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = isPickerOpen ?? uncontrolledOpen
  const selectedValue = value ?? null
  const selectedOption = selectOptions.find((option) => option.value === value)
  const displayValue =
    formatValue?.(selectedValue, { kind }) ?? selectedOption?.label ?? ""
  const isEmpty = displayValue === ""

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (isPickerOpen === undefined) setUncontrolledOpen(nextOpen)
      onPickerOpenChange?.(nextOpen)
    },
    [isPickerOpen, onPickerOpenChange]
  )

  const finishSelectEditing = React.useCallback(() => {
    if (didFinishEditingRef.current) return
    didFinishEditingRef.current = true
    onEditingEnd?.()
  }, [onEditingEnd])

  const commitSelectValue = React.useCallback(
    (nextValue: string) => {
      if (lastCommittedValueRef.current === nextValue) return
      lastCommittedValueRef.current = nextValue
      openingContext.release()
      onCommit?.(nextValue, selectValueMeta(nextValue))
      finishSelectEditing()
    },
    [finishSelectEditing, onCommit, openingContext]
  )

  const closeSelectEditor = React.useCallback(() => {
    openingContext.release()
    setOpen(false)
    finishSelectEditing()
  }, [finishSelectEditing, openingContext, setOpen])

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
    didFinishEditingRef.current = false
    triggerRef.current?.focus({ preventScroll: true })
    setOpen(true)
  }, [autoFocus, setOpen])

  return (
    <Select
      open={open}
      value={selectedValue ?? undefined}
      disabled={disabled}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen) {
          setOpen(true)
          return
        }

        if (
          openingContext.shouldCancelDismiss(
            dataCellSelectDismissCause(eventDetails)
          )
        ) {
          eventDetails.cancel()
          setOpen(true)
          return
        }

        openingContext.release()
        setOpen(false)
        finishSelectEditing()
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
