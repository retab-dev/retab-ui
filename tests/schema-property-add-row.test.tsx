// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DocumentPropertyAddRow } from "@/components/schema-editor/document-property-add-row"

afterEach(cleanup)

describe("DocumentPropertyAddRow", () => {
  it("adds a valid new property", () => {
    const onAddProperty = vi.fn()
    render(
      <DocumentPropertyAddRow
        rootLayout
        siblingNames={["total"]}
        onAddProperty={onAddProperty}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("New property name"), {
      target: { value: "invoice_number" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    expect(onAddProperty).toHaveBeenCalledWith("invoice_number")
  })

  it("blocks duplicate sibling names", () => {
    const onAddProperty = vi.fn()
    render(
      <DocumentPropertyAddRow
        rootLayout
        siblingNames={["total"]}
        onAddProperty={onAddProperty}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("New property name"), {
      target: { value: "total" },
    })

    expect(screen.getByText(/already exists/i)).toBeTruthy()
    expect(onAddProperty).not.toHaveBeenCalled()
  })
})
