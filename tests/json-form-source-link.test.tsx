// @vitest-environment jsdom
import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  JsonFormSourceLinkProvider,
  SourceFieldLinkShell,
  useSourceLinkedTableCells,
} from "@/components/json-form/source-link"

afterEach(cleanup)

describe("json-form source link", () => {
  it("previews on focus and selects on Enter without hijacking text input Space", () => {
    const onFieldHover = vi.fn()
    const selectField = vi.fn()

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activePath: null, onFieldHover, selectField }}
      >
        <SourceFieldLinkShell name="customer.name">
          <label>
            Customer
            <input aria-label="Customer" />
          </label>
        </SourceFieldLinkShell>
      </JsonFormSourceLinkProvider>
    )

    const input = screen.getByLabelText("Customer")
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.keyDown(input, { key: " " })
    fireEvent.blur(input)

    expect(onFieldHover).toHaveBeenCalledWith("customer.name")
    expect(onFieldHover).toHaveBeenCalledWith(null)
    expect(selectField).toHaveBeenCalledTimes(1)
    expect(selectField).toHaveBeenCalledWith("customer.name")
  })

  it("owns table-cell active state, hover preview, and selection", async () => {
    const onFieldHover = vi.fn()
    const selectField = vi.fn()

    function TableSourceHarness() {
      const tableRef = React.useRef<HTMLDivElement>(null)
      const sourceTable = useSourceLinkedTableCells({
        tableRef,
        refreshKey: 1,
      })

      return (
        <div
          ref={tableRef}
          onPointerMove={
            sourceTable.sourceLinked ? sourceTable.handlePointerMove : undefined
          }
          onFocus={sourceTable.handleFocus}
          onBlur={sourceTable.handleBlur}
        >
          <button
            type="button"
            data-table-cell=""
            data-anchor-path="rows.0.value"
            onClick={(event) =>
              sourceTable.selectCellSource(
                sourceTable.getCellFromTarget(event.target)
              )
            }
          >
            Value
          </button>
        </div>
      )
    }

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activePath: "rows.0.value", onFieldHover, selectField }}
      >
        <TableSourceHarness />
      </JsonFormSourceLinkProvider>
    )

    const cell = screen.getByRole("button", { name: "Value" })
    await waitFor(() =>
      expect(cell.getAttribute("data-anchor-active")).toBe("true")
    )

    fireEvent.pointerMove(cell, { clientX: 12, clientY: 16 })
    await waitFor(() =>
      expect(onFieldHover).toHaveBeenCalledWith("rows.0.value")
    )

    fireEvent.click(cell)
    expect(selectField).toHaveBeenCalledWith("rows.0.value")

    fireEvent.focus(cell)
    fireEvent.blur(cell)
    expect(onFieldHover).toHaveBeenCalledWith(null)
  })

  it("updates table-cell source hover during scroll without clearing it", async () => {
    const onFieldHover = vi.fn()
    const selectField = vi.fn()

    function TableSourceHarness() {
      const tableRef = React.useRef<HTMLDivElement>(null)
      const sourceTable = useSourceLinkedTableCells({
        tableRef,
        refreshKey: 2,
      })

      return (
        <div
          ref={tableRef}
          onPointerMove={
            sourceTable.sourceLinked ? sourceTable.handlePointerMove : undefined
          }
          onScroll={() => {
            sourceTable.handleScrollStart()
            sourceTable.handleScrollMove()
          }}
        >
          <button
            type="button"
            data-table-cell=""
            data-anchor-path="rows.0.value"
          >
            Row 1
          </button>
          <button
            type="button"
            data-table-cell=""
            data-anchor-path="rows.1.value"
          >
            Row 2
          </button>
        </div>
      )
    }

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activePath: null, onFieldHover, selectField }}
      >
        <TableSourceHarness />
      </JsonFormSourceLinkProvider>
    )

    const firstCell = screen.getByRole("button", { name: "Row 1" })
    const secondCell = screen.getByRole("button", { name: "Row 2" })
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => secondCell),
    })

    try {
      fireEvent.pointerMove(firstCell, { clientX: 12, clientY: 16 })
      await waitFor(() =>
        expect(onFieldHover).toHaveBeenCalledWith("rows.0.value")
      )

      onFieldHover.mockClear()
      fireEvent.scroll(firstCell.parentElement!)

      await waitFor(() =>
        expect(onFieldHover).toHaveBeenCalledWith("rows.1.value")
      )
      expect(onFieldHover).not.toHaveBeenCalledWith(null)
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      })
    }
  })
})
