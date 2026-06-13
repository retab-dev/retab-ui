import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { createPropertySchemaDetails } from "@/components/schema-editor/property-form/model/property-schema-details"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
  PropertySchemaDetailAccess,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"

export function createObjectPropertyRowDetails({
  access,
  editable,
  mode,
  schemaContext,
  schemaNode,
  onChange,
}: {
  access: PropertySchemaDetailAccess
  editable: boolean
  mode: PropertyFormMode
  schemaContext: PropertyFormSchemaContext
  schemaNode: ExtendedJSONSchema7
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}): PropertySchemaDetailsModel {
  return createPropertySchemaDetails({
    schemaNode,
    schemaContext,
    mode,
    access,
    disabled: !editable,
    showTypeSelector: false,
    onChange,
  })
}
