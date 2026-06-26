// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { useVisibleFrame } from "@/registry/new-york-v4/ui/image-viewer-hooks";
import { createImageFrameLayout } from "@/registry/new-york-v4/ui/image-viewer-virtualization";

const TEST_FRAMES = Array.from({ length: 5 }, () => ({
  intrinsicSize: { width: 100, height: 200 },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useVisibleFrame", () => {
  it("preserves the image reading anchor when layout block size changes", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 300,
    });

    function Harness({ scale }: { scale: number }) {
      const layout = React.useMemo(
        () =>
          createImageFrameLayout({
            frames: TEST_FRAMES,
            rotation: 0,
            scale,
          }),
        [scale],
      );
      const scroll = useVisibleFrame(
        layout,
        "same-image",
        undefined,
        undefined,
      );

      useMountEffect(() => {
        scroll.setScrollViewportRef(viewport.element);
        return () => scroll.setScrollViewportRef(null);
      });

      return null;
    }

    const view = render(<Harness scale={1} />);

    view.rerender(<Harness scale={2} />);

    await waitFor(() => expect(viewport.element.scrollTop).toBe(588));
  });

  it("retargets active frame-area scroll when layout block size changes", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 0,
    });
    const api = {
      scrollToFrameArea: null as
        | ((
            frameNumber: number,
            area: { top: number },
            options?: ScrollToOptions,
          ) => void)
        | null,
    };

    function Harness({ scale }: { scale: number }) {
      const layout = React.useMemo(
        () =>
          createImageFrameLayout({
            frames: TEST_FRAMES,
            rotation: 0,
            scale,
          }),
        [scale],
      );
      const scroll = useVisibleFrame(
        layout,
        "same-image",
        undefined,
        undefined,
      );
      api.scrollToFrameArea = scroll.scrollToFrameArea;

      useMountEffect(() => {
        scroll.setScrollViewportRef(viewport.element);
        return () => scroll.setScrollViewportRef(null);
      });

      return null;
    }

    const view = render(<Harness scale={1} />);

    act(() => {
      api.scrollToFrameArea?.(2, { top: 25 });
    });

    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 234,
    });

    view.rerender(<Harness scale={2} />);

    await waitFor(() =>
      expect(viewport.scrollTo).toHaveBeenLastCalledWith({
        behavior: "smooth",
        top: 484,
      }),
    );
  });
});

function createControlledViewport({
  clientHeight,
  scrollTop,
}: {
  clientHeight: number;
  scrollTop: number;
}) {
  let currentScrollTop = scrollTop;
  const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
    if (typeof top === "number") currentScrollTop = top;
  });
  const element = {
    addEventListener: vi.fn(),
    clientHeight,
    removeEventListener: vi.fn(),
    scrollHeight: 10_000,
    scrollLeft: 0,
    scrollTo,
    get scrollTop() {
      return currentScrollTop;
    },
    set scrollTop(value: number) {
      currentScrollTop = value;
    },
  } as unknown as HTMLDivElement;

  return { element, scrollTo };
}
