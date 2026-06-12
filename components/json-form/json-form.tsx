"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { JSONSchema7Definition } from "json-schema"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import {
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/components/ui/fixed-grid-layout"
import { getFixedGridRowStyle } from "@/components/ui/fixed-grid-row-style"
import { useFixedRowVirtualization } from "@/components/ui/fixed-grid-virtualization"
import { Input } from "@/components/ui/input"
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
/** Table-mode arrays longer than this are virtualized. */
const TABLE_VIRTUALIZE_THRESHOLD = 30
/** Arrays longer than this start collapsed regardless of depth. */
const LONG_ARRAY_THRESHOLD = 8
const TABLE_ROW_HEIGHT = 44
const TABLE_MAX_HEIGHT = 420
const TABLE_ROW_OVERSCAN = 5
const TABLE_JUMP_ROW_OVERSCAN = 9

// ---------------------------------------------------------------------------
// Source linking — opt-in field-level hover/highlight
// ---------------------------------------------------------------------------

/**
 * Optional source linking. When a form is given a `sourceLink`, every scalar
 * field (including array-table cells) becomes a hoverable card à la
 * `SourceFieldList`: hovering or focusing it reports the field's path, and the
 * field whose path matches `activePath` gets the highlighted-card treatment.
 * Wire `onFieldHover` + `activePath` straight from a `useSourceLink` result.
 */
export interface FieldSourceLink {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField?: (path: string) => void
}

type FieldSourceLinkActions = Omit<FieldSourceLink, "activePath">

const FieldSourceActivePathContext = React.createContext<string | null>(null)
const FieldSourceActionsContext =
  React.createContext<FieldSourceLinkActions | null>(null)

/**
 * Wraps a scalar leaf so it reports its path on hover/focus and lights up as a
 * card when active. A no-op (renders children untouched) outside a source-linked
 * form, so other `JsonFormField` usages are unaffected.
 */
function SourceFieldShell({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  const activePath = React.useContext(FieldSourceActivePathContext)
  const sourceActions = React.useContext(FieldSourceActionsContext)
  if (!sourceActions) return <>{children}</>
  const active = activePath === name
  return (
    <div
      onMouseEnter={() => sourceActions.onFieldHover(name)}
      onMouseLeave={() => sourceActions.onFieldHover(null)}
      onFocus={() => sourceActions.onFieldHover(name)}
      onBlur={() => sourceActions.onFieldHover(null)}
      onClick={() => sourceActions.selectField?.(name)}
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
  className?: string
  /** Nesting depth, used to decide default collapse state. */
  depth?: number
}

export function JsonFormField({
  name,
  sourcePath,
  schema: rawSchema,
  required = false,
  label,
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
        className={className}
        depth={depth}
      />
    )
  }

  if (kind === "boolean") {
    return (
      <SourceFieldShell name={logicalPath}>
        <FormField
          name={name}
          render={({ field }) => (
            <FormItem
              className={cn(
                "flex flex-row items-center gap-2 space-y-0",
                className
              )}
            >
              <FormControl>
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
              </FormControl>
              <div className="leading-none">
                <WithDescription text={schema.description}>
                  <FormLabel>
                    {heading}
                    {required ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </FormLabel>
                </WithDescription>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </SourceFieldShell>
    )
  }

  return (
    <SourceFieldShell name={logicalPath}>
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
                nullable={nullable}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </SourceFieldShell>
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
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function datetimeLocalInputValue(value: string): string {
  const withoutTimezone = value.trim().replace(/(?:Z|[+-]\d{2}:\d{2})$/, "")
  return withoutTimezone.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0] ?? value
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

function schemaUsesEncodedPaths(schema: Schema): boolean {
  const { schema: inner } = unwrapNullable(schema)
  const kind = fieldKind(inner)
  if (kind === "object") {
    const properties = (inner.properties ?? {}) as Record<
      string,
      JSONSchema7Definition
    >
    return Object.entries(properties).some(([key, child]) => {
      return (
        encodeFormSegment(key) !== key ||
        (typeof child === "object" &&
          child !== null &&
          schemaUsesEncodedPaths(child))
      )
    })
  }
  if (kind === "array" && typeof inner.items === "object" && inner.items) {
    return schemaUsesEncodedPaths(inner.items as Schema)
  }
  return false
}

function encodeValueForForm(schema: Schema, value: unknown): unknown {
  const { schema: inner } = unwrapNullable(schema)
  const kind = fieldKind(inner)

  if (kind === "array") {
    if (!Array.isArray(value)) return value
    const itemSchema =
      typeof inner.items === "object" && inner.items !== null
        ? (inner.items as Schema)
        : ({ type: "string" } as Schema)
    return value.map((item) => encodeValueForForm(itemSchema, item))
  }

  if (kind !== "object" || !isRecordValue(value)) return value

  const properties = (inner.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
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
  return encoded
}

function decodeValueFromForm(schema: Schema, value: unknown): unknown {
  const { schema: inner } = unwrapNullable(schema)
  const kind = fieldKind(inner)

  if (kind === "array") {
    if (!Array.isArray(value)) return value
    const itemSchema =
      typeof inner.items === "object" && inner.items !== null
        ? (inner.items as Schema)
        : ({ type: "string" } as Schema)
    return value.map((item) => decodeValueFromForm(itemSchema, item))
  }

  if (kind !== "object" || !isRecordValue(value)) return value

  const properties = (inner.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const decoded: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(properties)) {
    if (typeof child !== "object" || child === null) continue
    const encodedKey = encodeFormSegment(key)
    const hasEncoded = hasOwnRecordValue(value, encodedKey)
    const rawValue = hasEncoded ? value[encodedKey] : value[key]
    if (rawValue !== undefined || hasEncoded || hasOwnRecordValue(value, key)) {
      decoded[key] = decodeValueFromForm(child, rawValue)
    }
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

function ScalarControl({
  kind,
  schema,
  field,
  compact = false,
  nullable = false,
  ...controlProps
}: {
  kind: FieldKind
  schema: Schema
  field: ControlFieldApi
  /** Dense, single-line variant for table cells. */
  compact?: boolean
  nullable?: boolean
} & ScalarControlDomProps) {
  const sizing = compact
    ? "h-8 rounded-md border-transparent bg-transparent px-2 text-sm shadow-none transition-colors hover:border-border hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"
    : undefined

  if (kind === "enum") {
    const enumValues = schema.enum ?? []
    const currentIndex = enumValues.findIndex((value) =>
      enumValueEquals(value, field.value)
    )
    const selectValue =
      field.value === null && nullable
        ? NULL_SELECT_VALUE
        : currentIndex >= 0
          ? enumOptionValue(currentIndex)
          : undefined
    const displayValue =
      field.value === null && nullable
        ? "No value"
        : currentIndex >= 0
          ? enumLabel(enumValues[currentIndex])
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
        <SelectTrigger className={sizing} {...controlProps}>
          <SelectValue placeholder="Select…">{displayValue}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {nullable ? (
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
    return (
      <Input
        nativeInput
        type="number"
        step={kind === "integer" ? 1 : "any"}
        className={sizing}
        {...controlProps}
        value={field.value == null ? "" : (field.value as number)}
        onChange={(e) =>
          field.onChange(
            e.target.value === ""
              ? nullable
                ? null
                : undefined
              : e.target.valueAsNumber
          )
        }
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }

  // string (+ formats)
  const value = field.value == null ? "" : String(field.value)
  if (schema.format === "date" || schema.format === "date-time") {
    return (
      <Input
        nativeInput
        type={schema.format === "date" ? "date" : "datetime-local"}
        className={sizing}
        {...controlProps}
        value={
          schema.format === "date-time" ? datetimeLocalInputValue(value) : value
        }
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
  // Textareas would break table-row heights, so compact cells stay single-line.
  if (
    !compact &&
    (schema.format === "textarea" || (schema.maxLength ?? 0) > 120)
  ) {
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
  return (
    <Input
      nativeInput
      className={sizing}
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
  className,
  depth,
}: {
  name: string
  sourcePath: string
  schema: Schema
  label: string
  className?: string
  depth: number
}) {
  const properties = (schema.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const required = new Set(schema.required ?? [])
  const entries = Object.entries(properties)
  const [open, setOpen] = React.useState(depth < AUTO_COLLAPSE_DEPTH)

  return (
    <div className={cn("rounded-lg border", className)}>
      <DisclosureHeader
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={label}
        summary={`${entries.length} field${entries.length === 1 ? "" : "s"}`}
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
                depth={depth + 1}
              />
            ) : null
          )}
        </div>
      ) : null}
    </div>
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
  className,
  depth,
}: {
  name: string
  sourcePath: string
  schema: Schema
  label: string
  className?: string
  depth: number
}) {
  const { control, getValues, setValue, unregister } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name })
  const itemSchema = React.useMemo(
    () =>
      typeof schema.items === "object" && schema.items !== null
        ? (schema.items as Schema)
        : ({ type: "string" } as Schema),
    [schema.items]
  )

  const columns = React.useMemo(
    () => scalarObjectColumns(itemSchema),
    [itemSchema]
  )

  const startOpen =
    depth < AUTO_COLLAPSE_DEPTH && fields.length <= LONG_ARRAY_THRESHOLD
  const [open, setOpen] = React.useState(startOpen)
  const usesEncodedItemPaths = React.useMemo(
    () => schemaUsesEncodedPaths(itemSchema),
    [itemSchema]
  )

  const add = React.useCallback(() => {
    const nextItem = emptyArrayItemValue(itemSchema, usesEncodedItemPaths)
    const current = getValues(name)
    append(nextItem as never)
    if (Array.isArray(current)) {
      setValue(name, [...current, nextItem], { shouldDirty: true })
    }
    setOpen(true)
  }, [append, getValues, itemSchema, name, setValue, usesEncodedItemPaths])
  const removeAt = React.useCallback(
    (index: number) => {
      const current = getValues(name)
      if (Array.isArray(current)) {
        const next = current.slice()
        next.splice(index, 1)
        remove(index)
        setValue(name, next, { shouldDirty: true })
        unregister(`${name}.${next.length}`)
        return
      }
      remove(index)
    },
    [getValues, name, remove, setValue, unregister]
  )

  return (
    <div className={cn("rounded-lg border", className)}>
      <DisclosureHeader
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={label}
        summary={`${fields.length} item${fields.length === 1 ? "" : "s"}`}
        description={schema.description}
        actions={
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="size-4" />
            Add
          </Button>
        }
      />
      {open ? (
        <div className="border-t p-3">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items.</p>
          ) : columns ? (
            <ArrayTable
              name={name}
              sourcePath={sourcePath}
              fields={fields}
              remove={removeAt}
              columns={columns}
            />
          ) : (
            <ArrayCards
              name={name}
              sourcePath={sourcePath}
              fields={fields}
              remove={removeAt}
              itemSchema={itemSchema}
              label={label}
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
  itemSchema: Schema
}

function ArrayCards({
  name,
  sourcePath,
  fields,
  remove,
  itemSchema,
  label,
  depth,
}: ArrayBodyProps & { label: string; depth: number }) {
  const renderCard = React.useCallback(
    (index: number) => (
      <ArrayCard
        name={name}
        sourcePath={sourcePath}
        index={index}
        remove={remove}
        itemSchema={itemSchema}
        label={label}
        depth={depth}
      />
    ),
    [name, sourcePath, remove, itemSchema, label, depth]
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
  itemSchema,
  label,
  depth,
}: {
  name: string
  sourcePath: string
  index: number
  remove: (index: number) => void
  itemSchema: Schema
  label: string
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
          depth={depth + 1}
        />
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="mt-1 text-muted-foreground hover:text-destructive"
        onClick={() => remove(index)}
        aria-label="Remove item"
      >
        <Trash2 className="size-4" />
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
  columns,
}: {
  name: string
  sourcePath: string
  fields: { id: string }[]
  remove: (index: number) => void
  columns: Column[]
}) {
  const template = `${columns.map(() => "minmax(9rem, 1fr)").join(" ")} 2.25rem`
  const minWidth = columns.length * 150 + 36
  const [activeEditorPath, setActiveEditorPath] = React.useState<string | null>(
    null
  )
  const activePath = React.useContext(FieldSourceActivePathContext)
  const tableRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const table = tableRef.current
    if (!table) return
    for (const cell of table.querySelectorAll("[data-source-active='true']")) {
      cell.removeAttribute("data-source-active")
    }
    if (!activePath) return
    for (const cell of table.querySelectorAll("[data-source-path]")) {
      if (cell.getAttribute("data-source-path") === activePath) {
        cell.setAttribute("data-source-active", "true")
      }
    }
  }, [activePath, fields.length])

  const renderRow = React.useCallback(
    (index: number, rowTopPx?: number) => (
      <ArrayTableRow
        name={name}
        sourcePath={sourcePath}
        index={index}
        isLastRow={index === fields.length - 1}
        columns={columns}
        remove={remove}
        template={template}
        rowTopPx={rowTopPx}
        activeEditorPath={activeEditorPath}
        setActiveEditorPath={setActiveEditorPath}
      />
    ),
    [
      name,
      sourcePath,
      fields.length,
      columns,
      remove,
      template,
      activeEditorPath,
    ]
  )

  const virtualize = fields.length > TABLE_VIRTUALIZE_THRESHOLD

  return (
    <div
      ref={tableRef}
      className="overflow-x-auto rounded-lg border bg-background shadow-sm"
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
            activeSourcePath={activePath}
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
  template,
  rowTopPx,
  activeEditorPath,
  setActiveEditorPath,
}: {
  name: string
  sourcePath: string
  index: number
  isLastRow: boolean
  columns: Column[]
  remove: (index: number) => void
  template: string
  rowTopPx?: number
  activeEditorPath: string | null
  setActiveEditorPath: (path: string | null) => void
}) {
  const { control, setValue } = useFormContext()
  const sourceActions = React.useContext(FieldSourceActionsContext)
  const rowPath = joinFormPath(name, index)
  const rowSourcePath = joinSourcePath(sourcePath, index)
  const rowValue = useWatch({ control, name: rowPath }) as
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
      className={cn(
        "grid items-center gap-1 border-b px-2 py-1 transition-colors hover:bg-muted/25",
        isLastRow && "border-b-0"
      )}
      style={rowStyle}
    >
      {columns.map((col) => {
        const path = joinFormPath(rowPath, col.key)
        const logicalPath = joinSourcePath(rowSourcePath, col.key)
        const value = rowValue?.[encodeFormSegment(col.key)]
        const isEditing = activeEditorPath === path
        // Same source-link affordance as scalar fields, sized for a table cell:
        // hovering the cell reports its leaf path; the active cell tints.
        const cellHandlers = sourceActions
          ? {
              onMouseEnter: () => sourceActions.onFieldHover(logicalPath),
              onMouseLeave: () => sourceActions.onFieldHover(null),
              onFocus: () => sourceActions.onFieldHover(logicalPath),
              onBlur: () => sourceActions.onFieldHover(null),
              onClick: () => sourceActions.selectField?.(logicalPath),
            }
          : undefined
        return (
          <div
            key={col.key}
            {...cellHandlers}
            data-source-path={sourceActions ? logicalPath : undefined}
            className={cn(
              "min-w-0 rounded px-1 py-0.5 transition-colors data-[source-active=true]:bg-primary/5 data-[source-active=true]:ring-1 data-[source-active=true]:ring-primary/30",
              sourceActions && "hover:bg-muted/55"
            )}
          >
            {isEditing && col.kind !== "boolean" ? (
              <ArrayTableCellEditor
                path={path}
                column={col}
                onClose={() => setActiveEditorPath(null)}
              />
            ) : col.kind === "boolean" ? (
              <ArrayTableBooleanCell
                path={path}
                value={value}
                onChange={(nextValue) => {
                  setValue(path, nextValue, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }}
              />
            ) : (
              <ArrayTableDisplayCell
                column={col}
                value={value}
                onEdit={() => setActiveEditorPath(path)}
              />
            )}
          </div>
        )
      })}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => remove(index)}
        aria-label="Remove row"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
})

const ArrayTableDisplayCell = React.memo(function ArrayTableDisplayCell({
  column,
  value,
  onEdit,
}: {
  column: Column
  value: unknown
  onEdit: () => void
}) {
  const label = labelFor(column.key, column.schema)
  const text = formatTableCellValue({ value, column })

  return (
    <button
      type="button"
      aria-label={`${label} ${text}`}
      className={cn(
        "flex h-8 w-full min-w-0 items-center rounded-md px-2 text-left text-sm text-foreground transition-colors hover:bg-background focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30",
        column.kind === "number" || column.kind === "integer"
          ? "justify-end tabular-nums"
          : "justify-start"
      )}
      onClick={onEdit}
    >
      <span className="truncate">{text}</span>
    </button>
  )
})

const ArrayTableBooleanCell = React.memo(function ArrayTableBooleanCell({
  path,
  value,
  onChange,
}: {
  path: string
  value: unknown
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex h-8 items-center justify-center">
      <Checkbox
        aria-label={path}
        checked={Boolean(value)}
        onCheckedChange={(nextValue) => onChange(nextValue === true)}
      />
    </div>
  )
})

function ArrayTableCellEditor({
  path,
  column,
  onClose,
}: {
  path: string
  column: Column
  onClose: () => void
}) {
  const { control } = useFormContext()
  const { field } = useController({ control, name: path })
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const input = wrapperRef.current?.querySelector<
      HTMLInputElement | HTMLButtonElement
    >("input,button")
    input?.focus()
    if (input instanceof HTMLInputElement) input.select()
  }, [])

  return (
    <div
      ref={wrapperRef}
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

function FixedArrayTableBody({
  name,
  fields,
  activeEditorPath,
  activeSourcePath,
  renderItem,
}: {
  name: string
  fields: { id: string }[]
  activeEditorPath: string | null
  activeSourcePath: string | null
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

  React.useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    for (const cell of scrollElement.querySelectorAll(
      "[data-source-active='true']"
    )) {
      cell.removeAttribute("data-source-active")
    }
    if (!activeSourcePath) return
    for (const cell of scrollElement.querySelectorAll("[data-source-path]")) {
      if (cell.getAttribute("data-source-path") === activeSourcePath) {
        cell.setAttribute("data-source-active", "true")
      }
    }
  }, [activeSourcePath, virtualRows])

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
  /**
   * Opt into field-level source linking. When set, every scalar field becomes a
   * hoverable card that reports its path and highlights when active — wire it
   * straight from a `useSourceLink` result.
   */
  sourceLink?: FieldSourceLink
  /** Rendered after the fields, e.g. a submit button. */
  children?: React.ReactNode
}

export function JsonForm({
  form,
  schema,
  onSubmit,
  className,
  sourceLink,
  children,
}: JsonFormProps) {
  const expandedSchema = React.useMemo(() => expandRefs(schema), [schema])
  const properties = (expandedSchema.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const required = new Set(expandedSchema.required ?? [])
  const usesEncodedPaths = React.useMemo(
    () => schemaUsesEncodedPaths(expandedSchema),
    [expandedSchema]
  )
  const onFieldHover = sourceLink?.onFieldHover
  const selectField = sourceLink?.selectField
  const sourceActions = React.useMemo<FieldSourceLinkActions | null>(
    () => (onFieldHover ? { onFieldHover, selectField } : null),
    [onFieldHover, selectField]
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
    <FieldSourceActionsContext.Provider value={sourceActions}>
      <FieldSourceActivePathContext.Provider
        value={sourceLink?.activePath ?? null}
      >
        <Form {...form}>
          <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
            {Object.entries(properties).map(([key, child]) =>
              typeof child === "object" ? (
                <JsonFormField
                  key={key}
                  name={joinFormPath("", key)}
                  sourcePath={key}
                  schema={child}
                  required={required.has(key)}
                  label={labelFor(key, child)}
                  depth={0}
                />
              ) : null
            )}
            {children}
          </form>
        </Form>
      </FieldSourceActivePathContext.Provider>
    </FieldSourceActionsContext.Provider>
  )
}
