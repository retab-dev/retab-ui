"use client"

import * as React from "react"
import { CalendarIcon, ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { DataCell, formatDataCellDisplayValue } from "@/components/ui/data-cell"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  compactJsonFormDataCellClass,
  type ControlFieldApi,
  type DateTimeControlKind,
  type ScalarControlDomProps,
} from "@/components/json-form/scalar/types"

export function datetimeLocalInputValue(value: string): string {
  const withoutTimezone = value.trim().replace(/(?:Z|[+-]\d{2}:\d{2})$/, "")
  return withoutTimezone.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0] ?? value
}

export function DateTimeScalarControl({
  kind,
  field,
  compact,
  nullable,
  ...controlProps
}: {
  kind: DateTimeControlKind
  field: ControlFieldApi
  compact: boolean
  nullable: boolean
} & ScalarControlDomProps) {
  const value = field.value == null ? "" : String(field.value)
  if (!compact) {
    return (
      <DateTimePickerControl
        {...controlProps}
        kind={kind}
        field={field}
        nullable={nullable}
      />
    )
  }

  return (
    <DataCell
      {...controlProps}
      kind={kind}
      active
      value={field.value == null ? null : value}
      dateTimeZone={kind === "date-time" ? "preserve" : undefined}
      draftValue={kind === "date-time" ? datetimeLocalInputValue(value) : value}
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

function DateTimePickerControl({
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
        className="w-auto rounded-xl p-2 before:rounded-[calc(var(--radius-xl)-1px)]"
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
