// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { useViewerDocumentScroll } from "@/registry/new-york-v4/ui/viewer-document-scroll";
import type {
  ViewerDocumentLayoutModel,
  ViewerDocumentScrollMapper,
  ViewerDocumentTransition,
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
  vi.unstubAllGlobals();
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

  it("preserves the cached reading anchor when a shorter layout clamps DOM scroll first", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 1500,
    });
    const api = {
      handleScroll: null as (() => void) | null,
    };

    function Harness({
      blockSize,
      isTransitioning,
    }: {
      blockSize: number;
      isTransitioning: boolean;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize, isTransitioning),
        resetKey: "same-document",
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.handleScroll = scroll.handleScroll;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={2000} isTransitioning={false} />);

    act(() => {
      api.handleScroll?.();
    });
    viewport.element.scrollTop = 400;

    view.rerender(<Harness blockSize={1000} isTransitioning />);

    await waitFor(() => expect(viewport.element.scrollTop).toBe(740));
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

  it("ignores stale programmatic targets when chrome resize settles", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 1500,
    });
    const api = {
      scrollToTarget: null as ((target: TestTarget) => void) | null,
    };

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize, false, transition),
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

    const view = render(<Harness blockSize={2000} />);

    act(() => {
      api.scrollToTarget?.({ ratio: 0.25 });
    });
    viewport.element.scrollTop = 1500;

    view.rerender(
      <Harness
        blockSize={1000}
        transition={{
          layoutPolicy: "target",
          scrollPolicy: "rebase",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    await waitFor(() => expect(viewport.element.scrollTop).toBe(740));
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      behavior: "auto",
      top: 740,
    });
  });

  it("uses the stable cached anchor when shrink settle clamps DOM scroll first", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 1500,
    });
    const api = {
      handleScroll: null as (() => void) | null,
    };

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize, false, transition),
        resetKey: "same-document",
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.handleScroll = scroll.handleScroll;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={2000} />);

    act(() => {
      api.handleScroll?.();
    });
    viewport.element.scrollTop = 900;

    view.rerender(
      <Harness
        blockSize={1000}
        transition={{
          layoutPolicy: "target",
          scrollPolicy: "rebase",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    await waitFor(() => expect(viewport.element.scrollTop).toBe(740));
  });

  it("defers anchor restoration while chrome resize owns visual motion", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 200,
    });

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(
          blockSize,
          transition?.layoutPolicy === "frozen",
          transition,
        ),
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

    view.rerender(
      <Harness
        blockSize={2000}
        transition={{
          layoutPolicy: "frozen",
          scrollPolicy: "defer",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    await waitFor(() => expect(viewport.element.scrollTop).toBe(200));
    expect(viewport.scrollTo).not.toHaveBeenCalled();
  });

  it("rebases the reading anchor once when chrome resize settles", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 200,
    });

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize, false, transition),
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

    view.rerender(
      <Harness
        blockSize={2000}
        transition={{
          layoutPolicy: "target",
          scrollPolicy: "rebase",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    await waitFor(() => expect(viewport.element.scrollTop).toBe(420));
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      behavior: "auto",
      top: 420,
    });
  });

  it("keeps the frozen chrome-resize anchor when DOM scroll changes before settle", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 1500,
    });
    const api = {
      handleScroll: null as (() => void) | null,
    };

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(
          blockSize,
          transition?.layoutPolicy === "frozen",
          transition,
        ),
        resetKey: "same-document",
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.handleScroll = scroll.handleScroll;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={2000} />);

    act(() => {
      api.handleScroll?.();
    });

    view.rerender(
      <Harness
        blockSize={2000}
        transition={{
          layoutPolicy: "frozen",
          scrollPolicy: "defer",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    viewport.element.scrollTop = 400;
    act(() => {
      api.handleScroll?.();
    });

    view.rerender(
      <Harness
        blockSize={1000}
        transition={{
          layoutPolicy: "target",
          scrollPolicy: "rebase",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    await waitFor(() => expect(viewport.element.scrollTop).toBe(740));
  });

  it("uses the preflight cached anchor instead of a stale null-id chrome-resize anchor", async () => {
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollTop: 500,
    });
    const api = {
      handleScroll: null as (() => void) | null,
    };

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(
          blockSize,
          transition?.layoutPolicy === "frozen",
          transition,
        ),
        resetKey: "same-document",
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.handleScroll = scroll.handleScroll;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={2000} />);

    view.rerender(
      <Harness
        blockSize={2000}
        transition={{
          layoutPolicy: "frozen",
          scrollPolicy: "defer",
          source: "viewer-shell",
          transitionId: null,
          visualPolicy: "shell-transform",
        }}
      />,
    );

    viewport.element.scrollTop = 1500;
    act(() => {
      api.handleScroll?.();
    });
    viewport.element.scrollTop = 500;

    view.rerender(
      <Harness
        blockSize={1000}
        transition={{
          layoutPolicy: "target",
          scrollPolicy: "rebase",
          source: "viewer-shell",
          transitionId: "next-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    await waitFor(() => expect(viewport.element.scrollTop).toBe(740));
  });

  it("replays anchor restoration when the virtual scroll range grows after settle", async () => {
    const frames = installAnimationFrames();
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollHeight: 2000,
      scrollTop: 1500,
    });
    const api = {
      handleScroll: null as (() => void) | null,
    };

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize, false, transition),
        resetKey: "same-document",
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.handleScroll = scroll.handleScroll;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={2000} />);

    act(() => {
      api.handleScroll?.();
    });
    viewport.setScrollHeight(500);
    viewport.element.scrollTop = 400;

    view.rerender(
      <Harness
        blockSize={1000}
        transition={{
          layoutPolicy: "target",
          scrollPolicy: "rebase",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    expect(viewport.element.scrollTop).toBe(400);
    expect(viewport.scrollTo).not.toHaveBeenCalledWith({
      behavior: "auto",
      top: 740,
    });

    viewport.setScrollHeight(1000);
    frames.advance();

    await waitFor(() => expect(viewport.element.scrollTop).toBe(740));
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      behavior: "auto",
      top: 740,
    });
  });

  it("cancels deferred anchor restoration when a programmatic target arrives", async () => {
    const frames = installAnimationFrames();
    const viewport = createControlledViewport({
      clientHeight: 100,
      scrollHeight: 2000,
      scrollTop: 1500,
    });
    const api = {
      handleScroll: null as (() => void) | null,
      scrollToTarget: null as ((target: TestTarget) => void) | null,
    };

    function Harness({
      blockSize,
      transition,
    }: {
      blockSize: number;
      transition?: ViewerDocumentTransition;
    }) {
      const scroll = useViewerDocumentScroll<TestAnchor, TestTarget>({
        layout: createLayout(blockSize, false, transition),
        resetKey: "same-document",
        resolveScrollTarget: ({ layout, target }) => ({
          top: layout.blockSize * target.ratio,
        }),
        scrollMapper: SIMPLE_SCROLL_MAPPER,
      });
      api.handleScroll = scroll.handleScroll;
      api.scrollToTarget = scroll.scrollToTarget;

      useMountEffect(() => {
        scroll.setViewportElement(viewport.element);
        return () => scroll.setViewportElement(null);
      });

      return null;
    }

    const view = render(<Harness blockSize={2000} />);

    act(() => {
      api.handleScroll?.();
    });
    viewport.setScrollHeight(500);
    viewport.element.scrollTop = 400;

    view.rerender(
      <Harness
        blockSize={1000}
        transition={{
          layoutPolicy: "target",
          scrollPolicy: "rebase",
          source: "viewer-shell",
          transitionId: "test-chrome-resize",
          visualPolicy: "shell-transform",
        }}
      />,
    );

    act(() => {
      api.scrollToTarget?.({ ratio: 0 });
    });
    viewport.setScrollHeight(1000);
    frames.advance();

    expect(viewport.element.scrollTop).toBe(0);
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 0,
    });
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
  isTransitioning = false,
  transition?: ViewerDocumentTransition,
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
    isTransitioning,
    transition,
  };
}

function createControlledViewport({
  clientHeight,
  scrollHeight = 10_000,
  scrollTop,
}: {
  clientHeight: number;
  scrollHeight?: number;
  scrollTop: number;
}) {
  let currentScrollHeight = scrollHeight;
  let currentScrollTop = scrollTop;
  const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
    if (typeof top === "number") currentScrollTop = top;
  });
  const element = {
    addEventListener: vi.fn(),
    clientHeight,
    removeEventListener: vi.fn(),
    scrollLeft: 0,
    scrollTo,
    get scrollHeight() {
      return currentScrollHeight;
    },
    get scrollTop() {
      return currentScrollTop;
    },
    set scrollTop(value: number) {
      currentScrollTop = value;
    },
  } as unknown as HTMLDivElement;

  return {
    element,
    scrollTo,
    setScrollHeight(value: number) {
      currentScrollHeight = value;
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function installAnimationFrames() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  const cancelAnimationFrame = vi.fn((id: number) => {
    callbacks.delete(id);
  });

  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

  return {
    advance() {
      const frameCallbacks = Array.from(callbacks.values());
      callbacks.clear();
      act(() => {
        for (const callback of frameCallbacks) callback(0);
      });
    },
  };
}
