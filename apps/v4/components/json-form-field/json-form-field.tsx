"use client"

import * as React from "react"
import {
  type SubmitHandler,
  type UseFormReturn,
  useFieldArray,
  useFormContext,
} from "react-hook-form"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"
import { Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/uiform/ui/button"
import { Checkbox } from "@/components/uiform/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/uiform/ui/form"
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
}

export function JsonFormField({
  name,
  schema: rawSchema,
  required = false,
  label,
  className,
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
            <div className="space-y-0.5 leading-none">
              <FormLabel>{heading}</FormLabel>
              {schema.description ? (
                <FormDescription>{schema.description}</FormDescription>
              ) : null}
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
          <FormLabel>
            {heading}
            {required ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </FormLabel>
          <FormControl>
            <ScalarControl kind={kind} schema={schema} field={field} />
          </FormControl>
          {schema.description ? (
            <FormDescription>{schema.description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
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
  ref: React.Ref<HTMLElement>
}

function ScalarControl({
  kind,
  schema,
  field,
}: {
  kind: FieldKind
  schema: Schema
  field: ControlFieldApi
}) {
  if (kind === "enum") {
    const options = (schema.enum ?? []).map((v) => String(v))
    return (
      <Select
        value={field.value == null ? undefined : String(field.value)}
        onValueChange={field.onChange}
      >
        <SelectTrigger>
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
        value={value}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }
  if (schema.format === "textarea" || (schema.maxLength ?? 0) > 120) {
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
      value={value}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
      name={field.name}
    />
  )
}

// ---------------------------------------------------------------------------
// Object + Array composers
// ---------------------------------------------------------------------------

function JsonFormObject({
  name,
  schema,
  label,
  className,
}: {
  name: string
  schema: Schema
  label: string
  className?: string
}) {
  const properties = (schema.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const required = new Set(schema.required ?? [])
  const entries = Object.entries(properties)

  return (
    <fieldset className={cn("space-y-3 rounded-lg border p-3", className)}>
      {label ? (
        <legend className="px-1 text-sm font-medium">{label}</legend>
      ) : null}
      {entries.map(([key, child]) =>
        typeof child === "object" ? (
          <JsonFormField
            key={key}
            name={name ? `${name}.${key}` : key}
            schema={child}
            required={required.has(key)}
          />
        ) : null
      )}
    </fieldset>
  )
}

function JsonFormArray({
  name,
  schema,
  label,
  className,
}: {
  name: string
  schema: Schema
  label: string
  className?: string
}) {
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name })
  const itemSchema =
    typeof schema.items === "object" && schema.items !== null
      ? (schema.items as Schema)
      : ({ type: "string" } as Schema)

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <FormLabel className="text-sm font-medium">{label}</FormLabel>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append(emptyValueFor(itemSchema))}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items.</p>
      ) : null}
      {fields.map((entry, index) => (
        <div
          key={entry.id}
          className="flex items-start gap-2 rounded-lg border p-2"
        >
          <div className="min-w-0 flex-1">
            <JsonFormField
              name={`${name}.${index}`}
              schema={itemSchema}
              label={`${label} ${index + 1}`}
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => remove(index)}
            aria-label="Remove item"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
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
            />
          ) : null
        )}
        {children}
      </form>
    </Form>
  )
}
