import type { JSONSchema7Definition } from "json-schema"

import { nodeFromJson, projectNode } from "@/components/schema-editor/document/convert"
import type {
  DefinitionEntry,
  DocumentNode,
  PropertyEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export function mapPreserve<T>(
  items: T[],
  fn: (item: T, index: number) => T
): T[] {
  let changed = false
  const next = items.map((item, index) => {
    const result = fn(item, index)
    if (result !== item) changed = true
    return result
  })
  return changed ? next : items
}

export function childNodes(node: DocumentNode): DocumentNode[] {
  const out: DocumentNode[] = []
  if (node.properties) for (const property of node.properties) out.push(property.node)
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
      current = doc.defs.find((definition) => definition.id === current!.ref)?.node
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
      return childNode === property.node ? property : { ...property, node: childNode }
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

export function getNodeJson(
  doc: SchemaDocument,
  id: string
): JSONSchema7Definition | null {
  const node = getNode(doc, id)
  return node ? projectNode(doc, node) : null
}

export function replaceNodeJson(
  doc: SchemaDocument,
  id: string,
  jsonNode: JSONSchema7Definition
): SchemaDocument {
  const converted = nodeFromJson(jsonNode, doc)
  return updateNode(doc, id, (node) => ({
    ...converted,
    id: node.id,
    order: node.order ?? converted.order,
  }))
}

export function updateNodeJson(
  doc: SchemaDocument,
  id: string,
  transform: (json: JSONSchema7Definition) => JSONSchema7Definition
): SchemaDocument {
  const json = getNodeJson(doc, id)
  if (json === null) return doc
  return replaceNodeJson(doc, id, transform(json))
}

export function getEffectiveDocNode(node: DocumentNode): DocumentNode {
  if (node.anyOf) {
    const nonNull = node.anyOf.find((branch) => branch.type !== "null" || branch.ref)
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
  return getEffectiveDocNode(parent).properties?.find((entry) => entry.key === key)?.id
}

export function getChildNodeId(
  doc: SchemaDocument,
  parentId: string,
  key: string
): string | undefined {
  const parent = getNode(doc, parentId)
  if (!parent) return undefined
  return getEffectiveDocNode(parent).properties?.find((entry) => entry.key === key)
    ?.node.id
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
