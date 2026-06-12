import { nodeFromJson } from "@/components/schema-editor/document/convert"
import {
  addDefinition,
  setRef,
} from "@/components/schema-editor/document/definition-operations"
import type { SchemaDocument } from "@/components/schema-editor/document/types"

import {
  objectTemplateDependencies,
  templateObjects,
} from "./template-objects"

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

  // Dependencies must be added BEFORE the template that references them, so
  // `nodeFromJson` can resolve the template's `$ref`s to a real definition id.
  // Otherwise the reference is kept as a raw, unlinked `$ref` in `rest` and the
  // field renders as "any" in the editor (the exported JSON stays correct, but
  // the in-editor model is broken).
  const defsToAdd = [
    ...(objectTemplateDependencies[templateName] ?? []),
    templateName,
  ]

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
