// @vitest-environment jsdom
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getSegmentInteractionState,
  getSegmentSurfaceProps,
  isSegmentCurrentPage,
  resolveHighlightedSegmentId,
  scopeSegmentInteraction,
  type SegmentInteraction,
} from "@/lib/segment-interaction"
import {
  buildColorMap,
  buildPageRuns,
  confidenceLevel,
  formatPageRanges,
  meanConfidence,
  normalizePageCount,
  pageOwners,
  SEGMENT_PALETTE,
  segmentDisplayLabel,
  segmentsPageCount,
  toSegments,
  type Segment,
} from "@/lib/segments"
import { PageRibbon } from "@/components/ui/page-ribbon"
import { PageTimeline } from "@/components/ui/page-timeline"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"
import { SegmentedDocumentViewer } from "@/components/ui/segmented-document-viewer"
import {
  useControlledSegmentInteraction,
  useSegmentInteraction,
} from "@/components/ui/use-segment-interaction"
import { PartitionViewer } from "@/components/viewers/partition/partition-viewer"

vi.mock("@/components/ui/pdf-viewer", () => ({
  PdfViewer: ({
    slots,
  }: {
    slots?: { top?: React.ReactNode; left?: React.ReactNode }
  }) => (
    <div data-testid="pdf-viewer">
      {slots?.top}
      {slots?.left}
      {Array.from({ length: 6 }, (_, index) => {
        const page = index + 1
        return (
          <div key={page} data-page={page} data-slot="pdf-page">
            Page {page}
          </div>
        )
      })}
    </div>
  ),
}))

afterEach(cleanup)

const segments = toSegments([
  { name: "Intro", pages: [1, 2] },
  { name: "Results", pages: [3] },
  { name: "Unused", pages: [] },
])

function segment(
  overrides: Partial<Segment> & Pick<Segment, "id" | "index" | "label">
): Segment {
  return {
    pages: [],
    color: "#000000",
    confidence: null,
    ...overrides,
  }
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

function expectNoDuplicateKeyWarnings(renderSurface: () => void) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

  renderSurface()
  const hasDuplicateKeyWarning = consoleError.mock.calls.some((call) =>
    call.some((message) =>
      String(message).includes("Encountered two children with the same key")
    )
  )
  consoleError.mockRestore()

  expect(hasDuplicateKeyWarning).toBe(false)
}

describe("segment interaction helpers", () => {
  it("resolves highlighted id from hover, focus, then selection", () => {
    expect(resolveHighlightedSegmentId()).toBeNull()
    expect(resolveHighlightedSegmentId({ selectedId: "selected" })).toBe(
      "selected"
    )
    expect(
      resolveHighlightedSegmentId({
        focusedId: "focused",
        selectedId: "selected",
      })
    ).toBe("focused")
    expect(
      resolveHighlightedSegmentId({
        hoveredId: "hovered",
        focusedId: "focused",
        selectedId: "selected",
      })
    ).toBe("hovered")
  })

  it("marks current pages from normalized page ownership", () => {
    const intro = segments[0]

    expect(isSegmentCurrentPage(intro, 1)).toBe(true)
    expect(isSegmentCurrentPage(intro, 3)).toBe(false)
    expect(isSegmentCurrentPage(intro, null)).toBe(false)
    expect(isSegmentCurrentPage(intro)).toBe(false)
  })

  it("derives hover, focus, selection, current, and dimmed state together", () => {
    const intro = segments[0]
    const results = segments[1]

    expect(
      getSegmentInteractionState({
        segment: intro,
        interaction: createInteraction({
          hoveredId: results.id,
          focusedId: intro.id,
          selectedId: intro.id,
        }),
        currentPage: 1,
      })
    ).toEqual({
      isHovered: false,
      isFocused: true,
      isSelected: true,
      isHighlighted: false,
      isCurrent: true,
      isDimmed: true,
    })
  })

  it("lets explicit current state override page membership", () => {
    expect(
      getSegmentInteractionState({
        segment: segments[0],
        currentPage: 1,
        isCurrent: false,
      }).isCurrent
    ).toBe(false)
  })

  it("builds safe surface props without an interaction controller", () => {
    const onSelect = vi.fn()
    const { state, eventHandlers, ariaProps, dataProps } =
      getSegmentSurfaceProps({
        segment: segments[0],
        currentPage: 1,
        onSelect,
      })

    eventHandlers.onMouseEnter()
    eventHandlers.onFocus()
    eventHandlers.onMouseLeave()
    eventHandlers.onBlur()
    eventHandlers.onClick()

    expect(state.isCurrent).toBe(true)
    expect(ariaProps["aria-pressed"]).toBe(false)
    expect(dataProps["data-current"]).toBe(true)
    expect(onSelect).toHaveBeenCalledWith(segments[0])
  })

  it("selects before notifying surface click callers", () => {
    const calls: string[] = []
    const { eventHandlers } = getSegmentSurfaceProps({
      segment: segments[0],
      interaction: createInteraction({
        selectSegment: (selected) => calls.push(`select:${selected.id}`),
      }),
      onSelect: (selected) => calls.push(`notify:${selected.id}`),
    })

    eventHandlers.onClick()

    expect(calls).toEqual([
      `select:${segments[0].id}`,
      `notify:${segments[0].id}`,
    ])
  })

  it("scopes stale interaction ids to the rendered segment ids", () => {
    const validInteraction = createInteraction({
      hoveredId: segments[0].id,
      focusedId: segments[1].id,
      selectedId: segments[1].id,
    })
    const staleInteraction = createInteraction({
      hoveredId: segments[0].id,
      focusedId: "removed#1",
      selectedId: segments[1].id,
    })

    expect(
      scopeSegmentInteraction(validInteraction, [
        segments[0].id,
        segments[1].id,
      ])
    ).toBe(validInteraction)
    expect(
      scopeSegmentInteraction(staleInteraction, [segments[0].id])
    ).toMatchObject({
      hoveredId: segments[0].id,
      focusedId: null,
      selectedId: null,
    })
  })
})

describe("segment model helpers", () => {
  it("normalizes chunk labels, ids, pages, colors, and confidences", () => {
    const normalized = toSegments(
      [
        { key: "Beta", name: "Ignored name", pages: [3, 1, 3, 0, -1, 2.5, 2] },
        { name: "Alpha", pages: [] },
        { pages: [5, 4] },
        { name: "Beta", pages: [6] },
      ],
      [0.95, undefined, null, 0.5]
    )

    expect(normalized.map(({ id }) => id)).toEqual([
      "Beta#0",
      "Alpha#1",
      "#2",
      "Beta#3",
    ])
    expect(normalized.map(({ label }) => label)).toEqual([
      "Beta",
      "Alpha",
      "",
      "Beta",
    ])
    expect(normalized.map(({ pages }) => pages)).toEqual([
      [1, 2, 3],
      [],
      [4, 5],
      [6],
    ])
    expect(normalized[0].color).toBe(normalized[3].color)
    expect(normalized.map(({ confidence }) => confidence)).toEqual([
      0.95,
      null,
      null,
      0.5,
    ])
  })

  it("drops non-finite segment confidences during normalization", () => {
    const normalized = toSegments(
      [
        { name: "NaN", pages: [1] },
        { name: "Infinity", pages: [2] },
        { name: "Valid", pages: [3] },
      ],
      [Number.NaN, Infinity, 0.8]
    )

    expect(normalized.map(({ confidence }) => confidence)).toEqual([
      null,
      null,
      0.8,
    ])
  })

  it("clamps finite segment confidences during normalization", () => {
    const normalized = toSegments(
      [
        { name: "Low", pages: [1] },
        { name: "High", pages: [2] },
      ],
      [-0.2, 1.4]
    )

    expect(normalized.map(({ confidence }) => confidence)).toEqual([0, 1])
  })

  it("uses a deterministic label color map and wraps the palette", () => {
    const labels = [
      "Zulu",
      "Alpha",
      ...Array.from({ length: SEGMENT_PALETTE.length }, (_, i) => `Label ${i}`),
    ]
    const colors = buildColorMap(labels)

    expect(colors.get("Alpha")).toBe(SEGMENT_PALETTE[0])
    expect(colors.get("Zulu")).toBe(
      SEGMENT_PALETTE[(new Set(labels).size - 1) % SEGMENT_PALETTE.length]
    )
  })

  it("keys color maps by display label", () => {
    const colors = buildColorMap([" Contract ", "", "   "])

    expect(colors.get("Contract")).toBe(SEGMENT_PALETTE[0])
    expect(colors.get("unnamed")).toBe(SEGMENT_PALETTE[1])
    expect(colors.get(" Contract ")).toBeUndefined()
  })

  it("uses display labels when assigning colors", () => {
    const normalized = toSegments([
      { name: "Contract", pages: [1] },
      { name: " Contract ", pages: [2] },
      { name: "", pages: [3] },
      { name: "   ", pages: [4] },
    ])

    expect(normalized[0].color).toBe(normalized[1].color)
    expect(normalized[2].color).toBe(normalized[3].color)
    expect(normalized[0].id).toBe("Contract#0")
    expect(normalized[1].id).toBe(" Contract #1")
  })

  it("supports shared color overrides", () => {
    const colors = new Map([
      ["Intro", "#111111"],
      ["Results", "#222222"],
    ])

    expect(
      toSegments(
        [
          { name: "Intro", pages: [1] },
          { name: "Missing", pages: [2] },
        ],
        undefined,
        colors
      ).map(({ color }) => color)
    ).toEqual(["#111111", "#888888"])
  })

  it("collapses invalid, duplicate, and non-contiguous pages into ranges", () => {
    expect(buildPageRuns([3, 1, 2, 2, -4, 7, 6, 2.5])).toEqual([
      [1, 3],
      [6, 7],
    ])
    expect(formatPageRanges([3, 1, 2, 2, -4, 7, 6, 2.5])).toBe("1–3, 6–7")
    expect(formatPageRanges([])).toBe("—")
  })

  it("counts max pages and preserves overlapping owners by segment index", () => {
    const customSegments = [
      segment({ id: "first", index: 4, label: "First", pages: [1, 3] }),
      segment({ id: "second", index: 2, label: "Second", pages: [3, 4] }),
    ]
    const owners = pageOwners(customSegments)

    expect(segmentsPageCount(customSegments)).toBe(4)
    expect(owners.get(1)).toEqual([4])
    expect(owners.get(3)).toEqual([4, 2])
    expect(owners.get(2)).toBeUndefined()
  })

  it("ignores invalid pages when counting segment pages", () => {
    expect(
      segmentsPageCount([
        segment({
          id: "invalid",
          index: 0,
          label: "Invalid",
          pages: [Number.NaN, Infinity, -1, 2],
        }),
      ])
    ).toBe(2)
  })

  it("ignores invalid pages when mapping page owners", () => {
    const owners = pageOwners([
      segment({
        id: "invalid",
        index: 0,
        label: "Invalid",
        pages: [Number.NaN, Infinity, 0, -1, 1.5, 2],
      }),
    ])

    expect(Array.from(owners.entries())).toEqual([[2, [0]]])
  })

  it("normalizes page counts to positive finite integers", () => {
    expect(normalizePageCount(2.9)).toBe(2)
    expect(normalizePageCount(0)).toBe(0)
    expect(normalizePageCount(Number.NaN)).toBe(0)
    expect(normalizePageCount(Infinity)).toBe(0)
  })

  it("classifies and averages confidence values without clamping", () => {
    expect(confidenceLevel(undefined)).toBeNull()
    expect(confidenceLevel(Number.NaN)).toBeNull()
    expect(confidenceLevel(Infinity)).toBeNull()
    expect(confidenceLevel(0.95)).toBe("high")
    expect(confidenceLevel(0.75)).toBe("medium")
    expect(confidenceLevel(0.2)).toBe("low")
    expect(meanConfidence([])).toBeNull()
    expect(meanConfidence([0.25, 0.5, 1])).toBeCloseTo(0.583333, 5)
  })

  it("ignores non-finite values when averaging confidence", () => {
    expect(meanConfidence([0.5, Number.NaN, Infinity, 1])).toBe(0.75)
    expect(meanConfidence([Number.NaN, Infinity])).toBeNull()
  })

  it("normalizes display labels without changing segment ids", () => {
    expect(segmentDisplayLabel("  Contract  ")).toBe("Contract")
    expect(segmentDisplayLabel("   ")).toBe("unnamed")
    expect(toSegments([{ name: "  Contract  ", pages: [1] }])[0].id).toBe(
      "  Contract  #0"
    )
  })
})

describe("SegmentLegend", () => {
  it("hides zero-page segments by default and reveals them from the toggle", () => {
    render(<SegmentLegend segments={segments} showUnusedToggle />)

    expect(screen.queryByRole("button", { name: "Unused" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /show 1 unused/i }))

    expect(screen.getByRole("button", { name: "Unused" })).toBeTruthy()
  })

  it("emits hover, focus, selection, and segment click callbacks separately", () => {
    const setHoveredId = vi.fn()
    const setFocusedId = vi.fn()
    const selectSegment = vi.fn()
    const onSelect = vi.fn()
    const intro = segments[0]
    const interaction = createInteraction({
      setHoveredId,
      setFocusedId,
      selectSegment,
    })

    render(
      <SegmentLegend
        segments={segments}
        showUnused
        interaction={interaction}
        onSelect={onSelect}
      />
    )

    const button = screen.getByRole("button", { name: "Intro" })

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

  it("supports controlled show-unused state", () => {
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

    expect(screen.queryByRole("button", { name: "Unused" })).toBeNull()
    expect(onShowUnusedChange).toHaveBeenCalledWith(true)
  })

  it("can reveal segments when every segment is initially unused", () => {
    const unusedSegments = toSegments([
      { name: "Appendix", pages: [] },
      { name: "Notes", pages: [] },
    ])

    render(<SegmentLegend segments={unusedSegments} showUnusedToggle />)

    expect(screen.queryByRole("button", { name: "Appendix" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /show 2 unused/i }))

    expect(screen.getByRole("button", { name: "Appendix" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Notes" })).toBeTruthy()
  })

  it("keeps all-unused visibility controlled", () => {
    const onShowUnusedChange = vi.fn()
    const unusedSegments = toSegments([{ name: "Appendix", pages: [] }])

    render(
      <SegmentLegend
        segments={unusedSegments}
        showUnused={false}
        showUnusedToggle
        onShowUnusedChange={onShowUnusedChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /show 1 unused/i }))

    expect(screen.queryByRole("button", { name: "Appendix" })).toBeNull()
    expect(onShowUnusedChange).toHaveBeenCalledWith(true)
  })

  it("does not render an unused toggle when every segment owns pages", () => {
    render(<SegmentLegend segments={segments.slice(0, 2)} showUnusedToggle />)

    expect(screen.queryByRole("button", { name: /unused/i })).toBeNull()
  })

  it("treats segments with only invalid pages as unused", () => {
    render(
      <SegmentLegend
        segments={[
          segment({
            id: "invalid",
            index: 0,
            label: "Invalid",
            pages: [Number.NaN, Infinity, 0, -1, 1.5],
          }),
        ]}
        showUnusedToggle
      />
    )

    expect(screen.queryByRole("button", { name: "Invalid" })).toBeNull()

    fireEvent.click(
      screen.getByRole("button", { name: "Show 1 unused segments" })
    )

    expect(screen.getByRole("button", { name: "Invalid" })).toBeTruthy()
  })

  it("marks current and selected legend entries independently", () => {
    render(
      <SegmentLegend
        segments={segments}
        showUnused
        currentPage={3}
        interaction={createInteraction({ selectedId: segments[0].id })}
      />
    )

    const intro = screen.getByRole("button", { name: "Intro" })
    const results = screen.getByRole("button", { name: "Results" })

    expect(intro.getAttribute("aria-pressed")).toBe("true")
    expect(intro.getAttribute("data-current")).toBe("false")
    expect(results.getAttribute("aria-pressed")).toBe("false")
    expect(results.getAttribute("data-current")).toBe("true")
  })

  it("renders empty legend labels as accessible unnamed entries", () => {
    render(<SegmentLegend segments={toSegments([{ name: "", pages: [1] }])} />)

    expect(screen.getByRole("button", { name: "unnamed" })).toBeTruthy()
  })

  it("renders whitespace-only legend labels as accessible unnamed entries", () => {
    render(
      <SegmentLegend segments={toSegments([{ name: "   ", pages: [1] }])} />
    )

    expect(screen.getByRole("button", { name: "unnamed" })).toBeTruthy()
  })

  it("does not dim all legend entries for stale interaction ids", () => {
    render(
      <SegmentLegend
        segments={segments.slice(0, 2)}
        interaction={createInteraction({ selectedId: "removed#99" })}
      />
    )

    expect(screen.getByRole("button", { name: "Intro" }).className).toContain(
      "opacity-100"
    )
    expect(screen.getByRole("button", { name: "Results" }).className).toContain(
      "opacity-100"
    )
  })

  it("applies horizontal grid columns and leaves vertical legends as a column", () => {
    const { rerender } = render(
      <SegmentLegend segments={segments} showUnused columns={3} />
    )

    const horizontalEntries = screen.getByRole("button", {
      name: "Intro",
    }).parentElement
    expect(horizontalEntries?.getAttribute("style")).toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr))"
    )

    rerender(
      <SegmentLegend
        segments={segments}
        showUnused
        orientation="vertical"
        columns={3}
      />
    )

    const verticalEntries = screen.getByRole("button", {
      name: "Intro",
    }).parentElement
    expect(verticalEntries?.getAttribute("style") ?? "").toBe("")
  })

  it("ignores invalid legend column counts", () => {
    const { rerender } = render(
      <SegmentLegend segments={segments} showUnused columns={-1} />
    )

    let entries = screen.getByRole("button", { name: "Intro" }).parentElement
    expect(entries?.getAttribute("style") ?? "").toBe("")

    rerender(
      <SegmentLegend segments={segments} showUnused columns={Infinity} />
    )

    entries = screen.getByRole("button", { name: "Intro" }).parentElement
    expect(entries?.getAttribute("style") ?? "").toBe("")
  })

  it("renders duplicate segment ids without duplicate React keys", () => {
    expectNoDuplicateKeyWarnings(() => {
      render(
        <SegmentLegend
          segments={[
            segment({ id: "duplicate", index: 0, label: "First", pages: [1] }),
            segment({ id: "duplicate", index: 1, label: "Second", pages: [2] }),
          ]}
        />
      )
    })

    expect(screen.getByRole("button", { name: "First" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Second" })).toBeTruthy()
  })
})

describe("SegmentSidebar", () => {
  it("keeps persistent selection after hover moves away", () => {
    function Harness() {
      const interaction = useSegmentInteraction()

      React.useEffect(() => {
        interaction.setSelectedId(segments[0].id)
      }, [interaction])

      return (
        <SegmentSidebar
          segments={segments}
          interaction={interaction}
          currentPage={1}
        />
      )
    }

    render(<Harness />)

    const intro = screen.getByRole("button", { name: /Intro/ })
    const results = screen.getByRole("button", { name: /Results/ })

    expect(intro.getAttribute("aria-pressed")).toBe("true")
    expect(intro.getAttribute("data-highlighted")).toBe("true")

    fireEvent.mouseEnter(results)
    expect(results.getAttribute("data-highlighted")).toBe("true")
    expect(intro.getAttribute("aria-pressed")).toBe("true")

    fireEvent.mouseLeave(results)
    expect(intro.getAttribute("aria-pressed")).toBe("true")
    expect(intro.getAttribute("data-highlighted")).toBe("true")
  })

  it("marks current page without selecting the segment", () => {
    render(<SegmentSidebar segments={segments} currentPage={3} />)

    const results = screen.getByRole("button", { name: /Results/ })

    expect(results.getAttribute("aria-current")).toBe("page")
    expect(results.getAttribute("aria-pressed")).toBe("false")
  })

  it("supports caller-owned interaction state", () => {
    function Harness() {
      const [selectedId, setSelectedId] = React.useState<string | null>(
        segments[0].id
      )
      const interaction = useControlledSegmentInteraction({
        hoveredId: null,
        focusedId: null,
        selectedId,
        setHoveredId: vi.fn(),
        setFocusedId: vi.fn(),
        setSelectedId,
      })

      return <SegmentSidebar segments={segments} interaction={interaction} />
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: /Results/ }))

    expect(
      screen.getByRole("button", { name: /Intro/ }).getAttribute("aria-pressed")
    ).toBe("false")
    expect(
      screen
        .getByRole("button", { name: /Results/ })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })

  it("clears caller-owned interaction selection", () => {
    function Harness() {
      const [selectedId, setSelectedId] = React.useState<string | null>(
        segments[0].id
      )
      const interaction = useControlledSegmentInteraction({
        hoveredId: null,
        focusedId: null,
        selectedId,
        setHoveredId: vi.fn(),
        setFocusedId: vi.fn(),
        setSelectedId,
      })

      return (
        <>
          <SegmentSidebar segments={segments} interaction={interaction} />
          <button type="button" onClick={interaction.clearSelection}>
            Clear
          </button>
        </>
      )
    }

    render(<Harness />)
    expect(
      screen.getByRole("button", { name: /Intro/ }).getAttribute("aria-pressed")
    ).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))

    expect(
      screen.getByRole("button", { name: /Intro/ }).getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("can hide unused rows and update the visible count", () => {
    render(<SegmentSidebar segments={segments} showUnused={false} />)

    expect(screen.getByText("2 segments")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Unused/ })).toBeNull()
  })

  it("renders empty labels as unnamed and clamps confidence bars", () => {
    const sidebarSegments = toSegments(
      [
        { name: "", pages: [1] },
        { name: "Overconfident", pages: [2] },
        { name: "Underconfident", pages: [3] },
      ],
      [0.42, 1.3, -0.4]
    )

    render(<SegmentSidebar segments={sidebarSegments} />)

    expect(screen.getByText("unnamed")).toBeTruthy()
    expect(screen.getByText("42%")).toBeTruthy()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByText("0%")).toBeTruthy()
  })

  it("does not render NaN confidence values", () => {
    render(
      <SegmentSidebar
        segments={[
          {
            id: "nan#0",
            label: "Invalid confidence",
            pages: [1],
            color: "#000000",
            index: 0,
            confidence: Number.NaN,
          },
        ]}
      />
    )

    expect(screen.queryByText("NaN%")).toBeNull()
    expect(screen.getByText("0%")).toBeTruthy()
  })

  it("renders whitespace-only sidebar labels as unnamed", () => {
    render(
      <SegmentSidebar segments={toSegments([{ name: "   ", pages: [1] }])} />
    )

    expect(screen.getByText("unnamed")).toBeTruthy()
  })

  it("counts only valid unique pages in sidebar metadata", () => {
    render(
      <SegmentSidebar
        segments={[
          segment({
            id: "messy",
            index: 0,
            label: "Messy",
            pages: [2, 2, Number.NaN, -1, 1.5],
          }),
        ]}
      />
    )

    expect(screen.getByText("1 page · 2")).toBeTruthy()
    expect(screen.queryByText(/5 pages/)).toBeNull()
  })

  it("does not dim all sidebar rows for stale interaction ids", () => {
    render(
      <SegmentSidebar
        segments={segments}
        interaction={createInteraction({ hoveredId: "removed#99" })}
      />
    )

    expect(
      screen.getByRole("button", { name: /Intro/ }).className
    ).not.toContain("opacity-60")
    expect(
      screen.getByRole("button", { name: /Results/ }).className
    ).not.toContain("opacity-60")
  })

  it("renders duplicate segment ids without duplicate sidebar keys", () => {
    expectNoDuplicateKeyWarnings(() => {
      render(
        <SegmentSidebar
          segments={[
            segment({ id: "duplicate", index: 0, label: "First", pages: [1] }),
            segment({ id: "duplicate", index: 1, label: "Second", pages: [2] }),
          ]}
        />
      )
    })

    expect(screen.getByRole("button", { name: /First/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Second/ })).toBeTruthy()
  })
})

describe("PageTimeline", () => {
  it("labels empty, single-segment, and overlapping pages", () => {
    const timelineSegments = toSegments([
      { name: "Contract", pages: [1, 2] },
      { name: "Addendum", pages: [2] },
    ])

    render(<PageTimeline segments={timelineSegments} pageCount={3} />)

    expect(
      screen.getByRole("button", { name: "Page 1 · Contract" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Page 2 · 2 segments" })
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Page 3" })).toBeTruthy()
  })

  it("labels pages for unnamed timeline segments", () => {
    render(<PageTimeline segments={toSegments([{ name: "", pages: [1] }])} />)

    expect(
      screen.getByRole("button", { name: "Page 1 · unnamed" })
    ).toBeTruthy()
  })

  it("labels pages for whitespace-only timeline segments", () => {
    render(
      <PageTimeline segments={toSegments([{ name: "   ", pages: [1] }])} />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · unnamed" })
    ).toBeTruthy()
  })

  it("does not confuse timeline segments with duplicate index fields", () => {
    const duplicateIndexSegments = [
      segment({
        id: "first",
        index: 0,
        label: "First",
        pages: [1],
        color: "#111111",
      }),
      segment({
        id: "second",
        index: 0,
        label: "Second",
        pages: [2],
        color: "#222222",
      }),
    ]

    render(<PageTimeline segments={duplicateIndexSegments} />)

    expect(screen.getByRole("button", { name: "Page 1 · First" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Page 2 · Second" })).toBeTruthy()
  })

  it("selects the first segment for overlapping pages without dimming shared mappings", () => {
    const onSelect = vi.fn()
    const onSelectPage = vi.fn()
    const selectSegment = vi.fn()
    const overlappingSegments = toSegments([
      { name: "Contract", pages: [1, 2] },
      { name: "Addendum", pages: [2] },
    ])
    const interaction = createInteraction({
      hoveredId: overlappingSegments[1].id,
      selectSegment,
    })

    render(
      <PageTimeline
        segments={overlappingSegments}
        interaction={interaction}
        onSelect={onSelect}
        onSelectPage={onSelectPage}
      />
    )

    const overlappingPage = screen.getByRole("button", {
      name: "Page 2 · 2 segments",
    })
    fireEvent.click(overlappingPage)

    expect(overlappingPage.getAttribute("data-highlighted")).toBe("false")
    expect(overlappingPage.className).toContain("opacity-100")
    expect(selectSegment).toHaveBeenCalledWith(overlappingSegments[0])
    expect(onSelect).toHaveBeenCalledWith(overlappingSegments[0])
    expect(onSelectPage).toHaveBeenCalledWith(2)
  })

  it("lets empty pages trigger page selection without segment selection", () => {
    const onSelectPage = vi.fn()
    const selectSegment = vi.fn()
    const timelineSegments = toSegments([{ name: "Contract", pages: [1] }])

    render(
      <PageTimeline
        segments={timelineSegments}
        pageCount={2}
        interaction={createInteraction({ selectSegment })}
        onSelectPage={onSelectPage}
      />
    )

    const emptyPage = screen.getByRole("button", { name: "Page 2" })
    fireEvent.click(emptyPage)

    expect(selectSegment).not.toHaveBeenCalled()
    expect(onSelectPage).toHaveBeenCalledWith(2)
  })

  it("uses explicit pageCount to render trailing unmapped pages", () => {
    render(<PageTimeline segments={segments.slice(0, 1)} pageCount={4} />)

    expect(screen.getByRole("button", { name: "Page 1 · Intro" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Page 4" })).toBeTruthy()
  })

  it("marks the current page even when no segment owns it", () => {
    render(
      <PageTimeline
        segments={segments.slice(0, 1)}
        pageCount={3}
        currentPage={3}
      />
    )

    const emptyCurrentPage = screen.getByRole("button", { name: "Page 3" })
    expect(emptyCurrentPage.getAttribute("aria-current")).toBe("page")
    expect(emptyCurrentPage.getAttribute("data-current")).toBe("true")
  })

  it("does not dim pages for stale highlighted segment ids", () => {
    render(
      <PageTimeline
        segments={segments}
        interaction={createInteraction({ selectedId: "missing" })}
      />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · Intro" }).className
    ).toContain("opacity-100")
    expect(
      screen.getByRole("button", { name: "Page 3 · Results" }).className
    ).toContain("opacity-100")
  })

  it("does not dim mapped pages when a zero-page segment is selected", () => {
    render(
      <PageTimeline
        segments={segments}
        interaction={createInteraction({ selectedId: segments[2].id })}
      />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · Intro" }).className
    ).toContain("opacity-100")
    expect(
      screen.getByRole("button", { name: "Page 3 · Results" }).className
    ).toContain("opacity-100")
  })

  it("does not dim visible pages when the selected segment is outside pageCount", () => {
    const timelineSegments = toSegments([
      { name: "Visible", pages: [1] },
      { name: "Outside", pages: [4] },
    ])

    render(
      <PageTimeline
        segments={timelineSegments}
        pageCount={3}
        interaction={createInteraction({ selectedId: timelineSegments[1].id })}
      />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · Visible" }).className
    ).toContain("opacity-100")
    expect(screen.getByRole("button", { name: "Page 3" }).className).toContain(
      "opacity-100"
    )
  })

  it("does not dim visible pages when the selected segment has only fractional pages", () => {
    const timelineSegments = [
      segment({ id: "visible", index: 0, label: "Visible", pages: [1] }),
      segment({
        id: "fractional",
        index: 1,
        label: "Fractional",
        pages: [1.5],
      }),
    ]

    render(
      <PageTimeline
        segments={timelineSegments}
        pageCount={2}
        interaction={createInteraction({ selectedId: "fractional" })}
      />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · Visible" }).className
    ).toContain("opacity-100")
    expect(screen.getByRole("button", { name: "Page 2" }).className).toContain(
      "opacity-100"
    )
  })

  it("returns no page controls when there is no implied or explicit page count", () => {
    const { container } = render(<PageTimeline segments={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it("returns no page controls for non-finite explicit page counts", () => {
    const { container, rerender } = render(
      <PageTimeline segments={segments} pageCount={Number.NaN} />
    )

    expect(container.firstChild).toBeNull()

    rerender(<PageTimeline segments={segments} pageCount={Infinity} />)

    expect(container.firstChild).toBeNull()
  })
})

describe("PageRibbon", () => {
  it("renders one button per page run and selects the run start page", () => {
    const onSelectPage = vi.fn()
    const onSelect = vi.fn()
    const selectSegment = vi.fn()
    const splitSegments = toSegments([{ name: "Intro", pages: [1, 2, 4] }])
    const segment = splitSegments[0]
    const interaction = createInteraction({ selectSegment })

    render(
      <PageRibbon
        rows={[{ id: "split", segments: splitSegments }]}
        pageCount={4}
        interaction={interaction}
        onSelect={onSelect}
        onSelectPage={onSelectPage}
      />
    )

    expect(screen.getByLabelText("Intro pages 1 to 2")).toBeTruthy()
    const secondRun = screen.getByLabelText("Intro pages 4 to 4")
    fireEvent.click(secondRun)

    expect(selectSegment).toHaveBeenCalledWith(segment)
    expect(onSelect).toHaveBeenCalledWith(segment)
    expect(onSelectPage).toHaveBeenCalledWith(4)
  })

  it("labels unnamed ribbon runs accessibly", () => {
    render(
      <PageRibbon
        rows={[
          { id: "split", segments: toSegments([{ name: "", pages: [1] }]) },
        ]}
        pageCount={1}
      />
    )

    expect(screen.getByLabelText("unnamed pages 1 to 1")).toBeTruthy()
  })

  it("labels whitespace-only ribbon runs accessibly", () => {
    render(
      <PageRibbon
        rows={[
          { id: "split", segments: toSegments([{ name: "   ", pages: [1] }]) },
        ]}
        pageCount={1}
      />
    )

    expect(screen.getByLabelText("unnamed pages 1 to 1")).toBeTruthy()
  })

  it("renders vertical ribbons, ticks, and current-page run state", () => {
    render(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 2) }]}
        pageCount={3}
        orientation="vertical"
        currentPage={2}
        showTicks
      />
    )

    const ribbon = screen.getByLabelText("Intro pages 1 to 2")
    expect(ribbon.getAttribute("data-current")).toBe("true")
    expect(screen.getByText("1")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
  })

  it("falls back for invalid ribbon row thickness", () => {
    const { container, rerender } = render(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={2}
        rowThickness={Number.NaN}
      />
    )

    expect(
      container
        .querySelector('[data-slot="page-ribbon-row"]')
        ?.getAttribute("style")
    ).toContain("height: 10px")

    rerender(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={2}
        orientation="vertical"
        rowThickness={-1}
      />
    )

    expect(
      container
        .querySelector('[data-slot="page-ribbon-row"]')
        ?.getAttribute("style")
    ).toContain("width: 44px")
  })

  it("clamps horizontal scroll progress cursor", () => {
    const { container, rerender } = render(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={2}
        scrollProgress={2}
      />
    )

    const cursor = container.querySelector(".pointer-events-none.absolute")
    expect(cursor?.getAttribute("style")).toContain("left: 100%")

    rerender(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={2}
        scrollProgress={-1}
      />
    )

    expect(
      container
        .querySelector(".pointer-events-none.absolute")
        ?.getAttribute("style")
    ).toContain("left: 0%")
  })

  it("does not render a cursor for non-finite progress or current page", () => {
    const { container, rerender } = render(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={2}
        scrollProgress={Number.NaN}
      />
    )

    expect(container.querySelector(".pointer-events-none.absolute")).toBeNull()

    rerender(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={2}
        currentPage={Number.NaN}
      />
    )

    expect(container.querySelector(".pointer-events-none.absolute")).toBeNull()
  })

  it("renders a single tick for one-page ribbons", () => {
    render(
      <PageRibbon
        rows={[
          {
            id: "single",
            segments: toSegments([{ name: "Only", pages: [1] }]),
          },
        ]}
        pageCount={1}
        showTicks
      />
    )

    expect(screen.getAllByText("1")).toHaveLength(1)
  })

  it("does not dim all ribbon runs for stale interaction ids", () => {
    render(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 2) }]}
        pageCount={3}
        interaction={createInteraction({ focusedId: "removed#99" })}
      />
    )

    expect(screen.getByLabelText("Intro pages 1 to 2").className).not.toContain(
      "opacity-30"
    )
    expect(
      screen.getByLabelText("Results pages 3 to 3").className
    ).not.toContain("opacity-30")
  })

  it("does not dim all ribbon runs when a zero-page segment is selected", () => {
    render(
      <PageRibbon
        rows={[{ id: "split", segments }]}
        pageCount={3}
        interaction={createInteraction({ selectedId: segments[2].id })}
      />
    )

    expect(screen.getByLabelText("Intro pages 1 to 2").className).not.toContain(
      "opacity-30"
    )
    expect(
      screen.getByLabelText("Results pages 3 to 3").className
    ).not.toContain("opacity-30")
  })

  it("does not render ribbon runs outside pageCount", () => {
    render(
      <PageRibbon
        rows={[
          { id: "split", segments: toSegments([{ name: "Late", pages: [4] }]) },
        ]}
        pageCount={3}
      />
    )

    expect(screen.queryByLabelText("Late pages 4 to 4")).toBeNull()
  })

  it("clips ribbon runs to the explicit pageCount", () => {
    render(
      <PageRibbon
        rows={[
          {
            id: "split",
            segments: toSegments([{ name: "Tail", pages: [2, 3, 4] }]),
          },
        ]}
        pageCount={3}
      />
    )

    const run = screen.getByLabelText("Tail pages 2 to 3")
    expect(run.getAttribute("style")).toContain("left: 33.33333333333333%")
    expect(run.getAttribute("style")).toContain("width: 66.66666666666666%")
    expect(screen.queryByLabelText("Tail pages 4 to 4")).toBeNull()
  })

  it("returns no ribbon for non-finite page counts", () => {
    const { container, rerender } = render(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={Number.NaN}
      />
    )

    expect(container.firstChild).toBeNull()

    rerender(
      <PageRibbon
        rows={[{ id: "split", segments: segments.slice(0, 1) }]}
        pageCount={Infinity}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders duplicate ribbon row and segment ids without duplicate keys", () => {
    expectNoDuplicateKeyWarnings(() => {
      render(
        <PageRibbon
          rows={[
            {
              id: "duplicate-row",
              segments: [
                segment({
                  id: "duplicate",
                  index: 0,
                  label: "First",
                  pages: [1],
                }),
              ],
            },
            {
              id: "duplicate-row",
              segments: [
                segment({
                  id: "duplicate",
                  index: 1,
                  label: "Second",
                  pages: [2],
                }),
              ],
            },
          ]}
          pageCount={2}
        />
      )
    })

    expect(screen.getByLabelText("First pages 1 to 1")).toBeTruthy()
    expect(screen.getByLabelText("Second pages 2 to 2")).toBeTruthy()
  })
})

describe("SegmentedDocumentViewer", () => {
  it("shares persistent selection between sidebar and legend", () => {
    render(<SegmentedDocumentViewer segments={segments} />)

    const sidebarIntro = screen.getByRole("button", { name: /Intro.*2 pages/ })
    fireEvent.click(sidebarIntro)

    const introButtons = screen.getAllByRole("button", { name: /Intro/ })
    expect(
      introButtons.some(
        (button) => button.getAttribute("aria-pressed") === "true"
      )
    ).toBe(true)
  })

  it("passes title, unit label, and pageCount through composed surfaces", () => {
    render(
      <SegmentedDocumentViewer
        segments={segments.slice(0, 1)}
        pageCount={4}
        title="Partition preview"
        unitLabel="chunk"
      />
    )

    expect(screen.getByText("Partition preview")).toBeTruthy()
    expect(screen.getByText("1 chunk")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Page 4" })).toBeTruthy()
  })

  it("jumps to the earliest normalized page for unsorted segment pages", () => {
    const scrolledPages: string[] = []
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function () {
      scrolledPages.push(this.getAttribute("data-page") ?? "")
    }

    try {
      render(
        <SegmentedDocumentViewer
          src="/document.pdf"
          segments={[
            segment({
              id: "manual",
              index: 0,
              label: "Manual",
              pages: [5, 1],
            }),
          ]}
        />
      )

      fireEvent.click(screen.getByRole("button", { name: /Manual.*2 pages/ }))

      expect(scrolledPages).toEqual(["1"])
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })
})

describe("partition segment composition", () => {
  it("uses display-label colors for partition keys with surrounding whitespace", () => {
    render(
      <PartitionViewer
        result={{
          output: [
            { key: "Contract", pages: [1] },
            { key: " Contract ", pages: [2] },
          ],
          consensus: { choices: [], likelihoods: null },
          usage: null,
        }}
        renderDocument={({ slots }) => <div>{slots.top}</div>}
      />
    )

    const contractButtons = screen.getAllByRole("button", { name: "Contract" })
    const swatches = contractButtons.map((button) =>
      button.querySelector("span[style]")?.getAttribute("style")
    )

    expect(contractButtons).toHaveLength(2)
    expect(swatches[0]).toBe(swatches[1])
  })

  it("jumps to the earliest normalized page when a partition legend key is selected", () => {
    const scrolledPages: string[] = []
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
      scrolledPages.push(this.getAttribute("data-page-number") ?? "")
    }

    try {
      render(
        <PartitionViewer
          result={{
            output: [{ key: "Invoices", pages: [5, 1] }],
            consensus: { choices: [], likelihoods: null },
            usage: null,
          }}
          renderDocument={({ slots }) => (
            <div>
              {slots.top}
              <div data-page-number="1" />
              <div data-page-number="5" />
            </div>
          )}
        />
      )

      fireEvent.click(screen.getByRole("button", { name: "Invoices" }))

      expect(scrolledPages).toEqual(["1"])
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it("uses the max page, not the final input page, for unsorted partition chunks", () => {
    render(
      <PartitionViewer
        result={{
          output: [{ key: "Invoices", pages: [5, 1] }],
          consensus: { choices: [], likelihoods: null },
          usage: null,
        }}
        renderDocument={({ slots }) => <div>{slots.top}</div>}
      />
    )

    expect(screen.getByRole("button", { name: "Invoices" })).toBeTruthy()
    expect(screen.getByLabelText("Invoices pages 1 to 1")).toBeTruthy()
    expect(
      screen.getByLabelText("Invoices pages 5 to 5").getAttribute("style")
    ).toContain("left: 80%; width: 20%")
  })
})
