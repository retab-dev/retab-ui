"use client"

import { ArrayItemsField } from "@/components/schema-editor/property-form/fields/array-items-field"
import { EnumValuesField } from "@/components/schema-editor/property-form/fields/enum-values-field"
import { ObjectPropertiesField } from "@/components/schema-editor/property-form/fields/object-properties-field"
import { TypeField } from "@/components/schema-editor/property-form/fields/type-field"
import type { PropertySchemaDetailsModel } from "@/components/schema-editor/property-form/types"

export function PropertySchemaDetailsField({
  details,
}: {
  details: PropertySchemaDetailsModel
}) {
  const { type, enumValues, objectProperties, arrayItems } = details

  return (
    <div className="space-y-3">
      {type && <TypeField field={type} />}
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
          details={objectProperties}
          renderSchemaDetails={(schemaDetails) => (
            <PropertySchemaDetailsField details={schemaDetails} />
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
