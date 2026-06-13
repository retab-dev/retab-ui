"use client"

import type * as React from "react"

import {
  getTemplateIcon,
  getTypeIcon,
} from "@/components/schema-editor/type-icons"

export type SchemaTypeOptionId =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "enum"
  | "object"
  | "array"
  | "date"
  | "time"
  | "datetime"

export interface SchemaTypeOption {
  id: SchemaTypeOptionId
  label: string
  icon: React.ReactNode
}

const schemaTypeOptionLabels: Array<[SchemaTypeOptionId, string]> = [
  ["string", "string"],
  ["number", "number"],
  ["integer", "integer"],
  ["boolean", "true/false"],
  ["enum", "multiple choice"],
  ["object", "object"],
  ["array", "list"],
  ["date", "date"],
  ["time", "time"],
  ["datetime", "timestamp"],
]

export const schemaTypeOptions: SchemaTypeOption[] =
  schemaTypeOptionLabels.map(([id, label]) => ({
    id,
    label,
    icon: getTypeIcon(id),
  }))

export function schemaTypeLabel(type: string, refName?: string) {
  if (type === "$ref" && refName) return refName
  if (type === "boolean") return "true/false"
  if (type === "enum") return "multiple choice"
  if (type === "array") return "list"
  if (type === "datetime") return "timestamp"
  return type || "Select type"
}

export function schemaTypeIcon(
  type: string,
  refName?: string
): React.ReactNode {
  if (type === "$ref" && refName) return getTemplateIcon(refName)
  return getTypeIcon(type)
}
