// @vitest-environment jsdom
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JSONSchema7 } from "json-schema"

import { SchemaBuilder } from "@/components/ui/schema-builder"

afterEach(cleanup)

const sample: JSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string" },
  },
  required: ["invoice_number"],
}

function renderPublicBuilder({
  schema = sample,
  features,
  view,
}: {
  schema?: JSONSchema7
  features?: React.ComponentProps<typeof SchemaBuilder>["features"]
  view?: React.ComponentProps<typeof SchemaBuilder>["view"]
} = {}) {
  const emits: JSONSchema7[] = []

  function Harness() {
    const [value, setValue] = React.useState(schema)
    return (
      <SchemaBuilder
        value={value}
        view={view}
        features={features}
        onValueChange={(next) => {
          emits.push(next as JSONSchema7)
          setValue(next as JSONSchema7)
        }}
      />
    )
  }

  const utils = render(<Harness />)
  return { emits, ...utils }
}

describe("SchemaBuilder public API", () => {
  it("renders the public wrapper slot and fields view by default", () => {
    const { container } = renderPublicBuilder()

    expect(container.querySelector('[data-slot="schema-builder"]')).toBeTruthy()
    expect(screen.getByText("invoice_number")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull()
  })

  it("ignores json view when the jsonMode feature is disabled", () => {
    renderPublicBuilder({ view: "json", features: { jsonMode: false } })

    expect(screen.getByText("invoice_number")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull()
  })

  it("does not emit while JSON mode contains invalid JSON", async () => {
    const { emits } = renderPublicBuilder({
      features: { jsonMode: true },
      view: "json",
    })

    const editor = await screen.findByRole("textbox")
    fireEvent.change(editor, { target: { value: "{ invalid" } })

    expect(emits).toHaveLength(0)
    expect(screen.getByText(/Expected property name/i)).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  it("emits once when valid JSON mode text is applied", async () => {
    const { emits } = renderPublicBuilder({
      features: { jsonMode: true },
      view: "json",
    })
    const next: JSONSchema7 = {
      type: "object",
      properties: { total: { type: "number" } },
    }

    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: JSON.stringify(next, null, 2) },
    })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))

    expect(emits).toHaveLength(1)
    expect(Object.keys(emits[0].properties!)).toEqual(["total"])
  })

  it("keeps definition creation hidden when definitions are disabled", () => {
    renderPublicBuilder({
      features: { definitions: false },
      schema: {
        type: "object",
        properties: {},
      },
    })

    expect(screen.queryByText("Add definition")).toBeNull()
  })
})
