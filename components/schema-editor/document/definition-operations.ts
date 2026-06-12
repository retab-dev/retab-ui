import { mapPreserve } from "@/components/schema-editor/document/array"
import { createId } from "@/components/schema-editor/document/id"
import { updateNode } from "@/components/schema-editor/document/node-update"
import { createNode } from "@/components/schema-editor/document/type-operations"
import type {
  DefinitionEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

export function addDefinition(
  doc: SchemaDocument,
  init: Partial<DefinitionEntry> = {}
): { doc: SchemaDocument; defId: string } {
  const entry: DefinitionEntry = {
    id: init.id ?? createId("def"),
    name: uniqueDefinitionName(doc, init.name ?? "Definition"),
    node: init.node ?? createNode("object"),
  }
  return { doc: { ...doc, defs: [...doc.defs, entry] }, defId: entry.id }
}

export function renameDefinition(
  doc: SchemaDocument,
  defId: string,
  name: string
): SchemaDocument {
  const taken = new Set(
    doc.defs
      .filter((definition) => definition.id !== defId)
      .map((definition) => definition.name)
  )
  let finalName = name
  if (taken.has(finalName)) {
    let index = 2
    while (taken.has(`${name}${index}`)) index += 1
    finalName = `${name}${index}`
  }
  const defs = mapPreserve(doc.defs, (definition) =>
    definition.id === defId ? { ...definition, name: finalName } : definition
  )
  return defs === doc.defs ? doc : { ...doc, defs }
}

export function removeDefinition(
  doc: SchemaDocument,
  defId: string
): SchemaDocument {
  const defs = doc.defs.filter((definition) => definition.id !== defId)
  if (defs.length === doc.defs.length) return doc
  return { ...doc, defs }
}

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

function uniqueDefinitionName(doc: SchemaDocument, base: string): string {
  const taken = new Set(doc.defs.map((definition) => definition.name))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base}${index}`)) index += 1
  return `${base}${index}`
}
