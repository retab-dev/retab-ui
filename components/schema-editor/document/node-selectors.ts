import { getNode } from "@/components/schema-editor/document/traversal"
import type {
  DocumentNode,
  PropertyEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export function getEffectiveDocNode(node: DocumentNode): DocumentNode {
  if (node.anyOf) {
    const nonNull = node.anyOf.find(
      (branch) => branch.type !== "null" || branch.ref
    )
    if (nonNull) return nonNull
  }
  return node
}

export function getChildPropertyId(
  doc: SchemaDocument,
  parentId: string,
  key: string
): string | undefined {
  const parent = getNode(doc, parentId)
  if (!parent) return undefined
  return getEffectiveDocNode(parent).properties?.find(
    (entry) => entry.key === key
  )?.id
}

export function getChildNodeId(
  doc: SchemaDocument,
  parentId: string,
  key: string
): string | undefined {
  const parent = getNode(doc, parentId)
  if (!parent) return undefined
  return getEffectiveDocNode(parent).properties?.find(
    (entry) => entry.key === key
  )?.node.id
}

export function getItemsNodeId(
  doc: SchemaDocument,
  parentId: string
): string | undefined {
  const parent = getNode(doc, parentId)
  if (!parent) return undefined
  return getEffectiveDocNode(parent).items?.id
}

export function getOwnProperty(
  doc: SchemaDocument,
  parentId: string,
  index: number
): PropertyEntry | null {
  const parent = getNode(doc, parentId)
  return parent?.properties?.[index] ?? null
}
