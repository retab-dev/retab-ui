// @vitest-environment jsdom
import * as React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JSONSchema7 } from "json-schema"

import {
  JsonSchemaEditorProvider,
  useJsonSchema,
  useJsonSchemaOptional,
} from "@/components/schema-editor/contexts/json-schema"
import {
  addProperty,
  getChildNodeId,
  renameProperty,
} from "@/components/schema-editor/document"
import { requireAllProperties } from "@/components/schema-editor/json-schema-builder-utils"

afterEach(cleanup)

type Ctx = ReturnType<typeof useJsonSchema>

function Capture({ apiRef }: { apiRef: { current: Ctx | null } }) {
  const ctx = useJsonSchema()
  React.useEffect(() => {
    apiRef.current = ctx
  })
  return null
}

/** Controlled harness: a parent owns the schema, exactly like the dashboard. */
function renderProvider(initial: JSONSchema7) {
  const apiRef: { current: Ctx | null } = { current: null }
  const onEmit = vi.fn<(s: JSONSchema7) => void>()
  function Harness() {
    const [schema, setSchema] = React.useState(initial)
    return (
      <JsonSchemaEditorProvider
        jsonSchema={schema}
        setJsonSchema={(s) => {
          onEmit(s as JSONSchema7)
          setSchema(s as JSONSchema7)
        }}
      >
        <Capture apiRef={apiRef} />
      </JsonSchemaEditorProvider>
    )
  }
  const utils = render(<Harness />)
  return { apiRef, onEmit, api: () => apiRef.current!, ...utils }
}

const sample: JSONSchema7 = {
  type: "object",
  properties: { a: { type: "string" }, b: { type: "number" } },
  required: ["a"],
}

describe("JsonSchemaEditorProvider wiring", () => {
  it("exposes jsonSchema as the all-required projection of the controlled value", () => {
    const { api } = renderProvider(sample)
    // policy: every property is required
    expect(api().jsonSchema).toEqual(requireAllProperties(sample))
  })

  it("forces every property required regardless of the loaded schema (policy)", () => {
    const { api } = renderProvider({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      required: ["a"], // b NOT required in the input
    })
    expect(api().jsonSchema.required).toEqual(["a", "b"])
  })

  it("applyDocOp emits the projected schema and updates the document", () => {
    const { api, onEmit } = renderProvider(sample)
    const aId = getChildNodeId(api().doc, api().doc.root.id, "a")!
    act(() => {
      api().applyDocOp((d) => renameProperty(d, aId, "alpha"))
    })
    expect(Object.keys(api().jsonSchema.properties!)).toEqual(["alpha", "b"])
    expect(api().jsonSchema.required).toEqual(["alpha", "b"]) // all required
    // onEmit receives the same projected schema
    expect(onEmit).toHaveBeenCalled()
    const last = onEmit.mock.calls.at(-1)![0]
    expect(last).toEqual(api().jsonSchema)
  })

  it("keeps sibling node ids stable across an edit (echo detection — no re-import)", () => {
    const { api } = renderProvider(sample)
    const bIdBefore = getChildNodeId(api().doc, api().doc.root.id, "b")
    const aId = getChildNodeId(api().doc, api().doc.root.id, "a")!
    act(() => {
      api().applyDocOp((d) => renameProperty(d, aId, "alpha"))
    })
    // the edit round-tripped through the controlled prop; b's id must survive
    const bIdAfter = getChildNodeId(api().doc, api().doc.root.id, "b")
    expect(bIdAfter).toBe(bIdBefore)
    expect(Object.keys(api().jsonSchema.properties!)).toEqual(["alpha", "b"])
  })

  it("applyDocOp is a no-op when the operation changes nothing", () => {
    const { api, onEmit } = renderProvider(sample)
    const before = api().jsonSchema
    act(() => {
      api().applyDocOp((d) => d) // identity
    })
    expect(api().jsonSchema).toBe(before)
    expect(onEmit).not.toHaveBeenCalled()
  })

  it("re-imports when the controlled value changes externally", () => {
    const apiRef: { current: Ctx | null } = { current: null }
    function Harness({ schema }: { schema: JSONSchema7 }) {
      return (
        <JsonSchemaEditorProvider jsonSchema={schema} setJsonSchema={() => {}}>
          <Capture apiRef={apiRef} />
        </JsonSchemaEditorProvider>
      )
    }
    const { rerender } = render(<Harness schema={sample} />)
    expect(Object.keys(apiRef.current!.jsonSchema.properties!)).toEqual(["a", "b"])
    const next: JSONSchema7 = { type: "object", properties: { x: { type: "boolean" } } }
    act(() => rerender(<Harness schema={next} />))
    expect(apiRef.current!.jsonSchema).toEqual(requireAllProperties(next))
  })

  it("supports adding a property then naming it through two ops", () => {
    const { api } = renderProvider(sample)
    act(() => {
      api().applyDocOp((d) => addProperty(d, d.root.id))
    })
    // the new (empty-key) node exists in the doc but isn't projected yet
    expect(api().doc.root.properties).toHaveLength(3)
    expect(Object.keys(api().jsonSchema.properties!)).toEqual(["a", "b"])
    const newId = api().doc.root.properties!.at(-1)!.node.id
    act(() => {
      api().applyDocOp((d) => renameProperty(d, newId, "c"))
    })
    expect(Object.keys(api().jsonSchema.properties!)).toEqual(["a", "b", "c"])
  })
})

describe("uncontrolled mode", () => {
  it("provides a default object schema and accepts edits", () => {
    const apiRef: { current: Ctx | null } = { current: null }
    render(
      <JsonSchemaEditorProvider>
        <Capture apiRef={apiRef} />
      </JsonSchemaEditorProvider>,
    )
    expect(apiRef.current!.jsonSchema.type).toBe("object")
    act(() => {
      apiRef.current!.applyDocOp((d) => addProperty(d, d.root.id))
    })
    const id = apiRef.current!.doc.root.properties!.at(-1)!.node.id
    act(() => {
      apiRef.current!.applyDocOp((d) => renameProperty(d, id, "field"))
    })
    expect(Object.keys(apiRef.current!.jsonSchema.properties!)).toContain("field")
  })
})

describe("useJsonSchemaOptional", () => {
  it("returns undefined outside a provider", () => {
    const seen: { current: unknown } = { current: "unset" }
    function Probe() {
      const ctx = useJsonSchemaOptional()
      React.useEffect(() => {
        seen.current = ctx
      })
      return null
    }
    render(<Probe />)
    expect(seen.current).toBeUndefined()
  })
})
