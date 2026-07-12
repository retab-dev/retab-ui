import { describe, expect, it } from "vitest";

import {
  createImageFrameLayout,
  createImageWindowFromScrollPosition,
  getImageFrameLayout,
  getImagePhysicalScrollHeight,
  getImageRenderedFrameWindow,
  getImageRenderFrameNumbers,
  IMAGE_FRAME_GAP,
  IMAGE_FRAME_PADDING,
  IMAGE_RENDER_FIT_PERFECTLY_OVERSCAN_PX,
  IMAGE_RENDER_WINDOW_OVERSCAN_PX,
  IMAGE_SCROLL_REBASE_CONTAINER_PX,
  IMAGE_SCROLL_REBASE_TARGET_PX,
  resolveImagePhysicalScrollPosition,
} from "@/registry/new-york-v4/ui/image-viewer-virtualization";

const frame = { intrinsicSize: { width: 100, height: 200 } };

describe("image viewer virtualization", () => {
  it("keeps the outer frame inset aligned with the skeleton at every scale", () => {
    const layout = createImageFrameLayout({
      frames: [frame],
      scale: 2,
      rotation: 0,
    });

    expect(layout.frames[0]?.offsetTop).toBe(IMAGE_FRAME_PADDING);
    expect(layout.totalHeight).toBe(
      IMAGE_FRAME_PADDING * 2 + frame.intrinsicSize.height * 2,
    );
  });

  it("creates a centered pixel render window", () => {
    expect(
      createImageWindowFromScrollPosition({
        overscanPx: 1000,
        scrollHeight: 10_000,
        scrollTop: 5_000,
        viewportHeight: 200,
      }),
    ).toEqual({ top: 4000, bottom: 6200 });
  });

  it("creates a smaller fit-perfectly render window for large jumps", () => {
    expect(
      createImageWindowFromScrollPosition({
        fitPerfectly: true,
        fitPerfectlyOverscanPx: IMAGE_RENDER_FIT_PERFECTLY_OVERSCAN_PX,
        overscanPx: 1000,
        scrollHeight: 10_000,
        scrollTop: 5_000,
        viewportHeight: 200,
      }),
    ).toEqual({ top: 4968, bottom: 5264 });
  });

  it("renders the centered Pierre-sized pixel window by default", () => {
    const layout = createImageFrameLayout({
      frames: Array.from({ length: 585 }, () => frame),
      scale: 1,
      rotation: 0,
    });
    const frame400 = getImageFrameLayout(layout, 400);
    expect(frame400).toBeTruthy();

    expect(
      getImageRenderFrameNumbers({
        layout,
        scrollTop: frame400!.offsetTop,
        viewportHeight: 200,
      }),
    ).toEqual([395, 396, 397, 398, 399, 400, 401, 402, 403, 404, 405]);
    expect(IMAGE_RENDER_WINDOW_OVERSCAN_PX).toBe(1000);
  });

  it("builds an inverse-sticky rendered frame window", () => {
    const layout = createImageFrameLayout({
      frames: Array.from({ length: 5 }, () => frame),
      scale: 1,
      rotation: 0,
    });

    const window = getImageRenderedFrameWindow({
      frameNumbers: [2, 3],
      layout,
      viewportHeight: 100,
    });

    expect(window).toMatchObject({
      beforeHeight: IMAGE_FRAME_PADDING + 200 + IMAGE_FRAME_GAP,
      height: 200 + IMAGE_FRAME_GAP + 200,
      stickyBottomInset: -(200 + IMAGE_FRAME_GAP + 200 - 100),
      stickyTopInset: -(200 + IMAGE_FRAME_GAP + 200 - 100),
    });
    expect(window?.afterHeight).toBe(
      layout.totalHeight -
        (IMAGE_FRAME_PADDING +
          200 +
          IMAGE_FRAME_GAP +
          200 +
          IMAGE_FRAME_GAP +
          200),
    );
    expect(window?.frames).toEqual([
      expect.objectContaining({ frameNumber: 2, windowTop: 0 }),
      expect.objectContaining({
        frameNumber: 3,
        windowTop: 200 + IMAGE_FRAME_GAP,
      }),
    ]);
    expect(
      (window?.beforeHeight ?? 0) +
        (window?.height ?? 0) +
        (window?.afterHeight ?? 0),
    ).toBe(layout.totalHeight);
  });

  it("rebases rendered frame windows into the physical scroll scaffold", () => {
    const layout = createImageFrameLayout({
      frames: Array.from({ length: 100_000 }, () => frame),
      scale: 1,
      rotation: 0,
    });
    const frame400 = getImageFrameLayout(layout, 400)!;
    const scrollPageOffset = 80_000;

    const window = getImageRenderedFrameWindow({
      frameNumbers: [400, 401],
      layout,
      physicalScrollHeight: 120_000,
      scrollPageOffset,
      viewportHeight: 200,
    });

    expect(window?.beforeHeight).toBe(frame400.offsetTop - scrollPageOffset);
    expect(window?.afterHeight).toBe(
      120_000 - (window!.beforeHeight + window!.height),
    );
    expect(window?.frames[0]).toMatchObject({
      frameNumber: 400,
      windowTop: 0,
    });
  });

  it("caps huge physical scroll height while preserving logical scroll", () => {
    const totalHeight = 40_000_000;
    const viewportHeight = 600;
    const logicalScrollTop = 15_000_000;

    const physicalScrollHeight = getImagePhysicalScrollHeight({
      totalHeight,
      viewportHeight,
    });
    const position = resolveImagePhysicalScrollPosition({
      logicalScrollTop,
      scrollPageOffset: 0,
      totalHeight,
      viewportHeight,
    });

    expect(physicalScrollHeight).toBe(IMAGE_SCROLL_REBASE_CONTAINER_PX);
    expect(position.physicalScrollTop).toBe(IMAGE_SCROLL_REBASE_TARGET_PX);
    expect(position.scrollPageOffset).toBe(
      logicalScrollTop - IMAGE_SCROLL_REBASE_TARGET_PX,
    );
  });
});
