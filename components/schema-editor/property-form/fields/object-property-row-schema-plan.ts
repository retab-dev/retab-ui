import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { createPropertySchemaPlan } from "@/components/schema-editor/property-form/model/property-schema-plan"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
  PropertySchemaPlanAccess,
  PropertySchemaPlan,
} from "@/components/schema-editor/property-form/types"

export function createObjectPropertyRowSchemaPlan({
  access,
  editable,
  mode,
  schemaContext,
  schemaNode,
  onChange,
}: {
  access: PropertySchemaPlanAccess
  editable: boolean
  mode: PropertyFormMode
  schemaContext: PropertyFormSchemaContext
  schemaNode: ExtendedJSONSchema7
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}): PropertySchemaPlan {
  return createPropertySchemaPlan({
    schemaNode,
    schemaContext,
    mode,
    access,
    editable,
    showTypeSelector: false,
    onChange,
  })
}
