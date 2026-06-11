"use client"

import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"
import { Label } from "@/components/ui-retab/label"

import { EnumValuesField } from "./enum-values-field"
import { ObjectPropertiesField } from "./object-properties-field"
import { TypeField } from "./type-field"

export function ArrayItemsField({
  schemaNode,
  schemaContext,
  onChange,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const effectiveSchemaNode = getEffectiveNode(schemaNode)

  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs text-muted-foreground">List item type</Label>
      <TypeField
        name="items"
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
          onChange={(values) => onChange({ ...effectiveSchemaNode, enum: values })}
        />
      )}
      {effectiveSchemaNode.type === "object" && !effectiveSchemaNode.$ref && (
        <ObjectPropertiesField
          name="items"
          schemaNode={effectiveSchemaNode}
          schemaContext={schemaContext}
          onChange={onChange}
        />
      )}
    </div>
  )
}
