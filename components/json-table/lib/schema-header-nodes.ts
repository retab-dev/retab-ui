import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { getSchemaFlatProperties } from "@/components/json-table/lib/schema-flat-properties"
import type { FieldPath } from "@/components/json-table/lib/schema-paths"
import { getSchemaPropertyTypeRaw } from "@/components/json-table/lib/schema-paths"
import {
  resolveSchema,
  unwrapSchema,
} from "@/components/json-table/lib/schema-references"

function formatHeaderName(name: string) {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function getHeaderEffectiveType(schema: JSONSchema7): string {
  if (Array.isArray(schema.enum)) return "enum"
  if (schema.$ref) return "$ref"
  if (schema.type === "string" && schema.format === "date") return "date"
  if (
    schema.type === "string" &&
    (schema.format === "time" || schema.format === "iso-time")
  ) {
    return "time"
  }
  if (schema.type === "string" && schema.format === "date-time") {
    return "datetime"
  }
  if (Array.isArray(schema.type)) {
    return schema.type.find((type) => type !== "null")?.toString() ?? "string"
  }
  return schema.type?.toString() || "string"
}

function getTopProperties(
  depth: number,
  properties: { key: string }[]
): string[] {
  const topProperties = properties.reduce((acc: string[], { key }) => {
    const firstProp = key.split(".")[depth]
    if (firstProp && !acc.includes(firstProp)) {
      acc.push(firstProp)
    }
    return acc
  }, [])
  if (topProperties.includes("*") && topProperties.length !== 1) {
    throw new Error("Invalid schema for array")
  }
  return topProperties
}

function isObjectSchemaProperty(
  property: JSONSchema7Definition,
  rootSchema: JSONSchema7
): boolean {
  if (typeof property !== "object" || property === null) return false
  const resolved = resolveSchema(property, rootSchema)
  return (
    resolved.type === "object" ||
    !!(resolved.properties && Object.keys(resolved.properties).length > 0)
  )
}

export function buildHeaderNodesFromSchema(
  schema: JSONSchema7,
  collapsedPaths: FieldPath[]
): [JsonTableHeaderNode[], number] {
  let maxDepth = 0
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return [[], 0]
  }

  function buildNodes(
    properties: { key: string }[],
    depth: number
  ): JsonTableHeaderNode[] {
    function keyStartsWith(key: string, prop: string) {
      return key.split(".")[depth] === prop
    }

    if (properties.length === 0) return []
    const topProperties = getTopProperties(depth, properties)

    if (topProperties.length === 1 && topProperties[0] === "*") {
      const nextDepth = depth + 1
      maxDepth = Math.max(maxDepth, nextDepth)
      const childProps = properties.map((property) => ({ key: property.key }))
      const levelTwoProperties = getTopProperties(nextDepth, childProps)
      if (!(levelTwoProperties.length === 1 && levelTwoProperties[0] === "*")) {
        return buildNodes(childProps, nextDepth)
      }
    }

    return topProperties.flatMap((topProp) => {
      const nextProperties = properties.filter(({ key }) =>
        keyStartsWith(key, topProp)
      )
      const key = nextProperties[0].key
        .split(".")
        .slice(0, depth + 1)
        .join(".")
      const propName = key.split(".").pop() || key
      const parentPath = key.split(".").slice(0, -1).join(".")

      const rawSchema = getSchemaPropertyTypeRaw(schema, key)
      const { schema: propertySchema } = unwrapSchema(rawSchema, schema)

      const effectiveType = getHeaderEffectiveType(propertySchema)
      const isObject = isObjectSchemaProperty(propertySchema, schema)
      const children = buildNodes(nextProperties, depth + 1)

      if (effectiveType === "array") {
        const shouldShowChildren = !collapsedPaths.some((path) =>
          key.startsWith(path)
        )
        let itemSchemaDef = rawSchema
        let itemSchema = propertySchema
        let itemEffectiveType = "string"

        if (propertySchema.type === "array") {
          const itemsSchema = propertySchema.items as
            | JSONSchema7Definition
            | undefined
          if (itemsSchema) {
            itemSchemaDef = itemsSchema
            itemSchema = unwrapSchema(itemsSchema, schema).schema
            itemEffectiveType = getHeaderEffectiveType(itemSchema)
          }
        }

        const nextChildren =
          shouldShowChildren && children.length > 0
            ? children
            : shouldShowChildren
              ? [
                  {
                    key: key + ".*",
                    label: "Value",
                    propName: "*",
                    parentPath: key,
                    rawSchema: itemSchemaDef,
                    schema: itemSchema,
                    effectiveType: itemEffectiveType,
                    itemEffectiveType,
                    isObject: false,
                    isArray: false,
                    canFold: false,
                    isExpanded: false,
                    isArrayValuePlaceholder: true,
                  },
                ]
              : []

        return {
          key,
          label: formatHeaderName(propName),
          propName,
          parentPath,
          rawSchema,
          schema: propertySchema,
          effectiveType,
          itemEffectiveType,
          isObject,
          isArray: true,
          canFold: children.length > 0,
          isExpanded: shouldShowChildren,
          ...(nextChildren.length > 0 ? { children: nextChildren } : {}),
        }
      }

      const shouldShowChildren = !collapsedPaths.some((path) =>
        key.startsWith(path)
      )

      return {
        key,
        label: formatHeaderName(propName),
        propName,
        parentPath,
        rawSchema,
        schema: propertySchema,
        effectiveType,
        isObject,
        isArray: false,
        canFold: isObject && children.length > 0,
        isExpanded: shouldShowChildren,
        ...(shouldShowChildren && children.length > 0
          ? { children }
          : undefined),
      }
    })
  }

  try {
    const flatProperties = getSchemaFlatProperties(schema, [], schema)
    return [buildNodes(flatProperties, 0), maxDepth]
  } catch (error) {
    console.error(
      "[buildHeaderNodesFromSchema] Failed to flatten schema:",
      error
    )
    return [[], maxDepth]
  }
}
