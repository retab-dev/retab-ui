import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

type SchemaWithCombinations = JSONSchema7 & {
  anyOf?: JSONSchema7Definition[]
  oneOf?: JSONSchema7Definition[]
  allOf?: JSONSchema7Definition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~")
}

function schemaEnumIncludesNull(schema: JSONSchema7): boolean {
  return Array.isArray(schema.enum) && schema.enum.includes(null)
}

function unwrapNullableType(schema: JSONSchema7): {
  schema: JSONSchema7
  nullable: boolean
} {
  if (!Array.isArray(schema.type) || !schema.type.includes("null")) {
    return { schema, nullable: false }
  }

  return {
    schema: {
      ...schema,
      type: schema.type.find((type) => type !== "null"),
    },
    nullable: true,
  }
}

export function resolveSchema(
  schemaDef: JSONSchema7Definition | null | undefined,
  context: JSONSchema7
): JSONSchema7 {
  if (schemaDef === true) return {}
  if (schemaDef === false) return { not: {} }
  if (schemaDef == null || typeof schemaDef !== "object") {
    return context
  }

  let current = schemaDef as JSONSchema7
  const seenRefs = new Set<string>()
  while (current.$ref && typeof current.$ref === "string") {
    const refPath = current.$ref
    if (seenRefs.has(refPath)) {
      console.warn(
        `[resolveSchema] Circular $ref detected while resolving "${refPath}"`
      )
      return { type: "object" }
    }
    seenRefs.add(refPath)

    const segments = refPath.split("/")
    if (segments[0] !== "#") {
      throw new Error("Only internal references are supported")
    }

    let next: unknown = context
    for (let i = 1; i < segments.length; i++) {
      const segment = decodeJsonPointerSegment(segments[i])
      if (!isRecord(next)) {
        console.warn(
          `[resolveSchema] Could not resolve $ref "${refPath}": path segment "${segment}" not found at index ${i}`
        )
        return { type: "object" }
      }
      next = next[segment]
    }

    if (!isRecord(next)) {
      console.warn(
        `[resolveSchema] Could not resolve $ref "${refPath}": target is null or not an object`
      )
      return { type: "object" }
    }
    current = next as JSONSchema7
  }
  return current
}

function mergeAllOfBranches(
  branches: JSONSchema7Definition[],
  root: JSONSchema7
): JSONSchema7 | undefined {
  const resolvedBranches = branches
    .map((branch) => resolveSchema(branch, root))
    .filter((branch) => {
      const type = Array.isArray(branch.type)
        ? branch.type.find((item) => item !== "null")
        : branch.type
      return (
        type !== "null" &&
        (type || branch.properties || branch.items || branch.enum)
      )
    })

  if (resolvedBranches.length === 0) return undefined

  return resolvedBranches.reduce<JSONSchema7>((merged, branch) => {
    const {
      anyOf: _anyOf,
      oneOf: _oneOf,
      allOf: _allOf,
      properties,
      required,
      $defs,
      ...rest
    } = branch as SchemaWithCombinations

    return {
      ...merged,
      ...rest,
      ...(merged.properties || properties
        ? {
            properties: {
              ...(merged.properties ?? {}),
              ...(properties ?? {}),
            },
          }
        : undefined),
      ...(merged.required || required
        ? {
            required: Array.from(
              new Set([...(merged.required ?? []), ...(required ?? [])])
            ),
          }
        : undefined),
      ...(merged.$defs || $defs
        ? {
            $defs: {
              ...(merged.$defs ?? {}),
              ...($defs ?? {}),
            },
          }
        : undefined),
    }
  }, {})
}

export function unwrapSchema(
  schemaDef: JSONSchema7Definition | undefined,
  root: JSONSchema7
): { schema: JSONSchema7; nullable: boolean } {
  let schema = resolveSchema(schemaDef, root)
  let nullable = false

  const nullableType = unwrapNullableType(schema)
  if (nullableType.nullable) {
    nullable = true
    schema = nullableType.schema
  }

  if (schemaEnumIncludesNull(schema)) {
    nullable = true
  }

  const schemaWithCombinations = schema as SchemaWithCombinations
  const branches =
    schemaWithCombinations.anyOf ||
    schemaWithCombinations.oneOf ||
    schemaWithCombinations.allOf

  if (Array.isArray(branches) && branches.length > 0) {
    if (
      branches.some(
        (branch) =>
          typeof branch === "object" &&
          branch !== null &&
          (branch as JSONSchema7).type === "null"
      )
    ) {
      nullable = true
    }

    if (schemaWithCombinations.allOf) {
      schema = mergeAllOfBranches(schemaWithCombinations.allOf, root) ?? schema
    } else {
      const nonNull = branches.find((branch) => {
        const resolved = resolveSchema(branch, root)
        const type = Array.isArray(resolved.type)
          ? resolved.type.find((item) => item !== "null")
          : resolved.type
        return (
          type !== "null" &&
          (type || resolved.properties || resolved.items || resolved.enum)
        )
      })

      if (nonNull) {
        const resolved = resolveSchema(nonNull, root)
        const {
          anyOf: _anyOf,
          oneOf: _oneOf,
          allOf: _allOf,
          ...rest
        } = resolved as SchemaWithCombinations
        schema = rest as JSONSchema7
      }
    }
  }

  const effectiveNullableType = unwrapNullableType(schema)
  if (effectiveNullableType.nullable) {
    nullable = true
    schema = effectiveNullableType.schema
  }

  if (schemaEnumIncludesNull(schema)) {
    nullable = true
  }

  return { schema, nullable }
}
