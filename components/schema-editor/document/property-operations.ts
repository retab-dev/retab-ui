import { mapPreserve } from "@/components/schema-editor/document/array";
import { createId } from "@/components/schema-editor/document/id";
import {
  getEffectiveDocNode,
  getOwnProperty,
} from "@/components/schema-editor/document/node-selectors";
import { updateNode } from "@/components/schema-editor/document/node-update";
import {
  childNodes,
  getNode,
} from "@/components/schema-editor/document/traversal";
import { createNode } from "@/components/schema-editor/document/type-operations";
import type {
  DocumentNode,
  PropertyEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types";

function updateObjectProperties(
  doc: SchemaDocument,
  parentId: string,
  fn: (properties: PropertyEntry[]) => PropertyEntry[],
): SchemaDocument {
  return updateNode(doc, parentId, (node) => {
    if (isSingleNullableBranchContainer(node)) {
      const branch = getEffectiveDocNode(node);
      if (branch.type !== "object" && !branch.properties) return node;
      return {
        ...node,
        anyOf: node.anyOf!.map((child) =>
          child.id === branch.id
            ? updateNodeProperties(child, fn(child.properties ?? []))
            : child,
        ),
      };
    }

    if (node.type !== "object" && !node.properties) return node;
    return updateNodeProperties(node, fn(node.properties ?? []));
  });
}

function updateNodeProperties(
  node: DocumentNode,
  properties: PropertyEntry[],
): DocumentNode {
  return {
    ...node,
    properties,
    requiredOrder: getRequiredOrder(node, properties),
  };
}

function getRequiredOrder(
  node: DocumentNode,
  properties: PropertyEntry[],
): string[] | undefined {
  const requiredProperties = properties
    .filter((property) => property.required && isProjectableProperty(property))
    .map((property) => property.key);
  const extraRequired = node.extraRequired ?? [];

  if (requiredProperties.length === 0 && extraRequired.length === 0) {
    return node.requiredOrder?.length ? [] : undefined;
  }

  const orderedExtraRequired = node.requiredOrder
    ? node.requiredOrder.filter((name) => extraRequired.includes(name))
    : extraRequired;

  return [...orderedExtraRequired, ...requiredProperties];
}

export function findOwningProperty(
  doc: SchemaDocument,
  propertyId: string,
): { parentId: string; index: number } | null {
  let result: { parentId: string; index: number } | null = null;
  const visit = (node: DocumentNode) => {
    if (result) return;
    if (node.properties) {
      const index = node.properties.findIndex(
        (property) => property.id === propertyId,
      );
      if (index >= 0) {
        result = { parentId: node.id, index };
        return;
      }
    }
    for (const child of childNodes(node)) visit(child);
  };
  visit(doc.root);
  for (const definition of doc.defs) visit(definition.node);
  return result;
}

export function addProperty(
  doc: SchemaDocument,
  parentId: string,
  init: Partial<PropertyEntry> = {},
): SchemaDocument {
  const entry: PropertyEntry = {
    id: init.id ?? createId("prop"),
    key: init.key ?? "",
    isTransient: init.isTransient ?? (init.key ? undefined : true),
    required: init.required ?? false,
    node: init.node ?? createNode("string"),
  };
  return updateObjectProperties(doc, parentId, (properties) => [
    ...properties,
    entry,
  ]);
}

export function removeProperty(
  doc: SchemaDocument,
  propertyId: string,
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId);
  if (!owner) return doc;
  return updateObjectProperties(doc, owner.parentId, (properties) =>
    properties.filter((property) => property.id !== propertyId),
  );
}

export function renameProperty(
  doc: SchemaDocument,
  propertyId: string,
  key: string,
): SchemaDocument {
  return updateOwningEntry(doc, propertyId, (entry) =>
    entry.key === key
      ? entry
      : { ...entry, key, isTransient: key === "" ? true : undefined },
  );
}

export function setRequired(
  doc: SchemaDocument,
  propertyId: string,
  required: boolean,
): SchemaDocument {
  return updateOwningEntry(doc, propertyId, (entry) =>
    entry.required === required ? entry : { ...entry, required },
  );
}

function updateOwningEntry(
  doc: SchemaDocument,
  propertyId: string,
  fn: (entry: PropertyEntry) => PropertyEntry,
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId);
  if (!owner) return doc;
  return updateObjectProperties(doc, owner.parentId, (properties) =>
    mapPreserve(properties, (entry) =>
      entry.id === propertyId ? fn(entry) : entry,
    ),
  );
}

export function moveProperty(
  doc: SchemaDocument,
  propertyId: string,
  targetParentId: string,
  index: number,
): SchemaDocument {
  const owner = findOwningProperty(doc, propertyId);
  if (!owner) return doc;
  const moved = getOwnProperty(doc, owner.parentId, owner.index);
  if (!moved) return doc;
  const targetParent = getNode(doc, targetParentId);
  if (!targetParent) return doc;
  const targetEffectiveParent = getEffectiveDocNode(targetParent);
  if (
    targetEffectiveParent.type !== "object" &&
    !targetEffectiveParent.properties
  )
    return doc;

  if (isAncestor(doc, moved.node.id, targetParentId)) return doc;

  let next = updateObjectProperties(doc, owner.parentId, (properties) =>
    properties.filter((property) => property.id !== propertyId),
  );
  next = updateObjectProperties(next, targetParentId, (properties) => {
    const clamped = Math.max(0, Math.min(index, properties.length));
    const out = properties.slice();
    out.splice(clamped, 0, moved);
    return out;
  });
  return next;
}

function isSingleNullableBranchContainer(node: DocumentNode): boolean {
  if (!node.anyOf) return false;
  const nonNullBranches = node.anyOf.filter(
    (branch) => branch.type !== "null" || branch.ref,
  );
  return (
    nonNullBranches.length === 1 &&
    node.anyOf.length === 2 &&
    node.anyOf.some((branch) => branch.type === "null" && !branch.ref)
  );
}

function isProjectableProperty(property: PropertyEntry): boolean {
  return property.key !== "" || !property.isTransient;
}

function isAncestor(
  doc: SchemaDocument,
  nodeId: string,
  maybeDescendantId: string,
): boolean {
  const node = getNode(doc, nodeId);
  if (!node) return false;
  if (node.id === maybeDescendantId) return true;
  return childNodes(node).some((child) =>
    isAncestor(doc, child.id, maybeDescendantId),
  );
}
