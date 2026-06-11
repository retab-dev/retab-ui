import type { JSONSchema7TypeName } from "json-schema"

import { createId } from "./id"
import type {
  DefinitionEntry,
  DocumentNode,
  EnumValue,
  PropertyEntry,
  SchemaDocument,
} from "./types"

/**
 * Immutable, identity-keyed edit operations over a Document.
 *
 * Every operation returns a NEW document (or the same reference, untouched, when
 * nothing changed — so `React.memo` / `useMemo` stay effective). Mirrors the pure
 * helper style of extend's schema-builder, but operates on the Document rather
 * than a parallel tree, so edits are inherently lossless.
 *
 * Identity is the addressing scheme throughout: callers pass a `NodeId`, never a
 * key or a path. Operations that act on the parent/child edge (rename, required,
 * move) locate the OWNING entry by its child node id.
 */

// ---------------------------------------------------------------------------
// Reference-preserving array map
// ---------------------------------------------------------------------------

/** Map an array, returning the SAME reference if no element changed. */
function mapPreserve<T>(items: T[], fn: (item: T, index: number) => T): T[] {
  let changed = false
  const next = items.map((item, index) => {
    const result = fn(item, index)
    if (result !== item) changed = true
    return result
  })
  return changed ? next : items
}

// ---------------------------------------------------------------------------
// Node lookup
// ---------------------------------------------------------------------------

/** Find a node anywhere in the document (root tree or any definition tree). */
export function getNode(doc: SchemaDocument, id: string): DocumentNode | null {
  return findInNode(doc.root, id) ?? findInDefs(doc.defs, id)
}

function findInDefs(defs: DefinitionEntry[], id: string): DocumentNode | null {
  for (const def of defs) {
    const found = findInNode(def.node, id)
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

/** All descendant nodes one level down — the single place child shape is known. */
function childNodes(node: DocumentNode): DocumentNode[] {
  const out: DocumentNode[] = []
  if (node.properties) for (const p of node.properties) out.push(p.node)
  if (node.items) out.push(node.items)
  if (node.anyOf) out.push(...node.anyOf)
  if (node.oneOf) out.push(...node.oneOf)
  if (node.allOf) out.push(...node.allOf)
  return out
}

// ---------------------------------------------------------------------------
// Generic node update
// ---------------------------------------------------------------------------

/** Replace the node with `id` via `fn`, anywhere in the document. */
export function updateNode(
  doc: SchemaDocument,
  id: string,
  fn: (node: DocumentNode) => DocumentNode
): SchemaDocument {
  const root = replaceInNode(doc.root, id, fn)
  const defs = mapPreserve(doc.defs, (def) => {
    const node = replaceInNode(def.node, id, fn)
    return node === def.node ? def : { ...def, node }
  })
  if (root === doc.root && defs === doc.defs) return doc
  return { ...doc, root, defs }
}

/** Shallow-merge keys into a node's `rest` (e.g. `format`, `pattern`, `default`). */
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
    const mapped = mapPreserve(list, (sub) => replaceInNode(sub, id, fn))
    if (mapped !== list) next = { ...next, [key]: mapped }
  }

  return next
}

// ---------------------------------------------------------------------------
// Property (object child) operations — addressed by the child node's id
// ---------------------------------------------------------------------------

/** Update the object node whose `properties` array we want to edit, by parent id. */
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

/** Find the parent object id + index of the entry owning `childId`. */
export function findOwningProperty(
  doc: SchemaDocument,
  childId: string
): { parentId: string; index: number } | null {
  let result: { parentId: string; index: number } | null = null
  const visit = (node: DocumentNode) => {
    if (result) return
    if (node.properties) {
      const index = node.properties.findIndex((p) => p.node.id === childId)
      if (index >= 0) {
        result = { parentId: node.id, index }
        return
      }
    }
    for (const child of childNodes(node)) visit(child)
  }
  visit(doc.root)
  for (const def of doc.defs) visit(def.node)
  return result
}

export function addProperty(
  doc: SchemaDocument,
  parentId: string,
  init: Partial<PropertyEntry> = {}
): SchemaDocument {
  const entry: PropertyEntry = {
    key: init.key ?? "",
    required: init.required ?? false,
    node: init.node ?? createNode("string"),
  }
  return updateObjectProperties(doc, parentId, (props) => [...props, entry])
}

export function removeProperty(
  doc: SchemaDocument,
  childId: string
): SchemaDocument {
  const owner = findOwningProperty(doc, childId)
  if (!owner) return doc
  return updateObjectProperties(doc, owner.parentId, (props) =>
    props.filter((p) => p.node.id !== childId)
  )
}

export function renameProperty(
  doc: SchemaDocument,
  childId: string,
  key: string
): SchemaDocument {
  return updateOwningEntry(doc, childId, (entry) =>
    entry.key === key ? entry : { ...entry, key }
  )
}

export function setRequired(
  doc: SchemaDocument,
  childId: string,
  required: boolean
): SchemaDocument {
  return updateOwningEntry(doc, childId, (entry) =>
    entry.required === required ? entry : { ...entry, required }
  )
}

function updateOwningEntry(
  doc: SchemaDocument,
  childId: string,
  fn: (entry: PropertyEntry) => PropertyEntry
): SchemaDocument {
  const owner = findOwningProperty(doc, childId)
  if (!owner) return doc
  return updateObjectProperties(doc, owner.parentId, (props) =>
    mapPreserve(props, (entry) =>
      entry.node.id === childId ? fn(entry) : entry
    )
  )
}

/**
 * Move a property to a target object at a target index (reorder or reparent).
 * Refuses to drop a node into its own subtree.
 */
export function moveProperty(
  doc: SchemaDocument,
  childId: string,
  targetParentId: string,
  index: number
): SchemaDocument {
  const owner = findOwningProperty(doc, childId)
  if (!owner) return doc
  if (isAncestor(doc, childId, targetParentId)) return doc

  const moved = getOwningEntry(doc, childId)
  if (!moved) return doc

  // Detach from the source.
  let next = updateObjectProperties(doc, owner.parentId, (props) =>
    props.filter((p) => p.node.id !== childId)
  )
  // Insert into the target.
  next = updateObjectProperties(next, targetParentId, (props) => {
    const clamped = Math.max(0, Math.min(index, props.length))
    const out = props.slice()
    out.splice(clamped, 0, moved)
    return out
  })
  return next
}

function getOwningEntry(
  doc: SchemaDocument,
  childId: string
): PropertyEntry | null {
  const owner = findOwningProperty(doc, childId)
  if (!owner) return null
  const parent = getNode(doc, owner.parentId)
  return parent?.properties?.[owner.index] ?? null
}

/** True if `nodeId` is `maybeDescendantId` or contains it. */
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

// ---------------------------------------------------------------------------
// Type / nullability
// ---------------------------------------------------------------------------

/**
 * Change a node's type, normalizing its children for the new shape (seed an
 * object with one property, an array with a string item, an enum with one value),
 * the way extend's `normalizePropertyForType` does — but preserving `nullable`
 * and all unmodeled keywords.
 */
export function setNodeType(
  doc: SchemaDocument,
  id: string,
  type: JSONSchema7TypeName | "enum"
): SchemaDocument {
  return updateNode(doc, id, (node) => normalizeNodeForType(node, type))
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
      : [{ key: "", required: false, node: createNode("string") }]
  } else if (type === "array") {
    base.type = "array"
    base.items = node.items ?? createNode("string")
  } else {
    base.type = type
  }

  return nullable ? setNodeNullable(base, true) : base
}

export function setNullable(
  doc: SchemaDocument,
  id: string,
  nullable: boolean
): SchemaDocument {
  return updateNode(doc, id, (node) => setNodeNullable(node, nullable))
}

/** Canonical nullable encoding: include/exclude "null" in the `type` array. */
function setNodeNullable(node: DocumentNode, nullable: boolean): DocumentNode {
  const current = node.type
  const names = Array.isArray(current)
    ? current.filter((t) => t !== "null")
    : current
      ? [current]
      : []

  if (nullable) {
    if (names.length === 0) return node // "any" is already nullable
    return { ...node, type: [...names, "null"] }
  }

  if (names.length <= 1) return { ...node, type: names[0] }
  return { ...node, type: names }
}

function isNodeNullable(node: DocumentNode): boolean {
  if (Array.isArray(node.type)) return node.type.includes("null")
  return node.type === "null"
}

// ---------------------------------------------------------------------------
// Enum values
// ---------------------------------------------------------------------------

export function addEnumValue(doc: SchemaDocument, id: string): SchemaDocument {
  return updateNode(doc, id, (node) => ({
    ...node,
    enum: [...(node.enum ?? []), createEnumValue()],
  }))
}

export function updateEnumValue(
  doc: SchemaDocument,
  id: string,
  enumId: string,
  patch: Partial<Omit<EnumValue, "id">>
): SchemaDocument {
  return updateNode(doc, id, (node) => ({
    ...node,
    enum: mapPreserve(node.enum ?? [], (value) =>
      value.id === enumId ? { ...value, ...patch } : value
    ),
  }))
}

export function removeEnumValue(
  doc: SchemaDocument,
  id: string,
  enumId: string
): SchemaDocument {
  return updateNode(doc, id, (node) => ({
    ...node,
    enum: (node.enum ?? []).filter((value) => value.id !== enumId),
  }))
}

// ---------------------------------------------------------------------------
// Definitions ($defs) — references stay valid across renames because they're
// addressed by id, not name.
// ---------------------------------------------------------------------------

export function addDefinition(
  doc: SchemaDocument,
  init: Partial<DefinitionEntry> = {}
): { doc: SchemaDocument; defId: string } {
  const entry: DefinitionEntry = {
    id: init.id ?? createId("def"),
    name: init.name ?? uniqueDefName(doc, "Definition"),
    node: init.node ?? createNode("object"),
  }
  return { doc: { ...doc, defs: [...doc.defs, entry] }, defId: entry.id }
}

export function renameDefinition(
  doc: SchemaDocument,
  defId: string,
  name: string
): SchemaDocument {
  // No ref rewriting needed — refs point at `defId`, not the name.
  const defs = mapPreserve(doc.defs, (def) =>
    def.id === defId ? { ...def, name } : def
  )
  return defs === doc.defs ? doc : { ...doc, defs }
}

export function removeDefinition(
  doc: SchemaDocument,
  defId: string
): SchemaDocument {
  const defs = doc.defs.filter((def) => def.id !== defId)
  if (defs.length === doc.defs.length) return doc
  // Dangling refs (node.ref === defId) are left intact and surface as a
  // validation error rather than being silently rewritten — caller's choice.
  return { ...doc, defs }
}

/** Turn a node into a `$ref` to a definition (clears its inline structure). */
export function setRef(
  doc: SchemaDocument,
  id: string,
  defId: string
): SchemaDocument {
  return updateNode(doc, id, (node) => ({
    id: node.id,
    ref: defId,
    description: node.description,
    rest: node.rest,
  }))
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createNode(type: JSONSchema7TypeName | "enum" = "string"): DocumentNode {
  return normalizeNodeForType({ id: createId(), rest: {} }, type)
}

export function createEnumValue(): EnumValue {
  return { id: createId("enum"), value: "" }
}

function uniqueDefName(doc: SchemaDocument, base: string): string {
  const taken = new Set(doc.defs.map((d) => d.name))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}${i}`)) i += 1
  return `${base}${i}`
}
