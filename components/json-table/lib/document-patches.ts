import type { MaterializedFieldPath } from "@/components/json-table/lib/document-paths"
import type { JsonTableDocumentData } from "@/components/json-table/lib/projects-types"

export { materializeFieldPath } from "@/components/json-table/lib/document-paths"

export interface DocumentPatch {
  data: JsonTableDocumentData
}

const unsafeDocumentPathSegments = new Set([
  "__proto__",
  "constructor",
  "prototype",
])

function assertSafeDocumentPath(segments: string[]) {
  for (const segment of segments) {
    if (unsafeDocumentPathSegments.has(segment)) {
      throw new Error(`Unsafe document path segment "${segment}"`)
    }
  }
}

export function setValueAtMaterializedPath(
  root: unknown,
  materializedFieldPath: MaterializedFieldPath,
  value: unknown | ((previousValue: unknown) => unknown)
): JsonTableDocumentData {
  const segments = materializedFieldPath ? materializedFieldPath.split(".") : []
  assertSafeDocumentPath(segments)
  return setValueAtSegments(root, segments, value) as JsonTableDocumentData
}

function setValueAtSegments(
  node: unknown,
  segments: string[],
  value: unknown | ((previousValue: unknown) => unknown)
): unknown {
  if (segments.length === 0) {
    return typeof value === "function"
      ? (value as (previousValue: unknown) => unknown)(node)
      : value
  }

  const [segment, ...rest] = segments
  const isIndex = /^\d+$/.test(segment)
  const current = node == null ? (isIndex ? [] : {}) : node

  if (isIndex) {
    const index = parseInt(segment, 10)
    const baseArray: unknown[] = Array.isArray(current) ? current : []
    const nextArray = baseArray.slice()
    nextArray[index] = setValueAtSegments(baseArray[index], rest, value)
    return nextArray
  }

  const baseObject: Record<string, unknown> =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {}

  return {
    ...baseObject,
    [segment]: setValueAtSegments(baseObject[segment], rest, value),
  }
}

export function buildDocumentDataPatch(
  currentData: unknown,
  materializedFieldPath: MaterializedFieldPath,
  value: unknown
): DocumentPatch {
  return {
    data: setValueAtMaterializedPath(currentData, materializedFieldPath, value),
  }
}
