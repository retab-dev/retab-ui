// @vitest-environment jsdom
import * as React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { type SegmentInteraction } from "@/lib/segment-interaction"
import { toSegments, type Segment } from "@/lib/segments"
import { SegmentLegend } from "@/components/ui/segment-legend"

afterEach(cleanup)

/** [Intro: pages 1,2] [Results: page 3] [Unused: no pages] */
const segments = toSegments([
  { name: "Intro", pages: [1, 2] },
  { name: "Results", pages: [3] },
  { name: "Unused", pages: [] },
])

function segment(
  overrides: Partial<Segment> & Pick<Segment, "id" | "index" | "label">
): Segment {
  return { pages: [], color: "#000000", confidence: null, ...overrides }
}

function createInteraction(
  overrides: Partial<SegmentInteraction> = {}
): SegmentInteraction {
  return {
    hoveredId: null,
    focusedId: null,
    selectedId: null,
    setHoveredId: vi.fn(),
    setFocusedId: vi.fn(),
    setSelectedId: vi.fn(),
    clearSelection: vi.fn(),
    selectSegment: vi.fn(),
    ...overrides,
  }
}

function root(): HTMLElement {
  return document.querySelector('[data-slot="segment-legend"]') as HTMLElement
}

function entriesContainer(): HTMLElement | null | undefined {
  return screen.getByRole("button", { name: "Intro" }).parentElement
}

function legendButton(name: string): HTMLElement {
  // Segment buttons live inside the entries grid; the toggle/caption do not.
  return screen.getByRole("button", { name })
}

// ---------------------------------------------------------------------------
// Rendering / chrome
// ---------------------------------------------------------------------------

describe("SegmentLegend — chrome & variants", () => {
  it("defaults to the bar variant with a bottom border when docked to the top", () => {
    render(<SegmentLegend segments={segments} />)
    const el = root()
    expect(el.getAttribute("data-variant")).toBe("bar")
    expect(el.className).toContain("border-b")
    expect(el.className).toContain("bg-background")
  })

  it("docks a vertical bar to the left edge (border-r) by default", () => {
    render(<SegmentLegend segments={segments} orientation="vertical" />)
    expect(root().className).toContain("border-r")
  })

  it.each([
    ["top", "border-b"],
    ["bottom", "border-t"],
    ["left", "border-r"],
    ["right", "border-l"],
  ] as const)("honours an explicit side=%s on the bar (%s)", (side, border) => {
    render(<SegmentLegend segments={segments} side={side} />)
    expect(root().className).toContain(border)
  })

  it("renders the floating variant as an anchored, elevated overlay", () => {
    render(<SegmentLegend segments={segments} variant="floating" />)
    const el = root()
    expect(el.getAttribute("data-variant")).toBe("floating")
    expect(el.className).toContain("absolute")
    expect(el.className).toContain("shadow-md")
    expect(el.className).toContain("z-10")
  })

  it.each([
    ["top", "left-3 top-3"],
    ["bottom", "bottom-3 left-3"],
    ["left", "left-3 top-3"],
    ["right", "right-3 top-3"],
  ] as const)("anchors a floating legend for side=%s", (side, anchor) => {
    render(<SegmentLegend segments={segments} variant="floating" side={side} />)
    for (const token of anchor.split(" ")) {
      expect(root().className).toContain(token)
    }
  })

  it("renders the plain variant with no border or background chrome", () => {
    render(<SegmentLegend segments={segments} variant="plain" />)
    const el = root()
    expect(el.getAttribute("data-variant")).toBe("plain")
    expect(el.className).not.toContain("border")
    expect(el.className).not.toContain("bg-background")
    expect(el.className).not.toContain("shadow")
  })

  it("forwards a custom className onto the legend root", () => {
    render(<SegmentLegend segments={segments} className="my-custom-cls" />)
    expect(root().className).toContain("my-custom-cls")
  })
})

// ---------------------------------------------------------------------------
// Layout: orientation / columns / density
// ---------------------------------------------------------------------------

describe("SegmentLegend — layout", () => {
  it("lays horizontal entries out as a wrapping flex row by default", () => {
    render(<SegmentLegend segments={segments} showUnused />)
    const cls = entriesContainer()?.className ?? ""
    expect(cls).toContain("flex")
    expect(cls).toContain("flex-wrap")
    expect(cls).not.toContain("grid")
  })

  it("lays vertical entries out as a column rail", () => {
    render(<SegmentLegend segments={segments} showUnused orientation="vertical" />)
    const cls = entriesContainer()?.className ?? ""
    expect(cls).toContain("flex-col")
    expect(cls).not.toContain("grid")
  })

  it("renders a fixed-column grid for horizontal columns", () => {
    render(<SegmentLegend segments={segments} showUnused columns={3} />)
    const el = entriesContainer()
    expect(el?.className).toContain("grid")
    expect(el?.getAttribute("style")).toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr))"
    )
  })

  it("ignores columns for vertical orientation (stays a column, no grid style)", () => {
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        orientation="vertical"
        columns={3}
      />
    )
    const el = entriesContainer()
    expect(el?.className).toContain("flex-col")
    expect(el?.getAttribute("style") ?? "").toBe("")
  })

  it("treats columns={0} as 'no grid' (falls back to wrapping flex)", () => {
    render(<SegmentLegend segments={segments} showUnused columns={0} />)
    const el = entriesContainer()
    expect(el?.className).toContain("flex-wrap")
    expect(el?.getAttribute("style") ?? "").toBe("")
  })

  // Regression: a bare truthiness guard let -1 / 1.5 / Infinity through, which
  // emitted `display: grid` with an invalid `grid-template-columns` that a real
  // browser drops — collapsing a horizontal legend into a single column. Only a
  // positive integer should switch to the grid layout.
  it.each([-1, 1.5, 2.5, Infinity, Number.NaN])(
    "falls back to wrapping flex (not a broken grid) for invalid columns=%s",
    (cols) => {
      render(<SegmentLegend segments={segments} showUnused columns={cols} />)
      const el = entriesContainer()
      expect(el?.className).toContain("flex-wrap")
      expect(el?.className).not.toContain("grid")
      expect(el?.getAttribute("style") ?? "").toBe("")
    }
  )

  it("accepts columns={1} as a valid single-column grid", () => {
    render(<SegmentLegend segments={segments} showUnused columns={1} />)
    const el = entriesContainer()
    expect(el?.className).toContain("grid")
    expect(el?.getAttribute("style")).toContain(
      "grid-template-columns: repeat(1, minmax(0, 1fr))"
    )
  })

  it.each([
    ["comfortable", "h-3", "w-5", "text-xs"],
    ["compact", "h-2.5", "w-4", "text-[11px]"],
  ] as const)(
    "applies %s density swatch and text scale",
    (density, h, w, text) => {
      render(<SegmentLegend segments={segments} density={density} />)
      const button = legendButton("Intro")
      expect(button.className).toContain(text)
      const swatch = button.querySelector("span[aria-hidden]") as HTMLElement
      expect(swatch.className).toContain(h)
      expect(swatch.className).toContain(w)
    }
  )
})

// ---------------------------------------------------------------------------
// Swatches & labels
// ---------------------------------------------------------------------------

describe("SegmentLegend — swatches & labels", () => {
  it("paints each swatch with the segment color", () => {
    const colored = [
      segment({ id: "a", index: 0, label: "A", pages: [1], color: "#ff0000" }),
      segment({ id: "b", index: 1, label: "B", pages: [2], color: "#00ff00" }),
    ]
    render(<SegmentLegend segments={colored} />)
    const swatchA = legendButton("A").querySelector(
      "span[aria-hidden]"
    ) as HTMLElement
    expect(swatchA.style.backgroundColor).toBe("rgb(255, 0, 0)")
  })

  it("sets the title attribute to the display label", () => {
    render(<SegmentLegend segments={segments} />)
    expect(legendButton("Intro").getAttribute("title")).toBe("Intro")
  })

  it("renders a hidden semibold sizer alongside the visible label to prevent reflow", () => {
    render(<SegmentLegend segments={segments} />)
    const button = legendButton("Intro")
    // Two copies of the label: one visible, one invisible width-reservation sizer.
    const labels = within(button).getAllByText("Intro")
    expect(labels.length).toBe(2)
    const sizer = labels.find((n) => n.className.includes("invisible"))
    expect(sizer).toBeTruthy()
    expect(sizer?.className).toContain("font-semibold")
  })

  it("shows empty labels as an italic 'unnamed' entry", () => {
    render(<SegmentLegend segments={toSegments([{ name: "", pages: [1] }])} />)
    const button = screen.getByRole("button", { name: "unnamed" })
    const visible = within(button)
      .getAllByText("unnamed")
      .find((n) => !n.className.includes("invisible"))
    expect(visible?.className).toContain("italic")
  })
})

// ---------------------------------------------------------------------------
// Empty / unused handling
// ---------------------------------------------------------------------------

describe("SegmentLegend — empty & unused", () => {
  it("renders nothing for an empty segment list", () => {
    const { container } = render(<SegmentLegend segments={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when every segment is unused and no toggle is offered", () => {
    const { container } = render(
      <SegmentLegend segments={toSegments([{ name: "Only", pages: [] }])} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders only the toggle (no entries) when every segment is unused", () => {
    render(
      <SegmentLegend
        segments={toSegments([{ name: "Only", pages: [] }])}
        showUnusedToggle
      />
    )
    expect(screen.queryByRole("button", { name: "Only" })).toBeNull()
    expect(
      screen.getByRole("button", { name: /show 1 unused/i })
    ).toBeTruthy()
  })

  it("hides zero-page segments by default", () => {
    render(<SegmentLegend segments={segments} showUnusedToggle />)
    expect(screen.queryByRole("button", { name: "Unused" })).toBeNull()
  })

  it("counts every hidden segment in the toggle label", () => {
    render(
      <SegmentLegend
        segments={toSegments([
          { name: "Intro", pages: [1] },
          { name: "U1", pages: [] },
          { name: "U2", pages: [] },
        ])}
        showUnusedToggle
      />
    )
    expect(
      screen.getByRole("button", { name: "Show 2 unused segments" })
    ).toBeTruthy()
  })

  it("round-trips the uncontrolled toggle: reveal then hide", () => {
    render(<SegmentLegend segments={segments} showUnusedToggle />)

    fireEvent.click(screen.getByRole("button", { name: /show 1 unused/i }))
    expect(screen.getByRole("button", { name: "Unused" })).toBeTruthy()

    const hide = screen.getByRole("button", { name: /hide unused/i })
    fireEvent.click(hide)
    expect(screen.queryByRole("button", { name: "Unused" })).toBeNull()
  })

  it("respects defaultShowUnused for the initial uncontrolled state", () => {
    render(
      <SegmentLegend segments={segments} showUnusedToggle defaultShowUnused />
    )
    expect(screen.getByRole("button", { name: "Unused" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /hide unused/i })).toBeTruthy()
  })

  it("does not render a toggle when every segment owns pages", () => {
    render(
      <SegmentLegend segments={segments.slice(0, 2)} showUnusedToggle />
    )
    expect(screen.queryByRole("button", { name: /unused/i })).toBeNull()
  })

  it("keeps a controlled showUnused authoritative and emits change requests", () => {
    const onShowUnusedChange = vi.fn()
    render(
      <SegmentLegend
        segments={segments}
        showUnused={false}
        showUnusedToggle
        onShowUnusedChange={onShowUnusedChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /show 1 unused/i }))
    // Controlled: visibility must not change on its own.
    expect(screen.queryByRole("button", { name: "Unused" })).toBeNull()
    expect(onShowUnusedChange).toHaveBeenCalledWith(true)
  })

  it("emits the inverse value from a controlled, already-revealed toggle", () => {
    const onShowUnusedChange = vi.fn()
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        showUnusedToggle
        onShowUnusedChange={onShowUnusedChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /hide unused/i }))
    expect(onShowUnusedChange).toHaveBeenCalledWith(false)
  })

  it("treats only-invalid-page segments as unused", () => {
    render(
      <SegmentLegend
        segments={[
          segment({
            id: "bad",
            index: 0,
            label: "Bad",
            pages: [Number.NaN, Infinity, 0, -1, 1.5],
          }),
        ]}
        showUnusedToggle
      />
    )
    expect(screen.queryByRole("button", { name: "Bad" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /show 1 unused/i }))
    expect(screen.getByRole("button", { name: "Bad" })).toBeTruthy()
  })

  it("treats mixed valid and invalid pages as used", () => {
    render(
      <SegmentLegend
        segments={[
          segment({
            id: "mixed",
            index: 0,
            label: "Mixed",
            pages: [Number.NaN, 2, Infinity, 0, -1, 1.5],
          }),
        ]}
        showUnusedToggle
      />
    )
    expect(screen.getByRole("button", { name: "Mixed" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /unused/i })).toBeNull()
  })

  it("updates the hidden count when the segment list changes", () => {
    const { rerender } = render(
      <SegmentLegend
        segments={toSegments([
          { name: "Intro", pages: [1] },
          { name: "Unused", pages: [] },
        ])}
        showUnusedToggle
      />
    )
    expect(
      screen.getByRole("button", { name: "Show 1 unused segments" })
    ).toBeTruthy()

    rerender(
      <SegmentLegend
        segments={toSegments([
          { name: "Intro", pages: [1] },
          { name: "Unused", pages: [] },
          { name: "Also unused", pages: [] },
        ])}
        showUnusedToggle
      />
    )

    expect(
      screen.getByRole("button", { name: "Show 2 unused segments" })
    ).toBeTruthy()
  })

  it("lets controlled showUnused change from hidden to revealed and back", () => {
    const { rerender } = render(
      <SegmentLegend segments={segments} showUnused={false} showUnusedToggle />
    )
    expect(screen.queryByRole("button", { name: "Unused" })).toBeNull()

    rerender(
      <SegmentLegend segments={segments} showUnused showUnusedToggle />
    )
    expect(screen.getByRole("button", { name: "Unused" })).toBeTruthy()

    rerender(
      <SegmentLegend segments={segments} showUnused={false} showUnusedToggle />
    )
    expect(screen.queryByRole("button", { name: "Unused" })).toBeNull()
  })

  it("keeps uncontrolled reveal active for newly-added unused segments", () => {
    const { rerender } = render(
      <SegmentLegend
        segments={toSegments([
          { name: "Intro", pages: [1] },
          { name: "Unused", pages: [] },
        ])}
        showUnusedToggle
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /show 1 unused/i }))

    rerender(
      <SegmentLegend
        segments={toSegments([
          { name: "Intro", pages: [1] },
          { name: "Unused", pages: [] },
          { name: "Also unused", pages: [] },
        ])}
        showUnusedToggle
      />
    )

    expect(screen.getByRole("button", { name: "Unused" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Also unused" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /hide unused/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Interaction wiring
// ---------------------------------------------------------------------------

describe("SegmentLegend — interaction", () => {
  it("routes hover, focus, click and clear events to the interaction controller", () => {
    const setHoveredId = vi.fn()
    const setFocusedId = vi.fn()
    const selectSegment = vi.fn()
    const onSelect = vi.fn()
    const intro = segments[0]
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        interaction={createInteraction({
          setHoveredId,
          setFocusedId,
          selectSegment,
        })}
        onSelect={onSelect}
      />
    )
    const button = legendButton("Intro")
    fireEvent.mouseEnter(button)
    fireEvent.focus(button)
    fireEvent.click(button)
    fireEvent.mouseLeave(button)
    fireEvent.blur(button)

    expect(setHoveredId).toHaveBeenNthCalledWith(1, intro.id)
    expect(setHoveredId).toHaveBeenLastCalledWith(null)
    expect(setFocusedId).toHaveBeenNthCalledWith(1, intro.id)
    expect(setFocusedId).toHaveBeenLastCalledWith(null)
    expect(selectSegment).toHaveBeenCalledWith(intro)
    expect(onSelect).toHaveBeenCalledWith(intro)
  })

  it("fires onSelect even without an interaction controller", () => {
    const onSelect = vi.fn()
    render(<SegmentLegend segments={segments} onSelect={onSelect} />)
    fireEvent.click(legendButton("Intro"))
    expect(onSelect).toHaveBeenCalledWith(segments[0])
  })

  it("does not throw when clicked as a static legend (no interaction/onSelect)", () => {
    render(<SegmentLegend segments={segments} />)
    expect(() => fireEvent.click(legendButton("Intro"))).not.toThrow()
  })

  it("dims the non-highlighted entries when one is hovered", () => {
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        interaction={createInteraction({ hoveredId: segments[0].id })}
      />
    )
    expect(legendButton("Intro").className).toContain("opacity-100")
    expect(legendButton("Results").className).toContain("opacity-40")
  })

  it("does not dim anything when the highlighted id is not visible (scoped out)", () => {
    // selectedId points at the hidden 'Unused' segment; once scoped to the
    // visible set it resolves to null, so nothing should dim.
    render(
      <SegmentLegend
        segments={segments}
        interaction={createInteraction({ selectedId: segments[2].id })}
      />
    )
    expect(legendButton("Intro").className).toContain("opacity-100")
    expect(legendButton("Results").className).toContain("opacity-100")
  })

  it("does not dim every entry for an unknown/stale interaction id", () => {
    render(
      <SegmentLegend
        segments={segments.slice(0, 2)}
        interaction={createInteraction({ selectedId: "removed#99" })}
      />
    )
    expect(legendButton("Intro").className).toContain("opacity-100")
    expect(legendButton("Results").className).toContain("opacity-100")
  })

  it("re-scopes selection when a hidden selected segment is revealed via the toggle", () => {
    // 'Unused' is selected but hidden: nothing dims. After revealing it, it
    // must become the highlighted entry and dim the others.
    render(
      <SegmentLegend
        segments={segments}
        showUnusedToggle
        interaction={createInteraction({ selectedId: segments[2].id })}
      />
    )
    expect(legendButton("Intro").className).toContain("opacity-100")

    fireEvent.click(screen.getByRole("button", { name: /show 1 unused/i }))

    expect(legendButton("Unused").getAttribute("aria-pressed")).toBe("true")
    expect(legendButton("Unused").className).toContain("opacity-100")
    expect(legendButton("Intro").className).toContain("opacity-40")
    expect(legendButton("Results").className).toContain("opacity-40")
  })

  it("reflects selection via aria-pressed and data-selected", () => {
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        interaction={createInteraction({ selectedId: segments[0].id })}
      />
    )
    const intro = legendButton("Intro")
    expect(intro.getAttribute("aria-pressed")).toBe("true")
    expect(intro.getAttribute("data-selected")).toBe("true")
    expect(legendButton("Results").getAttribute("aria-pressed")).toBe("false")
  })

  it("gives hover precedence over focus and selection when dimming entries", () => {
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        interaction={createInteraction({
          hoveredId: segments[1].id,
          focusedId: segments[0].id,
          selectedId: segments[2].id,
        })}
      />
    )

    expect(legendButton("Results").getAttribute("data-highlighted")).toBe(
      "true"
    )
    expect(legendButton("Intro").getAttribute("data-highlighted")).toBe(
      "false"
    )
    expect(legendButton("Unused").getAttribute("data-highlighted")).toBe(
      "false"
    )
    expect(legendButton("Results").className).toContain("opacity-100")
    expect(legendButton("Intro").className).toContain("opacity-40")
    expect(legendButton("Unused").className).toContain("opacity-40")
  })

  it("gives focus precedence over selection when nothing is hovered", () => {
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        interaction={createInteraction({
          focusedId: segments[1].id,
          selectedId: segments[0].id,
        })}
      />
    )

    expect(legendButton("Results").getAttribute("data-highlighted")).toBe(
      "true"
    )
    expect(legendButton("Intro").getAttribute("aria-pressed")).toBe("true")
    expect(legendButton("Intro").getAttribute("data-highlighted")).toBe(
      "false"
    )
    expect(legendButton("Intro").className).toContain("opacity-40")
  })

  it("preserves persistent selection after hover leaves", () => {
    function Harness() {
      const [hoveredId, setHoveredId] = React.useState<string | null>(null)
      return (
        <SegmentLegend
          segments={segments}
          interaction={createInteraction({
            hoveredId,
            selectedId: segments[0].id,
            setHoveredId,
          })}
        />
      )
    }

    render(<Harness />)
    const results = legendButton("Results")

    fireEvent.mouseEnter(results)
    expect(results.getAttribute("data-highlighted")).toBe("true")
    expect(legendButton("Intro").className).toContain("opacity-40")

    fireEvent.mouseLeave(results)
    expect(legendButton("Intro").getAttribute("data-highlighted")).toBe("true")
    expect(legendButton("Intro").className).toContain("opacity-100")
    expect(results.className).toContain("opacity-40")
  })

  it("re-scopes highlighted state after selected segments are removed", () => {
    const { rerender } = render(
      <SegmentLegend
        segments={segments}
        interaction={createInteraction({ selectedId: segments[0].id })}
      />
    )
    expect(legendButton("Results").className).toContain("opacity-40")

    rerender(
      <SegmentLegend
        segments={segments.slice(1, 2)}
        interaction={createInteraction({ selectedId: segments[0].id })}
      />
    )

    expect(legendButton("Results").className).toContain("opacity-100")
    expect(legendButton("Results").getAttribute("aria-pressed")).toBe("false")
  })

  it("does not clear hover or focus owned by another segment from stale leave/blur events", () => {
    const setHoveredId = vi.fn()
    const setFocusedId = vi.fn()
    render(
      <SegmentLegend
        segments={segments}
        interaction={createInteraction({
          hoveredId: segments[1].id,
          focusedId: segments[1].id,
          setHoveredId,
          setFocusedId,
        })}
      />
    )

    fireEvent.mouseLeave(legendButton("Intro"))
    fireEvent.blur(legendButton("Intro"))

    expect(setHoveredId).not.toHaveBeenCalled()
    expect(setFocusedId).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Current page
// ---------------------------------------------------------------------------

describe("SegmentLegend — current page", () => {
  it("marks the segment owning the current page and bolds its label", () => {
    render(<SegmentLegend segments={segments} showUnused currentPage={3} />)
    const results = legendButton("Results")
    expect(results.getAttribute("data-current")).toBe("true")
    expect(legendButton("Intro").getAttribute("data-current")).toBe("false")
  })

  it("treats current and selected as independent signals", () => {
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        currentPage={3}
        interaction={createInteraction({ selectedId: segments[0].id })}
      />
    )
    const intro = legendButton("Intro")
    const results = legendButton("Results")
    expect(intro.getAttribute("aria-pressed")).toBe("true")
    expect(intro.getAttribute("data-current")).toBe("false")
    expect(results.getAttribute("aria-pressed")).toBe("false")
    expect(results.getAttribute("data-current")).toBe("true")
  })

  it("marks every overlapping owner of the current page", () => {
    const overlapping = [
      segment({ id: "a", index: 0, label: "A", pages: [1, 2] }),
      segment({ id: "b", index: 1, label: "B", pages: [2, 3] }),
    ]
    render(<SegmentLegend segments={overlapping} currentPage={2} />)
    expect(legendButton("A").getAttribute("data-current")).toBe("true")
    expect(legendButton("B").getAttribute("data-current")).toBe("true")
  })

  it("ignores a null current page", () => {
    render(<SegmentLegend segments={segments} currentPage={null} />)
    expect(legendButton("Intro").getAttribute("data-current")).toBe("false")
    expect(legendButton("Results").getAttribute("data-current")).toBe("false")
  })

  it.each([0, -1, 1.5, Infinity, Number.NaN])(
    "ignores invalid currentPage=%s even if it appears in raw segment pages",
    (currentPage) => {
      render(
        <SegmentLegend
          segments={[
            segment({
              id: "dirty",
              index: 0,
              label: "Dirty",
              pages: [1, 0, -1, 1.5, Infinity, Number.NaN],
            }),
          ]}
          currentPage={currentPage}
        />
      )
      expect(legendButton("Dirty").getAttribute("data-current")).toBe("false")
    }
  )

  it("does not mark a revealed invalid-page segment as current", () => {
    render(
      <SegmentLegend
        segments={[
          segment({
            id: "invalid",
            index: 0,
            label: "Invalid",
            pages: [Number.NaN],
          }),
        ]}
        showUnused
        currentPage={Number.NaN}
      />
    )
    expect(legendButton("Invalid").getAttribute("data-current")).toBe("false")
  })

  it("does not crash when a revealed segment is missing its pages array", () => {
    const broken = segment({
      id: "broken",
      index: 0,
      label: "Broken",
      pages: undefined as unknown as number[],
    })

    expect(() => {
      render(<SegmentLegend segments={[broken]} showUnused currentPage={1} />)
    }).not.toThrow()
    expect(legendButton("Broken").getAttribute("data-current")).toBe("false")
  })
})

// ---------------------------------------------------------------------------
// Caption
// ---------------------------------------------------------------------------

describe("SegmentLegend — caption", () => {
  it("renders a caption beneath the entries", () => {
    render(
      <SegmentLegend segments={segments} caption="why this split happened" />
    )
    expect(screen.getByText("why this split happened")).toBeTruthy()
  })

  it("renders the caption even when only the toggle is visible (all unused)", () => {
    render(
      <SegmentLegend
        segments={toSegments([{ name: "Only", pages: [] }])}
        showUnusedToggle
        caption="all empty"
      />
    )
    expect(screen.getByText("all empty")).toBeTruthy()
  })

  it("does not render a caption container when caption is omitted", () => {
    render(<SegmentLegend segments={segments} />)
    expect(screen.queryByText(/./, { selector: ".line-clamp-2" })).toBeNull()
  })

  it("does not render an empty caption container for an empty string", () => {
    const { container } = render(<SegmentLegend segments={segments} caption="" />)
    expect(container.querySelector(".line-clamp-2")).toBeNull()
  })

  it("does not render a caption container for boolean captions", () => {
    const { container, rerender } = render(
      <SegmentLegend segments={segments} caption={false} />
    )
    expect(container.querySelector(".line-clamp-2")).toBeNull()

    rerender(<SegmentLegend segments={segments} caption />)
    expect(container.querySelector(".line-clamp-2")).toBeNull()
  })

  it("renders numeric zero as a valid React caption", () => {
    render(<SegmentLegend segments={segments} caption={0} />)
    expect(screen.getByText("0", { selector: ".line-clamp-2" })).toBeTruthy()
  })

  it("renders caption content when entries are hidden but the toggle remains", () => {
    render(
      <SegmentLegend
        segments={toSegments([{ name: "Only", pages: [] }])}
        showUnused={false}
        showUnusedToggle
        caption={<strong>pending labels</strong>}
      />
    )
    expect(screen.queryByRole("button", { name: "Only" })).toBeNull()
    expect(screen.getByText("pending labels")).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

describe("SegmentLegend — robustness", () => {
  it("renders duplicate ids without React duplicate-key warnings", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})
    render(
      <SegmentLegend
        segments={[
          segment({ id: "dup", index: 0, label: "First", pages: [1] }),
          segment({ id: "dup", index: 1, label: "Second", pages: [2] }),
        ]}
      />
    )
    const hadDupKeyWarning = consoleError.mock.calls.some((call) =>
      call.some((m) =>
        String(m).includes("Encountered two children with the same key")
      )
    )
    consoleError.mockRestore()
    expect(hadDupKeyWarning).toBe(false)
    expect(screen.getByRole("button", { name: "First" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Second" })).toBeTruthy()
  })

  it("renders duplicate labels as separate buttons", () => {
    render(
      <SegmentLegend
        segments={[
          segment({ id: "a#0", index: 0, label: "Same", pages: [1] }),
          segment({ id: "a#1", index: 1, label: "Same", pages: [2] }),
        ]}
      />
    )
    expect(screen.getAllByRole("button", { name: "Same" }).length).toBe(2)
  })

  it("renders a large segment list without error", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      segment({ id: `s#${i}`, index: i, label: `S${i}`, pages: [i + 1] })
    )
    render(<SegmentLegend segments={many} columns={4} />)
    expect(screen.getByRole("button", { name: "S0" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "S199" })).toBeTruthy()
  })
})
