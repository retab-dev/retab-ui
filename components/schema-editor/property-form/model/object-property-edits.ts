import type { JSONSchema7Definition } from "json-schema"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { moveOrderedItem } from "@/components/schema-editor/primitives/schema-order"
import { formatTitle } from "@/components/schema-editor/schema-title"

export function isSchemaNode(
  value: JSONSchema7Definition | undefined
): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function listObjectPropertyNames(schemaNode: ExtendedJSONSchema7) {
  return Object.keys(schemaNode.properties || {})
}

export function createObjectPropertySchema(
  propertyName: string
): ExtendedJSONSchema7 {
  return {
    type: "string",
    title: formatTitle(propertyName),
  }
}

export function replaceObjectProperty({
  schemaNode,
  propertyName,
  propertySchema,
}: {
  schemaNode: ExtendedJSONSchema7
  propertyName: string
  propertySchema: ExtendedJSONSchema7
}): ExtendedJSONSchema7 {
  return {
    ...schemaNode,
    properties: {
      ...(schemaNode.properties || {}),
      [propertyName]: propertySchema,
    },
    required: listObjectPropertyNames(schemaNode).includes(propertyName)
      ? schemaNode.required
      : [...(schemaNode.required || []), propertyName],
  }
}

export function renameObjectProperty({
  schemaNode,
  oldName,
  newName,
}: {
  schemaNode: ExtendedJSONSchema7
  oldName: string
  newName: string
}): ExtendedJSONSchema7 {
  if (!newName || oldName === newName) return schemaNode
  if (listObjectPropertyNames(schemaNode).includes(newName)) return schemaNode

  const properties = schemaNode.properties || {}
  const nextProperties: NonNullable<ExtendedJSONSchema7["properties"]> = {}
  for (const [currentName, propertySchema] of Object.entries(properties)) {
    setRecordValue(
      nextProperties,
      currentName === oldName ? newName : currentName,
      propertySchema
    )
  }

  return {
    ...schemaNode,
    properties: nextProperties,
    required: (schemaNode.required || []).map((name) =>
      name === oldName ? newName : name
    ),
  }
}

export function removeObjectProperty({
  schemaNode,
  propertyName,
}: {
  schemaNode: ExtendedJSONSchema7
  propertyName: string
}): ExtendedJSONSchema7 {
  const { [propertyName]: _removed, ...nextProperties } =
    schemaNode.properties || {}
  return {
    ...schemaNode,
    properties: nextProperties,
    required: (schemaNode.required || []).filter(
      (name) => name !== propertyName
    ),
  }
}

export function moveObjectProperty({
  schemaNode,
  propertyName,
  targetIndex,
}: {
  schemaNode: ExtendedJSONSchema7
  propertyName: string
  targetIndex: number
}): ExtendedJSONSchema7 {
  const properties = schemaNode.properties || {}
  const propertyEntries = Object.entries(properties)
  const sourceIndex = propertyEntries.findIndex(
    ([name]) => name === propertyName
  )
  if (sourceIndex < 0) return schemaNode

  const nextProperties: NonNullable<ExtendedJSONSchema7["properties"]> = {}
  for (const [name, propertySchema] of moveOrderedItem({
    items: propertyEntries,
    sourceIndex,
    targetIndex,
  })) {
    setRecordValue(nextProperties, name, propertySchema)
  }

  return {
    ...schemaNode,
    properties: nextProperties,
  }
}

function setRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}
