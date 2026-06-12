import type {
  DefinitionEntry,
  DocumentNode,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export function childNodes(node: DocumentNode): DocumentNode[] {
  const out: DocumentNode[] = []
  if (node.properties)
    for (const property of node.properties) out.push(property.node)
  if (node.items) out.push(node.items)
  if (node.anyOf) out.push(...node.anyOf)
  if (node.oneOf) out.push(...node.oneOf)
  if (node.allOf) out.push(...node.allOf)
  return out
}

export function getNode(doc: SchemaDocument, id: string): DocumentNode | null {
  return findInNode(doc.root, id) ?? findInDefinitions(doc.defs, id)
}

function findInDefinitions(
  definitions: DefinitionEntry[],
  id: string
): DocumentNode | null {
  for (const definition of definitions) {
    const found = findInNode(definition.node, id)
    if (found) return found
  }
  return null
}

function findInNode(node: DocumentNode, id: string): DocumentNode | null {
  if (node.id === id) return node
  for (const child of childNodes(node)) {
    const found = findInNode(child, id)
    if (found) return found
  }
  return null
}

export function findNodeByPath(
  doc: SchemaDocument,
  path: string
): string | null {
  const segments = path.split(".").filter(Boolean)
  let node: DocumentNode | undefined = doc.root
  for (const segment of segments) {
    node = unwrapContainer(doc, node)
    const entry = node?.properties?.find((property) => property.key === segment)
    if (!entry) return null
    node = entry.node
  }
  return node?.id ?? null
}

function unwrapContainer(
  doc: SchemaDocument,
  node: DocumentNode | undefined
): DocumentNode | undefined {
  let current = node
  while (current) {
    if (current.ref) {
      current = doc.defs.find(
        (definition) => definition.id === current!.ref
      )?.node
      continue
    }
    if (current.items && !current.properties) {
      current = current.items
      continue
    }
    break
  }
  return current
}
