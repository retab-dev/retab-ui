import type { JSONSchema7TypeName } from "json-schema"

import { mapPreserve } from "@/components/schema-editor/document/array"
import { createId } from "@/components/schema-editor/document/id"
import { updateNode } from "@/components/schema-editor/document/node-update"
import type {
  DocumentNode,
  EnumValue,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export type SchemaEditorType =
  | JSONSchema7TypeName
  | "enum"
  | "date"
  | "time"
  | "datetime"

const STRING_REST_KEYS = new Set([
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  "format",
  "maxLength",
  "minLength",
  "pattern",
])

const NUMBER_REST_KEYS = new Set([
  "exclusiveMaximum",
  "exclusiveMinimum",
  "maximum",
  "minimum",
  "multipleOf",
])

const ARRAY_REST_KEYS = new Set([
  "additionalItems",
  "contains",
  "items",
  "maxContains",
  "maxItems",
  "minContains",
  "minItems",
  "prefixItems",
  "unevaluatedItems",
  "uniqueItems",
])

const OBJECT_REST_KEYS = new Set([
  "additionalProperties",
  "dependentRequired",
  "dependentSchemas",
  "dependencies",
  "maxProperties",
  "minProperties",
  "patternProperties",
  "propertyNames",
  "unevaluatedProperties",
])

const TYPE_SPECIFIC_REST_KEYS = new Set([
  ...STRING_REST_KEYS,
  ...NUMBER_REST_KEYS,
  ...ARRAY_REST_KEYS,
  ...OBJECT_REST_KEYS,
])

export function setNodeType(
  doc: SchemaDocument,
  id: string,
  type: JSONSchema7TypeName | "enum"
): SchemaDocument {
  return updateNode(doc, id, (node) => normalizeNodeForType(node, type))
}

export function setNodeEditorType(
  doc: SchemaDocument,
  id: string,
  type: SchemaEditorType
): SchemaDocument {
  return updateNode(doc, id, (node) =>
    updateEffectiveNodeShape(node, (effective) =>
      normalizeNodeForEditorType(effective, type)
    )
  )
}

export function normalizeNodeForType(
  node: DocumentNode,
  type: JSONSchema7TypeName | "enum"
): DocumentNode {
  const nullable = isNodeNullable(node)
  const base: DocumentNode = {
    ...node,
    rest: stripSchemaRestForType(node.rest, type),
    ref: undefined,
    anyOf: undefined,
    oneOf: undefined,
    allOf: undefined,
    properties: undefined,
    extraRequired: undefined,
    requiredOrder: undefined,
    items: undefined,
    enum: undefined,
    booleanSchema: undefined,
  }

  if (type === "enum") {
    base.type = "string"
    base.enum = node.enum?.length ? node.enum : [createEnumValue()]
  } else if (type === "object") {
    base.type = "object"
    base.extraRequired = node.extraRequired
    base.requiredOrder = node.requiredOrder
    base.properties = node.properties?.length
      ? node.properties
      : [
          {
            id: createId("prop"),
            key: "",
            // Starter row the user has yet to name: mark it transient so the
            // empty key is dropped at the projection boundary (matching
            // `addProperty`) instead of leaking as a property named "".
            isTransient: true,
            required: false,
            node: createNode("string"),
          },
        ]
  } else if (type === "array") {
    base.type = "array"
    base.items = node.items ?? createNode("string")
  } else {
    base.type = type
  }

  return nullable ? setNodeNullable(base, true) : base
}

function normalizeNodeForEditorType(
  node: DocumentNode,
  type: SchemaEditorType
): DocumentNode {
  const format =
    type === "date"
      ? "date"
      : type === "time"
        ? "time"
        : type === "datetime"
          ? "date-time"
          : undefined
  const schemaType: JSONSchema7TypeName | "enum" = format
    ? "string"
    : (type as JSONSchema7TypeName | "enum")
  const normalized = normalizeNodeForType(node, schemaType)

  return {
    ...normalized,
    rest: format
      ? { ...stripSchemaFormat(normalized.rest), format }
      : stripSchemaFormat(normalized.rest),
  }
}

export function stripSchemaFormat(
  rest: Record<string, unknown>
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(rest, "format")) return rest
  const { format: _format, ...withoutFormat } = rest
  return withoutFormat
}

export function stripSchemaTypeSpecificRest(
  rest: Record<string, unknown>
): Record<string, unknown> {
  return filterSchemaRest(rest, undefined)
}

function stripSchemaRestForType(
  rest: Record<string, unknown>,
  type: JSONSchema7TypeName | "enum"
): Record<string, unknown> {
  return filterSchemaRest(rest, getRestKeysForType(type))
}

function getRestKeysForType(
  type: JSONSchema7TypeName | "enum"
): Set<string> | undefined {
  if (type === "string" || type === "enum") return STRING_REST_KEYS
  if (type === "number" || type === "integer") return NUMBER_REST_KEYS
  if (type === "array") return ARRAY_REST_KEYS
  if (type === "object") return OBJECT_REST_KEYS
  return undefined
}

function filterSchemaRest(
  rest: Record<string, unknown>,
  allowedTypeSpecificKeys: Set<string> | undefined
): Record<string, unknown> {
  let next = rest

  for (const key of Object.keys(rest)) {
    if (
      TYPE_SPECIFIC_REST_KEYS.has(key) &&
      !allowedTypeSpecificKeys?.has(key)
    ) {
      if (next === rest) next = { ...rest }
      delete next[key]
    }
  }

  return next
}

export function setNullable(
  doc: SchemaDocument,
  id: string,
  nullable: boolean
): SchemaDocument {
  return updateNode(doc, id, (node) => setNodeNullable(node, nullable))
}

function setNodeNullable(node: DocumentNode, nullable: boolean): DocumentNode {
  if (node.anyOf) {
    return setAnyOfNodeNullable(node, nullable)
  }

  const current = node.type
  const names = Array.isArray(current)
    ? current.filter((type) => type !== "null")
    : current
      ? [current]
      : []

  if (nullable) {
    if (node.enum) return wrapNodeInNullableAnyOf(node)
    if (names.length === 0) {
      return node.ref ? wrapNodeInNullableAnyOf(node) : node
    }
    return { ...node, type: [...names, "null"] }
  }

  if (names.length <= 1) return { ...node, type: names[0] }
  return { ...node, type: names }
}

function isNodeNullable(node: DocumentNode): boolean {
  if (Array.isArray(node.type)) return node.type.includes("null")
  if (node.anyOf) return node.anyOf.some((branch) => branch.type === "null")
  return node.type === "null"
}

function setAnyOfNodeNullable(
  node: DocumentNode,
  nullable: boolean
): DocumentNode {
  const branches = node.anyOf ?? []
  const nonNullBranches = branches.filter(
    (branch) => branch.type !== "null" || branch.ref
  )

  if (nullable) {
    if (nonNullBranches.length !== branches.length) return node
    return { ...node, anyOf: [...branches, createNode("null")] }
  }

  if (nonNullBranches.length === branches.length) return node
  if (nonNullBranches.length !== 1) {
    return { ...node, anyOf: nonNullBranches }
  }

  return mergeNullableWrapperIntoBranch(node, nonNullBranches[0])
}

function wrapNodeInNullableAnyOf(node: DocumentNode): DocumentNode {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    rest: node.rest,
    order: node.order,
    anyOf: [cloneNodeAsAnyOfBranch(node), createNode("null")],
  }
}

function cloneNodeAsAnyOfBranch(node: DocumentNode): DocumentNode {
  return {
    ...node,
    id: createId(),
    type: nonNullType(node.type),
    title: undefined,
    description: undefined,
    rest: {},
    order: undefined,
  }
}

function nonNullType(
  type: DocumentNode["type"]
): DocumentNode["type"] {
  if (!Array.isArray(type)) return type
  const types = type.filter((entry) => entry !== "null")
  if (types.length === 0) return undefined
  return types.length === 1 ? types[0] : types
}

function mergeNullableWrapperIntoBranch(
  wrapper: DocumentNode,
  branch: DocumentNode
): DocumentNode {
  return {
    ...branch,
    id: wrapper.id,
    title: wrapper.title ?? branch.title,
    description: wrapper.description ?? branch.description,
    rest: { ...branch.rest, ...wrapper.rest },
    order: wrapper.order ?? branch.order,
  }
}

export function createNode(
  type: JSONSchema7TypeName | "enum" = "string"
): DocumentNode {
  return normalizeNodeForType({ id: createId(), rest: {} }, type)
}

export function createEnumValue(): EnumValue {
  return { id: createId("enum"), value: "" }
}

export function updateEffectiveNodeShape(
  node: DocumentNode,
  fn: (node: DocumentNode) => DocumentNode
): DocumentNode {
  if (node.anyOf) {
    return {
      ...node,
      anyOf: mapPreserve(node.anyOf, (branch) =>
        branch.type === "null" && !branch.ref ? branch : fn(branch)
      ),
    }
  }
  return fn(node)
}
