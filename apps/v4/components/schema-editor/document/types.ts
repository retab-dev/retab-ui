import type { JSONSchema7TypeName } from "json-schema"

/**
 * Stable, intrinsic node identity.
 *
 * Born when a node is created, stable across renames / reorders / retypes, dies
 * with the node. NEVER derived from a mutable key or a positional path — that is
 * the whole reason this Document model exists instead of editing JSON Schema in
 * place.
 */
export type NodeId = string

/** A JSON Schema literal (enum entries, const, default, …). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * The editor's source of truth: a Document — a total, identity-bearing,
 * order-explicit representation of a JSON Schema.
 *
 * Design contract (see ./DESIGN.md):
 *
 *  1. Identity is intrinsic. Every node carries an `id` field; we never key a
 *     node by its property name or its path.
 *
 *  2. Order is explicit. Children JSON Schema keys by name (`properties`, `$defs`)
 *     are stored as ORDERED arrays of entries, so reordering is `arrayMove` and
 *     never depends on JS object key-order.
 *
 *  3. Losslessness by construction. Every keyword we don't model structurally is
 *     carried verbatim in `rest` and projected straight back out. Editing a node
 *     spreads it (`{ ...node, description }`), so unknown keywords ride along.
 *
 *  4. References are by id, not by name. A `$ref` resolves to a Definition's
 *     `id` on import, so renaming a definition can never break a reference; the
 *     `#/$defs/Name` pointer is re-projected from the def's current name on export.
 *
 *  5. The Document can hold transient-invalid states (empty/duplicate keys while
 *     typing). Cleanup (dropping empty keys, etc.) happens at the EXPORT boundary,
 *     never in the model — which is what lets the component be fully controlled.
 */
export interface DocumentNode {
  id: NodeId

  /**
   * Mirrors JSON Schema `type`. A single name is the common case; an array
   * encodes a type-union such as `["string", "null"]` (nullable). Absent = "any".
   */
  type?: JSONSchema7TypeName | JSONSchema7TypeName[]

  title?: string
  description?: string

  /** object: ordered, identity-bearing property entries. */
  properties?: PropertyEntry[]

  /** array: the item schema. (Tuple `items` arrays are carried in `rest` for v1.) */
  items?: DocumentNode

  /** enum: ordered, identity-bearing values. Base type comes from `type`. */
  enum?: EnumValue[]

  /** $ref: id of the Definition this node points at, resolved on import. */
  ref?: NodeId

  /** Composition keywords, recursively modeled. */
  anyOf?: DocumentNode[]
  oneOf?: DocumentNode[]
  allOf?: DocumentNode[]

  /**
   * Every keyword we don't model structurally — `const`, `default`, `format`,
   * `pattern`, `minLength`, `examples`, `additionalProperties`, `x-*`, … — kept
   * verbatim and projected straight back out. This is what makes the round-trip
   * lossless.
   */
  rest: Record<string, unknown>
}

/**
 * A named child of an object. The `key` is mutable and freely editable; the
 * `required` flag lives on the parent/child EDGE here (in JSON Schema it lives in
 * the parent's `required[]` array, which we distribute onto entries on import and
 * rebuild on export).
 */
export interface PropertyEntry {
  key: string
  required: boolean
  node: DocumentNode
}

/** A single enum option. `id` keeps the row stable while its value is edited. */
export interface EnumValue {
  id: NodeId
  value: JsonValue
  /** Optional per-value docs (projected to `x-enumDescriptions` on export). */
  description?: string
}

/** A named definition under `$defs`. `name` is mutable; references point at `id`. */
export interface DefinitionEntry {
  id: NodeId
  name: string
  node: DocumentNode
}

/** The whole editor document — the single source of truth held in one useState. */
export interface SchemaDocument {
  root: DocumentNode
  /** Named definitions ($defs / legacy definitions), ordered. */
  defs: DefinitionEntry[]
  /**
   * Document-level round-trip metadata we don't surface structurally — which defs
   * keyword the source used, top-level `$schema`/`$id`, etc. Carried verbatim.
   */
  rest: Record<string, unknown>
}

/**
 * The effective "kind" of a node for the UI. Derived (see ./derive.ts), never
 * stored — there is exactly one source of truth and this is a projection of it.
 */
export type SchemaKind =
  | JSONSchema7TypeName // string | number | integer | boolean | object | array | null
  | "enum"
  | "ref"
  | "union"
  | "any"
