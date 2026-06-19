import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

import { createId } from "./id";
import {
  definitionRefAliases,
  definitionRef,
  type DefinitionsKeyword,
} from "./json-pointer";
import type {
  DefinitionEntry,
  DocumentNode,
  EnumValue,
  JsonValue,
  PropertyEntry,
  SchemaDocument,
} from "./types";

/**
 * Boundary conversions between vanilla JSON Schema (the wire format) and the
 * editor Document (the in-memory source of truth).
 *
 *  - `fromJsonSchema` is TOTAL: it mints fresh ids, distributes `required`, and
 *    carries every unmodeled keyword into `rest`. Run it ONCE when a new external
 *    schema arrives — not on every render.
 *  - `toJsonSchema` is a PURE PROJECTION: it rebuilds `required[]`, re-projects
 *    `$ref` from the target definition's current name, and drops transient-invalid
 *    artifacts (empty/duplicate property keys). Run it on demand for
 *    `onSchemaChange` and the JSON preview.
 *
 * Together they round-trip losslessly for everything the editor surfaces, and
 * carry everything it doesn't.
 */

/** Keys consumed structurally by a node; everything else falls into `rest`. */
const MODELED_NODE_KEYS = new Set<string>([
  "type",
  "title",
  "description",
  "properties",
  "required",
  "items",
  "enum",
  "$ref",
  "anyOf",
  "oneOf",
  "allOf",
]);

type RefMap = Map<string, string>; // json-pointer string -> definition NodeId
type CreateDocumentId = (prefix?: string) => string;

// ---------------------------------------------------------------------------
// Import: JSON Schema -> Document
// ---------------------------------------------------------------------------

export function fromJsonSchema(schema: JSONSchema7): SchemaDocument {
  const createImportId = createDeterministicImportIdFactory();
  const hasDefsKeyword = schema.$defs !== undefined;
  const hasDefinitionsKeyword = schema.definitions !== undefined;
  const defsKeyword = schema.$defs
    ? "$defs"
    : schema.definitions
      ? "definitions"
      : "$defs";
  const rawDefs = (schema.$defs ?? schema.definitions ?? {}) as Record<
    string,
    JSONSchema7Definition
  >;

  // First pass: give every top-level definition an id so refs can resolve to it.
  const defEntries: DefinitionEntry[] = Object.keys(rawDefs).map((name) => ({
    id: createImportId("def"),
    name,
    node: { id: createImportId(), rest: {} }, // placeholder, filled in second pass
  }));
  const refMap: RefMap = new Map();
  for (const def of defEntries) {
    addDefinitionRefMapEntries(refMap, def, {
      defsKeyword,
      hasOtherDefsKeyword:
        defsKeyword === "$defs" ? hasDefinitionsKeyword : hasDefsKeyword,
    });
  }

  // Second pass: build each definition's node now that the ref map exists.
  for (const def of defEntries) {
    def.node = nodeFromSchema(rawDefs[def.name], refMap, {
      createDocumentId: createImportId,
    });
  }

  // Strip only the PRIMARY defs keyword from the root; if the (unusual) other
  // keyword is also present, it's carried verbatim in `rest` so it isn't lost.
  const root = nodeFromSchema(schema, refMap, {
    stripKeyword: defsKeyword,
    createDocumentId: createImportId,
  });

  return {
    root,
    defs: defEntries,
    rest: { defsKeyword },
  };
}

function nodeFromSchema(
  schema: JSONSchema7Definition,
  refMap: RefMap,
  options: {
    createDocumentId?: CreateDocumentId;
    stripKeyword?: string;
  } = {},
): DocumentNode {
  const createDocumentId = options.createDocumentId ?? createId;

  // A boolean schema (`true` / `false`) has no structure to model — preserve it.
  if (typeof schema === "boolean") {
    return { id: createDocumentId(), rest: {}, booleanSchema: schema };
  }

  const node: DocumentNode = { id: createDocumentId(), rest: {} };

  // Record the source key order so the projection can replay it exactly,
  // keeping round-trips byte-faithful (no $defs/keyword reshuffling on edit).
  node.order = Object.keys(schema);

  if (typeof schema.$ref === "string") {
    const defId = refMap.get(schema.$ref);
    if (defId) node.ref = defId;
    else {
      // unresolved pointer — keep verbatim
      setRecordValue(node.rest, "$ref", schema.$ref);
    }
  }

  if (schema.type !== undefined) node.type = schema.type;
  if (schema.title !== undefined) node.title = schema.title;
  if (schema.description !== undefined) node.description = schema.description;

  if (Array.isArray(schema.enum)) {
    node.enum = enumFromSchema(schema, createDocumentId);
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  if (required.length > 0 || node.order?.includes("required")) {
    node.requiredOrder = required;
  }

  if (schema.properties) {
    node.properties = Object.entries(schema.properties).map(
      ([key, child]): PropertyEntry => ({
        id: createDocumentId("prop"),
        key,
        required: required.includes(key),
        node: nodeFromSchema(child, refMap, { createDocumentId }),
      }),
    );
  }

  if (required.length > 0) {
    const propertyKeys = new Set(
      node.properties?.map((property) => property.key),
    );
    const extraRequired = required.filter((key) => !propertyKeys.has(key));
    if (extraRequired.length > 0) node.extraRequired = extraRequired;
  }

  if (schema.items !== undefined) {
    if (Array.isArray(schema.items)) {
      // Tuple `items` (array form) is rare and not UI-editable; carry it
      // verbatim in `rest` so it survives the round-trip losslessly.
      setRecordValue(node.rest, "items", schema.items);
    } else {
      node.items = nodeFromSchema(schema.items, refMap, { createDocumentId });
    }
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const value = schema[key];
    if (Array.isArray(value)) {
      node[key] = value.map((sub) =>
        nodeFromSchema(sub, refMap, { createDocumentId }),
      );
    }
  }

  // Carry every keyword we don't model.
  for (const [key, value] of Object.entries(schema)) {
    if (MODELED_NODE_KEYS.has(key)) continue;
    if (options.stripKeyword && key === options.stripKeyword) continue;
    setRecordValue(node.rest, key, value);
  }

  return node;
}

function enumFromSchema(
  schema: JSONSchema7,
  createDocumentId: CreateDocumentId = createId,
): EnumValue[] {
  return (schema.enum ?? []).map(
    (value): EnumValue => ({
      id: createDocumentId("enum"),
      value: value as JsonValue,
    }),
  );
}

function createDeterministicImportIdFactory(): CreateDocumentId {
  let nextId = 0;
  return (prefix = "node") => {
    nextId += 1;
    return `${prefix}-import-${nextId}`;
  };
}

// ---------------------------------------------------------------------------
// Export: Document -> JSON Schema
// ---------------------------------------------------------------------------

export function toJsonSchema(doc: SchemaDocument): JSONSchema7 {
  const defsKeyword =
    doc.rest.defsKeyword === "definitions" ? "definitions" : "$defs";
  const defNameById = new Map<string, string>();
  for (const def of doc.defs) defNameById.set(def.id, def.name);

  const out = nodeToSchema(doc.root, defNameById, defsKeyword) as JSONSchema7;

  if (doc.defs.length > 0) {
    const bag: Record<string, JSONSchema7Definition> = {};
    for (const def of doc.defs) {
      setRecordValue(
        bag,
        def.name,
        nodeToSchema(def.node, defNameById, defsKeyword),
      );
    }
    setRecordValue(out as Record<string, unknown>, defsKeyword, bag);
  }

  // Replay the root key order (so $defs lands back where the source had it).
  return applyKeyOrder(
    out as Record<string, unknown>,
    doc.root.order,
  ) as JSONSchema7;
}

/**
 * Project a single node to JSON Schema (using the document's definition names for
 * any `$ref`s). The inverse of `nodeFromJson` — together they let a component read
 * and rewrite one node's JSON by id while the Document stays the source of truth.
 */
export function projectNode(
  doc: SchemaDocument,
  node: DocumentNode,
): JSONSchema7Definition {
  const defsKeyword =
    doc.rest.defsKeyword === "definitions" ? "definitions" : "$defs";
  const defNameById = new Map<string, string>();
  for (const def of doc.defs) defNameById.set(def.id, def.name);
  return nodeToSchema(node, defNameById, defsKeyword);
}

/** Convert a JSON Schema subtree into a Document node, resolving `$ref`s against
 *  the document's existing definitions (so refs survive the round-trip). */
export function nodeFromJson(
  schema: JSONSchema7Definition,
  doc: SchemaDocument,
): DocumentNode {
  const refMap: RefMap = new Map();
  const defsKeyword =
    doc.rest.defsKeyword === "definitions" ? "definitions" : "$defs";
  const otherDefsKeyword = defsKeyword === "$defs" ? "definitions" : "$defs";
  const hasOtherDefsKeyword = Object.prototype.hasOwnProperty.call(
    doc.root.rest,
    otherDefsKeyword,
  );
  for (const def of doc.defs) {
    addDefinitionRefMapEntries(refMap, def, {
      defsKeyword,
      hasOtherDefsKeyword,
    });
  }
  // Strip the document's primary defs keyword — definitions live at the document
  // level, not on a node; this keeps a root-level edit (whose JSON still carries
  // `$defs`) from duplicating them into the root node's `rest`.
  return nodeFromSchema(schema, refMap, { stripKeyword: defsKeyword });
}

function addDefinitionRefMapEntries(
  refMap: RefMap,
  def: DefinitionEntry,
  options: {
    defsKeyword: "$defs" | "definitions";
    hasOtherDefsKeyword: boolean;
  },
) {
  for (const ref of definitionRefAliases(options.defsKeyword, def.name)) {
    refMap.set(ref, def.id);
  }
  if (!options.hasOtherDefsKeyword) {
    const otherKeyword =
      options.defsKeyword === "$defs" ? "definitions" : "$defs";
    for (const ref of definitionRefAliases(otherKeyword, def.name)) {
      refMap.set(ref, def.id);
    }
  }
}

function nodeToSchema(
  node: DocumentNode,
  defNameById: Map<string, string>,
  defsKeyword: DefinitionsKeyword,
): JSONSchema7Definition {
  if (node.booleanSchema !== undefined) {
    return node.booleanSchema;
  }

  // Emit modeled keys first in a natural reading order ($ref, type, title, …),
  // then any unmodeled keywords. Export is a projection, so it normalizes key
  // order the way a formatter would — semantics are preserved, not byte layout.
  const out: Record<string, unknown> = {};

  if (node.ref) {
    const name = defNameById.get(node.ref);
    if (name) setRecordValue(out, "$ref", definitionRef(defsKeyword, name));
  }

  if (node.type !== undefined) setRecordValue(out, "type", node.type);
  if (node.title !== undefined) setRecordValue(out, "title", node.title);
  if (node.description !== undefined)
    setRecordValue(out, "description", node.description);

  if (node.enum) {
    setRecordValue(
      out,
      "enum",
      node.enum.map((entry) => entry.value),
    );
  }

  if (node.properties) {
    const properties: Record<string, JSONSchema7Definition> = {};
    const required: string[] = [];
    const seen = new Set<string>();
    for (const entry of node.properties) {
      const key = entry.key;
      // Transient-invalid states live in the Document, not the projection:
      // drop empty and duplicate keys at the boundary.
      if ((entry.isTransient && !key) || seen.has(key)) continue;
      seen.add(key);
      setRecordValue(
        properties,
        key,
        nodeToSchema(entry.node, defNameById, defsKeyword),
      );
      if (entry.required) required.push(key);
    }
    setRecordValue(out, "properties", properties);
    // Emit `required` when it has entries, or when the source had an explicit
    // (possibly empty) `required` key — so `required: []` round-trips faithfully.
    const hadRequiredKey = node.order?.includes("required") ?? false;
    const projectedRequired = orderRequiredNames(
      [...(node.extraRequired ?? []), ...required],
      node.requiredOrder,
    );
    if (projectedRequired.length > 0 || hadRequiredKey) {
      setRecordValue(out, "required", projectedRequired);
    }
  } else if (node.extraRequired?.length) {
    setRecordValue(
      out,
      "required",
      orderRequiredNames(node.extraRequired, node.requiredOrder),
    );
  }

  if (node.items) {
    setRecordValue(
      out,
      "items",
      nodeToSchema(node.items, defNameById, defsKeyword),
    );
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const value = node[key];
    if (value) {
      setRecordValue(
        out,
        key,
        value.map((sub) => nodeToSchema(sub, defNameById, defsKeyword)),
      );
    }
  }

  // Trailing unmodeled keywords (const, default, format, pattern, x-*, …).
  for (const [key, value] of Object.entries(node.rest)) {
    if (hasOwn(out, key)) continue; // modeled field already won this key
    setRecordValue(out, key, value);
  }

  return applyKeyOrder(out, node.order) as JSONSchema7;
}

/**
 * Reorder an object's keys to match a recorded source order. Keys present in
 * `order` come first (in that order); any keys not in it (newly added by edits)
 * are appended in their current order. Returns a new object.
 */
function applyKeyOrder(
  obj: Record<string, unknown>,
  order: unknown,
): Record<string, unknown> {
  if (!Array.isArray(order)) return obj;
  const result: Record<string, unknown> = {};
  for (const key of order as string[]) {
    if (hasOwn(obj, key)) setRecordValue(result, key, obj[key]);
  }
  for (const key of Object.keys(obj)) {
    if (!hasOwn(result, key)) setRecordValue(result, key, obj[key]);
  }
  return result;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function setRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function orderRequiredNames(names: string[], sourceOrder: unknown): string[] {
  const uniqueNames = [...new Set(names)];
  if (!Array.isArray(sourceOrder)) return uniqueNames;

  const remaining = new Set(uniqueNames);
  const ordered: string[] = [];
  for (const name of sourceOrder) {
    if (typeof name !== "string" || !remaining.has(name)) continue;
    ordered.push(name);
    remaining.delete(name);
  }
  ordered.push(...remaining);
  return ordered;
}
