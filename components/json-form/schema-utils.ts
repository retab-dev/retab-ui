import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

export type Schema = JSONSchema7

export type FieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "enum"
  | "object"
  | "array"

export interface NormalizedSchema {
  schema: Schema
  nullable: boolean
}

export interface Column {
  key: string
  schema: Schema
  kind: FieldKind
  required: boolean
  nullable: boolean
}

function isSchema(value: JSONSchema7Definition | unknown): value is Schema {
  return typeof value === "object" && value !== null
}

function cloneSchema(schema: Schema): Schema {
  return JSON.parse(JSON.stringify(schema)) as Schema
}

function definitionsFrom(
  schema: Schema
): Record<string, JSONSchema7Definition> {
  return {
    ...((schema.definitions ?? {}) as Record<string, JSONSchema7Definition>),
    ...((schema.$defs ?? {}) as Record<string, JSONSchema7Definition>),
  }
}

function mergeSchemas(base: Schema, next: Schema): Schema {
  const merged: Schema = { ...base, ...next }
  if (base.properties || next.properties) {
    const baseProperties = (base.properties ?? {}) as Record<
      string,
      JSONSchema7Definition
    >
    const nextProperties = (next.properties ?? {}) as Record<
      string,
      JSONSchema7Definition
    >
    merged.properties = { ...baseProperties }
    for (const [key, value] of Object.entries(nextProperties)) {
      const existing = merged.properties[key]
      merged.properties[key] =
        isSchema(existing) && isSchema(value)
          ? mergeSchemas(existing, value)
          : value
    }
  }
  if (base.required || next.required) {
    merged.required = Array.from(
      new Set([...(base.required ?? []), ...(next.required ?? [])])
    )
  }
  return merged
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~")
}

function resolveLocalPointer(
  schema: Schema,
  ref: string
): JSONSchema7Definition | undefined {
  if (!ref.startsWith("#/")) return undefined

  let current: unknown = schema
  for (const segment of ref.slice(2).split("/").map(decodePointerSegment)) {
    if (!isSchema(current) && !Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current as JSONSchema7Definition | undefined
}

function refKey(ref: string): string | null {
  if (ref.startsWith("#/$defs/")) {
    return decodePointerSegment(ref.slice("#/$defs/".length))
  }
  if (ref.startsWith("#/definitions/")) {
    return decodePointerSegment(ref.slice("#/definitions/".length))
  }
  return null
}

function resolveRef(
  ref: string,
  rootSchema: Schema,
  definitions: Record<string, JSONSchema7Definition>
): JSONSchema7Definition | undefined {
  return resolveLocalPointer(rootSchema, ref) ?? definitions[refKey(ref) ?? ""]
}

export function expandRefs(
  schema: Schema,
  definitions: Record<string, JSONSchema7Definition> = definitionsFrom(schema),
  visited: Set<string> = new Set(),
  rootSchema: Schema = schema
): Schema {
  const working = cloneSchema(schema)

  if (typeof working.$ref === "string") {
    const ref = working.$ref
    const target = resolveRef(ref, rootSchema, definitions)
    if (!isSchema(target) || visited.has(ref)) return working

    const nextVisited = new Set(visited)
    nextVisited.add(ref)
    const { $ref: _ref, ...overrides } = working
    return expandRefs(
      mergeSchemas(
        expandRefs(target, definitions, nextVisited, rootSchema),
        overrides
      ),
      definitions,
      nextVisited,
      rootSchema
    )
  }

  if (Array.isArray(working.allOf)) {
    const allOf = working.allOf
    delete working.allOf
    return allOf.reduce<Schema>((merged, branch) => {
      return isSchema(branch)
        ? mergeSchemas(
            merged,
            expandRefs(branch, definitions, visited, rootSchema)
          )
        : merged
    }, working)
  }

  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = working[key]
    if (Array.isArray(branches)) {
      working[key] = branches.map((branch) =>
        isSchema(branch)
          ? expandRefs(branch, definitions, visited, rootSchema)
          : branch
      )
    }
  }

  if (working.properties) {
    const properties: Record<string, JSONSchema7Definition> = {}
    for (const [key, value] of Object.entries(working.properties)) {
      properties[key] = isSchema(value)
        ? expandRefs(value, definitions, visited, rootSchema)
        : value
    }
    working.properties = properties
  }

  if (isSchema(working.items)) {
    working.items = expandRefs(working.items, definitions, visited, rootSchema)
  } else if (Array.isArray(working.items)) {
    working.items = working.items.map((item) =>
      isSchema(item) ? expandRefs(item, definitions, visited, rootSchema) : item
    )
  }

  return working
}

/** Resolve nullable unions like `["string","null"]` or `anyOf:[X,{type:"null"}]`. */
export function unwrapNullable(schema: Schema): NormalizedSchema {
  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((type) => type !== "null")
    return {
      schema: {
        ...schema,
        type: nonNull.length === 1 ? nonNull[0] : nonNull,
      },
      nullable: schema.type.includes("null"),
    }
  }

  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = schema[key]
    if (!Array.isArray(branches)) continue

    const schemaBranches = branches.filter(isSchema)
    const nullable = schemaBranches.some((branch) => branch.type === "null")
    const main = schemaBranches.find((branch) => branch.type !== "null")
    if (main) {
      return {
        schema: {
          ...main,
          title: schema.title ?? main.title,
          description: schema.description ?? main.description,
        },
        nullable,
      }
    }
  }

  return { schema, nullable: false }
}

export function fieldKind(schema: Schema): FieldKind {
  if (Array.isArray(schema.enum)) return "enum"
  const type = Array.isArray(schema.type)
    ? schema.type.find((item) => item !== "null")
    : schema.type
  switch (type) {
    case "number":
      return "number"
    case "integer":
      return "integer"
    case "boolean":
      return "boolean"
    case "object":
      return "object"
    case "array":
      return "array"
    default:
      return "string"
  }
}

export function labelFor(
  name: string,
  schema: Schema,
  explicit?: string
): string {
  if (explicit) return explicit
  if (schema.title) return schema.title
  const leaf = name.split(".").pop() ?? name
  return leaf
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

export function emptyValueFor(schema: Schema): unknown {
  const { schema: inner, nullable } = unwrapNullable(schema)
  if (nullable) return null
  switch (fieldKind(inner)) {
    case "boolean":
      return false
    case "object":
      return {}
    case "array":
      return []
    case "number":
    case "integer":
      return undefined
    default:
      return ""
  }
}

export function isScalarKind(kind: FieldKind): boolean {
  return kind !== "object" && kind !== "array"
}

export function scalarObjectColumns(itemSchema: Schema): Column[] | null {
  const { schema } = unwrapNullable(itemSchema)
  if (fieldKind(schema) !== "object") return null
  const properties = (schema.properties ?? {}) as Record<
    string,
    JSONSchema7Definition
  >
  const required = new Set(schema.required ?? [])
  const columns: Column[] = []
  for (const [key, child] of Object.entries(properties)) {
    if (!isSchema(child)) return null
    const { schema: inner, nullable } = unwrapNullable(child)
    const kind = fieldKind(inner)
    if (!isScalarKind(kind)) return null
    columns.push({
      key,
      schema: inner,
      kind,
      required: required.has(key),
      nullable,
    })
  }
  return columns.length > 0 ? columns : null
}
