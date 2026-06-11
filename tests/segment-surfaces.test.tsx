// @vitest-environment jsdom
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  resolveHighlightedSegmentId,
  type SegmentInteraction,
} from "@/lib/segment-interaction"
import { toSegments } from "@/lib/segments"
import { PageRibbon } from "@/components/ui/page-ribbon"
import { PageTimeline } from "@/components/ui/page-timeline"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"
import { SegmentedDocumentViewer } from "@/components/ui/segmented-document-viewer"
import {
  useControlledSegmentInteraction,
  useSegmentInteraction,
} from "@/components/ui/use-segment-interaction"

afterEach(cleanup)

const segments = toSegments([
  { name: "Intro", pages: [1, 2] },
  { name: "Results", pages: [3] },
  { name: "Unused", pages: [] },
])

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
})
