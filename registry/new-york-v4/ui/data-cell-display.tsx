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

export const DataCellDisplay = React.forwardRef<HTMLElement, DataCellProps>(
  function DataCellDisplay(
    {
      kind,
      value,
      editable = false,
      active: _active,
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
      selectOptions: _selectOptions,
      activationIntent: _activationIntent,
      isPickerOpen: _isPickerOpen,
      onEditingEnd: _onEditingEnd,
      onActiveChange: _onActiveChange,
      onPickerOpenChange: _onPickerOpenChange,
      ...props
    },
    ref
  ) {
  if (kind === "boolean") {
    return (
      <div
        {...props}
        ref={ref as React.Ref<HTMLDivElement>}
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
        ref={ref as React.Ref<HTMLDivElement>}
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
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="data-cell"
      data-kind={kind}
      data-mode="display"
      aria-disabled={disabled || undefined}
      aria-readonly={!editable || undefined}
      className={cn(
        dataCellDisplayClass,
        disabled && "pointer-events-none opacity-64",
        editable && !disabled && (kind === "select" ? "cursor-pointer" : "cursor-text"),
        className
      )}
    >
      <span className={dataCellDisplayValueClass}>
        <span
          data-slot="data-cell-value"
          className={cn("truncate", isEmpty && "text-muted-foreground")}
        >
          {isEmpty ? (placeholder ?? "—") : content}
        </span>
      </span>
    </div>
  )
  }
)
DataCellDisplay.displayName = "DataCellDisplay"

const DataCellPickerDisplay = React.forwardRef<
  HTMLDivElement,
  Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
    kind: "date" | "time" | "date-time"
    value: DataCellValue
    editable?: boolean
    disabled?: boolean
    placeholder?: string
    formatValue?: DataCellFormatValue
    showPickerIcon: boolean
  }
>(function DataCellPickerDisplay(
  {
    kind,
    value,
    editable,
    disabled,
    placeholder,
    formatValue,
    showPickerIcon,
    className,
    ...props
  },
  ref
) {
  const content =
    formatValue?.(value, { kind }) ?? formatDataCellDisplayValue(kind, value)
  const isEmpty = content === ""

  return (
    <div
      {...props}
      ref={ref}
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
      <span
        data-slot="data-cell-value"
        className={cn("truncate", isEmpty && "text-muted-foreground")}
      >
        {isEmpty ? (placeholder ?? "—") : content}
      </span>
      {showPickerIcon ? <DataCellPickerIcon kind={kind} /> : null}
    </div>
  )
})
