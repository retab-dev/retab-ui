import {
  updateEffectiveNode,
  updateSchemaProperty,
} from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getPathValue(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (current, segment) => (isRecord(current) ? current[segment] : undefined),
    value
  )
}

function traverseSchemaProperty(
  schemaNode: ExtendedJSONSchema7,
  segment: string
): ExtendedJSONSchema7 {
  if (schemaNode.anyOf && Array.isArray(schemaNode.anyOf)) {
    return traverseSchemaProperty(getEffectiveNode(schemaNode), segment)
  }
  if (schemaNode.type === "object" && schemaNode.properties) {
    return schemaNode.properties[segment] as ExtendedJSONSchema7
  }
  if (schemaNode.type === "array" && schemaNode.items) {
    if (Array.isArray(schemaNode.items)) {
      return schemaNode.items[parseInt(segment)] as ExtendedJSONSchema7
    }
    if (segment === "*") {
      return schemaNode.items as ExtendedJSONSchema7
    }
  }
  throw new Error(`Invalid path segment "${segment}"`)
}

function assignSchemaProperty(
  schemaNode: ExtendedJSONSchema7,
  segment: string,
  nextValue: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  if (schemaNode.anyOf && Array.isArray(schemaNode.anyOf)) {
    const updatedEffectiveNode = assignSchemaProperty(
      getEffectiveNode(schemaNode),
      segment,
      nextValue
    )
    return updateEffectiveNode(schemaNode, updatedEffectiveNode)
  }
  if (schemaNode.type === "object" && schemaNode.properties) {
    return {
      ...schemaNode,
      properties: {
        ...schemaNode.properties,
        [segment]: nextValue,
      },
    }
  }
  if (schemaNode.type === "array" && schemaNode.items) {
    if (Array.isArray(schemaNode.items)) {
      return {
        ...schemaNode,
        items: schemaNode.items.map((item, index) =>
          index === parseInt(segment) ? nextValue : item
        ),
      }
    }
    if (segment === "*") {
      return {
        ...schemaNode,
        items: nextValue,
      }
    }
  }
  throw new Error(`Invalid path segment "${segment}"`)
}

function resolvePropertyPath(
  schemaNode: ExtendedJSONSchema7,
  path: string
): [string[], string[]] {
  let basePath: string[] = []
  let propertyPath: string[] = []
  let currentNode = schemaNode

  for (const segment of path.split(".")) {
    while (currentNode.$ref) {
      const refPath = currentNode.$ref.split("/")
      if (refPath.shift() !== "#") {
        throw new Error(`Invalid $ref "${currentNode.$ref}"`)
      }
      basePath = refPath
      propertyPath = []
      currentNode = getPathValue(schemaNode, refPath) as ExtendedJSONSchema7
    }

    if (currentNode.anyOf && Array.isArray(currentNode.anyOf)) {
      currentNode = getEffectiveNode(currentNode)
    }

    if (currentNode.type === "object" && currentNode.properties) {
      propertyPath.push(segment)
      currentNode = currentNode.properties[segment] as ExtendedJSONSchema7
    } else if (currentNode.type === "array" && currentNode.items) {
      if (Array.isArray(currentNode.items)) {
        propertyPath.push(segment)
        currentNode = currentNode.items[
          parseInt(segment)
        ] as ExtendedJSONSchema7
      } else if (segment === "*" || segment === parseInt(segment).toString()) {
        propertyPath.push("*")
        currentNode = currentNode.items as ExtendedJSONSchema7
      } else {
        throw new Error(`Invalid path segment "${segment}" for array type`)
      }
    }
  }

  return [basePath, propertyPath]
}

function updatePropertyAtPath(
  schemaNode: ExtendedJSONSchema7,
  propertyPath: string,
  updateProperty: (property: ExtendedJSONSchema7) => ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  const [basePath, resolvedPropertyPath] = resolvePropertyPath(
    schemaNode,
    propertyPath
  )

  function updateInNode(
    node: ExtendedJSONSchema7,
    segments: string[]
  ): ExtendedJSONSchema7 {
    if (segments.length === 0) return node
    const [segment, ...rest] = segments
    if (rest.length === 0) {
      return assignSchemaProperty(
        node,
        segment,
        updateProperty(traverseSchemaProperty(node, segment))
      )
    }
    return assignSchemaProperty(
      node,
      segment,
      updateInNode(traverseSchemaProperty(node, segment), rest)
    )
  }

  function updateInBase(
    node: ExtendedJSONSchema7,
    segments: string[]
  ): ExtendedJSONSchema7 {
    if (segments.length === 0) {
      const baseNode = getPathValue(schemaNode, basePath)
      return updateInNode(baseNode as ExtendedJSONSchema7, resolvedPropertyPath)
    }
    const [segment, ...rest] = segments
    return {
      ...node,
      [segment]: updateInBase(
        (isRecord(node) ? node[segment] : undefined) as ExtendedJSONSchema7,
        rest
      ),
    }
  }

  return updateInBase(schemaNode, basePath)
}

export function renamePropertyAtPath(
  schemaNode: ExtendedJSONSchema7,
  propertyPath: string,
  newPropertyName: string,
  updatedProperty?: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  const [basePath, resolvedPropertyPath] = resolvePropertyPath(
    schemaNode,
    propertyPath
  )

  function renameInNode(
    node: ExtendedJSONSchema7,
    segments: string[]
  ): ExtendedJSONSchema7 {
    if (segments.length === 0) return node
    const [segment, ...rest] = segments
    if (rest.length === 0) {
      const currentProperty = (node.properties || {})[
        segment
      ] as ExtendedJSONSchema7
      return updateSchemaProperty(
        node,
        segment,
        newPropertyName,
        updatedProperty ?? currentProperty
      )
    }
    return assignSchemaProperty(
      node,
      segment,
      renameInNode(traverseSchemaProperty(node, segment), rest)
    )
  }

  function renameInBase(
    node: ExtendedJSONSchema7,
    segments: string[]
  ): ExtendedJSONSchema7 {
    if (segments.length === 0) {
      const baseNode = getPathValue(schemaNode, basePath)
      return renameInNode(baseNode as ExtendedJSONSchema7, resolvedPropertyPath)
    }
    const [segment, ...rest] = segments
    return {
      ...node,
      [segment]: renameInBase(
        (isRecord(node) ? node[segment] : undefined) as ExtendedJSONSchema7,
        rest
      ),
    }
  }

  return renameInBase(schemaNode, basePath)
}

export async function applyTemplateToTableSchemaProperty(
  schemaNode: ExtendedJSONSchema7,
  propertyPath: string,
  templateName: string
): Promise<ExtendedJSONSchema7> {
  const { objectTemplateDependencies, templateObjects } =
    await import("@/components/schema-editor/optional/object-templates/template-objects")
  const template = templateObjects[templateName]
  if (!template) return schemaNode

  const defsToAdd = [
    templateName,
    ...(objectTemplateDependencies[templateName] ?? []),
  ]
  const nextDefs = { ...(schemaNode.$defs || {}) }
  for (const definitionName of defsToAdd) {
    if (!nextDefs[definitionName]) {
      nextDefs[definitionName] = templateObjects[definitionName]
    }
  }

  return updatePropertyAtPath(
    {
      ...schemaNode,
      $defs: nextDefs,
    },
    propertyPath,
    (property) =>
      updateEffectiveNode(property, {
        $ref: `#/$defs/${templateName}`,
      })
  )
}
