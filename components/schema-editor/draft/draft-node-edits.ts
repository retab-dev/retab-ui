import type { JSONSchema7Definition } from "json-schema"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"

import { formatTitle } from "../schema-title"

export function getEffectiveType(node: ExtendedJSONSchema7): {
  type: string
  isNullable: boolean
} {
  if (node.anyOf && Array.isArray(node.anyOf)) {
    const nonNull = node.anyOf.find(
      (branch: JSONSchema7Definition) =>
        typeof branch === "object" &&
        (branch.type !== "null" || branch.$ref || branch.enum)
    )
    const isNullable = node.anyOf.some(
      (branch: JSONSchema7Definition) =>
        typeof branch === "object" && branch.type === "null"
    )
    if (nonNull && typeof nonNull === "object") {
      if (nonNull.$ref) return { type: "$ref", isNullable }
      if (nonNull.enum) return { type: "enum", isNullable }
      if (nonNull.type === "string" && nonNull.format === "date") {
        return { type: "date", isNullable }
      }
      if (nonNull.type === "string" && nonNull.format === "time") {
        return { type: "time", isNullable }
      }
      if (nonNull.type === "string" && nonNull.format === "date-time") {
        return { type: "datetime", isNullable }
      }
      return { type: nonNull.type?.toString() || "string", isNullable }
    }
    return { type: "string", isNullable }
  }
  if (node.enum) return { type: "enum", isNullable: false }
  if (node.$ref) return { type: "$ref", isNullable: false }
  if (node.type === "string" && node.format === "date") {
    return { type: "date", isNullable: false }
  }
  if (node.type === "string" && node.format === "time") {
    return { type: "time", isNullable: false }
  }
  if (node.type === "string" && node.format === "date-time") {
    return { type: "datetime", isNullable: false }
  }
  return { type: node.type?.toString() || "string", isNullable: false }
}

export function defaultSchemaForType(type: string): ExtendedJSONSchema7 {
  switch (type) {
    case "string":
      return { type: "string" }
    case "number":
      return { type: "number" }
    case "integer":
      return { type: "integer" }
    case "boolean":
      return { type: "boolean" }
    case "object":
      return { type: "object", properties: {}, required: [] }
    case "array":
      return { type: "array", items: { type: "string" } }
    case "$ref":
      return {} as ExtendedJSONSchema7
    case "enum":
      return { enum: [], type: "string" }
    case "date":
      return { type: "string", format: "date" }
    case "time":
      return { type: "string", format: "time" }
    case "datetime":
      return { type: "string", format: "date-time" }
    default:
      return { type: "string" }
  }
}

export function updateType(
  newType: string,
  nullable: boolean,
  oldNode: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  const effectiveOldNode = getEffectiveNode(oldNode)
  const metadata: Partial<ExtendedJSONSchema7> = {}
  if (oldNode.title) metadata.title = oldNode.title
  if (oldNode.description) metadata.description = oldNode.description

  let baseSchema = defaultSchemaForType(newType)

  if (newType === "array") {
    baseSchema = {
      type: "array",
      items:
        effectiveOldNode.type === "object"
          ? effectiveOldNode
          : { type: "string" },
    }
  } else if (newType === "enum") {
    baseSchema = {
      type: "string",
      enum: effectiveOldNode.enum || [],
    }
  }

  if (nullable) {
    return {
      anyOf: [baseSchema, { type: "null" }],
      ...metadata,
    } as ExtendedJSONSchema7
  }

  return { ...baseSchema, ...metadata }
}

export function setNullable(
  node: ExtendedJSONSchema7,
  nullable: boolean
): ExtendedJSONSchema7 {
  const { title, description, ...rest } = node

  if (nullable) {
    if (node.anyOf && Array.isArray(node.anyOf)) {
      const nonNullBranch = node.anyOf.find(
        (branch: JSONSchema7Definition) =>
          typeof branch === "object" && (branch.type !== "null" || branch.$ref)
      )
      const nonNullObject =
        typeof nonNullBranch === "object" ? nonNullBranch : {}

      return {
        anyOf: [{ ...nonNullObject }, { type: "null" }],
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
      }
    }

    return {
      anyOf: [{ ...rest }, { type: "null" }],
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    }
  }

  if (node.anyOf && Array.isArray(node.anyOf)) {
    const nonNullBranch = node.anyOf.find(
      (branch: JSONSchema7Definition) =>
        typeof branch === "object" && (branch.type !== "null" || branch.$ref)
    )
    const nonNullObject = typeof nonNullBranch === "object" ? nonNullBranch : {}

    return {
      ...nonNullObject,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    }
  }

  return node
}

export function updateEffectiveNode(
  node: ExtendedJSONSchema7,
  updatedEffectiveNode: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  if (node.anyOf && Array.isArray(node.anyOf)) {
    const anyOf = node.anyOf.map((branch: JSONSchema7Definition) =>
      typeof branch === "object" && branch.type === "null"
        ? branch
        : updatedEffectiveNode
    )
    return { ...node, anyOf }
  }
  return updatedEffectiveNode
}

export function updateSchemaProperty(
  schemaNode: ExtendedJSONSchema7,
  propertyKey: string,
  newPropertyName: string,
  updatedProperty: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  // Refuse to rename onto an existing sibling: merging would drop the renamed
  // property's schema and leave a duplicate in `required`. Callers validate
  // name collisions upstream, so this is a defensive no-op.
  if (
    newPropertyName !== propertyKey &&
    schemaNode.properties &&
    Object.prototype.hasOwnProperty.call(schemaNode.properties, newPropertyName)
  ) {
    return schemaNode
  }

  const effectiveNode = getEffectiveNode(updatedProperty)
  const cleanProperty = {
    ...effectiveNode,
    title: formatTitle(newPropertyName),
    ...(Array.isArray(effectiveNode.enum) && { type: "string" }),
  } as ExtendedJSONSchema7
  const finalProperty = updateEffectiveNode(updatedProperty, cleanProperty)

  const oldProperties = schemaNode.properties || {}
  const newProperties: Record<string, ExtendedJSONSchema7> = {}
  let found = false

  Object.keys(oldProperties).forEach((key) => {
    if (key === propertyKey && newPropertyName !== propertyKey) {
      setRecordValue(newProperties, newPropertyName, finalProperty)
      found = true
    } else if (isJSONSchema(oldProperties[key])) {
      setRecordValue(
        newProperties,
        key,
        oldProperties[key] as ExtendedJSONSchema7
      )
    }
  })

  if (!found && newPropertyName !== propertyKey) {
    setRecordValue(newProperties, newPropertyName, finalProperty)
    delete newProperties[propertyKey]
  }

  if (newPropertyName !== propertyKey) {
    const required = Array.isArray(schemaNode.required)
      ? schemaNode.required.map((key: string) =>
          key === propertyKey ? newPropertyName : key
        )
      : []

    return {
      ...schemaNode,
      properties: newProperties,
      required,
    }
  }

  return {
    ...schemaNode,
    properties: {
      ...newProperties,
      [propertyKey]: finalProperty,
    },
  }
}

function isJSONSchema(
  value: JSONSchema7Definition
): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null
}

function setRecordValue<T>(
  record: Record<string, T>,
  key: string,
  value: T
) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}
