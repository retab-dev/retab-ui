// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { useViewerDocumentScroll } from "@/registry/new-york-v4/ui/viewer-document-scroll";
import type {
  ViewerDocumentLayoutModel,
  ViewerDocumentScrollMapper,
} from "@/registry/new-york-v4/ui/viewer-types";

type TestAnchor =
  | {
      kind: "top";
    }
  | {
      kind: "ratio";
      value: number;
    };

type TestTarget = {
  ratio: number;
};

const SIMPLE_SCROLL_MAPPER: ViewerDocumentScrollMapper = {
  getLogicalScrollTop: ({ blockSize, physicalScrollTop, viewportBlockSize }) =>
    clamp(physicalScrollTop, 0, blockSize - viewportBlockSize),
  getPhysicalScrollSize: ({ blockSize }) => blockSize,
  resolvePhysicalScrollPosition: ({
    blockSize,
    logicalScrollTop,
    viewportBlockSize,
  }) => ({
    physicalScrollTop: clamp(
      logicalScrollTop,
      0,
      blockSize - viewportBlockSize,
    ),
    scrollPageOffset: 0,
  }),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useViewerDocumentScroll", () => {
  it("preserves the document reading anchor when layout block size changes", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 200,
    });

    function Harness({ blockSize }: { blockSize: number }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize),
        resetKey: "same-document",
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={1000} />);

    view.rerender(<Harness blockSize={2000} />);

    await waitFor(() => expect(viewport.element.scrollTop).toBe(420));
  });

  it("retargets active programmatic scroll when layout block size changes", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 0,
    });
    const api = {
      scrollToTarget: null as ((target: TestTarget) => void) | null,
    };

    function Harness({ blockSize }: { blockSize: number }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize),
        resetKey: "same-document",
        resolveScrollTarget: ({ layout, target }) => ({
          top: layout.blockSize * target.ratio,
        }),
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.scrollToTarget = scroll.scrollToTarget;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={1000} />);

    act(() => {
      api.scrollToTarget?.({ ratio: 0.5 });
    });

    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 500,
    });

    view.rerender(<Harness blockSize={2000} />);

    await waitFor(() =>
      expect(viewport.scrollTo).toHaveBeenLastCalledWith({
        behavior: "smooth",
        top: 1000,
      }),
    );
  });

  it("dispatches programmatic targets even when the viewport is already there", () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 0,
    });
    const api = {
      scrollToTarget: null as ((target: TestTarget) => void) | null,
    };

    function Harness() {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(1000),
        resetKey: "same-document",
        resolveScrollTarget: ({ layout, target }) => ({
          top: layout.blockSize * target.ratio,
        }),
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.scrollToTarget = scroll.scrollToTarget;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    render(<Harness />);

    act(() => {
      api.scrollToTarget?.({ ratio: 0 });
    });

    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 0,
    });
  });
});

function createLayout(
  blockSize: number,
): ViewerDocumentLayoutModel<TestAnchor> {
  return {
    blockSize,
    captureReadingAnchor: ({ scrollTop, viewportBlockSize }) =>
      scrollTop <= 0
        ? { kind: "top" }
        : {
            kind: "ratio",
            value: (scrollTop + viewportBlockSize * 0.2) / blockSize,
          },
    getReadingAnchorScrollTop: ({ anchor, viewportBlockSize }) =>
      anchor.kind === "top"
        ? 0
        : anchor.value * blockSize - viewportBlockSize * 0.2,
    inlineSize: 100,
  };
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
