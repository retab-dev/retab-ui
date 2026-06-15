import type * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { Source, SourceMap } from "@/lib/document-source"

import {
  invalidEvidenceAnchor,
  missingEvidenceAnchor,
  resolvedEvidenceAnchor,
  type AnchorResolution,
  type EvidenceItem,
} from "./document-evidence"
import { sourceToDocumentAnchor as sourceToResolvedDocumentAnchor } from "./source-anchor"

export type SourceEvidencePayload = {
  label: string
  value?: React.ReactNode
  hint?: string
  sourceKind: Source["anchor"]["kind"] | null
}

export type SourceEvidenceItem = EvidenceItem<SourceEvidencePayload>

export type SourceEvidenceField = {
  key: string
  label: string
  value: React.ReactNode
  hint?: string
  source?: Source | null
}

export type SourceEvidenceModel = {
  evidenceItems: SourceEvidenceItem[]
}

export function sourceToDocumentAnchor(
  source: Source | null | undefined
): AnchorResolution {
  if (!source) return missingEvidenceAnchor()

  const anchor = sourceToResolvedDocumentAnchor(source)
  if (anchor) return resolvedEvidenceAnchor(anchor)

  return invalidEvidenceAnchor(`Unsupported or invalid ${source.anchor.kind}`)
}

export function sourceFieldToEvidenceItem(
  field: SourceEvidenceField
): SourceEvidenceItem {
  return {
    id: field.key,
    anchor: sourceToDocumentAnchor(field.source),
    payload: {
      label: field.label,
      value: field.value,
      hint: field.hint,
      sourceKind: field.source?.anchor.kind ?? null,
    },
  }
}

export function sourceFieldsToEvidenceModel(
  fields: readonly SourceEvidenceField[]
): SourceEvidenceModel {
  const evidenceItems = fields.map(sourceFieldToEvidenceItem)
  return {
    evidenceItems,
  }
}

export function sourceMapToEvidenceModel(input: {
  sourceMap: SourceMap
  values?: Record<string, unknown>
  schema?: JSONSchema7
}): SourceEvidenceModel {
  const evidenceItems = sourceMapToEvidenceItems(input)
  return {
    evidenceItems,
  }
}

export function sourceMapToEvidenceItems({
  sourceMap,
  values,
  schema,
}: {
  sourceMap: SourceMap
  values?: Record<string, unknown>
  schema?: JSONSchema7
}): SourceEvidenceItem[] {
  return Object.entries(sourceMap).map(([path, source]) => ({
    id: path,
    anchor: sourceToDocumentAnchor(source),
    payload: {
      label: (schemaLabel(schema, path) ?? path) || "Value",
      value: values
        ? sourceEvidenceValue(valueAtPath(values, path))
        : undefined,
      hint: source.anchor.kind,
      sourceKind: source.anchor.kind,
    },
  }))
}

function schemaLabel(schema: JSONSchema7 | undefined, path: string) {
  const properties = schema?.properties
  if (!properties || !path || path.includes(".")) return null
  const property = properties[path]
  if (!property || typeof property === "boolean") return null
  return typeof property.title === "string" ? property.title : null
}

function valueAtPath(values: Record<string, unknown>, path: string) {
  if (!path) return values
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current == null) return undefined
    if (Array.isArray(current)) return current[Number(segment)]
    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment]
    }
    return undefined
  }, values)
}

function sourceEvidenceValue(value: unknown): React.ReactNode {
  if (value == null) return undefined
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  return JSON.stringify(value)
}
