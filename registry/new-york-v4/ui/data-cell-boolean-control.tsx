"use client"

import * as React from "react"
import { CheckIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  dataCellBooleanDisplayClass,
  dataCellCheckboxDisplayClass,
} from "@/registry/new-york-v4/ui/data-cell-classes"
import type {
  DataCellCommitHandler,
  DataCellProps,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellBooleanControlProps = DataCellProps & { kind: "boolean" }

export function DataCellBooleanIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      data-slot="checkbox-indicator"
      className={cn(
        "flex items-center justify-center transition-none",
        checked ? "text-current" : "text-muted-foreground/72"
      )}
    >
      {checked ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <XIcon className="size-3.5" />
      )}
    </span>
  )
}

export function DataCellBooleanControl({
  kind,
  value,
  editable: _editable,
  active: _active,
  mode: _mode,
  disabled = false,
  name,
  className,
  formatValue: _formatValue,
  draftValue: _draftValue,
  placeholder: _placeholder,
  dateTimeZone: _dateTimeZone,
  showPickerIcon: _showPickerIcon,
  activationIntent: _activationIntent,
  isPickerOpen: _isPickerOpen,
  autoFocus,
  onDraftValueChange: _onDraftValueChange,
  onCommit,
  onEditingEnd,
  onActiveChange: _onActiveChange,
  onPickerOpenChange: _onPickerOpenChange,
  onEditorHandleChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onDoubleClick,
  ...props
}: DataCellBooleanControlProps) {
  const checked = Boolean(value)
  const {
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rootProps
  } = props

  React.useLayoutEffect(() => {
    onEditorHandleChange?.({
      finish: () => onEditingEnd?.(),
      cancel: () => onEditingEnd?.(),
    })
    return () => onEditorHandleChange?.(null)
  }, [onEditingEnd, onEditorHandleChange])

  return (
    <div
      {...rootProps}
      data-slot="data-cell"
      data-kind={kind}
      data-mode="edit"
      className={cn(
        dataCellBooleanDisplayClass,
        "justify-center px-1",
        className
      )}
    >
      <button
        type="button"
        role="checkbox"
        id={id}
        name={name}
        aria-checked={checked}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel ?? (checked ? "true" : "false")}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          dataCellCheckboxDisplayClass,
          "flex items-center justify-center"
        )}
        onClick={(event) => {
          event.stopPropagation()
          if (disabled) return
          const nextValue = !checked
          ;(onCommit as DataCellCommitHandler | undefined)?.(nextValue, {
            kind,
            rawValue: String(nextValue),
            isEmpty: false,
            isValid: true,
          })
          onClick?.(event)
        }}
        onFocus={onFocus}
        onBlur={(event) => {
          onEditingEnd?.()
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || event.key !== "Escape") return
          onEditingEnd?.()
          event.currentTarget.blur()
          event.preventDefault()
        }}
        onDoubleClick={onDoubleClick}
      >
        <DataCellBooleanIndicator checked={checked} />
      </button>
    </div>
  )
}
