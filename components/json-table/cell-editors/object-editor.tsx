import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import { objectCellButtonClass } from "@/components/json-table/cell-editors/editor-classes"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { ObjectEditor as JsonObjectEditor } from "@/components/json-table/object-editor"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover"

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
  identity,
  field,
  overlays,
  commit,
}: CellEditorProps) {
  const property = field.fieldMetadata.rawSchema

  return (
    <Popover
      open={overlays.openEditorPath === identity.fieldPath}
      onOpenChange={(open) => {
        overlays.setOpenEditorPath(open ? identity.fieldPath : null)
      }}
    >
      <PopoverTrigger asChild>
        <button className={objectCellButtonClass}>
          {field.effectiveValue ? (
            <div className="max-w-[80px] truncate text-left">
              {JSON.stringify(stripProperties(field.effectiveValue))}
            </div>
          ) : (
            <div className="max-w-[80px] truncate text-left text-muted-foreground">
              {`Edit ${property.title || identity.fieldPath}`}
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
        {overlays.openEditorPath === identity.fieldPath && (
          <JsonObjectEditor
            disabled={!field.isEditable}
            property={{
              ...transferContext(property, field.schema),
              additionalProperties: true,
            }}
            currentValue={field.effectiveValue}
            onSubmit={(values) => {
              commit.onCommit(values)
              overlays.setOpenEditorPath(null)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
