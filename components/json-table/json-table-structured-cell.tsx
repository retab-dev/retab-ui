import * as React from "react"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { JsonTableEditSession } from "@/components/json-table/json-table-edit-session"
import {
  ArrayEditor as JsonArrayEditor,
  ObjectEditor as JsonObjectEditor,
} from "@/components/json-table/object-editor"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

type SchemaWithDefs = JSONSchema7 & {
  $defs?: Record<string, JSONSchema7Definition>
}

function stripMetadataProperties(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value
  }
  const {
    docId: _docId,
    filename: _filename,
    fileType: _fileType,
    lastModified: _lastModified,
    _flat_similarities,
    _full_similarities,
    _similarity,
    _aligned_flat_similarities,
    _aligned_full_similarities,
    _aligned_similarity,
    _flat_reference_elements,
    _aligned_flat_reference_elements,
    ...rest
  } = value as Record<string, unknown>
  return rest
}

function objectSummary(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "object") return String(value)
  try {
    return JSON.stringify(stripMetadataProperties(value))
  } catch {
    return String(value)
  }
}

function arraySummary(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} items]`
  if (value === null || value === undefined) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function schemaWithContext(
  fieldSchema: JSONSchema7,
  tableSchema: JSONSchema7
): JSONSchema7 {
  const tableDefs = (tableSchema as SchemaWithDefs).$defs || {}
  const fieldDefs = (fieldSchema as SchemaWithDefs).$defs || {}

  return {
    ...fieldSchema,
    $defs: {
      ...tableDefs,
      ...fieldDefs,
    },
  }
}

export function JsonTableStructuredCell({
  effectiveValue,
  editSession,
  fieldMetadata,
  fieldPath,
  isEditable,
  schema,
  closeEditSession,
  commitValue,
  setOverlayOpen,
}: {
  effectiveValue: unknown
  editSession: JsonTableEditSession
  fieldMetadata: FieldMetadata
  fieldPath: string
  isEditable: boolean
  schema: JSONSchema7
  closeEditSession: () => void
  commitValue: (value: unknown) => void
  setOverlayOpen: (open: boolean) => void
}) {
  const fieldSchema = fieldMetadata.rawSchema
  const isArray = fieldMetadata.kind === "array"

  React.useLayoutEffect(() => {
    setOverlayOpen(true)
  }, [editSession.id, setOverlayOpen])

  return (
    <Popover
      open={editSession.isOverlayOpen}
      onOpenChange={(open) => {
        setOverlayOpen(open)
        if (!open) closeEditSession()
      }}
    >
      <PopoverTrigger asChild>
        <button className="h-full w-full justify-start overflow-hidden px-1 text-xs leading-none text-inherit select-none hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
          {effectiveValue ? (
            <div className="max-w-[80px] truncate text-left">
              {isArray ? arraySummary(effectiveValue) : objectSummary(effectiveValue)}
            </div>
          ) : (
            <div className="max-w-[80px] truncate text-left text-muted-foreground">
              {isArray
                ? `${fieldSchema.title || fieldPath}`
                : `Edit ${fieldSchema.title || fieldPath}`}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="m-0 w-96 p-4"
        align="start"
        side="top"
        sideOffset={0}
        alignOffset={-1}
      >
        {editSession.isOverlayOpen &&
          (isArray ? (
            <JsonArrayEditor
              name={fieldPath}
              disabled={!isEditable}
              property={schemaWithContext(fieldSchema, schema)}
              currentValue={effectiveValue}
              onSubmit={(values) => {
                commitValue(values)
                closeEditSession()
              }}
            />
          ) : (
            <JsonObjectEditor
              disabled={!isEditable}
              property={{
                ...schemaWithContext(fieldSchema, schema),
                additionalProperties: true,
              }}
              currentValue={effectiveValue}
              onSubmit={(values) => {
                commitValue(values)
                closeEditSession()
              }}
            />
          ))}
      </PopoverContent>
    </Popover>
  )
}
