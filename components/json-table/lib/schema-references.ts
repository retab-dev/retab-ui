import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

type SchemaWithCombinations = JSONSchema7 & {
  anyOf?: JSONSchema7Definition[]
  oneOf?: JSONSchema7Definition[]
  allOf?: JSONSchema7Definition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

export function resolveSchema(
  schemaDef: JSONSchema7Definition | null | undefined,
  context: JSONSchema7
): JSONSchema7 {
  if (schemaDef == null || typeof schemaDef !== "object") {
    return context
  }

  let current = schemaDef as JSONSchema7
  while (current.$ref && typeof current.$ref === "string") {
    const refPath = current.$ref
    const segments = refPath.split("/")
    if (segments[0] !== "#") {
      throw new Error("Only internal references are supported")
    }

    let next: unknown = context
    for (let i = 1; i < segments.length; i++) {
      if (!isRecord(next)) {
        console.warn(
          `[resolveSchema] Could not resolve $ref "${refPath}": path segment "${segments[i]}" not found at index ${i}`
        )
        return { type: "object" }
      }
      next = next[segments[i]]
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

export function unwrapSchema(
  schemaDef: JSONSchema7Definition | undefined,
  root: JSONSchema7
): { schema: JSONSchema7; nullable: boolean } {
  let schema = resolveSchema(schemaDef, root)
  let nullable = false

  if (Array.isArray(schema.type) && schema.type.includes("null")) {
    nullable = true
    schema = { ...schema, type: schema.type.find((type) => type !== "null") }
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

  return { schema, nullable }
}
