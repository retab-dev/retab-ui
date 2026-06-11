import type { JSONSchema7Definition, JSONSchema7TypeName } from "json-schema"

import { nodeFromJson, projectNode } from "./convert"
import { createId } from "./id"
import type {
  DefinitionEntry,
  DocumentNode,
  EnumValue,
  JsonValue,
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
 * Identity is the addressing scheme throughout: node operations accept a
 * `NodeId`; property-edge operations accept a `PropertyId`. Neither depends on a
 * mutable key or positional path.
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

/**
 * Resolve a dotted property path (e.g. `vendor.address.city`, or
 * `line_items.description` through an array) to a node id. Follows `$ref` into
 * definitions and descends array `items` between segments. Returns null if any
 * segment can't be resolved.
 */
export function findNodeByPath(
  doc: SchemaDocument,
  path: string
): string | null {
  const segments = path.split(".").filter(Boolean)
  let node: DocumentNode | undefined = doc.root
  for (const segment of segments) {
    node = unwrapContainer(doc, node)
    const entry = node?.properties?.find((p) => p.key === segment)
    if (!entry) return null
    node = entry.node
  }
  return node?.id ?? null
}

/** Follow refs and descend array items until we reach a property-bearing node. */
function unwrapContainer(
  doc: SchemaDocument,
  node: DocumentNode | undefined
): DocumentNode | undefined {
  let current = node
  while (current) {
    if (current.ref) {
      current = doc.defs.find((d) => d.id === current!.ref)?.node
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
  let next = node.description === undefined ? node : { ...node, description: undefined }

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

// ---------------------------------------------------------------------------
// JSON bridge — read/write a node's JSON Schema by id
//
// These let existing components keep their JSON-Schema leaf utils (updateType,
// setNullable, updateEffectiveNode, …) unchanged: read the node's JSON with
// `getNodeJson`, transform it with the util, and splice the result back through
// the Document with `updateNodeJson`, preserving the node's stable id.
// ---------------------------------------------------------------------------

/** Project the node with `id` to JSON Schema (null if not found). */
export function getNodeJson(
  doc: SchemaDocument,
  id: string
): JSONSchema7Definition | null {
  const node = getNode(doc, id)
  return node ? projectNode(doc, node) : null
}

/** Replace the node with `id` from a JSON Schema subtree, keeping its id and its
 *  original key order (so e.g. a top-level edit doesn't move `$defs`). */
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

/** Unwrap an `anyOf:[X, {type:null}]` nullable node to its effective branch X
 *  (mirrors the editor's `getEffectiveNode`). Returns the node itself otherwise. */
export function getEffectiveDocNode(node: DocumentNode): DocumentNode {
  if (node.anyOf) {
    const nonNull = node.anyOf.find((b) => b.type !== "null" || b.ref)
    if (nonNull) return nonNull
  }
  return node
}

/** Property edge id of an object's child property `key` (through the effective branch). */
export function getChildPropertyId(
  doc: SchemaDocument,
  parentId: string,
  key: string
): string | undefined {
  const parent = getNode(doc, parentId)
  if (!parent) return undefined
  return getEffectiveDocNode(parent).properties?.find((entry) => entry.key === key)?.id
}

/** Document id of an object's child property `key` (through the effective branch). */
export function getChildNodeId(
  doc: SchemaDocument,
  parentId: string,
  key: string
): string | undefined {
  const parent = getNode(doc, parentId)
  if (!parent) return undefined
  return getEffectiveDocNode(parent).properties?.find((e) => e.key === key)?.node
    .id
}

/** Document id of an array's items node (through the effective branch). */
export function getItemsNodeId(
  doc: SchemaDocument,
  parentId: string
): string | undefined {
  const parent = getNode(doc, parentId)
  if (!parent) return undefined
  return getEffectiveDocNode(parent).items?.id
}

/** Read a node's JSON, transform it with a JSON→JSON function, splice it back. */
export function updateNodeJson(
  doc: SchemaDocument,
  id: string,
  transform: (json: JSONSchema7Definition) => JSONSchema7Definition
): SchemaDocument {
  const json = getNodeJson(doc, id)
  if (json === null) return doc
  return replaceNodeJson(doc, id, transform(json))
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
// Property (object child) operations — addressed by the property edge id
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

/** Find the parent object id + index of the property edge. */
export function findOwningProperty(
  doc: SchemaDocument,
  propertyId: string
): { parentId: string; index: number } | null {
  let result: { parentId: string; index: number } | null = null
  const visit = (node: DocumentNode) => {
    if (result) return
    if (node.properties) {
      const index = node.properties.findIndex((p) => p.id === propertyId)
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
    id: init.id ?? createId("prop"),
    key: init.key ?? "",
    required: init.required ?? false,
    node: init.node ?? createNode("string"),
  }
  return updateObjectProperties(doc, parentId, (props) => [...props, entry])
}

export function removeProperty(
  doc: SchemaDocument,
  propertyId: string
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId)
  if (!owner) return doc
  return updateObjectProperties(doc, owner.parentId, (props) =>
    props.filter((p) => p.id !== propertyId)
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
  return updateObjectProperties(doc, owner.parentId, (props) =>
    mapPreserve(props, (entry) => (entry.id === propertyId ? fn(entry) : entry))
  )
}

/**
 * Move a property to a target object at a target index (reorder or reparent).
 * Refuses to drop a node into its own subtree.
 */
export function moveProperty(
  doc: SchemaDocument,
  propertyId: string,
  targetParentId: string,
  index: number
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId)
  if (!owner) return doc
  const moved = getOwningEntry(doc, propertyId)
  if (!moved) return doc

  const childId = moved.node.id
  if (isAncestor(doc, childId, targetParentId)) return doc

  // Detach from the source.
  let next = updateObjectProperties(doc, owner.parentId, (props) =>
    props.filter((p) => p.id !== propertyId)
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
  propertyId: string
): PropertyEntry | null {
  const owner = findOwningProperty(doc, propertyId)
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

export type SchemaEditorType =
  | JSONSchema7TypeName
  | "enum"
  | "date"
  | "time"
  | "datetime"

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
    rest: format
      ? { ...restWithoutFormat, format }
      : restWithoutFormat,
  }
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
    // Always uniquify — a duplicate def name would clobber on export.
    name: uniqueDefName(doc, init.name ?? "Definition"),
    node: init.node ?? createNode("object"),
  }
  return { doc: { ...doc, defs: [...doc.defs, entry] }, defId: entry.id }
}

export function renameDefinition(
  doc: SchemaDocument,
  defId: string,
  name: string
): SchemaDocument {
  // Uniquify against the OTHER definitions so a rename can't clobber one on
  // export (the bag is keyed by name). No ref rewriting needed — refs point at
  // `defId`, not the name.
  const taken = new Set(
    doc.defs.filter((d) => d.id !== defId).map((d) => d.name)
  )
  let finalName = name
  if (taken.has(finalName)) {
    let i = 2
    while (taken.has(`${name}${i}`)) i += 1
    finalName = `${name}${i}`
  }
  const defs = mapPreserve(doc.defs, (def) =>
    def.id === defId ? { ...def, name: finalName } : def
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

export function setRefByName(
  doc: SchemaDocument,
  id: string,
  name: string
): SchemaDocument {
  const definition = doc.defs.find((def) => def.name === name)
  return definition ? setRef(doc, id, definition.id) : doc
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

function updateEffectiveNodeShape(
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

function uniqueDefName(doc: SchemaDocument, base: string): string {
  const taken = new Set(doc.defs.map((d) => d.name))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}${i}`)) i += 1
  return `${base}${i}`
}
