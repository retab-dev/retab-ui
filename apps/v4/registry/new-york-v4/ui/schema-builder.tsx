"use client"

import * as React from "react"

import { JsonSchemaEditor } from "@/components/schema-editor/json-schema-builder"
import { JsonSchemaEditorProvider } from "@/components/schema-editor/contexts/json-schema"
import { type ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { cn } from "@/lib/utils"

export interface SchemaBuilderProps {
  /** The JSON Schema being edited (controlled). */
  value: ExtendedJSONSchema7
  /** Called with the next schema whenever the user edits it. */
  onValueChange: (schema: ExtendedJSONSchema7) => void
  className?: string
}

/**
 * Controlled JSON Schema builder. Wraps the Retab schema editor into a single
 * `value` / `onValueChange` primitive so it composes like any other form field.
 *
 * The underlying editor's setter is `Dispatch<SetStateAction<…>>`, so it may be
 * called with either a value or an updater function — we resolve both against
 * the latest `value` via a ref and forward a plain schema to `onValueChange`.
 */
export function SchemaBuilder({
  value,
  onValueChange,
  className,
}: SchemaBuilderProps) {
  const valueRef = React.useRef(value)
  valueRef.current = value

  const setJsonSchema = React.useCallback(
    (next: React.SetStateAction<ExtendedJSONSchema7>) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: ExtendedJSONSchema7) => ExtendedJSONSchema7)(
              valueRef.current
            )
          : next
      onValueChange(resolved)
    },
    [onValueChange]
  )

  return (
    <div data-slot="schema-builder" className={cn("w-full", className)}>
      <JsonSchemaEditorProvider jsonSchema={value} setJsonSchema={setJsonSchema}>
        <JsonSchemaEditor />
      </JsonSchemaEditorProvider>
    </div>
  )
}

export { type ExtendedJSONSchema7 }
