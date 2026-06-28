// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useViewerDocumentFrameLayout,
  type ViewerDocumentFrameState,
} from "@/registry/new-york-v4/ui/viewer-surface";
import type {
  ViewerGeometrySnapshot,
  ViewerGeometryStore,
} from "@/registry/new-york-v4/ui/viewer-types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useViewerDocumentFrameLayout", () => {
  it("uses the fallback inline size when no geometry store is registered", () => {
    render(<Harness documentFrame={null} fallbackInlineSize={320} />);

    expect(readLayout()).toMatchObject({
      activeInlineSize: 320,
      isTransitioning: false,
      maxInlineSize: 320,
      settledInlineSize: 320,
    });
  });

  it("uses geometry immediately while settled size lags", () => {
    const store = createGeometryStore(
      createGeometrySnapshot({
        bodyInlineSize: 640,
        documentInlineSize: 480,
        isTransitioning: false,
        sidebarInlineSize: 160,
      }),
    );
    const documentFrame = createDocumentFrame(store.geometryStore);

    render(<Harness documentFrame={documentFrame} fallbackInlineSize={320} />);

    expect(readLayout()).toMatchObject({
      activeInlineSize: 480,
      isTransitioning: false,
      maxInlineSize: 640,
      settledInlineSize: 480,
    });

    act(() => {
      store.setSnapshot(
        createGeometrySnapshot({
          bodyInlineSize: 640,
          documentInlineSize: 560,
          isTransitioning: true,
          sidebarInlineSize: 80,
        }),
      );
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 560,
      isTransitioning: true,
      maxInlineSize: 640,
      settledInlineSize: 480,
    });

    act(() => {
      store.setSnapshot(
        createGeometrySnapshot({
          bodyInlineSize: 640,
          documentInlineSize: 640,
          isTransitioning: true,
          sidebarInlineSize: 0,
        }),
      );
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 640,
      isTransitioning: true,
      maxInlineSize: 640,
      settledInlineSize: 480,
    });

    act(() => {
      store.setSnapshot(
        createGeometrySnapshot({
          bodyInlineSize: 640,
          documentInlineSize: 640,
          isTransitioning: false,
          sidebarInlineSize: 0,
        }),
      );
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 640,
      isTransitioning: false,
      maxInlineSize: 640,
      settledInlineSize: 640,
    });
  });

  it("uses measured frame width when no sidebar can affect inline space", () => {
    const store = createGeometryStore(
      createGeometrySnapshot({
        bodyInlineSize: 832,
        documentInlineSize: 832,
        isTransitioning: false,
        sidebarInlineSize: 0,
        sidebarWidth: 0,
      }),
    );
    const documentFrame = createDocumentFrame(store.geometryStore);

    render(<Harness documentFrame={documentFrame} fallbackInlineSize={600} />);

    expect(readLayout()).toMatchObject({
      activeInlineSize: 600,
      isTransitioning: false,
      maxInlineSize: 600,
      settledInlineSize: 600,
    });
  });

  it("keeps render-quality sizing settled while visual geometry moves", () => {
    const store = createGeometryStore(
      createGeometrySnapshot({
        bodyInlineSize: 640,
        documentInlineSize: 480,
        isTransitioning: false,
        sidebarInlineSize: 160,
      }),
    );
    const documentFrame = createDocumentFrame(store.geometryStore);

    render(<Harness documentFrame={documentFrame} fallbackInlineSize={320} />);

    act(() => {
      store.setSnapshot(
        createGeometrySnapshot({
          bodyInlineSize: 640,
          documentInlineSize: 640,
          isTransitioning: true,
          sidebarInlineSize: 0,
        }),
      );
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 640,
      isTransitioning: true,
      settledInlineSize: 480,
    });

    act(() => {
      store.setSnapshot(
        createGeometrySnapshot({
          bodyInlineSize: 720,
          documentInlineSize: 640,
          isTransitioning: true,
          sidebarInlineSize: 80,
        }),
      );
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 640,
      isTransitioning: true,
      maxInlineSize: 720,
      settledInlineSize: 480,
    });

    act(() => {
      store.setSnapshot(
        createGeometrySnapshot({
          bodyInlineSize: 720,
          documentInlineSize: 720,
          isTransitioning: false,
          sidebarInlineSize: 0,
        }),
      );
    });

    expect(readLayout()).toMatchObject({
      activeInlineSize: 720,
      isTransitioning: false,
      settledInlineSize: 720,
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
  };
}

function createDocumentFrame(
  geometryStore: ViewerGeometryStore,
): ViewerDocumentFrameState {
  return {
    align: "center",
    element: null,
    geometryStore,
    inlineSize: null,
  };
}

function createGeometryStore(initialSnapshot: ViewerGeometrySnapshot) {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  return {
    setSnapshot(nextSnapshot: ViewerGeometrySnapshot) {
      snapshot = nextSnapshot;
      for (const listener of listeners) listener();
    },
    geometryStore: {
      getSnapshot: () => snapshot,
      setTarget: () => {},
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    } satisfies ViewerGeometryStore,
  };
}

function createGeometrySnapshot({
  bodyInlineSize,
  documentInlineSize,
  isTransitioning,
  sidebarInlineSize,
  sidebarWidth = 160,
}: {
  bodyInlineSize: number;
  documentInlineSize: number;
  isTransitioning: boolean;
  sidebarInlineSize: number;
  sidebarWidth?: number;
}): ViewerGeometrySnapshot {
  return {
    bodyInlineSize,
    documentInlineSize,
    hasMeasuredBody: true,
    isTransitioning,
    mode: "inline",
    open: sidebarInlineSize > 0,
    progress: isTransitioning ? 0.5 : 1,
    sidebarGapTransition: "width",
    sidebarInlineSize,
    sidebarWidth,
    side: "right",
    state: sidebarInlineSize > 0 ? "expanded" : "collapsed",
    transitionPhase: isTransitioning ? "sliding" : "idle",
  };
}
