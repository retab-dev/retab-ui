import type {
  FieldPath,
  MaterializedFieldPath,
} from "@/components/json-table/lib/schema-paths"

export type { FieldPath, MaterializedFieldPath }

export function materializeFieldPath(
  templateFieldPath: FieldPath,
  arrayIndexes: number[]
): MaterializedFieldPath {
  let materializedFieldPath = templateFieldPath
  for (const index of arrayIndexes) {
    if (materializedFieldPath.includes("*")) {
      materializedFieldPath = materializedFieldPath.replace(
        "*",
        index.toString()
      )
    }
  }
  return materializedFieldPath
}

function isArrayIndexSegment(segment: string): boolean {
  return /^\d+$/.test(segment)
}

function getOwnObjectValue(node: unknown, segment: string): unknown {
  if (node === null || typeof node !== "object") return undefined
  if (!Object.prototype.hasOwnProperty.call(node, segment)) return undefined
  return (node as Record<string, unknown>)[segment]
}

export function getValueAtPath(
  data: unknown,
  materializedFieldPath: MaterializedFieldPath | undefined
): unknown {
  if (!materializedFieldPath || materializedFieldPath.trim() === "") {
    return data
  }

  const segments = materializedFieldPath.split(".")

  const walk = (node: unknown, index: number): unknown => {
    if (index === segments.length) return node
    if (node === null || node === undefined) return undefined

    const segment = segments[index]

    if (segment === "*") {
      if (Array.isArray(node)) {
        for (const child of node) {
          const result = walk(child, index + 1)
          if (result !== undefined) return result
        }
        return undefined
      }

      if (typeof node === "object") {
        for (const child of Object.values(node)) {
          const result = walk(child, index + 1)
          if (result !== undefined) return result
        }
      }

      return undefined
    }

    const next =
      Array.isArray(node) && isArrayIndexSegment(segment)
        ? node[Number(segment)]
        : getOwnObjectValue(node, segment)

    return walk(next, index + 1)
  }

  return walk(data, 0)
}
