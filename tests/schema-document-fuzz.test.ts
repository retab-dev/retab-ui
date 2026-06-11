import { describe, expect, it } from "vitest"
import type { JSONSchema7 } from "json-schema"

import {
  fromJsonSchema,
  getChildNodeId,
  getChildPropertyId,
  moveProperty,
  toJsonSchema,
} from "@/components/schema-editor/document"

// ---------------------------------------------------------------------------
// A small deterministic PRNG so failures are reproducible from the seed.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SCALARS = ["string", "number", "integer", "boolean", "null"] as const
const UNKNOWN_KEYWORDS: Array<[string, unknown]> = [
  ["pattern", "^x"],
  ["format", "email"],
  ["minLength", 1],
  ["maxLength", 10],
  ["minimum", 0],
  ["maximum", 100],
  ["multipleOf", 2],
  ["uniqueItems", true],
  ["readOnly", true],
  ["deprecated", true],
  ["default", "d"],
  ["examples", ["a", "b"]],
  ["x-reasoning", { hint: "think" }],
]

function genSchema(rand: () => number, depth: number, defNames: string[]): JSONSchema7 {
  const r = rand()
  // leaf bias grows with depth
  if (depth <= 0 || r < 0.35) {
    const t = SCALARS[Math.floor(rand() * SCALARS.length)]
    const node: Record<string, unknown> = { type: t }
    maybeMeta(rand, node)
    maybeUnknown(rand, node)
    return node as JSONSchema7
  }
  if (r < 0.5 && defNames.length > 0) {
    return { $ref: `#/$defs/${defNames[Math.floor(rand() * defNames.length)]}` }
  }
  if (r < 0.62) {
    // enum
    const vals = ["a", "b", 1, 2, true].slice(0, 1 + Math.floor(rand() * 4))
    const node: Record<string, unknown> = { type: "string", enum: vals }
    maybeMeta(rand, node)
    return node as JSONSchema7
  }
  if (r < 0.72) {
    // nullable via anyOf
    return { anyOf: [genSchema(rand, depth - 1, defNames), { type: "null" }] }
  }
  if (r < 0.85) {
    // array
    const node: Record<string, unknown> = {
      type: "array",
      items: genSchema(rand, depth - 1, defNames),
    }
    maybeMeta(rand, node)
    maybeUnknown(rand, node)
    return node as JSONSchema7
  }
  // object
  return genObject(rand, depth - 1, defNames)
}

function genObject(rand: () => number, depth: number, defNames: string[]): JSONSchema7 {
  const count = Math.floor(rand() * 4)
  const properties: Record<string, JSONSchema7> = {}
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    const key = `p${i}_${Math.floor(rand() * 1000)}`
    keys.push(key)
    properties[key] = genSchema(rand, depth - 1, defNames)
  }
  const node: Record<string, unknown> = { type: "object", properties }
  // required: only real keys; sometimes empty
  if (rand() < 0.6) {
    node.required = keys.filter(() => rand() < 0.5)
  }
  maybeMeta(rand, node)
  return node as JSONSchema7
}

function maybeMeta(rand: () => number, node: Record<string, unknown>) {
  if (rand() < 0.4) node.title = "T" + Math.floor(rand() * 100)
  if (rand() < 0.4) node.description = "D" + Math.floor(rand() * 100)
}
function maybeUnknown(rand: () => number, node: Record<string, unknown>) {
  if (rand() < 0.5) {
    const [k, v] = UNKNOWN_KEYWORDS[Math.floor(rand() * UNKNOWN_KEYWORDS.length)]
    node[k] = v
  }
}

function genRoot(seed: number): JSONSchema7 {
  const rand = mulberry32(seed)
  const defNames: string[] = []
  const $defs: Record<string, JSONSchema7> = {}
  const defCount = Math.floor(rand() * 3)
  for (let i = 0; i < defCount; i++) {
    const name = `Def${i}`
    defNames.push(name)
    $defs[name] = genObject(rand, 2, defNames.slice(0, i)) // defs may ref earlier defs
  }
  const root = genObject(rand, 3, defNames) as Record<string, unknown>
  if (defCount > 0) root.$defs = $defs
  return root as JSONSchema7
}

describe("fuzz: round-trip over many random schemas", () => {
  it("preserves CONTENT for 1000 random schemas (semantic)", () => {
    const failures: number[] = []
    for (let seed = 1; seed <= 1000; seed++) {
      const schema = genRoot(seed)
      const out = toJsonSchema(fromJsonSchema(schema))
      if (JSON.stringify(normalize(out)) !== JSON.stringify(normalize(schema))) {
        failures.push(seed)
        if (failures.length <= 3) {
          console.error(
            `seed ${seed}\n in : ${JSON.stringify(schema)}\n out: ${JSON.stringify(out)}`,
          )
        }
      }
    }
    expect(failures).toEqual([])
  })

  it("preserves exact KEY ORDER for 1000 random schemas (byte-exact)", () => {
    const failures: number[] = []
    for (let seed = 1; seed <= 1000; seed++) {
      const schema = genRoot(seed)
      const out = toJsonSchema(fromJsonSchema(schema))
      if (JSON.stringify(out) !== JSON.stringify(schema)) {
        failures.push(seed)
        if (failures.length <= 3) {
          console.error(
            `seed ${seed}\n in : ${JSON.stringify(schema)}\n out: ${JSON.stringify(out)}`,
          )
        }
      }
    }
    expect(failures).toEqual([])
  })
})

describe("definitions keyword edge cases", () => {
  it("both $defs and definitions present: neither set of definitions is lost", () => {
    const schema = {
      type: "object",
      $defs: { A: { type: "string" } },
      definitions: { B: { type: "number" } },
      properties: { a: { $ref: "#/$defs/A" }, b: { $ref: "#/definitions/B" } },
    } as unknown as JSONSchema7
    const out = toJsonSchema(fromJsonSchema(schema)) as Record<string, unknown>
    const defs = (out.$defs ?? {}) as Record<string, unknown>
    const definitions = (out.definitions ?? {}) as Record<string, unknown>
    // A and B must both survive somewhere
    const all = { ...defs, ...definitions }
    expect(all.A).toEqual({ type: "string" })
    expect(all.B).toEqual({ type: "number" })
  })

  it("a root-level $ref round-trips", () => {
    const schema = {
      $defs: { Root: { type: "object", properties: { a: { type: "string" } } } },
      $ref: "#/$defs/Root",
    } as unknown as JSONSchema7
    expect(toJsonSchema(fromJsonSchema(schema))).toEqual(schema)
  })
})

/** Deep key-sort for order-insensitive content comparison. */
function normalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalize)
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, normalize((v as Record<string, unknown>)[k])]),
    )
  }
  return v
}

describe("moveProperty preserves required across containers", () => {
  it("moving a required prop into another object carries its required flag", () => {
    const d0 = fromJsonSchema({
      type: "object",
      properties: {
        a: { type: "string" },
        target: { type: "object", properties: { z: { type: "string" } }, required: ["z"] },
      },
      required: ["a"],
    })
    const aPropertyId = getChildPropertyId(d0, d0.root.id, "a")!
    const targetId = getChildNodeId(d0, d0.root.id, "target")!
    const out = toJsonSchema(moveProperty(d0, aPropertyId, targetId, 0)) as JSONSchema7
    // 'a' left the root → root.required no longer has it
    expect(out.required).toEqual([])
    // 'a' was required in its old parent → stays required in the new parent
    const target = out.properties!.target as JSONSchema7
    expect(Object.keys(target.properties!)).toEqual(["a", "z"])
    expect(target.required).toEqual(["a", "z"])
  })
})
