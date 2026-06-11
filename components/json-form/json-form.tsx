"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { JSONSchema7Definition } from "json-schema"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import {
  useFieldArray,
  useFormContext,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

const FieldSourceLinkContext = React.createContext<FieldSourceLink | null>(null)

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
  const sourceLink = React.useContext(FieldSourceLinkContext)
  if (!sourceLink) return <>{children}</>
  const active = sourceLink.activePath === name
  return (
    <div
      onMouseEnter={() => sourceLink.onFieldHover(name)}
      onMouseLeave={() => sourceLink.onFieldHover(null)}
      onFocus={() => sourceLink.onFieldHover(name)}
      onBlur={() => sourceLink.onFieldHover(null)}
      onClick={() => sourceLink.selectField?.(name)}
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
      <SourceFieldShell name={name}>
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
                  <FormLabel>{heading}</FormLabel>
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
    <SourceFieldShell name={name}>
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

const NULL_SELECT_VALUE = "__json-form-null__"

function enumOptionValue(index: number): string {
  return `enum:${index}`
}

function enumLabel(value: unknown): string {
  if (value === null) return "No value"
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function ScalarControl({
  kind,
  schema,
  field,
  compact = false,
  nullable = false,
}: {
  kind: FieldKind
  schema: Schema
  field: ControlFieldApi
  /** Dense, single-line variant for table cells. */
  compact?: boolean
  nullable?: boolean
}) {
  const sizing = compact ? "h-8 text-sm" : undefined

  if (kind === "enum") {
    const enumValues = schema.enum ?? []
    const currentIndex = enumValues.findIndex((value) =>
      Object.is(value, field.value)
    )
    const selectValue =
      field.value === null && nullable
        ? NULL_SELECT_VALUE
        : currentIndex >= 0
          ? enumOptionValue(currentIndex)
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
        <SelectTrigger className={sizing}>
          <SelectValue placeholder="Select…" />
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
        type="number"
        step={kind === "integer" ? 1 : "any"}
        className={sizing}
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
        type={schema.format === "date" ? "date" : "datetime-local"}
        className={sizing}
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
  // Textareas would break table-row heights, so compact cells stay single-line.
  if (
    !compact &&
    (schema.format === "textarea" || (schema.maxLength ?? 0) > 120)
  ) {
    return (
      <Textarea
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
      className={sizing}
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
}: {
  name: string
  fields: { id: string }[]
  remove: (index: number) => void
  columns: Column[]
}) {
  const template = `${columns.map(() => "minmax(120px, 1fr)").join(" ")} 40px`
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
  const sourceLink = React.useContext(FieldSourceLinkContext)
  return (
    <div
      className="grid items-center gap-2 border-b px-2 py-1 last:border-b-0"
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((col) => {
        const path = `${name}.${index}.${col.key}`
        const active = sourceLink?.activePath === path
        // Same source-link affordance as scalar fields, sized for a table cell:
        // hovering the cell reports its leaf path; the active cell tints.
        const cellHandlers = sourceLink
          ? {
              onMouseEnter: () => sourceLink.onFieldHover(path),
              onMouseLeave: () => sourceLink.onFieldHover(null),
              onFocus: () => sourceLink.onFieldHover(path),
              onBlur: () => sourceLink.onFieldHover(null),
              onClick: () => sourceLink.selectField?.(path),
            }
          : undefined
        return (
          <div
            key={col.key}
            {...cellHandlers}
            className={cn(
              "-mx-1 min-w-0 rounded px-1 transition-colors",
              sourceLink && "hover:bg-muted/60",
              active && "bg-primary/5 ring-1 ring-primary/30"
            )}
          >
            {col.kind === "boolean" ? (
              <FormField
                name={path}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={Boolean(field.value)}
                        onCheckedChange={(value) =>
                          field.onChange(value === true)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                name={path}
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormControl>
                      <ScalarControl
                        kind={col.kind}
                        schema={col.schema}
                        field={field}
                        compact
                        nullable={col.nullable}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
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

  return (
    <FieldSourceLinkContext.Provider value={sourceLink ?? null}>
      <Form {...form}>
        <form
          onSubmit={
            onSubmit ? form.handleSubmit(onSubmit) : (e) => e.preventDefault()
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
    </FieldSourceLinkContext.Provider>
  )
}
