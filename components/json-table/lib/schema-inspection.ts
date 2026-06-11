import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"

export type FieldPath = string
export type MaterializedFieldPath = string

export type FieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "date-time"
  | "iso-time"
  | "enum"
  | "object"
  | "array"
  | "unknown"

export interface FieldMetadata {
  path: FieldPath
  rawSchema: JSONSchema7
  schema: JSONSchema7
  effectiveSchema: JSONSchema7
  isNullable: boolean
  kind: FieldKind
  enumValues: unknown[]
}

type SchemaWithCombinations = JSONSchema7 & {
  anyOf?: JSONSchema7Definition[]
  oneOf?: JSONSchema7Definition[]
  allOf?: JSONSchema7Definition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

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

export function resolveSchema(
  schemaDef: JSONSchema7Definition | null | undefined,
  context: JSONSchema7
): JSONSchema7 {
  if (schemaDef == null || typeof schemaDef !== "object") {
    return context
  }

  let current = schemaDef as JSONSchema7
  while (current.$ref && typeof current.$ref === "string") {
    const refPath = current.$ref
    const segments = refPath.split("/")
    if (segments[0] !== "#") {
      throw new Error("Only internal references are supported")
    }

    let next: unknown = context
    for (let i = 1; i < segments.length; i++) {
      if (!isRecord(next)) {
        console.warn(
          `[resolveSchema] Could not resolve $ref "${refPath}": path segment "${segments[i]}" not found at index ${i}`
        )
        return { type: "object" }
      }
      next = next[segments[i]]
    }

    if (!isRecord(next)) {
      console.warn(
        `[resolveSchema] Could not resolve $ref "${refPath}": target is null or not an object`
      )
      return { type: "object" }
    }
    current = next as JSONSchema7
  }
  return current
}

export function unwrapSchema(
  schemaDef: JSONSchema7Definition | undefined,
  root: JSONSchema7
): { schema: JSONSchema7; nullable: boolean } {
  let schema = resolveSchema(schemaDef, root)
  let nullable = false

  if (Array.isArray(schema.type) && schema.type.includes("null")) {
    nullable = true
    schema = { ...schema, type: schema.type.find((type) => type !== "null") }
  }

  const schemaWithCombinations = schema as SchemaWithCombinations
  const branches =
    schemaWithCombinations.anyOf ||
    schemaWithCombinations.oneOf ||
    schemaWithCombinations.allOf

  if (Array.isArray(branches) && branches.length > 0) {
    if (
      branches.some(
        (branch) =>
          typeof branch === "object" &&
          branch !== null &&
          (branch as JSONSchema7).type === "null"
      )
    ) {
      nullable = true
    }

    const nonNull = branches.find((branch) => {
      const resolved = resolveSchema(branch, root)
      const type = Array.isArray(resolved.type)
        ? resolved.type.find((item) => item !== "null")
        : resolved.type
      return (
        type !== "null" &&
        (type || resolved.properties || resolved.items || resolved.enum)
      )
    })

    if (nonNull) {
      const resolved = resolveSchema(nonNull, root)
      const {
        anyOf: _anyOf,
        oneOf: _oneOf,
        allOf: _allOf,
        ...rest
      } = resolved as SchemaWithCombinations
      schema = rest as JSONSchema7
    }
  }

  return { schema, nullable }
}

export function getSchemaFlatProperties(
  schema: JSONSchema7Definition,
  path: string[],
  context: JSONSchema7,
  opts?: {
    seen?: WeakSet<object>
    depth?: number
    maxDepth?: number
  }
): { key: string; type: JSONSchema7 }[] {
  const seen = opts?.seen ?? new WeakSet<object>()
  const depth = opts?.depth ?? 0
  const maxDepth = opts?.maxDepth ?? 64

  let resolved = resolveSchema(schema, context)
  resolved = unwrapSchema(resolved, context).schema

  if (depth > maxDepth) {
    console.warn(
      "[getSchemaFlatProperties] Max depth reached while flattening schema at path:",
      path.join(".")
    )
    return [{ key: path.join("."), type: resolved }]
  }

  let addedToSeen = false
  if (resolved && typeof resolved === "object") {
    if (seen.has(resolved)) {
      console.warn(
        "[getSchemaFlatProperties] Circular schema reference detected at path:",
        path.join(".")
      )
      return [
        {
          key: path.join("."),
          type: {
            ...resolved,
            type: resolved.type ?? "object",
            title: resolved.title || "(circular)",
          },
        },
      ]
    }
    seen.add(resolved)
    addedToSeen = true
  }

  let result: { key: string; type: JSONSchema7 }[]

  if (resolved.type === "array") {
    if (resolved.items) {
      if (Array.isArray(resolved.items)) {
        result = resolved.items.flatMap((item, index) =>
          getSchemaFlatProperties(item, [...path, String(index)], context, {
            seen,
            depth: depth + 1,
            maxDepth,
          })
        )
      } else if (typeof resolved.items === "object") {
        const itemSchema = unwrapSchema(resolved.items, context).schema
        result = getSchemaFlatProperties(itemSchema, [...path, "*"], context, {
          seen,
          depth: depth + 1,
          maxDepth,
        })
      } else {
        result = [{ key: path.join("."), type: resolved }]
      }
    } else {
      result = [{ key: path.join("."), type: resolved }]
    }
  } else if (resolved.type === "object") {
    if (resolved.properties) {
      result = Object.entries(resolved.properties).flatMap(([key, value]) =>
        getSchemaFlatProperties(value, [...path, key], context, {
          seen,
          depth: depth + 1,
          maxDepth,
        })
      )
    } else {
      result = [{ key: path.join("."), type: resolved }]
    }
  } else {
    result = [{ key: path.join("."), type: resolved }]
  }

  if (addedToSeen && resolved && typeof resolved === "object") {
    seen.delete(resolved)
  }

  return result
}

export function getSchemaPropertyType(
  schema: JSONSchema7,
  key: FieldPath
): JSONSchema7 {
  const rootSchema = schema
  if (key === "") return schema

  for (const segment of key.split(".")) {
    const traversal = unwrapSchema(
      resolveSchema(schema, rootSchema),
      rootSchema
    ).schema

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[segment] as JSONSchema7
    } else if (traversal.type === "array" && traversal.items) {
      if (Array.isArray(traversal.items)) {
        schema = traversal.items[parseInt(segment, 10)] as JSONSchema7
      } else if (
        typeof traversal.items === "object" &&
        (segment === "*" || !Number.isNaN(parseInt(segment, 10)))
      ) {
        schema = traversal.items as JSONSchema7
      }
    }
  }

  return resolveSchema(schema, rootSchema)
}

export function getSchemaPropertyTypeRaw(
  schema: JSONSchema7,
  key: FieldPath
): JSONSchema7Definition {
  const rootSchema = schema
  if (key === "") return schema

  for (const segment of key.split(".")) {
    const traversal = unwrapSchema(
      resolveSchema(schema, rootSchema),
      rootSchema
    ).schema

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[segment] as JSONSchema7
    } else if (traversal.type === "array" && traversal.items) {
      if (Array.isArray(traversal.items)) {
        schema = traversal.items[parseInt(segment, 10)] as JSONSchema7
      } else if (
        typeof traversal.items === "object" &&
        (segment === "*" || !Number.isNaN(parseInt(segment, 10)))
      ) {
        schema = traversal.items as JSONSchema7
      }
    }
  }

  return schema
}

export function getFieldMetadata(
  rootSchema: JSONSchema7,
  path: FieldPath
): FieldMetadata | undefined {
  if (!path) return undefined

  const rawSchema = getSchemaPropertyType(rootSchema, path)
  if (!rawSchema) return undefined

  const { schema, nullable } = unwrapSchema(rawSchema, rootSchema)
  const type = Array.isArray(schema.type)
    ? schema.type.find((item) => item !== "null")
    : schema.type
  const format = schema.format
  const kind: FieldKind = Array.isArray(schema.enum)
    ? "enum"
    : format === "date"
      ? "date"
      : format === "date-time"
        ? "date-time"
        : format === "iso-time"
          ? "iso-time"
          : type === "string" ||
              type === "number" ||
              type === "integer" ||
              type === "boolean" ||
              type === "object" ||
              type === "array"
            ? type
            : "unknown"

  return {
    path,
    rawSchema,
    schema,
    effectiveSchema: schema,
    isNullable: nullable,
    kind,
    enumValues: schema.enum ?? [],
  }
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
