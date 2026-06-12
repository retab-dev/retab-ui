import { describe, expect, it } from "vitest"

import { formatTitle } from "@/components/schema-editor/schema-title"

/**
 * `formatTitle` turns a raw field/definition name (snake_case, camelCase, or
 * free text) into a human-readable display title. The schema editor uses it to
 * seed the JSON Schema `title` for newly created properties, so the output is
 * what end users see in the UI. A title is expected to be space-separated Title
 * Case, matching Pydantic's default title generation ("first_name" -> "First
 * Name").
 */
describe("formatTitle", () => {
  it("title-cases snake_case with spaces", () => {
    expect(formatTitle("first_name")).toBe("First Name")
    expect(formatTitle("invoice_number")).toBe("Invoice Number")
  })

  it("splits camelCase into words", () => {
    expect(formatTitle("firstName")).toBe("First Name")
    expect(formatTitle("invoiceNumber")).toBe("Invoice Number")
  })

  it("normalizes already-spaced input", () => {
    expect(formatTitle("first name")).toBe("First Name")
    expect(formatTitle("INVOICE NUMBER")).toBe("Invoice Number")
  })

  it("handles digits as standalone chunks", () => {
    expect(formatTitle("invoice_number_2")).toBe("Invoice Number 2")
    expect(formatTitle("2024_total")).toBe("2024 Total")
  })

  it("collapses runs of separators", () => {
    expect(formatTitle("first__name")).toBe("First Name")
    expect(formatTitle("first - name")).toBe("First Name")
  })

  it("returns an empty string for empty or separator-only input", () => {
    expect(formatTitle("")).toBe("")
    expect(formatTitle("___")).toBe("")
  })

  it("leaves a single lowercase word title-cased", () => {
    expect(formatTitle("total")).toBe("Total")
  })
})
