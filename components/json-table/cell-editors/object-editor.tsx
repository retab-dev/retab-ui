import * as React from "react"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { ObjectEditor as JsonObjectEditor } from "@/components/json-table/object-editor"

type SchemaWithDefs = JSONSchema7 & {
  $defs?: Record<string, JSONSchema7Definition>
}

function stripProperties(value: unknown): unknown {
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

function formatObjectSummary(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "object") return String(value)
  try {
    return JSON.stringify(stripProperties(value))
  } catch {
    return String(value)
  }
}

export function transferContext(
  type: JSONSchema7,
  context: JSONSchema7
): JSONSchema7 {
  const contextDefs = (context as SchemaWithDefs).$defs || {}
  const typeDefs = (type as SchemaWithDefs).$defs || {}

  return {
    ...type,
    $defs: {
      ...contextDefs,
      ...typeDefs,
    },
  }
}

export function ObjectCellEditor({
  cell,
  editSession,
  setOverlayOpen,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  const property = cell.fieldMetadata.rawSchema

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
          {cell.effectiveValue ? (
            <div className="max-w-[80px] truncate text-left">
              {formatObjectSummary(cell.effectiveValue)}
            </div>
          ) : (
            <div className="max-w-[80px] truncate text-left text-muted-foreground">
              {`Edit ${property.title || cell.fieldPath}`}
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
        {editSession.isOverlayOpen && (
          <JsonObjectEditor
            disabled={!cell.isEditable}
            property={{
              ...transferContext(property, cell.schema),
              additionalProperties: true,
            }}
            currentValue={cell.effectiveValue}
            onSubmit={(values) => {
              commitValue(values)
              closeEditSession()
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
