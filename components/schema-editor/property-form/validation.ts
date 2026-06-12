import { getEffectiveType } from "@/components/schema-editor/draft/draft-node-edits"
import {
  getEffectiveNode,
  validateName,
} from "@/components/schema-editor/lib/json-schema-utils"
import type {
  FieldValidation,
  NodeValidation,
  PropertyDraft,
  PropertyFormSchemaContext,
  PropertyValidation,
} from "@/components/schema-editor/property-form/types"

export const PROPERTY_NAME_ERROR =
  "Name must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 64 characters long"

export function validatePropertyFormName({
  name,
  siblingNames,
  originalName,
}: {
  name: string
  siblingNames: string[]
  originalName: string
}): string | null {
  return validateName(name, siblingNames, originalName, "property")
}

function validField(): FieldValidation {
  return { status: "valid" }
}

function invalidField(message: string, code: string): FieldValidation {
  return { status: "invalid", message, code }
}

function validNode(): NodeValidation {
  return { status: "valid" }
}

function invalidNode(message: string, code: string): NodeValidation {
  return { status: "invalid", message, code }
}

function getStableValueKey(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(getStableValueKey).join(",")}]`
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, currentValue]) =>
          `${JSON.stringify(key)}:${getStableValueKey(currentValue)}`
      )
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function hasDuplicateEnumValues(values: unknown[]) {
  const seen = new Set<string>()
  for (const value of values) {
    const key = getStableValueKey(value)
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function hasBlankEnumValues(values: unknown[]) {
  return values.some((value) => typeof value === "string" && !value.trim())
}

export function validatePropertyDraft({
  propertyDraft,
  schemaContext,
}: {
  propertyDraft: PropertyDraft
  schemaContext: PropertyFormSchemaContext
}): PropertyValidation {
  const nameError = validatePropertyFormName({
    name: propertyDraft.name,
    siblingNames: schemaContext.siblingNames,
    originalName: schemaContext.originalName,
  })
  const name = nameError
    ? invalidField(nameError, "property_name_invalid")
    : validField()

  const effectiveSchemaNode = getEffectiveNode(propertyDraft.schemaNode)
  const effectiveType = getEffectiveType(propertyDraft.schemaNode)
  const enumValues = Array.isArray(effectiveSchemaNode.enum)
    ? effectiveSchemaNode.enum
    : []
  const schemaNode =
    effectiveType.type === "enum" && enumValues.length === 0
      ? invalidNode(
          "Multiple choice fields need at least one option",
          "enum_empty"
        )
      : effectiveType.type === "enum" && hasBlankEnumValues(enumValues)
        ? invalidNode("Multiple choice options cannot be blank", "enum_blank")
        : effectiveType.type === "enum" && hasDuplicateEnumValues(enumValues)
          ? invalidNode(
              "Multiple choice options must be unique",
              "enum_duplicate"
            )
          : validNode()

  return {
    name,
    schemaNode,
    canCommit: name.status !== "invalid" && schemaNode.status !== "invalid",
  }
}
