import { mapPreserve } from "@/components/schema-editor/document/array";
import { createId } from "@/components/schema-editor/document/id";
import {
  definitionRef,
  definitionRefAliases,
} from "@/components/schema-editor/document/json-pointer";
import { updateNode } from "@/components/schema-editor/document/node-update";
import {
  createNode,
  stripSchemaTypeSpecificRest,
  updateEffectiveNodeShape,
} from "@/components/schema-editor/document/type-operations";
import type {
  DefinitionEntry,
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

export function addDefinition(
  doc: SchemaDocument,
  init: Partial<DefinitionEntry> = {},
): { doc: SchemaDocument; defId: string } {
  const baseName = init.name?.trim() || "Definition";
  const entry: DefinitionEntry = {
    id: init.id ?? createId("def"),
    name: uniqueDefinitionName(doc, baseName),
    node: init.node ?? createNode("object"),
  };
  return { doc: { ...doc, defs: [...doc.defs, entry] }, defId: entry.id };
}

export function renameDefinition(
  doc: SchemaDocument,
  defId: string,
  name: string,
): SchemaDocument {
  const currentDefinition = doc.defs.find(
    (definition) => definition.id === defId,
  );
  if (!currentDefinition) return doc;

  const nextName = name.trim();
  if (!nextName) return doc;

  const taken = new Set(
    doc.defs
      .filter((definition) => definition.id !== defId)
      .map((definition) => definition.name),
  );
  let finalName = nextName;
  if (taken.has(finalName)) {
    let index = 2;
    while (taken.has(`${nextName}${index}`)) index += 1;
    finalName = `${nextName}${index}`;
  }
  const defs = mapPreserve(doc.defs, (definition) =>
    definition.id === defId ? { ...definition, name: finalName } : definition,
  );
  if (defs === doc.defs) return doc;

  return rewriteRawDefinitionRefs(
    { ...doc, defs },
    currentDefinition.name,
    finalName,
  );
}

export function removeDefinition(
  doc: SchemaDocument,
  defId: string,
): SchemaDocument {
  const defs = doc.defs.filter((definition) => definition.id !== defId);
  if (defs.length === doc.defs.length) return doc;
  return { ...doc, defs };
}

export function setRef(
  doc: SchemaDocument,
  id: string,
  defId: string,
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    if (isTypeArrayNullable(node)) {
      return {
        ...node,
        type: undefined,
        properties: undefined,
        items: undefined,
        enum: undefined,
        ref: undefined,
        rest: stripSchemaTypeSpecificRest(node.rest),
        order: undefined,
        anyOf: [createRefNode(defId), createNode("null")],
      };
    }

    return updateEffectiveNodeShape(node, (effective) => ({
      id: effective.id,
      ref: defId,
      title: effective.title,
      description: effective.description,
      rest: stripSchemaTypeSpecificRest(effective.rest),
      order: effective.order,
    }));
  });
}

export function setRefByName(
  doc: SchemaDocument,
  id: string,
  name: string,
): SchemaDocument {
  const definition = doc.defs.find((def) => def.name === name);
  return definition ? setRef(doc, id, definition.id) : doc;
}

function uniqueDefinitionName(doc: SchemaDocument, base: string): string {
  const taken = new Set(doc.defs.map((definition) => definition.name));
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}

function isTypeArrayNullable(node: DocumentNode): boolean {
  return Array.isArray(node.type) && node.type.includes("null");
}

function createRefNode(defId: string): DocumentNode {
  return {
    id: createId(),
    ref: defId,
    rest: {},
  };
}

function rewriteRawDefinitionRefs(
  doc: SchemaDocument,
  oldName: string,
  newName: string,
): SchemaDocument {
  if (oldName === newName) return doc;

  const refs = getRewriteRefOptions(doc);
  const root = rewriteRawDefinitionRefsInNode(doc.root, oldName, newName, refs);
  const defs = mapPreserve(doc.defs, (definition) => {
    const node = rewriteRawDefinitionRefsInNode(
      definition.node,
      oldName,
      newName,
      refs,
    );
    return node === definition.node ? definition : { ...definition, node };
  });

  if (root === doc.root && defs === doc.defs) return doc;
  return { ...doc, root, defs };
}

function rewriteRawDefinitionRefsInNode(
  node: DocumentNode,
  oldName: string,
  newName: string,
  refs: RewriteRefOptions,
): DocumentNode {
  let next = node;

  const rest = rewriteRawDefinitionRefsInRest(
    node.rest,
    oldName,
    newName,
    refs,
  );
  if (rest !== node.rest) next = { ...next, rest };

  if (node.properties) {
    const properties = mapPreserve(node.properties, (property) => {
      const child = rewriteRawDefinitionRefsInNode(
        property.node,
        oldName,
        newName,
        refs,
      );
      return child === property.node ? property : { ...property, node: child };
    });
    if (properties !== node.properties) next = { ...next, properties };
  }

  if (node.items) {
    const items = rewriteRawDefinitionRefsInNode(
      node.items,
      oldName,
      newName,
      refs,
    );
    if (items !== node.items) next = { ...next, items };
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const children = node[key];
    if (!children) continue;
    const mapped = mapPreserve(children, (child) =>
      rewriteRawDefinitionRefsInNode(child, oldName, newName, refs),
    );
    if (mapped !== children) next = { ...next, [key]: mapped };
  }

  return next;
}

function rewriteRawDefinitionRefsInRest(
  rest: Record<string, unknown>,
  oldName: string,
  newName: string,
  refs: RewriteRefOptions,
): Record<string, unknown> {
  let next = rest;

  for (const [key, value] of Object.entries(rest)) {
    const rewritten = SCHEMA_MAP_REST_KEYS.has(key)
      ? rewriteRefsInSchemaMap(value, oldName, newName, refs)
      : SCHEMA_VALUE_REST_KEYS.has(key)
        ? rewriteRefsInSchemaValue(value, oldName, newName, refs)
        : value;

    if (rewritten !== value) {
      if (next === rest) next = { ...rest };
      setRecordValue(next, key, rewritten);
    }
  }

  return next;
}

function rewriteRefsInSchemaMap(
  value: unknown,
  oldName: string,
  newName: string,
  refs: RewriteRefOptions,
): unknown {
  if (!isPlainObject(value)) return value;

  let next: Record<string, unknown> = value;
  for (const [key, child] of Object.entries(value)) {
    const rewritten = rewriteRefsInSchemaValue(child, oldName, newName, refs);
    if (rewritten !== child) {
      if (next === value) next = { ...value };
      setRecordValue(next, key, rewritten);
    }
  }
  return next;
}

function rewriteRefsInSchemaValue(
  value: unknown,
  oldName: string,
  newName: string,
  refs: RewriteRefOptions,
): unknown {
  if (Array.isArray(value)) {
    return mapPreserve(value, (child) =>
      rewriteRefsInSchemaValue(child, oldName, newName, refs),
    );
  }
  if (!isPlainObject(value)) return value;

  let next: Record<string, unknown> = value;
  const rewrittenRef = rewriteDefinitionRef(value.$ref, oldName, newName, refs);
  if (rewrittenRef !== value.$ref) {
    next = { ...value, $ref: rewrittenRef };
  }

  for (const [key, child] of Object.entries(next)) {
    let rewritten = child;
    if (SCHEMA_MAP_REST_KEYS.has(key)) {
      rewritten = rewriteRefsInSchemaMap(child, oldName, newName, refs);
    } else if (SCHEMA_VALUE_REST_KEYS.has(key)) {
      rewritten = rewriteRefsInSchemaValue(child, oldName, newName, refs);
    }

    if (rewritten !== child) {
      if (next === value) next = { ...value };
      setRecordValue(next, key, rewritten);
    }
  }

  return next;
}

function rewriteDefinitionRef(
  value: unknown,
  oldName: string,
  newName: string,
  refs: RewriteRefOptions,
): unknown {
  if (
    definitionRefAliases(refs.primaryKeyword, oldName).includes(value as string)
  )
    return definitionRef(refs.primaryKeyword, newName);
  if (
    refs.allowOtherKeywordAlias &&
    definitionRefAliases(refs.otherKeyword, oldName).includes(value as string)
  )
    return definitionRef(refs.otherKeyword, newName);
  return value;
}

interface RewriteRefOptions {
  primaryKeyword: "$defs" | "definitions";
  otherKeyword: "$defs" | "definitions";
  allowOtherKeywordAlias: boolean;
}

function getRewriteRefOptions(doc: SchemaDocument): RewriteRefOptions {
  const primaryKeyword =
    doc.rest.defsKeyword === "definitions" ? "definitions" : "$defs";
  const otherKeyword = primaryKeyword === "$defs" ? "definitions" : "$defs";
  return {
    primaryKeyword,
    otherKeyword,
    allowOtherKeywordAlias: !Object.prototype.hasOwnProperty.call(
      doc.root.rest,
      otherKeyword,
    ),
  };
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
