"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { JSONSchema7Definition } from "json-schema"
import { CalendarIcon, ChevronRight, ClockIcon, Plus, X } from "lucide-react"
import {
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import type { FieldAnchorLink } from "@/components/ui/anchored-document-viewer"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DataCell,
  formatDataCellDisplayValue,
  parseDataCellNumberInput,
  type DataCellCommitValue,
  type DataCellKind,
  type DataCellValue,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/components/ui/fixed-grid-layout"
import { getFixedGridRowStyle } from "@/components/ui/fixed-grid-row-style"
import { useFixedRowVirtualization } from "@/components/ui/fixed-grid-virtualization"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Textarea,
} from "@/components/json-form/form-primitives"
import {
  emptyValueFor,
  expandRefs,
  fieldKind,
  labelFor,
  scalarObjectColumns,
  unwrapNullable,
  type Column,
  type FieldKind,
  type Schema,
} from "@/components/json-form/schema-utils"

/**
 * A JSON-Schema-driven form built entirely on shadcn's `FormField` abstraction.
 *
 * Each schema property is rendered through `<FormField>` →
 * `<FormItem>/<FormLabel>/<FormControl>/<FormDescription>/<FormMessage>`, so it
 * inherits shadcn's react-hook-form wiring, accessibility, and error display
 * with zero bespoke styling. Objects nest, arrays repeat, and scalars map to the
 * matching control. Drop it inside your own `useForm()` instance.
 *
 * Built to scale to deep, repetitive documents (e.g. an extraction with
 * `properties[] → production[] → line_items[]`):
 *
 *  - **Lazy mount.** Nested objects and arrays are collapsible; their children
 *    are only mounted in the DOM while expanded, so a 5,000-field tree boots as
 *    a handful of summary rows.
 *  - **Table mode.** An array whose items are flat objects of scalars renders as
 *    a dense editable table (one row per item, one column per field) instead of
 *    a stack of bordered cards.
 *  - **Virtualization.** Long arrays (card *or* table mode) window their rows
 *    through `@tanstack/react-virtual`, so only the visible items are in the DOM.
 *  - **Isolated re-renders.** Each row subscribes to its own field state, so a
 *    keystroke in one item never re-renders its siblings.
 */

// Tunables -------------------------------------------------------------------

/** Objects/arrays at or beyond this nesting depth start collapsed. */
const AUTO_COLLAPSE_DEPTH = 1
/** Card-mode arrays longer than this are virtualized. */
const CARD_VIRTUALIZE_THRESHOLD = 30
const TABLE_MAX_HEIGHT = 420
const TABLE_ROW_HEIGHT = 44
/** Table-mode arrays longer than this keep a fixed-height internal scroll body. */
const TABLE_SCROLL_THRESHOLD = Math.floor(TABLE_MAX_HEIGHT / TABLE_ROW_HEIGHT)
/** Table-mode arrays longer than this are virtualized. */
const TABLE_VIRTUALIZE_THRESHOLD = 500
/** Arrays longer than this start collapsed regardless of depth. */
const LONG_ARRAY_THRESHOLD = 8
const TABLE_ROW_OVERSCAN = 3
const TABLE_JUMP_ROW_OVERSCAN = 6

// ---------------------------------------------------------------------------
// Anchor linking — opt-in field-level hover/highlight
// ---------------------------------------------------------------------------

/**
 * Optional anchor linking. When a form is given an `anchorLink`, every scalar
 * field (including array-table cells) becomes a hoverable card: hovering or
 * focusing it reports the field's path, and the
 * field whose path matches `activePath` gets the highlighted-card treatment.
 * Wire `onFieldHover` + `activePath` from a field anchor link.
 */
type FieldAnchorLinkActions = Omit<FieldAnchorLink, "activePath">

const FieldAnchorActivePathContext = React.createContext<string | null>(null)
const FieldAnchorActionsContext =
  React.createContext<FieldAnchorLinkActions | null>(null)
const DefaultOpenPathsContext = React.createContext<ReadonlySet<string> | null>(
  null
)

/**
 * Wraps a scalar leaf so it reports its path on hover/focus and lights up as a
 * card when active. A no-op (renders children untouched) outside an anchor-linked
 * form, so other `JsonFormField` usages are unaffected.
 */
function FieldAnchorShell({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  const activePath = React.useContext(FieldAnchorActivePathContext)
  const anchorActions = React.useContext(FieldAnchorActionsContext)
  if (!anchorActions) return <>{children}</>
  const active = activePath === name
  return (
    <div
      onMouseEnter={() => anchorActions.onFieldHover(name)}
      onMouseLeave={() => anchorActions.onFieldHover(null)}
      onFocus={() => anchorActions.onFieldHover(name)}
      onBlur={() => anchorActions.onFieldHover(null)}
      onClick={() => anchorActions.selectField?.(name)}
      className={cn(
        "rounded-md border px-3 py-2 transition-colors",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-transparent hover:bg-muted/60"
      )}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// JsonFormField — the unit of composition
// ---------------------------------------------------------------------------

export interface JsonFormFieldProps {
  /** react-hook-form field path, e.g. `vendor.name` or `items.0`. */
  name: string
  /** Logical document/source path before react-hook-form-safe path encoding. */
  sourcePath?: string
  schema: Schema
  required?: boolean
  /** Override the derived label. */
  label?: string
  /** Force plain string fields to render as single-line inputs or textareas. */
  textInput?: JsonFormTextInput
  className?: string
  /** Nesting depth, used to decide default collapse state. */
  depth?: number
}

export type JsonFormTextInput = "input" | "textarea"

export function JsonFormField({
  name,
  sourcePath,
  schema: rawSchema,
  required = false,
  label,
  textInput,
  className,
  depth = 0,
}: JsonFormFieldProps) {
  const expandedSchema = React.useMemo(
    () =>
      rawSchema.$ref || rawSchema.$defs || rawSchema.definitions
        ? expandRefs(rawSchema)
        : rawSchema,
    [rawSchema]
  )
  const { schema, nullable } = unwrapNullable(expandedSchema)
  const kind = fieldKind(schema)
  const heading = labelFor(name, schema, label)
  const logicalPath = sourcePath ?? name

  if (kind === "object") {
    return (
      <JsonFormObject
        name={name}
        sourcePath={logicalPath}
        schema={schema}
        label={heading}
        textInput={textInput}
        className={className}
        depth={depth}
      />
    )
  }

  if (kind === "array") {
    return (
      <JsonFormArray
        name={name}
        sourcePath={logicalPath}
        schema={schema}
        label={heading}
        textInput={textInput}
        className={className}
        depth={depth}
      />
    )
  }

  if (kind === "boolean") {
    if (nullable) {
      return (
        <FieldAnchorShell name={logicalPath}>
          <FormField
            name={name}
            render={({ field }) => (
              <FormItem className={className}>
                <WithDescription text={schema.description}>
                  <FormLabel>
                    {heading}
                    {required ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </FormLabel>
                </WithDescription>
                <FormControl>
                  <NullableBooleanControl
                    field={field}
                    label={`${heading}${required ? " *" : ""}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldAnchorShell>
      )
    }

    return (
      <FieldAnchorShell name={logicalPath}>
        <FormField
          name={name}
          render={({ field }) => (
            <FormItem className={className}>
              <WithDescription text={schema.description}>
                <FormLabel>
                  {heading}
                  {required ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </FormLabel>
              </WithDescription>
              <FormControl>
                <Checkbox
                  checked={Boolean(field.value)}
                  aria-label={`${heading}${required ? " *" : ""}`}
                  onCheckedChange={(value) => field.onChange(value === true)}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldAnchorShell>
    )
  }

  return (
    <FieldAnchorShell name={logicalPath}>
      <FormField
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            <WithDescription text={schema.description}>
              <FormLabel>
                {heading}
                {required ? <span className="text-destructive"> *</span> : null}
              </FormLabel>
            </WithDescription>
            <FormControl>
              <ScalarControl
                kind={kind}
                schema={schema}
                field={field}
                textInput={textInput}
                nullable={nullable}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FieldAnchorShell>
  )
}

function NullableBooleanControl({
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

// ---------------------------------------------------------------------------
// Description tooltip — keeps long field descriptions out of the layout flow
// ---------------------------------------------------------------------------

/**
 * Wraps a label element so a field's `description` shows as a hover tooltip on
 * the label itself, rather than a block of body text — so long guidance (e.g.
 * multi-sentence extraction prompts) doesn't blow up row height in deep
 * documents. The label looks unchanged; with no description it renders untouched.
 */
function WithDescription({
  text,
  children,
}: {
  text?: string
  children: React.ReactElement
}) {
  if (!text) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-left whitespace-pre-line">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

interface ControlFieldApi {
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

function enumLabel(value: unknown): string {
  if (value === null) return "No value"
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function enumValueEquals(a: unknown, b: unknown): boolean {
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

function datetimeLocalInputValue(value: string): string {
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

function encodeFormSegment(segment: string): string {
  return encodeURIComponent(segment)
    .replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    )
    .replace(
      /[.[\]'"]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    )
}

function decodeFormSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function joinFormPath(parent: string, key: string | number): string {
  const segment = typeof key === "number" ? String(key) : encodeFormSegment(key)
  return parent ? `${parent}.${segment}` : segment
}

function joinSourcePath(parent: string, key: string | number): string {
  const segment = String(key)
  return parent ? `${parent}.${segment}` : segment
}

function hasOwnRecordValue(
  value: Record<string, unknown>,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function schemaProperties(
  schema: Schema
): Record<string, JSONSchema7Definition> {
  return (schema.properties ?? {}) as Record<string, JSONSchema7Definition>
}

function schemaPatternProperties(
  schema: Schema
): Record<string, JSONSchema7Definition> {
  return (schema.patternProperties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
}

function patternPropertySchemaFor(schema: Schema, key: string): Schema | null {
  for (const [pattern, child] of Object.entries(
    schemaPatternProperties(schema)
  )) {
    if (!isRecordValue(child)) continue
    try {
      if (new RegExp(pattern).test(key)) return child as Schema
    } catch {
      continue
    }
  }
  return null
}

function additionalPropertySchemaFor(schema: Schema): Schema | null {
  return isRecordValue(schema.additionalProperties)
    ? (schema.additionalProperties as Schema)
    : null
}

function dynamicPropertySchemaFor(schema: Schema, key: string): Schema | null {
  return (
    patternPropertySchemaFor(schema, key) ?? additionalPropertySchemaFor(schema)
  )
}

function hasDynamicObjectProperties(schema: Schema): boolean {
  const { schema: inner } = unwrapNullable(schema)
  if (fieldKind(inner) !== "object") return false
  return (
    isRecordValue(inner.additionalProperties) ||
    Object.values(schemaPatternProperties(inner)).some(isRecordValue)
  )
}

function staticPropertyKeys(schema: Schema): Set<string> {
  return new Set(
    Object.keys(schemaProperties(schema)).flatMap((key) => [
      key,
      encodeFormSegment(key),
    ])
  )
}

function dynamicPropertyEntries(
  schema: Schema,
  currentValue: unknown,
  staticKeys: Set<string>
): Array<{ key: string; schema: Schema }> {
  if (!isRecordValue(currentValue)) return []
  return Object.keys(currentValue).flatMap((key) => {
    if (staticKeys.has(key)) return []
    const decodedKey = decodeFormSegment(key)
    if (staticKeys.has(decodedKey)) return []
    const childSchema = dynamicPropertySchemaFor(schema, decodedKey)
    return childSchema ? [{ key: decodedKey, schema: childSchema }] : []
  })
}

function schemaUsesEncodedPaths(schema: Schema): boolean {
  const { schema: inner } = unwrapNullable(schema)
  const kind = fieldKind(inner)
  if (kind === "object") {
    const properties = schemaProperties(inner)
    const patternProperties = schemaPatternProperties(inner)
    return (
      isRecordValue(inner.additionalProperties) ||
      Object.values(patternProperties).some(isRecordValue) ||
      Object.entries(properties).some(([key, child]) => {
        return (
          encodeFormSegment(key) !== key ||
          (typeof child === "object" &&
            child !== null &&
            schemaUsesEncodedPaths(child))
        )
      })
    )
  }
  if (kind === "array" && typeof inner.items === "object" && inner.items) {
    if (Array.isArray(inner.items)) {
      return inner.items.some((item) =>
        isRecordValue(item) ? schemaUsesEncodedPaths(item as Schema) : false
      )
    }
    return schemaUsesEncodedPaths(inner.items as Schema)
  }
  return false
}

function encodeValueForForm(schema: Schema, value: unknown): unknown {
  const { schema: inner } = unwrapNullable(schema)
  const kind = fieldKind(inner)

  if (kind === "array") {
    if (!Array.isArray(value)) return value
    return value.map((item, index) =>
      encodeValueForForm(arrayItemSchemaAt(inner, index), item)
    )
  }

  if (kind !== "object" || !isRecordValue(value)) return value

  const properties = schemaProperties(inner)
  const encoded: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(properties)) {
    if (typeof child !== "object" || child === null) continue
    const encodedKey = encodeFormSegment(key)
    const rawValue = hasOwnRecordValue(value, key)
      ? value[key]
      : value[encodedKey]
    if (rawValue !== undefined || hasOwnRecordValue(value, key)) {
      encoded[encodedKey] = encodeValueForForm(child, rawValue)
    }
  }
  const propertyKeys = new Set(Object.keys(properties))
  for (const [key, rawValue] of Object.entries(value)) {
    const decodedKey = decodeFormSegment(key)
    if (propertyKeys.has(key) || propertyKeys.has(decodedKey)) continue
    const childSchema = dynamicPropertySchemaFor(inner, decodedKey)
    if (!childSchema) continue
    encoded[encodeFormSegment(decodedKey)] = encodeValueForForm(
      childSchema,
      rawValue
    )
  }
  return encoded
}

function decodeValueFromForm(schema: Schema, value: unknown): unknown {
  const { schema: inner } = unwrapNullable(schema)
  const kind = fieldKind(inner)

  if (kind === "array") {
    if (!Array.isArray(value)) return value
    return value.map((item, index) =>
      decodeValueFromForm(arrayItemSchemaAt(inner, index), item)
    )
  }

  if (kind !== "object" || !isRecordValue(value)) return value

  const properties = schemaProperties(inner)
  const decoded: Record<string, unknown> = {}
  const handledKeys = new Set<string>()
  for (const [key, child] of Object.entries(properties)) {
    if (typeof child !== "object" || child === null) continue
    const encodedKey = encodeFormSegment(key)
    const hasEncoded = hasOwnRecordValue(value, encodedKey)
    const rawValue = hasEncoded ? value[encodedKey] : value[key]
    handledKeys.add(encodedKey)
    handledKeys.add(key)
    if (rawValue !== undefined || hasEncoded || hasOwnRecordValue(value, key)) {
      decoded[key] = decodeValueFromForm(child, rawValue)
    }
  }
  for (const [key, rawValue] of Object.entries(value)) {
    const decodedKey = decodeFormSegment(key)
    if (handledKeys.has(key) || handledKeys.has(decodedKey)) continue
    const childSchema = dynamicPropertySchemaFor(inner, decodedKey)
    if (!childSchema) continue
    decoded[decodedKey] = decodeValueFromForm(childSchema, rawValue)
  }
  return decoded
}

function emptyArrayItemValue(schema: Schema, encodeKeys = false): unknown {
  const { schema: inner, nullable } = unwrapNullable(schema)
  if (nullable) return null
  if (fieldKind(inner) !== "object") return emptyValueFor(inner)

  const properties = (inner.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const value: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(properties)) {
    if (typeof child === "object" && child !== null) {
      value[encodeKeys ? encodeFormSegment(key) : key] = emptyValueFor(child)
    }
  }
  return value
}

function arrayItemSchemaAt(schema: Schema, index: number): Schema {
  const items = schema.items
  if (Array.isArray(items)) {
    const item = items[index]
    if (isRecordValue(item)) return item as Schema
    if (isRecordValue(schema.additionalItems)) {
      return schema.additionalItems as Schema
    }
    return { type: "string" }
  }
  return isRecordValue(items) ? (items as Schema) : { type: "string" }
}

function canAppendArrayItem(schema: Schema, length: number): boolean {
  if (typeof schema.maxItems === "number" && length >= schema.maxItems) {
    return false
  }
  if (
    Array.isArray(schema.items) &&
    schema.additionalItems === false &&
    length >= schema.items.length
  ) {
    return false
  }
  return true
}

function canRemoveArrayItem(schema: Schema, length: number): boolean {
  return typeof schema.minItems !== "number" || length > schema.minItems
}

function ScalarControl({
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
          <SelectValue placeholder="Select…">{displayValue}</SelectValue>
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

  // string (+ formats)
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

  // Textareas would break table-row heights, so compact cells stay single-line.
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

// ---------------------------------------------------------------------------
// Disclosure (collapsible) primitive — drives lazy mounting
// ---------------------------------------------------------------------------

function DisclosureHeader({
  open,
  onToggle,
  title,
  summary,
  description,
  actions,
}: {
  open: boolean
  onToggle: () => void
  title: string
  summary?: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={summary ? `${title} ${summary}` : title}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <WithDescription text={description}>
          <span className="truncate text-sm font-medium">{title}</span>
        </WithDescription>
        {summary ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {summary}
          </span>
        ) : null}
      </button>
      {actions}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Object composer (collapsible, lazy-mounted)
// ---------------------------------------------------------------------------

function JsonFormObject({
  name,
  sourcePath,
  schema,
  label,
  textInput,
  className,
  depth,
}: {
  name: string
  sourcePath: string
  schema: Schema
  label: string
  textInput?: JsonFormTextInput
  className?: string
  depth: number
}) {
  const { control, getValues } = useFormContext()
  const properties = React.useMemo(() => schemaProperties(schema), [schema])
  const required = React.useMemo(() => new Set(schema.required ?? []), [schema])
  const entries = React.useMemo(() => Object.entries(properties), [properties])
  const currentValue = useWatch({
    control,
    name,
    defaultValue: getValues(name),
  }) as unknown
  const staticKeys = React.useMemo(() => staticPropertyKeys(schema), [schema])
  const dynamicEntries = React.useMemo(
    () => dynamicPropertyEntries(schema, currentValue, staticKeys),
    [currentValue, schema, staticKeys]
  )
  const fieldCount = entries.length + dynamicEntries.length
  const defaultOpenPaths = React.useContext(DefaultOpenPathsContext)
  const [open, setOpen] = React.useState(
    () => defaultOpenPaths?.has(sourcePath) ?? depth < AUTO_COLLAPSE_DEPTH
  )

  return (
    <div className={cn("rounded-lg border", className)}>
      <DisclosureHeader
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={label}
        summary={`${fieldCount} field${fieldCount === 1 ? "" : "s"}`}
        description={schema.description}
      />
      {open ? (
        <div className="space-y-3 border-t p-3">
          {entries.map(([key, child]) =>
            typeof child === "object" ? (
              <JsonFormField
                key={key}
                name={joinFormPath(name, key)}
                sourcePath={joinSourcePath(sourcePath, key)}
                schema={child}
                required={required.has(key)}
                label={labelFor(key, child)}
                textInput={textInput}
                depth={depth + 1}
              />
            ) : null
          )}
          {dynamicEntries.map(({ key, schema: child }) => (
            <JsonFormField
              key={key}
              name={joinFormPath(name, key)}
              sourcePath={joinSourcePath(sourcePath, key)}
              schema={child}
              label={key}
              textInput={textInput}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function JsonFormRootFields({
  schema,
  textInput,
}: {
  schema: Schema
  textInput?: JsonFormTextInput
}) {
  const { control, getValues } = useFormContext()
  const properties = schemaProperties(schema)
  const required = new Set(schema.required ?? [])
  const entries = Object.entries(properties)
  const currentValue = useWatch({
    control,
    defaultValue: getValues(),
  }) as unknown
  const staticKeys = React.useMemo(() => staticPropertyKeys(schema), [schema])
  const dynamicEntries = React.useMemo(
    () => dynamicPropertyEntries(schema, currentValue, staticKeys),
    [currentValue, schema, staticKeys]
  )

  return (
    <>
      {entries.map(([key, child]) =>
        typeof child === "object" ? (
          <JsonFormField
            key={key}
            name={joinFormPath("", key)}
            sourcePath={key}
            schema={child}
            required={required.has(key)}
            label={labelFor(key, child)}
            textInput={textInput}
            depth={0}
          />
        ) : null
      )}
      {dynamicEntries.map(({ key, schema: child }) => (
        <JsonFormField
          key={key}
          name={joinFormPath("", key)}
          sourcePath={key}
          schema={child}
          label={key}
          textInput={textInput}
          depth={0}
        />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Array composer — dispatches to table or card mode, both collapsible
// ---------------------------------------------------------------------------

function JsonFormArray({
  name,
  sourcePath,
  schema,
  label,
  textInput,
  className,
  depth,
}: {
  name: string
  sourcePath: string
  schema: Schema
  label: string
  textInput?: JsonFormTextInput
  className?: string
  depth: number
}) {
  const { control, getValues, setValue, unregister } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name })
  const arrayValue = useWatch({ control, name })
  const renderedFields = React.useMemo(() => {
    if (!Array.isArray(arrayValue)) return fields
    return arrayValue.map((_, index) => ({
      id: fields[index]?.id ?? `${name}.${index}`,
    }))
  }, [arrayValue, fields, name])
  const itemSchema = React.useMemo(() => arrayItemSchemaAt(schema, 0), [schema])
  const isTupleArray = Array.isArray(schema.items)
  const hasDynamicItemProperties = React.useMemo(
    () => hasDynamicObjectProperties(itemSchema),
    [itemSchema]
  )
  const itemSchemaForIndex = React.useCallback(
    (index: number) => arrayItemSchemaAt(schema, index),
    [schema]
  )

  const columns = React.useMemo(
    () =>
      isTupleArray || hasDynamicItemProperties
        ? null
        : scalarObjectColumns(itemSchema),
    [hasDynamicItemProperties, isTupleArray, itemSchema]
  )

  const startOpen =
    depth < AUTO_COLLAPSE_DEPTH && renderedFields.length <= LONG_ARRAY_THRESHOLD
  const defaultOpenPaths = React.useContext(DefaultOpenPathsContext)
  const [open, setOpen] = React.useState(
    () => defaultOpenPaths?.has(sourcePath) ?? startOpen
  )
  const canAddItem = canAppendArrayItem(schema, renderedFields.length)
  const canRemoveItem = canRemoveArrayItem(schema, renderedFields.length)

  const add = React.useCallback(() => {
    const current = getValues(name)
    const nextIndex = Array.isArray(current)
      ? current.length
      : renderedFields.length
    if (!canAppendArrayItem(schema, nextIndex)) return
    const nextSchema = arrayItemSchemaAt(schema, nextIndex)
    const nextItem = emptyArrayItemValue(
      nextSchema,
      schemaUsesEncodedPaths(nextSchema)
    )
    append(nextItem as never)
    if (Array.isArray(current)) {
      setValue(name, [...current, nextItem], { shouldDirty: true })
    }
    setOpen(true)
  }, [append, getValues, name, renderedFields.length, schema, setValue])
  const removeAt = React.useCallback(
    (index: number) => {
      const current = getValues(name)
      if (Array.isArray(current)) {
        if (!canRemoveArrayItem(schema, current.length)) return
        const next = current.slice()
        next.splice(index, 1)
        remove(index)
        setValue(name, next, { shouldDirty: true })
        unregister(`${name}.${next.length}`)
        return
      }
      if (!canRemoveArrayItem(schema, renderedFields.length)) return
      remove(index)
    },
    [
      getValues,
      name,
      remove,
      renderedFields.length,
      schema,
      setValue,
      unregister,
    ]
  )

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background shadow-sm",
        className
      )}
    >
      <DisclosureHeader
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={label}
        summary={`${renderedFields.length} item${renderedFields.length === 1 ? "" : "s"}`}
        description={schema.description}
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={add}
            disabled={!canAddItem}
          >
            <Plus className="size-4" />
            Add
          </Button>
        }
      />
      {open ? (
        <div className={cn("border-t", columns ? "" : "p-3")}>
          {renderedFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items.</p>
          ) : columns ? (
            <ArrayTable
              name={name}
              sourcePath={sourcePath}
              fields={renderedFields}
              remove={removeAt}
              canRemove={canRemoveItem}
              columns={columns}
            />
          ) : (
            <ArrayCards
              name={name}
              sourcePath={sourcePath}
              fields={renderedFields}
              remove={removeAt}
              canRemove={canRemoveItem}
              itemSchema={itemSchema}
              itemSchemaForIndex={itemSchemaForIndex}
              label={label}
              textInput={textInput}
              depth={depth}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card mode — one collapsible card per item, virtualized when long
// ---------------------------------------------------------------------------

interface ArrayBodyProps {
  name: string
  sourcePath: string
  fields: { id: string }[]
  remove: (index: number) => void
  canRemove: boolean
  itemSchema: Schema
  itemSchemaForIndex: (index: number) => Schema
}

function ArrayCards({
  name,
  sourcePath,
  fields,
  remove,
  canRemove,
  itemSchema,
  itemSchemaForIndex,
  label,
  textInput,
  depth,
}: ArrayBodyProps & {
  label: string
  textInput?: JsonFormTextInput
  depth: number
}) {
  const renderCard = React.useCallback(
    (index: number) => (
      <ArrayCard
        name={name}
        sourcePath={sourcePath}
        index={index}
        remove={remove}
        canRemove={canRemove}
        itemSchema={itemSchemaForIndex(index)}
        label={label}
        textInput={textInput}
        depth={depth}
      />
    ),
    [
      name,
      sourcePath,
      remove,
      canRemove,
      itemSchemaForIndex,
      label,
      textInput,
      depth,
    ]
  )

  if (fields.length > CARD_VIRTUALIZE_THRESHOLD) {
    return (
      <VirtualList
        fields={fields}
        estimateSize={64}
        renderItem={renderCard}
        gap={8}
      />
    )
  }

  return (
    <div className="space-y-2">
      {fields.map((entry, index) => (
        <React.Fragment key={entry.id}>{renderCard(index)}</React.Fragment>
      ))}
    </div>
  )
}

const ArrayCard = React.memo(function ArrayCard({
  name,
  sourcePath,
  index,
  remove,
  canRemove,
  itemSchema,
  label,
  textInput,
  depth,
}: {
  name: string
  sourcePath: string
  index: number
  remove: (index: number) => void
  canRemove: boolean
  itemSchema: Schema
  label: string
  textInput?: JsonFormTextInput
  depth: number
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <JsonFormField
          name={joinFormPath(name, index)}
          sourcePath={joinSourcePath(sourcePath, index)}
          schema={itemSchema}
          label={`${label} ${index + 1}`}
          textInput={textInput}
          depth={depth + 1}
        />
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="mt-1 border-transparent text-muted-foreground hover:border-border hover:bg-transparent hover:text-destructive"
        onClick={() => remove(index)}
        aria-label="Remove item"
        disabled={!canRemove}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Table mode — dense grid for arrays of flat scalar objects
// ---------------------------------------------------------------------------

function ArrayTable({
  name,
  sourcePath,
  fields,
  remove,
  canRemove,
  columns,
}: {
  name: string
  sourcePath: string
  fields: { id: string }[]
  remove: (index: number) => void
  canRemove: boolean
  columns: Column[]
}) {
  const template = `${columns.map(() => "minmax(9rem, 1fr)").join(" ")} 2.25rem`
  const minWidth = columns.length * 150 + 36
  const [activeEditorPath, setActiveEditorPath] = React.useState<string | null>(
    null
  )
  const activePath = React.useContext(FieldAnchorActivePathContext)
  const anchorActions = React.useContext(FieldAnchorActionsContext)
  const anchorLinked = Boolean(anchorActions)
  const tableRef = React.useRef<HTMLDivElement>(null)
  const activeAnchorCellRef = React.useRef<Element | null>(null)
  const hoveredAnchorPathRef = React.useRef<string | null>(null)
  const pendingHoverPathRef = React.useRef<string | null>(null)
  const pendingHoverFrameRef = React.useRef<number | null>(null)
  const isScrollingRef = React.useRef(false)
  const virtualize = fields.length > TABLE_VIRTUALIZE_THRESHOLD

  const setActiveAnchorCell = React.useCallback((cell: Element | null) => {
    if (activeAnchorCellRef.current === cell) return
    activeAnchorCellRef.current?.removeAttribute("data-anchor-active")
    if (cell) cell.setAttribute("data-anchor-active", "true")
    activeAnchorCellRef.current = cell
  }, [])

  React.useEffect(() => {
    if (!anchorLinked || !activePath) {
      setActiveAnchorCell(null)
      return
    }
    if (
      hoveredAnchorPathRef.current === activePath &&
      activeAnchorCellRef.current?.getAttribute("data-anchor-path") ===
        activePath
    ) {
      return
    }

    const table = tableRef.current
    if (!table) return
    for (const cell of table.querySelectorAll("[data-anchor-path]")) {
      if (cell.getAttribute("data-anchor-path") === activePath) {
        setActiveAnchorCell(cell)
        return
      }
    }
    setActiveAnchorCell(null)
  }, [activePath, anchorLinked, fields.length, setActiveAnchorCell])

  const findEventCell = React.useCallback(
    (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null
      const cell = target.closest<HTMLElement>("[data-table-cell]")
      return cell && tableRef.current?.contains(cell) ? cell : null
    },
    []
  )

  const handleTableClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const table = tableRef.current
      const activeElement = table?.ownerDocument.activeElement
      if (
        !(activeElement instanceof HTMLElement) ||
        activeElement.dataset.tableCellEditor !== "true" ||
        !table?.contains(activeElement) ||
        activeElement === event.target ||
        activeElement.contains(event.target as Node)
      ) {
        return
      }
      activeElement.blur()
    },
    []
  )

  const handleTableClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const cell = findEventCell(event.target)
      if (!cell) return
      const anchorCellPath = cell.dataset.anchorPath
      if (anchorCellPath) {
        if (pendingHoverFrameRef.current !== null) {
          cancelAnimationFrame(pendingHoverFrameRef.current)
          pendingHoverFrameRef.current = null
        }
        anchorActions?.selectField?.(anchorCellPath)
      }
      if (cell.dataset.tableCellEditable !== "true") return
      const path = cell.dataset.tableCellPath
      if (path) setActiveEditorPath(path)
    },
    [findEventCell, anchorActions]
  )

  const handleTableKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return
      const cell = findEventCell(event.target)
      if (!cell || cell.dataset.tableCellEditable !== "true") return
      const path = cell.dataset.tableCellPath
      if (!path) return
      const anchorCellPath = cell.dataset.anchorPath
      if (anchorCellPath) {
        if (pendingHoverFrameRef.current !== null) {
          cancelAnimationFrame(pendingHoverFrameRef.current)
          pendingHoverFrameRef.current = null
        }
        anchorActions?.selectField?.(anchorCellPath)
      }
      event.preventDefault()
      setActiveEditorPath(path)
    },
    [findEventCell, anchorActions]
  )

  const reportHoveredAnchorPath = React.useCallback(
    (path: string | null) => {
      if (!anchorActions) return
      pendingHoverPathRef.current = path
      if (pendingHoverFrameRef.current !== null) return
      pendingHoverFrameRef.current = requestAnimationFrame(() => {
        pendingHoverFrameRef.current = null
        anchorActions.onFieldHover(pendingHoverPathRef.current)
      })
    },
    [anchorActions]
  )

  const setHoveredAnchorPath = React.useCallback(
    (path: string | null, cell: Element | null) => {
      if (!anchorActions) return
      if (hoveredAnchorPathRef.current === path) return
      hoveredAnchorPathRef.current = path
      setActiveAnchorCell(cell)
      reportHoveredAnchorPath(path)
    },
    [anchorActions, reportHoveredAnchorPath, setActiveAnchorCell]
  )

  React.useEffect(
    () => () => {
      if (pendingHoverFrameRef.current !== null) {
        cancelAnimationFrame(pendingHoverFrameRef.current)
      }
    },
    []
  )

  const handleTablePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!anchorActions) return
      if (isScrollingRef.current) return
      const cell = findEventCell(event.target)
      setHoveredAnchorPath(cell?.dataset.anchorPath ?? null, cell)
    },
    [anchorActions, findEventCell, setHoveredAnchorPath]
  )

  const handleTablePointerLeave = React.useCallback(
    () => setHoveredAnchorPath(null, null),
    [setHoveredAnchorPath]
  )

  const handleBodyScrollStart = React.useCallback(() => {
    isScrollingRef.current = true
    setHoveredAnchorPath(null, null)
  }, [setHoveredAnchorPath])

  const handleBodyScrollEnd = React.useCallback(() => {
    isScrollingRef.current = false
  }, [])

  const handleTableFocus = React.useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (!anchorActions) return
      const cell = findEventCell(event.target)
      if (cell) {
        hoveredAnchorPathRef.current = cell.dataset.anchorPath ?? null
        setActiveAnchorCell(cell)
        anchorActions.onFieldHover(cell.dataset.anchorPath ?? null)
      }
    },
    [anchorActions, findEventCell, setActiveAnchorCell]
  )

  const handleTableBlur = React.useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (!anchorActions) return
      const cell = findEventCell(event.target)
      if (!cell || cell.contains(event.relatedTarget as Node | null)) return
      hoveredAnchorPathRef.current = null
      setActiveAnchorCell(null)
      anchorActions.onFieldHover(null)
    },
    [anchorActions, findEventCell, setActiveAnchorCell]
  )

  const renderRow = React.useCallback(
    (index: number, rowTopPx?: number) => (
      <ArrayTableRow
        name={name}
        sourcePath={sourcePath}
        index={index}
        isLastRow={index === fields.length - 1}
        columns={columns}
        remove={remove}
        canRemove={canRemove}
        anchorLinked={anchorLinked}
        template={template}
        rowTopPx={rowTopPx}
        activeEditorPath={
          activeEditorPath?.startsWith(`${joinFormPath(name, index)}.`)
            ? activeEditorPath
            : null
        }
        subscribeToRow={!virtualize}
        setActiveEditorPath={setActiveEditorPath}
      />
    ),
    [
      name,
      sourcePath,
      fields.length,
      columns,
      remove,
      canRemove,
      anchorLinked,
      template,
      activeEditorPath,
      virtualize,
    ]
  )

  return (
    <div
      ref={tableRef}
      onClickCapture={handleTableClickCapture}
      onClick={handleTableClick}
      onKeyDown={handleTableKeyDown}
      onPointerMove={anchorActions ? handleTablePointerMove : undefined}
      onPointerLeave={anchorActions ? handleTablePointerLeave : undefined}
      onFocus={handleTableFocus}
      onBlur={handleTableBlur}
      className="overflow-x-auto bg-background"
    >
      <div style={getFixedGridCanvasStyle({ minWidth })}>
        <div
          className="grid h-9 items-center gap-1 border-b bg-muted/35 px-2"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex min-w-0 items-center gap-1 px-2 text-xs font-medium text-muted-foreground"
            >
              <WithDescription text={col.schema.description}>
                <span className="truncate">
                  {labelFor(col.key, col.schema)}
                </span>
              </WithDescription>
              {col.required ? (
                <span className="text-destructive">*</span>
              ) : null}
            </div>
          ))}
          <span className="sr-only">Actions</span>
        </div>
        {virtualize ? (
          <FixedArrayTableBody
            name={name}
            fields={fields}
            activeEditorPath={activeEditorPath}
            onScrollStart={handleBodyScrollStart}
            onScrollEnd={handleBodyScrollEnd}
            renderItem={renderRow}
          />
        ) : fields.length > TABLE_SCROLL_THRESHOLD ? (
          <StaticArrayTableBody
            fields={fields}
            onScrollStart={handleBodyScrollStart}
            onScrollEnd={handleBodyScrollEnd}
            renderItem={renderRow}
          />
        ) : (
          <div>
            {fields.map((entry, index) => (
              <React.Fragment key={entry.id}>{renderRow(index)}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const ArrayTableRow = React.memo(function ArrayTableRow({
  name,
  sourcePath,
  index,
  isLastRow,
  columns,
  remove,
  canRemove,
  anchorLinked,
  template,
  rowTopPx,
  activeEditorPath,
  subscribeToRow,
  setActiveEditorPath,
}: {
  name: string
  sourcePath: string
  index: number
  isLastRow: boolean
  columns: Column[]
  remove: (index: number) => void
  canRemove: boolean
  anchorLinked: boolean
  template: string
  rowTopPx?: number
  activeEditorPath: string | null
  subscribeToRow: boolean
  setActiveEditorPath: (path: string | null) => void
}) {
  const { control, getValues, setValue } = useFormContext()
  const rowPath = joinFormPath(name, index)
  const rowSourcePath = joinSourcePath(sourcePath, index)
  const watchedRowValue = useWatch({
    control,
    name: rowPath,
    disabled: !subscribeToRow,
  }) as Record<string, unknown> | undefined
  const rowValue = (subscribeToRow ? watchedRowValue : getValues(rowPath)) as
    | Record<string, unknown>
    | undefined
  const rowStyle = React.useMemo(
    () =>
      rowTopPx === undefined
        ? { gridTemplateColumns: template }
        : getFixedGridRowStyle({
            gridTemplate: template,
            rowHeight: TABLE_ROW_HEIGHT,
            top: rowTopPx,
          }),
    [rowTopPx, template]
  )

  return (
    <div
      data-index={index}
      className={cn(
        "grid items-center gap-1 border-b px-2 py-1 [contain:layout_paint_style] hover:bg-muted/25",
        isLastRow && "border-b-0"
      )}
      style={rowStyle}
    >
      {columns.map((col) => {
        const path = joinFormPath(rowPath, col.key)
        const logicalPath = joinSourcePath(rowSourcePath, col.key)
        const value = rowValue?.[encodeFormSegment(col.key)]
        const isEnum = col.kind === "enum"
        const isActiveEditor = activeEditorPath === path
        const isEditing = isEnum && isActiveEditor
        const isScalarEditing = !isEnum && isActiveEditor
        const dataCellKind = dataCellKindForColumn(col)
        const displayLabel = labelFor(col.key, col.schema)
        const displayText = formatTableCellValue({ value, column: col })
        const textValue = value == null ? "" : String(value)
        const initialDisplay =
          col.schema.format === "date-time"
            ? datetimeLocalInputValue(textValue)
            : textValue
        const cellClassName = cn(
          "min-w-0 rounded data-[anchor-active=true]:bg-primary/5 data-[anchor-active=true]:ring-1 data-[anchor-active=true]:ring-primary/30",
          !isEditing && !isScalarEditing
            ? "hover:bg-background focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"
            : "px-1 py-0.5",
          anchorLinked && (isEditing || isScalarEditing) && "hover:bg-muted/55"
        )
        const cellProps = {
          "data-slot": "data-cell",
          "data-table-cell": "",
          "data-anchor-path": anchorLinked ? logicalPath : undefined,
          className: cellClassName,
        }
        const commitDataCellValue = (
          nextValue: unknown,
          meta?: DataCellValueMeta
        ) => {
          let normalizedValue: unknown
          if (col.kind === "number" || col.kind === "integer") {
            if (meta && !meta.isValid) return
            normalizedValue =
              typeof nextValue === "number"
                ? nextValue
                : nextValue === null && col.nullable && meta?.isEmpty !== false
                  ? null
                  : undefined
            if (normalizedValue === undefined) return
          } else if (col.kind === "boolean") {
            normalizedValue = Boolean(nextValue)
          } else {
            const nextText = typeof nextValue === "string" ? nextValue : ""
            const nextDisplay =
              col.schema.format === "date-time"
                ? datetimeLocalInputValue(nextText)
                : nextText
            if (nextDisplay === initialDisplay) return
            normalizedValue =
              nextDisplay === "" && col.nullable ? null : nextDisplay
          }

          if (Object.is(value, normalizedValue)) return
          setValue(path, normalizedValue, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          })
        }

        return (
          <React.Fragment key={col.key}>
            {isEditing ? (
              <ArrayTableCellEditor
                path={path}
                column={col}
                onClose={() => setActiveEditorPath(null)}
                cellProps={cellProps}
              />
            ) : isEnum ? (
              <DataCell
                {...cellProps}
                kind="text"
                value={dataCellTextValue(value)}
                formatValue={() => displayText}
                placeholder=""
                role="button"
                tabIndex={0}
                aria-label={`${displayLabel} ${displayText}`}
                data-table-cell-editable="true"
                data-table-cell-path={path}
                className={cn(cellClassName, "text-sm")}
              />
            ) : dataCellKind === "number" || dataCellKind === "integer" ? (
              <DataCell
                {...cellProps}
                kind={dataCellKind}
                active={isScalarEditing}
                editable={isScalarEditing}
                value={dataCellNumberValue(value)}
                formatValue={() => displayText}
                placeholder=""
                role={!isScalarEditing ? "button" : undefined}
                aria-label={`${displayLabel} ${displayText}`}
                tabIndex={0}
                data-table-cell-editable={!isScalarEditing ? "true" : undefined}
                data-table-cell-path={!isScalarEditing ? path : undefined}
                autoFocus={isScalarEditing}
                name={path}
                onCommit={commitDataCellValue}
                data-table-cell-editor={isScalarEditing ? "true" : undefined}
                onBlur={() => {
                  if (isScalarEditing) setActiveEditorPath(null)
                }}
                className={cn(cellClassName, "text-sm")}
              />
            ) : dataCellKind === "boolean" ? (
              <DataCell
                {...cellProps}
                kind="boolean"
                active={isScalarEditing}
                editable={isScalarEditing}
                value={Boolean(value)}
                role={!isScalarEditing ? "button" : undefined}
                aria-label={`${displayLabel} ${displayText}`}
                tabIndex={0}
                data-table-cell-editable={!isScalarEditing ? "true" : undefined}
                data-table-cell-path={!isScalarEditing ? path : undefined}
                autoFocus={isScalarEditing}
                name={path}
                onCommit={commitDataCellValue}
                data-table-cell-editor={isScalarEditing ? "true" : undefined}
                onBlur={() => {
                  if (isScalarEditing) setActiveEditorPath(null)
                }}
                className={cn(cellClassName, "text-sm")}
              />
            ) : (
              <DataCell
                {...cellProps}
                kind={dataCellKind}
                active={isScalarEditing}
                editable={isScalarEditing}
                value={dataCellTextValue(value)}
                formatValue={() => displayText}
                placeholder=""
                role={!isScalarEditing ? "button" : undefined}
                aria-label={`${displayLabel} ${displayText}`}
                tabIndex={0}
                data-table-cell-editable={!isScalarEditing ? "true" : undefined}
                data-table-cell-path={!isScalarEditing ? path : undefined}
                autoFocus={isScalarEditing}
                name={path}
                onCommit={commitDataCellValue}
                data-table-cell-editor={isScalarEditing ? "true" : undefined}
                onBlur={() => {
                  if (isScalarEditing) setActiveEditorPath(null)
                }}
                className={cn(cellClassName, "text-sm")}
              />
            )}
          </React.Fragment>
        )
      })}
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-md border border-transparent text-base leading-none text-muted-foreground transition-colors hover:border-border hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        onClick={() => remove(index)}
        aria-label="Remove row"
        disabled={!canRemove}
      >
        <X className="size-4" />
      </button>
    </div>
  )
})

function ArrayTableCellEditor({
  path,
  column,
  onClose,
  cellProps,
}: {
  path: string
  column: Column
  onClose: () => void
  cellProps: React.HTMLAttributes<HTMLElement>
}) {
  return (
    <ArrayTableSelectCellEditor
      path={path}
      column={column}
      onClose={onClose}
      cellProps={cellProps}
    />
  )
}

function ArrayTableSelectCellEditor({
  path,
  column,
  onClose,
  cellProps,
}: {
  path: string
  column: Column
  onClose: () => void
  cellProps: React.HTMLAttributes<HTMLElement>
}) {
  const { control } = useFormContext()
  const { field } = useController({ control, name: path })

  return (
    <div
      {...cellProps}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <ScalarControl
        kind={column.kind}
        schema={column.schema}
        field={{
          ...field,
          onBlur: () => {
            field.onBlur()
            onClose()
          },
        }}
        compact
        nullable={column.nullable}
      />
    </div>
  )
}

function formatTableCellValue({
  value,
  column,
}: {
  value: unknown
  column: Column
}) {
  if (value == null || value === "") return "—"
  if (column.kind === "enum") {
    const option = column.schema.enum?.find((candidate) =>
      enumValueEquals(candidate, value)
    )
    return option === undefined ? enumLabel(value) : enumLabel(option)
  }
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "—"
  if (typeof value === "boolean") return value ? "True" : "False"
  return String(value)
}

function dataCellKindForColumn(
  column: Column
): Exclude<DataCellKind, "select"> {
  if (column.kind === "number" || column.kind === "integer") return column.kind
  if (column.kind === "boolean") return "boolean"
  if (column.schema.format === "date-time") return "date-time"
  if (column.schema.format === "date") return "date"
  if (column.schema.format === "time") return "time"
  return "text"
}

function dataCellValue(value: unknown): DataCellValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  return String(value)
}

function dataCellNumberValue(value: unknown): string | number | null {
  return typeof value === "number" || typeof value === "string" ? value : null
}

function dataCellTextValue(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function useArrayTableScrollActivity(
  scrollRef: React.RefObject<HTMLElement | null>,
  {
    onScrollStart,
    onScrollEnd,
  }: {
    onScrollStart: () => void
    onScrollEnd: () => void
  }
) {
  const isScrollingRef = React.useRef(false)
  const scrollEndTimeoutRef = React.useRef(0)

  const handleScroll = React.useCallback(() => {
    if (!isScrollingRef.current) {
      isScrollingRef.current = true
      onScrollStart()
    }
    window.clearTimeout(scrollEndTimeoutRef.current)
    scrollEndTimeoutRef.current = window.setTimeout(() => {
      isScrollingRef.current = false
      onScrollEnd()
    }, 120)
  }, [onScrollEnd, onScrollStart])

  React.useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    scrollElement.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.clearTimeout(scrollEndTimeoutRef.current)
      scrollElement.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll, scrollRef])
}

function StaticArrayTableBody({
  fields,
  onScrollStart,
  onScrollEnd,
  renderItem,
}: {
  fields: { id: string }[]
  onScrollStart: () => void
  onScrollEnd: () => void
  renderItem: (index: number) => React.ReactNode
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  useArrayTableScrollActivity(scrollRef, {
    onScrollStart,
    onScrollEnd,
  })

  return (
    <div
      ref={scrollRef}
      data-slot="json-form-table-scroll"
      className="overflow-y-auto"
      style={{ maxHeight: TABLE_MAX_HEIGHT }}
    >
      <div className="[contain:layout_paint_style]">
        {fields.map((entry, index) => (
          <React.Fragment key={entry.id}>{renderItem(index)}</React.Fragment>
        ))}
      </div>
    </div>
  )
}

function FixedArrayTableBody({
  name,
  fields,
  activeEditorPath,
  onScrollStart,
  onScrollEnd,
  renderItem,
}: {
  name: string
  fields: { id: string }[]
  activeEditorPath: string | null
  onScrollStart: () => void
  onScrollEnd: () => void
  renderItem: (index: number, rowTopPx: number) => React.ReactNode
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const { virtualRows, totalRowSize } = useFixedRowVirtualization({
    rowCount: fields.length,
    rowSize: TABLE_ROW_HEIGHT,
    rowOverscan: TABLE_ROW_OVERSCAN,
    jumpRowOverscan: TABLE_JUMP_ROW_OVERSCAN,
    scrollRef,
  })
  useArrayTableScrollActivity(scrollRef, {
    onScrollStart,
    onScrollEnd,
  })

  return (
    <div
      ref={scrollRef}
      data-slot="json-form-table-scroll"
      className="overflow-y-auto"
      style={{ maxHeight: TABLE_MAX_HEIGHT }}
    >
      <div
        style={getFixedGridRowWindowStyle({
          height: totalRowSize,
          minWidth: "100%",
        })}
        className="[contain:layout_paint_style]"
      >
        {virtualRows.map((virtualRow, slotIndex) => {
          const isEditingRow = activeEditorPath?.startsWith(
            `${name}.${virtualRow.index}.`
          )
          return (
            <React.Fragment
              key={
                isEditingRow ? fields[virtualRow.index].id : `slot-${slotIndex}`
              }
            >
              {renderItem(virtualRow.index, virtualRow.start)}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Virtualized list — windows rows so only the visible ones are in the DOM
// ---------------------------------------------------------------------------

function VirtualList({
  fields,
  estimateSize,
  renderItem,
  maxHeight = 480,
  gap = 0,
}: {
  fields: { id: string }[]
  estimateSize: number
  renderItem: (index: number) => React.ReactNode
  maxHeight?: number
  gap?: number
}) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan: 8,
  })

  return (
    <div ref={parentRef} style={{ maxHeight }} className="overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={fields[virtualRow.index].id}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
              paddingBottom: gap,
            }}
          >
            {renderItem(virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JsonForm — convenience wrapper over a whole schema
// ---------------------------------------------------------------------------

export interface JsonFormProps {
  form: UseFormReturn<Record<string, unknown>>
  schema: Schema
  onSubmit?: SubmitHandler<Record<string, unknown>>
  className?: string
  /** Force plain string fields to render as single-line inputs or textareas. */
  textInput?: JsonFormTextInput
  /**
   * Opt into field-level anchor linking. When set, every scalar field becomes a
   * hoverable card that reports its path and highlights when active — wire it
   * straight from a field anchor link.
   */
  anchorLink?: FieldAnchorLink
  /**
   * Source/logical paths that should start expanded. Intended for controlled
   * demos and benchmarks that need a deep virtualized body mounted immediately.
   */
  defaultOpenPaths?: readonly string[]
  /** Rendered after the fields, e.g. a submit button. */
  children?: React.ReactNode
}

export function JsonForm({
  form,
  schema,
  onSubmit,
  className,
  textInput,
  anchorLink,
  defaultOpenPaths,
  children,
}: JsonFormProps) {
  const expandedSchema = React.useMemo(() => expandRefs(schema), [schema])
  const usesEncodedPaths = React.useMemo(
    () => schemaUsesEncodedPaths(expandedSchema),
    [expandedSchema]
  )
  const onFieldHover = anchorLink?.onFieldHover
  const selectField = anchorLink?.selectField
  const anchorActions = React.useMemo<FieldAnchorLinkActions | null>(
    () => (onFieldHover ? { onFieldHover, selectField } : null),
    [onFieldHover, selectField]
  )
  const defaultOpenPathSet = React.useMemo(
    () =>
      defaultOpenPaths && defaultOpenPaths.length > 0
        ? new Set(defaultOpenPaths)
        : null,
    [defaultOpenPaths]
  )
  const normalizedInitialValuesRef = React.useRef<Schema | null>(null)

  React.useEffect(() => {
    if (
      !usesEncodedPaths ||
      normalizedInitialValuesRef.current === expandedSchema
    ) {
      return
    }
    normalizedInitialValuesRef.current = expandedSchema
    form.reset(
      encodeValueForForm(expandedSchema, form.getValues()) as Record<
        string,
        unknown
      >
    )
  }, [expandedSchema, form, usesEncodedPaths])

  const handleSubmit = React.useCallback(
    (event: React.FormEvent) => {
      if (!onSubmit) {
        event.preventDefault()
        return
      }
      const activeElement = event.currentTarget.ownerDocument.activeElement
      if (
        activeElement instanceof HTMLElement &&
        event.currentTarget.contains(activeElement)
      ) {
        activeElement.blur()
      }
      return form.handleSubmit((data, submitEvent) => {
        const decoded = usesEncodedPaths
          ? (decodeValueFromForm(expandedSchema, data) as Record<
              string,
              unknown
            >)
          : data
        return onSubmit(decoded, submitEvent)
      })(event)
    },
    [expandedSchema, form, onSubmit, usesEncodedPaths]
  )

  return (
    <FieldAnchorActionsContext.Provider value={anchorActions}>
      <FieldAnchorActivePathContext.Provider
        value={anchorLink?.activePath ?? null}
      >
        <DefaultOpenPathsContext.Provider value={defaultOpenPathSet}>
          <Form {...form}>
            <form
              onSubmit={handleSubmit}
              className={cn("space-y-4", className)}
            >
              <JsonFormRootFields
                schema={expandedSchema}
                textInput={textInput}
              />
              {children}
            </form>
          </Form>
        </DefaultOpenPathsContext.Provider>
      </FieldAnchorActivePathContext.Provider>
    </FieldAnchorActionsContext.Provider>
  )
}
