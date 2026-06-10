import { type ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

// The visual layout designer is a dashboard-only feature. The standalone schema
// editor doesn't render it, so layout conversion is a no-op here. `layoutSchema`
// is only consumed by the (absent) layout designer.
export function convertSchemaToLayout(_schema: ExtendedJSONSchema7): unknown {
  return null
}
