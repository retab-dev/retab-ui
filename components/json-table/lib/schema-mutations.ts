import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import { resolveSchema } from "@/components/json-table/lib/schema-references"

function cloneSchema(schema: JSONSchema7): JSONSchema7 {
  return JSON.parse(JSON.stringify(schema)) as JSONSchema7
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function schemaAtPath(
  schema: JSONSchema7,
  parentObjectPath: string
): JSONSchema7 | undefined {
  if (!parentObjectPath) return schema

  let currentNode: JSONSchema7Definition | Record<string, unknown> = schema
  for (const segment of parentObjectPath.split(".")) {
    const resolvedCurrentNode = resolveSchema(
      currentNode as JSONSchema7Definition,
      schema
    )
    if (!resolvedCurrentNode || typeof resolvedCurrentNode !== "object") {
      return undefined
    }

    currentNode = resolvedCurrentNode
    const currentSchemaRecord = currentNode as JSONSchema7

    if (segment === "$defs" && currentSchemaRecord.$defs) {
      currentNode = currentSchemaRecord.$defs
      continue
    }

    if (
      currentSchemaRecord.type === "object" &&
      currentSchemaRecord.properties &&
      currentSchemaRecord.properties[segment]
    ) {
      currentNode = currentSchemaRecord.properties[segment]
    } else if (
      currentSchemaRecord.type === "array" &&
      segment === "*" &&
      currentSchemaRecord.items &&
      typeof currentSchemaRecord.items === "object" &&
      !Array.isArray(currentSchemaRecord.items)
    ) {
      currentNode = currentSchemaRecord.items
    } else if (isRecord(currentNode) && isRecord(currentNode[segment])) {
      currentNode = currentNode[segment]
    } else {
      return undefined
    }
  }

  if (isRecord(currentNode) && typeof currentNode.$ref === "string") {
    const refSegments = currentNode.$ref.split("/")
    if (refSegments[0] === "#") {
      let refTarget: unknown = schema
      for (let i = 1; i < refSegments.length; i++) {
        refTarget = isRecord(refTarget) ? refTarget[refSegments[i]] : undefined
      }
      if (isRecord(refTarget)) {
        currentNode = refTarget as JSONSchema7
      }
    }
  }

  return currentNode as JSONSchema7
}

export function reorderSchemaProperty({
  schema,
  parentPath,
  sourcePropName,
  targetPropName,
}: {
  schema: JSONSchema7
  parentPath: string
  sourcePropName: string
  targetPropName: string
}): JSONSchema7 {
  const schemaCopy = cloneSchema(schema)
  const parentNode = schemaAtPath(schemaCopy, parentPath)

  if (!parentNode || parentNode.type !== "object") {
    return schemaCopy
  }
  if (!parentNode.properties) {
    parentNode.properties = {}
  }

  const currentProperties = parentNode.properties
  const keys = Object.keys(currentProperties)
  const sourceIndex = keys.indexOf(sourcePropName)
  const targetIndex = keys.indexOf(targetPropName)

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return schemaCopy
  }

  const reorderedKeys = Array.from(keys)
  const [movedItemKey] = reorderedKeys.splice(sourceIndex, 1)
  reorderedKeys.splice(targetIndex, 0, movedItemKey)

  const newProperties: Record<string, JSONSchema7Definition> = {}
  for (const key of reorderedKeys) {
    newProperties[key] = currentProperties[key]
  }
  parentNode.properties = newProperties

  return schemaCopy
}

export function deleteSchemaProperty({
  schema,
  schemaPropertyPath,
}: {
  schema: JSONSchema7
  schemaPropertyPath: string
}): JSONSchema7 {
  const schemaCopy = cloneSchema(schema)
  if (!schemaPropertyPath) return schemaCopy

  const pathSegments = schemaPropertyPath.split(".")
  const propertyName = pathSegments.pop()
  if (!propertyName) return schemaCopy

  const parentNode = schemaAtPath(schemaCopy, pathSegments.join("."))
  if (!parentNode || parentNode.type !== "object" || !parentNode.properties) {
    return schemaCopy
  }

  delete parentNode.properties[propertyName]

  if (Array.isArray(parentNode.required)) {
    parentNode.required = parentNode.required.filter(
      (requiredKey) => requiredKey !== propertyName
    )
    if (parentNode.required.length === 0) {
      delete parentNode.required
    }
  }

  return schemaCopy
}
