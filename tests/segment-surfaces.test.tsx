// @vitest-environment jsdom
import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getSegmentInteractionState,
  getSegmentSurfaceProps,
  getSegmentViewState,
  isSegmentCurrentPage,
  resolvePreviewedSegmentId,
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
import type {
  PdfViewerHandle,
  PdfViewerSlots,
} from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"
import { SegmentedDocumentViewer } from "@/components/ui/segmented-document-viewer"
import {
  useControlledSegmentInteraction,
  useSegmentInteraction,
} from "@/components/ui/use-segment-interaction"
import { PartitionViewer } from "@/components/viewers/partition/partition-viewer"
import { SplitViewer } from "@/components/viewers/split/split-viewer"
import { useSegmentViewportController } from "@/components/viewers/split/use-segment-viewport-controller"

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

function createRailGeometry({
  markerBottom,
  markerOffsetHeight,
  markerOffsetTop,
  markerTop,
  viewportBottom,
  viewportHeight,
  viewportTop,
}: {
  markerBottom: number
  markerOffsetHeight: number
  markerOffsetTop: number
  markerTop: number
  viewportBottom: number
  viewportHeight: number
  viewportTop: number
}) {
  const viewport = document.createElement("div")
  const marker = document.createElement("span")
  const scrollTo = vi.fn()

  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: viewportHeight,
  })
  Object.defineProperty(viewport, "scrollTo", {
    configurable: true,
    value: scrollTo,
  })
  Object.defineProperty(marker, "offsetTop", {
    configurable: true,
    value: markerOffsetTop,
  })
  Object.defineProperty(marker, "offsetHeight", {
    configurable: true,
    value: markerOffsetHeight,
  })

  viewport.getBoundingClientRect = () =>
    ({
      bottom: viewportBottom,
      height: viewportBottom - viewportTop,
      left: 0,
      right: 0,
      top: viewportTop,
      width: 0,
      x: 0,
      y: viewportTop,
      toJSON: () => ({}),
    }) as DOMRect

  marker.getBoundingClientRect = () =>
    ({
      bottom: markerBottom,
      height: markerBottom - markerTop,
      left: 0,
      right: 0,
      top: markerTop,
      width: 0,
      x: 0,
      y: markerTop,
      toJSON: () => ({}),
    }) as DOMRect

  return { marker, scrollTo, viewport }
}

function createInteraction(
  overrides: Partial<SegmentInteraction> = {}
): SegmentInteraction {
  return {
    previewSegmentId: null,
    previewSegment: vi.fn(),
    clearPreview: vi.fn(),
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
  it("resolves the transient preview id", () => {
    expect(resolvePreviewedSegmentId()).toBeNull()
    expect(
      resolvePreviewedSegmentId({
        previewSegmentId: "previewed",
      })
    ).toBe("previewed")
  })

  it("marks current pages from normalized page ownership", () => {
    const intro = segments[0]

    expect(isSegmentCurrentPage(intro, 1)).toBe(true)
    expect(isSegmentCurrentPage(intro, 3)).toBe(false)
    expect(isSegmentCurrentPage(intro, null)).toBe(false)
    expect(isSegmentCurrentPage(intro)).toBe(false)
  })

  it("derives current and highlighted segment ids from one interaction state", () => {
    expect(
      getSegmentInteractionState({
        segments,
        currentPage: 3,
        interaction: createInteraction(),
      })
    ).toMatchObject({
      currentPage: 3,
      currentSegmentId: segments[1].id,
      currentSegmentIds: [segments[1].id],
      previewSegmentId: null,
      highlightedSegmentId: segments[1].id,
      highlightedSegmentIds: [segments[1].id],
    })

    expect(
      getSegmentInteractionState({
        segments,
        currentPage: 3,
        interaction: createInteraction({ previewSegmentId: segments[0].id }),
      })
    ).toMatchObject({
      currentPage: 3,
      currentSegmentId: segments[1].id,
      currentSegmentIds: [segments[1].id],
      previewSegmentId: segments[0].id,
      highlightedSegmentId: segments[0].id,
      highlightedSegmentIds: [segments[0].id],
    })
  })

  it("derives preview, current, highlighted, and dimmed state", () => {
    const intro = segments[0]
    const results = segments[1]
    const interactionState = getSegmentInteractionState({
      segments,
      currentPage: 1,
      interaction: createInteraction({
        previewSegmentId: results.id,
      }),
    })

    expect(
      getSegmentViewState({
        segment: intro,
        interactionState,
      })
    ).toEqual({
      isPreviewed: false,
      isCurrent: true,
      isHighlighted: false,
      isDimmed: true,
    })
  })

  it("lets explicit current state override page membership", () => {
    const interactionState = getSegmentInteractionState({
      segments,
      currentPage: 1,
      interaction: null,
    })
    expect(
      getSegmentViewState({
        segment: segments[0],
        interactionState,
        isCurrent: false,
      }).isCurrent
    ).toBe(false)
  })

  it("builds safe surface props without an interaction controller", () => {
    const onSelect = vi.fn()
    const interactionState = getSegmentInteractionState({
      segments,
      currentPage: 1,
      interaction: null,
    })
    const { state, eventHandlers, dataProps } = getSegmentSurfaceProps({
      segment: segments[0],
      interactionState,
      onSelect,
    })

    eventHandlers.onPointerEnter()
    eventHandlers.onPointerLeave()
    eventHandlers.onClick()

    expect(state.isCurrent).toBe(true)
    expect(dataProps["data-current"]).toBe(true)
    expect(dataProps["data-highlighted"]).toBe(true)
    expect(onSelect).toHaveBeenCalledWith(segments[0])
  })

  it("notifies surface click callers without writing persistent selection", () => {
    const calls: string[] = []
    const interaction = createInteraction()
    const interactionState = getSegmentInteractionState({
      segments,
      currentPage: null,
      interaction,
    })
    const { eventHandlers } = getSegmentSurfaceProps({
      segment: segments[0],
      interaction,
      interactionState,
      onSelect: (selected) => calls.push(`notify:${selected.id}`),
    })

    eventHandlers.onClick()

    expect(calls).toEqual([`notify:${segments[0].id}`])
  })

  it("scopes stale interaction ids to the rendered segment ids", () => {
    const validInteraction = createInteraction({
      previewSegmentId: segments[0].id,
    })
    const staleInteraction = createInteraction({
      previewSegmentId: "removed#1",
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
      previewSegmentId: null,
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

  it("emits hover, focus, and segment click callbacks separately", () => {
    const previewSegment = vi.fn()
    const clearPreview = vi.fn()
    const onSelect = vi.fn()
    const intro = segments[0]
    const interaction = createInteraction({
      previewSegment,
      clearPreview,
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

    fireEvent.pointerEnter(button)
    fireEvent.focus(button)
    fireEvent.click(button)
    fireEvent.pointerLeave(button)
    fireEvent.blur(button)

    expect(previewSegment).toHaveBeenCalledWith(intro.id)
    expect(clearPreview).toHaveBeenCalled()
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

  it("marks current legend entries without persistent selection", () => {
    render(<SegmentLegend segments={segments} showUnused currentPage={3} />)

    const intro = screen.getByRole("button", { name: "Intro" })
    const results = screen.getByRole("button", { name: "Results" })

    expect(intro.hasAttribute("aria-pressed")).toBe(false)
    expect(intro.getAttribute("data-current")).toBe("false")
    expect(results.hasAttribute("aria-pressed")).toBe(false)
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
        interaction={createInteraction({ previewSegmentId: "removed#99" })}
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
  it("previews current page and lets hover preview another row", () => {
    function Harness() {
      const interaction = useSegmentInteraction()

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

    expect(intro.getAttribute("aria-current")).toBe("page")
    expect(intro.hasAttribute("aria-pressed")).toBe(false)
    expect(intro.getAttribute("data-current")).toBe("true")

    fireEvent.pointerEnter(results)
    expect(results.getAttribute("data-previewed")).toBe("true")
    expect(intro.getAttribute("data-current")).toBe("true")

    fireEvent.pointerLeave(results)
    expect(results.getAttribute("data-previewed")).toBe("false")
    expect(intro.getAttribute("data-current")).toBe("true")
  })

  it("marks current page without selecting the segment", () => {
    render(<SegmentSidebar segments={segments} currentPage={3} />)

    const results = screen.getByRole("button", { name: /Results/ })

    expect(results.getAttribute("aria-current")).toBe("page")
    expect(results.hasAttribute("aria-pressed")).toBe(false)
  })

  it("supports caller-owned previewed segment state", () => {
    function Harness() {
      const [previewSegmentId, setPreviewSegmentId] = React.useState<
        string | null
      >(null)
      const interaction = useControlledSegmentInteraction({
        previewSegmentId,
        setPreviewSegmentId,
      })

      return (
        <>
          <SegmentSidebar segments={segments} interaction={interaction} />
          <button
            type="button"
            onClick={() => setPreviewSegmentId(segments[1].id)}
          >
            Preview results
          </button>
        </>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Preview results" }))

    expect(
      screen.getByRole("button", { name: /Intro/ }).hasAttribute("aria-pressed")
    ).toBe(false)
    expect(
      screen
        .getByRole("button", { name: /Results/ })
        .getAttribute("data-previewed")
    ).toBe("true")
  })

  it("clears transient preview on navigation click", () => {
    function Harness() {
      const [previewSegmentId, setPreviewSegmentId] = React.useState<
        string | null
      >(segments[0].id)
      const interaction = useControlledSegmentInteraction({
        previewSegmentId,
        setPreviewSegmentId,
      })

      return (
        <>
          <SegmentSidebar segments={segments} interaction={interaction} />
          <output aria-label="preview-segment-id">
            {previewSegmentId ?? ""}
          </output>
        </>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: /Results/ }))

    expect(screen.getByLabelText("preview-segment-id").textContent).toBe("")
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
        interaction={createInteraction({ previewSegmentId: "removed#99" })}
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

  it("notifies the first segment for overlapping pages without dimming shared mappings", () => {
    const onSelect = vi.fn()
    const onSelectPage = vi.fn()
    const overlappingSegments = toSegments([
      { name: "Contract", pages: [1, 2] },
      { name: "Addendum", pages: [2] },
    ])
    const interaction = createInteraction({
      previewSegmentId: overlappingSegments[1].id,
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

    expect(overlappingPage.getAttribute("data-previewed")).toBe("false")
    expect(overlappingPage.className).toContain("opacity-100")
    expect(onSelect).toHaveBeenCalledWith(overlappingSegments[0])
    expect(onSelectPage).toHaveBeenCalledWith(2)
  })

  it("lets empty pages trigger page selection without segment selection", () => {
    const onSelectPage = vi.fn()
    const timelineSegments = toSegments([{ name: "Contract", pages: [1] }])

    render(
      <PageTimeline
        segments={timelineSegments}
        pageCount={2}
        interaction={createInteraction()}
        onSelectPage={onSelectPage}
      />
    )

    const emptyPage = screen.getByRole("button", { name: "Page 2" })
    fireEvent.click(emptyPage)

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

  it("does not dim pages for stale previewed segment ids", () => {
    render(
      <PageTimeline
        segments={segments}
        interaction={createInteraction({ previewSegmentId: "missing" })}
      />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · Intro" }).className
    ).toContain("opacity-100")
    expect(
      screen.getByRole("button", { name: "Page 3 · Results" }).className
    ).toContain("opacity-100")
  })

  it("does not dim mapped pages when a zero-page segment is previewed", () => {
    render(
      <PageTimeline
        segments={segments}
        interaction={createInteraction({ previewSegmentId: segments[2].id })}
      />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · Intro" }).className
    ).toContain("opacity-100")
    expect(
      screen.getByRole("button", { name: "Page 3 · Results" }).className
    ).toContain("opacity-100")
  })

  it("does not dim visible pages when the previewed segment is outside pageCount", () => {
    const timelineSegments = toSegments([
      { name: "Visible", pages: [1] },
      { name: "Outside", pages: [4] },
    ])

    render(
      <PageTimeline
        segments={timelineSegments}
        pageCount={3}
        interaction={createInteraction({
          previewSegmentId: timelineSegments[1].id,
        })}
      />
    )

    expect(
      screen.getByRole("button", { name: "Page 1 · Visible" }).className
    ).toContain("opacity-100")
    expect(screen.getByRole("button", { name: "Page 3" }).className).toContain(
      "opacity-100"
    )
  })

  it("does not dim visible pages when the previewed segment has only fractional pages", () => {
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
        interaction={createInteraction({ previewSegmentId: "fractional" })}
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
  it("renders one button per page run and notifies the run start page", () => {
    const onSelectPage = vi.fn()
    const onSelect = vi.fn()
    const splitSegments = toSegments([{ name: "Intro", pages: [1, 2, 4] }])
    const segment = splitSegments[0]
    const interaction = createInteraction()

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
        interaction={createInteraction({ previewSegmentId: "removed#99" })}
      />
    )

    expect(screen.getByLabelText("Intro pages 1 to 2").className).not.toContain(
      "opacity-30"
    )
    expect(
      screen.getByLabelText("Results pages 3 to 3").className
    ).not.toContain("opacity-30")
  })

  it("does not dim all ribbon runs when a zero-page segment is previewed", () => {
    render(
      <PageRibbon
        rows={[{ id: "split", segments }]}
        pageCount={3}
        interaction={createInteraction({ previewSegmentId: segments[2].id })}
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
  it("does not mark segment buttons as persistent pressed selections", () => {
    render(<SegmentedDocumentViewer segments={segments} />)

    const sidebarIntro = screen.getByRole("button", { name: /Intro.*2 pages/ })
    fireEvent.click(sidebarIntro)

    const introButtons = screen.getAllByRole("button", { name: /Intro/ })
    expect(
      introButtons.some((button) => button.hasAttribute("aria-pressed"))
    ).toBe(false)
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

describe("segment viewport controller", () => {
  it("derives the segment viewport model from current page and preview", () => {
    const controllerSegments = toSegments([
      { name: "Title", pages: [1] },
      { name: "Results", pages: [5] },
    ])
    const { result } = renderHook(() =>
      useSegmentViewportController({ segments: controllerSegments })
    )

    expect(result.current.model.currentPage).toBe(1)
    expect(result.current.model.currentSegmentId).toBe(controllerSegments[0].id)
    expect(result.current.model.highlightedSegmentId).toBe(
      controllerSegments[0].id
    )

    act(() => {
      result.current.documentHandlers.onCurrentPageChange(5)
    })

    expect(result.current.model.currentSegmentId).toBe(controllerSegments[1].id)
    expect(result.current.model.highlightedSegmentId).toBe(
      controllerSegments[1].id
    )

    act(() => {
      result.current.interaction.previewSegment(controllerSegments[0].id)
    })

    expect(result.current.model.previewSegmentId).toBe(controllerSegments[0].id)
    expect(result.current.model.highlightedSegmentId).toBe(
      controllerSegments[0].id
    )

    act(() => {
      result.current.interaction.clearPreview()
    })

    expect(result.current.model.highlightedSegmentId).toBe(
      controllerSegments[1].id
    )
  })

  it("requests document navigation without mutating current page", () => {
    const controllerSegments = toSegments([{ name: "Results", pages: [5] }])
    const scrollToPage = vi.fn()
    const { result } = renderHook(() =>
      useSegmentViewportController({ segments: controllerSegments })
    )

    act(() => {
      result.current.documentHandlers.setViewerHandle({
        scrollToPage,
        scrollToPageArea: vi.fn(),
        getViewportElement: () => null,
      })
    })

    act(() => {
      result.current.navigation.scrollToSegmentStart(controllerSegments[0])
    })

    expect(scrollToPage).toHaveBeenCalledWith(5)
    expect(result.current.model.currentPage).toBe(1)
    expect(result.current.model.currentSegmentId).toBeNull()
  })

  it("keeps the rail still when the current page marker is visible", () => {
    const controllerSegments = toSegments([{ name: "Results", pages: [2] }])
    const { result } = renderHook(() =>
      useSegmentViewportController({ segments: controllerSegments })
    )
    const { viewport, marker, scrollTo } = createRailGeometry({
      markerBottom: 48,
      markerOffsetHeight: 10,
      markerOffsetTop: 40,
      markerTop: 38,
      viewportBottom: 100,
      viewportHeight: 100,
      viewportTop: 0,
    })

    act(() => {
      result.current.rail.setViewportElement(viewport)
      result.current.rail.setPageElement(2, marker)
      result.current.documentHandlers.onCurrentPageChange(2)
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("reveals the current page marker when it is outside the rail viewport", () => {
    const controllerSegments = toSegments([{ name: "Results", pages: [5] }])
    const { result } = renderHook(() =>
      useSegmentViewportController({ segments: controllerSegments })
    )
    const { viewport, marker, scrollTo } = createRailGeometry({
      markerBottom: 230,
      markerOffsetHeight: 10,
      markerOffsetTop: 220,
      markerTop: 220,
      viewportBottom: 100,
      viewportHeight: 100,
      viewportTop: 0,
    })

    act(() => {
      result.current.rail.setViewportElement(viewport)
      result.current.rail.setPageElement(5, marker)
      result.current.documentHandlers.onCurrentPageChange(5)
    })

    expect(scrollTo).toHaveBeenCalledWith({
      top: 175,
      behavior: "smooth",
    })
  })

  it("suspends rail follow while the pointer is inside the rail", () => {
    const controllerSegments = toSegments([{ name: "Results", pages: [5] }])
    const { result } = renderHook(() =>
      useSegmentViewportController({ segments: controllerSegments })
    )
    const { viewport, marker, scrollTo } = createRailGeometry({
      markerBottom: 230,
      markerOffsetHeight: 10,
      markerOffsetTop: 220,
      markerTop: 220,
      viewportBottom: 100,
      viewportHeight: 100,
      viewportTop: 0,
    })

    act(() => {
      result.current.rail.setViewportElement(viewport)
      result.current.rail.setPageElement(5, marker)
      result.current.rail.onPointerEnter()
      result.current.documentHandlers.onCurrentPageChange(5)
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("suspends rail follow while the user is scrolling the rail", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000)
    const controllerSegments = toSegments([{ name: "Results", pages: [5] }])
    const { result } = renderHook(() =>
      useSegmentViewportController({ segments: controllerSegments })
    )
    const { viewport, marker, scrollTo } = createRailGeometry({
      markerBottom: 230,
      markerOffsetHeight: 10,
      markerOffsetTop: 220,
      markerTop: 220,
      viewportBottom: 100,
      viewportHeight: 100,
      viewportTop: 0,
    })

    act(() => {
      result.current.rail.setViewportElement(viewport)
      result.current.rail.setPageElement(5, marker)
      result.current.rail.onScroll()
      result.current.documentHandlers.onCurrentPageChange(5)
    })

    expect(scrollTo).not.toHaveBeenCalled()
    now.mockRestore()
  })
})

describe("split segment composition", () => {
  it("gives the rendered document pane the full flex width", () => {
    render(
      <SplitViewer
        result={{ output: [{ name: "Invoices", pages: [1] }] }}
        renderDocument={() => <div data-testid="split-document-pane" />}
      />
    )

    const wrapperClassName =
      screen.getByTestId("split-document-pane").parentElement?.className ?? ""

    expect(wrapperClassName).toContain("min-w-0")
    expect(wrapperClassName).toContain("flex-1")
    expect(document.querySelector('[data-slot="viewer-root"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="viewer-header"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="viewer-body"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="viewer-surface"]')).toBeTruthy()
  })

  it("jumps through the PDF viewer handle when a legend segment page is virtualized", () => {
    const scrollToPage = vi.fn()

    function DocumentWithHandle({
      slots,
      setViewerHandle,
    }: {
      slots: PdfViewerSlots
      setViewerHandle: (handle: PdfViewerHandle | null) => void
    }) {
      React.useEffect(() => {
        setViewerHandle({
          scrollToPage,
          scrollToPageArea: vi.fn(),
          getViewportElement: () => null,
        })
        return () => setViewerHandle(null)
      }, [setViewerHandle])

      return <div>{slots.top}</div>
    }

    render(
      <SplitViewer
        result={{ output: [{ name: "Invoices", pages: [5] }] }}
        renderDocument={({ slots, setViewerHandle }) => (
          <DocumentWithHandle slots={slots} setViewerHandle={setViewerHandle} />
        )}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Invoices" }))

    expect(scrollToPage).toHaveBeenCalledWith(5)
  })

  it("clears clicked category previewing when scrolling outside its pages", () => {
    function DocumentHarness({
      slots,
      onCurrentPageChange,
      setViewerHandle,
    }: {
      slots: PdfViewerSlots
      onCurrentPageChange: (page: number) => void
      setViewerHandle: (handle: PdfViewerHandle | null) => void
    }) {
      React.useEffect(() => {
        setViewerHandle({
          scrollToPage: (page) => onCurrentPageChange(page),
          scrollToPageArea: vi.fn(),
          getViewportElement: () => null,
        })
        return () => setViewerHandle(null)
      }, [onCurrentPageChange, setViewerHandle])

      return (
        <div>
          {slots.top}
          <button type="button" onClick={() => onCurrentPageChange(1)}>
            Scroll to title
          </button>
        </div>
      )
    }

    render(
      <SplitViewer
        result={{
          output: [
            { name: "Title", pages: [1] },
            { name: "Results", pages: [7, 8, 9] },
          ],
        }}
        renderDocument={({ slots, onCurrentPageChange, setViewerHandle }) => (
          <DocumentHarness
            slots={slots}
            onCurrentPageChange={onCurrentPageChange}
            setViewerHandle={setViewerHandle}
          />
        )}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Results" }))
    expect(screen.getByRole("button", { name: "Results" }).className).toContain(
      "opacity-100"
    )
    expect(
      screen
        .getByRole("button", { name: "Results" })
        .getAttribute("data-current")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Results" })
        .hasAttribute("data-selected")
    ).toBe(false)

    fireEvent.click(screen.getByRole("button", { name: "Scroll to title" }))

    expect(
      screen
        .getByRole("button", { name: "Results" })
        .getAttribute("data-current")
    ).toBe("false")
    expect(
      screen
        .getByRole("button", { name: "Results" })
        .getAttribute("data-previewed")
    ).toBe("false")
    expect(screen.getByRole("button", { name: "Results" }).className).toContain(
      "opacity-100"
    )
  })
})
