import { mapPreserve } from "@/components/schema-editor/document/array"
import { getEffectiveDocNode } from "@/components/schema-editor/document/node-selectors"
import { updateNode } from "@/components/schema-editor/document/node-update"
import { getNode } from "@/components/schema-editor/document/traversal"
import {
  createNode,
  createEnumValue,
  updateEffectiveNodeShape,
} from "@/components/schema-editor/document/type-operations"
import type {
  DocumentNode,
  EnumValue,
  JsonValue,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export function addEnumValue(
  doc: SchemaDocument,
  id: string,
  value: JsonValue = ""
): SchemaDocument {
  return updateNode(doc, id, (node) =>
    updateEffectiveNodeShape(node, (effective) => ({
      ...effective,
      enum: [...(effective.enum ?? []), { ...createEnumValue(), value }],
    }))
  )
}

export function updateEnumValue(
  doc: SchemaDocument,
  id: string,
  enumId: string,
  patch: Partial<Omit<EnumValue, "id">>
): SchemaDocument {
  return updateNode(doc, id, (node) =>
    updateEffectiveNodeShape(node, (effective) => ({
      ...effective,
      enum: mapPreserve(effective.enum ?? [], (value) =>
        value.id === enumId ? { ...value, ...patch } : value
      ),
    }))
  )
}

export function removeEnumValue(
  doc: SchemaDocument,
  id: string,
  enumId: string
): SchemaDocument {
  return updateNode(doc, id, (node) =>
    updateEffectiveNodeShape(node, (effective) => ({
      ...effective,
      enum: (effective.enum ?? []).filter((value) => value.id !== enumId),
    }))
  )
}

export function setEnumValues(
  doc: SchemaDocument,
  id: string,
  values: JsonValue[]
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    if (isTypeArrayNullable(node)) {
      return {
        ...node,
        type: undefined,
        properties: undefined,
        items: undefined,
        ref: undefined,
        order: undefined,
        anyOf: [createEnumNode(values, node.enum), { ...createNode("null") }],
      }
    }

    return updateEffectiveNodeShape(node, (effective) => ({
      ...effective,
      type: "string",
      enum: buildEnumValues(values, effective.enum),
    }))
  })
}

export function updateEnumValueAtIndex(
  doc: SchemaDocument,
  id: string,
  index: number,
  value: JsonValue
): SchemaDocument {
  const node = getNode(doc, id)
  if (!node) return doc

  const enumId = getEffectiveDocNode(node).enum?.[index]?.id
  return enumId ? updateEnumValue(doc, id, enumId, { value }) : doc
}

export function removeEnumValueAtIndex(
  doc: SchemaDocument,
  id: string,
  index: number
): SchemaDocument {
  const node = getNode(doc, id)
  if (!node) return doc

  const enumId = getEffectiveDocNode(node).enum?.[index]?.id
  return enumId ? removeEnumValue(doc, id, enumId) : doc
}

function buildEnumValues(
  values: JsonValue[],
  existing?: EnumValue[]
): EnumValue[] {
  return values.map((value, index) => ({
    ...(existing?.[index] ?? createEnumValue()),
    value,
  }))
}

function isTypeArrayNullable(node: DocumentNode): boolean {
  return Array.isArray(node.type) && node.type.includes("null")
}

function createEnumNode(
  values: JsonValue[],
  existing?: EnumValue[]
): DocumentNode {
  const node = createNode("string")
  return {
    ...node,
    type: "string",
    enum: buildEnumValues(values, existing),
  }
}
