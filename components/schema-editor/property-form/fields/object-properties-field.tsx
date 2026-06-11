"use client"

import * as React from "react"
import { PlusIcon, Trash2 } from "lucide-react"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"
import { formatTitle } from "@/components/schema-editor/schema-title"
import { Button } from "@/components/ui-retab/button"
import { Input } from "@/components/ui-retab/input"
import { Label } from "@/components/ui-retab/label"

import { ArrayItemsField } from "./array-items-field"
import { EnumValuesField } from "./enum-values-field"
import { TypeField } from "./type-field"

function isSchemaNode(value: unknown): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function propertyNames(schemaNode: ExtendedJSONSchema7) {
  return Object.keys(schemaNode.properties || {})
}

function replaceProperty(
  schemaNode: ExtendedJSONSchema7,
  propertyName: string,
  propertySchema: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  return {
    ...schemaNode,
    properties: {
      ...(schemaNode.properties || {}),
      [propertyName]: propertySchema,
    },
    required: propertyNames(schemaNode).includes(propertyName)
      ? schemaNode.required
      : [...(schemaNode.required || []), propertyName],
  }
}

function renameProperty(
  schemaNode: ExtendedJSONSchema7,
  oldName: string,
  newName: string
): ExtendedJSONSchema7 {
  if (!newName || oldName === newName) return schemaNode

  const properties = schemaNode.properties || {}
  const nextProperties: NonNullable<ExtendedJSONSchema7["properties"]> = {}
  for (const [currentName, propertySchema] of Object.entries(properties)) {
    nextProperties[currentName === oldName ? newName : currentName] =
      propertySchema
  }

  return {
    ...schemaNode,
    properties: nextProperties,
    required: (schemaNode.required || []).map((name) =>
      name === oldName ? newName : name
    ),
  }
}

function removeProperty(
  schemaNode: ExtendedJSONSchema7,
  propertyName: string
): ExtendedJSONSchema7 {
  const { [propertyName]: _removed, ...nextProperties } =
    schemaNode.properties || {}
  return {
    ...schemaNode,
    properties: nextProperties,
    required: (schemaNode.required || []).filter((name) => name !== propertyName),
  }
}

function NestedDraftFields({
  name,
  schemaNode,
  schemaContext,
  onChange,
}: {
  name: string
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const effectiveSchemaNode = getEffectiveNode(schemaNode)

  return (
    <div className="space-y-3">
      <TypeField
        name={name}
        schemaNode={schemaNode}
        schemaContext={schemaContext}
        mode="editable"
        disabled={false}
        onChange={onChange}
      />
      {Array.isArray(effectiveSchemaNode.enum) && (
        <EnumValuesField
          values={effectiveSchemaNode.enum}
          disabled={false}
          onChange={(values) => {
            onChange({ ...effectiveSchemaNode, enum: values })
          }}
        />
      )}
      {effectiveSchemaNode.type === "object" && !effectiveSchemaNode.$ref && (
        <ObjectPropertiesField
          name={name}
          schemaNode={effectiveSchemaNode}
          schemaContext={schemaContext}
          onChange={onChange}
        />
      )}
      {effectiveSchemaNode.type === "array" && (
        <ArrayItemsField
          schemaNode={
            isSchemaNode(effectiveSchemaNode.items)
              ? effectiveSchemaNode.items
              : { type: "string" }
          }
          schemaContext={schemaContext}
          onChange={(items) => onChange({ ...effectiveSchemaNode, items })}
        />
      )}
    </div>
  )
}

export function ObjectPropertiesField({
  schemaNode,
  schemaContext,
  onChange,
}: {
  name: string
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const [newPropertyName, setNewPropertyName] = React.useState("")
  const names = propertyNames(schemaNode)

  const addProperty = () => {
    const name = newPropertyName.trim()
    if (!name || names.includes(name)) return
    onChange(
      replaceProperty(schemaNode, name, {
        type: "string",
        title: formatTitle(name),
      })
    )
    setNewPropertyName("")
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs text-muted-foreground">Object fields</Label>

      {names.map((propertyName) => {
        const propertySchema = schemaNode.properties?.[propertyName]
        if (!isSchemaNode(propertySchema)) return null

        return (
          <div key={propertyName} className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Field name ${propertyName}`}
                value={propertyName}
                onChange={(event) => {
                  onChange(
                    renameProperty(schemaNode, propertyName, event.target.value)
                  )
                }}
                className="h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove field ${propertyName}`}
                onClick={() => onChange(removeProperty(schemaNode, propertyName))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <NestedDraftFields
              name={propertyName}
              schemaNode={propertySchema}
              schemaContext={{
                ...schemaContext,
                siblingNames: names,
                originalName: propertyName,
              }}
              onChange={(nextPropertySchema) =>
                onChange(
                  replaceProperty(
                    schemaNode,
                    propertyName,
                    nextPropertySchema
                  )
                )
              }
            />
          </div>
        )
      })}

      <div className="flex items-center gap-2">
        <Input
          aria-label="New object field"
          placeholder="New field name"
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
          disabled={!newPropertyName.trim() || names.includes(newPropertyName)}
          onClick={addProperty}
        >
          <PlusIcon className="h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  )
}
