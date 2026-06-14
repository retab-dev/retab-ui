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
import type { DataCellKind } from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellDisplayNativeProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange"
>

type DataCellDisplayFormatValue<Kind extends DataCellKind, Value> = (
  value: Value | undefined,
  meta: { kind: Kind }
) => React.ReactNode

type DataCellDisplayBaseProps<
  Kind extends DataCellKind,
  Value,
> = DataCellDisplayNativeProps & {
  kind: Kind
  value?: Value
  editable?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  showPickerIcon?: boolean
  formatValue?: DataCellDisplayFormatValue<Kind, Value>
}

type DataCellScalarDisplayProps =
  | DataCellDisplayBaseProps<"text", string | null>
  | DataCellDisplayBaseProps<"number" | "integer", number | string | null>
  | DataCellDisplayBaseProps<"select", string | null>

type DataCellPickerDisplayProps = DataCellDisplayBaseProps<
  "date" | "time" | "date-time",
  string | null
>

export type DataCellDisplayProps =
  | DataCellScalarDisplayProps
  | DataCellDisplayBaseProps<"boolean", boolean | null>
  | DataCellPickerDisplayProps

export const DataCellDisplay = React.forwardRef<
  HTMLDivElement,
  DataCellDisplayProps
>(function DataCellDisplay(displayProps, ref) {
  if (displayProps.kind === "boolean") {
    const {
      kind,
      value,
      editable = false,
      disabled = false,
      placeholder: _placeholder,
      showPickerIcon: omittedPickerIcon,
      formatValue: _formatValue,
      className,
      ...props
    } = displayProps

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

  if (
    displayProps.kind === "date" ||
    displayProps.kind === "time" ||
    displayProps.kind === "date-time"
  ) {
    const {
      kind,
      value,
      editable = false,
      disabled = false,
      placeholder,
      className,
      showPickerIcon = true,
      formatValue,
      ...props
    } = displayProps

    return (
      <DataCellPickerDisplay
        {...props}
        ref={ref}
        kind={kind}
        value={value}
        editable={editable}
        disabled={disabled}
        placeholder={placeholder}
        formatValue={formatValue}
        showPickerIcon={showPickerIcon}
        className={className}
      />
    )
  }

  if (!isDataCellScalarDisplayProps(displayProps)) {
    return null
  }

  const {
    kind,
    value,
    editable = false,
    disabled = false,
    placeholder,
    className,
    showPickerIcon: omittedPickerIcon,
    formatValue: _formatValue,
    ...props
  } = displayProps
  const content = dataCellScalarDisplayContent(displayProps)
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
        dataCellDisplayClass,
        disabled && "pointer-events-none opacity-64",
        editable &&
          !disabled &&
          (kind === "select" ? "cursor-pointer" : "cursor-text"),
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
})
DataCellDisplay.displayName = "DataCellDisplay"

function dataCellScalarDisplayContent(props: DataCellScalarDisplayProps) {
  if (props.kind === "text") {
    return (
      props.formatValue?.(props.value, { kind: props.kind }) ??
      formatDataCellDisplayValue(props.kind, props.value)
    )
  }

  if (props.kind === "select") {
    return (
      props.formatValue?.(props.value, { kind: props.kind }) ??
      formatDataCellDisplayValue(props.kind, props.value)
    )
  }

  return (
    props.formatValue?.(props.value, { kind: props.kind }) ??
    formatDataCellDisplayValue(props.kind, props.value)
  )
}

function isDataCellScalarDisplayProps(
  props: DataCellDisplayProps
): props is DataCellScalarDisplayProps {
  return (
    props.kind === "text" ||
    props.kind === "number" ||
    props.kind === "integer" ||
    props.kind === "select"
  )
}

const DataCellPickerDisplay = React.forwardRef<
  HTMLDivElement,
  DataCellPickerDisplayProps
>(function DataCellPickerDisplay(
  {
    kind,
    value,
    editable,
    disabled,
    placeholder,
    formatValue,
    showPickerIcon = true,
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
