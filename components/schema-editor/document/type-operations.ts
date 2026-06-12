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
    ref: undefined,
    anyOf: undefined,
    oneOf: undefined,
    allOf: undefined,
    properties: undefined,
    items: undefined,
    enum: undefined,
  }

  if (type === "enum") {
    base.type = "string"
    base.enum = node.enum?.length ? node.enum : [createEnumValue()]
  } else if (type === "object") {
    base.type = "object"
    base.properties = node.properties?.length
      ? node.properties
      : [
          {
            id: createId("prop"),
            key: "",
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
  const { format: _oldFormat, ...restWithoutFormat } = normalized.rest

  return {
    ...normalized,
    rest: format ? { ...restWithoutFormat, format } : restWithoutFormat,
  }
}

export function setNullable(
  doc: SchemaDocument,
  id: string,
  nullable: boolean
): SchemaDocument {
  return updateNode(doc, id, (node) => setNodeNullable(node, nullable))
}

function setNodeNullable(node: DocumentNode, nullable: boolean): DocumentNode {
  const current = node.type
  const names = Array.isArray(current)
    ? current.filter((type) => type !== "null")
    : current
      ? [current]
      : []

  if (nullable) {
    if (names.length === 0) return node
    return { ...node, type: [...names, "null"] }
  }

  if (names.length <= 1) return { ...node, type: names[0] }
  return { ...node, type: names }
}

function isNodeNullable(node: DocumentNode): boolean {
  if (Array.isArray(node.type)) return node.type.includes("null")
  return node.type === "null"
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
