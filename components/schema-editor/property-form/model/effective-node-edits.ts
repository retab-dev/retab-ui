import type { JSONSchema7Definition, JSONSchema7Type } from "json-schema"

import {
  defaultSchemaForType,
  setNullable,
  updateEffectiveNode,
  updateType,
} from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import type {
  PropertyDraft,
  PropertySchemaNodeType,
} from "@/components/schema-editor/property-form/types"

export function isObjectSchema(
  value: JSONSchema7Definition | undefined
): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function setDraftNullable(
  propertyDraft: PropertyDraft,
  isNullable: boolean
): PropertyDraft {
  return {
    ...propertyDraft,
    schemaNode: setNullable(propertyDraft.schemaNode, isNullable),
  }
}

export function replaceDraftEffectiveNode(
  propertyDraft: PropertyDraft,
  schemaNode: ExtendedJSONSchema7
): PropertyDraft {
  return {
    ...propertyDraft,
    schemaNode: updateEffectiveNode(propertyDraft.schemaNode, schemaNode),
  }
}

export function setDraftArrayItems(
  propertyDraft: PropertyDraft,
  schemaNode: ExtendedJSONSchema7
): PropertyDraft {
  const effectiveSchemaNode = getEffectiveNode(propertyDraft.schemaNode)
  return {
    ...propertyDraft,
    schemaNode: updateEffectiveNode(propertyDraft.schemaNode, {
      ...effectiveSchemaNode,
      items: schemaNode,
    }),
  }
}

export function setDraftEnumValues(
  propertyDraft: PropertyDraft,
  values: JSONSchema7Type[]
): PropertyDraft {
  const effectiveSchemaNode = getEffectiveNode(propertyDraft.schemaNode)
  return replaceDraftEffectiveNode(propertyDraft, {
    ...effectiveSchemaNode,
    enum: values,
  })
}

export function getArrayItemsForDraft(
  schemaNode: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  const effectiveSchemaNode = getEffectiveNode(schemaNode)
  const effectiveItems = Array.isArray(effectiveSchemaNode.items)
    ? undefined
    : effectiveSchemaNode.items
  return isObjectSchema(effectiveItems) ? effectiveItems : { type: "string" }
}

export function setDraftType(
  propertyDraft: PropertyDraft,
  schemaNodeType: PropertySchemaNodeType
): PropertyDraft {
  if (schemaNodeType === "$ref") return propertyDraft
  if (schemaNodeType === "enum") {
    return {
      ...propertyDraft,
      schemaNode: updateType("enum", false, {
        ...defaultSchemaForType("enum"),
        enum: [],
      } as ExtendedJSONSchema7),
    }
  }
  return {
    ...propertyDraft,
    schemaNode: updateType(
      schemaNodeType,
      false,
      propertyDraft.schemaNode
    ) as ExtendedJSONSchema7,
  }
}
