import { createNode } from "@/components/schema-editor/document/type-operations"
import type {
  DocumentNode,
  PropertyEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types"
import {
  childNodes,
  getNode,
  getOwnProperty,
  mapPreserve,
  updateNode,
} from "@/components/schema-editor/document/tree"
import { createId } from "@/components/schema-editor/document/id"

function updateObjectProperties(
  doc: SchemaDocument,
  parentId: string,
  fn: (properties: PropertyEntry[]) => PropertyEntry[]
): SchemaDocument {
  return updateNode(doc, parentId, (node) => ({
    ...node,
    properties: fn(node.properties ?? []),
  }))
}

export function findOwningProperty(
  doc: SchemaDocument,
  propertyId: string
): { parentId: string; index: number } | null {
  let result: { parentId: string; index: number } | null = null
  const visit = (node: DocumentNode) => {
    if (result) return
    if (node.properties) {
      const index = node.properties.findIndex((property) => property.id === propertyId)
      if (index >= 0) {
        result = { parentId: node.id, index }
        return
      }
    }
    for (const child of childNodes(node)) visit(child)
  }
  visit(doc.root)
  for (const definition of doc.defs) visit(definition.node)
  return result
}

export function addProperty(
  doc: SchemaDocument,
  parentId: string,
  init: Partial<PropertyEntry> = {}
): SchemaDocument {
  const entry: PropertyEntry = {
    id: init.id ?? createId("prop"),
    key: init.key ?? "",
    required: init.required ?? false,
    node: init.node ?? createNode("string"),
  }
  return updateObjectProperties(doc, parentId, (properties) => [...properties, entry])
}

export function removeProperty(
  doc: SchemaDocument,
  propertyId: string
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId)
  if (!owner) return doc
  return updateObjectProperties(doc, owner.parentId, (properties) =>
    properties.filter((property) => property.id !== propertyId)
  )
}

export function renameProperty(
  doc: SchemaDocument,
  propertyId: string,
  key: string
): SchemaDocument {
  return updateOwningEntry(doc, propertyId, (entry) =>
    entry.key === key ? entry : { ...entry, key }
  )
}

export function setRequired(
  doc: SchemaDocument,
  propertyId: string,
  required: boolean
): SchemaDocument {
  return updateOwningEntry(doc, propertyId, (entry) =>
    entry.required === required ? entry : { ...entry, required }
  )
}

function updateOwningEntry(
  doc: SchemaDocument,
  propertyId: string,
  fn: (entry: PropertyEntry) => PropertyEntry
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId)
  if (!owner) return doc
  return updateObjectProperties(doc, owner.parentId, (properties) =>
    mapPreserve(properties, (entry) =>
      entry.id === propertyId ? fn(entry) : entry
    )
  )
}

export function moveProperty(
  doc: SchemaDocument,
  propertyId: string,
  targetParentId: string,
  index: number
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId)
  if (!owner) return doc
  const moved = getOwnProperty(doc, owner.parentId, owner.index)
  if (!moved) return doc

  if (isAncestor(doc, moved.node.id, targetParentId)) return doc

  let next = updateObjectProperties(doc, owner.parentId, (properties) =>
    properties.filter((property) => property.id !== propertyId)
  )
  next = updateObjectProperties(next, targetParentId, (properties) => {
    const clamped = Math.max(0, Math.min(index, properties.length))
    const out = properties.slice()
    out.splice(clamped, 0, moved)
    return out
  })
  return next
}

function isAncestor(
  doc: SchemaDocument,
  nodeId: string,
  maybeDescendantId: string
): boolean {
  const node = getNode(doc, nodeId)
  if (!node) return false
  if (node.id === maybeDescendantId) return true
  return childNodes(node).some((child) =>
    isAncestor(doc, child.id, maybeDescendantId)
  )
}
