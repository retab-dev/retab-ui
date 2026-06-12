import { mapPreserve } from "@/components/schema-editor/document/array"
import { updateNode } from "@/components/schema-editor/document/node-update"
import type {
  DocumentNode,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export function setNodeDescription(
  doc: SchemaDocument,
  id: string,
  description: string | undefined
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    const nextDescription = description?.trim() ? description : undefined
    return node.description === nextDescription
      ? node
      : { ...node, description: nextDescription }
  })
}

export function setNodeTitle(
  doc: SchemaDocument,
  id: string,
  title: string | undefined
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    const nextTitle = title?.trim() ? title : undefined
    return node.title === nextTitle ? node : { ...node, title: nextTitle }
  })
}

export function stripDescriptions(doc: SchemaDocument): SchemaDocument {
  const root = stripNodeDescription(doc.root)
  const defs = mapPreserve(doc.defs, (definition) => {
    const node = stripNodeDescription(definition.node)
    return node === definition.node ? definition : { ...definition, node }
  })
  if (root === doc.root && defs === doc.defs) return doc
  return { ...doc, root, defs }
}

function stripNodeDescription(node: DocumentNode): DocumentNode {
  let next =
    node.description === undefined ? node : { ...node, description: undefined }

  if (next.properties) {
    const properties = mapPreserve(next.properties, (property) => {
      const childNode = stripNodeDescription(property.node)
      return childNode === property.node
        ? property
        : { ...property, node: childNode }
    })
    if (properties !== next.properties) next = { ...next, properties }
  }

  if (next.items) {
    const items = stripNodeDescription(next.items)
    if (items !== next.items) next = { ...next, items }
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const children = next[key]
    if (!children) continue
    const mapped = mapPreserve(children, stripNodeDescription)
    if (mapped !== children) next = { ...next, [key]: mapped }
  }

  return next
}
