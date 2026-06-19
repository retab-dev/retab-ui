import { mapPreserve } from "@/components/schema-editor/document/array";
import { updateNode } from "@/components/schema-editor/document/node-update";
import type {
  DocumentNode,
  SchemaDocument,
} from "@/components/schema-editor/document/types";

const SCHEMA_VALUE_REST_KEYS = new Set([
  "additionalItems",
  "additionalProperties",
  "allOf",
  "anyOf",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "oneOf",
  "prefixItems",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
]);

const SCHEMA_MAP_REST_KEYS = new Set([
  "$defs",
  "definitions",
  "dependentSchemas",
  "dependencies",
  "patternProperties",
  "properties",
]);

export function setNodeDescription(
  doc: SchemaDocument,
  id: string,
  description: string | undefined,
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    const nextDescription = description?.trim() ? description : undefined;
    return node.description === nextDescription
      ? node
      : { ...node, description: nextDescription };
  });
}

export function setNodeTitle(
  doc: SchemaDocument,
  id: string,
  title: string | undefined,
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    const nextTitle = title?.trim() ? title : undefined;
    return node.title === nextTitle ? node : { ...node, title: nextTitle };
  });
}

export function stripDescriptions(doc: SchemaDocument): SchemaDocument {
  const root = stripNodeDescription(doc.root);
  const defs = mapPreserve(doc.defs, (definition) => {
    const node = stripNodeDescription(definition.node);
    return node === definition.node ? definition : { ...definition, node };
  });
  if (root === doc.root && defs === doc.defs) return doc;
  return { ...doc, root, defs };
}

function stripNodeDescription(node: DocumentNode): DocumentNode {
  let next =
    node.description === undefined ? node : { ...node, description: undefined };

  if (next.properties) {
    const properties = mapPreserve(next.properties, (property) => {
      const childNode = stripNodeDescription(property.node);
      return childNode === property.node
        ? property
        : { ...property, node: childNode };
    });
    if (properties !== next.properties) next = { ...next, properties };
  }

  const rest = stripRestDescriptionKeywords(next.rest);
  if (rest !== next.rest) next = { ...next, rest };

  if (next.items) {
    const items = stripNodeDescription(next.items);
    if (items !== next.items) next = { ...next, items };
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const children = next[key];
    if (!children) continue;
    const mapped = mapPreserve(children, stripNodeDescription);
    if (mapped !== children) next = { ...next, [key]: mapped };
  }

  return next;
}

function stripRestDescriptionKeywords(
  rest: Record<string, unknown>,
): Record<string, unknown> {
  let next = rest;

  for (const [key, value] of Object.entries(rest)) {
    const stripped = SCHEMA_MAP_REST_KEYS.has(key)
      ? stripSchemaMapDescriptions(value)
      : SCHEMA_VALUE_REST_KEYS.has(key)
        ? stripSchemaDescription(value)
        : value;

    if (stripped !== value) {
      if (next === rest) next = { ...rest };
      setRecordValue(next, key, stripped);
    }
  }

  return next;
}

function stripSchemaMapDescriptions(value: unknown): unknown {
  if (!isPlainObject(value)) return value;

  let next: Record<string, unknown> = value;
  for (const [key, child] of Object.entries(value)) {
    const stripped = stripSchemaDescription(child);
    if (stripped !== child) {
      if (next === value) next = { ...value };
      setRecordValue(next, key, stripped);
    }
  }

  return next;
}

function stripSchemaDescription(value: unknown): unknown {
  if (Array.isArray(value)) {
    return mapPreserve(value, stripSchemaDescription);
  }
  if (!isPlainObject(value)) return value;

  let next: Record<string, unknown> = value;
  if (Object.prototype.hasOwnProperty.call(value, "description")) {
    const { description: _description, ...rest } = value;
    next = rest;
  }

  for (const [key, child] of Object.entries(next)) {
    let stripped = child;
    if (SCHEMA_MAP_REST_KEYS.has(key)) {
      stripped = stripSchemaMapDescriptions(child);
    } else if (SCHEMA_VALUE_REST_KEYS.has(key)) {
      stripped = stripSchemaDescription(child);
    }

    if (stripped !== child) {
      if (next === value) next = { ...value };
      setRecordValue(next, key, stripped);
    }
  }

  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}
