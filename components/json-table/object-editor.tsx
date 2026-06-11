import { useEffect } from "react"
import { ajvResolver } from "@hookform/resolvers/ajv"
import type { JSONSchemaType } from "ajv"
import type { JSONSchema7 } from "json-schema"
import { useForm, type UseFormReturn } from "react-hook-form"

import { JsonForm } from "@/components/json-form/json-form"

type FormValues = Record<string, unknown>

function objectValue(value: unknown): FormValues {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as FormValues)
    : {}
}

// Editor for an object cell: renders the property's schema as a form. Edits are
// persisted as they change (the popover has no explicit submit button).
export function ObjectEditor({
  property,
  currentValue,
  onSubmit,
  disabled = false,
}: {
  isOpen?: boolean
  property: JSONSchema7
  currentValue: unknown
  onSubmit: (values: unknown) => void
  setSourcesFieldPath?: (fieldPath: string | null) => void
  disabled?: boolean
}) {
  const form = useForm<FormValues>({
    defaultValues: objectValue(currentValue),
    resolver: ajvResolver(property as JSONSchemaType<FormValues>, {
      strictSchema: false,
      allErrors: true,
    }),
  })

  useEffect(() => {
    const sub = form.watch((values) => onSubmit(values))
    return () => sub.unsubscribe()
  }, [form, onSubmit])

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={property}
          onSubmit={(values) => onSubmit(values)}
          className="rounded-sm border border-border bg-background text-xs text-muted-foreground"
        />
      </fieldset>
    </div>
  )
}

// Editor for an array cell: wraps the array under a single named property so the
// form renders an array field, then unwraps it on submit.
export function ArrayEditor({
  name,
  property,
  currentValue,
  onSubmit,
  disabled = false,
}: {
  name: string
  property: JSONSchema7
  currentValue: unknown
  onSubmit: (values: unknown) => void
  setSourcesFieldPath?: (fieldPath: string | null) => void
  disabled?: boolean
}) {
  const { $defs, ...restProperty } = property
  const wrapperSchema: JSONSchema7 = {
    type: "object",
    $defs,
    properties: {
      [name]: restProperty,
    },
    required: [name],
  }

  const form = useForm<FormValues>({
    defaultValues: {
      [name]: Array.isArray(currentValue) ? currentValue : [],
    },
    resolver: ajvResolver(wrapperSchema as JSONSchemaType<FormValues>, {
      strictSchema: false,
      allErrors: true,
    }),
  })

  useEffect(() => {
    const sub = form.watch((values) => onSubmit(values[name]))
    return () => sub.unsubscribe()
  }, [form, onSubmit, name])

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={wrapperSchema}
          onSubmit={(values) => onSubmit(values[name])}
          className="rounded-sm border border-border bg-background text-xs text-muted-foreground"
        />
      </fieldset>
    </div>
  )
}
