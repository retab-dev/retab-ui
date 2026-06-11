import type {
  FieldPath,
  MaterializedFieldPath,
} from "@/components/json-table/lib/schema-inspection"

export interface DocumentPatch {
  data: Record<string, unknown>
}

export function materializeFieldPath(
  templatePath: FieldPath,
  arrayIndexes: number[]
): MaterializedFieldPath {
  let materializedPath = templatePath
  for (const index of arrayIndexes) {
    if (materializedPath.includes("*")) {
      materializedPath = materializedPath.replace("*", index.toString())
    }
  }
  return materializedPath
}

export function setValueAtMaterializedPath(
  root: unknown,
  path: MaterializedFieldPath,
  value: unknown | ((previousValue: unknown) => unknown)
): Record<string, unknown> {
  const segments = path ? path.split(".") : []
  return setValueAtSegments(root, segments, value) as Record<string, unknown>
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
  path: MaterializedFieldPath,
  value: unknown
): DocumentPatch {
  return {
    data: setValueAtMaterializedPath(currentData, path, value),
  }
}
