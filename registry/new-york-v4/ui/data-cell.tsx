"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type DataCellKind =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "time"
  | "date-time"

export type DataCellMode = "display" | "edit" | "auto"
export type DataCellValue = string | number | boolean | null | undefined
export type DataCellCommitValue = string | number | boolean | null
export type DataCellDateTimeZone = "local" | "preserve" | "utc"
export type DataCellValueMeta = {
  kind: DataCellKind
  rawValue: string
  isEmpty: boolean
  isValid: boolean
}

export interface DataCellProps
  extends Omit<
    React.HTMLAttributes<HTMLElement>,
    "children" | "defaultValue" | "onChange"
  > {
  kind: DataCellKind
  value?: DataCellValue
  mode?: DataCellMode
  editable?: boolean
  disabled?: boolean
  name?: string
  placeholder?: string
  dateTimeZone?: DataCellDateTimeZone
  formatValue?: (
    value: DataCellValue,
    meta: { kind: DataCellKind }
  ) => React.ReactNode
  draftValue?: string
  autoFocus?: boolean
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onValueCommit?: (value: DataCellCommitValue, meta: DataCellValueMeta) => void
}

const dataCellDisplayClass =
  "flex h-8 w-full min-w-0 items-center overflow-hidden rounded-md border border-transparent px-2 text-sm text-foreground transition-colors"

const dataCellInputClass =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-foreground shadow-none transition-colors outline-none hover:border-border hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"

const dataCellCheckboxDisplayClass =
  "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"

const dataCellCheckboxInputClass =
  "border-input bg-background text-primary accent-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"

export function DataCell({
  mode,
  editable = false,
  ...props
}: DataCellProps) {
  const resolvedMode = mode ?? (editable ? "auto" : "display")

  if (resolvedMode === "edit") {
    return <DataCellEdit {...props} editable={editable} />
  }

  if (resolvedMode === "auto" && editable) {
    return <InteractiveDataCell {...props} editable />
  }

  return <DataCellDisplay {...props} editable={editable} />
}

function InteractiveDataCell({
  autoFocus,
  disabled = false,
  editable,
  onMouseEnter,
  onMouseLeave,
  onClick,
  ...props
}: DataCellProps) {
  const [isPointerOver, setIsPointerOver] = React.useState(false)
  const [isInputFocused, setIsInputFocused] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(Boolean(autoFocus))
  const shouldEdit =
    editable &&
    !disabled &&
    (autoFocus || isPointerOver || isInputFocused || isEditing)

  if (shouldEdit) {
    return (
      <DataCellEdit
        {...props}
        autoFocus={autoFocus || isEditing}
        disabled={disabled}
        editable={editable}
        onMouseEnter={(event) => {
          setIsPointerOver(true)
          onMouseEnter?.(event)
        }}
        onMouseLeave={(event) => {
          setIsPointerOver(false)
          onMouseLeave?.(event)
        }}
        onInputFocusChange={setIsInputFocused}
        onInputEditingEnd={() => {
          setIsEditing(false)
        }}
      />
    )
  }

  return (
    <DataCellDisplay
      {...props}
      disabled={disabled}
      editable={editable}
      onMouseEnter={(event) => {
        setIsPointerOver(true)
        onMouseEnter?.(event)
      }}
      onMouseLeave={onMouseLeave}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setIsEditing(true)
      }}
    />
  )
}

type DataCellEditProps = DataCellProps & {
  onInputFocusChange?: (focused: boolean) => void
  onInputEditingEnd?: () => void
}

function DataCellEdit({
  kind,
  value,
  editable: _editable,
  disabled = false,
  name,
  placeholder,
  dateTimeZone = "local",
  className,
  formatValue: _formatValue,
  draftValue,
  autoFocus,
  onDraftValueChange,
  onValueCommit,
  onInputFocusChange,
  onInputEditingEnd,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onDoubleClick,
  ...props
}: DataCellEditProps) {
  const initialInputValue = formatDataCellEditValue(kind, value)
  const [uncontrolledDraftValue, setUncontrolledDraftValue] =
    React.useState(initialInputValue)
  const inputValue = draftValue ?? uncontrolledDraftValue

  React.useEffect(() => {
    if (draftValue !== undefined) return
    setUncontrolledDraftValue(formatDataCellEditValue(kind, value))
  }, [draftValue, kind, value])

  if (kind === "boolean") {
    return (
      <div
        {...props}
        data-slot="data-cell"
        data-kind={kind}
        data-mode="edit"
        className={cn(dataCellDisplayClass, "justify-center px-1", className)}
      >
        <input
          type="checkbox"
          name={name}
          checked={Boolean(value)}
          data-state={Boolean(value) ? "checked" : "unchecked"}
          disabled={disabled}
          autoFocus={autoFocus}
          className={dataCellCheckboxInputClass}
          onChange={(event) =>
            onValueCommit?.(event.currentTarget.checked, {
              kind,
              rawValue: String(event.currentTarget.checked),
              isEmpty: false,
              isValid: true,
            })
          }
          onFocus={(event) => {
            onInputFocusChange?.(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            onInputFocusChange?.(false)
            onInputEditingEnd?.()
            onBlur?.(event)
          }}
          onClick={(event) => {
            event.stopPropagation()
            onClick?.(event)
          }}
          onKeyDown={onKeyDown}
          onDoubleClick={onDoubleClick}
        />
      </div>
    )
  }

  const inputType = inputTypeForDataCell(kind)

  return (
    <input
      {...props}
      data-slot="data-cell"
      data-kind={kind}
      data-mode="edit"
      type={inputType}
      name={name}
      value={inputValue}
      disabled={disabled}
      autoFocus={autoFocus}
      step={kind === "integer" ? 1 : kind === "number" ? "any" : undefined}
      placeholder={placeholder}
      className={cn(
        dataCellInputClass,
        (kind === "number" || kind === "integer") &&
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      onChange={(event) => {
        const nextValue = event.currentTarget.value
        if (draftValue === undefined) setUncontrolledDraftValue(nextValue)
        onDraftValueChange?.(
          nextValue,
          getDataCellValueMeta({
            kind,
            value: nextValue,
            isBadInput: event.currentTarget.validity.badInput,
          })
        )
      }}
      onFocus={(event) => {
        onInputFocusChange?.(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        const rawValue = event.currentTarget.value
        onValueCommit?.(
          parseDataCellInputValue({
            kind,
            value: rawValue,
            dateTimeZone,
            previousValue: value,
          }),
          getDataCellValueMeta({
            kind,
            value: rawValue,
            isBadInput: event.currentTarget.validity.badInput,
          })
        )
        onInputFocusChange?.(false)
        onInputEditingEnd?.()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.currentTarget.blur()
          event.preventDefault()
        }
        onKeyDown?.(event)
      }}
      onClick={(event) => {
        if (document.activeElement === event.currentTarget) {
          event.stopPropagation()
        }
        onClick?.(event)
      }}
      onDoubleClick={(event) => {
        if (!disabled) event.currentTarget.focus()
        onDoubleClick?.(event)
      }}
    />
  )
}

function DataCellDisplay({
  kind,
  value,
  editable = false,
  disabled: _disabled,
  name: _name,
  placeholder,
  className,
  dateTimeZone: _dateTimeZone,
  formatValue,
  draftValue: _draftValue,
  autoFocus: _autoFocus,
  onDraftValueChange: _onDraftValueChange,
  onValueCommit: _onValueCommit,
  ...props
}: DataCellProps) {
  if (kind === "boolean") {
    return (
      <div
        {...props}
        data-slot="data-cell"
        data-kind={kind}
        data-mode="display"
        aria-readonly={!editable || undefined}
        className={cn(
          dataCellDisplayClass,
          "justify-center px-1",
          editable && "cursor-pointer hover:bg-muted/50",
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
          {Boolean(value) ? (
            <span
              data-slot="checkbox-indicator"
              className="flex items-center justify-center text-current transition-none"
            >
              <CheckIcon className="size-3.5" />
            </span>
          ) : null}
        </span>
      </div>
    )
  }

  const content =
    formatValue?.(value, { kind }) ?? formatDataCellDisplayValue(kind, value)
  const isEmpty = content === ""

  return (
    <div
      {...props}
      data-slot="data-cell"
      data-kind={kind}
      data-mode="display"
      aria-readonly={!editable || undefined}
      className={cn(
        dataCellDisplayClass,
        (kind === "number" || kind === "integer") && "justify-end tabular-nums",
        editable && "cursor-text hover:bg-muted/50",
        className
      )}
    >
      <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
        {isEmpty ? (placeholder ?? "—") : content}
      </span>
    </div>
  )
}

export function parseDataCellNumberInput({
  kind,
  value,
}: {
  kind: "number" | "integer"
  value: string
}): { value: number | null; isEmpty: boolean; isValid: boolean } {
  const rawValue = value.trim()
  if (rawValue === "") return { value: null, isEmpty: true, isValid: true }
  if (kind === "integer" && !/^[+-]?\d+$/.test(rawValue)) {
    return { value: null, isEmpty: false, isValid: false }
  }
  if (
    kind === "number" &&
    !/^[+-]?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(rawValue)
  ) {
    return { value: null, isEmpty: false, isValid: false }
  }
  const parsed = Number(rawValue)
  return Number.isFinite(parsed)
    ? { value: parsed, isEmpty: false, isValid: true }
    : { value: null, isEmpty: false, isValid: false }
}

export function formatDataCellDisplayValue(
  kind: DataCellKind,
  value: unknown
): string {
  if (value === null || value === undefined || value === "") return ""
  const text = String(value)
  if (kind === "date-time") return dateTimeInputValue(text) || text
  if (kind === "date") return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? text
  if (kind === "time") return text.match(/^\d{2}:\d{2}(?::\d{2})?/)?.[0] ?? text
  return text
}

function parseDataCellInputValue({
  kind,
  value,
  dateTimeZone,
  previousValue,
}: {
  kind: DataCellKind
  value: string
  dateTimeZone: DataCellDateTimeZone
  previousValue: DataCellValue
}): DataCellCommitValue {
  if (kind === "number" || kind === "integer") {
    return parseDataCellNumberInput({ kind, value }).value
  }
  if (kind === "date-time") {
    if (value === "") return null
    if (dateTimeZone === "utc") return `${value}Z`
    if (dateTimeZone === "preserve") {
      return `${value}${dateTimeSuffix(previousValue)}`
    }
  }
  return value === "" ? null : value
}

function getDataCellValueMeta({
  kind,
  value,
  isBadInput = false,
}: {
  kind: DataCellKind
  value: string
  isBadInput?: boolean
}): DataCellValueMeta {
  if (kind === "number" || kind === "integer") {
    if (isBadInput) {
      return {
        kind,
        rawValue: value,
        isEmpty: false,
        isValid: false,
      }
    }
    const parsed = parseDataCellNumberInput({ kind, value })
    return {
      kind,
      rawValue: value,
      isEmpty: parsed.isEmpty,
      isValid: parsed.isValid,
    }
  }
  return {
    kind,
    rawValue: value,
    isEmpty: value === "",
    isValid: true,
  }
}

function inputTypeForDataCell(kind: DataCellKind): React.HTMLInputTypeAttribute {
  if (kind === "number" || kind === "integer") return "number"
  if (kind === "date-time") return "datetime-local"
  if (kind === "date" || kind === "time") return kind
  return "text"
}

function formatDataCellEditValue(kind: DataCellKind, value: DataCellValue) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  return kind === "date-time" ? dateTimeInputValue(text) : text
}

function dateTimeInputValue(value: string): string {
  const withoutTimezone = value.trim().replace(/(?:Z|[+-]\d{2}:\d{2})$/, "")
  return withoutTimezone.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0] ?? value
}

function dateTimeSuffix(value: DataCellValue): string {
  if (typeof value !== "string") return ""
  return value.trim().match(/(?:Z|[+-]\d{2}:\d{2})$/)?.[0] ?? ""
}
