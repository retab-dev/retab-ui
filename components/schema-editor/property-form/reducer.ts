import {
  setDraftNullable,
  setDraftType,
} from "@/components/schema-editor/property-form/model/effective-node-edits"
import type {
  PropertyDraft,
  PropertyDraftOperation,
} from "@/components/schema-editor/property-form/types"

export function propertyDraftReducer(
  propertyDraft: PropertyDraft,
  operation: PropertyDraftOperation
): PropertyDraft {
  switch (operation.type) {
    case "renameProperty":
      return { ...propertyDraft, name: operation.name }
    case "setPropertyDescription":
      return {
        ...propertyDraft,
        schemaNode: {
          ...propertyDraft.schemaNode,
          description: operation.description,
        },
      }
    case "setPropertyNullable":
      return setDraftNullable(propertyDraft, operation.isNullable)
    case "setPropertyType":
      return setDraftType(propertyDraft, operation.schemaNodeType)
    case "replacePropertySchemaNode":
      return {
        ...propertyDraft,
        schemaNode: operation.schemaNode,
      }
  }
}
