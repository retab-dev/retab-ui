"use client"

import * as React from "react"
import { CalendarIcon, CheckIcon, ClockIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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

type DataCellCommitHandler = (
  value: DataCellCommitValue,
  meta: DataCellValueMeta
) => void

type DataCellBaseProps<Kind extends DataCellKind, Value> = Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "defaultValue" | "onChange"
> & {
  kind: Kind
  value?: Value
  mode?: DataCellMode
  editable?: boolean
  disabled?: boolean
  name?: string
  placeholder?: string
  dateTimeZone?: DataCellDateTimeZone
  formatValue?: (
    value: Value | undefined,
    meta: { kind: Kind }
  ) => React.ReactNode
  draftValue?: string
  autoFocus?: boolean
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
}

export type DataCellProps =
  | (DataCellBaseProps<"number" | "integer", number | string | null> & {
      onCommit?: (value: number | null, meta: DataCellValueMeta) => void
    })
  | (DataCellBaseProps<"boolean", boolean | null> & {
      onCommit?: (value: boolean, meta: DataCellValueMeta) => void
    })
  | (DataCellBaseProps<
      "text" | "date" | "time" | "date-time",
      string | null
    > & {
      onCommit?: (value: string | null, meta: DataCellValueMeta) => void
    })

type DataCellFormatValue = (
  value: DataCellValue,
  meta: { kind: DataCellKind }
) => React.ReactNode

const dataCellDisplayClass =
  "relative inline-flex w-full rounded-lg bg-transparent text-base text-foreground ring-ring/24 transition-shadow has-disabled:opacity-64 sm:text-sm"

const dataCellDisplayValueClass =
  "flex h-8.5 w-full min-w-0 items-center rounded-[inherit] px-3 leading-8.5 sm:h-7.5 sm:leading-7.5"

const dataCellPickerTriggerClass =
  "relative inline-flex h-8.5 w-full min-w-0 shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-lg bg-transparent px-3 text-base font-normal whitespace-nowrap text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 sm:h-7.5 sm:text-sm pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4"

const dataCellBooleanDisplayClass =
  "flex h-8 w-full min-w-0 items-center overflow-hidden rounded-lg bg-transparent px-3 text-sm text-foreground ring-ring/24 transition-shadow"

const dataCellCheckboxDisplayClass =
  "peer bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 size-4 shrink-0 rounded-[4px] transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"

function DataCellBooleanIndicator({ checked }: { checked: boolean }) {
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

export function DataCell({ mode, editable = false, ...props }: DataCellProps) {
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
      onMouseLeave={(event) => {
        setIsPointerOver(false)
        onMouseLeave?.(event)
      }}
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
  onCommit,
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
    const checked = Boolean(value)
    const {
      id,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rootProps
    } = props

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
          onFocus={(event) => {
            onInputFocusChange?.(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            onInputFocusChange?.(false)
            onInputEditingEnd?.()
            onBlur?.(event)
          }}
          onKeyDown={onKeyDown}
          onDoubleClick={onDoubleClick}
        >
          <DataCellBooleanIndicator checked={checked} />
        </button>
      </div>
    )
  }

  if (kind === "date" || kind === "time" || kind === "date-time") {
    return (
      <DataCellPickerEdit
        kind={kind}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        dateTimeZone={dateTimeZone}
        className={className}
        draftValue={draftValue}
        autoFocus={autoFocus}
        onDraftValueChange={onDraftValueChange}
        onCommit={onCommit as DataCellCommitHandler | undefined}
        onInputFocusChange={onInputFocusChange}
        onInputEditingEnd={onInputEditingEnd}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        {...props}
      />
    )
  }

  const inputType = inputTypeForDataCell(kind)
  const {
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rootProps
  } = props

  return (
    <Input
      {...rootProps}
      type={inputType}
      className={cn(dataCellDisplayClass, className)}
      id={id}
      name={name}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      data-kind={kind}
      data-mode="edit"
      value={inputValue}
      disabled={disabled}
      autoFocus={autoFocus}
      unstyled
      nativeInput
      inputMode={
        kind === "integer"
          ? "numeric"
          : kind === "number"
            ? "decimal"
            : undefined
      }
      step={kind === "integer" ? 1 : kind === "number" ? "any" : undefined}
      placeholder={placeholder}
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
        ;(onCommit as DataCellCommitHandler | undefined)?.(
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
      onClick={onClick}
      onDoubleClick={onDoubleClick}
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
  onCommit: _onCommit,
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
          dataCellBooleanDisplayClass,
          "justify-center px-1",
          editable && "cursor-pointer",
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
        placeholder={placeholder}
        formatValue={formatValue as DataCellFormatValue | undefined}
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
      aria-readonly={!editable || undefined}
      className={cn(dataCellDisplayClass, editable && "cursor-text", className)}
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
  placeholder,
  formatValue,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  kind: "date" | "time" | "date-time"
  value: DataCellValue
  editable?: boolean
  placeholder?: string
  formatValue?: DataCellFormatValue
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
      aria-readonly={!editable || undefined}
      className={cn(
        dataCellPickerTriggerClass,
        editable && "cursor-pointer",
        className
      )}
    >
      <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
        {isEmpty ? (placeholder ?? "—") : content}
      </span>
      <DataCellPickerIcon kind={kind} />
    </div>
  )
}

function DataCellPickerEdit({
  kind,
  value,
  disabled,
  placeholder,
  dateTimeZone,
  className,
  draftValue,
  autoFocus,
  onDraftValueChange,
  onCommit,
  onInputFocusChange,
  onInputEditingEnd,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onDoubleClick,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, "children" | "onChange"> & {
  kind: "date" | "time" | "date-time"
  value: string | null | undefined
  disabled?: boolean
  placeholder?: string
  dateTimeZone: DataCellDateTimeZone
  draftValue?: string
  autoFocus?: boolean
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onCommit?: DataCellCommitHandler
  onInputFocusChange?: (focused: boolean) => void
  onInputEditingEnd?: () => void
}) {
  const initialPickerValue = formatDataCellEditValue(kind, value)
  const [uncontrolledDraftValue, setUncontrolledDraftValue] =
    React.useState(initialPickerValue)
  const [open, setOpen] = React.useState(Boolean(autoFocus))
  const pickerValue = draftValue ?? uncontrolledDraftValue
  const selectedDate = dateFromPickerValue(kind, pickerValue)
  const timeValue = timeFromPickerValue(kind, pickerValue)
  const content = formatDataCellDisplayValue(kind, pickerValue)
  const isEmpty = content === ""

  React.useEffect(() => {
    if (draftValue !== undefined) return
    setUncontrolledDraftValue(formatDataCellEditValue(kind, value))
  }, [draftValue, kind, value])

  const updatePickerValue = (nextValue: string, commit = false) => {
    if (draftValue === undefined) setUncontrolledDraftValue(nextValue)
    const meta = getDataCellValueMeta({ kind, value: nextValue })
    onDraftValueChange?.(nextValue, meta)
    if (commit) {
      onCommit?.(
        parseDataCellInputValue({
          kind,
          value: nextValue,
          dateTimeZone,
          previousValue: value,
        }),
        meta
      )
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        onInputFocusChange?.(nextOpen)
        if (!nextOpen) onInputEditingEnd?.()
      }}
    >
      <PopoverTrigger asChild>
        <button
          {...props}
          type="button"
          data-slot="data-cell"
          data-kind={kind}
          data-mode="edit"
          data-empty={isEmpty || undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(dataCellPickerTriggerClass, className)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        >
          <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
            {isEmpty ? (placeholder ?? "—") : content}
          </span>
          <DataCellPickerIcon kind={kind} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        {(kind === "date" || kind === "date-time") && (
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              if (!nextDate) return
              const nextValue = pickerValueWithDate(kind, pickerValue, nextDate)
              updatePickerValue(nextValue, true)
              if (kind === "date") setOpen(false)
            }}
          />
        )}
        {(kind === "time" || kind === "date-time") && (
          <div className="border-t p-2 first:border-t-0">
            <Input
              type="time"
              nativeInput
              value={timeValue}
              onChange={(event) => {
                updatePickerValue(
                  pickerValueWithTime(
                    kind,
                    pickerValue,
                    event.currentTarget.value
                  ),
                  true
                )
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function DataCellPickerIcon({ kind }: { kind: DataCellKind }) {
  if (kind === "time") return <ClockIcon />
  return <CalendarIcon />
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
  if (kind === "number" || kind === "integer") {
    return formatNativeNumberDisplayValue(text)
  }
  if (kind === "date-time") return formatDateTimeDisplayValue(text)
  if (kind === "date") return formatDateDisplayValue(text)
  if (kind === "time") return formatTimeDisplayValue(text)
  return text
}

function formatNativeNumberDisplayValue(value: string): string {
  return value.replace(/^([+-]?\d+)\.(\d+)$/, "$1,$2")
}

function formatDateDisplayValue(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatDateTimeDisplayValue(value: string): string {
  const inputValue = dateTimeInputValue(value)
  const match = inputValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return inputValue || value
  return `${match[3]}/${match[2]}/${match[1]}, ${match[4]}:${match[5]}`
}

function formatTimeDisplayValue(value: string): string {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return value
  return [match[1], match[2], match[3]].filter(Boolean).join(":")
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

function dateFromPickerValue(
  kind: "date" | "time" | "date-time",
  value: string
): Date | undefined {
  if (kind === "time" || value === "") return undefined
  const dateValue =
    kind === "date-time" ? value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : value
  if (!dateValue) return undefined
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function timeFromPickerValue(
  kind: "date" | "time" | "date-time",
  value: string
): string {
  if (kind === "date") return ""
  return value.match(/\d{2}:\d{2}(?::\d{2})?/)?.[0] ?? ""
}

function pickerValueWithDate(
  kind: "date" | "date-time",
  value: string,
  date: Date
): string {
  const dateValue = formatPickerDateValue(date)
  if (kind === "date") return dateValue
  return `${dateValue}T${timeFromPickerValue("date-time", value) || "00:00"}`
}

function pickerValueWithTime(
  kind: "time" | "date-time",
  value: string,
  time: string
): string {
  if (kind === "time") return time
  const dateValue =
    value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? formatPickerDateValue(new Date())
  return `${dateValue}T${time || "00:00"}`
}

function formatPickerDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

function inputTypeForDataCell(
  kind: DataCellKind
): React.HTMLInputTypeAttribute {
  if (kind === "number" || kind === "integer") return "number"
  if (kind === "date-time") return "datetime-local"
  if (kind === "date" || kind === "time") return kind
  return "text"
}

function formatDataCellEditValue(kind: DataCellKind, value: DataCellValue) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (kind === "date-time") return dateTimeInputValue(text)
  if (kind === "date") return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? text
  if (kind === "time") return text.match(/^\d{2}:\d{2}(?::\d{2})?/)?.[0] ?? text
  return text
}

function dateTimeInputValue(value: string): string {
  const withoutTimezone = value.trim().replace(/(?:Z|[+-]\d{2}:\d{2})$/, "")
  return withoutTimezone.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0] ?? value
}

function dateTimeSuffix(value: DataCellValue): string {
  if (typeof value !== "string") return ""
  return value.trim().match(/(?:Z|[+-]\d{2}:\d{2})$/)?.[0] ?? ""
}
