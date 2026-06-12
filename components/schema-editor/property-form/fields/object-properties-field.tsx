"use client"

import * as React from "react"
import { PlusIcon, Trash2 } from "lucide-react"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import {
  createObjectPropertySchema,
  isSchemaNode,
  listObjectPropertyNames,
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation"
import { Button } from "@/components/ui-retab/button"
import { Input } from "@/components/ui-retab/input"
import { Label } from "@/components/ui-retab/label"

export function ObjectPropertiesField({
  schemaNode,
  schemaContext,
  disabled,
  onChange,
  renderPropertyEditor,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  disabled: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
  renderPropertyEditor: (props: {
    propertyName: string
    propertySchema: ExtendedJSONSchema7
    propertySchemaContext: PropertyFormSchemaContext
    onPropertySchemaChange: (schemaNode: ExtendedJSONSchema7) => void
  }) => React.ReactNode
}) {
  const [newPropertyName, setNewPropertyName] = React.useState("")
  const propertyNames = listObjectPropertyNames(schemaNode)
  const [draftPropertyIdsByName, setDraftPropertyIdsByName] = React.useState(
    () =>
      Object.fromEntries(
        propertyNames.map((propertyName, index) => [
          propertyName,
          `draft-property-${index}`,
        ])
      )
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
      next[propertyName] = propertyId
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
    setDraftPropertyIdsByName((current) => ({
      ...current,
      [trimmedNewPropertyName]: createDraftPropertyId(),
    }))
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
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs text-muted-foreground">Object fields</Label>

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
        }

        return (
          <div key={propertyId} className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Field name ${propertyName}`}
                disabled={disabled}
                value={propertyName}
                onChange={(event) => {
                  const nextName = event.target.value
                  const nameError = validatePropertyFormName({
                    name: nextName,
                    siblingNames: propertyNames,
                    originalName: propertyName,
                  })
                  if (nameError) return
                  renameDraftPropertyId(propertyName, nextName)
                  onChange(
                    renameObjectProperty({
                      schemaNode,
                      oldName: propertyName,
                      newName: nextName,
                    })
                  )
                }}
                className="h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Remove field ${propertyName}`}
                onClick={() => {
                  removeDraftPropertyId(propertyName)
                  onChange(removeObjectProperty({ schemaNode, propertyName }))
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
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
            })}
          </div>
        )
      })}

      <div className="flex items-center gap-2">
        <Input
          aria-label="New object field"
          placeholder="New field name"
          disabled={disabled}
          value={newPropertyName}
          onChange={(event) => setNewPropertyName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addProperty()
            }
          }}
          className="h-8"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled || !trimmedNewPropertyName || Boolean(newPropertyNameError)
          }
          onClick={addProperty}
        >
          <PlusIcon className="h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  )
}
