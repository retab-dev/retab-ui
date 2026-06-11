import {
  replaceDraftEffectiveNode,
  setDraftArrayItems,
  setDraftEnumValues,
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
    case "resetPropertyDraft":
      return operation.propertyDraft
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
    case "setEnumValues":
      return setDraftEnumValues(propertyDraft, operation.values)
    case "replacePropertySchemaNode":
      return {
        ...propertyDraft,
        schemaNode: operation.schemaNode,
      }
    case "replaceEffectiveSchemaNode":
      return replaceDraftEffectiveNode(propertyDraft, operation.schemaNode)
    case "setArrayItemSchemaNode":
      return setDraftArrayItems(propertyDraft, operation.schemaNode)
  }
}
