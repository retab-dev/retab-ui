import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import {
  resolveSchema,
  unwrapSchema,
} from "@/components/json-table/lib/schema-references"

export function getSchemaFlatProperties(
  schema: JSONSchema7Definition,
  schemaPathParts: string[],
  context: JSONSchema7,
  opts?: {
    seen?: WeakSet<object>
    depth?: number
    maxDepth?: number
  }
): { key: string; type: JSONSchema7 }[] {
  const seen = opts?.seen ?? new WeakSet<object>()
  const depth = opts?.depth ?? 0
  const maxDepth = opts?.maxDepth ?? 64

  let resolved = resolveSchema(schema, context)
  resolved = unwrapSchema(resolved, context).schema

  if (depth > maxDepth) {
    console.warn(
      "[getSchemaFlatProperties] Max depth reached while flattening schema path:",
      schemaPathParts.join(".")
    )
    return [{ key: schemaPathParts.join("."), type: resolved }]
  }

  let addedToSeen = false
  if (resolved && typeof resolved === "object") {
    if (seen.has(resolved)) {
      console.warn(
        "[getSchemaFlatProperties] Circular schema reference detected at schema path:",
        schemaPathParts.join(".")
      )
      return [
        {
          key: schemaPathParts.join("."),
          type: {
            ...resolved,
            type: resolved.type ?? "object",
            title: resolved.title || "(circular)",
          },
        },
      ]
    }
    seen.add(resolved)
    addedToSeen = true
  }

  let result: { key: string; type: JSONSchema7 }[]

  if (resolved.type === "array") {
    if (resolved.items) {
      if (Array.isArray(resolved.items)) {
        result = resolved.items.flatMap((item, index) =>
          getSchemaFlatProperties(
            item,
            [...schemaPathParts, String(index)],
            context,
            {
              seen,
              depth: depth + 1,
              maxDepth,
            }
          )
        )
      } else if (typeof resolved.items === "object") {
        const itemSchema = unwrapSchema(resolved.items, context).schema
        result = getSchemaFlatProperties(
          itemSchema,
          [...schemaPathParts, "*"],
          context,
          {
            seen,
            depth: depth + 1,
            maxDepth,
          }
        )
      } else {
        result = [{ key: schemaPathParts.join("."), type: resolved }]
      }
    } else {
      result = [{ key: schemaPathParts.join("."), type: resolved }]
    }
  } else if (resolved.type === "object") {
    if (resolved.properties) {
      result = Object.entries(resolved.properties).flatMap(([key, value]) =>
        getSchemaFlatProperties(value, [...schemaPathParts, key], context, {
          seen,
          depth: depth + 1,
          maxDepth,
        })
      )
    } else {
      result = [{ key: schemaPathParts.join("."), type: resolved }]
    }
  } else {
    result = [{ key: schemaPathParts.join("."), type: resolved }]
  }

  if (addedToSeen && resolved && typeof resolved === "object") {
    seen.delete(resolved)
  }

  return result
}
