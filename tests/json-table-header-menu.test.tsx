// @vitest-environment jsdom

import type { ReactNode } from "react"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type * as HeaderSchemaMenuModule from "@/components/json-table/header-schema-menu"

import { installJsonTableDom } from "./json-table-test-dom"

let HeaderSchemaMenu: typeof HeaderSchemaMenuModule.HeaderSchemaMenu

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h4>{children}</h4>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/schema-editor/property-dialog", () => ({
  PropertyEditor: ({ onDelete }: { onDelete?: () => void }) => (
    <button type="button" onClick={onDelete}>
      Delete Property
    </button>
  ),
}))

beforeAll(async () => {
  installJsonTableDom()
  ;({ HeaderSchemaMenu } =
    await import("@/components/json-table/header-schema-menu"))
})
afterEach(() => cleanup())

describe("json table header schema menu", () => {
  it("deletes a property and closes the menu", () => {
    const setSchema = vi.fn()
    const onOpenChange = vi.fn()
    vi.spyOn(globalThis, "confirm").mockReturnValue(true)

    const view = render(
      <HeaderSchemaMenu
        node={{
          key: "vendor",
          label: "Vendor",
          propName: "vendor",
          parentPath: "",
          rawSchema: { type: "string" },
          schema: { type: "string" },
          effectiveType: "string",
          isObject: false,
          isArray: false,
          canFold: false,
          isExpanded: false,
        }}
        schema={{
          type: "object",
          properties: {
            vendor: { type: "string" },
            total: { type: "number" },
          },
          required: ["vendor"],
        }}
        setSchema={setSchema}
        isPublished={false}
        schemaEditMode="editable"
        open={true}
        onOpenChange={onOpenChange}
      >
        <button>open</button>
      </HeaderSchemaMenu>
    )

    fireEvent.click(view.getByRole("button", { name: "Delete Property" }))

    expect(Object.keys(setSchema.mock.calls[0][0].properties ?? {})).toEqual([
      "total",
    ])
    expect(setSchema.mock.calls[0][0].required).toBeUndefined()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
