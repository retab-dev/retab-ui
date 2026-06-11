import type { JSONSchema7 } from "json-schema"

import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { reorderSchemaProperty } from "@/components/json-table/lib/schema-mutations"
import { getSchemaPropertyType } from "@/components/json-table/lib/schema-paths"
import { resolveSchema } from "@/components/json-table/lib/schema-references"

export type HeaderDropSide = "before" | "after"

export function canDragHeaderNode({
  node,
  schema,
  disableHeaderInteractions,
}: {
  node: JsonTableHeaderNode
  schema: JSONSchema7
  disableHeaderInteractions: boolean
}) {
  const parentSchema = node.parentPath
    ? getSchemaPropertyType(schema, node.parentPath)
    : schema
  return (
    !disableHeaderInteractions && parentSchema && parentSchema.type === "object"
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
  const parentNode = node.parentPath
    ? resolveSchema(getSchemaPropertyType(schema, node.parentPath), schema)
    : resolveSchema(schema, schema)

  if (!parentNode || parentNode.type !== "object" || !parentNode.properties) {
    return undefined
  }

  const propKeys = Object.keys(parentNode.properties)
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

  return reorderSchemaProperty({
    schema,
    parentPath: node.parentPath,
    sourcePropName,
    targetPropName: node.propName,
  })
}
