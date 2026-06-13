"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { DataCellBooleanIndicator } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import {
  dataCellBooleanDisplayClass,
  dataCellCheckboxDisplayClass,
  dataCellDisplayClass,
  dataCellDisplayValueClass,
  dataCellPickerTriggerClass,
} from "@/registry/new-york-v4/ui/data-cell-classes"
import { formatDataCellDisplayValue } from "@/registry/new-york-v4/ui/data-cell-format"
import { DataCellPickerIcon } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import type {
  DataCellKind,
  DataCellProps,
  DataCellValue,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellFormatValue = (
  value: DataCellValue,
  meta: { kind: DataCellKind }
) => React.ReactNode

export function DataCellDisplay({
  kind,
  value,
  editable = false,
  disabled = false,
  name: _name,
  placeholder,
  className,
  dateTimeZone: _dateTimeZone,
  showPickerIcon = true,
  formatValue,
  draftValue: _draftValue,
  autoFocus: _autoFocus,
  onDraftValueChange: _onDraftValueChange,
  onCommit: _onCommit,
  activationIntent: _activationIntent,
  isPickerOpen: _isPickerOpen,
  onEditingEnd: _onEditingEnd,
  onPickerOpenChange: _onPickerOpenChange,
  ...props
}: DataCellProps) {
  if (kind === "boolean") {
    return (
      <div
        {...props}
        data-slot="data-cell"
        data-kind={kind}
        data-mode="display"
        aria-disabled={disabled || undefined}
        aria-readonly={!editable || undefined}
        className={cn(
          dataCellBooleanDisplayClass,
          "justify-center px-1",
          disabled && "pointer-events-none opacity-64",
          editable && !disabled && "cursor-pointer",
          className
        )}
      >
        <span
          role="checkbox"
          data-slot="checkbox"
          data-state={Boolean(value) ? "checked" : "unchecked"}
          aria-checked={Boolean(value)}
          aria-label={Boolean(value) ? "true" : "false"}
          className={cn(
            dataCellCheckboxDisplayClass,
            "pointer-events-none flex items-center justify-center"
          )}
        >
          <DataCellBooleanIndicator checked={Boolean(value)} />
        </span>
      </div>
    )
  }

  if (kind === "date" || kind === "time" || kind === "date-time") {
    return (
      <DataCellPickerDisplay
        {...props}
        kind={kind}
        value={value}
        editable={editable}
        disabled={disabled}
        placeholder={placeholder}
        formatValue={formatValue as DataCellFormatValue | undefined}
        showPickerIcon={showPickerIcon}
        className={className}
      />
    )
  }

  const content =
    (formatValue as DataCellFormatValue | undefined)?.(value, { kind }) ??
    formatDataCellDisplayValue(kind, value)
  const isEmpty = content === ""

  return (
    <div
      {...props}
      data-slot="data-cell"
      data-kind={kind}
      data-mode="display"
      aria-disabled={disabled || undefined}
      aria-readonly={!editable || undefined}
      className={cn(
        dataCellDisplayClass,
        disabled && "pointer-events-none opacity-64",
        editable && !disabled && "cursor-text",
        className
      )}
    >
      <span className={dataCellDisplayValueClass}>
        <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
          {isEmpty ? (placeholder ?? "—") : content}
        </span>
      </span>
    </div>
  )
}

function DataCellPickerDisplay({
  kind,
  value,
  editable,
  disabled,
  placeholder,
  formatValue,
  showPickerIcon,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  kind: "date" | "time" | "date-time"
  value: DataCellValue
  editable?: boolean
  disabled?: boolean
  placeholder?: string
  formatValue?: DataCellFormatValue
  showPickerIcon: boolean
}) {
  const content =
    formatValue?.(value, { kind }) ?? formatDataCellDisplayValue(kind, value)
  const isEmpty = content === ""

  return (
    <div
      {...props}
      data-slot="data-cell"
      data-kind={kind}
      data-mode="display"
      aria-disabled={disabled || undefined}
      aria-readonly={!editable || undefined}
      className={cn(
        dataCellPickerTriggerClass,
        disabled && "pointer-events-none opacity-64",
        editable && !disabled && "cursor-pointer",
        className
      )}
    >
      <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
        {isEmpty ? (placeholder ?? "—") : content}
      </span>
      {showPickerIcon ? <DataCellPickerIcon kind={kind} /> : null}
    </div>
  )
}
