// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DisposableLruCache,
  type Disposable,
} from "@/registry/new-york-v4/ui/pptx-viewer-cache"
import {
  clamp,
  DEFAULT_PPTX_SLIDE_SIZE,
  getPptxBitmapCacheKey,
  getPptxFitScale,
  getPptxResetKey,
  getRotatedSize,
  getScaledSlideSize,
  getVisibleSlideSize,
  normalizePptxScale,
} from "@/registry/new-york-v4/ui/pptx-viewer-core"
import { PptxViewerFallback } from "@/registry/new-york-v4/ui/pptx-viewer-fallback"
import { parsePptxSlideSize } from "@/registry/new-york-v4/ui/pptx-viewer-presentation"
import { createPptxScrollActivity } from "@/registry/new-york-v4/ui/pptx-viewer-scroll"
import { usePptxVisibleSlide } from "@/registry/new-york-v4/ui/pptx-viewer-visible-slide"
import { usePptxZoom } from "@/registry/new-york-v4/ui/pptx-viewer-zoom"

const originalGetAnimations = HTMLElement.prototype.getAnimations

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: vi.fn(() => []),
  })
})

afterEach(() => {
  cleanup()
  if (originalGetAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: originalGetAnimations,
    })
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations")
  }
  vi.restoreAllMocks()
})

function setElementNumberProperty(
  element: Element,
  key: "clientHeight" | "scrollHeight" | "scrollTop",
  value: number
) {
  Object.defineProperty(element, key, { configurable: true, value })
}

function setElementRect(
  element: Element,
  rect: Partial<Pick<DOMRect, "top" | "height">>
) {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: (rect.top ?? 0) + (rect.height ?? 0),
        height: rect.height ?? 0,
        left: 0,
        right: 0,
        toJSON: () => ({}),
        top: rect.top ?? 0,
        width: 0,
        x: 0,
        y: rect.top ?? 0,
      }) as DOMRect
  )
}

describe("pptx-viewer-core geometry", () => {
  it("scales slide size by the zoom factor", () => {
    expect(getScaledSlideSize({ width: 960, height: 720 }, 2)).toEqual({
      width: 1920,
      height: 1440,
    })
    expect(getScaledSlideSize({ width: 960, height: 720 }, 0.5)).toEqual({
      width: 480,
      height: 360,
    })
  })

  it("keeps slide dimensions for upright orientations and swaps for quarter turns", () => {
    const size = { width: 960, height: 720 }
    expect(getRotatedSize(size, 0)).toEqual({ width: 960, height: 720 })
    expect(getRotatedSize(size, 90)).toEqual({ width: 720, height: 960 })
    expect(getRotatedSize(size, 180)).toEqual({ width: 960, height: 720 })
    expect(getRotatedSize(size, 270)).toEqual({ width: 720, height: 960 })
  })

  it("normalizes out-of-range and negative rotations before swapping axes", () => {
    const size = { width: 960, height: 720 }
    expect(getRotatedSize(size, 360)).toEqual({ width: 960, height: 720 })
    expect(getRotatedSize(size, 450)).toEqual({ width: 720, height: 960 })
    expect(getRotatedSize(size, -90)).toEqual({ width: 720, height: 960 })
    expect(getRotatedSize(size, -270)).toEqual({ width: 720, height: 960 })
    expect(getRotatedSize(size, -360)).toEqual({ width: 960, height: 720 })
  })

  it("exposes getVisibleSlideSize as a rotation-aware alias", () => {
    const size = { width: 1280, height: 540 }
    expect(getVisibleSlideSize(size, 90)).toEqual(getRotatedSize(size, 90))
    expect(getVisibleSlideSize(size, 0)).toEqual(size)
  })

  it("clamps to bounds and normalizes scale values", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
    expect(normalizePptxScale(2)).toBe(2)
    expect(normalizePptxScale(0)).toBe(0.25)
    expect(normalizePptxScale(999)).toBe(5)
    // Non-finite inputs (NaN, ±Infinity) map to 1 before clamping, not to a bound.
    expect(normalizePptxScale(Number.NaN)).toBe(1)
    expect(normalizePptxScale(-Infinity)).toBe(1)
    expect(normalizePptxScale(Infinity)).toBe(1)
  })

  it("rounds bitmap cache keys symmetrically near the rounding boundary", () => {
    expect(getPptxBitmapCacheKey({ slideIndex: 0, renderScale: 1 })).toBe(
      "0@1000"
    )
    expect(
      getPptxBitmapCacheKey({ slideIndex: 3, renderScale: 0.0004 })
    ).toBe("3@0")
    expect(
      getPptxBitmapCacheKey({ slideIndex: 3, renderScale: 0.0006 })
    ).toBe("3@1")
  })

  it("treats fit/manual reset inputs as distinct keys but coincident clamped scales as equal", () => {
    const fit = getPptxResetKey({ resourceKey: "url:/a.pptx" })
    const manual = getPptxResetKey({ resourceKey: "url:/a.pptx", scale: 1 })
    expect(fit).not.toBe(manual)
    expect(
      getPptxResetKey({ resourceKey: "url:/a.pptx", scale: 0.1 })
    ).toBe(getPptxResetKey({ resourceKey: "url:/a.pptx", scale: 0.25 }))
  })

  it("exposes the documented default slide size", () => {
    expect(DEFAULT_PPTX_SLIDE_SIZE).toEqual({ width: 960, height: 720 })
  })
})

describe("getPptxFitScale", () => {
  it("subtracts container padding before dividing by the base width", () => {
    expect(getPptxFitScale(992, 960)).toBe(1)
    expect(getPptxFitScale(512, 960)).toBe(0.5)
  })

  it("falls back to 1 for unusable measurements", () => {
    expect(getPptxFitScale(0, 960)).toBe(1)
    expect(getPptxFitScale(null, 960)).toBe(1)
    expect(getPptxFitScale(Number.NaN, 960)).toBe(1)
    expect(getPptxFitScale(800, -5)).toBe(1)
  })
})

// Real presentation.xml always declares the presentationml namespace; an
// undeclared `p:` prefix makes jsdom emit a <parsererror>, which is a separate
// (already-covered) fallback path. Declare xmlns:p so these cases exercise the
// genuine attribute-parsing logic rather than the parse-error fallback.
const P_NS =
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'

describe("parsePptxSlideSize edge cases", () => {
  it("falls back when only one slide-size axis is present", () => {
    expect(
      parsePptxSlideSize(`<p:presentation ${P_NS}><p:sldSz cx="9144000"/></p:presentation>`)
    ).toEqual(DEFAULT_PPTX_SLIDE_SIZE)
    expect(
      parsePptxSlideSize(`<p:presentation ${P_NS}><p:sldSz cy="6858000"/></p:presentation>`)
    ).toEqual(DEFAULT_PPTX_SLIDE_SIZE)
  })

  it("falls back when an axis is zero or negative", () => {
    expect(
      parsePptxSlideSize(`<p:presentation ${P_NS}><p:sldSz cx="0" cy="6858000"/></p:presentation>`)
    ).toEqual(DEFAULT_PPTX_SLIDE_SIZE)
    expect(
      parsePptxSlideSize(`<p:presentation ${P_NS}><p:sldSz cx="9144000" cy="-1"/></p:presentation>`)
    ).toEqual(DEFAULT_PPTX_SLIDE_SIZE)
  })

  it("uses the first sldSz element when several are present", () => {
    expect(
      parsePptxSlideSize(
        `<p:presentation ${P_NS}><p:sldSz cx="12192000" cy="6858000"/><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`
      )
    ).toEqual({ width: 1280, height: 720 })
  })

  it("rounds fractional EMU values to the nearest CSS pixel", () => {
    // 9144000.5 EMU / 9525 ≈ 960.00005 -> 960
    expect(
      parsePptxSlideSize(
        `<p:presentation ${P_NS}><p:sldSz cx="9144000.5" cy="6858000"/></p:presentation>`
      )
    ).toEqual({ width: 960, height: 720 })
    // 9529 EMU / 9525 ≈ 1.0004 -> rounds to 1px
    expect(
      parsePptxSlideSize(
        `<p:presentation ${P_NS}><p:sldSz cx="9529" cy="9529"/></p:presentation>`
      )
    ).toEqual({ width: 1, height: 1 })
  })

  it("falls back for empty, whitespace, and null input", () => {
    expect(parsePptxSlideSize("")).toEqual(DEFAULT_PPTX_SLIDE_SIZE)
    expect(parsePptxSlideSize(null)).toEqual(DEFAULT_PPTX_SLIDE_SIZE)
    expect(parsePptxSlideSize(undefined)).toEqual(DEFAULT_PPTX_SLIDE_SIZE)
  })

  it("falls back when the injected parser returns null", () => {
    expect(parsePptxSlideSize("<ignored/>", () => null)).toEqual(
      DEFAULT_PPTX_SLIDE_SIZE
    )
  })
})

class TrackedDisposable implements Disposable {
  disposeCount = 0
  constructor(readonly id: string) {}
  dispose() {
    this.disposeCount += 1
  }
}

describe("DisposableLruCache", () => {
  it("evicts and disposes the oldest entry past the limit", () => {
    const cache = new DisposableLruCache<string, TrackedDisposable>(2)
    const a = new TrackedDisposable("a")
    const b = new TrackedDisposable("b")
    const c = new TrackedDisposable("c")

    cache.set("a", a)
    cache.set("b", b)
    cache.set("c", c)

    expect(a.disposeCount).toBe(1)
    expect(cache.get("a")).toBeUndefined()
    expect(cache.get("b")).toBe(b)
    expect(cache.get("c")).toBe(c)
    expect(cache.size).toBe(2)
  })

  it("keeps recently accessed entries warm when choosing an eviction victim", () => {
    const cache = new DisposableLruCache<string, TrackedDisposable>(2)
    const a = new TrackedDisposable("a")
    const b = new TrackedDisposable("b")
    const c = new TrackedDisposable("c")

    cache.set("a", a)
    cache.set("b", b)
    expect(cache.get("a")).toBe(a) // promote "a" ahead of "b"
    cache.set("c", c)

    expect(b.disposeCount).toBe(1)
    expect(a.disposeCount).toBe(0)
    expect(cache.get("a")).toBe(a)
    expect(cache.get("c")).toBe(c)
  })

  it("disposes the previous value when a key is overwritten", () => {
    const cache = new DisposableLruCache<string, TrackedDisposable>(2)
    const first = new TrackedDisposable("first")
    const second = new TrackedDisposable("second")

    cache.set("k", first)
    cache.set("k", second)

    expect(first.disposeCount).toBe(1)
    expect(second.disposeCount).toBe(0)
    expect(cache.get("k")).toBe(second)
    expect(cache.size).toBe(1)
  })

  it("disposes on delete and ignores deletes of missing keys", () => {
    const cache = new DisposableLruCache<string, TrackedDisposable>(2)
    const a = new TrackedDisposable("a")
    cache.set("a", a)

    cache.delete("missing")
    expect(a.disposeCount).toBe(0)

    cache.delete("a")
    expect(a.disposeCount).toBe(1)
    expect(cache.get("a")).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it("disposes every entry on clear", () => {
    const cache = new DisposableLruCache<string, TrackedDisposable>(4)
    const entries = ["a", "b", "c"].map((id) => new TrackedDisposable(id))
    entries.forEach((entry) => cache.set(entry.id, entry))

    cache.clear()

    expect(entries.every((entry) => entry.disposeCount === 1)).toBe(true)
    expect(cache.size).toBe(0)
    expect(cache.snapshotValues()).toEqual([])
  })

  it("snapshots values in least-to-most-recently-used order", () => {
    const cache = new DisposableLruCache<string, TrackedDisposable>(3)
    const a = new TrackedDisposable("a")
    const b = new TrackedDisposable("b")
    const c = new TrackedDisposable("c")
    cache.set("a", a)
    cache.set("b", b)
    cache.set("c", c)
    cache.get("a") // promote "a" to most-recent

    expect(cache.snapshotValues().map((entry) => entry.id)).toEqual([
      "b",
      "c",
      "a",
    ])
  })
})

describe("createPptxScrollActivity edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("resets the idle timer on each scroll so idle waits for the final scroll", () => {
    const activity = createPptxScrollActivity(50)
    const onIdle = vi.fn()
    activity.onIdle(onIdle)

    activity.handleScroll()
    vi.advanceTimersByTime(40)
    activity.handleScroll()
    vi.advanceTimersByTime(40)
    expect(activity.isScrolling()).toBe(true)
    expect(onIdle).not.toHaveBeenCalled()

    vi.advanceTimersByTime(10)
    expect(activity.isScrolling()).toBe(false)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it("clears idle waiters once fired so a later scroll does not re-notify them", () => {
    const activity = createPptxScrollActivity(50)
    const onIdle = vi.fn()
    activity.onIdle(onIdle)

    activity.handleScroll()
    vi.advanceTimersByTime(50)
    expect(onIdle).toHaveBeenCalledTimes(1)

    activity.handleScroll()
    vi.advanceTimersByTime(50)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it("reports not scrolling before any scroll happens", () => {
    const activity = createPptxScrollActivity(50)
    expect(activity.isScrolling()).toBe(false)
  })
})

describe("PptxViewerFallback", () => {
  it("renders a toolbar skeleton and a default-aspect slide placeholder", () => {
    render(<PptxViewerFallback />)

    const root = document.querySelector('[data-slot="pptx-viewer"]')
    expect(root).toBeTruthy()
    expect(root?.classList.contains("rounded-xl")).toBe(true)

    const skeleton = document.querySelector<HTMLElement>(
      '[data-slot="pptx-slide-skeleton"]'
    )
    expect(skeleton).toBeTruthy()
    expect(skeleton?.style.aspectRatio).toBe("960 / 720")
    // Toolbar skeleton shows disabled, non-focusable icon placeholders.
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull()
  })

  it("honors a custom fallback slide size aspect ratio", () => {
    render(<PptxViewerFallback fallbackSlideSize={{ width: 1280, height: 720 }} />)
    const skeleton = document.querySelector<HTMLElement>(
      '[data-slot="pptx-slide-skeleton"]'
    )
    expect(skeleton?.style.aspectRatio).toBe("1280 / 720")
  })

  it("omits the toolbar skeleton when toolbar is disabled", () => {
    render(<PptxViewerFallback toolbar={false} />)
    expect(
      document.querySelector('[data-slot="pptx-slide-skeleton"]')
    ).toBeTruthy()
    // The toolbar strip has a fixed h-10 height; without it there is no border-b bg-card strip.
    expect(document.querySelector(".border-b.bg-card")).toBeNull()
  })

  it("applies bare layout classes", () => {
    render(<PptxViewerFallback bare className="custom-class" />)
    const root = document.querySelector('[data-slot="pptx-viewer"]')
    expect(root?.classList.contains("h-full")).toBe(true)
    expect(root?.classList.contains("rounded-xl")).toBe(false)
    expect(root?.classList.contains("custom-class")).toBe(true)
  })
})

function VisibleSlideHarness({
  slideCount,
  onVisibleSlideChange,
  onScrollProgressChange,
}: {
  slideCount: number
  onVisibleSlideChange?: (slide: number) => void
  onScrollProgressChange?: (progress: number) => void
}) {
  const { currentSlide, handleScroll, scrollViewportRef } = usePptxVisibleSlide({
    onVisibleSlideChange,
    onScrollProgressChange,
  })
  return (
    <div ref={scrollViewportRef} data-testid="viewport">
      {Array.from({ length: slideCount }, (_, index) => (
        <div key={index} data-slide-number={index + 1} data-testid={`slide-${index + 1}`} />
      ))}
      <span data-testid="current-slide">{currentSlide}</span>
      <button type="button" onClick={handleScroll}>
        scroll
      </button>
    </div>
  )
}

function scroll() {
  fireEvent.click(screen.getByRole("button", { name: "scroll" }))
}

describe("usePptxVisibleSlide", () => {
  it("starts on slide 1", () => {
    render(<VisibleSlideHarness slideCount={3} />)
    expect(screen.getByTestId("current-slide").textContent).toBe("1")
  })

  it("reports the slide occupying the 20% marker line", () => {
    const onVisibleSlideChange = vi.fn()
    render(
      <VisibleSlideHarness slideCount={3} onVisibleSlideChange={onVisibleSlideChange} />
    )
    const viewport = screen.getByTestId("viewport")
    setElementRect(viewport, { top: 0, height: 100 }) // marker at y=20
    setElementRect(screen.getByTestId("slide-1"), { top: -200 })
    setElementRect(screen.getByTestId("slide-2"), { top: 10 })
    setElementRect(screen.getByTestId("slide-3"), { top: 400 })

    scroll()

    expect(onVisibleSlideChange).toHaveBeenLastCalledWith(2)
    expect(screen.getByTestId("current-slide").textContent).toBe("2")
  })

  it("keeps slide 1 when every slide sits below the marker", () => {
    const onVisibleSlideChange = vi.fn()
    render(
      <VisibleSlideHarness slideCount={3} onVisibleSlideChange={onVisibleSlideChange} />
    )
    const viewport = screen.getByTestId("viewport")
    setElementRect(viewport, { top: 0, height: 100 }) // marker at y=20
    setElementRect(screen.getByTestId("slide-1"), { top: 500 })
    setElementRect(screen.getByTestId("slide-2"), { top: 900 })
    setElementRect(screen.getByTestId("slide-3"), { top: 1300 })

    scroll()

    expect(onVisibleSlideChange).toHaveBeenCalledWith(1)
    expect(screen.getByTestId("current-slide").textContent).toBe("1")
  })

  it("counts a slide whose top sits exactly on the marker", () => {
    const onVisibleSlideChange = vi.fn()
    render(
      <VisibleSlideHarness slideCount={2} onVisibleSlideChange={onVisibleSlideChange} />
    )
    const viewport = screen.getByTestId("viewport")
    setElementRect(viewport, { top: 0, height: 100 }) // marker at y=20
    setElementRect(screen.getByTestId("slide-1"), { top: -100 })
    setElementRect(screen.getByTestId("slide-2"), { top: 20 }) // exactly on marker

    scroll()

    expect(onVisibleSlideChange).toHaveBeenLastCalledWith(2)
  })

  it("reports each visible slide only once until it changes", () => {
    const onVisibleSlideChange = vi.fn()
    render(
      <VisibleSlideHarness slideCount={2} onVisibleSlideChange={onVisibleSlideChange} />
    )
    const viewport = screen.getByTestId("viewport")
    setElementRect(viewport, { top: 0, height: 100 })
    setElementRect(screen.getByTestId("slide-1"), { top: -200 })
    setElementRect(screen.getByTestId("slide-2"), { top: 10 })

    scroll()
    scroll()
    scroll()

    expect(onVisibleSlideChange).toHaveBeenCalledTimes(1)
    expect(onVisibleSlideChange).toHaveBeenCalledWith(2)
  })

  it("clamps scroll progress to [0, 1] including overscroll", () => {
    const onScrollProgressChange = vi.fn()
    render(
      <VisibleSlideHarness
        slideCount={1}
        onScrollProgressChange={onScrollProgressChange}
      />
    )
    const viewport = screen.getByTestId("viewport")
    setElementRect(viewport, { top: 0, height: 100 })
    setElementRect(screen.getByTestId("slide-1"), { top: 0 })
    setElementNumberProperty(viewport, "clientHeight", 100)
    setElementNumberProperty(viewport, "scrollHeight", 300)

    setElementNumberProperty(viewport, "scrollTop", -50)
    scroll()
    expect(onScrollProgressChange).toHaveBeenLastCalledWith(0)

    setElementNumberProperty(viewport, "scrollTop", 100) // exactly halfway of 200 scrollable
    scroll()
    expect(onScrollProgressChange).toHaveBeenLastCalledWith(0.5)

    setElementNumberProperty(viewport, "scrollTop", 9999)
    scroll()
    expect(onScrollProgressChange).toHaveBeenLastCalledWith(1)
  })

  it("reports zero progress when content does not overflow the viewport", () => {
    const onScrollProgressChange = vi.fn()
    render(
      <VisibleSlideHarness
        slideCount={1}
        onScrollProgressChange={onScrollProgressChange}
      />
    )
    const viewport = screen.getByTestId("viewport")
    setElementRect(viewport, { top: 0, height: 100 })
    setElementRect(screen.getByTestId("slide-1"), { top: 0 })
    setElementNumberProperty(viewport, "clientHeight", 100)
    setElementNumberProperty(viewport, "scrollHeight", 100)
    setElementNumberProperty(viewport, "scrollTop", 50)

    scroll()

    expect(onScrollProgressChange).toHaveBeenLastCalledWith(0)
  })
})

function ZoomHarness({
  controlledScale,
  defaultScale,
  fitScale,
  onScaleChange,
}: {
  controlledScale?: number
  defaultScale?: number
  fitScale: number
  onScaleChange?: (scale: number | null) => void
}) {
  const { scaleControlsDisabled, setViewerScale, zoomScale } = usePptxZoom({
    controlledScale,
    defaultScale,
    fitScale,
    onScaleChange,
  })
  return (
    <div>
      <span data-testid="zoom">{zoomScale}</span>
      <span data-testid="disabled">{String(scaleControlsDisabled)}</span>
      <button type="button" onClick={() => setViewerScale(zoomScale * 1.2)}>
        zoom-in
      </button>
      <button type="button" onClick={() => setViewerScale(null)}>
        fit
      </button>
      <button type="button" onClick={() => setViewerScale(999)}>
        over
      </button>
    </div>
  )
}

describe("usePptxZoom", () => {
  it("uses fit scale in uncontrolled fit mode", () => {
    render(<ZoomHarness fitScale={0.5} />)
    expect(screen.getByTestId("zoom").textContent).toBe("0.5")
    expect(screen.getByTestId("disabled").textContent).toBe("false")
  })

  it("starts from a normalized uncontrolled default scale", () => {
    render(<ZoomHarness fitScale={0.5} defaultScale={999} />)
    expect(screen.getByTestId("zoom").textContent).toBe("5")
  })

  it("switches to manual mode and clamps on uncontrolled zoom", () => {
    render(<ZoomHarness fitScale={0.5} />)
    fireEvent.click(screen.getByRole("button", { name: "zoom-in" }))
    expect(screen.getByTestId("zoom").textContent).toBe("0.6")

    fireEvent.click(screen.getByRole("button", { name: "over" }))
    expect(screen.getByTestId("zoom").textContent).toBe("5")

    fireEvent.click(screen.getByRole("button", { name: "fit" }))
    expect(screen.getByTestId("zoom").textContent).toBe("0.5")
  })

  it("normalizes the controlled scale and does not mutate internal state", () => {
    const onScaleChange = vi.fn()
    render(
      <ZoomHarness fitScale={0.5} controlledScale={999} onScaleChange={onScaleChange} />
    )
    expect(screen.getByTestId("zoom").textContent).toBe("5")

    fireEvent.click(screen.getByRole("button", { name: "zoom-in" }))
    // Controlled: reports the requested (clamped) value but the displayed scale is still driven by the prop.
    expect(onScaleChange).toHaveBeenCalledWith(5)
    expect(screen.getByTestId("zoom").textContent).toBe("5")
  })

  it("reports fit-width requests as null in controlled mode", () => {
    const onScaleChange = vi.fn()
    render(
      <ZoomHarness fitScale={0.5} controlledScale={1} onScaleChange={onScaleChange} />
    )
    fireEvent.click(screen.getByRole("button", { name: "fit" }))
    expect(onScaleChange).toHaveBeenCalledWith(null)
  })

  it("disables scale controls when controlled without a change handler", () => {
    render(<ZoomHarness fitScale={0.5} controlledScale={1} />)
    expect(screen.getByTestId("disabled").textContent).toBe("true")
  })

  it("treats a controlled scale of zero as controlled and clamps it", () => {
    const onScaleChange = vi.fn()
    render(
      <ZoomHarness fitScale={0.5} controlledScale={0} onScaleChange={onScaleChange} />
    )
    expect(screen.getByTestId("zoom").textContent).toBe("0.25")
    expect(screen.getByTestId("disabled").textContent).toBe("false")
  })
})
