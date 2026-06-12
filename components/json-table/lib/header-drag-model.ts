import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { reorderSchemaProperty } from "@/components/json-table/lib/schema-mutations"
import {
  getSchemaPropertyType,
  getSchemaPropertyTypeRaw,
} from "@/components/json-table/lib/schema-paths"
import {
  resolveSchema,
  unwrapSchema,
} from "@/components/json-table/lib/schema-references"

export type HeaderDropSide = "before" | "after"

function isObjectSchema(
  schema: JSONSchema7 | undefined
): schema is JSONSchema7 {
  return !!schema && (schema.type === "object" || !!schema.properties)
}

function hasOwnSchemaProperty(
  properties: JSONSchema7["properties"],
  propName: string
): boolean {
  return Object.prototype.hasOwnProperty.call(properties, propName)
}

function getParentSchemaForHeader(
  schema: JSONSchema7,
  parentPath: string
): JSONSchema7 | undefined {
  const parentSchema = parentPath
    ? getSchemaPropertyType(schema, parentPath)
    : schema
  if (!parentSchema) return undefined
  return unwrapSchema(parentSchema, schema).schema
}

function getObjectPropertyKeysForDrop({
  schema,
  parentPath,
  sourcePropName,
  targetPropName,
}: {
  schema: JSONSchema7
  parentPath: string
  sourcePropName: string
  targetPropName: string
}): string[] | undefined {
  const rawParentSchema: JSONSchema7Definition | undefined = parentPath
    ? getSchemaPropertyTypeRaw(schema, parentPath)
    : schema
  if (parentPath && rawParentSchema === undefined) return undefined

  const resolvedParentSchema = resolveSchema(rawParentSchema, schema)

  const branches =
    resolvedParentSchema.allOf ||
    resolvedParentSchema.anyOf ||
    resolvedParentSchema.oneOf

  if (Array.isArray(branches)) {
    for (const branch of branches) {
      const branchSchema = unwrapSchema(
        resolveSchema(branch, schema),
        schema
      ).schema
      if (!isObjectSchema(branchSchema) || !branchSchema.properties) continue
      if (
        hasOwnSchemaProperty(branchSchema.properties, sourcePropName) &&
        hasOwnSchemaProperty(branchSchema.properties, targetPropName)
      ) {
        return Object.keys(branchSchema.properties)
      }
    }
    return undefined
  }

  const parentSchema = unwrapSchema(resolvedParentSchema, schema).schema
  return isObjectSchema(parentSchema) && parentSchema.properties
    ? Object.keys(parentSchema.properties)
    : undefined
}

export function canDragHeaderNode({
  node,
  schema,
  disableHeaderInteractions,
}: {
  node: JsonTableHeaderNode
  schema: JSONSchema7
  disableHeaderInteractions: boolean
}) {
  const parentSchema = getParentSchemaForHeader(schema, node.parentPath)
  return (
    !disableHeaderInteractions &&
    isObjectSchema(parentSchema) &&
    !!parentSchema.properties
  )
}

export function getHeaderDropSide({
  node,
  schema,
  sourcePropName,
}: {
  node: JsonTableHeaderNode
  schema: JSONSchema7
  sourcePropName: string
}): HeaderDropSide | undefined {
  const propKeys = getObjectPropertyKeysForDrop({
    schema,
    parentPath: node.parentPath,
    sourcePropName,
    targetPropName: node.propName,
  })
  if (!propKeys) return undefined

  const sourceIndex = propKeys.indexOf(sourcePropName)
  const targetIndex = propKeys.indexOf(node.propName)
  if (sourceIndex === -1 || targetIndex === -1) return undefined

  return sourceIndex < targetIndex ? "after" : "before"
}

export function buildHeaderDropSchema({
  node,
  schema,
  sourcePropName,
  sourceParentPath,
}: {
  node: JsonTableHeaderNode
  schema: JSONSchema7
  sourcePropName: string | null
  sourceParentPath: string | null
}): JSONSchema7 | undefined {
  if (
    !sourcePropName ||
    sourceParentPath !== node.parentPath ||
    sourcePropName === node.propName
  ) {
    return undefined
  }

  if (!getHeaderDropSide({ node, schema, sourcePropName })) {
    return undefined
  }

  const nextSchema = reorderSchemaProperty({
    schema,
    parentPath: node.parentPath,
    sourcePropName,
    targetPropName: node.propName,
  })

  return JSON.stringify(nextSchema) === JSON.stringify(schema)
    ? undefined
    : nextSchema
}
