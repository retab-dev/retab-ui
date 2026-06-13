"use client"

import * as React from "react"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { SchemaAddRow } from "@/components/schema-editor/primitives/schema-add-row"
import { SchemaFieldRow } from "@/components/schema-editor/primitives/schema-field-row"
import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description"
import { SchemaInlineName } from "@/components/schema-editor/primitives/schema-inline-name"
import { SchemaRowActions } from "@/components/schema-editor/primitives/schema-row-actions"
import {
  createObjectPropertySchema,
  isSchemaNode,
  listObjectPropertyNames,
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
} from "@/components/schema-editor/property-form/types"
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation"

import { TypeField } from "./type-field"

function getPropertyNamesKey(propertyNames: string[]) {
  return propertyNames.join("\0")
}

export function ObjectPropertiesField({
  schemaNode,
  schemaContext,
  mode,
  canEditPropertyType,
  disabled,
  onChange,
  renderPropertyEditor,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  canEditPropertyType: boolean
  disabled: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
  renderPropertyEditor: (props: {
    propertyName: string
    propertySchema: ExtendedJSONSchema7
    propertySchemaContext: PropertyFormSchemaContext
    onPropertySchemaChange: (schemaNode: ExtendedJSONSchema7) => void
    showTypeSelector: boolean
  }) => React.ReactNode
}) {
  const [newPropertyName, setNewPropertyName] = React.useState("")
  const propertyNames = listObjectPropertyNames(schemaNode)
  const propertyNamesKey = getPropertyNamesKey(propertyNames)
  const localPropertyNamesKeyRef = React.useRef<string | null>(null)
  const [draftPropertyIdsByName, setDraftPropertyIdsByName] = React.useState(
    () => createDraftPropertyIdsByName(propertyNames)
  )
  const nextDraftPropertyIdRef = React.useRef(propertyNames.length)
  const trimmedNewPropertyName = newPropertyName.trim()
  const newPropertyNameError = trimmedNewPropertyName
    ? validatePropertyFormName({
        name: trimmedNewPropertyName,
        siblingNames: propertyNames,
        originalName: "",
      })
    : null

  React.useEffect(() => {
    if (localPropertyNamesKeyRef.current === propertyNamesKey) {
      localPropertyNamesKeyRef.current = null
      return
    }
    setNewPropertyName("")
  }, [propertyNamesKey, schemaContext.originalName])

  const preserveNewPropertyNameForLocalProperties = (
    nextPropertyNames: string[]
  ) => {
    localPropertyNamesKeyRef.current = getPropertyNamesKey(nextPropertyNames)
  }

  const createDraftPropertyId = () => {
    const propertyId = `draft-property-${nextDraftPropertyIdRef.current}`
    nextDraftPropertyIdRef.current += 1
    return propertyId
  }

  const renameDraftPropertyId = (
    oldPropertyName: string,
    propertyName: string
  ) => {
    setDraftPropertyIdsByName((current) => {
      const propertyId = current[oldPropertyName] ?? createDraftPropertyId()
      const next = { ...current }
      delete next[oldPropertyName]
      setRecordValue(next, propertyName, propertyId)
      return next
    })
  }

  const removeDraftPropertyId = (propertyName: string) => {
    setDraftPropertyIdsByName((current) => {
      const next = { ...current }
      delete next[propertyName]
      return next
    })
  }

  const addProperty = () => {
    if (!trimmedNewPropertyName || newPropertyNameError) return
    preserveNewPropertyNameForLocalProperties([
      ...propertyNames,
      trimmedNewPropertyName,
    ])
    setDraftPropertyIdsByName((current) => {
      const next = { ...current }
      setRecordValue(next, trimmedNewPropertyName, createDraftPropertyId())
      return next
    })
    onChange(
      replaceObjectProperty({
        schemaNode,
        propertyName: trimmedNewPropertyName,
        propertySchema: createObjectPropertySchema(trimmedNewPropertyName),
      })
    )
    setNewPropertyName("")
  }

  return (
    <div className="space-y-2 pl-2">
      {propertyNames.map((propertyName) => {
        const propertyId =
          draftPropertyIdsByName[propertyName] ??
          `external-property-${propertyName}`
        const propertySchema = schemaNode.properties?.[propertyName]
        if (!isSchemaNode(propertySchema)) return null
        const propertySchemaContext = {
          ...schemaContext,
          siblingNames: propertyNames,
          originalName: propertyName,
          fieldPath: [
            schemaContext.fieldPath ?? schemaContext.originalName,
            propertyId,
          ].join("."),
          resetKey: [
            schemaContext.resetKey ??
              schemaContext.fieldPath ??
              schemaContext.originalName,
            propertyId,
          ].join("."),
        }

        return (
          <div key={propertyId} className="ml-4 border-l border-border">
            <SchemaFieldRow
              grip={disabled ? "empty" : "static"}
              name={
                <SchemaInlineName
                  value={propertyName}
                  editable={!disabled}
                  siblingValues={propertyNames}
                  canRename={true}
                  validate={(nextName) =>
                    validatePropertyFormName({
                      name: nextName,
                      siblingNames: propertyNames,
                      originalName: propertyName,
                    })
                  }
                  onCommit={(nextName) => {
                    preserveNewPropertyNameForLocalProperties(
                      propertyNames.map((name) =>
                        name === propertyName ? nextName : name
                      )
                    )
                    renameDraftPropertyId(propertyName, nextName)
                    onChange(
                      renameObjectProperty({
                        schemaNode,
                        oldName: propertyName,
                        newName: nextName,
                      })
                    )
                  }}
                />
              }
              description={
                <SchemaInlineDescription
                  value={propertySchema.description || ""}
                  editMode={disabled ? "readOnly" : "editable"}
                  onCommit={(description) => {
                    onChange(
                      replaceObjectProperty({
                        schemaNode,
                        propertyName,
                        propertySchema: {
                          ...propertySchema,
                          description: description || undefined,
                        },
                      })
                    )
                  }}
                />
              }
              actions={
                <SchemaRowActions
                  canDelete={true}
                  editMode={disabled ? "readOnly" : "editable"}
                  isEditable={!disabled}
                  hidePencilButton={true}
                  deleteLabel={`Remove field ${propertyName}`}
                  onDelete={() => {
                    preserveNewPropertyNameForLocalProperties(
                      propertyNames.filter((name) => name !== propertyName)
                    )
                    removeDraftPropertyId(propertyName)
                    onChange(removeObjectProperty({ schemaNode, propertyName }))
                  }}
                />
              }
              type={
                <TypeField
                  schemaNode={propertySchema}
                  schemaContext={propertySchemaContext}
                  fieldPath={propertySchemaContext.fieldPath}
                  mode={disabled || !canEditPropertyType ? "readOnly" : mode}
                  disabled={disabled || !canEditPropertyType}
                  variant="compact"
                  onChange={(nextPropertySchema) =>
                    onChange(
                      replaceObjectProperty({
                        schemaNode,
                        propertyName,
                        propertySchema: nextPropertySchema,
                      })
                    )
                  }
                />
              }
            />
            {renderPropertyEditor({
              propertyName,
              propertySchema,
              propertySchemaContext,
              onPropertySchemaChange: (nextPropertySchema) =>
                onChange(
                  replaceObjectProperty({
                    schemaNode,
                    propertyName,
                    propertySchema: nextPropertySchema,
                  })
                ),
              showTypeSelector: false,
            })}
          </div>
        )
      })}

      <SchemaAddRow
        ariaLabel="New object field"
        className="ml-4 border-l border-border pl-4"
        disabled={disabled}
        error={newPropertyNameError}
        placeholder="New property name"
        value={newPropertyName}
        onAdd={addProperty}
        onChange={setNewPropertyName}
      />
    </div>
  )
}

function createDraftPropertyIdsByName(propertyNames: string[]) {
  const draftPropertyIdsByName: Record<string, string> = {}
  propertyNames.forEach((propertyName, index) => {
    setRecordValue(
      draftPropertyIdsByName,
      propertyName,
      `draft-property-${index}`
    )
  })
  return draftPropertyIdsByName
}

function setRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}
