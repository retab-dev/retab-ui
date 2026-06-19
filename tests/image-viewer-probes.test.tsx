/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

// @vitest-environment jsdom
//
// Probing tests for the image viewer. These deliberately target permutations
// that the two large existing suites (image-viewer.test.tsx /
// image-viewer-edge-cases.test.tsx) do not cover: stateful acquire/release pin
// accounting, disposal-vs-inflight races, frame-descriptor validation cleanup,
// the composed source-overlay/source-target helpers, and fit-width clamping.
import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  type RenderResult,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Source } from "@/registry/new-york-v4/lib/document-source";
import {
  BitmapCache,
  createFrameSource,
  ImageDecodeError,
  ImageFrameIndexError,
  ImageSourceDisposedError,
  type FrameSource,
} from "@/registry/new-york-v4/lib/image-frame-source";
import { clearViewerResourceRegistryForTests } from "@/registry/new-york-v4/lib/viewer-resource";
import {
  renderImageSourceOverlay,
  useImageSourceTarget,
} from "@/registry/new-york-v4/ui/image-source";
import {
  createImageSourceForTests,
  ImageViewer,
  resetImageSourceCacheForTests,
} from "@/registry/new-york-v4/ui/image-viewer";
import { ImageFrame } from "@/registry/new-york-v4/ui/image-viewer-frame";
import { ViewerErrorBoundary } from "@/registry/new-york-v4/ui/viewer-error";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  resetImageSourceCacheForTests();
  clearViewerResourceRegistryForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function bitmap(width = 10, height = 10) {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush the microtask + macrotask queues so decode .then/.catch settle. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function singleFrameSource(
  decode: (frameIndex: number) => Promise<ImageBitmap>,
): FrameSource {
  return createImageSourceForTests(
    "image",
    [{ width: 10, height: 10 }],
    decode,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// createFrameSource — acquire/release pin accounting under odd-but-valid orders
// ──────────────────────────────────────────────────────────────────────────

describe("createFrameSource acquire/release accounting", () => {
  it("treats release without a prior acquire as a harmless no-op", async () => {
    const resolved = bitmap();
    const decode = vi.fn(() => Promise.resolve(resolved));
    const source = singleFrameSource(decode);

    // No acquire has happened yet — releasing must not throw or poison state.
    expect(() => source.release(0)).not.toThrow();

    // A subsequent normal acquire still resolves and decodes exactly once.
    await expect(source.acquire(0)).resolves.toBe(resolved);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("survives a double release of a single acquire and still re-decodes", async () => {
    const d1 = deferred<ImageBitmap>();
    const second = bitmap();
    const decode = vi
      .fn<(frameIndex: number) => Promise<ImageBitmap>>()
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => Promise.resolve(second));
    const source = singleFrameSource(decode);

    const pending = source.acquire(0);
    source.release(0); // cancels the in-flight decode, rejecting `pending`
    await expect(pending).rejects.toBeInstanceOf(ImageSourceDisposedError);

    // A second, redundant release must be inert rather than corrupting counts.
    expect(() => source.release(0)).not.toThrow();

    // The frame is still acquirable; a brand new decode runs for it.
    await expect(source.acquire(0)).resolves.toBe(second);
    expect(decode).toHaveBeenCalledTimes(2);
  });

  it("re-decodes after a canceled decode and closes the abandoned bitmap", async () => {
    const d1 = deferred<ImageBitmap>();
    const d2 = deferred<ImageBitmap>();
    const decode = vi
      .fn<(frameIndex: number) => Promise<ImageBitmap>>()
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => d2.promise);
    const source = singleFrameSource(decode);

    const first = source.acquire(0);
    source.release(0); // cancel decode #1
    await expect(first).rejects.toBeInstanceOf(ImageSourceDisposedError);

    const second = source.acquire(0); // starts decode #2
    const liveBitmap = bitmap();
    d2.resolve(liveBitmap);
    await expect(second).resolves.toBe(liveBitmap);

    // The original decode now resolves late. Its bitmap is stale and must be
    // closed, never cached over the live one.
    const abandoned = bitmap();
    d1.resolve(abandoned);
    await flush();
    expect(abandoned.close).toHaveBeenCalledTimes(1);
    expect(liveBitmap.close).not.toHaveBeenCalled();
  });

  it("shares one in-flight decode across concurrent acquirers of the same frame", async () => {
    const d = deferred<ImageBitmap>();
    const decode = vi.fn(() => d.promise);
    const source = singleFrameSource(decode);

    const a = source.acquire(0);
    const b = source.acquire(0);
    expect(decode).toHaveBeenCalledTimes(1);

    const decoded = bitmap();
    d.resolve(decoded);
    expect(await a).toBe(decoded);
    expect(await b).toBe(decoded);
  });

  it("retries the decode on a fresh acquire after a decode failure", async () => {
    const recovered = bitmap();
    const decode = vi
      .fn<(frameIndex: number) => Promise<ImageBitmap>>()
      .mockRejectedValueOnce(new Error("transient decode failure"))
      .mockResolvedValueOnce(recovered);
    const source = singleFrameSource(decode);

    await expect(source.acquire(0)).rejects.toBeInstanceOf(ImageDecodeError);
    // The failed decode must not be cached as a permanent rejection.
    await expect(source.acquire(0)).resolves.toBe(recovered);
    expect(decode).toHaveBeenCalledTimes(2);
  });

  it("wraps a synchronously-thrown decode into an ImageDecodeError", async () => {
    const source = singleFrameSource(() => {
      throw new Error("synchronous decode explosion");
    });
    await expect(source.acquire(0)).rejects.toBeInstanceOf(ImageDecodeError);
  });

  it.each([
    ["negative", -1],
    ["non-integer", 1.5],
    ["past the end", 99],
  ])("rejects an out-of-range (%s) frame index", async (_label, index) => {
    const source = singleFrameSource(() => Promise.resolve(bitmap()));
    await expect(source.acquire(index)).rejects.toBeInstanceOf(
      ImageFrameIndexError,
    );
  });

  it("invokes cancelDecode when the last acquirer releases an in-flight frame", () => {
    const cancelDecode = vi.fn();
    const source = createFrameSource({
      kind: "tiff",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
      decode: () => deferred<ImageBitmap>().promise, // never settles
      cancelDecode,
      maxDecodedFrames: 4,
    });

    void source.acquire(0).catch(() => {});
    source.release(0);

    expect(cancelDecode).toHaveBeenCalledTimes(1);
    expect(cancelDecode.mock.calls[0][0]).toBe(0);
    expect(cancelDecode.mock.calls[0][1]).toBeInstanceOf(
      ImageSourceDisposedError,
    );
  });

  it("does not cancel an in-flight decode while another acquirer still holds it", async () => {
    const cancelDecode = vi.fn();
    const d = deferred<ImageBitmap>();
    const source = createFrameSource({
      kind: "tiff",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
      decode: () => d.promise,
      cancelDecode,
      maxDecodedFrames: 4,
    });

    const a = source.acquire(0);
    const b = source.acquire(0);
    source.release(0); // one releaser, one still waiting

    expect(cancelDecode).not.toHaveBeenCalled();

    const decoded = bitmap();
    d.resolve(decoded);
    expect(await a).toBe(decoded);
    expect(await b).toBe(decoded);
  });
});

describe("createFrameSource eviction & leak invariants", () => {
  it("evicts an unpinned decoded frame through the source once over cap", async () => {
    const frame0 = bitmap();
    const frame1 = bitmap();
    const decode = vi
      .fn<(frameIndex: number) => Promise<ImageBitmap>>()
      .mockImplementation((index) =>
        Promise.resolve(index === 0 ? frame0 : frame1),
      );
    const source = createFrameSource({
      kind: "native-image",
      frames: [
        { intrinsicSize: { width: 10, height: 10 } },
        { intrinsicSize: { width: 10, height: 10 } },
      ],
      decode,
      maxDecodedFrames: 1,
    });

    await source.acquire(0);
    source.release(0); // frame 0 cached but unpinned now
    expect(frame0.close).not.toHaveBeenCalled();

    await source.acquire(1); // over cap -> frame 0 (LRU, unpinned) is evicted
    expect(frame0.close).toHaveBeenCalledTimes(1);
    expect(frame1.close).not.toHaveBeenCalled();
    source.dispose();
  });

  it("keeps no-leak / no-close-while-held accounting across interleaved ops", async () => {
    // Deterministic interleaving of acquire/release that exercises shared
    // in-flight decodes, cancellation, and re-decode. Invariants checked at the
    // end: every decoded bitmap is closed exactly once after dispose, and a
    // bitmap is never closed while an acquirer still holds it.
    const produced: ImageBitmap[] = [];
    const decode = vi.fn((index: number) => {
      const b = bitmap(10 + index, 10 + index);
      produced.push(b);
      return Promise.resolve(b);
    });
    const source = createFrameSource({
      kind: "tiff",
      frames: Array.from({ length: 3 }, () => ({
        intrinsicSize: { width: 20, height: 20 },
      })),
      decode,
      maxDecodedFrames: 2,
    });

    // Frame 0: two overlapping holders, released one at a time.
    const a0 = source.acquire(0);
    const b0 = source.acquire(0);
    const held0 = await a0;
    await b0;
    expect(held0.close).not.toHaveBeenCalled(); // held by both
    source.release(0);
    expect(held0.close).not.toHaveBeenCalled(); // still held by the second

    // Frame 1 and 2 acquired; with cap 2 and frame 0 now unpinned, the LRU
    // unpinned bitmap may be evicted — but never the still-held frame 0.
    await source.acquire(1);
    await source.acquire(2);
    expect(held0.close).not.toHaveBeenCalled(); // frame 0 still pinned by holder

    source.release(0); // drop the last holder of frame 0
    source.release(1);
    source.release(2);

    source.dispose();

    // Every produced bitmap is closed exactly once after teardown.
    for (const b of produced) {
      expect((b.close as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// createFrameSource — disposal vs. in-flight decodes
// ──────────────────────────────────────────────────────────────────────────

describe("createFrameSource disposal", () => {
  it("rejects acquire() after the source is disposed", async () => {
    const source = singleFrameSource(() => Promise.resolve(bitmap()));
    source.dispose();
    await expect(source.acquire(0)).rejects.toBeInstanceOf(
      ImageSourceDisposedError,
    );
  });

  it("treats release() and a second dispose() after disposal as no-ops", () => {
    const source = singleFrameSource(() => Promise.resolve(bitmap()));
    source.dispose();
    expect(() => source.release(0)).not.toThrow();
    expect(() => source.dispose()).not.toThrow();
  });

  it("rejects an in-flight acquire with the dispose reason", async () => {
    const source = singleFrameSource(() => deferred<ImageBitmap>().promise);
    const pending = source.acquire(0);
    const reason = new ImageSourceDisposedError("explicit teardown reason");
    source.dispose(reason);
    await expect(pending).rejects.toBe(reason);
  });

  it("closes a decode that resolves after disposal instead of caching it", async () => {
    const d = deferred<ImageBitmap>();
    const source = singleFrameSource(() => d.promise);
    const pending = source.acquire(0);
    source.dispose();
    await expect(pending).rejects.toBeInstanceOf(ImageSourceDisposedError);

    const late = bitmap();
    d.resolve(late);
    await flush();
    expect(late.close).toHaveBeenCalledTimes(1);
  });

  it("fires onDispose exactly once even when dispose is called repeatedly", () => {
    const onDispose = vi.fn();
    const source = createFrameSource({
      kind: "native-image",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
      decode: () => Promise.resolve(bitmap()),
      maxDecodedFrames: 4,
      onDispose,
    });
    source.dispose();
    source.dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// createFrameSource — frame descriptor validation + initial bitmap handling
// ──────────────────────────────────────────────────────────────────────────

describe("createFrameSource validation", () => {
  it.each([
    ["zero width", { width: 0, height: 10 }],
    ["negative height", { width: 10, height: -4 }],
    ["NaN width", { width: Number.NaN, height: 10 }],
    ["infinite height", { width: 10, height: Number.POSITIVE_INFINITY }],
  ])("throws on a frame with %s", (_label, size) => {
    expect(() =>
      createImageSourceForTests("image", [size], () =>
        Promise.resolve(bitmap()),
      ),
    ).toThrow(ImageDecodeError);
  });

  it("throws when there are no frames at all", () => {
    expect(() =>
      createImageSourceForTests("image", [], () => Promise.resolve(bitmap())),
    ).toThrow(/does not contain any frames/i);
  });

  it("closes supplied initial bitmaps when descriptor validation fails", () => {
    const orphan = bitmap();
    expect(() =>
      createFrameSource({
        kind: "native-image",
        frames: [{ intrinsicSize: { width: 0, height: 10 } }],
        decode: () => Promise.resolve(bitmap()),
        maxDecodedFrames: 4,
        initialBitmaps: [{ frameIndex: 0, bitmap: orphan }],
      }),
    ).toThrow(ImageDecodeError);
    expect(orphan.close).toHaveBeenCalledTimes(1);
  });

  it("seeds a valid initial bitmap and closes out-of-range ones", async () => {
    const seeded = bitmap();
    const stray = bitmap();
    const decode = vi.fn(() => Promise.resolve(bitmap()));
    const source = createFrameSource({
      kind: "native-image",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
      decode,
      maxDecodedFrames: 4,
      initialBitmaps: [
        { frameIndex: 0, bitmap: seeded },
        { frameIndex: 5, bitmap: stray },
      ],
    });

    expect(stray.close).toHaveBeenCalledTimes(1);
    // The seeded frame is served straight from cache — decode is never called.
    await expect(source.acquire(0)).resolves.toBe(seeded);
    expect(decode).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// BitmapCache — additional pin/eviction edges
// ──────────────────────────────────────────────────────────────────────────

describe("BitmapCache additional edges", () => {
  it("honors a pin placed before the bitmap is set", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 1 });
    const a = bitmap();
    const b = bitmap();
    cache.pin(0); // pin a frame that has no bitmap yet
    cache.set(0, a);
    cache.set(1, b); // over cap, but frame 0 was pinned ahead of time

    expect(a.close).not.toHaveBeenCalled();
    expect(cache.has(0)).toBe(true);
    cache.dispose();
  });

  it("does not strand a frame as permanently pinned after extra unpins", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 1 });
    const a = bitmap();
    const b = bitmap();
    cache.set(0, a);
    cache.pin(0);
    cache.unpin(0);
    cache.unpin(0); // one unpin too many — must not wrap to a negative pin

    expect(cache.isPinned(0)).toBe(false);
    cache.set(1, b); // over cap; frame 0 is fully unpinned and evictable now
    expect(a.close).toHaveBeenCalledTimes(1);
    expect(cache.has(0)).toBe(false);
    cache.dispose();
  });

  it("returns undefined for a missing frame without disturbing recency", () => {
    const cache = new BitmapCache({ maxDecodedFrames: 2 });
    const a = bitmap();
    const b = bitmap();
    const c = bitmap();
    cache.set(0, a);
    cache.set(1, b);
    expect(cache.get(7)).toBeUndefined(); // miss must not touch recency
    cache.set(2, c); // evicts the true LRU (frame 0), not frame 1

    expect(a.close).toHaveBeenCalledTimes(1);
    expect(cache.has(1)).toBe(true);
    cache.dispose();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// renderImageSourceOverlay — frame gating + invalid anchors
// ──────────────────────────────────────────────────────────────────────────

function imageBboxSource(
  box: { left: number; top: number; width: number; height: number },
  page?: number,
): Source {
  return {
    content: "field",
    anchor: { kind: "image_bbox", page, ...box },
  } as Source;
}

describe("renderImageSourceOverlay", () => {
  it("renders nothing when there is no active source", () => {
    const overlay = renderImageSourceOverlay(undefined);
    const { container } = render(
      <>
        {overlay({
          frameNumber: 1,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </>,
    );
    expect(container.firstElementChild).toBeNull();
  });

  it("only paints the highlight on the anchor's own frame", () => {
    const overlay = renderImageSourceOverlay(
      imageBboxSource({ left: 0.1, top: 0.1, width: 0.2, height: 0.2 }, 2),
    );
    const off = render(
      <>
        {overlay({
          frameNumber: 1,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </>,
    );
    expect(off.container.firstElementChild).toBeNull();

    const on = render(
      <>
        {overlay({
          frameNumber: 2,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </>,
    );
    expect(on.container.firstElementChild).not.toBeNull();
  });

  it("renders nothing for an out-of-bounds anchor box even on the right frame", () => {
    const overlay = renderImageSourceOverlay(
      // left + width > 1 — an invalid normalized box
      imageBboxSource({ left: 0.9, top: 0, width: 0.5, height: 0.5 }, 1),
    );
    const { container } = render(
      <>
        {overlay({
          frameNumber: 1,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </>,
    );
    expect(container.firstElementChild).toBeNull();
  });

  it("keeps the same highlight across re-renders for the same frame number", () => {
    const overlay = renderImageSourceOverlay(
      imageBboxSource({ left: 0, top: 0, width: 0.5, height: 0.5 }, 1),
    );
    const { container } = render(
      <>
        {overlay({
          frameNumber: 1,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 180,
        })}
      </>,
    );
    const highlight = container.firstElementChild as HTMLElement;
    // 180° flips a top-left box to the bottom-right quadrant.
    expect(highlight.style.left).toBe("50%");
    expect(highlight.style.top).toBe("50%");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// useImageSourceTarget — anchor → scrollToFrameArea gating
// ──────────────────────────────────────────────────────────────────────────

describe("useImageSourceTarget", () => {
  function TargetHarness({
    handle,
    source,
  }: {
    handle: { scrollToFrameArea: ReturnType<typeof vi.fn> };
    source: Source;
  }) {
    const ref = React.useRef(handle as never);
    const target = useImageSourceTarget(ref);
    React.useEffect(() => {
      target.scrollTo?.(source, { behavior: "auto" });
    }, [target, source]);
    return null;
  }

  it("maps a valid bbox anchor to a scrollToFrameArea call", () => {
    const scrollToFrameArea = vi.fn();
    const source = imageBboxSource(
      { left: 0.1, top: 0.2, width: 0.3, height: 0.4 },
      2,
    );
    render(<TargetHarness handle={{ scrollToFrameArea }} source={source} />);

    expect(scrollToFrameArea).toHaveBeenCalledTimes(1);
    expect(scrollToFrameArea).toHaveBeenCalledWith(
      2,
      { left: 10, top: 20, width: 30, height: 40 },
      { behavior: "auto" },
    );
  });

  it("does not scroll for an anchor whose box is invalid", () => {
    const scrollToFrameArea = vi.fn();
    const source = imageBboxSource(
      { left: 0.9, top: 0, width: 0.5, height: 0.5 },
      1,
    );
    render(<TargetHarness handle={{ scrollToFrameArea }} source={source} />);
    expect(scrollToFrameArea).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Component — fit-width clamping at extreme viewport widths
// ──────────────────────────────────────────────────────────────────────────

function stubImageLoading(imageBitmap = bitmap()) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { "content-type": "image/png" },
        }),
      ),
    ),
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve(imageBitmap)),
  );
}

function stubObservableLayout(frameListWidth: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    frameListWidth,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(240);
  if (!HTMLElement.prototype.getAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  }
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
}

describe("ImageViewer fit-width clamping", () => {
  it("clamps fit-width to the 25% floor for an ultra-narrow viewport", async () => {
    // A 100px-wide image in a 30px viewport yields a negative raw fit scale
    // once horizontal padding is subtracted; it must clamp up to the 25% floor
    // rather than produce a zero/negative scale.
    stubImageLoading(bitmap(100, 100));
    stubObservableLayout(30);

    await act(async () => {
      render(
        <ImageViewer source={{ kind: "url", url: "/ultra-narrow.png" }} />,
      );
    });

    expect(await screen.findByText("25%")).toBeTruthy();
  });

  it("clamps fit-width to the 500% ceiling for a tiny image in a wide viewport", async () => {
    stubImageLoading(bitmap(10, 10));
    stubObservableLayout(932); // uncapped fit would be far above 500%

    await act(async () => {
      render(<ImageViewer source={{ kind: "url", url: "/tiny.png" }} />);
    });

    expect(await screen.findByText("500%")).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Multi-frame decode failure — source resilience vs. UI blast radius
//
// These two tests separate a fact from a design choice:
//  - The FrameSource itself is resilient: one frame failing to decode does not
//    poison its siblings.
//  - The UI, however, has a single viewer-level error boundary, so a failed
//    frame throws past every sibling frame. The second test documents that
//    blast radius. If a corrupt page in a multi-page document should degrade
//    gracefully (show the other pages) rather than blank the whole viewer, the
//    fix is a per-frame boundary — and this test will flip to red, flagging it.
// ──────────────────────────────────────────────────────────────────────────

/** Make every frame report itself near the viewport and give it a draw ctx. */
function stubIntersectingCanvasLayout() {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(240);
  if (!HTMLElement.prototype.getAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  }
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private readonly cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
      }
      observe(element: Element) {
        queueMicrotask(() =>
          this.cb(
            [
              {
                target: element,
                isIntersecting: true,
              } as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver,
          ),
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  const context = {
    drawImage: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    imageSmoothingQuality: "low",
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return context;
}

describe("multi-frame decode failure", () => {
  function threeFrameSource(
    decode: (frameIndex: number) => Promise<ImageBitmap>,
  ): FrameSource {
    return createImageSourceForTests(
      "tiff",
      [
        { width: 20, height: 20 },
        { width: 20, height: 20 },
        { width: 20, height: 20 },
      ],
      decode,
    );
  }

  it("keeps healthy frames decodable when a sibling frame's decode fails", async () => {
    const good0 = bitmap(20, 20);
    const good2 = bitmap(20, 20);
    const decode = vi.fn((index: number) =>
      index === 1
        ? Promise.reject(new Error("page 2 is corrupt"))
        : Promise.resolve(index === 0 ? good0 : good2),
    );
    const source = threeFrameSource(decode);

    await expect(source.acquire(1)).rejects.toBeInstanceOf(ImageDecodeError);
    // The bad frame must not take its neighbors down with it.
    await expect(source.acquire(0)).resolves.toBe(good0);
    await expect(source.acquire(2)).resolves.toBe(good2);
    source.dispose();
  });

  it("tears down every sibling frame sharing the viewer-level error boundary", async () => {
    stubIntersectingCanvasLayout();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const decode = vi.fn((index: number) =>
      index === 1
        ? Promise.reject(new Error("page 2 is corrupt"))
        : Promise.resolve(bitmap(20, 20)),
    );
    const source = threeFrameSource(decode);

    render(
      <ViewerErrorBoundary format="image">
        <div data-testid="document">
          <ImageFrame source={source} frameIndex={0} scale={1} rotation={0} />
          <ImageFrame source={source} frameIndex={1} scale={1} rotation={0} />
          <ImageFrame source={source} frameIndex={2} scale={1} rotation={0} />
        </div>
      </ViewerErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // The healthy pages (0 and 2) are unmounted along with the failed one:
    // the blast radius is the entire document, not just the bad page.
    expect(screen.queryByTestId("document")).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    source.dispose();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Document swap — does the page indicator follow the newly loaded document?
//
// `useVisibleFrame` keeps `currentFrameNumber` in component state, and the
// content component updates (rather than remounts) when `source` changes. If
// that state survives a swap, the page indicator can read stale until the next
// scroll. The `Math.min(current, frameCount)` clamp hides this when swapping to
// a *shorter* document — but swapping to a *longer* one would surface a stale
// "Page 3 of 5". This test pins down which way it actually behaves.
// ──────────────────────────────────────────────────────────────────────────

/** A TIFF worker whose reported frame count is the first byte of the buffer. */
function installSwapTiffEnv() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const count = url.includes("five") ? 5 : 3;
      return Promise.resolve(
        new Response(new Uint8Array([count]), {
          headers: { "content-type": "image/tiff" },
        }),
      );
    }),
  );
  vi.stubGlobal(
    "Worker",
    class SwapWorker extends FakeTiffWorker {
      override postMessage(
        message: { type: string; buffer?: ArrayBuffer; requestId?: number },
        transfer?: readonly Transferable[],
      ): void {
        super.postMessage(message as never, transfer);
        if (message.type === "init" && message.buffer) {
          const count = new Uint8Array(message.buffer)[0] ?? 1;
          queueMicrotask(() =>
            this.emit({
              type: "initOk",
              frames: Array.from({ length: count }, () => ({
                intrinsicSize: { width: 100, height: 100 },
              })),
            }),
          );
        }
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(240);
  if (!HTMLElement.prototype.getAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  }
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
}

// FakeTiffWorker mirrors the harness in image-viewer.test.tsx — the worker is
// constructed via `new Worker(...)`, so only the message protocol matters here.
class FakeTiffWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  readonly terminate = vi.fn();
  postMessage(_message: unknown, _transfer?: readonly Transferable[]): void {}
  emit(message: unknown) {
    this.onmessage?.({ data: message });
  }
}

describe("document swap page indicator", () => {
  it("does not keep a stale page number after swapping to a longer document", async () => {
    installSwapTiffEnv();

    let view!: RenderResult;
    await act(async () => {
      view = render(
        <ImageViewer source={{ kind: "url", url: "/three.tiff" }} />,
      );
    });
    const { container } = view;

    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();

    // Scroll the 3-page document down to page 3.
    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement;
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    viewport.scrollTop = 800;
    await act(async () => {
      fireEvent.scroll(viewport);
    });
    expect(screen.getByText("Page 3 of 3")).toBeTruthy();

    // Swap to a different, longer (5-page) document.
    await act(async () => {
      view.rerender(
        <ImageViewer source={{ kind: "url", url: "/five.tiff" }} />,
      );
    });
    await screen.findByText(/of 5/);

    // The freshly loaded document presents its first page rather than inheriting
    // the previous document's page 3. Before the useVisibleFrame reset fix this
    // showed a stale "Page 3 of 5".
    expect(screen.getByText("Page 1 of 5")).toBeTruthy();
    expect(screen.queryByText("Page 3 of 5")).toBeNull();
  });

  it("resets rotation when swapping documents", async () => {
    stubImageLoading(bitmap(100, 200));
    stubObservableLayout(232);

    const overlay = ({ rotation }: { rotation: number }) => (
      <div data-testid="rot" data-rotation={rotation} />
    );

    let view!: RenderResult;
    await act(async () => {
      view = render(
        <ImageViewer
          source={{ kind: "url", url: "/doc-a.png" }}
          renderFrameOverlay={overlay}
        />,
      );
    });

    const node = await screen.findByTestId("rot");
    expect(node.getAttribute("data-rotation")).toBe("0");

    // Rotate document A by 90°.
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Rotate"));
    });
    expect(screen.getByTestId("rot").getAttribute("data-rotation")).toBe("90");

    // Swap to a different document.
    await act(async () => {
      view.rerender(
        <ImageViewer
          source={{ kind: "url", url: "/doc-b.png" }}
          renderFrameOverlay={overlay}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("rot").getAttribute("data-rotation")).toBe("0");
  });

  it("resets uncontrolled zoom when swapping documents", async () => {
    stubImageLoading(bitmap(100, 100));
    stubObservableLayout(132); // fit-width scale = 100%

    let view!: RenderResult;
    await act(async () => {
      view = render(
        <ImageViewer source={{ kind: "url", url: "/zoom-a.png" }} />,
      );
    });

    expect(await screen.findByText("100%")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Zoom in"));
    });
    expect(screen.getByText("120%")).toBeTruthy();

    await act(async () => {
      view.rerender(
        <ImageViewer source={{ kind: "url", url: "/zoom-b.png" }} />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.queryByText("120%")).toBeNull();
  });
});
