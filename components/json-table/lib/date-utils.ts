import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

const dateTimeSchemaCache = new WeakMap<object, boolean>()

const dateFormats = [
  {
    pattern: /(\d{1,2})\s+(\d{1,2})\s+(\d{4})/,
    dayIndex: 1,
    monthIndex: 2,
    yearIndex: 3,
  },
  {
    pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    dayIndex: 1,
    monthIndex: 2,
    yearIndex: 3,
  },
  {
    pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/,
    dayIndex: 1,
    monthIndex: 2,
    yearIndex: 3,
  },
  {
    pattern: /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    dayIndex: 1,
    monthIndex: 2,
    yearIndex: 3,
  },
  {
    pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/,
    yearIndex: 1,
    monthIndex: 2,
    dayIndex: 3,
  },
]
// Updated time format to handle both 24-hour and 12-hour (AM/PM) formats
const timeFormat = /(\d{1,2}):(\d{1,2})(:(\d{1,2}))?(\s*(AM|PM))?/i

// ISO date format patterns
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

export function parseDateTime(dateTimeString: string): DateInfo | null {
  // Handle non-string inputs
  if (typeof dateTimeString !== "string") {
    return null
  }

  const dateInfo: DateInfo = {}
  let remainingString = dateTimeString.trim()

  // Handle empty string
  if (!remainingString) {
    return null
  }

  // Try ISO datetime formats first (most common in modern apps)
  const isoFullMatch = remainingString.match(isoDateTimeFormat)
  if (isoFullMatch) {
    dateInfo.year = parseInt(isoFullMatch[1], 10)
    dateInfo.month = parseInt(isoFullMatch[2], 10) - 1 // Convert to 0-based month
    dateInfo.day = parseInt(isoFullMatch[3], 10)
    dateInfo.hours = parseInt(isoFullMatch[4], 10)
    dateInfo.minutes = parseInt(isoFullMatch[5], 10)
    dateInfo.seconds = parseInt(isoFullMatch[6], 10)
    return dateInfo
  }

  const isoShortMatch = remainingString.match(isoDateTimeShortFormat)
  if (isoShortMatch) {
    dateInfo.year = parseInt(isoShortMatch[1], 10)
    dateInfo.month = parseInt(isoShortMatch[2], 10) - 1 // Convert to 0-based month
    dateInfo.day = parseInt(isoShortMatch[3], 10)
    dateInfo.hours = parseInt(isoShortMatch[4], 10)
    dateInfo.minutes = parseInt(isoShortMatch[5], 10)
    return dateInfo
  }

  const isoDateMatch = remainingString.match(isoDateFormat)
  if (isoDateMatch) {
    dateInfo.year = parseInt(isoDateMatch[1], 10)
    dateInfo.month = parseInt(isoDateMatch[2], 10) - 1 // Convert to 0-based month
    dateInfo.day = parseInt(isoDateMatch[3], 10)
    return dateInfo
  }

  // Try standard JavaScript Date parsing as a fallback
  const jsDate = new Date(remainingString)
  if (!isNaN(jsDate.getTime())) {
    dateInfo.year = jsDate.getFullYear()
    dateInfo.month = jsDate.getMonth() // Already 0-based
    dateInfo.day = jsDate.getDate()
    dateInfo.hours = jsDate.getHours()
    dateInfo.minutes = jsDate.getMinutes()
    dateInfo.seconds = jsDate.getSeconds()
    return dateInfo
  }

  // Try to match legacy date formats
  for (const format of dateFormats) {
    const match = remainingString.match(format.pattern)
    if (match) {
      dateInfo.year = parseInt(match[format.yearIndex], 10)
      dateInfo.month = parseInt(match[format.monthIndex], 10) - 1 // Convert to 0-based month
      dateInfo.day = parseInt(match[format.dayIndex], 10)

      remainingString = remainingString.slice(match[0].length).trim()
      break
    }
  }

  // Try to match time format
  const timeMatch = remainingString.match(timeFormat)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const seconds = timeMatch[4] ? parseInt(timeMatch[4], 10) : undefined
    const ampm = timeMatch[6] ? timeMatch[6].toUpperCase() : null

    // Convert 12-hour format to 24-hour format
    if (ampm) {
      const _originalHours = hours
      if (ampm === "PM" && hours !== 12) {
        hours += 12
      } else if (ampm === "AM" && hours === 12) {
        hours = 0
      }
    }

    dateInfo.hours = hours
    dateInfo.minutes = minutes
    if (seconds !== undefined) {
      dateInfo.seconds = seconds
    }
  }

  // Return null if no date components were found
  if (
    dateInfo.year === undefined &&
    dateInfo.month === undefined &&
    dateInfo.day === undefined &&
    dateInfo.hours === undefined &&
    dateInfo.minutes === undefined &&
    dateInfo.seconds === undefined
  ) {
    return null
  }

  return dateInfo
}

export function dateStringToFormat(dateString: string, format: string): string {
  const date = parseDateTime(dateString)
  if (!date) {
    return "" // Return empty string instead of original for invalid dates
  }

  // Helper padders
  const pad = (n?: number) =>
    n !== undefined ? String(n).padStart(2, "0") : "00"
  const yyyy =
    date.year !== undefined ? String(date.year).padStart(4, "0") : "0000"
  const mm = pad((date.month ?? 0) + 1) // `month` is 0-based in `parseDateTime`
  const dd = pad(date.day ?? 1)
  const HH = pad(date.hours ?? 0)
  const MM = pad(date.minutes ?? 0)
  const SS = pad(date.seconds ?? 0)

  /* Decide what to return based on the `format` hint --------------------- */
  /* We only look at the *shape* of the hint, not its literal digits.       */
  let result: string
  if (format.includes("T")) {
    // e.g. "2000-01-01T00:00"
    result = `${yyyy}-${mm}-${dd}T${HH}:${MM}`
  } else if (format.includes("-")) {
    // e.g. "2000-01-01"
    result = `${yyyy}-${mm}-${dd}`
  } else if (format.includes(":")) {
    // e.g. "00:00" or "00:00:00"
    if (date.seconds !== undefined) {
      result = `${HH}:${MM}:${SS}`
    } else {
      result = `${HH}:${MM}`
    }
  } else {
    // Fallback – return a default date format
    result = `${yyyy}-${mm}-${dd}`
  }

  return result
}

export function dateToHTMLDateTimeString(date: string): string {
  const result = dateStringToFormat(date, "2000-01-01T00:00")
  // Ensure we return a valid datetime-local format
  return result || "2000-01-01T00:00"
}

export function dateToHTMLDateString(date: string): string {
  const result = dateStringToFormat(date, "2000-01-01")
  // Ensure we return a valid date format
  return result || "2000-01-01"
}

export function dateToHTMLTimeString(date: string): string {
  const result = dateStringToFormat(date, "00:00")
  // Ensure we return a valid time format
  return result || "00:00"
}

// Helper function to get date string in local timezone without UTC conversion issues
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Helper function to get date-time string in local timezone without UTC conversion issues
export function getLocalDateTimeString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function isSchemaObject(
  schema: JSONSchema7Definition | undefined
): schema is JSONSchema7 {
  return typeof schema === "object" && schema !== null
}

function hasDateTimeFormat(format: unknown): boolean {
  return format === "date" || format === "date-time" || format === "iso-time"
}

/**
 * Parse a date-only string into a Date at LOCAL midnight.
 * Avoids the UTC-midnight pitfall of new Date("YYYY-MM-DD") and parseISO().
 */
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

/**
 * Automatically formats date/time fields in data based on the JSON schema
 * @param data The data object to process
 * @param schema The JSON schema defining field formats
 * @param path Current path in the object (for nested objects)
 * @returns The data with formatted date/time fields
 */
export function autoFormatDateTimeFields<T>(
  data: T,
  schema: JSONSchema7Definition | undefined,
  path: string = ""
): T {
  if (!data || !isSchemaObject(schema)) return data

  // Detect whether a schema subtree contains date/time format fields.
  const hasDateTimeInSchema = (
    subSchema: JSONSchema7Definition | undefined
  ): boolean => {
    if (!isSchemaObject(subSchema)) return false
    if (dateTimeSchemaCache.has(subSchema)) {
      return dateTimeSchemaCache.get(subSchema)!
    }

    let found = false
    try {
      if (hasDateTimeFormat(subSchema.format)) {
        found = true
      } else if (subSchema.type === "object" && subSchema.properties) {
        for (const propertySchema of Object.values(subSchema.properties)) {
          if (hasDateTimeInSchema(propertySchema)) {
            found = true
            break
          }
        }
      } else if (subSchema.type === "array" && subSchema.items) {
        found = Array.isArray(subSchema.items)
          ? subSchema.items.some((itemSchema) =>
              hasDateTimeInSchema(itemSchema)
            )
          : hasDateTimeInSchema(subSchema.items)
      } else if (subSchema.anyOf || subSchema.oneOf || subSchema.allOf) {
        const arr = subSchema.anyOf || subSchema.oneOf || subSchema.allOf
        if (arr?.some((optionSchema) => hasDateTimeInSchema(optionSchema))) {
          found = true
        }
      }
    } finally {
      dateTimeSchemaCache.set(subSchema, found)
    }
    return found
  }

  // Handle arrays
  if (Array.isArray(data)) {
    // Early exit if items subtree has no date/time formats
    const itemSchema = Array.isArray(schema.items) ? undefined : schema.items
    if (!itemSchema || !hasDateTimeInSchema(itemSchema)) {
      return data
    }
    return data.map((item, index) =>
      autoFormatDateTimeFields(item, itemSchema, `${path}[${index}]`)
    ) as T
  }

  // Handle objects
  if (typeof data === "object" && data !== null) {
    const result: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    }

    // Process each property in the schema
    const properties = schema.properties
    if (properties) {
      Object.keys(properties).forEach((key) => {
        if (key in result) {
          const propertySchema = properties[key]
          if (!isSchemaObject(propertySchema)) {
            return
          }

          const currentPath = path ? `${path}.${key}` : key

          // Check if this property has a date/time format
          if (
            hasDateTimeFormat(propertySchema.format) &&
            typeof result[key] === "string"
          ) {
            const originalValue = result[key] as string
            let formattedValue: string | null = null

            try {
              switch (propertySchema.format) {
                case "date":
                  formattedValue = dateStringToFormat(
                    originalValue,
                    "2000-01-01"
                  )
                  break
                case "iso-time":
                  formattedValue = dateStringToFormat(originalValue, "00:00")
                  break
                case "date-time":
                  formattedValue = dateStringToFormat(
                    originalValue,
                    "2000-01-01T00:00:00"
                  )
                  break
              }

              if (formattedValue && formattedValue !== originalValue) {
                result[key] = formattedValue
              }
            } catch (error) {
              console.warn(
                `autoFormatDateTimeFields: Failed to format ${currentPath}:`,
                error
              )
            }
          }
          // Handle nested objects and arrays
          else if (
            propertySchema.type === "object" ||
            propertySchema.type === "array"
          ) {
            // Skip deep traversal if subtree has no date/time fields
            if (hasDateTimeInSchema(propertySchema)) {
              result[key] = autoFormatDateTimeFields(
                result[key],
                propertySchema,
                currentPath
              )
            }
          }
        }
      })
    }

    return result as T
  }

  // Return primitive values unchanged
  return data
}
