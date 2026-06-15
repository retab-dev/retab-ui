// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InteractiveItemList } from "@/registry/new-york-v4/ui/interactive-item-list"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type TestItem = {
  id: string
  disabled?: boolean
  label: string
}

const ITEMS: TestItem[] = [
  { id: "alpha", label: "Alpha" },
  { id: "bravo", label: "Bravo" },
  { id: "charlie", label: "Charlie", disabled: true },
]

function renderList({
  activeItemId,
  items = ITEMS,
  selectedItemId,
}: {
  activeItemId?: string | null
  items?: readonly TestItem[]
  selectedItemId?: string | null
} = {}) {
  const callbacks = {
    activate: vi.fn(),
    clearPreview: vi.fn(),
    clearSelection: vi.fn(),
    preview: vi.fn(),
  }

  render(
    <div style={{ height: 320 }}>
      <InteractiveItemList
        aria-label="Evidence"
        activeItemId={activeItemId}
        items={items}
        onActivateItem={callbacks.activate}
        onClearPreview={callbacks.clearPreview}
        onClearSelection={callbacks.clearSelection}
        onPreviewItem={callbacks.preview}
        renderItem={(item, state) => (
          <span>
            {item.label}
            {state.isActive ? " active" : ""}
            {state.isSelected ? " selected" : ""}
          </span>
        )}
        selectedItemId={selectedItemId}
      />
    </div>
  )

  return callbacks
}

function option(name: RegExp) {
  return screen.getByRole("option", { name })
}

async function waitForScheduledFocus() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function rowToken(name: string) {
  return Number(screen.getByTestId(`row-token-${name}`).textContent)
}

describe("InteractiveItemList", () => {
  it("renders deterministic rows in zero-measure environments", () => {
    render(
      <div style={{ height: 0 }}>
        <InteractiveItemList
          aria-label="Evidence"
          estimateSize={50}
          items={ITEMS}
          renderItem={(item) => item.label}
        />
      </div>
    )

    expect(
      screen.getAllByRole("option").map((node) => node.textContent)
    ).toEqual(["Alpha", "Bravo", "Charlie"])
    expect(screen.getByRole("listbox", { name: "Evidence" }).style.height).toBe(
      "174px"
    )
  })

  it("renders listbox options with active, selected, and disabled states", () => {
    renderList({ activeItemId: "alpha", selectedItemId: "bravo" })

    expect(screen.getByRole("listbox", { name: "Evidence" })).toBeTruthy()
    expect(option(/alpha/i).getAttribute("data-active")).toBe("true")
    expect(option(/alpha/i).getAttribute("aria-selected")).toBe("false")
    expect(option(/bravo/i).getAttribute("data-selected")).toBe("true")
    expect(option(/bravo/i).getAttribute("aria-selected")).toBe("true")
    expect(option(/charlie/i).getAttribute("aria-disabled")).toBe("true")
  })

  it("previews on hover and focus, clears preview on leave and blur", () => {
    const callbacks = renderList()
    const alpha = option(/alpha/i)

    fireEvent.mouseEnter(alpha)
    fireEvent.focus(alpha)
    fireEvent.mouseLeave(alpha)
    fireEvent.blur(alpha)

    expect(callbacks.preview.mock.calls).toEqual([[ITEMS[0]], [ITEMS[0]]])
    expect(callbacks.clearPreview).toHaveBeenCalledTimes(2)
  })

  it("reports the top visible row while scrolling", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 0
    })
    const onVisibleItemChange = vi.fn()
    render(
      <div style={{ height: 120 }}>
        <InteractiveItemList
          aria-label="Evidence"
          estimateSize={50}
          items={[
            ...ITEMS,
            { id: "delta", label: "Delta" },
            { id: "echo", label: "Echo" },
          ]}
          onVisibleItemChange={onVisibleItemChange}
          renderItem={(item) => item.label}
        />
      </div>
    )

    const viewport = screen
      .getByRole("listbox", { name: "Evidence" })
      .closest('[data-slot="scroll-area-viewport"]') as HTMLDivElement
    viewport.scrollTop = 55
    fireEvent.scroll(viewport)

    expect(onVisibleItemChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bravo" })
    )
  })

  it("activates focused rows with click, Enter, and Space", () => {
    const callbacks = renderList()
    const alpha = option(/alpha/i)

    fireEvent.click(alpha)
    fireEvent.keyDown(alpha, { key: "Enter" })
    fireEvent.keyDown(alpha, { key: " " })

    expect(callbacks.activate.mock.calls).toEqual([
      [ITEMS[0]],
      [ITEMS[0]],
      [ITEMS[0]],
    ])
  })

  it("does not preview or activate disabled rows", () => {
    const callbacks = renderList()
    const charlie = option(/charlie/i)

    fireEvent.mouseEnter(charlie)
    fireEvent.focus(charlie)
    fireEvent.click(charlie)
    fireEvent.keyDown(charlie, { key: "Enter" })

    expect(callbacks.preview).not.toHaveBeenCalled()
    expect(callbacks.activate).not.toHaveBeenCalled()
  })

  it("moves focus with ArrowDown, ArrowUp, Home, and End while skipping disabled rows", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 0
    })
    renderList()
    const alpha = option(/alpha/i)

    alpha.focus()
    fireEvent.keyDown(alpha, { key: "ArrowDown" })
    await waitForScheduledFocus()
    expect(document.activeElement).toBe(option(/bravo/i))

    fireEvent.keyDown(option(/bravo/i), { key: "ArrowUp" })
    await waitForScheduledFocus()
    expect(document.activeElement).toBe(option(/alpha/i))

    fireEvent.keyDown(option(/alpha/i), { key: "End" })
    await waitForScheduledFocus()
    expect(document.activeElement).toBe(option(/bravo/i))

    fireEvent.keyDown(option(/bravo/i), { key: "Home" })
    await waitForScheduledFocus()
    expect(document.activeElement).toBe(option(/alpha/i))

    fireEvent.keyDown(option(/alpha/i), { key: "ArrowUp" })
    await waitForScheduledFocus()
    expect(document.activeElement).toBe(option(/alpha/i))
  })

  it("clears preview and selection on Escape", () => {
    const callbacks = renderList()
    fireEvent.keyDown(option(/alpha/i), { key: "Escape" })

    expect(callbacks.clearPreview).toHaveBeenCalledTimes(1)
    expect(callbacks.clearSelection).toHaveBeenCalledTimes(1)
  })

  it("renders an empty state without options", () => {
    render(
      <InteractiveItemList
        aria-label="Evidence"
        emptyLabel="No evidence."
        items={[]}
        renderItem={(item: TestItem) => item.label}
      />
    )

    expect(screen.getByText("No evidence.")).toBeTruthy()
    expect(screen.queryAllByRole("option")).toHaveLength(0)
  })

  it("preserves row identity by item id after reorder and filtering", () => {
    let token = 0

    function StatefulRow({ item }: { item: TestItem }) {
      const tokenRef = React.useRef(++token)

      return (
        <span>
          {item.label}{" "}
          <span data-testid={`row-token-${item.id}`}>{tokenRef.current}</span>
        </span>
      )
    }

    const { rerender } = render(
      <InteractiveItemList
        aria-label="Evidence"
        items={ITEMS}
        renderItem={(item) => <StatefulRow item={item} />}
        selectedItemId="bravo"
      />
    )
    const alphaToken = rowToken("alpha")
    const bravoToken = rowToken("bravo")
    const charlieToken = rowToken("charlie")

    rerender(
      <InteractiveItemList
        aria-label="Evidence"
        items={[ITEMS[1]!, ITEMS[0]!, ITEMS[2]!]}
        renderItem={(item) => <StatefulRow item={item} />}
        selectedItemId="bravo"
      />
    )

    expect(rowToken("alpha")).toBe(alphaToken)
    expect(rowToken("bravo")).toBe(bravoToken)
    expect(rowToken("charlie")).toBe(charlieToken)
    expect(option(/bravo/i).getAttribute("aria-selected")).toBe("true")
    expect(option(/alpha/i).getAttribute("aria-selected")).toBe("false")

    rerender(
      <InteractiveItemList
        aria-label="Evidence"
        items={[ITEMS[0]!, ITEMS[2]!]}
        renderItem={(item) => <StatefulRow item={item} />}
        selectedItemId="bravo"
      />
    )

    expect(screen.queryByRole("option", { name: /bravo/i })).toBeNull()
    expect(rowToken("alpha")).toBe(alphaToken)
    expect(rowToken("charlie")).toBe(charlieToken)
    expect(option(/alpha/i).getAttribute("aria-selected")).toBe("false")
  })
})
