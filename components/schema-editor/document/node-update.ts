import { mapPreserve } from "@/components/schema-editor/document/array"
import type {
  DocumentNode,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export function updateNode(
  doc: SchemaDocument,
  id: string,
  fn: (node: DocumentNode) => DocumentNode
): SchemaDocument {
  const root = replaceInNode(doc.root, id, fn)
  const defs = mapPreserve(doc.defs, (definition) => {
    const node = replaceInNode(definition.node, id, fn)
    return node === definition.node ? definition : { ...definition, node }
  })
  if (root === doc.root && defs === doc.defs) return doc
  return { ...doc, root, defs }
}

function replaceInNode(
  node: DocumentNode,
  id: string,
  fn: (node: DocumentNode) => DocumentNode
): DocumentNode {
  if (node.id === id) return fn(node)

  let next = node

  if (node.properties) {
    const properties = mapPreserve(node.properties, (entry) => {
      const child = replaceInNode(entry.node, id, fn)
      return child === entry.node ? entry : { ...entry, node: child }
    })
    if (properties !== node.properties) next = { ...next, properties }
  }

  if (node.items) {
    const items = replaceInNode(node.items, id, fn)
    if (items !== node.items) next = { ...next, items }
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const list = node[key]
    if (!list) continue
    const mapped = mapPreserve(list, (child) => replaceInNode(child, id, fn))
    if (mapped !== list) next = { ...next, [key]: mapped }
  }

  return next
}

export function updateNodeRest(
  doc: SchemaDocument,
  id: string,
  patch: Record<string, unknown>
): SchemaDocument {
  return updateNode(doc, id, (node) => ({
    ...node,
    rest: { ...node.rest, ...patch },
  }))
}
