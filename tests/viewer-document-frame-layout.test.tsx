// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  useViewerDocumentFrameLayout,
  type ViewerDocumentFrameLayoutTransition,
  type ViewerDocumentFrameLayoutTransitionSample,
  type ViewerDocumentFrameState,
} from "@/registry/new-york-v4/ui/viewer-surface";

afterEach(() => {
  cleanup();
});

describe("useViewerDocumentFrameLayout", () => {
  it("uses the fallback inline size when no frame transition is registered", () => {
    render(<Harness documentFrame={null} fallbackInlineSize={320} />);

    expect(readLayout()).toMatchObject({
      activeInlineSize: 320,
      isTransitioning: false,
      maxInlineSize: 320,
      settledInlineSize: 320,
      targetInlineSize: 320,
    });
  });

  it("tracks active inline size while retaining settled size until the transition completes", () => {
    const store = createLayoutTransitionStore({
      inlineSize: 480,
      isTransitioning: false,
      maxInlineSize: 640,
      progress: 0,
      targetInlineSize: 480,
    });
    const documentFrame = createDocumentFrame(store.transition);

    render(<Harness documentFrame={documentFrame} fallbackInlineSize={320} />);

    expect(readLayout()).toMatchObject({
      activeInlineSize: 480,
      isTransitioning: false,
      maxInlineSize: 640,
      settledInlineSize: 480,
      targetInlineSize: 480,
    });

    act(() => {
      store.setSnapshot({
        inlineSize: 560,
        isTransitioning: true,
        maxInlineSize: 640,
        progress: 0.5,
        targetInlineSize: 640,
      });
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 560,
      isTransitioning: true,
      maxInlineSize: 640,
      settledInlineSize: 480,
      targetInlineSize: 640,
    });

    act(() => {
      store.setSnapshot({
        inlineSize: 640,
        isTransitioning: false,
        maxInlineSize: 640,
        progress: 1,
        targetInlineSize: 640,
      });
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 640,
      isTransitioning: false,
      maxInlineSize: 640,
      settledInlineSize: 640,
      targetInlineSize: 640,
    });
  });
});

function Harness({
  documentFrame,
  fallbackInlineSize,
}: {
  documentFrame: ViewerDocumentFrameState | null;
  fallbackInlineSize: number | null;
}) {
  const layout = useViewerDocumentFrameLayout({
    documentFrame,
    fallbackInlineSize,
  });

  return <output data-testid="layout">{JSON.stringify(layout)}</output>;
}

function readLayout() {
  return JSON.parse(screen.getByTestId("layout").textContent ?? "{}") as {
    activeInlineSize: number | null;
    isTransitioning: boolean;
    maxInlineSize: number | null;
    settledInlineSize: number | null;
    targetInlineSize: number | null;
  };
}

function createDocumentFrame(
  layoutTransition: ViewerDocumentFrameLayoutTransition,
): ViewerDocumentFrameState {
  return {
    align: "center",
    element: null,
    inlineSize: null,
    layoutTransition,
  };
}

function createLayoutTransitionStore(
  initialSnapshot: ViewerDocumentFrameLayoutTransitionSample,
) {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  return {
    setSnapshot(nextSnapshot: ViewerDocumentFrameLayoutTransitionSample) {
      snapshot = nextSnapshot;
      for (const listener of listeners) listener();
    },
    transition: {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } satisfies ViewerDocumentFrameLayoutTransition,
  };
}
