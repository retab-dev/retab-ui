import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

const dateTimeSchemaCache = new WeakMap<object, boolean>()

const dateFormats = [
  { pattern: /(\d{1,2})\s+(\d{1,2})\s+(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/, year: 1, month: 2, day: 3 },
]

const timeFormat = /(\d{1,2}):(\d{1,2})(:(\d{1,2}))?(\s*(AM|PM))?/i
const isoDateTimeFormat =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z?$/
const isoDateTimeShortFormat = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z?$/
const isoDateFormat = /^(\d{4})-(\d{2})-(\d{2})$/

export type DateInfo = {
  year?: number
  month?: number
  day?: number
  hours?: number
  minutes?: number
  seconds?: number
}

function isSchemaObject(
  schema: JSONSchema7Definition | undefined
): schema is JSONSchema7 {
  return typeof schema === "object" && schema !== null
}

function isDateTimeFormat(format: unknown): boolean {
  return format === "date" || format === "date-time" || format === "iso-time"
}

export function parseDateTime(value: string): DateInfo | null {
  if (typeof value !== "string") return null
  const input = value.trim()
  if (!input) return null

  const info: DateInfo = {}

  const isoFullMatch = input.match(isoDateTimeFormat)
  if (isoFullMatch) {
    return {
      year: parseInt(isoFullMatch[1], 10),
      month: parseInt(isoFullMatch[2], 10) - 1,
      day: parseInt(isoFullMatch[3], 10),
      hours: parseInt(isoFullMatch[4], 10),
      minutes: parseInt(isoFullMatch[5], 10),
      seconds: parseInt(isoFullMatch[6], 10),
    }
  }

  const isoShortMatch = input.match(isoDateTimeShortFormat)
  if (isoShortMatch) {
    return {
      year: parseInt(isoShortMatch[1], 10),
      month: parseInt(isoShortMatch[2], 10) - 1,
      day: parseInt(isoShortMatch[3], 10),
      hours: parseInt(isoShortMatch[4], 10),
      minutes: parseInt(isoShortMatch[5], 10),
    }
  }

  const isoDateMatch = input.match(isoDateFormat)
  if (isoDateMatch) {
    return {
      year: parseInt(isoDateMatch[1], 10),
      month: parseInt(isoDateMatch[2], 10) - 1,
      day: parseInt(isoDateMatch[3], 10),
    }
  }

  const jsDate = new Date(input)
  if (!Number.isNaN(jsDate.getTime())) {
    return {
      year: jsDate.getFullYear(),
      month: jsDate.getMonth(),
      day: jsDate.getDate(),
      hours: jsDate.getHours(),
      minutes: jsDate.getMinutes(),
      seconds: jsDate.getSeconds(),
    }
  }

  let remaining = input
  for (const format of dateFormats) {
    const match = remaining.match(format.pattern)
    if (!match) continue
    info.year = parseInt(match[format.year], 10)
    info.month = parseInt(match[format.month], 10) - 1
    info.day = parseInt(match[format.day], 10)
    remaining = remaining.slice(match[0].length).trim()
    break
  }

  const timeMatch = remaining.match(timeFormat)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const seconds = timeMatch[4] ? parseInt(timeMatch[4], 10) : undefined
    const ampm = timeMatch[6] ? timeMatch[6].toUpperCase() : null

    if (ampm === "PM" && hours !== 12) hours += 12
    if (ampm === "AM" && hours === 12) hours = 0

    info.hours = hours
    info.minutes = minutes
    if (seconds !== undefined) info.seconds = seconds
  }

  if (
    info.year === undefined &&
    info.month === undefined &&
    info.day === undefined &&
    info.hours === undefined &&
    info.minutes === undefined &&
    info.seconds === undefined
  ) {
    return null
  }

  return info
}

export function dateStringToFormat(value: string, format: string): string {
  const date = parseDateTime(value)
  if (!date) return ""

  const pad = (n?: number) =>
    n !== undefined ? String(n).padStart(2, "0") : "00"
  const yyyy =
    date.year !== undefined ? String(date.year).padStart(4, "0") : "0000"
  const mm = pad((date.month ?? 0) + 1)
  const dd = pad(date.day ?? 1)
  const HH = pad(date.hours ?? 0)
  const MM = pad(date.minutes ?? 0)
  const SS = pad(date.seconds ?? 0)

  if (format.includes("T")) return `${yyyy}-${mm}-${dd}T${HH}:${MM}`
  if (format.includes("-")) return `${yyyy}-${mm}-${dd}`
  if (format.includes(":")) {
    return date.seconds !== undefined ? `${HH}:${MM}:${SS}` : `${HH}:${MM}`
  }
  return `${yyyy}-${mm}-${dd}`
}

export function dateToHTMLDateTimeString(date: string): string {
  return dateStringToFormat(date, "2000-01-01T00:00") || "2000-01-01T00:00"
}

export function dateToHTMLDateString(date: string): string {
  return dateStringToFormat(date, "2000-01-01") || "2000-01-01"
}

export function dateToHTMLTimeString(date: string): string {
  return dateStringToFormat(date, "00:00") || "00:00"
}

export function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getLocalDateTimeString(date: Date): string {
  const dateString = getLocalDateString(date)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${dateString}T${hours}:${minutes}:${seconds}`
}

export function parseDateStringAsLocal(
  dateString: string | null | undefined
): Date | null {
  if (!dateString) return null
  const info = parseDateTime(dateString)
  if (
    !info ||
    info.year === undefined ||
    info.month === undefined ||
    info.day === undefined
  ) {
    return null
  }
  return new Date(info.year, info.month, info.day)
}

function hasDateTimeInSchema(
  schema: JSONSchema7Definition | undefined
): boolean {
  if (!isSchemaObject(schema)) return false
  const cached = dateTimeSchemaCache.get(schema)
  if (cached !== undefined) return cached

  let found = false
  try {
    if (isDateTimeFormat(schema.format)) {
      found = true
    } else if (schema.type === "object" && schema.properties) {
      found = Object.values(schema.properties).some(hasDateTimeInSchema)
    } else if (schema.type === "array" && schema.items) {
      found = Array.isArray(schema.items)
        ? schema.items.some(hasDateTimeInSchema)
        : hasDateTimeInSchema(schema.items)
    } else {
      const branches = schema.anyOf || schema.oneOf || schema.allOf
      found = !!branches?.some(hasDateTimeInSchema)
    }
  } finally {
    dateTimeSchemaCache.set(schema, found)
  }
  return found
}

export function autoFormatDateTimeFields<T>(
  data: T,
  schema: JSONSchema7Definition | undefined
): T {
  if (!data || !isSchemaObject(schema)) return data

  if (Array.isArray(data)) {
    const itemSchema = Array.isArray(schema.items) ? undefined : schema.items
    if (!itemSchema || !hasDateTimeInSchema(itemSchema)) return data
    return data.map((item) => autoFormatDateTimeFields(item, itemSchema)) as T
  }

  if (typeof data === "object" && data !== null) {
    const result: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    }
    const properties = schema.properties
    if (!properties) return result as T

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!(key in result) || !isSchemaObject(propertySchema)) continue
      result[key] = formatValueForCommit(result[key], propertySchema)
    }

    return result as T
  }

  return data
}

export function formatValueForCommit(
  value: unknown,
  schema: JSONSchema7Definition | undefined
): unknown {
  if (!isSchemaObject(schema)) return value

  if (typeof value === "string" && isDateTimeFormat(schema.format)) {
    switch (schema.format) {
      case "date":
        return dateStringToFormat(value, "2000-01-01") || value
      case "iso-time":
        return dateStringToFormat(value, "00:00") || value
      case "date-time":
        return dateStringToFormat(value, "2000-01-01T00:00:00") || value
    }
  }

  if (
    (schema.type === "object" || schema.type === "array") &&
    hasDateTimeInSchema(schema)
  ) {
    return autoFormatDateTimeFields(value, schema)
  }

  return value
}
