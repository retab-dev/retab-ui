import { nodeFromJson } from "@/components/schema-editor/document/convert"
import {
  addDefinition,
  setRef,
} from "@/components/schema-editor/document/definition-operations"
import type { SchemaDocument } from "@/components/schema-editor/document/types"

import { templateObjects } from "./template-objects"

export function applyObjectTemplateReferenceToDocument(
  doc: SchemaDocument,
  nodeId: string,
  templateName: string
): SchemaDocument {
  const next = addObjectTemplateDefinitionsToDocument(doc, templateName)
  const targetDefinition = next.defs.find(
    (definition) => definition.name === templateName
  )
  return targetDefinition ? setRef(next, nodeId, targetDefinition.id) : next
}

export function addObjectTemplateDefinitionsToDocument(
  doc: SchemaDocument,
  templateName: string
): SchemaDocument {
  const template = templateObjects[templateName]
  if (!template) return doc

  const defsToAdd = [templateName]
  if (template.deps) {
    defsToAdd.push(...template.deps)
  }

  let next = doc
  for (const defName of defsToAdd) {
    if (next.defs.some((definition) => definition.name === defName)) continue

    const templateNode = templateObjects[defName]
    if (!templateNode) continue

    next = addDefinition(next, {
      name: defName,
      node: nodeFromJson(templateNode, next),
    }).doc
  }

  return next
}
