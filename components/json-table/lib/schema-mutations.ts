import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import { resolveSchema } from "@/components/json-table/lib/schema-references"

function cloneSchema(schema: JSONSchema7): JSONSchema7 {
  return JSON.parse(JSON.stringify(schema)) as JSONSchema7
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function isArrayIndexSegment(segment: string): boolean {
  return /^\d+$/.test(segment)
}

function isObjectTraversalSchema(schema: JSONSchema7): boolean {
  return schema.type === "object" || !!schema.properties
}

function isArrayTraversalSchema(schema: JSONSchema7): boolean {
  return schema.type === "array" || !!schema.items
}

function hasOwnSchemaProperty(
  properties: JSONSchema7["properties"] | undefined,
  propName: string
): boolean {
  return (
    !!properties && Object.prototype.hasOwnProperty.call(properties, propName)
  )
}

function getOwnSchemaProperty(
  properties: JSONSchema7["properties"] | undefined,
  propName: string
): JSONSchema7Definition | undefined {
  return hasOwnSchemaProperty(properties, propName)
    ? properties?.[propName]
    : undefined
}

function hasAllTargetProperties(
  schema: JSONSchema7,
  targetPropNames: string[]
): boolean {
  return targetPropNames.every((propName) =>
    hasOwnSchemaProperty(schema.properties, propName)
  )
}

function isMutableNonNullBranch(schema: JSONSchema7): boolean {
  const type = Array.isArray(schema.type)
    ? schema.type.find((item) => item !== "null")
    : schema.type ||
      (schema.properties ? "object" : schema.items ? "array" : undefined)
  return type !== "null" && !!(type || schema.properties || schema.items)
}

function getMutableEffectiveNode(
  schemaDef: JSONSchema7Definition | Record<string, unknown>,
  rootSchema: JSONSchema7,
  targetPropNames: string[] = []
): JSONSchema7 | undefined {
  const resolvedNode = resolveSchema(
    schemaDef as JSONSchema7Definition,
    rootSchema
  )
  if (!resolvedNode || typeof resolvedNode !== "object") return undefined

  if (Array.isArray(resolvedNode.allOf)) {
    const objectBranches = resolvedNode.allOf
      .map((branch) => resolveSchema(branch, rootSchema))
      .filter((branch) => branch.type === "object" && branch.properties)

    if (targetPropNames.length > 0) {
      const matchingBranch = objectBranches.find((branch) =>
        hasAllTargetProperties(branch, targetPropNames)
      )
      if (matchingBranch) return matchingBranch
    }

    return objectBranches[0] ?? resolvedNode
  }

  const branches = resolvedNode.anyOf || resolvedNode.oneOf
  if (!Array.isArray(branches)) return resolvedNode

  const resolvedBranches = branches.map((branch) =>
    resolveSchema(branch, rootSchema)
  )

  if (targetPropNames.length > 0) {
    const matchingBranch = resolvedBranches.find((branch) =>
      hasAllTargetProperties(branch, targetPropNames)
    )
    if (matchingBranch) return matchingBranch
  }

  const nonNullBranch = resolvedBranches.find(isMutableNonNullBranch)

  return nonNullBranch ?? resolvedNode
}

function schemaAtPath(
  schema: JSONSchema7,
  parentObjectPath: string,
  targetPropNames: string[] = []
): JSONSchema7 | undefined {
  if (!parentObjectPath) {
    return getMutableEffectiveNode(schema, schema, targetPropNames)
  }

  let currentNode: JSONSchema7Definition | Record<string, unknown> = schema
  for (const segment of parentObjectPath.split(".")) {
    const currentSchemaRecord = getMutableEffectiveNode(currentNode, schema, [
      segment,
    ])
    if (!currentSchemaRecord) return undefined

    if (segment === "$defs" && currentSchemaRecord.$defs) {
      currentNode = currentSchemaRecord.$defs
      continue
    }

    if (
      isObjectTraversalSchema(currentSchemaRecord) &&
      currentSchemaRecord.properties &&
      getOwnSchemaProperty(currentSchemaRecord.properties, segment) !==
        undefined
    ) {
      currentNode = getOwnSchemaProperty(
        currentSchemaRecord.properties,
        segment
      ) as JSONSchema7Definition
    } else if (
      isArrayTraversalSchema(currentSchemaRecord) &&
      currentSchemaRecord.items &&
      Array.isArray(currentSchemaRecord.items)
    ) {
      if (!isArrayIndexSegment(segment)) return undefined
      const index = parseInt(segment, 10)
      currentNode =
        currentSchemaRecord.items[index] ??
        (currentSchemaRecord.additionalItems === false
          ? undefined
          : currentSchemaRecord.additionalItems)
      if (currentNode === undefined) return undefined
    } else if (
      isArrayTraversalSchema(currentSchemaRecord) &&
      currentSchemaRecord.items &&
      typeof currentSchemaRecord.items === "object" &&
      !Array.isArray(currentSchemaRecord.items) &&
      (segment === "*" || isArrayIndexSegment(segment))
    ) {
      currentNode = currentSchemaRecord.items
    } else if (isRecord(currentNode) && isRecord(currentNode[segment])) {
      currentNode = currentNode[segment]
    } else {
      return undefined
    }
  }

  return getMutableEffectiveNode(currentNode, schema, targetPropNames)
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
  const parentNode = schemaAtPath(schemaCopy, parentPath, [
    sourcePropName,
    targetPropName,
  ])

  if (!parentNode || !isObjectTraversalSchema(parentNode)) {
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

  const parentNode = schemaAtPath(schemaCopy, pathSegments.join("."), [
    propertyName,
  ])
  if (
    !parentNode ||
    !isObjectTraversalSchema(parentNode) ||
    !parentNode.properties
  ) {
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
