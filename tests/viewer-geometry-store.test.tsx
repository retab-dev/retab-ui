// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ViewerBody } from "@/registry/new-york-v4/ui/viewer-body";
import { ViewerSidebarTrigger } from "@/registry/new-york-v4/ui/viewer-chrome";
import {
  FileViewer,
  FileViewerBody,
  FileViewerHeader,
  FileViewerInset,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
} from "@/registry/new-york-v4/ui/file-viewer";
import {
  createViewerGeometryStore,
  useViewerSidebarRegistrationContext,
} from "@/registry/new-york-v4/ui/viewer-internals";
import { ViewerRoot } from "@/registry/new-york-v4/ui/viewer-root";
import { ViewerSidebar } from "@/registry/new-york-v4/ui/viewer-sidebar";
import { ViewerSurface } from "@/registry/new-york-v4/ui/viewer-surface";
import type { ViewerGeometrySnapshot } from "@/registry/new-york-v4/ui/viewer-types";

describe("createViewerGeometryStore", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("settles target geometry immediately when reduced motion is preferred", () => {
    mockReducedMotion();

    const store = createViewerGeometryStore();
    const rootElement = createMeasuredElement(840);
    const bodyElement = createMeasuredElement(840);
    const sidebarElement = createMeasuredElement(420);

    store.setTarget(
      createTarget({ bodyElement, open: true, rootElement, sidebarElement }),
    );

    expect(store.getSnapshot()).toMatchObject({
      bodyInlineSize: 840,
      documentInlineSize: 420,
      isTransitioning: false,
      open: true,
      progress: 1,
      sidebarInlineSize: 420,
      sidebarWidth: 420,
    });

    store.setTarget(
      createTarget({ bodyElement, open: false, rootElement, sidebarElement }),
    );

    expect(store.getSnapshot()).toMatchObject({
      bodyInlineSize: 840,
      documentInlineSize: 840,
      isTransitioning: false,
      open: false,
      progress: 1,
      sidebarInlineSize: 0,
      sidebarWidth: 420,
    });
  });

  it("derives sidebar and document width from one transition progress", () => {
    const frames = installGeometryFrames();
    const store = createViewerGeometryStore();
    const rootElement = createMeasuredElement(840);
    const bodyElement = createMeasuredElement(840);
    const sidebarElement = createMeasuredElement(420);

    store.setTarget(
      createTarget({ bodyElement, open: true, rootElement, sidebarElement }),
    );
    store.setTarget(
      createTarget({ bodyElement, open: false, rootElement, sidebarElement }),
    );
    store.setTarget(
      createTarget({ bodyElement, open: false, rootElement, sidebarElement }),
    );

    expect(store.getSnapshot()).toMatchObject({
      bodyInlineSize: 840,
      documentInlineSize: 420,
      isTransitioning: true,
      open: false,
      progress: 0,
      sidebarInlineSize: 420,
      transitionPhase: "sliding",
    });

    frames.advance(0);
    frames.advance(75);

    expect(store.getSnapshot()).toMatchObject({
      bodyInlineSize: 840,
      documentInlineSize: 630,
      isTransitioning: true,
      open: false,
      progress: 0.5,
      sidebarInlineSize: 210,
      transitionPhase: "sliding",
    });

    frames.advance(75);

    expect(store.getSnapshot()).toMatchObject({
      bodyInlineSize: 840,
      documentInlineSize: 840,
      isTransitioning: false,
      open: false,
      progress: 1,
      sidebarInlineSize: 0,
      transitionPhase: "idle",
    });
  });

  it("uses the declared sidebar width when the registered element measures zero", () => {
    mockReducedMotion();

    const store = createViewerGeometryStore();
    const rootElement = createMeasuredElement(840);
    const bodyElement = createMeasuredElement(840);
    const sidebarElement = createMeasuredElement(0);
    rootElement.style.setProperty("--viewer-sidebar-width", "420px");

    store.setTarget(
      createTarget({
        bodyElement,
        open: true,
        rootElement,
        sidebarElement,
        sidebarWidth: 0,
      }),
    );

    expect(store.getSnapshot()).toMatchObject({
      documentInlineSize: 420,
      open: true,
      sidebarInlineSize: 420,
      sidebarWidth: 420,
    });

    store.setTarget(
      createTarget({
        bodyElement,
        open: false,
        rootElement,
        sidebarElement,
        sidebarWidth: 0,
      }),
    );

    expect(store.getSnapshot()).toMatchObject({
      documentInlineSize: 840,
      isTransitioning: false,
      open: false,
      sidebarInlineSize: 0,
      sidebarWidth: 420,
    });
  });

  it("transitions from explicit width when the sidebar element is temporarily missing", () => {
    installGeometryFrames();
    const store = createViewerGeometryStore();
    const rootElement = createMeasuredElement(840);
    const bodyElement = createMeasuredElement(840);

    store.setTarget(
      createTarget({
        bodyElement,
        open: true,
        rootElement,
        sidebarElement: null,
        sidebarWidth: 420,
      }),
    );

    expect(store.getSnapshot()).toMatchObject({
      documentInlineSize: 420,
      open: true,
      sidebarInlineSize: 420,
      sidebarWidth: 420,
    });

    store.setTarget(
      createTarget({
        bodyElement,
        open: false,
        rootElement,
        sidebarElement: null,
        sidebarWidth: 420,
      }),
    );

    expect(store.getSnapshot()).toMatchObject({
      documentInlineSize: 420,
      isTransitioning: true,
      open: false,
      sidebarInlineSize: 420,
      sidebarWidth: 420,
    });
  });

  it("settles immediately without a sidebar element or explicit width", () => {
    const store = createViewerGeometryStore();
    const rootElement = createMeasuredElement(840);
    const bodyElement = createMeasuredElement(840);

    store.setTarget(
      createTarget({
        bodyElement,
        open: true,
        rootElement,
        sidebarElement: null,
        sidebarWidth: 0,
      }),
    );

    expect(store.getSnapshot()).toMatchObject({
      documentInlineSize: 840,
      isTransitioning: false,
      open: true,
      progress: 1,
      sidebarInlineSize: 0,
      sidebarWidth: 0,
    });
  });

  it("publishes ViewerRoot inline geometry during sidebar toggles", () => {
    const frames = installGeometryFrames();

    render(
      <ViewerRoot defaultOpen mode="inline" sidebarSide="right">
        <ViewerSidebarTrigger data-testid="trigger" />
        <GeometrySnapshot data-testid="layout" />
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
          <ViewerSidebar width="420px">Sidebar</ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>,
    );

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: false,
      open: true,
      sidebarInlineSize: 420,
    });

    fireEvent.click(screen.getByTestId("trigger"));

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: true,
      open: false,
      progress: 0,
      sidebarInlineSize: 420,
      transitionPhase: "sliding",
    });

    frames.advance(0);
    frames.advance(75);

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: true,
      open: false,
      progress: 0.5,
      sidebarInlineSize: 210,
      transitionPhase: "sliding",
    });

    frames.advance(75);

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: false,
      open: false,
      progress: 1,
      sidebarInlineSize: 0,
      transitionPhase: "idle",
    });
  });

  it("hides inline sidebar semantics immediately while its geometry closes", () => {
    const frames = installGeometryFrames();

    render(
      <ViewerRoot defaultOpen mode="inline" sidebarSide="right">
        <ViewerSidebarTrigger data-testid="trigger" />
        <GeometrySnapshot data-testid="layout" />
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
          <ViewerSidebar data-testid="sidebar" width="420px">
            Sidebar
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>,
    );

    const sidebar = screen.getByTestId("sidebar");

    fireEvent.click(screen.getByTestId("trigger"));

    expect(sidebar.getAttribute("data-viewer-sidebar-state")).toBe(
      "collapsed",
    );
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: true,
      open: false,
      sidebarInlineSize: 420,
      transitionPhase: "sliding",
    });

    frames.advance(0);
    frames.advance(75);

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: true,
      open: false,
      sidebarInlineSize: 210,
    });
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);

    frames.advance(75);

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: false,
      open: false,
      sidebarInlineSize: 0,
      transitionPhase: "idle",
    });
  });

  it("reveals inline sidebar semantics after its opening geometry settles", () => {
    const frames = installGeometryFrames();

    render(
      <ViewerRoot mode="inline" sidebarSide="right">
        <ViewerSidebarTrigger data-testid="trigger" />
        <GeometrySnapshot data-testid="layout" />
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
          <ViewerSidebar data-testid="sidebar" width="420px">
            Sidebar
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>,
    );

    const sidebar = screen.getByTestId("sidebar");

    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);

    fireEvent.click(screen.getByTestId("trigger"));

    expect(sidebar.getAttribute("data-viewer-sidebar-state")).toBe("expanded");
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: true,
      open: true,
      progress: 0,
      sidebarInlineSize: 0,
      transitionPhase: "sliding",
    });

    frames.advance(0);
    frames.advance(75);

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: true,
      open: true,
      progress: 0.5,
      sidebarInlineSize: 210,
      transitionPhase: "sliding",
    });
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);

    frames.advance(75);

    expect(readGeometrySnapshot("layout")).toMatchObject({
      isTransitioning: false,
      open: true,
      progress: 1,
      sidebarInlineSize: 420,
      transitionPhase: "idle",
    });
    expect(sidebar.hasAttribute("aria-hidden")).toBe(false);
    expect(sidebar.hasAttribute("inert")).toBe(false);
  });

  it("moves focus to the sidebar trigger before hiding a closing sidebar", () => {
    render(
      <ViewerRoot defaultOpen mode="inline" sidebarSide="right">
        <ViewerSidebarTrigger data-testid="trigger" />
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
          <ViewerSidebar data-testid="sidebar" width="420px">
            <button type="button" data-testid="inside-sidebar">
              Sidebar action
            </button>
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>,
    );

    const trigger = screen.getByTestId("trigger");
    const sidebar = screen.getByTestId("sidebar");
    const insideSidebar = screen.getByTestId("inside-sidebar");

    insideSidebar.focus();
    expect(document.activeElement).toBe(insideSidebar);

    fireEvent.click(trigger);

    expect(document.activeElement).toBe(trigger);
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);
  });

  it("publishes FileViewer inline geometry during sidebar toggles", () => {
    const frames = installGeometryFrames();

    render(
      <FileViewerProvider
        defaultSidebarOpen
        source={{
          kind: "url",
          url: "/files/report.pdf",
          fileName: "report.pdf",
        }}
      >
        <FileViewer sidebarMode="inline" sidebarSide="right">
          <FileViewerHeader>
            <FileViewerSidebarTrigger data-testid="file-trigger" />
            <GeometrySnapshot data-testid="file-layout" />
          </FileViewerHeader>
          <FileViewerBody>
            <FileViewerInset>Surface</FileViewerInset>
            <FileViewerSidebar width="420px">Sidebar</FileViewerSidebar>
          </FileViewerBody>
        </FileViewer>
      </FileViewerProvider>,
    );

    expect(readGeometrySnapshot("file-layout")).toMatchObject({
      isTransitioning: false,
      open: true,
      sidebarInlineSize: 420,
    });

    fireEvent.click(screen.getByTestId("file-trigger"));

    expect(readGeometrySnapshot("file-layout")).toMatchObject({
      isTransitioning: true,
      open: false,
      progress: 0,
      sidebarInlineSize: 420,
      transitionPhase: "sliding",
    });

    frames.advance(0);
    frames.advance(75);

    expect(readGeometrySnapshot("file-layout")).toMatchObject({
      isTransitioning: true,
      open: false,
      progress: 0.5,
      sidebarInlineSize: 210,
      transitionPhase: "sliding",
    });

    frames.advance(75);

    expect(readGeometrySnapshot("file-layout")).toMatchObject({
      isTransitioning: false,
      open: false,
      progress: 1,
      sidebarInlineSize: 0,
      transitionPhase: "idle",
    });
  });
});

function GeometrySnapshot({
  "data-testid": testId,
}: {
  "data-testid": string;
}) {
  const { geometryStore } = useViewerSidebarRegistrationContext(
    "GeometrySnapshot",
  );
  const snapshot = React.useSyncExternalStore(
    geometryStore.subscribe,
    geometryStore.getSnapshot,
    geometryStore.getSnapshot,
  );

  return <output data-testid={testId}>{JSON.stringify(snapshot)}</output>;
}

function readGeometrySnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? "{}") as {
    bodyInlineSize: number;
    documentInlineSize: number;
    isTransitioning: boolean;
    open: boolean;
    progress: number;
    sidebarInlineSize: number;
    sidebarWidth: number;
    transitionPhase: "idle" | "sliding";
  };
}

function createTarget({
  bodyElement,
  open,
  rootElement,
  sidebarElement,
  sidebarWidth = 420,
}: {
  bodyElement: HTMLElement;
  open: boolean;
  rootElement: HTMLElement;
  sidebarElement: HTMLElement | null;
  sidebarWidth?: number;
}) {
  return {
    bodyElement,
    mode: "inline",
    open,
    rootElement,
    sidebarElement,
    sidebarGapTransition: "width",
    sidebarWidth,
    side: "right",
    state: open ? "expanded" : "collapsed",
  } as const;
}

function createMeasuredElement(width: number) {
  const element = document.createElement("div");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(createRect(width));
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: width,
  });
  return element;
}

function createRect(width: number): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

function installGeometryFrames() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let now = 0;
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
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: requestAnimationFrame,
    writable: true,
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: cancelAnimationFrame,
    writable: true,
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);

  return {
    advance(ms: number) {
      now += ms;
      const frameCallbacks = Array.from(callbacks.values());
      callbacks.clear();
      act(() => {
        for (const callback of frameCallbacks) callback(now);
      });
    },
  };
}

function mockReducedMotion() {
  const matchMedia = vi.fn(
    (query: string) =>
      ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal("matchMedia", matchMedia);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMedia,
    writable: true,
  });
}
