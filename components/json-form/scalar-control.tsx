"use client"

import * as React from "react"
import { CalendarIcon, ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DataCell,
  formatDataCellDisplayValue,
  parseDataCellNumberInput,
  type DataCellCommitValue,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/json-form/form-primitives"

import { isRecordValue, type FieldKind, type Schema } from "./schema-model"

export type JsonFormTextInput = "input" | "textarea"

export interface ControlFieldApi {
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  name: string
  ref?: React.Ref<HTMLElement>
}

type ScalarControlDomProps = {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  "data-slot"?: string
}

const NULL_SELECT_VALUE = "__json-form-null__"

const compactJsonFormDataCellClass =
  "h-8 rounded-md border-transparent bg-transparent px-2 text-sm shadow-none transition-colors hover:border-border hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"

const compactJsonFormSelectDataCellClass =
  "h-8 rounded-md border-transparent bg-transparent px-2 text-sm shadow-none transition-colors hover:border-border hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"

function enumOptionValue(index: number): string {
  return `enum:${index}`
}

export function enumLabel(value: unknown): string {
  if (value === null) return "No value"
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function hasOwnRecordValue(
  value: Record<string, unknown>,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

export function enumValueEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, index) => enumValueEquals(item, b[index]))
  }
  if (!isRecordValue(a) || !isRecordValue(b)) {
    return false
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(
    (key) => hasOwnRecordValue(b, key) && enumValueEquals(a[key], b[key])
  )
}

export function datetimeLocalInputValue(value: string): string {
  const withoutTimezone = value.trim().replace(/(?:Z|[+-]\d{2}:\d{2})$/, "")
  return withoutTimezone.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0] ?? value
}

function pickerPlaceholder(kind: DateTimeControlKind): string {
  if (kind === "time") return "Pick a time"
  if (kind === "date-time") return "Pick a date and time"
  return "Pick a date"
}

function pickerEditValue(kind: DateTimeControlKind, value: string): string {
  if (kind === "date-time") return datetimeLocalInputValue(value)
  if (kind === "date") return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value
  if (kind === "time")
    return value.match(/^\d{2}:\d{2}(?::\d{2})?/)?.[0] ?? value
  return value
}

function pickerDate(
  kind: DateTimeControlKind,
  value: string
): Date | undefined {
  if (kind === "time" || value === "") return undefined
  const dateValue =
    kind === "date-time" ? value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : value
  const match = dateValue?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function pickerTime(kind: DateTimeControlKind, value: string): string {
  if (kind === "date") return ""
  return value.match(/\d{2}:\d{2}(?::\d{2})?/)?.[0] ?? ""
}

function pickerValueWithDate(
  kind: DateTimeControlKind,
  value: string,
  date: Date
): string {
  const dateValue = formatPickerDate(date)
  if (kind === "date") return dateValue
  if (kind === "time") return value
  return `${dateValue}T${pickerTime("date-time", value) || "00:00"}`
}

function pickerValueWithTime(
  kind: DateTimeControlKind,
  value: string,
  time: string
): string {
  if (kind === "time") return time
  if (kind === "date") return value
  const dateValue =
    value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? formatPickerDate(new Date())
  return `${dateValue}T${time || "00:00"}`
}

function formatPickerDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function NullableBooleanControl({
  field,
  label,
  ...controlProps
}: {
  field: ControlFieldApi
  label: string
} & ScalarControlDomProps) {
  const selectValue =
    field.value === true
      ? "true"
      : field.value === false
        ? "false"
        : NULL_SELECT_VALUE
  const displayValue =
    field.value === true ? "True" : field.value === false ? "False" : "No value"

  return (
    <Select
      value={selectValue}
      onValueChange={(value) => {
        if (value === "true") {
          field.onChange(true)
          return
        }
        if (value === "false") {
          field.onChange(false)
          return
        }
        field.onChange(null)
      }}
    >
      <SelectTrigger {...controlProps} aria-label={label}>
        <SelectValue placeholder="Select...">{displayValue}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NULL_SELECT_VALUE}>No value</SelectItem>
        <SelectItem value="true">True</SelectItem>
        <SelectItem value="false">False</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function ScalarControl({
  kind,
  schema,
  field,
  textInput,
  compact = false,
  nullable = false,
  ...controlProps
}: {
  kind: FieldKind
  schema: Schema
  field: ControlFieldApi
  textInput?: JsonFormTextInput
  /** Dense, single-line variant for table cells. */
  compact?: boolean
  nullable?: boolean
} & ScalarControlDomProps) {
  if (kind === "enum") {
    const enumValues = schema.enum ?? []
    const hasNullEnumValue = enumValues.some((value) => value === null)
    const currentIndex = enumValues.findIndex((value) =>
      enumValueEquals(value, field.value)
    )
    const selectValue =
      currentIndex >= 0
        ? enumOptionValue(currentIndex)
        : field.value === null && nullable
          ? NULL_SELECT_VALUE
          : undefined
    const displayValue =
      currentIndex >= 0
        ? enumLabel(enumValues[currentIndex])
        : field.value === null && nullable
          ? "No value"
          : undefined

    return (
      <Select
        value={selectValue}
        onValueChange={(value) => {
          if (typeof value !== "string") return
          if (value === NULL_SELECT_VALUE) {
            field.onChange(null)
            return
          }
          const index = Number(value.replace("enum:", ""))
          field.onChange(enumValues[index])
        }}
      >
        <SelectTrigger
          {...controlProps}
          {...(compact
            ? {
                "data-slot": "data-cell",
                "data-kind": "text",
                "data-mode": "edit",
              }
            : {})}
          className={compact ? compactJsonFormSelectDataCellClass : undefined}
        >
          <SelectValue placeholder="Select...">{displayValue}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {nullable && !hasNullEnumValue ? (
            <SelectItem value={NULL_SELECT_VALUE}>No value</SelectItem>
          ) : null}
          {enumValues.map((option, index) => (
            <SelectItem
              key={enumOptionValue(index)}
              value={enumOptionValue(index)}
            >
              {enumLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (kind === "number" || kind === "integer") {
    if (!compact) {
      return (
        <Input
          {...controlProps}
          nativeInput
          type="number"
          inputMode={kind === "integer" ? "numeric" : "decimal"}
          step={kind === "integer" ? 1 : "any"}
          value={field.value == null ? "" : String(field.value)}
          onChange={(event) =>
            updateScalarDataCellValue({
              kind,
              value: event.currentTarget.value,
              nullable,
              field,
            })
          }
          onBlur={field.onBlur}
          name={field.name}
        />
      )
    }

    return (
      <DataCell
        {...controlProps}
        kind={kind}
        active
        value={dataCellNumberValue(field.value)}
        draftValue={field.value == null ? "" : String(field.value)}
        className={compactJsonFormDataCellClass}
        onDraftValueChange={(value, meta) =>
          updateScalarDataCellValue({ kind, value, meta, nullable, field })
        }
        onCommit={(value, meta) =>
          updateScalarDataCellValue({ kind, value, meta, nullable, field })
        }
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }

  const value = field.value == null ? "" : String(field.value)
  if (
    schema.format === "date" ||
    schema.format === "time" ||
    schema.format === "date-time"
  ) {
    const dataCellKind = schema.format
    if (!compact) {
      return (
        <DateTimeControl
          {...controlProps}
          kind={dataCellKind}
          field={field}
          nullable={nullable}
        />
      )
    }

    return (
      <DataCell
        {...controlProps}
        kind={dataCellKind}
        active
        value={field.value == null ? null : value}
        dateTimeZone={schema.format === "date-time" ? "preserve" : undefined}
        draftValue={
          schema.format === "date-time" ? datetimeLocalInputValue(value) : value
        }
        className={compactJsonFormDataCellClass}
        onDraftValueChange={(nextValue) =>
          field.onChange(nextValue === "" && nullable ? null : nextValue)
        }
        onCommit={(nextValue) =>
          field.onChange(nextValue === "" && nullable ? null : nextValue)
        }
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }

  if (!compact && shouldRenderTextarea(schema, textInput)) {
    return (
      <Textarea
        {...controlProps}
        value={value}
        onChange={(e) =>
          field.onChange(
            e.target.value === "" && nullable ? null : e.target.value
          )
        }
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }

  if (!compact) {
    return (
      <Input
        {...controlProps}
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
          field.onChange(nextValue === "" && nullable ? null : nextValue)
        }}
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }

  return (
    <DataCell
      {...controlProps}
      kind="text"
      active
      value={field.value == null ? null : value}
      draftValue={value}
      className={compactJsonFormDataCellClass}
      onDraftValueChange={(nextValue) =>
        field.onChange(nextValue === "" && nullable ? null : nextValue)
      }
      onCommit={(nextValue) =>
        field.onChange(nextValue === "" && nullable ? null : nextValue)
      }
      onBlur={field.onBlur}
      name={field.name}
    />
  )
}

function shouldRenderTextarea(
  schema: Schema,
  textInput: JsonFormTextInput | undefined
): boolean {
  if (textInput === "input") return false
  if (textInput === "textarea") return true
  return schema.format === "textarea" || (schema.maxLength ?? 0) > 120
}

type DateTimeControlKind = "date" | "time" | "date-time"

function DateTimeControl({
  kind,
  field,
  nullable,
  ...controlProps
}: {
  kind: DateTimeControlKind
  field: ControlFieldApi
  nullable: boolean
} & ScalarControlDomProps) {
  const [open, setOpen] = React.useState(false)
  const value = field.value == null ? "" : String(field.value)
  const pickerValue = pickerEditValue(kind, value)
  const selectedDate = pickerDate(kind, pickerValue)
  const timeValue = pickerTime(kind, pickerValue)
  const displayValue = formatDataCellDisplayValue(kind, value)
  const isEmpty = displayValue === ""

  const commitPickerValue = (nextValue: string) => {
    field.onChange(nextValue === "" && nullable ? null : nextValue)
  }

  const setDate = (date: Date) => {
    const nextValue = pickerValueWithDate(kind, pickerValue, date)
    commitPickerValue(nextValue)
    if (kind === "date") setOpen(false)
  }

  const setTime = (time: string) => {
    commitPickerValue(pickerValueWithTime(kind, pickerValue, time))
  }

  const setToday = () => {
    commitPickerValue(pickerValueWithDate(kind, pickerValue, new Date()))
    if (kind === "date") setOpen(false)
  }

  const setNow = () => {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`
    commitPickerValue(
      kind === "time"
        ? time
        : pickerValueWithTime(
            kind,
            pickerValueWithDate(kind, pickerValue, now),
            time
          )
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          {...controlProps}
          type="button"
          data-empty={isEmpty || undefined}
          className="inline-flex h-8.5 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-[calc(--spacing(3)-1px)] text-left text-base font-normal text-foreground shadow-xs/5 transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-64 aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/16 sm:h-7.5 sm:text-sm dark:bg-input/32"
          onBlur={field.onBlur}
        >
          <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
            {isEmpty ? pickerPlaceholder(kind) : displayValue}
          </span>
          {kind === "time" ? (
            <ClockIcon className="size-4.5 shrink-0 opacity-80 sm:size-4" />
          ) : (
            <CalendarIcon className="size-4.5 shrink-0 opacity-80 sm:size-4" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-xl p-0 before:rounded-[calc(var(--radius-xl)-1px)]"
        viewportClassName="p-2"
      >
        {(kind === "date" || kind === "date-time") && (
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (date) setDate(date)
            }}
          />
        )}
        {(kind === "time" || kind === "date-time") && (
          <div className="border-t p-3 first:border-t-0">
            <Input
              nativeInput
              type="time"
              step={1}
              value={timeValue}
              onChange={(event) => setTime(event.currentTarget.value)}
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => commitPickerValue("")}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={kind === "time" ? setNow : setToday}
          >
            {kind === "time" ? "Now" : "Today"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function updateScalarDataCellValue({
  kind,
  value,
  meta,
  nullable,
  field,
}: {
  kind: "number" | "integer"
  value: DataCellCommitValue | string
  meta?: DataCellValueMeta
  nullable: boolean
  field: ControlFieldApi
}) {
  const rawValue = meta?.rawValue ?? (typeof value === "string" ? value : "")
  const parsed = parseDataCellNumberInput({ kind, value: rawValue })

  if (!parsed.isValid) return
  if (parsed.isEmpty) {
    field.onChange(nullable ? null : undefined)
    return
  }
  field.onChange(parsed.value)
}

export function dataCellNumberValue(value: unknown): string | number | null {
  return typeof value === "number" || typeof value === "string" ? value : null
}

export function dataCellTextValue(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}
