// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { ViewerBody } from "@/registry/new-york-v4/ui/viewer-body";
import { ViewerSidebarTrigger } from "@/registry/new-york-v4/ui/viewer-chrome";
import {
  FileViewer,
  FileViewerContent,
  FileViewerHeader,
  FileViewerInset,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  useFileViewerSidebar,
} from "@/registry/new-york-v4/ui/file-viewer";
import { useFileViewerRendererFrame } from "@/registry/new-york-v4/ui/file-viewer-renderer-frame";
import {
  createViewerGeometryStore,
  useViewerSidebarRegistrationContext,
} from "@/registry/new-york-v4/ui/viewer-internals";
import { FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT } from "@/registry/new-york-v4/ui/file-viewer-elements";
import { createFileViewerMotionKernel } from "@/registry/new-york-v4/ui/file-viewer-motion-kernel";
import { ViewerRoot } from "@/registry/new-york-v4/ui/viewer-root";
import { ViewerSidebar } from "@/registry/new-york-v4/ui/viewer-sidebar";
import { ViewerSurface } from "@/registry/new-york-v4/ui/viewer-surface";
import type { ViewerGeometrySnapshot } from "@/registry/new-york-v4/ui/viewer-types";

describe("createViewerGeometryStore", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

  it("makes inline sidebar non-interactive immediately while its geometry closes", () => {
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

    expect(sidebar.getAttribute("data-viewer-sidebar-state")).toBe("collapsed");
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

  it("makes inline sidebar interactive after its opening geometry settles", () => {
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

  it("derives FileViewer sidebar and document width from one motion scalar", () => {
    const frames = installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const sidebarGapElement = document.createElement("div");
    const documentSurfaceElement = document.createElement("div");

    store.setSidebarGapElement(sidebarGapElement);
    store.setDocumentSurface({ element: documentSurfaceElement });
    store.syncTarget({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: true,
      side: "right",
      sidebarWidth: 420,
    });

    expect(store.getSnapshot()).toMatchObject({
      shellInlineSize: 840,
      durationMs: 150,
      layoutInlineSize: 420,
      open: true,
      motionProgress: 1,
      sidebarInlineSize: 420,
      fromInlineSize: 420,
      toInlineSize: 420,
    });
    expect(sidebarGapElement.style.width).toBe("420px");
    expect(sidebarGapElement.style.flexBasis).toBe("420px");
    expect(documentSurfaceElement.style.transform).toBe("");

    const listener = vi.fn();
    store.subscribe(listener);

    store.startMotion({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: false,
      side: "right",
      sidebarWidth: 420,
    });

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 420,
      open: false,
      motionProgress: 0,
      sidebarInlineSize: 420,
      fromInlineSize: 420,
      toInlineSize: 840,
    });
    expect(sidebarGapElement.style.width).toBe("420px");
    expect(sidebarGapElement.style.flexBasis).toBe("420px");
    expect(documentSurfaceElement.style.transform).toBe("");
    expect(documentSurfaceElement.style.willChange).toBe("");
    expect(listener).toHaveBeenCalledTimes(1);

    frames.advance(75);

    expect(store.getInteractiveSnapshot()).toMatchObject({
      layoutInlineSize: 630,
      open: false,
      motionProgress: 0.5,
      sidebarInlineSize: 210,
      fromInlineSize: 420,
      toInlineSize: 840,
    });
    expect(sidebarGapElement.style.width).toBe("210px");
    expect(sidebarGapElement.style.flexBasis).toBe("210px");
    expect(documentSurfaceElement.style.transform).toBe("");
    expect(listener).toHaveBeenCalledTimes(1);

    frames.advance(75);

    expect(store.getInteractiveSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      open: false,
      phase: "settling",
      motionProgress: 1,
      sidebarInlineSize: 0,
      fromInlineSize: 420,
      toInlineSize: 840,
    });
    expect(sidebarGapElement.style.width).toBe("0px");
    expect(sidebarGapElement.style.flexBasis).toBe("0px");
    expect(documentSurfaceElement.style.transform).toBe("");
    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      phase: "settling",
      motionProgress: 1,
      sidebarInlineSize: 0,
      fromInlineSize: 420,
      toInlineSize: 840,
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies the renderer before chrome resize writes mutate layout styles", () => {
    installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const sidebarGapElement = document.createElement("div");
    const documentSurfaceElement = document.createElement("div");
    const observations: Array<{
      documentTransform: string;
      layoutInlineSize: number;
      sidebarGapWidth: string;
    }> = [];

    store.setSidebarGapElement(sidebarGapElement);
    store.setDocumentSurface({ element: documentSurfaceElement });
    store.syncTarget({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: true,
      side: "right",
      sidebarWidth: 420,
    });

    documentSurfaceElement.addEventListener(
      FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
      () => {
        observations.push({
          documentTransform: documentSurfaceElement.style.transform,
          layoutInlineSize: store.getInteractiveSnapshot().layoutInlineSize,
          sidebarGapWidth: sidebarGapElement.style.width,
        });
      },
    );

    store.startMotion({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: false,
      side: "right",
      sidebarWidth: 420,
    });

    expect(observations).toEqual([
      {
        documentTransform: "",
        layoutInlineSize: 420,
        sidebarGapWidth: "420px",
      },
    ]);
    expect(store.getInteractiveSnapshot()).toMatchObject({
      layoutInlineSize: 420,
      open: false,
      phase: "sliding",
    });
    expect(documentSurfaceElement.style.transform).toBe("");
  });

  it("publishes the FileViewer motion boundary without subscribing to the hot motion path", () => {
    const frames = installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const documentSurfaceElement = document.createElement("div");

    store.setDocumentSurface({ element: documentSurfaceElement });
    store.syncTarget({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: true,
      side: "right",
      sidebarWidth: 420,
    });

    const listener = vi.fn();
    store.subscribe(listener);

    store.startMotion({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: false,
      side: "right",
      sidebarWidth: 420,
    });

    expect(listener).toHaveBeenCalledTimes(1);

    frames.advance(75);

    expect(store.getInteractiveSnapshot()).toMatchObject({
      layoutInlineSize: 630,
      motionProgress: 0.5,
      sidebarInlineSize: 210,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    frames.advance(75);

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      motionProgress: 1,
      phase: "settling",
      sidebarInlineSize: 0,
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("settles and releases on the kernel clock", () => {
    const frames = installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const documentSurfaceElement = document.createElement("div");
    const openTarget = {
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline" as const,
      open: true,
      side: "right" as const,
      sidebarWidth: 420,
    };
    const closedTarget = {
      ...openTarget,
      open: false,
    };

    store.setDocumentSurface({ element: documentSurfaceElement });
    store.syncTarget(openTarget);

    const listener = vi.fn();
    store.subscribe(listener);

    store.startMotion(closedTarget);
    frames.advance(150);

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      motionProgress: 1,
      open: false,
      phase: "settling",
      sidebarInlineSize: 0,
      fromInlineSize: 420,
      toInlineSize: 840,
    });
    expect(documentSurfaceElement.style.transform).toBe("");
    expect(listener).toHaveBeenCalledTimes(2);

    frames.advance(16);

    expect(store.getSnapshot()).toMatchObject({
      phase: "settling",
    });
    expect(documentSurfaceElement.style.transform).toBe("");
    expect(listener).toHaveBeenCalledTimes(2);

    frames.advance(16);

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      motionProgress: 1,
      open: false,
      phase: "idle",
      sidebarInlineSize: 0,
      fromInlineSize: 840,
      toInlineSize: 840,
    });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("snaps subpixel endpoint frames to settle geometry", () => {
    const frames = installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const documentSurfaceElement = document.createElement("div");
    const openTarget = {
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline" as const,
      open: true,
      side: "right" as const,
      sidebarWidth: 420,
    };
    const closedTarget = {
      ...openTarget,
      open: false,
    };

    store.setDocumentSurface({ element: documentSurfaceElement });
    store.syncTarget(openTarget);
    store.startMotion(closedTarget);
    frames.advance(149.8);

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      motionProgress: 1,
      open: false,
      phase: "settling",
      sidebarInlineSize: 0,
    });
  });

  it("holds FileViewer settle until renderer geometry is stable", () => {
    const frames = installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const documentSurfaceElement = document.createElement("div");
    const openTarget = {
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline" as const,
      open: true,
      side: "right" as const,
      sidebarWidth: 420,
    };
    const closedTarget = {
      ...openTarget,
      open: false,
    };
    let rendererScrollTop = 0;

    store.setDocumentSurface({
      element: documentSurfaceElement,
      readSettleSnapshot: () => [rendererScrollTop],
    });
    store.syncTarget(openTarget);

    const listener = vi.fn();
    store.subscribe(listener);

    store.startMotion(closedTarget);
    frames.advance(150);

    expect(store.getSnapshot()).toMatchObject({
      phase: "settling",
    });

    rendererScrollTop = 12;
    frames.advance(16);

    expect(store.getSnapshot()).toMatchObject({
      phase: "settling",
    });

    frames.advance(16);

    expect(store.getSnapshot()).toMatchObject({
      phase: "settling",
    });

    frames.advance(16);

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      motionProgress: 1,
      open: false,
      phase: "idle",
      sidebarInlineSize: 0,
    });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("snaps FileViewer motion to the target when reduced motion is preferred", () => {
    mockReducedMotion();
    installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const sidebarGapElement = document.createElement("div");
    const documentSurfaceElement = document.createElement("div");

    store.setSidebarGapElement(sidebarGapElement);
    store.setDocumentSurface({ element: documentSurfaceElement });
    store.syncTarget({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: true,
      side: "right",
      sidebarWidth: 420,
    });

    const listener = vi.fn();
    store.subscribe(listener);

    store.startMotion({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: false,
      side: "right",
      sidebarWidth: 420,
    });

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 840,
      open: false,
      phase: "idle",
      sidebarInlineSize: 0,
    });
    expect(sidebarGapElement.style.width).toBe("0px");
    expect(documentSurfaceElement.style.transform).toBe("");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps FileViewer shell motion on the rAF clock instead of jumping to a CSS target", () => {
    const frames = installGeometryFrames();
    const store = createFileViewerMotionKernel();
    const sidebarGapElement = document.createElement("div");
    const documentSurfaceElement = document.createElement("div");

    store.setSidebarGapElement(sidebarGapElement);
    store.setDocumentSurface({ element: documentSurfaceElement });
    store.syncTarget({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: true,
      side: "right",
      sidebarWidth: 420,
    });

    const listener = vi.fn();
    store.subscribe(listener);

    store.startMotion({
      shellInlineSize: 840,
      durationMs: 150,
      mode: "inline",
      open: false,
      side: "right",
      sidebarWidth: 420,
    });

    expect(store.getSnapshot()).toMatchObject({
      layoutInlineSize: 420,
      phase: "sliding",
      motionProgress: 0,
      sidebarInlineSize: 420,
      fromInlineSize: 420,
      toInlineSize: 840,
    });
    expect(sidebarGapElement.style.width).toBe("420px");
    expect(documentSurfaceElement.style.transform).toBe("");

    frames.advance(75);

    expect(store.getInteractiveSnapshot()).toMatchObject({
      layoutInlineSize: 630,
      motionProgress: 0.5,
      sidebarInlineSize: 210,
    });
    expect(sidebarGapElement.style.width).toBe("210px");
    expect(documentSurfaceElement.style.transform).toBe("");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("drives FileViewer inline sidebar geometry through the shell DOM", () => {
    const frames = installGeometryFrames();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("data-slot") === "file-viewer-root") {
          return createRect(740);
        }

        return createRect(0);
      },
    );

    render(
      <FileViewerProvider
        defaultSidebarOpen
        source={{
          kind: "url",
          url: "/files/report.pdf",
          fileName: "report.pdf",
        }}
      >
        <FileViewer sidebarMode="inline">
          <FileViewerHeader>
            <FileViewerSidebarTrigger data-testid="file-trigger" />
          </FileViewerHeader>
          <FileViewerContent>
            <FileViewerInset>
              <FileViewerContractSnapshot data-testid="file-contract" />
            </FileViewerInset>
            <FileViewerSidebar
              data-testid="file-sidebar"
              side="right"
              width="420px"
            >
              Sidebar
            </FileViewerSidebar>
          </FileViewerContent>
        </FileViewer>
      </FileViewerProvider>,
    );

    const root = screen
      .getByTestId("file-trigger")
      .closest('[data-slot="file-viewer-root"]');
    const gap = document.querySelector('[data-slot="file-viewer-sidebar-gap"]');
    const sidebar = screen.getByTestId("file-sidebar");

    expect(root?.getAttribute("data-file-viewer-sidebar-open")).toBe("true");
    expect(
      (root as HTMLElement | null)?.style.getPropertyValue(
        "--file-viewer-sidebar-inline-size",
      ),
    ).toBe("");
    expect((gap as HTMLElement | null)?.style.width).toBe("420px");
    expect((gap as HTMLElement | null)?.style.flexBasis).toBe("420px");
    expect((sidebar as HTMLElement).style.width).toBe("420px");
    expect((sidebar as HTMLElement).style.transform).toBe("");
    expect(
      (root as HTMLElement | null)?.style.getPropertyValue(
        "--file-viewer-document-visual-scale",
      ),
    ).toBe("");
    expect((gap as HTMLElement | null)?.style.transitionDuration).toBe("");
    expect((gap as HTMLElement | null)?.style.transitionProperty).toBe("");
    expect(readFileViewerContractSnapshot("file-contract")).toMatchObject({
      isTransitioning: false,
      layoutInlineSize: 320,
      motionDurationMs: 150,
      phase: "idle",
      rasterInlineSize: 320,
      settledInlineSize: 320,
      fromInlineSize: 320,
      toInlineSize: 320,
      documentTransition: {
        layoutPolicy: "live",
        source: "none",
      },
    });
    expect(sidebar.hasAttribute("aria-hidden")).toBe(false);

    fireEvent.click(screen.getByTestId("file-trigger"));

    expect(root?.getAttribute("data-file-viewer-sidebar-open")).toBe("false");
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(false);
    expect(sidebar.style.pointerEvents).toBe("none");

    expect(
      (root as HTMLElement | null)?.style.getPropertyValue(
        "--file-viewer-sidebar-inline-size",
      ),
    ).toBe("");
    expect((gap as HTMLElement | null)?.style.width).toBe("420px");
    expect((gap as HTMLElement | null)?.style.flexBasis).toBe("420px");
    expect((gap as HTMLElement | null)?.style.overflow).toBe("");
    expect((sidebar as HTMLElement).style.transform).toBe("");
    expect((sidebar as HTMLElement).style.willChange).toBe("");
    expect(
      (root as HTMLElement | null)?.style.getPropertyValue(
        "--file-viewer-document-visual-scale",
      ),
    ).toBe("");
    // Commit-then-relax: the very first sliding frame already carries the
    // TARGET layout policy — renderers lay out at the destination width in
    // the toggle's own commit and the kernel transform hides the jump.
    expect(readFileViewerContractSnapshot("file-contract")).toMatchObject({
      isTransitioning: true,
      layoutInlineSize: 320,
      motionDurationMs: 150,
      phase: "sliding",
      rasterInlineSize: 740,
      settledInlineSize: 740,
      fromInlineSize: 320,
      toInlineSize: 740,
      documentTransition: {
        layoutPolicy: "target",
        source: "viewer-shell",
      },
    });

    frames.advance(150);

    expect(root?.getAttribute("data-file-viewer-sidebar-open")).toBe("false");
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(sidebar.style.pointerEvents).toBe("none");
    expect(readFileViewerContractSnapshot("file-contract")).toMatchObject({
      isTransitioning: false,
      layoutInlineSize: 740,
      phase: "settling",
      rasterInlineSize: 740,
      settledInlineSize: 740,
      fromInlineSize: 320,
      toInlineSize: 740,
      documentTransition: {
        layoutPolicy: "target",
        source: "viewer-shell",
      },
    });

    frames.advance(16);

    expect(readFileViewerContractSnapshot("file-contract")).toMatchObject({
      phase: "settling",
    });

    frames.advance(16);

    expect(readFileViewerContractSnapshot("file-contract")).toMatchObject({
      isTransitioning: false,
      layoutInlineSize: 740,
      phase: "idle",
      rasterInlineSize: 740,
      settledInlineSize: 740,
      fromInlineSize: 740,
      toInlineSize: 740,
      documentTransition: {
        layoutPolicy: "live",
        source: "none",
      },
    });
  });

  it("makes FileViewer inline sidebar interactive after opening geometry settles", () => {
    const frames = installGeometryFrames();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("data-slot") === "file-viewer-root") {
          return createRect(740);
        }

        return createRect(0);
      },
    );

    render(
      <FileViewerProvider
        source={{
          kind: "url",
          url: "/files/report.pdf",
          fileName: "report.pdf",
        }}
      >
        <FileViewer sidebarMode="inline">
          <FileViewerHeader>
            <FileViewerSidebarTrigger data-testid="file-trigger" />
            <FileViewerSidebarPhaseSnapshot data-testid="file-phases" />
          </FileViewerHeader>
          <FileViewerContent>
            <FileViewerInset>
              <FileViewerContractSnapshot data-testid="file-contract" />
            </FileViewerInset>
            <FileViewerSidebar
              data-testid="file-sidebar"
              side="right"
              width="420px"
            >
              Sidebar
            </FileViewerSidebar>
          </FileViewerContent>
        </FileViewer>
      </FileViewerProvider>,
    );

    const sidebar = screen.getByTestId("file-sidebar");

    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(readFileViewerSidebarPhaseSnapshot("file-phases")).toMatchObject({
      isSidebarOpen: false,
      isSidebarInteractive: false,
    });

    fireEvent.click(screen.getByTestId("file-trigger"));

    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(
      screen
        .getByTestId("file-trigger")
        .closest('[data-slot="file-viewer-root"]')
        ?.getAttribute("data-file-viewer-sidebar-open"),
    ).toBe("true");
    expect(
      screen.getByTestId("file-trigger").getAttribute("aria-expanded"),
    ).toBe("false");

    frames.advance(75);

    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);

    frames.advance(75);

    expect(sidebar.hasAttribute("aria-hidden")).toBe(false);
    expect(sidebar.hasAttribute("inert")).toBe(false);
    expect(
      screen.getByTestId("file-trigger").getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("restores focus to the FileViewer sidebar trigger when closing from inside the sidebar", () => {
    render(
      <FileViewerProvider
        source={{
          kind: "url",
          url: "/files/report.pdf",
          fileName: "report.pdf",
        }}
        defaultSidebarOpen
      >
        <FileViewer sidebarMode="inline">
          <FileViewerHeader>
            <FileViewerSidebarTrigger data-testid="file-trigger" />
          </FileViewerHeader>
          <FileViewerContent>
            <FileViewerInset>Document</FileViewerInset>
            <FileViewerSidebar
              data-testid="file-sidebar"
              side="right"
              width="420px"
            >
              <FileViewerSidebarCloseButton />
            </FileViewerSidebar>
          </FileViewerContent>
        </FileViewer>
      </FileViewerProvider>,
    );

    const trigger = screen.getByTestId("file-trigger");
    const closeButton = screen.getByTestId("file-sidebar-close");

    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    fireEvent.click(closeButton);

    expect(document.activeElement).toBe(trigger);
  });

  it("closes the FileViewer sidebar with Escape while focus is inside the viewer", () => {
    render(
      <FileViewerProvider
        source={{
          kind: "url",
          url: "/files/report.pdf",
          fileName: "report.pdf",
        }}
        defaultSidebarOpen
      >
        <FileViewer sidebarMode="inline">
          <FileViewerHeader>
            <FileViewerSidebarTrigger data-testid="file-trigger" />
          </FileViewerHeader>
          <FileViewerContent>
            <FileViewerInset>
              <button type="button" data-testid="document-button">
                Document action
              </button>
            </FileViewerInset>
            <FileViewerSidebar
              data-testid="file-sidebar"
              side="right"
              width="420px"
            >
              Sidebar
            </FileViewerSidebar>
          </FileViewerContent>
        </FileViewer>
      </FileViewerProvider>,
    );

    const documentButton = screen.getByTestId("document-button");
    const sidebar = screen.getByTestId("file-sidebar");

    expect(sidebar.hasAttribute("aria-hidden")).toBe(false);
    documentButton.focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(sidebar.style.pointerEvents).toBe("none");
  });
});

function FileViewerContractSnapshot({
  "data-testid": testId,
}: {
  "data-testid": string;
}) {
  const contract = useFileViewerRendererFrame({
    fallbackInlineSize: 320,
  });

  return (
    <output data-testid={testId}>
      {JSON.stringify({
        isTransitioning: contract.isTransitioning,
        layoutInlineSize: contract.layoutInlineSize,
        motionDurationMs: contract.motionDurationMs,
        phase: contract.phase,
        rasterInlineSize: contract.rasterInlineSize,
        settledInlineSize: contract.settledInlineSize,
        fromInlineSize: contract.fromInlineSize,
        toInlineSize: contract.toInlineSize,
        documentTransition: contract.documentTransition,
      })}
    </output>
  );
}

function FileViewerSidebarPhaseSnapshot({
  "data-testid": testId,
}: {
  "data-testid": string;
}) {
  const sidebar = useFileViewerSidebar();

  return (
    <output data-testid={testId}>
      {JSON.stringify({
        isSidebarOpen: sidebar.isSidebarOpen,
        isSidebarInteractive: sidebar.isSidebarInteractive,
      })}
    </output>
  );
}

function FileViewerSidebarCloseButton() {
  const sidebar = useFileViewerSidebar();

  return (
    <button
      type="button"
      data-testid="file-sidebar-close"
      onClick={() => sidebar.setSidebarOpen(false)}
    >
      Close
    </button>
  );
}

function GeometrySnapshot({
  "data-testid": testId,
}: {
  "data-testid": string;
}) {
  const { geometryStore } =
    useViewerSidebarRegistrationContext("GeometrySnapshot");
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

function readFileViewerContractSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? "{}") as {
    isTransitioning: boolean;
    layoutInlineSize: number | null;
    motionDurationMs: number;
    phase: "idle" | "sliding" | "settling";
    rasterInlineSize: number | null;
    settledInlineSize: number | null;
    fromInlineSize: number | null;
    toInlineSize: number | null;
    documentTransition: {
      layoutPolicy: string;
      source: string;
    };
  };
}

function readFileViewerSidebarPhaseSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? "{}") as {
    isSidebarOpen: boolean;
    isSidebarInteractive: boolean;
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
