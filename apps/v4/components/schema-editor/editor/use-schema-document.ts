"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import {
  fromJsonSchema,
  toJsonSchema,
  type SchemaDocument,
} from "@/components/schema-editor/document"

/** Order-insensitive structural compare, to tell our own echo from a real
 *  external change to `value`. */
function stableStringify(value: unknown): string {
  const seen = new WeakSet()
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === "object") {
      if (seen.has(v as object)) return null
      seen.add(v as object)
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, norm((v as Record<string, unknown>)[k])])
      )
    }
    return v
  }
  return JSON.stringify(norm(value))
}

export interface UseSchemaDocumentOptions {
  /** Controlled JSON Schema value. */
  value?: JSONSchema7
  /** Initial JSON Schema for the uncontrolled case. */
  defaultValue?: JSONSchema7
  /** Called with the projected vanilla JSON Schema after every edit. */
  onValueChange?: (schema: JSONSchema7) => void
}

export interface SchemaDocumentController {
  doc: SchemaDocument
  /** Apply an immutable operation result as the new document (and emit JSON). */
  apply: (next: SchemaDocument) => void
  /** Functional update form, for convenience. */
  update: (fn: (doc: SchemaDocument) => SchemaDocument) => void
  /** The current document projected back to vanilla JSON Schema. */
  schema: JSONSchema7
}

const EMPTY_SCHEMA: JSONSchema7 = { type: "object", properties: {} }

/**
 * Bridges the editor's public vanilla-`JSONSchema7` surface to the internal
 * Document source of truth.
 *
 * The Document is held as the truth (so node ids stay stable across keystrokes —
 * no re-import on our own echo). We re-import only when `value` changes from
 * something OTHER than what we last emitted, so an external reset still flows in.
 */
export function useSchemaDocument({
  value,
  defaultValue,
  onValueChange,
}: UseSchemaDocumentOptions): SchemaDocumentController {
  const initial = value ?? defaultValue ?? EMPTY_SCHEMA
  const [doc, setDoc] = React.useState<SchemaDocument>(() =>
    fromJsonSchema(initial)
  )
  // Signature of the last JSON we are in sync with (emitted or imported).
  const syncedSignature = React.useRef<string>(stableStringify(initial))

  React.useEffect(() => {
    if (value === undefined) return
    const incoming = stableStringify(value)
    if (incoming !== syncedSignature.current) {
      setDoc(fromJsonSchema(value))
      syncedSignature.current = incoming
    }
  }, [value])

  const apply = React.useCallback(
    (next: SchemaDocument) => {
      setDoc(next)
      const schema = toJsonSchema(next)
      syncedSignature.current = stableStringify(schema)
      onValueChange?.(schema)
    },
    [onValueChange]
  )

  const update = React.useCallback(
    (fn: (doc: SchemaDocument) => SchemaDocument) => {
      setDoc((current) => {
        const next = fn(current)
        if (next === current) return current
        const schema = toJsonSchema(next)
        syncedSignature.current = stableStringify(schema)
        onValueChange?.(schema)
        return next
      })
    },
    [onValueChange]
  )

  const schema = React.useMemo(() => toJsonSchema(doc), [doc])

  return { doc, apply, update, schema }
}
