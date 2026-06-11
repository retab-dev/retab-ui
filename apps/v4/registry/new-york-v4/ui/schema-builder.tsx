"use client"

import {
  SchemaBuilder as SchemaBuilderImpl,
  type SchemaBuilderProps,
} from "@/components/schema-editor/editor/schema-builder"
import { type JSONSchema7 } from "json-schema"
import { cn } from "@/lib/utils"

export type { SchemaBuilderProps }
export type { JSONSchema7 }

/**
 * Controlled / uncontrolled JSON Schema builder.
 *
 * The editor's source of truth is an internal Document model (see
 * `@/components/schema-editor/document`); this surface is plain vanilla
 * `JSONSchema7` in and out — `value` / `defaultValue` + `onValueChange` — so it
 * composes like any other form field, losslessly and with stable identity.
 */
export function SchemaBuilder({ className, ...props }: SchemaBuilderProps) {
  return (
    <SchemaBuilderImpl
      className={cn("w-full rounded-xl border", className)}
      {...props}
    />
  )
}
