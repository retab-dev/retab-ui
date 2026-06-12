import type { JSONSchema7Definition } from "json-schema"

import {
  nodeFromJson,
  projectNode,
} from "@/components/schema-editor/document/convert"
import { updateNode } from "@/components/schema-editor/document/node-update"
import { getNode } from "@/components/schema-editor/document/traversal"
import type { SchemaDocument } from "@/components/schema-editor/document/types"

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
