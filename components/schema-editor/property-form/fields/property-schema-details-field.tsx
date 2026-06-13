"use client"

import { ArrayItemsField } from "@/components/schema-editor/property-form/fields/array-items-field"
import { EnumValuesField } from "@/components/schema-editor/property-form/fields/enum-values-field"
import { ObjectPropertiesField } from "@/components/schema-editor/property-form/fields/object-properties-field"
import { TypeField } from "@/components/schema-editor/property-form/fields/type-field"
import { createPropertySchemaDetails } from "@/components/schema-editor/property-form/model/property-schema-details"
import type { PropertySchemaDetailsModel } from "@/components/schema-editor/property-form/types"

export function PropertySchemaDetailsField({
  details,
}: {
  details: PropertySchemaDetailsModel
}) {
  const { type, enumValues, objectProperties, arrayItems } = details

  return (
    <div className="space-y-3">
      {type && (
        <TypeField
          schemaNode={type.schemaNode}
          schemaContext={type.schemaContext}
          fieldPath={type.schemaContext.fieldPath}
          mode={type.mode}
          disabled={type.disabled}
          onChange={type.onChange}
        />
      )}
      {enumValues && (
        <EnumValuesField
          values={enumValues.values}
          resetKey={enumValues.resetKey}
          disabled={enumValues.disabled}
          onChange={enumValues.onChange}
        />
      )}
      {objectProperties && (
        <ObjectPropertiesField
          schemaNode={objectProperties.schemaNode}
          schemaContext={objectProperties.schemaContext}
          mode={objectProperties.mode}
          canEditPropertyType={objectProperties.canEditPropertyType}
          disabled={objectProperties.disabled}
          onChange={objectProperties.onChange}
          renderPropertyEditor={({
            propertySchema,
            propertySchemaContext,
            onPropertySchemaChange,
            showTypeSelector,
          }) => (
            <PropertySchemaDetailsField
              details={createPropertySchemaDetails({
                schemaNode: propertySchema,
                schemaContext: propertySchemaContext,
                mode: objectProperties.mode,
                capabilities: objectProperties.capabilities,
                disabled: objectProperties.disabled,
                showTypeSelector,
                onChange: onPropertySchemaChange,
              })}
            />
          )}
        />
      )}
      {arrayItems && (
        <ArrayItemsField>
          <PropertySchemaDetailsField details={arrayItems.itemDetails} />
        </ArrayItemsField>
      )}
    </div>
  )
}
