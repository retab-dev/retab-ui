// @vitest-environment jsdom
import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  BitmapCache,
  isDeclaredNativeImage,
  isDeclaredTiff,
  isTiffBytes,
} from "@/registry/new-york-v4/lib/image-frame-source"
import {
  frameCssSize,
  frameIndexToNumber,
  frameNumberToIndex,
  isRotatedSideways,
  normalizeRotation,
  rotatedSize,
  rotateNormalizedBox,
  type NormalizedBox,
} from "@/registry/new-york-v4/lib/image-geometry"
import { clearViewerResourceRegistryForTests } from "@/registry/new-york-v4/lib/viewer-resource"
import {
  imageAnchorToTarget,
  rotateImageArea,
} from "@/registry/new-york-v4/ui/image-source"
import {
  ImageViewer,
  resetImageSourceCacheForTests,
} from "@/registry/new-york-v4/ui/image-viewer"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  resetImageSourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function bitmap(width = 10, height = 10) {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap
}

// ──────────────────────────────────────────────────────────────────────────
// image-geometry pure helpers
// ──────────────────────────────────────────────────────────────────────────

describe("normalizeRotation", () => {
  it.each([
    [0, 0],
    [90, 90],
    [180, 180],
    [270, 270],
    [360, 0],
    [450, 90],
    [-90, 270],
    [-180, 180],
    [-270, 90],
    [-360, 0],
    [720, 0],
    [810, 90],
  ])("maps %d° to the canonical quarter turn %d°", (input, expected) => {
    expect(normalizeRotation(input)).toBe(expected)
  })

  it("snaps non-right-angle rotations down to 0", () => {
    expect(normalizeRotation(45)).toBe(0)
    expect(normalizeRotation(135)).toBe(0)
    expect(normalizeRotation(90.5)).toBe(0)
    expect(normalizeRotation(-45)).toBe(0)
  })

  it("never returns NaN for non-finite input", () => {
    // A normalizer should produce a usable quarter turn for any caller.
    expect(normalizeRotation(Number.NaN)).toBe(0)
    expect(normalizeRotation(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe("rotatedSize / isRotatedSideways", () => {
  it("swaps dimensions only for sideways rotations", () => {
    const size = { width: 30, height: 40 }
    expect(rotatedSize(size, 0)).toEqual({ width: 30, height: 40 })
    expect(rotatedSize(size, 90)).toEqual({ width: 40, height: 30 })
    expect(rotatedSize(size, 180)).toEqual({ width: 30, height: 40 })
    expect(rotatedSize(size, 270)).toEqual({ width: 40, height: 30 })
  })

  it("classifies sideways rotations", () => {
    expect(isRotatedSideways(0)).toBe(false)
    expect(isRotatedSideways(90)).toBe(true)
    expect(isRotatedSideways(180)).toBe(false)
    expect(isRotatedSideways(270)).toBe(true)
  })
})

describe("frameCssSize", () => {
  it("scales after applying the rotation swap", () => {
    expect(frameCssSize({ width: 100, height: 50 }, 2, 0)).toEqual({
      width: 200,
      height: 100,
    })
    expect(frameCssSize({ width: 100, height: 50 }, 2, 90)).toEqual({
      width: 100,
      height: 200,
    })
  })
})

describe("frameNumberToIndex / frameIndexToNumber", () => {
  it("round-trips 1-based numbers to 0-based indexes", () => {
    expect(frameNumberToIndex(1)).toBe(0)
    expect(frameNumberToIndex(3)).toBe(2)
    expect(frameIndexToNumber(0)).toBe(1)
    expect(frameIndexToNumber(2)).toBe(3)
  })

  it("clamps numbers below 1 to the first frame", () => {
    expect(frameNumberToIndex(0)).toBe(0)
    expect(frameNumberToIndex(-5)).toBe(0)
  })

  it("floors fractional frame numbers", () => {
    expect(frameNumberToIndex(2.9)).toBe(1)
    expect(frameNumberToIndex(1.1)).toBe(0)
  })

  it("clamps non-finite frame numbers to the first frame", () => {
    expect(frameNumberToIndex(Number.NaN)).toBe(0)
    expect(frameNumberToIndex(Number.POSITIVE_INFINITY)).toBe(0)
    expect(frameNumberToIndex(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe("rotateNormalizedBox", () => {
  const box: NormalizedBox = { left: 0.1, top: 0.2, width: 0.3, height: 0.4 }

  it("is the identity for 0°", () => {
    expect(rotateNormalizedBox(box, 0)).toEqual(box)
  })

  it("rotates 90° clockwise", () => {
    expect(rotateNormalizedBox(box, 90)).toEqual({
      left: 1 - 0.2 - 0.4,
      top: 0.1,
      width: 0.4,
      height: 0.3,
    })
  })

  it("composes two 90° turns into a 180° turn", () => {
    const once = rotateNormalizedBox(box, 90)
    const twice = rotateNormalizedBox(once, 90)
    const direct = rotateNormalizedBox(box, 180)
    expect(twice.left).toBeCloseTo(direct.left, 10)
    expect(twice.top).toBeCloseTo(direct.top, 10)
    expect(twice.width).toBeCloseTo(direct.width, 10)
    expect(twice.height).toBeCloseTo(direct.height, 10)
  })

  it("returns to the original box after four 90° turns", () => {
    let current = box
    for (let i = 0; i < 4; i += 1) current = rotateNormalizedBox(current, 90)
    expect(current.left).toBeCloseTo(box.left, 10)
    expect(current.top).toBeCloseTo(box.top, 10)
    expect(current.width).toBeCloseTo(box.width, 10)
    expect(current.height).toBeCloseTo(box.height, 10)
  })

  it("keeps a centered box centered through every rotation", () => {
    const centered: NormalizedBox = {
      left: 0.25,
      top: 0.25,
      width: 0.5,
      height: 0.5,
    }
    for (const rotation of [90, 180, 270] as const) {
      expect(rotateNormalizedBox(centered, rotation)).toEqual(centered)
    }
  })

  it("keeps rotated valid boxes inside normalized bounds", () => {
    const boxes: NormalizedBox[] = [
      { left: 0, top: 0, width: 0.01, height: 0.01 },
      { left: 0.99, top: 0.98, width: 0.01, height: 0.02 },
      { left: 0.125, top: 0.25, width: 0.375, height: 0.5 },
      { left: 0.333, top: 0.111, width: 0.222, height: 0.444 },
    ]

    for (const candidate of boxes) {
      for (const rotation of [0, 90, 180, 270] as const) {
        const rotated = rotateNormalizedBox(candidate, rotation)
        expect(rotated.left).toBeGreaterThanOrEqual(0)
        expect(rotated.top).toBeGreaterThanOrEqual(0)
        expect(rotated.left + rotated.width).toBeLessThanOrEqual(1)
        expect(rotated.top + rotated.height).toBeLessThanOrEqual(1)
      }
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// image-source anchor mapping
// ──────────────────────────────────────────────────────────────────────────

describe("imageAnchorToTarget", () => {
  it("converts a valid image bbox to a frame target with a percentage area", () => {
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        left: 0.1,
        top: 0.2,
        width: 0.3,
        height: 0.4,
      })
    ).toEqual({ frame: 1, area: { left: 10, top: 20, width: 30, height: 40 } })
  })

  it("converts a pdf bbox the same way", () => {
    expect(
      imageAnchorToTarget({
        kind: "pdf_bbox",
        page: 1,
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      })
    ).toEqual({ frame: 1, area: { left: 0, top: 0, width: 100, height: 100 } })
  })

  it("accepts boxes whose edges touch the frame boundary", () => {
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        left: 0.5,
        top: 0.5,
        width: 0.5,
        height: 0.5,
      })
    ).toEqual({ frame: 1, area: { left: 50, top: 50, width: 50, height: 50 } })
  })

  it.each([
    ["overflowing width", { left: 0.6, top: 0, width: 0.5, height: 0.5 }],
    ["overflowing height", { left: 0, top: 0.6, width: 0.5, height: 0.5 }],
    ["negative left", { left: -0.1, top: 0, width: 0.5, height: 0.5 }],
    ["zero width", { left: 0, top: 0, width: 0, height: 0.5 }],
    ["NaN value", { left: Number.NaN, top: 0, width: 0.5, height: 0.5 }],
  ])("rejects %s", (_label, partial) => {
    expect(
      imageAnchorToTarget({ kind: "image_bbox", ...partial })
    ).toBeUndefined()
  })

  it("ignores non-raster anchors", () => {
    expect(
      imageAnchorToTarget({
        kind: "csv_cell",
        row: 1,
        column: "A",
      } as never)
    ).toBeUndefined()
  })

  it("defaults an image bbox without a page to frame 1", () => {
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      })?.frame
    ).toBe(1)
  })

  it("uses the explicit page for multi-frame rasters", () => {
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        page: 3,
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      })?.frame
    ).toBe(3)
  })

  it.each([
    ["zero", 0],
    ["negative", -2],
    ["fractional", 1.5],
  ])("rejects a %s page", (_label, page) => {
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        page,
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      })
    ).toBeUndefined()
  })

  it("reads the pdf page for pdf bboxes", () => {
    expect(
      imageAnchorToTarget({
        kind: "pdf_bbox",
        page: 4,
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      })?.frame
    ).toBe(4)
  })
})

describe("rotateImageArea", () => {
  const area = { left: 10, top: 20, width: 30, height: 40 }

  it("is the identity for 0° and non-right angles", () => {
    expect(rotateImageArea(area, 0)).toEqual(area)
    expect(rotateImageArea(area, 45)).toEqual(area)
  })

  it("returns to the original area after four 90° turns", () => {
    let current = area
    for (let i = 0; i < 4; i += 1) current = rotateImageArea(current, 90)
    expect(current).toEqual(area)
  })

  it("does not leak floating point noise into percentages", () => {
    const rotated = rotateImageArea(
      { left: 13.37, top: 7.91, width: 22.22, height: 11.11 },
      90
    )
    for (const value of Object.values(rotated)) {
      // toPercent rounds to 10 decimals; nothing should carry a long fraction.
      expect(value.toString()).not.toMatch(/\.\d{11,}/)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// format detection
// ──────────────────────────────────────────────────────────────────────────

describe("isDeclaredTiff", () => {
  it.each([
    ["/scan.tif", null],
    ["/scan.tiff", null],
    ["/scan.TIFF", null],
    ["/scan.tif?v=2", null],
    ["/scan.tiff#page=1", null],
    ["/scan", "image/tiff"],
    ["/scan", "image/tiff; charset=binary"],
    ["/scan", "image/tif"],
    ["/scan", "image/x-tiff"],
  ])("accepts %s (%s)", (src, contentType) => {
    expect(isDeclaredTiff(src, contentType)).toBe(true)
  })

  it.each([
    ["/scan.png", null],
    ["/notatiff", null],
    ["/scan", "image/png"],
    ["/tiff-in-path/scan.png", null],
  ])("rejects %s (%s)", (src, contentType) => {
    expect(isDeclaredTiff(src, contentType)).toBe(false)
  })
})

describe("isDeclaredNativeImage", () => {
  it.each([
    ["/photo.png", null],
    ["/photo.JPG", null],
    ["/photo.jpeg", null],
    ["/photo.webp?cache=1", null],
    ["/photo.png#preview", null],
    ["/icon.ico", null],
    ["/x", "image/png"],
    ["/x", "image/jpeg; charset=binary"],
    ["/x", "image/vnd.microsoft.icon"],
  ])("accepts %s (%s)", (src, contentType) => {
    expect(isDeclaredNativeImage(src, contentType)).toBe(true)
  })

  it("never classifies a tiff as a native image", () => {
    expect(isDeclaredNativeImage("/scan.tiff", null)).toBe(false)
    expect(isDeclaredNativeImage("/scan", "image/tiff")).toBe(false)
  })

  it("does not classify svg as a decodable native raster", () => {
    expect(isDeclaredNativeImage("/logo.svg", "image/svg+xml")).toBe(false)
  })
})

describe("isTiffBytes", () => {
  it("detects little-endian and big-endian magic bytes", () => {
    expect(
      isTiffBytes("/x", null, Uint8Array.of(0x49, 0x49, 0x2a, 0x00).buffer)
    ).toBe(true)
    expect(
      isTiffBytes("/x", null, Uint8Array.of(0x4d, 0x4d, 0x00, 0x2a).buffer)
    ).toBe(true)
  })

  it("ignores non-tiff leading bytes", () => {
    expect(
      isTiffBytes("/x", null, Uint8Array.of(0x89, 0x50, 0x4e, 0x47).buffer)
    ).toBe(false)
  })

  it("does not throw on buffers shorter than the signature", () => {
    expect(() =>
      isTiffBytes("/x", null, Uint8Array.of(0x49, 0x49).buffer)
    ).not.toThrow()
    expect(isTiffBytes("/x", null, new ArrayBuffer(0))).toBe(false)
  })

  it("still trusts the declared type even with non-tiff bytes", () => {
    expect(
      isTiffBytes("/scan.tiff", null, Uint8Array.of(1, 2, 3, 4).buffer)
    ).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// BitmapCache — LRU + pinning semantics (exercised directly)
// ──────────────────────────────────────────────────────────────────────────

describe("BitmapCache", () => {
  it("stores and retrieves bitmaps under the cap", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 2 })
    const a = bitmap()
    cache.set(0, a)
    expect(cache.has(0)).toBe(true)
    expect(cache.get(0)).toBe(a)
    cache.dispose()
  })

  it("evicts the least-recently-used unpinned bitmap past the cap", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 2 })
    const a = bitmap()
    const b = bitmap()
    const c = bitmap()
    cache.set(0, a)
    cache.set(1, b)
    cache.set(2, c) // pushes size to 3 -> evicts frame 0 (LRU)

    expect(a.close).toHaveBeenCalledTimes(1)
    expect(cache.has(0)).toBe(false)
    expect(cache.has(1)).toBe(true)
    expect(cache.has(2)).toBe(true)
    cache.dispose()
  })

  it("treats get() as a recency touch so a read frame survives eviction", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 2 })
    const a = bitmap()
    const b = bitmap()
    const c = bitmap()
    cache.set(0, a)
    cache.set(1, b)
    cache.get(0) // frame 0 is now most-recently used
    cache.set(2, c) // should evict frame 1, not frame 0

    expect(b.close).toHaveBeenCalledTimes(1)
    expect(cache.has(0)).toBe(true)
    expect(cache.has(1)).toBe(false)
    cache.dispose()
  })

  it("never evicts a pinned bitmap even past the cap", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 1 })
    const a = bitmap()
    const b = bitmap()
    cache.set(0, a)
    cache.pin(0)
    cache.set(1, b) // over cap, but frame 0 is pinned

    expect(a.close).not.toHaveBeenCalled()
    expect(cache.has(0)).toBe(true)
    cache.dispose()
  })

  it("re-enables eviction once a frame is fully unpinned", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 2 })
    const a = bitmap()
    const b = bitmap()
    const c = bitmap()
    const d = bitmap()
    cache.set(0, a)
    cache.pin(0)
    cache.pin(0)
    cache.set(1, b)
    cache.set(2, c) // over cap: frame 0 is pinned, so frame 1 is evicted
    expect(a.close).not.toHaveBeenCalled()
    expect(b.close).toHaveBeenCalledTimes(1)

    cache.unpin(0)
    expect(a.close).not.toHaveBeenCalled() // still pinned once
    cache.unpin(0) // fully unpinned now
    expect(a.close).not.toHaveBeenCalled() // still within cap, nothing forced out

    cache.set(3, d) // over cap again: frame 0 is now evictable as LRU
    expect(a.close).toHaveBeenCalledTimes(1)
    cache.dispose()
  })

  it("closes the replaced bitmap when the same frame is set twice", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 2 })
    const stale = bitmap()
    const fresh = bitmap()
    cache.set(0, stale)
    cache.set(0, fresh)

    expect(stale.close).toHaveBeenCalledTimes(1)
    expect(fresh.close).not.toHaveBeenCalled()
    expect(cache.get(0)).toBe(fresh)
    cache.dispose()
  })

  it("does not close when setting the identical bitmap reference again", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 2 })
    const a = bitmap()
    cache.set(0, a)
    cache.set(0, a)
    expect(a.close).not.toHaveBeenCalled()
    cache.dispose()
  })

  it("does not underflow pin counts when unpinning an unknown frame", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 1 })
    expect(() => cache.unpin(7)).not.toThrow()
    expect(cache.isPinned(7)).toBe(false)
    const a = bitmap()
    const b = bitmap()
    cache.set(0, a)
    cache.set(1, b) // eviction must still work normally
    expect(a.close).toHaveBeenCalledTimes(1)
    cache.dispose()
  })

  it("closes every cached bitmap on dispose", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 4 })
    const bitmaps = [bitmap(), bitmap(), bitmap()]
    bitmaps.forEach((b, i) => cache.set(i, b))
    cache.dispose()
    for (const b of bitmaps) expect(b.close).toHaveBeenCalledTimes(1)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Component-level edges
// ──────────────────────────────────────────────────────────────────────────

function stubImageLoading(imageBitmap = bitmap()) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { "content-type": "image/png" },
        })
      )
    )
  )
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve(imageBitmap))
  )
}

function stubObservableLayout({
  frameListWidth = 320,
  clientHeight = 240,
}: { frameListWidth?: number; clientHeight?: number } = {}) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    frameListWidth
  )
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    clientHeight
  )
  if (!HTMLElement.prototype.getAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    })
  }
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
}

describe("ImageViewer controls edges", () => {
  it("returns to the original rotation after four rotate clicks", async () => {
    stubImageLoading(bitmap(100, 200))
    stubObservableLayout({ frameListWidth: 232 })

    await act(async () => {
      render(
        <ImageViewer
          source={{ kind: "url", url: "/rotate-cycle.png" }}
          renderFrameOverlay={({ rotation }) => (
            <div data-testid="overlay" data-rotation={rotation} />
          )}
        />
      )
    })

    const overlay = await screen.findByTestId("overlay")
    expect(overlay.getAttribute("data-rotation")).toBe("0")

    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Rotate"))
      })
    }

    expect(overlay.getAttribute("data-rotation")).toBe("0")
  })

  it("keeps the zoom percentage an integer across many zoom steps", async () => {
    stubImageLoading(bitmap(100, 100))
    stubObservableLayout({ frameListWidth: 132 })

    await act(async () => {
      render(<ImageViewer source={{ kind: "url", url: "/zoom-int.png" }} />)
    })

    await screen.findByLabelText("Zoom in")

    for (let i = 0; i < 7; i += 1) {
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Zoom in"))
      })
      const percent = screen
        .getAllByText(/%$/)
        .map((node) => node.textContent ?? "")
        .find((text) => /^\d+%$/.test(text))
      expect(percent).toMatch(/^\d+%$/)
    }
  })

  it("caps fit-width at the zoom max so zooming in never shrinks the image", async () => {
    // A small image in a wide viewport would fit at >500% without a cap. The
    // fit scale must share the controls's zoom ceiling, otherwise "Zoom in"
    // clamps DOWN to 500% and paradoxically shrinks the image. Regression test.
    stubImageLoading(bitmap(100, 100))
    stubObservableLayout({ frameListWidth: 632 }) // uncapped fit = 600%

    await act(async () => {
      render(<ImageViewer source={{ kind: "url", url: "/tiny-wide.png" }} />)
    })

    const readPercent = () =>
      Number(
        screen
          .getAllByText(/^\d+%$/)
          .map((node) => node.textContent ?? "")
          .find((text) => /^\d+%$/.test(text))
          ?.replace("%", "")
      )

    await screen.findByLabelText("Zoom in")
    expect(readPercent()).toBe(500) // fit is capped at the 500% zoom ceiling

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Zoom in"))
    })
    expect(readPercent()).toBe(500) // already at the ceiling — stays put

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Zoom out"))
    })
    expect(readPercent()).toBeLessThan(500) // zooming out reduces the scale
  })

  it("labels a single native image without pluralizing", async () => {
    stubImageLoading(bitmap(40, 40))
    stubObservableLayout()

    await act(async () => {
      render(<ImageViewer source={{ kind: "url", url: "/single.png" }} />)
    })

    expect(await screen.findByText("1 image")).toBeTruthy()
  })

  it("caps a controlled scale at the viewer zoom ceiling", async () => {
    stubImageLoading(bitmap(100, 100))
    stubObservableLayout()

    await act(async () => {
      render(
        <ImageViewer
          source={{ kind: "url", url: "/controlled-huge.png" }}
          scale={100}
          renderFrameOverlay={({ scale }) => (
            <div data-testid="overlay-scale" data-scale={scale} />
          )}
        />
      )
    })

    expect(await screen.findByText("500%")).toBeTruthy()
    expect(screen.getByTestId("overlay-scale").getAttribute("data-scale")).toBe(
      "5"
    )
  })
})
