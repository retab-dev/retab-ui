import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export function commitPrimitiveCommand({
  effectiveValue,
  fieldMetadata,
  key,
  commitPrimitiveValue,
}: {
  effectiveValue: unknown
  fieldMetadata: FieldMetadata
  key?: string
  commitPrimitiveValue: (value: unknown) => void
}) {
  if (fieldMetadata.kind !== "boolean") return false
  if (key !== undefined && key !== " ") return false

  commitPrimitiveValue(!Boolean(effectiveValue))
  return true
}
