import type {
  DataCellCommitValue,
  DataCellDateTimeZone,
  DataCellKind,
  DataCellValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

const dataCellIntegerInputPattern = /^[+-]?\d+$/
const dataCellNumberInputPattern =
  /^[+-]?(?:(?:\d+\.?\d*)|(?:\d*\.\d+))(?:e[+-]?\d+)?$/i
const dataCellNativeNumberDisplayPattern = /^([+-]?\d+)\.(\d+)$/
const dataCellDateDisplayPattern = /^(\d{4})-(\d{2})-(\d{2})/
const dataCellDateTimeDisplayPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
const dataCellTimeDisplayPattern = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/
const dataCellDateValuePattern = /^\d{4}-\d{2}-\d{2}/
const dataCellExactDateValuePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const dataCellTimeValuePattern = /\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?/
const dataCellDateTimeInputPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?/
const dataCellDateTimeZoneSuffixPattern = /(?:Z|[+-]\d{2}:\d{2})$/

export function parseDataCellNumberInput({
  kind,
  value,
}: {
  kind: "number" | "integer"
  value: string
}): { value: number | null; isEmpty: boolean; isValid: boolean } {
  const rawValue = value.trim()
  if (rawValue === "") return { value: null, isEmpty: true, isValid: true }
  if (kind === "integer" && !dataCellIntegerInputPattern.test(rawValue)) {
    return { value: null, isEmpty: false, isValid: false }
  }
  if (kind === "number" && !dataCellNumberInputPattern.test(rawValue)) {
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

export function parseDataCellInputValue({
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

export function getDataCellValueMeta({
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

export function formatDataCellEditValue(
  kind: DataCellKind,
  value: DataCellValue
) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (kind === "date-time") return dateTimeInputValue(text)
  if (kind === "date") return text.match(dataCellDateValuePattern)?.[0] ?? text
  if (kind === "time") {
    return text.match(dataCellTimeDisplayPattern)?.[0] ?? text
  }
  return text
}

export function dateFromPickerValue(
  kind: "date" | "time" | "date-time",
  value: string
): Date | undefined {
  if (kind === "time" || value === "") return undefined
  const dateValue =
    kind === "date-time" ? value.match(dataCellDateValuePattern)?.[0] : value
  if (!dateValue) return undefined
  const match = dateValue.match(dataCellExactDateValuePattern)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function timeFromPickerValue(
  kind: "date" | "time" | "date-time",
  value: string
): string {
  if (kind === "date") return ""
  return value.match(dataCellTimeValuePattern)?.[0] ?? ""
}

export function pickerValueWithDate(
  kind: "date" | "date-time",
  value: string,
  date: Date
): string {
  const dateValue = formatPickerDateValue(date)
  if (kind === "date") return dateValue
  return `${dateValue}T${timeFromPickerValue("date-time", value) || "00:00"}`
}

export function pickerValueWithTime(
  kind: "time" | "date-time",
  value: string,
  time: string
): string {
  if (kind === "time") return time
  const dateValue =
    value.match(dataCellDateValuePattern)?.[0] ??
    formatPickerDateValue(new Date())
  return `${dateValue}T${time || "00:00"}`
}

function formatNativeNumberDisplayValue(value: string): string {
  return value.replace(dataCellNativeNumberDisplayPattern, "$1,$2")
}

function formatDateDisplayValue(value: string): string {
  const match = value.match(dataCellDateDisplayPattern)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatDateTimeDisplayValue(value: string): string {
  const inputValue = dateTimeInputValue(value)
  const match = inputValue.match(dataCellDateTimeDisplayPattern)
  if (!match) return inputValue || value
  return `${match[3]}/${match[2]}/${match[1]}, ${match[4]}:${match[5]}`
}

function formatTimeDisplayValue(value: string): string {
  const match = value.match(dataCellTimeDisplayPattern)
  if (!match) return value
  return [match[1], match[2], match[3]].filter(Boolean).join(":")
}

function formatPickerDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateTimeInputValue(value: string): string {
  const withoutTimezone = value
    .trim()
    .replace(dataCellDateTimeZoneSuffixPattern, "")
  return withoutTimezone.match(dataCellDateTimeInputPattern)?.[0] ?? value
}

function dateTimeSuffix(value: DataCellValue): string {
  if (typeof value !== "string") return ""
  return value.trim().match(dataCellDateTimeZoneSuffixPattern)?.[0] ?? ""
}
