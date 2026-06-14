"use client"

import { ArrayItemsField } from "@/components/schema-editor/property-form/fields/array-items-field"
import { EnumValuesField } from "@/components/schema-editor/property-form/fields/enum-values-field"
import { ObjectPropertiesField } from "@/components/schema-editor/property-form/fields/object-properties-field"
import { useObjectPropertiesModel } from "@/components/schema-editor/property-form/fields/object-properties-model"
import { TypeField } from "@/components/schema-editor/property-form/fields/type-field"
import type {
  PropertyObjectPropertiesSourceModel,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"

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
        <PropertyObjectPropertiesDetailsField details={objectProperties} />
      )}
      {arrayItems && (
        <ArrayItemsField>
          <PropertySchemaDetailsField details={arrayItems.itemSchemaDetails} />
        </ArrayItemsField>
      )}
    </div>
  )
}

function PropertyObjectPropertiesDetailsField({
  details,
}: {
  details: PropertyObjectPropertiesSourceModel
}) {
  const objectProperties = useObjectPropertiesModel(details)
  return <ObjectPropertiesField details={objectProperties} />
}
