"use client"

import * as React from "react"
import {
  type SubmitHandler,
  type UseFormReturn,
  useFieldArray,
  useFormContext,
} from "react-hook-form"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"
import { ChevronRight, Info, Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/uiform/ui/button"
import { Checkbox } from "@/components/uiform/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/uiform/ui/form"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/uiform/ui/tooltip"
import { Input } from "@/components/uiform/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/uiform/ui/select"
import { Textarea } from "@/components/uiform/ui/textarea"

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

type Schema = JSONSchema7

type FieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "enum"
  | "object"
  | "array"

// Tunables -------------------------------------------------------------------

/** Objects/arrays at or beyond this nesting depth start collapsed. */
const AUTO_COLLAPSE_DEPTH = 1
/** Card-mode arrays longer than this are virtualized. */
const CARD_VIRTUALIZE_THRESHOLD = 30
/** Table-mode arrays longer than this are virtualized. */
const TABLE_VIRTUALIZE_THRESHOLD = 30
/** Arrays longer than this start collapsed regardless of depth. */
const LONG_ARRAY_THRESHOLD = 8

// ---------------------------------------------------------------------------
// Schema helpers (small + local, so the component is self-contained)
// ---------------------------------------------------------------------------

/** Resolve `["string","null"]` / `anyOf:[…,{type:"null"}]` to the inner schema. */
function unwrapNullable(schema: Schema): { schema: Schema; nullable: boolean } {
  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((t) => t !== "null")
    return {
      schema: { ...schema, type: nonNull.length === 1 ? nonNull[0] : nonNull },
      nullable: schema.type.includes("null"),
    }
  }
  if (schema.anyOf) {
    const branches = schema.anyOf.filter(
      (b): b is Schema => typeof b === "object" && b !== null
    )
    const nullable = branches.some((b) => b.type === "null")
    const main = branches.find((b) => b.type !== "null")
    if (main) {
      return {
        schema: {
          ...main,
          title: schema.title ?? main.title,
          description: schema.description ?? main.description,
        },
        nullable,
      }
    }
  }
  return { schema, nullable: false }
}

function fieldKind(schema: Schema): FieldKind {
  if (Array.isArray(schema.enum)) return "enum"
  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type
  switch (type) {
    case "number":
      return "number"
    case "integer":
      return "integer"
    case "boolean":
      return "boolean"
    case "object":
      return "object"
    case "array":
      return "array"
    default:
      return "string"
  }
}

function isScalarKind(kind: FieldKind): boolean {
  return kind !== "object" && kind !== "array"
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function labelFor(name: string, schema: Schema, explicit?: string): string {
  if (explicit) return explicit
  if (schema.title) return schema.title
  const leaf = name.split(".").pop() ?? name
  return humanize(leaf)
}

function emptyValueFor(schema: Schema): unknown {
  const { schema: inner } = unwrapNullable(schema)
  switch (fieldKind(inner)) {
    case "boolean":
      return false
    case "object":
      return {}
    case "array":
      return []
    case "number":
    case "integer":
      return undefined
    default:
      return ""
  }
}

interface Column {
  key: string
  schema: Schema
  kind: FieldKind
  required: boolean
}

/**
 * If `itemSchema` is an object whose every property is a scalar, return its
 * columns (so the array can render as a table). Otherwise `null`.
 */
function scalarObjectColumns(itemSchema: Schema): Column[] | null {
  const { schema } = unwrapNullable(itemSchema)
  if (fieldKind(schema) !== "object") return null
  const properties = (schema.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const required = new Set(schema.required ?? [])
  const columns: Column[] = []
  for (const [key, child] of Object.entries(properties)) {
    if (typeof child !== "object" || child === null) return null
    const { schema: inner } = unwrapNullable(child as Schema)
    const kind = fieldKind(inner)
    if (!isScalarKind(kind)) return null
    columns.push({ key, schema: child as Schema, kind, required: required.has(key) })
  }
  return columns.length > 0 ? columns : null
}

// ---------------------------------------------------------------------------
// JsonFormField — the unit of composition
// ---------------------------------------------------------------------------

export interface JsonFormFieldProps {
  /** react-hook-form field path, e.g. `vendor.name` or `items.0`. */
  name: string
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
  schema: rawSchema,
  required = false,
  label,
  className,
  depth = 0,
}: JsonFormFieldProps) {
  const { schema } = unwrapNullable(rawSchema)
  const kind = fieldKind(schema)
  const heading = labelFor(name, schema, label)

  if (kind === "object") {
    return (
      <JsonFormObject
        name={name}
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
        schema={schema}
        label={heading}
        className={className}
        depth={depth}
      />
    )
  }

  if (kind === "boolean") {
    return (
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
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="flex items-center gap-1.5 leading-none">
              <FormLabel>{heading}</FormLabel>
              <DescriptionHint text={schema.description} />
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <div className="flex items-center gap-1.5">
            <FormLabel>
              {heading}
              {required ? (
                <span className="text-destructive"> *</span>
              ) : null}
            </FormLabel>
            <DescriptionHint text={schema.description} />
          </div>
          <FormControl>
            <ScalarControl kind={kind} schema={schema} field={field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Description hint — keeps long field descriptions out of the layout flow
// ---------------------------------------------------------------------------

/**
 * Renders a field's `description` as a hover tooltip on a small info icon rather
 * than a block of body text, so long guidance (e.g. multi-sentence extraction
 * prompts) doesn't blow up row height in deep documents.
 */
function DescriptionHint({ text }: { text?: string }) {
  if (!text) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Field description"
          className="text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-line text-left">
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

function ScalarControl({
  kind,
  schema,
  field,
  compact = false,
}: {
  kind: FieldKind
  schema: Schema
  field: ControlFieldApi
  /** Dense, single-line variant for table cells. */
  compact?: boolean
}) {
  const sizing = compact ? "h-8 text-sm" : undefined

  if (kind === "enum") {
    const options = (schema.enum ?? []).map((v) => String(v))
    return (
      <Select
        value={field.value == null ? undefined : String(field.value)}
        onValueChange={field.onChange}
      >
        <SelectTrigger className={sizing}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (kind === "number" || kind === "integer") {
    return (
      <Input
        type="number"
        step={kind === "integer" ? 1 : "any"}
        className={sizing}
        value={field.value == null ? "" : (field.value as number)}
        onChange={(e) =>
          field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
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
        type={schema.format === "date" ? "date" : "datetime-local"}
        className={sizing}
        value={value}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }
  // Textareas would break table-row heights, so compact cells stay single-line.
  if (!compact && (schema.format === "textarea" || (schema.maxLength ?? 0) > 120)) {
    return (
      <Textarea
        value={value}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }
  return (
    <Input
      className={sizing}
      value={value}
      onChange={(e) => field.onChange(e.target.value)}
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
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="truncate text-sm font-medium">{title}</span>
        {summary ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {summary}
          </span>
        ) : null}
      </button>
      <DescriptionHint text={description} />
      {actions}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Object composer (collapsible, lazy-mounted)
// ---------------------------------------------------------------------------

function JsonFormObject({
  name,
  schema,
  label,
  className,
  depth,
}: {
  name: string
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
                name={name ? `${name}.${key}` : key}
                schema={child}
                required={required.has(key)}
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
  schema,
  label,
  className,
  depth,
}: {
  name: string
  schema: Schema
  label: string
  className?: string
  depth: number
}) {
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name })
  const itemSchema =
    typeof schema.items === "object" && schema.items !== null
      ? (schema.items as Schema)
      : ({ type: "string" } as Schema)

  const columns = React.useMemo(
    () => scalarObjectColumns(itemSchema),
    [itemSchema]
  )

  const startOpen =
    depth < AUTO_COLLAPSE_DEPTH && fields.length <= LONG_ARRAY_THRESHOLD
  const [open, setOpen] = React.useState(startOpen)

  const add = React.useCallback(() => {
    append(emptyValueFor(itemSchema) as never)
    setOpen(true)
  }, [append, itemSchema])

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
              fields={fields}
              remove={remove}
              columns={columns}
              itemSchema={itemSchema}
            />
          ) : (
            <ArrayCards
              name={name}
              fields={fields}
              remove={remove}
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
  fields: { id: string }[]
  remove: (index: number) => void
  itemSchema: Schema
}

function ArrayCards({
  name,
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
        index={index}
        remove={remove}
        itemSchema={itemSchema}
        label={label}
        depth={depth}
      />
    ),
    [name, remove, itemSchema, label, depth]
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
  index,
  remove,
  itemSchema,
  label,
  depth,
}: {
  name: string
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
          name={`${name}.${index}`}
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
  fields,
  remove,
  columns,
}: ArrayBodyProps & { columns: Column[] }) {
  const template = `${columns
    .map(() => "minmax(120px, 1fr)")
    .join(" ")} 40px`
  const minWidth = columns.length * 140 + 40

  const renderRow = React.useCallback(
    (index: number) => (
      <ArrayTableRow
        name={name}
        index={index}
        columns={columns}
        remove={remove}
        template={template}
      />
    ),
    [name, columns, remove, template]
  )

  const virtualize = fields.length > TABLE_VIRTUALIZE_THRESHOLD

  return (
    <div className="overflow-x-auto rounded-md border">
      <div style={{ minWidth }}>
        {/* Header */}
        <div
          className="grid items-center gap-2 border-b bg-muted/50 px-2 py-1.5"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground"
            >
              <span className="truncate" title={labelFor(col.key, col.schema)}>
                {labelFor(col.key, col.schema)}
              </span>
              {col.required ? (
                <span className="text-destructive">*</span>
              ) : null}
              <DescriptionHint text={col.schema.description} />
            </div>
          ))}
          <span className="sr-only">Actions</span>
        </div>
        {/* Body */}
        {virtualize ? (
          <VirtualList
            fields={fields}
            estimateSize={44}
            renderItem={renderRow}
            maxHeight={420}
          />
        ) : (
          <div>
            {fields.map((entry, index) => (
              <React.Fragment key={entry.id}>
                {renderRow(index)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const ArrayTableRow = React.memo(function ArrayTableRow({
  name,
  index,
  columns,
  remove,
  template,
}: {
  name: string
  index: number
  columns: Column[]
  remove: (index: number) => void
  template: string
}) {
  return (
    <div
      className="grid items-center gap-2 border-b px-2 py-1 last:border-b-0"
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((col) => (
        <div key={col.key} className="min-w-0">
          {col.kind === "boolean" ? (
            <FormField
              name={`${name}.${index}.${col.key}`}
              render={({ field }) => (
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          ) : (
            <FormField
              name={`${name}.${index}.${col.key}`}
              render={({ field }) => (
                <ScalarControl
                  kind={col.kind}
                  schema={col.schema}
                  field={field}
                  compact
                />
              )}
            />
          )}
        </div>
      ))}
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
      <div
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
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
  /** Rendered after the fields, e.g. a submit button. */
  children?: React.ReactNode
}

export function JsonForm({
  form,
  schema,
  onSubmit,
  className,
  children,
}: JsonFormProps) {
  const properties = (schema.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const required = new Set(schema.required ?? [])

  return (
    <Form {...form}>
      <form
        onSubmit={
          onSubmit
            ? form.handleSubmit(onSubmit)
            : (e) => e.preventDefault()
        }
        className={cn("space-y-4", className)}
      >
        {Object.entries(properties).map(([key, child]) =>
          typeof child === "object" ? (
            <JsonFormField
              key={key}
              name={key}
              schema={child}
              required={required.has(key)}
              depth={0}
            />
          ) : null
        )}
        {children}
      </form>
    </Form>
  )
}
