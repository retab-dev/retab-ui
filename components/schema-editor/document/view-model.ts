import type { JSONSchema7Definition } from "json-schema";

import { projectNode } from "@/components/schema-editor/document/convert";
import {
  getEffectiveKind,
  isNullable,
  resolveRef,
} from "@/components/schema-editor/document/derive";
import type { SchemaEditorType } from "@/components/schema-editor/document/type-operations";
import type {
  DocumentNode,
  EnumValue,
  PropertyEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types";

export interface DocumentDefinitionView {
  definitionId: string;
  definitionName: string;
  schema: JSONSchema7Definition;
}

export interface DocumentPropertyView {
  propertyId: string;
  propertyName: string;
  isRequired: boolean;
  nodeView: DocumentNodeView;
}

export interface DocumentNodeView {
  nodeId: string;
  docNode: DocumentNode;
  effectiveNode: DocumentNode;
  type: SchemaEditorType | "$ref" | "any" | "union" | "null";
  title?: string;
  description?: string;
  refName?: string;
  isNullable: boolean;
  properties: DocumentPropertyView[];
  items?: DocumentNodeView;
  enumEntries: EnumValue[];
}

export interface SchemaDocumentView {
  root: DocumentNodeView;
  definitions: DocumentDefinitionView[];
}

export function getSchemaDocumentView(doc: SchemaDocument): SchemaDocumentView {
  return {
    root: getDocumentNodeView(doc, doc.root),
    definitions: doc.defs.map((definition) => ({
      definitionId: definition.id,
      definitionName: definition.name,
      schema: projectNode(doc, definition.node),
    })),
  };
}

export function getDocumentNodeView(
  doc: SchemaDocument,
  node: DocumentNode,
): DocumentNodeView {
  const effectiveNode = getViewEffectiveNode(node);
  return {
    nodeId: node.id,
    docNode: node,
    effectiveNode,
    type: getDocumentEditorType(doc, effectiveNode),
    title: node.title,
    description: node.description,
    refName: resolveRef(doc, effectiveNode)?.name,
    isNullable: isNullable(node),
    properties: (effectiveNode.properties ?? []).map((property) =>
      getDocumentPropertyView(doc, property),
    ),
    items: effectiveNode.items
      ? getDocumentNodeView(doc, effectiveNode.items)
      : undefined,
    enumEntries: effectiveNode.enum ?? [],
  };
}

function getDocumentPropertyView(
  doc: SchemaDocument,
  property: PropertyEntry,
): DocumentPropertyView {
  return {
    propertyId: property.id,
    propertyName: property.key,
    isRequired: property.required,
    nodeView: getDocumentNodeView(doc, property.node),
  };
}

function getViewEffectiveNode(node: DocumentNode): DocumentNode {
  if (node.anyOf) {
    return (
      node.anyOf.find((branch) => branch.type !== "null" || branch.ref) ?? node
    );
  }
  return node;
}

function getDocumentEditorType(
  doc: SchemaDocument,
  node: DocumentNode,
): DocumentNodeView["type"] {
  if (node.ref) return "$ref";
  if (node.enum) return "enum";

  const kind = getEffectiveKind(node);
  if (kind === "ref") return "$ref";
  if (kind !== "string") return kind;

  const format = node.rest.format;
  if (format === "date") return "date";
  if (format === "time") return "time";
  if (format === "date-time") return "datetime";

  return resolveRef(doc, node) ? "$ref" : "string";
}
