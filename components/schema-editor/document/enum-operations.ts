import { mapPreserve } from "@/components/schema-editor/document/array"
import { getEffectiveDocNode } from "@/components/schema-editor/document/node-selectors"
import { updateNode } from "@/components/schema-editor/document/node-update"
import { getNode } from "@/components/schema-editor/document/traversal"
import {
  createEnumValue,
  updateEffectiveNodeShape,
} from "@/components/schema-editor/document/type-operations"
import type {
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
  return updateNode(doc, id, (node) =>
    updateEffectiveNodeShape(node, (effective) => ({
      ...effective,
      type: "string",
      enum: values.map((value, index) => ({
        ...(effective.enum?.[index] ?? createEnumValue()),
        value,
      })),
    }))
  )
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
