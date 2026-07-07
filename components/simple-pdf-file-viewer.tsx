"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import {
  Activity,
  CheckCircle2,
  FileText,
  Loader2,
  Menu,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
  XCircle,
} from "lucide-react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

type SimplePdfSource = {
  id: string;
  label: string;
  fileName: string;
  url: string;
};

type SimplePdfDocument = {
  numPages: number;
  destroy: () => Promise<void>;
  getPage: (pageNumber: number) => Promise<SimplePdfPageProxy>;
};

type SimplePdfPageProxy = {
  getViewport: (options: { scale: number; rotation?: number }) => {
    width: number;
    height: number;
  };
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => {
    promise: Promise<void>;
    cancel: () => void;
  };
};

type SimplePdfjsModule = {
  GlobalWorkerOptions: {
    workerSrc?: string;
  };
  getDocument: (url: string) => {
    promise: Promise<SimplePdfDocument>;
  };
};

type SimplePdfLoadState =
  | {
      document: null;
      error: null;
      status: "loading";
    }
  | {
      document: SimplePdfDocument;
      error: null;
      status: "ready";
    }
  | {
      document: null;
      error: Error;
      status: "error";
    };

type SimplePdfPageSize = {
  height: number;
  pageNumber: number;
  width: number;
};

type SimplePdfReadingAnchor = {
  documentOffset: number;
  markerOffset: number;
  pageNumber: number;
  yRatio: number;
};

type SimplePdfMotion = {
  anchor: SimplePdfReadingAnchor;
  anchorPageWidth: number;
  bodyWidth: number;
  durationMs: number;
  fromScale: number;
  fromSidebarWidth: number;
  id: number;
  targetAnchorOffset: number;
  targetScrollTop: number;
  toScale: number;
  toSidebarWidth: number;
};

type SimplePdfMotionFrame = {
  motion: SimplePdfMotion;
  progress: number;
  scale: number;
  sidebarWidth: number;
};

type SimplePdfTelemetryMetricId =
  | "blink"
  | "back-and-forth"
  | "horizontal-back-and-forth"
  | "overshoot"
  | "vertical-overshoot"
  | "settle-jitter"
  | "resize-linearity"
  | "scroll-drift"
  | "scroll-geometry"
  | "gap-stability"
  | "renderer-continuity"
  | "canvas-pixel-continuity"
  | "raster-headroom"
  | "dom-mutations"
  | "layout-shift"
  | "main-thread"
  | "geometry-sync"
  | "cycle-invariance";

type SimplePdfTelemetryMetric = {
  budget: string;
  detail: string;
  id: SimplePdfTelemetryMetricId;
  label: string;
  passed: boolean;
  value: string;
};

type SimplePdfTelemetrySample = {
  bodyWidth: number;
  clientHeight: number;
  clientWidth: number;
  documentHeight: number;
  documentLeft: number;
  documentTop: number;
  documentTransform: string;
  documentWidth: number;
  devicePixelRatio: number;
  elapsedMs: number;
  fingerprint: string;
  gapValues: number[];
  hasBlink: boolean;
  primaryAnchorHeight: number | null;
  primaryAnchorId: string | null;
  primaryAnchorCanvasWidth: number | null;
  primaryAnchorInkRatio: number | null;
  primaryAnchorMarkerOffset: number;
  primaryAnchorPixelSignature: string | null;
  primaryAnchorLeft: number | null;
  primaryAnchorTop: number | null;
  primaryAnchorWidth: number | null;
  scrollHeight: number;
  scrollTop: number;
  scrollWidth: number;
  sidebarState: string | null;
  sidebarWidth: number;
  timestamp: number;
  visibleErrorPageCount: number;
  visibleLoadingPageCount: number;
  visiblePageCount: number;
  visibleReadyCanvasPageCount: number;
  visibleReadyPageCount: number;
  viewportWidth: number;
};

type SimplePdfTelemetryRun = {
  action: "close" | "open";
  addedNodeCount: number;
  after: SimplePdfTelemetrySample;
  attributeMutationCount: number;
  before: SimplePdfTelemetrySample;
  canvasResizeMutationCount: number;
  layoutShiftCount: number;
  layoutShiftScore: number;
  longTaskCount: number;
  longTaskDuration: number;
  mutationCount: number;
  removedNodeCount: number;
  renderStatusMutationCount: number;
  scenario: "deep-scroll" | "page-edge";
  samples: SimplePdfTelemetrySample[];
  scrollEventCount: number;
  windowScrollEventCount: number;
};

type SimplePdfTelemetryResult = {
  durationMs: number;
  metrics: SimplePdfTelemetryMetric[];
  runs: SimplePdfTelemetryRun[];
  sampledFrameCount: number;
  status: "failed" | "passed";
};

type SimplePdfTelemetryApi = {
  getLastResult: () => SimplePdfTelemetryResult | null;
  run: () => Promise<SimplePdfTelemetryResult | null>;
};

type SimplePdfFileViewerProps = {
  sources?: readonly SimplePdfSource[];
};

declare global {
  interface Window {
    __simplePdfFileViewerTelemetry?: SimplePdfTelemetryApi;
  }
}

const DEFAULT_SIMPLE_PDF_SOURCES = [
  {
    id: "attention",
    label: "Attention",
    fileName: "attention.pdf",
    url: "/samples/attention.pdf",
  },
  {
    id: "bank",
    label: "Bank statement",
    fileName: "bank-statement-3-pages.pdf",
    url: "/samples/bank-statement-3-pages.pdf",
  },
  {
    id: "prospectus",
    label: "SpaceX prospectus",
    fileName: "spacex-prospectus.pdf",
    url: "/samples/spacex-prospectus.pdf",
  },
] satisfies readonly SimplePdfSource[];

const SIMPLE_PDF_PAGE_GAP = 16;
const SIMPLE_PDF_PAGE_PADDING = 24;
const SIMPLE_PDF_READING_MARKER_RATIO = 0.2;
const SIMPLE_PDF_SCROLL_ANCHOR_MARKER_RATIO = 0;
const SIMPLE_PDF_TELEMETRY_ANCHOR_MARKER_RATIO = 0;
const SIMPLE_PDF_SIDEBAR_WIDTH = 256;
const SIMPLE_PDF_SIDEBAR_MOTION_MS = 180;
const SIMPLE_PDF_MIN_SCALE = 0.35;
const SIMPLE_PDF_MAX_SCALE = 2.5;
const SIMPLE_PDF_MIN_ZOOM_FACTOR = 0.5;
const SIMPLE_PDF_MAX_ZOOM_FACTOR = 2;
const SIMPLE_PDF_ZOOM_STEP = 0.1;
const SIMPLE_PDF_DEVICE_PIXEL_RATIO_MAX = 2;
const SIMPLE_PDF_RASTER_HEADROOM_PX = 2;
const SIMPLE_PDF_TELEMETRY_SETTLE_MS = 260;
const SIMPLE_PDF_TELEMETRY_SCROLL_DEPTH_RATIO = 0.58;
const SIMPLE_PDF_RASTER_REFRESH_DELAY_MS = 120;
const SIMPLE_PDF_REVERSAL_EPSILON = 8;
const SIMPLE_PDF_HORIZONTAL_REVERSAL_EPSILON_PX = 1;
const SIMPLE_PDF_MOTION_FINAL_SNAP_EPSILON_PX = 8;
const SIMPLE_PDF_MOTION_SETTLE_EPSILON_PX = 1;
const SIMPLE_PDF_SETTLE_SCROLL_EPSILON_PX = 0.25;
const SIMPLE_PDF_SETTLE_ANCHOR_HOLD_FRAMES = 4;

let simplePdfjsPromise: Promise<SimplePdfjsModule> | null = null;

export function SimplePdfFileViewer({
  sources = DEFAULT_SIMPLE_PDF_SOURCES,
}: SimplePdfFileViewerProps) {
  const [activeSourceId, setActiveSourceId] = React.useState(sources[0]?.id);
  const activeSource =
    sources.find((source) => source.id === activeSourceId) ?? sources[0];
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [zoomFactor, setZoomFactor] = React.useState(1);
  const [layoutScale, setLayoutScale] = React.useState(1);
  const [rasterScale, setRasterScale] = React.useState(1);
  const [motion, setMotion] = React.useState<SimplePdfMotion | null>(null);
  const [motionSidebarWidth, setMotionSidebarWidth] = React.useState<
    number | null
  >(null);
  const [motionVisualScale, setMotionVisualScale] = React.useState(1);
  const [motionVisualTranslateX, setMotionVisualTranslateX] = React.useState(0);
  const [motionVisualTranslateY, setMotionVisualTranslateY] = React.useState(0);
  const [rotation, setRotation] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isTelemetryRunning, setIsTelemetryRunning] = React.useState(false);
  const [telemetryResult, setTelemetryResult] =
    React.useState<SimplePdfTelemetryResult | null>(null);
  const [renderedPages, setRenderedPages] = React.useState(
    () => new Set<number>(),
  );
  const bodySize = useSimpleElementInlineSize<HTMLDivElement>();
  const viewportSize = useSimpleElementInlineSize<HTMLDivElement>();
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const pageElementByNumberRef = React.useRef(new Map<number, HTMLElement>());
  const motionIdRef = React.useRef(0);
  const motionFrameRef = React.useRef(0);
  const pendingScrollTopRef = React.useRef<number | null>(null);
  const settleFrameRef = React.useRef(0);
  const isSidebarOpenRef = React.useRef(isSidebarOpen);
  const layoutScaleRef = React.useRef(layoutScale);
  const motionRef = React.useRef(motion);
  const telemetryResultRef = React.useRef<SimplePdfTelemetryResult | null>(
    null,
  );
  const { document, error, status } = useSimplePdfDocument(activeSource);
  const pageSizes = useSimplePdfPageSizes(document, rotation);
  const pageSizesRef = React.useRef(pageSizes);
  const zoomFactorRef = React.useRef(zoomFactor);
  const pageNumbers = React.useMemo(
    () =>
      document
        ? Array.from({ length: document.numPages }, (_, index) => index + 1)
        : [],
    [document],
  );
  const pageSizeByNumber = React.useMemo(
    () => new Map(pageSizes.map((size) => [size.pageNumber, size])),
    [pageSizes],
  );
  const pageSizeSignature = React.useMemo(
    () =>
      pageSizes
        .map((size) => `${size.pageNumber}:${size.width}x${size.height}`)
        .join("|"),
    [pageSizes],
  );
  const targetRasterScale = React.useMemo(() => {
    if (status !== "ready" || pageSizes.length === 0) return rasterScale;
    const maxViewportWidth =
      bodySize.width > 0 ? bodySize.width : viewportSize.width;
    if (maxViewportWidth <= 0) return layoutScale;
    return getSimplePdfFitScale({
      pageSizes,
      viewportWidth: maxViewportWidth + SIMPLE_PDF_RASTER_HEADROOM_PX,
      zoomFactor,
    });
  }, [
    bodySize.width,
    layoutScale,
    pageSizes,
    rasterScale,
    status,
    viewportSize.width,
    zoomFactor,
  ]);
  const renderScale = Math.max(rasterScale, targetRasterScale);

  isSidebarOpenRef.current = isSidebarOpen;
  layoutScaleRef.current = layoutScale;
  motionRef.current = motion;
  telemetryResultRef.current = telemetryResult;
  pageSizesRef.current = pageSizes;
  zoomFactorRef.current = zoomFactor;

  useKeyedMountEffect(
    joinEffectKey(["simple-pdf-source-reset", activeSource?.id]),
    () => {
      setRenderedPages(new Set());
      setCurrentPage(1);
      setZoomFactor(1);
      setLayoutScale(1);
      setRasterScale(1);
      setMotion(null);
      setMotionSidebarWidth(null);
      setMotionVisualScale(1);
      setMotionVisualTranslateX(0);
      setMotionVisualTranslateY(0);
      setTelemetryResult(null);
      setRotation(0);
      if (settleFrameRef.current) {
        cancelAnimationFrame(settleFrameRef.current);
        settleFrameRef.current = 0;
      }
      const viewportElement = viewportRef.current;
      if (viewportElement) viewportElement.scrollTop = 0;
    },
  );

  const setViewportElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef.current = element;
      viewportSize.setElement(element);
    },
    [viewportSize],
  );

  useMountEffect(() => () => {
    if (motionFrameRef.current) {
      cancelAnimationFrame(motionFrameRef.current);
    }
    if (settleFrameRef.current) {
      cancelAnimationFrame(settleFrameRef.current);
    }
  });

  useKeyedLayoutEffect(
    pendingScrollTopRef.current == null
      ? null
      : joinEffectKey([
          "simple-pdf-pending-scroll",
          isSidebarOpen ? "open" : "closed",
          layoutScale,
          motion ? motion.id : "idle",
          motionSidebarWidth ?? "none",
        ]),
    () => {
      const pendingScrollTop = pendingScrollTopRef.current;
      const viewportElement = viewportRef.current;
      if (pendingScrollTop == null || !viewportElement) return;

      setSimplePdfViewportScrollTop(viewportElement, pendingScrollTop);
      pendingScrollTopRef.current = null;
    },
  );

  const registerPageElement = React.useCallback(
    (pageNumber: number, element: HTMLElement | null) => {
      if (element) {
        pageElementByNumberRef.current.set(pageNumber, element);
      } else {
        pageElementByNumberRef.current.delete(pageNumber);
      }
    },
    [],
  );

  const updateCurrentPage = React.useCallback(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;

    const marker =
      viewportElement.getBoundingClientRect().top +
      viewportElement.clientHeight * 0.2;
    let nextPage = 1;

    for (const pageNumber of pageNumbers) {
      const element = pageElementByNumberRef.current.get(pageNumber);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.top <= marker) nextPage = pageNumber;
      if (rect.top > marker) break;
    }

    setCurrentPage((previousPage) =>
      previousPage === nextPage ? previousPage : nextPage,
    );
  }, [pageNumbers]);

  const handleViewportScroll = React.useMemo(() => {
    let frame = 0;

    return () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateCurrentPage();
      });
    };
  }, [updateCurrentPage]);

  const scrollToPage = React.useCallback(
    (pageNumber: number) => {
      if (motionRef.current) return;
      const viewportElement = viewportRef.current;
      const element = pageElementByNumberRef.current.get(pageNumber);
      if (!viewportElement || !element) return;

      const pageRect = element.getBoundingClientRect();
      const viewportRect = viewportElement.getBoundingClientRect();
      setSimplePdfViewportScrollTop(
        viewportElement,
        viewportElement.scrollTop + pageRect.top - viewportRect.top,
      );
      updateCurrentPage();
    },
    [updateCurrentPage],
  );

  const handlePageRendered = React.useCallback((pageNumber: number) => {
    setRenderedPages((previousPages) => {
      if (previousPages.has(pageNumber)) return previousPages;
      const nextPages = new Set(previousPages);
      nextPages.add(pageNumber);
      return nextPages;
    });
  }, []);

  const commitLayoutScale = React.useCallback(
    (nextScale: number, options: { sync?: boolean } = {}) => {
      const safeNextScale = clampSimplePdfScale(nextScale);
      if (Math.abs(safeNextScale - layoutScaleRef.current) <= 0.001) return;

      const viewportElement = viewportRef.current;
      const anchor =
        viewportElement && pageSizesRef.current.length > 0
          ? captureSimplePdfReadingAnchor({
              pageSizes: pageSizesRef.current,
              scale: layoutScaleRef.current,
              viewportElement,
            })
          : null;

      const commit = () => {
        setLayoutScale(safeNextScale);
      };

      if (options.sync) {
        flushSync(commit);
      } else {
        commit();
      }

      layoutScaleRef.current = safeNextScale;

      if (viewportElement && anchor) {
        const rebaseScroll = () => {
          viewportElement.scrollTop = getSimplePdfAnchorScrollTop({
            anchor,
            pageSizes: pageSizesRef.current,
            scale: safeNextScale,
            viewportHeight: viewportElement.clientHeight,
          });
          updateCurrentPage();
        };

        if (options.sync) {
          rebaseScroll();
        } else {
          requestAnimationFrame(rebaseScroll);
        }
      }
    },
    [updateCurrentPage],
  );

  const settleSidebarMotion = React.useCallback(
    (settledMotion: SimplePdfMotion) => {
      if (motionRef.current?.id !== settledMotion.id) return;

      const viewportElement = viewportRef.current;
      const settledScale = settledMotion.toScale;
      const targetScrollTop = settledMotion.targetScrollTop;

      if (motionFrameRef.current) {
        cancelAnimationFrame(motionFrameRef.current);
        motionFrameRef.current = 0;
      }
      if (settleFrameRef.current) {
        cancelAnimationFrame(settleFrameRef.current);
        settleFrameRef.current = 0;
      }

      if (viewportElement) {
        setSimplePdfViewportScrollTop(viewportElement, targetScrollTop);
      }
      pendingScrollTopRef.current = viewportElement ? targetScrollTop : null;
      const initialCompensation = viewportElement
        ? viewportElement.scrollTop - targetScrollTop
        : 0;
      flushSync(() => {
        setLayoutScale(settledScale);
        setMotionSidebarWidth(settledMotion.toSidebarWidth);
        setMotionVisualScale(1);
        setMotionVisualTranslateX(0);
        setMotionVisualTranslateY(initialCompensation);
      });

      layoutScaleRef.current = settledScale;

      if (!viewportElement) {
        motionRef.current = null;
        flushSync(() => {
          setMotionVisualScale(1);
          setMotionVisualTranslateX(0);
          setMotionVisualTranslateY(0);
          setMotion(null);
          setMotionSidebarWidth(null);
        });
        return;
      }

      let stableFrameCount = 0;
      let remainingFrameCount = SIMPLE_PDF_SETTLE_ANCHOR_HOLD_FRAMES + 2;

      const holdSettledVisualAnchor = () => {
        setSimplePdfViewportScrollTop(viewportElement, targetScrollTop);
        const compensation = viewportElement.scrollTop - targetScrollTop;

        flushSync(() => {
          setMotionSidebarWidth(settledMotion.toSidebarWidth);
          setMotionVisualScale(1);
          setMotionVisualTranslateX(0);
          setMotionVisualTranslateY(compensation);
        });
        updateCurrentPage();

        if (Math.abs(compensation) <= SIMPLE_PDF_SETTLE_SCROLL_EPSILON_PX) {
          stableFrameCount += 1;
        } else {
          stableFrameCount = 0;
        }

        remainingFrameCount -= 1;
        if (stableFrameCount >= 2 || remainingFrameCount <= 0) {
          setSimplePdfViewportScrollTop(viewportElement, targetScrollTop);
          motionRef.current = null;
          settleFrameRef.current = 0;
          flushSync(() => {
            setMotionVisualScale(1);
            setMotionVisualTranslateX(0);
            setMotionVisualTranslateY(0);
            setMotion(null);
            setMotionSidebarWidth(null);
          });
          setSimplePdfViewportScrollTop(viewportElement, targetScrollTop);
          updateCurrentPage();
          return;
        }

        settleFrameRef.current = requestAnimationFrame(holdSettledVisualAnchor);
      };

      settleFrameRef.current = requestAnimationFrame(holdSettledVisualAnchor);
    },
    [updateCurrentPage],
  );

  const updateSidebarMotionFrame = React.useCallback(
    ({ motion: activeMotion, scale, sidebarWidth }: SimplePdfMotionFrame) => {
      if (motionIdRef.current !== activeMotion.id) return;

      const viewportElement = viewportRef.current;
      const visualTransform = getSimplePdfMotionVisualTransform({
        motion: activeMotion,
        sidebarWidth,
        visualLayoutScale: scale,
      });

      if (viewportElement) {
        setSimplePdfViewportScrollTop(
          viewportElement,
          activeMotion.targetScrollTop,
        );
      }
      flushSync(() => {
        setMotionSidebarWidth(sidebarWidth);
        setMotionVisualScale(visualTransform.scale);
        setMotionVisualTranslateX(visualTransform.translateX);
        setMotionVisualTranslateY(visualTransform.translateY);
      });
      if (viewportElement) {
        setSimplePdfViewportScrollTop(
          viewportElement,
          activeMotion.targetScrollTop,
        );
      }
    },
    [],
  );

  const toggleSidebar = React.useCallback(() => {
    if (motionRef.current) return;

    const viewportElement = viewportRef.current;
    const currentPageSizes = pageSizesRef.current;
    if (!viewportElement || currentPageSizes.length === 0) {
      setIsSidebarOpen((open) => !open);
      return;
    }

    const nextOpen = !isSidebarOpenRef.current;
    const currentSidebarWidth = isSidebarOpenRef.current
      ? SIMPLE_PDF_SIDEBAR_WIDTH
      : 0;
    const targetSidebarWidth = nextOpen ? SIMPLE_PDF_SIDEBAR_WIDTH : 0;
    const currentViewportWidth =
      viewportElement.getBoundingClientRect().width ||
      viewportElement.clientWidth;
    const currentBodyWidth = Math.max(
      1,
      currentViewportWidth + currentSidebarWidth,
    );
    const targetViewportWidth = Math.max(
      1,
      currentBodyWidth - targetSidebarWidth,
    );
    const fromScale = layoutScaleRef.current;
    const toScale = getSimplePdfFitScale({
      pageSizes: currentPageSizes,
      viewportWidth: targetViewportWidth,
      zoomFactor: zoomFactorRef.current,
    });
    const anchor = captureSimplePdfReadingAnchor({
      pageSizes: currentPageSizes,
      scale: fromScale,
      viewportElement,
    });
    const targetScrollTop = getSimplePdfAnchorScrollTop({
      anchor,
      pageSizes: currentPageSizes,
      scale: toScale,
      viewportHeight: viewportElement.clientHeight,
    });
    const targetAnchorOffset = getSimplePdfAnchorDocumentOffset({
      anchor,
      pageSizes: currentPageSizes,
      scale: toScale,
    });
    const anchorPageWidth =
      currentPageSizes.find((size) => size.pageNumber === anchor.pageNumber)
        ?.width ??
      currentPageSizes[0]?.width ??
      getSimplePdfMaxPageWidth(currentPageSizes);
    const nextMotion: SimplePdfMotion = {
      anchor,
      anchorPageWidth,
      bodyWidth: currentBodyWidth,
      durationMs: SIMPLE_PDF_SIDEBAR_MOTION_MS,
      fromScale,
      fromSidebarWidth: currentSidebarWidth,
      id: motionIdRef.current + 1,
      targetAnchorOffset,
      targetScrollTop,
      toScale,
      toSidebarWidth: targetSidebarWidth,
    };
    const initialVisualTransform = getSimplePdfMotionVisualTransform({
      motion: nextMotion,
      sidebarWidth: currentSidebarWidth,
      visualLayoutScale: fromScale,
    });

    motionIdRef.current = nextMotion.id;
    if (motionFrameRef.current) {
      cancelAnimationFrame(motionFrameRef.current);
      motionFrameRef.current = 0;
    }
    if (settleFrameRef.current) {
      cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = 0;
    }

    setSimplePdfViewportScrollTop(viewportElement, targetScrollTop);
    flushSync(() => {
      setLayoutScale(toScale);
      setMotion(nextMotion);
      setMotionSidebarWidth(currentSidebarWidth);
      setMotionVisualScale(initialVisualTransform.scale);
      setMotionVisualTranslateX(initialVisualTransform.translateX);
      setMotionVisualTranslateY(initialVisualTransform.translateY);
      setIsSidebarOpen(nextOpen);
    });
    setSimplePdfViewportScrollTop(viewportElement, targetScrollTop);
    layoutScaleRef.current = toScale;
    startSimplePdfSidebarMotion({
      motion: nextMotion,
      motionFrameRef,
      motionIdRef,
      onProgress: updateSidebarMotionFrame,
      onSettle: settleSidebarMotion,
    });
  }, [settleSidebarMotion, updateSidebarMotionFrame]);

  const runTelemetry = React.useCallback(async () => {
    const rootElement = bodySize.element?.closest<HTMLElement>(
      '[data-slot="simple-file-viewer"]',
    );
    const viewportElement = viewportRef.current;
    if (
      status !== "ready" ||
      !rootElement ||
      !viewportElement ||
      motionRef.current
    ) {
      return null;
    }

    try {
      if (rasterScale + 0.001 < targetRasterScale) {
        flushSync(() => {
          setRasterScale(targetRasterScale);
        });
      }
      await waitForSimplePdfReadyPages(rootElement, 5_000);
      setIsTelemetryRunning(true);
      await waitForSimplePdfReadyPages(rootElement, 5_000);

      const result = await runSimplePdfSidebarTelemetry({
        durationMs: SIMPLE_PDF_SIDEBAR_MOTION_MS,
        rootElement,
        toggleSidebar,
        viewportElement,
      });
      setTelemetryResult(result);
      telemetryResultRef.current = result;
      logSimplePdfTelemetryResult(result);
      return result;
    } finally {
      setIsTelemetryRunning(false);
    }
  }, [bodySize.element, rasterScale, status, targetRasterScale, toggleSidebar]);

  useKeyedMountEffect(
    joinEffectKey(["simple-pdf-telemetry-api", runTelemetry]),
    () => {
      const api: SimplePdfTelemetryApi = {
        getLastResult: () => telemetryResultRef.current,
        run: runTelemetry,
      };
      window.__simplePdfFileViewerTelemetry = api;

      return () => {
        if (window.__simplePdfFileViewerTelemetry === api) {
          delete window.__simplePdfFileViewerTelemetry;
        }
      };
    },
  );

  useKeyedMountEffect(
    joinEffectKey([
      "simple-pdf-idle-fit",
      motion ? motion.id : "idle",
      pageSizeSignature,
      status,
      viewportSize.width,
      zoomFactor,
    ]),
    () => {
      if (
        status !== "ready" ||
        motion ||
        pageSizes.length === 0 ||
        viewportSize.width <= 0
      ) {
        return;
      }

      commitLayoutScale(
        getSimplePdfFitScale({
          pageSizes,
          viewportWidth: viewportSize.width,
          zoomFactor,
        }),
      );
    },
  );

  const zoomOut = React.useCallback(() => {
    if (motionRef.current) return;
    const nextZoomFactor = clampSimplePdfZoomFactor(
      zoomFactorRef.current - SIMPLE_PDF_ZOOM_STEP,
    );
    setZoomFactor(nextZoomFactor);
    zoomFactorRef.current = nextZoomFactor;
    if (viewportSize.width > 0 && pageSizesRef.current.length > 0) {
      commitLayoutScale(
        getSimplePdfFitScale({
          pageSizes: pageSizesRef.current,
          viewportWidth: viewportSize.width,
          zoomFactor: nextZoomFactor,
        }),
      );
    }
  }, [commitLayoutScale, viewportSize.width]);

  const zoomIn = React.useCallback(() => {
    if (motionRef.current) return;
    const nextZoomFactor = clampSimplePdfZoomFactor(
      zoomFactorRef.current + SIMPLE_PDF_ZOOM_STEP,
    );
    setZoomFactor(nextZoomFactor);
    zoomFactorRef.current = nextZoomFactor;
    if (viewportSize.width > 0 && pageSizesRef.current.length > 0) {
      commitLayoutScale(
        getSimplePdfFitScale({
          pageSizes: pageSizesRef.current,
          viewportWidth: viewportSize.width,
          zoomFactor: nextZoomFactor,
        }),
      );
    }
  }, [commitLayoutScale, viewportSize.width]);

  const rotateClockwise = React.useCallback(() => {
    if (motionRef.current) return;
    setRotation((currentRotation) => (currentRotation + 90) % 360);
  }, []);

  useKeyedMountEffect(
    joinEffectKey([
      "simple-pdf-raster-scale",
      isTelemetryRunning,
      motion ? motion.id : "idle",
      rasterScale,
      rotation,
      status,
      targetRasterScale,
    ]),
    () => {
      if (
        status !== "ready" ||
        isTelemetryRunning ||
        motion ||
        rasterScale + 0.001 >= targetRasterScale
      ) {
        return;
      }

      const timeout = window.setTimeout(() => {
        setRasterScale(targetRasterScale);
      }, SIMPLE_PDF_RASTER_REFRESH_DELAY_MS);

      return () => window.clearTimeout(timeout);
    },
  );

  const sidebarWidth = motion
    ? (motionSidebarWidth ?? motion.fromSidebarWidth)
    : isSidebarOpen
      ? SIMPLE_PDF_SIDEBAR_WIDTH
      : 0;
  const sidebarStyle = {
    flexBasis: sidebarWidth,
    width: sidebarWidth,
  } satisfies React.CSSProperties;
  const viewportStyle = {
    overflowAnchor: "none",
    scrollBehavior: "auto",
  } satisfies React.CSSProperties;
  const documentTransform =
    motion &&
    (Math.abs(motionVisualScale - 1) > 0.0001 ||
      Math.abs(motionVisualTranslateX) > 0.01 ||
      Math.abs(motionVisualTranslateY) > 0.01)
      ? `translate(${motionVisualTranslateX}px, ${motionVisualTranslateY}px) scale(${motionVisualScale})`
      : undefined;
  const documentMotionStyle = {
    gap: getSimplePdfPageGap(),
    overflowAnchor: "none",
    padding: SIMPLE_PDF_PAGE_PADDING,
    transform: documentTransform ?? "translate(0px, 0px) scale(1)",
    transformOrigin: "top left",
    willChange: motion ? "transform" : undefined,
  } satisfies React.CSSProperties;

  if (!activeSource) {
    return (
      <SimplePdfFileViewerFrame>
        <SimplePdfEmptyState title="No PDF source" />
      </SimplePdfFileViewerFrame>
    );
  }

  return (
    <SimplePdfFileViewerFrame>
      <header
        data-slot="simple-file-viewer-header"
        className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 text-white"
      >
        <button
          type="button"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          className="inline-flex size-9 items-center justify-center rounded-md text-neutral-300 transition hover:bg-neutral-800 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40"
          disabled={Boolean(motion)}
          onClick={toggleSidebar}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="size-5" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="size-5" aria-hidden="true" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText
            className="size-5 shrink-0 text-neutral-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {activeSource.fileName}
            </div>
            <div className="text-xs text-neutral-500">
              {status === "ready"
                ? `Page ${currentPage} of ${document.numPages}`
                : status === "loading"
                  ? "Loading PDF"
                  : "PDF failed to load"}
            </div>
          </div>
        </div>

        <select
          aria-label="PDF sample"
          value={activeSource.id}
          onChange={(event) => setActiveSourceId(event.target.value)}
          className="hidden h-9 max-w-48 rounded-md border border-neutral-800 bg-neutral-900 px-2 text-sm text-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-white sm:block"
        >
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          data-simple-telemetry-run-button=""
          className="hidden h-9 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:opacity-40 md:inline-flex"
          disabled={status !== "ready" || Boolean(motion) || isTelemetryRunning}
          onClick={() => {
            void runTelemetry();
          }}
        >
          {isTelemetryRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Activity className="size-4" aria-hidden="true" />
          )}
          Telemetry
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            className="inline-flex size-9 items-center justify-center rounded-md text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:opacity-40"
            disabled={
              Boolean(motion) || zoomFactor <= SIMPLE_PDF_MIN_ZOOM_FACTOR
            }
            onClick={zoomOut}
          >
            <Minus className="size-5" aria-hidden="true" />
          </button>
          <div className="w-12 text-center text-sm text-neutral-400 tabular-nums">
            {Math.round((motion?.toScale ?? layoutScale) * 100)}%
          </div>
          <button
            type="button"
            aria-label="Zoom in"
            className="inline-flex size-9 items-center justify-center rounded-md text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:opacity-40"
            disabled={
              Boolean(motion) || zoomFactor >= SIMPLE_PDF_MAX_ZOOM_FACTOR
            }
            onClick={zoomIn}
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Rotate clockwise"
            className="inline-flex size-9 items-center justify-center rounded-md text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:opacity-40"
            disabled={Boolean(motion)}
            onClick={rotateClockwise}
          >
            <RotateCw className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        ref={bodySize.setElement}
        data-slot="simple-file-viewer-body"
        className="relative flex min-h-0 flex-1 overflow-hidden bg-neutral-950"
      >
        <aside
          data-slot="simple-file-viewer-sidebar"
          data-state={isSidebarOpen ? "open" : "closed"}
          className="shrink-0 overflow-hidden border-r border-neutral-800 bg-neutral-950 data-[state=closed]:border-r-0"
          style={sidebarStyle}
        >
          <div
            className="flex h-full flex-col"
            style={{ width: SIMPLE_PDF_SIDEBAR_WIDTH }}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-200">
                <Menu
                  className="size-4 shrink-0 text-neutral-500"
                  aria-hidden="true"
                />
                <span className="truncate">Pages</span>
              </div>
              <span className="text-xs text-neutral-500">
                {status === "ready" ? document.numPages : "0"}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-2">
              {status === "ready" ? (
                <nav className="grid gap-1" aria-label="PDF pages">
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      data-active={pageNumber === currentPage ? "" : undefined}
                      className="flex h-9 items-center justify-between rounded-md px-3 text-left text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white data-[active]:bg-white data-[active]:text-neutral-950"
                      onClick={() => scrollToPage(pageNumber)}
                    >
                      <span>Page {pageNumber}</span>
                      {renderedPages.has(pageNumber) ? (
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                      ) : null}
                    </button>
                  ))}
                </nav>
              ) : (
                <SimplePdfSidebarPlaceholder status={status} />
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div
            ref={setViewportElement}
            data-slot="simple-pdf-viewport"
            className="h-full overflow-auto [overflow-anchor:none] [&_*]:[overflow-anchor:none]"
            style={viewportStyle}
            onScroll={handleViewportScroll}
          >
            {status === "loading" ? (
              <SimplePdfLoadingState />
            ) : status === "error" ? (
              <SimplePdfEmptyState
                title="Could not load PDF"
                detail={error.message}
              />
            ) : (
              <div
                data-slot="simple-pdf-document"
                data-motion={motion ? "active" : "idle"}
                className="mx-auto flex min-h-full w-max min-w-full flex-col items-center"
                style={documentMotionStyle}
              >
                {pageNumbers.map((pageNumber) => (
                  <SimplePdfPageCanvas
                    key={`${activeSource.id}:${pageNumber}`}
                    document={document}
                    onRendered={handlePageRendered}
                    pageNumber={pageNumber}
                    pageSize={pageSizeByNumber.get(pageNumber)}
                    registerPageElement={registerPageElement}
                    rotation={rotation}
                    layoutScale={layoutScale}
                    renderScale={renderScale}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <SimplePdfTelemetryPanel
          isRunning={isTelemetryRunning}
          result={telemetryResult}
        />
      </div>
    </SimplePdfFileViewerFrame>
  );
}

type SimplePdfPageCanvasProps = {
  document: SimplePdfDocument;
  layoutScale: number;
  onRendered: (pageNumber: number) => void;
  pageNumber: number;
  pageSize?: SimplePdfPageSize;
  registerPageElement: (
    pageNumber: number,
    element: HTMLElement | null,
  ) => void;
  renderScale: number;
  rotation: number;
};

const SimplePdfPageCanvas = React.memo(function SimplePdfPageCanvas({
  document,
  layoutScale,
  onRendered,
  pageNumber,
  pageSize,
  registerPageElement,
  renderScale,
  rotation,
}: SimplePdfPageCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const safeWidth = pageSize
    ? getSimplePdfLayoutPageWidth(pageSize, layoutScale)
    : getSimplePdfLayoutPixels(612, layoutScale);
  const safeHeight = pageSize
    ? getSimplePdfLayoutPageHeight(pageSize, layoutScale)
    : getSimplePdfLayoutPixels(792, layoutScale);
  const setPageElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      registerPageElement(pageNumber, element);
    },
    [pageNumber, registerPageElement],
  );

  useKeyedMountEffect(
    joinEffectKey([
      "simple-pdf-page-render",
      document,
      onRendered,
      pageNumber,
      renderScale,
      rotation,
    ]),
    () => {
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;
      const canvas = canvasElement;
      const hadReadyCanvas =
        status === "ready" && canvas.width > 0 && canvas.height > 0;

      let isMounted = true;
      let renderTask: ReturnType<SimplePdfPageProxy["render"]> | null = null;

      if (hadReadyCanvas) {
        setIsRefreshing(true);
      } else {
        setStatus("loading");
      }
      setRenderError(null);

      async function renderPage() {
        const page = await document.getPage(pageNumber);
        if (!isMounted) return;
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          SIMPLE_PDF_DEVICE_PIXEL_RATIO_MAX,
        );
        const renderViewport = page.getViewport({
          scale: renderScale * ratio,
          rotation,
        });
        const renderCanvas = window.document.createElement("canvas");
        const context = renderCanvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable.");

        renderCanvas.width = Math.max(1, Math.floor(renderViewport.width));
        renderCanvas.height = Math.max(1, Math.floor(renderViewport.height));

        renderTask = page.render({
          canvas: renderCanvas,
          canvasContext: context,
          viewport: renderViewport,
        });
        await renderTask.promise;

        if (!isMounted) return;
        const visibleContext = canvas.getContext("2d");
        if (!visibleContext) throw new Error("Canvas 2D context unavailable.");

        canvas.width = renderCanvas.width;
        canvas.height = renderCanvas.height;
        visibleContext.drawImage(renderCanvas, 0, 0);
        setStatus("ready");
        setIsRefreshing(false);
        onRendered(pageNumber);
      }

      renderPage().catch((error: unknown) => {
        if (!isMounted || isPdfRenderCancelled(error)) return;
        setRenderError(toSimplePdfError(error).message);
        setIsRefreshing(false);
        if (!hadReadyCanvas) setStatus("error");
      });

      return () => {
        isMounted = false;
        renderTask?.cancel();
      };
    },
  );

  return (
    <div
      ref={setPageElement}
      data-slot="simple-pdf-page"
      data-page-number={pageNumber}
      data-render-status={status}
      data-render-refreshing={isRefreshing ? "true" : undefined}
      className="relative overflow-hidden bg-white ring-1 ring-black/10"
      style={{
        contain: "paint",
        height: safeHeight,
        overflowAnchor: "none",
        width: safeWidth,
      }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{
          height: safeHeight,
          overflowAnchor: "none",
          width: safeWidth,
        }}
      />
      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center bg-white text-neutral-400">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center bg-white px-6 text-center text-sm text-neutral-500">
          <span>
            Page {pageNumber} failed to render
            {renderError ? `: ${renderError}` : "."}
          </span>
        </div>
      ) : null}
    </div>
  );
});

function SimplePdfFileViewerFrame({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-slot="simple-file-viewer"
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
    >
      {children}
    </section>
  );
}

function SimplePdfLoadingState() {
  return (
    <div className="grid h-full place-items-center text-neutral-400">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        Loading PDF
      </div>
    </div>
  );
}

function SimplePdfEmptyState({
  detail,
  title,
}: {
  detail?: string;
  title: string;
}) {
  return (
    <div className="grid h-full place-items-center p-8 text-center text-neutral-400">
      <div>
        <div className="text-sm font-medium text-neutral-200">{title}</div>
        {detail ? <div className="mt-2 max-w-md text-sm">{detail}</div> : null}
      </div>
    </div>
  );
}

function SimplePdfSidebarPlaceholder({
  status,
}: {
  status: SimplePdfLoadState["status"];
}) {
  return (
    <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-neutral-800 text-sm text-neutral-500">
      {status === "loading" ? "Loading pages" : "No pages"}
    </div>
  );
}

function SimplePdfTelemetryPanel({
  isRunning,
  result,
}: {
  isRunning: boolean;
  result: SimplePdfTelemetryResult | null;
}) {
  if (!isRunning && !result) return null;

  const failedCount = result
    ? result.metrics.filter((metric) => !metric.passed).length
    : 0;

  return (
    <aside
      data-simple-telemetry-panel=""
      data-simple-telemetry-status={result?.status ?? "running"}
      className="absolute right-3 bottom-3 z-30 flex max-h-[55%] w-[24rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/95 text-neutral-200 shadow-2xl backdrop-blur"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {isRunning ? (
            <Loader2 className="size-4 animate-spin text-neutral-400" />
          ) : result?.status === "passed" ? (
            <CheckCircle2 className="size-4 text-emerald-400" />
          ) : (
            <XCircle className="size-4 text-red-400" />
          )}
          <div className="truncate text-sm font-medium">
            {isRunning
              ? "Running telemetry"
              : result?.status === "passed"
                ? "Telemetry passed"
                : "Telemetry failed"}
          </div>
        </div>
        {result ? (
          <div className="text-xs text-neutral-500">
            {result.sampledFrameCount} frames
          </div>
        ) : null}
      </div>

      {result ? (
        <>
          <div className="grid grid-cols-3 gap-2 border-b border-neutral-800 px-3 py-2 text-xs">
            <SimplePdfTelemetryStat
              label="Duration"
              value={`${Math.round(result.durationMs)}ms`}
            />
            <SimplePdfTelemetryStat
              label="Metrics"
              value={`${result.metrics.length - failedCount}/${result.metrics.length}`}
            />
            <SimplePdfTelemetryStat
              label="Failures"
              value={String(failedCount)}
            />
          </div>
          <div className="min-h-0 overflow-auto p-2">
            <div className="grid gap-1.5">
              {result.metrics.map((metric) => (
                <div
                  key={metric.id}
                  data-simple-telemetry-metric={metric.id}
                  data-simple-telemetry-metric-status={
                    metric.passed ? "passed" : "failed"
                  }
                  className="rounded-md border border-neutral-800 bg-neutral-900/70 p-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {metric.passed ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="size-3.5 shrink-0 text-red-400" />
                      )}
                      <div className="truncate text-xs font-medium">
                        {metric.label}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-neutral-400 tabular-nums">
                      {metric.value}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-neutral-500">
                    Budget: {metric.budget}. {metric.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="p-3 text-xs text-neutral-500">
          Sampling scroll, page, canvas, mutation, layout-shift, and frame
          timing data across a full sidebar close/open cycle.
        </div>
      )}
    </aside>
  );
}

function SimplePdfTelemetryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-neutral-500">{label}</div>
      <div className="mt-0.5 font-medium text-neutral-200 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function useSimplePdfDocument(source: SimplePdfSource | undefined) {
  const [state, setState] = React.useState<SimplePdfLoadState>({
    document: null,
    error: null,
    status: "loading",
  });

  useKeyedMountEffect(
    source
      ? joinEffectKey(["simple-pdf-document", source.id, source.url])
      : null,
    () => {
      if (!source) return;

      let isMounted = true;
      let loadedDocument: SimplePdfDocument | null = null;

      setState({ document: null, error: null, status: "loading" });

      loadSimplePdfjs()
        .then((pdfjs) => pdfjs.getDocument(source.url).promise)
        .then((document) => {
          loadedDocument = document;
          if (!isMounted) {
            void document.destroy();
            return;
          }
          setState({ document, error: null, status: "ready" });
        })
        .catch((error: unknown) => {
          if (!isMounted) return;
          setState({
            document: null,
            error: toSimplePdfError(error),
            status: "error",
          });
        });

      return () => {
        isMounted = false;
        if (loadedDocument) void loadedDocument.destroy();
      };
    },
  );

  return state;
}

function useSimplePdfPageSizes(
  document: SimplePdfDocument | null,
  rotation: number,
) {
  const [pageSizes, setPageSizes] = React.useState<SimplePdfPageSize[]>([]);

  useKeyedMountEffect(
    document
      ? joinEffectKey(["simple-pdf-page-sizes", document, rotation])
      : null,
    () => {
      if (!document) {
        setPageSizes([]);
        return;
      }

      let isMounted = true;

      Promise.all(
        Array.from({ length: document.numPages }, async (_, index) => {
          const pageNumber = index + 1;
          const page = await document.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1, rotation });
          return {
            height: viewport.height,
            pageNumber,
            width: viewport.width,
          };
        }),
      )
        .then((sizes) => {
          if (isMounted) setPageSizes(sizes);
        })
        .catch(() => {
          if (isMounted) setPageSizes([]);
        });

      return () => {
        isMounted = false;
      };
    },
  );

  return pageSizes;
}

function useSimpleElementInlineSize<T extends HTMLElement>() {
  const [element, setElement] = React.useState<T | null>(null);
  const [width, setWidth] = React.useState(0);

  useKeyedMountEffect(
    element ? joinEffectKey(["simple-element-inline-size", element]) : null,
    () => {
      if (!element) return;

      const measure = () => {
        const nextWidth = element.getBoundingClientRect().width;
        setWidth((previousWidth) =>
          Math.abs(previousWidth - nextWidth) <= 0.5
            ? previousWidth
            : nextWidth,
        );
      };
      measure();

      const observer = new ResizeObserver(measure);
      observer.observe(element);

      return () => observer.disconnect();
    },
  );

  return React.useMemo(
    () => ({
      element,
      setElement,
      width,
    }),
    [element, width],
  );
}

function getSimplePdfFitScale({
  pageSizes,
  viewportWidth,
  zoomFactor,
}: {
  pageSizes: readonly SimplePdfPageSize[];
  viewportWidth: number;
  zoomFactor: number;
}) {
  const maxPageWidth = getSimplePdfMaxPageWidth(pageSizes);
  if (maxPageWidth <= 0 || viewportWidth <= 0) return 1;

  const availableWidth = Math.max(
    1,
    viewportWidth - SIMPLE_PDF_PAGE_PADDING * 2,
  );
  return clampSimplePdfScale((availableWidth / maxPageWidth) * zoomFactor);
}

function captureSimplePdfReadingAnchor({
  pageSizes,
  scale,
  viewportElement,
}: {
  pageSizes: readonly SimplePdfPageSize[];
  scale: number;
  viewportElement: HTMLElement;
}): SimplePdfReadingAnchor {
  const markerOffset =
    viewportElement.clientHeight * SIMPLE_PDF_SCROLL_ANCHOR_MARKER_RATIO;
  const documentOffset = Math.max(0, viewportElement.scrollTop + markerOffset);
  const fallbackPage = pageSizes[0];
  if (!fallbackPage) {
    return {
      documentOffset,
      markerOffset,
      pageNumber: 1,
      yRatio: 0,
    };
  }

  let pageNumber = fallbackPage.pageNumber;
  let yRatio = 0;

  for (const pageSize of pageSizes) {
    const pageTop = getSimplePdfPageTop({
      pageNumber: pageSize.pageNumber,
      pageSizes,
      scale,
    });
    const pageHeight = getSimplePdfLayoutPageHeight(pageSize, scale);
    const pageBottom = pageTop + pageHeight;

    pageNumber = pageSize.pageNumber;
    if (documentOffset <= pageBottom + getSimplePdfPageGap() / 2) {
      yRatio = clampSimplePdfRatio((documentOffset - pageTop) / pageHeight);
      break;
    }
  }

  return {
    documentOffset,
    markerOffset,
    pageNumber,
    yRatio,
  };
}

function getSimplePdfAnchorScrollTop({
  anchor,
  pageSizes,
  scale,
  viewportHeight,
}: {
  anchor: SimplePdfReadingAnchor;
  pageSizes: readonly SimplePdfPageSize[];
  scale: number;
  viewportHeight: number;
}) {
  const anchorDocumentOffset = getSimplePdfAnchorDocumentOffset({
    anchor,
    pageSizes,
    scale,
  });
  const maxScrollTop = Math.max(
    0,
    getSimplePdfDocumentHeight({ pageSizes, scale }) - viewportHeight,
  );

  return clampSimplePdfNumber(
    anchorDocumentOffset - anchor.markerOffset,
    0,
    maxScrollTop,
  );
}

function getSimplePdfAnchorDocumentOffset({
  anchor,
  pageSizes,
  scale,
}: {
  anchor: SimplePdfReadingAnchor;
  pageSizes: readonly SimplePdfPageSize[];
  scale: number;
}) {
  const pageSize =
    pageSizes.find((size) => size.pageNumber === anchor.pageNumber) ??
    pageSizes[0];
  if (!pageSize) return anchor.documentOffset;

  return (
    getSimplePdfPageTop({
      pageNumber: pageSize.pageNumber,
      pageSizes,
      scale,
    }) +
    getSimplePdfLayoutPageHeight(pageSize, scale) * anchor.yRatio
  );
}

function getSimplePdfMotionVisualTransform({
  motion,
  sidebarWidth,
  visualLayoutScale,
}: {
  motion: SimplePdfMotion;
  sidebarWidth: number;
  visualLayoutScale: number;
}) {
  const visualScale =
    motion.toScale <= 0
      ? 1
      : clampSimplePdfScale(visualLayoutScale) / motion.toScale;
  const viewportWidth = Math.max(1, motion.bodyWidth - sidebarWidth);
  const finalPageWidth = getSimplePdfLayoutPixels(
    motion.anchorPageWidth,
    motion.toScale,
  );
  const visualPageWidth = getSimplePdfLayoutPixels(
    motion.anchorPageWidth,
    visualLayoutScale,
  );
  const finalPageLeft = getSimplePdfPageLeftInViewport({
    pageWidth: finalPageWidth,
    viewportWidth,
  });
  const visualPageLeft = getSimplePdfPageLeftInViewport({
    pageWidth: visualPageWidth,
    viewportWidth,
  });
  const targetAnchorTop = motion.targetAnchorOffset - motion.targetScrollTop;

  return {
    scale: visualScale,
    translateX: visualPageLeft - finalPageLeft * visualScale,
    translateY:
      targetAnchorTop +
      motion.targetScrollTop -
      motion.targetAnchorOffset * visualScale,
  };
}

function getSimplePdfPageLeftInViewport({
  pageWidth,
  viewportWidth,
}: {
  pageWidth: number;
  viewportWidth: number;
}) {
  return (
    SIMPLE_PDF_PAGE_PADDING +
    Math.max(0, (viewportWidth - SIMPLE_PDF_PAGE_PADDING * 2 - pageWidth) / 2)
  );
}

function getSimplePdfDocumentHeight({
  pageSizes,
  scale,
}: {
  pageSizes: readonly SimplePdfPageSize[];
  scale: number;
}) {
  if (pageSizes.length === 0) return 0;

  return (
    SIMPLE_PDF_PAGE_PADDING * 2 +
    pageSizes.reduce(
      (height, pageSize) =>
        height + getSimplePdfLayoutPageHeight(pageSize, scale),
      0,
    ) +
    Math.max(0, pageSizes.length - 1) * getSimplePdfPageGap()
  );
}

function getSimplePdfPageTop({
  pageNumber,
  pageSizes,
  scale,
}: {
  pageNumber: number;
  pageSizes: readonly SimplePdfPageSize[];
  scale: number;
}) {
  let top = SIMPLE_PDF_PAGE_PADDING;

  for (const pageSize of pageSizes) {
    if (pageSize.pageNumber >= pageNumber) return top;
    top +=
      getSimplePdfLayoutPageHeight(pageSize, scale) + getSimplePdfPageGap();
  }

  return top;
}

function getSimplePdfPageGap() {
  return SIMPLE_PDF_PAGE_GAP;
}

function getSimplePdfLayoutPageWidth(
  pageSize: SimplePdfPageSize,
  scale: number,
) {
  return getSimplePdfLayoutPixels(pageSize.width, scale);
}

function getSimplePdfLayoutPageHeight(
  pageSize: SimplePdfPageSize,
  scale: number,
) {
  return getSimplePdfLayoutPixels(pageSize.height, scale);
}

function getSimplePdfLayoutPixels(size: number, scale: number) {
  return Math.max(1, Number((size * scale).toFixed(3)));
}

function getSimplePdfMaxPageWidth(pageSizes: readonly SimplePdfPageSize[]) {
  return pageSizes.reduce(
    (maxWidth, pageSize) => Math.max(maxWidth, pageSize.width),
    0,
  );
}

function setSimplePdfViewportScrollTop(
  viewportElement: HTMLElement,
  scrollTop: number,
) {
  void viewportElement.scrollHeight;
  viewportElement.scrollTop = scrollTop;
  void viewportElement.getBoundingClientRect();
  if (
    Math.abs(viewportElement.scrollTop - scrollTop) >
    SIMPLE_PDF_SETTLE_SCROLL_EPSILON_PX
  ) {
    viewportElement.scrollTop = scrollTop;
  }
}

function startSimplePdfSidebarMotion({
  motion,
  motionFrameRef,
  motionIdRef,
  onProgress,
  onSettle,
}: {
  motion: SimplePdfMotion;
  motionFrameRef: React.MutableRefObject<number>;
  motionIdRef: React.MutableRefObject<number>;
  onProgress: (frame: SimplePdfMotionFrame) => void;
  onSettle: (motion: SimplePdfMotion) => void;
}) {
  const startedAt = performance.now();

  const tick = () => {
    motionFrameRef.current = 0;
    if (motionIdRef.current !== motion.id) return;

    const rawProgress = clampSimplePdfNumber(
      (performance.now() - startedAt) / motion.durationMs,
      0,
      1,
    );
    if (rawProgress >= 1) {
      onSettle(motion);
      return;
    }

    const easedProgress = easeSimplePdfSidebarMotion(rawProgress);
    const easedSidebarWidth = lerpSimplePdfNumber(
      motion.fromSidebarWidth,
      motion.toSidebarWidth,
      easedProgress,
    );
    if (
      Math.abs(easedSidebarWidth - motion.toSidebarWidth) <=
      SIMPLE_PDF_MOTION_FINAL_SNAP_EPSILON_PX
    ) {
      onSettle(motion);
      return;
    }

    onProgress({
      motion,
      progress: easedProgress,
      scale: lerpSimplePdfNumber(
        motion.fromScale,
        motion.toScale,
        easedProgress,
      ),
      sidebarWidth: easedSidebarWidth,
    });

    motionFrameRef.current = requestAnimationFrame(tick);
  };

  motionFrameRef.current = requestAnimationFrame(tick);
}

function easeSimplePdfSidebarMotion(progress: number) {
  return progress;
}

function lerpSimplePdfNumber(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

async function runSimplePdfSidebarTelemetry({
  durationMs,
  rootElement,
  toggleSidebar,
  viewportElement,
}: {
  durationMs: number;
  rootElement: HTMLElement;
  toggleSidebar: () => void;
  viewportElement: HTMLElement;
}): Promise<SimplePdfTelemetryResult> {
  const startedAt = performance.now();
  const runs: SimplePdfTelemetryRun[] = [];
  const scenarios = getSimplePdfTelemetryScenarios({
    rootElement,
    viewportElement,
  });

  for (const scenario of scenarios) {
    viewportElement.scrollTop = scenario.scrollTop;
    await waitForSimplePdfFrames(4);
    runs.push(
      await sampleSimplePdfSidebarTransition({
        durationMs,
        rootElement,
        scenario: scenario.id,
        toggleSidebar,
        viewportElement,
      }),
    );
    await waitForSimplePdfFrames(8);
    runs.push(
      await sampleSimplePdfSidebarTransition({
        durationMs,
        rootElement,
        scenario: scenario.id,
        toggleSidebar,
        viewportElement,
      }),
    );
    await waitForSimplePdfFrames(8);
  }

  const metrics = collectSimplePdfTelemetryMetrics(runs);

  return {
    durationMs: Math.max(0, performance.now() - startedAt),
    metrics,
    runs,
    sampledFrameCount: runs.reduce(
      (count, run) => count + run.samples.length,
      0,
    ),
    status: metrics.every((metric) => metric.passed) ? "passed" : "failed",
  };
}

async function sampleSimplePdfSidebarTransition({
  durationMs,
  rootElement,
  scenario,
  toggleSidebar,
  viewportElement,
}: {
  durationMs: number;
  rootElement: HTMLElement;
  scenario: SimplePdfTelemetryRun["scenario"];
  toggleSidebar: () => void;
  viewportElement: HTMLElement;
}): Promise<SimplePdfTelemetryRun> {
  const before = readSimplePdfTelemetrySample({
    rootElement,
    startedAt: performance.now(),
    viewportElement,
  });
  const trackers = createSimplePdfTelemetryTrackers({
    rootElement,
    viewportElement,
  });
  const startedAt = performance.now();
  const samples: SimplePdfTelemetrySample[] = [];
  const action = before.sidebarState === "open" ? "close" : "open";

  toggleSidebar();
  samples.push(
    readSimplePdfTelemetrySample({
      rootElement,
      startedAt,
      viewportElement,
    }),
  );

  while (
    performance.now() - startedAt <
    durationMs + SIMPLE_PDF_TELEMETRY_SETTLE_MS
  ) {
    await waitForSimplePdfFrames(1);
    samples.push(
      readSimplePdfTelemetrySample({
        rootElement,
        startedAt,
        viewportElement,
      }),
    );
  }

  await waitForSimplePdfFrames(3);
  const after = readSimplePdfTelemetrySample({
    rootElement,
    startedAt,
    viewportElement,
  });
  trackers.disconnect();

  return {
    action,
    addedNodeCount: trackers.addedNodeCount,
    after,
    attributeMutationCount: trackers.attributeMutationCount,
    before,
    canvasResizeMutationCount: trackers.canvasResizeMutationCount,
    layoutShiftCount: trackers.layoutShiftCount,
    layoutShiftScore: trackers.layoutShiftScore,
    longTaskCount: trackers.longTaskCount,
    longTaskDuration: trackers.longTaskDuration,
    mutationCount: trackers.mutationCount,
    removedNodeCount: trackers.removedNodeCount,
    renderStatusMutationCount: trackers.renderStatusMutationCount,
    scenario,
    samples,
    scrollEventCount: trackers.scrollEventCount,
    windowScrollEventCount: trackers.windowScrollEventCount,
  };
}

function readSimplePdfTelemetrySample({
  rootElement,
  startedAt,
  viewportElement,
}: {
  rootElement: HTMLElement;
  startedAt: number;
  viewportElement: HTMLElement;
}): SimplePdfTelemetrySample {
  const bodyElement = rootElement.querySelector<HTMLElement>(
    '[data-slot="simple-file-viewer-body"]',
  );
  const sidebarElement = rootElement.querySelector<HTMLElement>(
    '[data-slot="simple-file-viewer-sidebar"]',
  );
  const documentElement = rootElement.querySelector<HTMLElement>(
    '[data-slot="simple-pdf-document"]',
  );
  const bodyRect = bodyElement?.getBoundingClientRect();
  const sidebarRect = sidebarElement?.getBoundingClientRect();
  const documentRect = documentElement?.getBoundingClientRect();
  const viewportRect = viewportElement.getBoundingClientRect();
  const pageAnchors = readSimplePdfTelemetryPageAnchors({
    rootElement,
    viewportRect,
  });
  const primaryAnchorMarkerOffset =
    viewportRect.height * SIMPLE_PDF_TELEMETRY_ANCHOR_MARKER_RATIO;
  const primaryAnchor = getSimplePdfTelemetryPrimaryAnchor({
    anchors: pageAnchors,
    markerOffset: primaryAnchorMarkerOffset,
    viewportRect,
  });
  const visiblePageCount = pageAnchors.length;
  const visibleReadyPageCount = pageAnchors.filter(
    (anchor) => anchor.status === "ready",
  ).length;
  const visibleReadyCanvasPageCount = pageAnchors.filter(
    (anchor) => anchor.status === "ready" && anchor.hasCanvasPixels,
  ).length;
  const visibleLoadingPageCount = pageAnchors.filter(
    (anchor) => anchor.status === "loading",
  ).length;
  const visibleErrorPageCount = pageAnchors.filter(
    (anchor) => anchor.status === "error",
  ).length;

  return {
    bodyWidth: bodyRect?.width ?? 0,
    clientHeight: viewportElement.clientHeight,
    clientWidth: viewportElement.clientWidth,
    documentHeight: documentRect?.height ?? 0,
    documentLeft: documentRect ? documentRect.left - viewportRect.left : 0,
    documentTop: documentRect ? documentRect.top - viewportRect.top : 0,
    documentTransform:
      documentElement == null
        ? ""
        : getComputedStyle(documentElement).transform,
    documentWidth: documentRect?.width ?? 0,
    devicePixelRatio: Math.min(
      window.devicePixelRatio || 1,
      SIMPLE_PDF_DEVICE_PIXEL_RATIO_MAX,
    ),
    elapsedMs: Math.max(0, performance.now() - startedAt),
    fingerprint: pageAnchors
      .map(
        (anchor) =>
          `${anchor.id}:${anchor.status}:${anchor.hasCanvasPixels ? "pixels" : "blank"}`,
      )
      .join("|"),
    gapValues: getSimplePdfTelemetryGapValues(pageAnchors),
    hasBlink:
      !documentRect ||
      documentRect.width <= 0 ||
      documentRect.height <= 0 ||
      (visiblePageCount > 0 && visibleReadyCanvasPageCount === 0) ||
      visibleErrorPageCount > 0,
    primaryAnchorHeight: primaryAnchor?.height ?? null,
    primaryAnchorId: primaryAnchor?.id ?? null,
    primaryAnchorCanvasWidth: primaryAnchor?.canvasWidth ?? null,
    primaryAnchorInkRatio: primaryAnchor?.inkRatio ?? null,
    primaryAnchorMarkerOffset,
    primaryAnchorPixelSignature: primaryAnchor?.pixelSignature ?? null,
    primaryAnchorLeft:
      primaryAnchor == null ? null : primaryAnchor.left - viewportRect.left,
    primaryAnchorTop:
      primaryAnchor == null ? null : primaryAnchor.top - viewportRect.top,
    primaryAnchorWidth: primaryAnchor?.width ?? null,
    scrollHeight: viewportElement.scrollHeight,
    scrollTop: viewportElement.scrollTop,
    scrollWidth: viewportElement.scrollWidth,
    sidebarState: sidebarElement?.dataset.state ?? null,
    sidebarWidth: sidebarRect?.width ?? 0,
    timestamp: performance.now(),
    visibleErrorPageCount,
    visibleLoadingPageCount,
    visiblePageCount,
    visibleReadyCanvasPageCount,
    visibleReadyPageCount,
    viewportWidth: viewportRect.width,
  };
}

function readSimplePdfTelemetryPageAnchors({
  rootElement,
  viewportRect,
}: {
  rootElement: HTMLElement;
  viewportRect: DOMRect;
}) {
  return Array.from(
    rootElement.querySelectorAll<HTMLElement>('[data-slot="simple-pdf-page"]'),
  )
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const pageNumber = Number(element.dataset.pageNumber ?? 0);
      const canvas = element.querySelector("canvas");
      const status = element.dataset.renderStatus ?? "unknown";
      const canvasWidth =
        canvas instanceof HTMLCanvasElement ? canvas.width : 0;
      const canvasHeight =
        canvas instanceof HTMLCanvasElement ? canvas.height : 0;
      const pixelSample =
        canvas instanceof HTMLCanvasElement
          ? readSimplePdfCanvasPixelSample(canvas)
          : null;

      return {
        bottom: rect.bottom,
        canvasHeight,
        canvasWidth,
        height: rect.height,
        inkRatio: pixelSample?.inkRatio ?? null,
        id: String(pageNumber),
        left: rect.left,
        pageNumber,
        pixelSignature: pixelSample?.signature ?? null,
        status:
          status === "ready" || status === "loading" || status === "error"
            ? status
            : "unknown",
        top: rect.top,
        width: rect.width,
        hasCanvasPixels: canvasWidth > 0 && canvasHeight > 0,
      };
    })
    .filter(
      (anchor) =>
        anchor.pageNumber > 0 &&
        anchor.bottom > viewportRect.top &&
        anchor.top < viewportRect.bottom,
    )
    .sort((left, right) => left.pageNumber - right.pageNumber);
}

function readSimplePdfCanvasPixelSample(canvas: HTMLCanvasElement) {
  if (canvas.width <= 0 || canvas.height <= 0) return null;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const points = [
    [0.17, 0.14],
    [0.33, 0.14],
    [0.5, 0.14],
    [0.67, 0.14],
    [0.83, 0.14],
    [0.17, 0.32],
    [0.33, 0.32],
    [0.5, 0.32],
    [0.67, 0.32],
    [0.83, 0.32],
    [0.17, 0.5],
    [0.33, 0.5],
    [0.5, 0.5],
    [0.67, 0.5],
    [0.83, 0.5],
    [0.17, 0.68],
    [0.33, 0.68],
    [0.5, 0.68],
    [0.67, 0.68],
    [0.83, 0.68],
    [0.17, 0.86],
    [0.33, 0.86],
    [0.5, 0.86],
    [0.67, 0.86],
    [0.83, 0.86],
  ];
  let hash = 2166136261;
  let inkCount = 0;

  try {
    for (const [xRatio, yRatio] of points) {
      const x = clampSimplePdfNumber(
        Math.round(canvas.width * xRatio),
        0,
        canvas.width - 1,
      );
      const y = clampSimplePdfNumber(
        Math.round(canvas.height * yRatio),
        0,
        canvas.height - 1,
      );
      const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (alpha > 0 && luminance < 245) inkCount += 1;

      hash ^= red;
      hash = Math.imul(hash, 16777619);
      hash ^= green;
      hash = Math.imul(hash, 16777619);
      hash ^= blue;
      hash = Math.imul(hash, 16777619);
      hash ^= alpha;
      hash = Math.imul(hash, 16777619);
    }
  } catch {
    return null;
  }

  return {
    inkRatio: inkCount / points.length,
    signature: hash.toString(16),
  };
}

function getSimplePdfTelemetryPrimaryAnchor({
  anchors,
  markerOffset,
  viewportRect,
}: {
  anchors: ReturnType<typeof readSimplePdfTelemetryPageAnchors>;
  markerOffset: number;
  viewportRect: DOMRect;
}) {
  if (anchors.length === 0) return null;

  const marker = viewportRect.top + markerOffset;
  return (
    anchors.find((anchor) => anchor.top <= marker && anchor.bottom >= marker) ??
    anchors.reduce((nearest, anchor) =>
      Math.abs(anchor.top - marker) < Math.abs(nearest.top - marker)
        ? anchor
        : nearest,
    )
  );
}

function getSimplePdfTelemetryGapValues(
  anchors: ReturnType<typeof readSimplePdfTelemetryPageAnchors>,
) {
  const gaps: number[] = [];
  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const current = anchors[index];
    if (current.pageNumber !== previous.pageNumber + 1) continue;
    gaps.push(current.top - previous.bottom);
  }
  return gaps;
}

function createSimplePdfTelemetryTrackers({
  rootElement,
  viewportElement,
}: {
  rootElement: HTMLElement;
  viewportElement: HTMLElement;
}) {
  const startedAt = performance.now();
  const rendererElement =
    rootElement.querySelector<HTMLElement>(
      '[data-slot="simple-pdf-document"]',
    ) ?? rootElement;
  const state = {
    addedNodeCount: 0,
    attributeMutationCount: 0,
    canvasResizeMutationCount: 0,
    layoutShiftCount: 0,
    layoutShiftScore: 0,
    longTaskCount: 0,
    longTaskDuration: 0,
    mutationCount: 0,
    removedNodeCount: 0,
    renderStatusMutationCount: 0,
    scrollEventCount: 0,
    windowScrollEventCount: 0,
  };
  const cleanup: Array<() => void> = [];

  const mutationObserver = new MutationObserver((records) => {
    state.mutationCount += records.length;
    for (const record of records) {
      state.addedNodeCount += record.addedNodes.length;
      state.removedNodeCount += record.removedNodes.length;
      if (record.type !== "attributes") continue;
      state.attributeMutationCount += 1;
      if (record.attributeName === "data-render-status") {
        state.renderStatusMutationCount += 1;
      }
      if (
        record.target instanceof HTMLCanvasElement &&
        (record.attributeName === "width" || record.attributeName === "height")
      ) {
        state.canvasResizeMutationCount += 1;
      }
    }
  });
  mutationObserver.observe(rendererElement, {
    attributeFilter: ["data-render-status", "height", "style", "width"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  cleanup.push(() => mutationObserver.disconnect());

  const handleViewportScroll = () => {
    state.scrollEventCount += 1;
  };
  const handleWindowScroll = () => {
    state.windowScrollEventCount += 1;
  };
  viewportElement.addEventListener("scroll", handleViewportScroll, {
    passive: true,
  });
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  cleanup.push(() => {
    viewportElement.removeEventListener("scroll", handleViewportScroll);
    window.removeEventListener("scroll", handleWindowScroll);
  });

  const layoutShiftObserver = createSimplePdfPerformanceObserver(
    "layout-shift",
    (entries) => {
      for (const entry of entries) {
        if (entry.startTime < startedAt) continue;
        const layoutShift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (layoutShift.hadRecentInput) continue;
        state.layoutShiftCount += 1;
        state.layoutShiftScore += layoutShift.value ?? 0;
      }
    },
  );
  if (layoutShiftObserver) cleanup.push(() => layoutShiftObserver.disconnect());

  const longTaskObserver = createSimplePdfPerformanceObserver(
    "longtask",
    (entries) => {
      const currentEntries = entries.filter(
        (entry) => entry.startTime >= startedAt,
      );
      state.longTaskCount += currentEntries.length;
      state.longTaskDuration += currentEntries.reduce(
        (duration, entry) => duration + entry.duration,
        0,
      );
    },
  );
  if (longTaskObserver) cleanup.push(() => longTaskObserver.disconnect());

  return {
    get addedNodeCount() {
      return state.addedNodeCount;
    },
    get attributeMutationCount() {
      return state.attributeMutationCount;
    },
    get canvasResizeMutationCount() {
      return state.canvasResizeMutationCount;
    },
    get layoutShiftCount() {
      return state.layoutShiftCount;
    },
    get layoutShiftScore() {
      return state.layoutShiftScore;
    },
    get longTaskCount() {
      return state.longTaskCount;
    },
    get longTaskDuration() {
      return state.longTaskDuration;
    },
    get mutationCount() {
      return state.mutationCount;
    },
    get removedNodeCount() {
      return state.removedNodeCount;
    },
    get renderStatusMutationCount() {
      return state.renderStatusMutationCount;
    },
    get scrollEventCount() {
      return state.scrollEventCount;
    },
    get windowScrollEventCount() {
      return state.windowScrollEventCount;
    },
    disconnect: () => {
      for (const cleanupTracker of cleanup) cleanupTracker();
    },
  };
}

function createSimplePdfPerformanceObserver(
  entryType: string,
  callback: (entries: PerformanceEntry[]) => void,
) {
  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes?.includes(entryType)
  ) {
    return null;
  }

  const observer = new PerformanceObserver((list) => {
    callback(list.getEntries());
  });
  observer.observe({ type: entryType });
  return observer;
}

function collectSimplePdfTelemetryMetrics(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric[] {
  return [
    collectSimplePdfBlinkMetric(runs),
    collectSimplePdfBackAndForthMetric(runs),
    collectSimplePdfHorizontalBackAndForthMetric(runs),
    collectSimplePdfOvershootMetric(runs),
    collectSimplePdfVerticalOvershootMetric(runs),
    collectSimplePdfSettleJitterMetric(runs),
    collectSimplePdfResizeLinearityMetric(runs),
    collectSimplePdfScrollDriftMetric(runs),
    collectSimplePdfScrollGeometryMetric(runs),
    collectSimplePdfGapStabilityMetric(runs),
    collectSimplePdfRendererContinuityMetric(runs),
    collectSimplePdfCanvasPixelContinuityMetric(runs),
    collectSimplePdfRasterHeadroomMetric(runs),
    collectSimplePdfDomMutationsMetric(runs),
    collectSimplePdfLayoutShiftMetric(runs),
    collectSimplePdfMainThreadMetric(runs),
    collectSimplePdfGeometrySyncMetric(runs),
    collectSimplePdfCycleInvarianceMetric(runs),
  ];
}

function logSimplePdfTelemetryResult(result: SimplePdfTelemetryResult) {
  const metrics = result.metrics.map((metric) => ({
    budget: metric.budget,
    detail: metric.detail,
    id: metric.id,
    label: metric.label,
    passed: metric.passed,
    value: metric.value,
  }));
  const summary = {
    durationMs: Number(result.durationMs.toFixed(1)),
    failedMetricIds: metrics
      .filter((metric) => !metric.passed)
      .map((metric) => metric.id),
    metrics,
    passedMetricCount: metrics.filter((metric) => metric.passed).length,
    sampledFrameCount: result.sampledFrameCount,
    status: result.status,
    totalMetricCount: metrics.length,
  };
  const fullResultJson = JSON.stringify(result);

  console.info(
    "[simple-pdf-file-viewer:telemetry] result",
    JSON.stringify(summary),
  );
  console.info(
    "[simple-pdf-file-viewer:telemetry] full result",
    fullResultJson,
  );
  console.table(metrics);
}

function collectSimplePdfBlinkMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const blinkFrames = getSimplePdfAllSamples(runs).filter(
    (sample) => sample.hasBlink,
  ).length;

  return {
    budget: "0 blink frames",
    detail:
      "A blink frame is any sampled frame with no visible ready page, a visible errored page, or a missing document rect.",
    id: "blink",
    label: "Blink",
    passed: blinkFrames === 0,
    value: `${blinkFrames} frames`,
  };
}

function collectSimplePdfBackAndForthMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const anchorReversals = Math.max(
    0,
    ...runs.map((run) =>
      countSimplePdfReversals(
        getSimplePdfMotionSamples(run).map(
          (sample) => sample.primaryAnchorTop ?? sample.documentTop,
        ),
        SIMPLE_PDF_REVERSAL_EPSILON,
      ),
    ),
  );
  const documentReversals = Math.max(
    0,
    ...runs.map((run) =>
      countSimplePdfReversals(
        getSimplePdfMotionSamples(run).map((sample) => sample.documentTop),
        SIMPLE_PDF_REVERSAL_EPSILON,
      ),
    ),
  );
  const reversals = Math.max(anchorReversals, documentReversals);

  return {
    budget: "0 direction reversals over 8px",
    detail:
      "Tracks the visible reading anchor and document top. A meaningful sign flip means the PDF moved one way and then corrected back.",
    id: "back-and-forth",
    label: "Back and forth",
    passed: reversals === 0,
    value: `${reversals} reversals`,
  };
}

function collectSimplePdfHorizontalBackAndForthMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const leftReversals = Math.max(
    0,
    ...runs.map((run) =>
      countSimplePdfReversals(
        getSimplePdfMotionSamples(run).map(getSimplePdfSampleAnchorLeft),
        SIMPLE_PDF_HORIZONTAL_REVERSAL_EPSILON_PX,
      ),
    ),
  );
  const centerReversals = Math.max(
    0,
    ...runs.map((run) =>
      countSimplePdfReversals(
        getSimplePdfMotionSamples(run).map(getSimplePdfSampleAnchorCenterX),
        SIMPLE_PDF_HORIZONTAL_REVERSAL_EPSILON_PX,
      ),
    ),
  );
  const leftOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRunOvershoot(run, getSimplePdfSampleAnchorLeft),
    ),
  );
  const centerOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRunOvershoot(run, getSimplePdfSampleAnchorCenterX),
    ),
  );
  const reversals = Math.max(leftReversals, centerReversals);
  const overshoot = Math.max(leftOvershoot, centerOvershoot);

  return {
    budget: "0 x reversals over 1px, <= 2px x overshoot",
    detail:
      "Tracks the visible anchor left edge and center. A horizontal sign flip means the page moved sideways and then corrected back.",
    id: "horizontal-back-and-forth",
    label: "Horizontal back and forth",
    passed: reversals === 0 && overshoot <= 2,
    value: `${reversals} reversals / ${formatSimplePdfNumber(
      leftOvershoot,
      2,
    )}px left / ${formatSimplePdfNumber(centerOvershoot, 2)}px center`,
  };
}

function collectSimplePdfOvershootMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const sidebarOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfOvershoot(
        run.samples.map((sample) => sample.sidebarWidth),
        run.before.sidebarWidth,
        run.after.sidebarWidth,
      ),
    ),
  );
  const pageWidthOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfOvershoot(
        run.samples.map(getSimplePdfSamplePageWidth),
        getSimplePdfSamplePageWidth(run.before),
        getSimplePdfSamplePageWidth(run.after),
      ),
    ),
  );
  const scrollHeightOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfOvershoot(
        run.samples.map((sample) => sample.scrollHeight),
        run.before.scrollHeight,
        run.after.scrollHeight,
      ),
    ),
  );
  const overshoot = Math.max(
    sidebarOvershoot,
    pageWidthOvershoot,
    scrollHeightOvershoot,
  );

  return {
    budget: "<= 1px",
    detail:
      "Sidebar width, visible page width, and scroll height must stay inside their start/end intervals.",
    id: "overshoot",
    label: "Overshoot",
    passed: overshoot <= 1,
    value: `${formatSimplePdfNumber(
      sidebarOvershoot,
      2,
    )}px sidebar / ${formatSimplePdfNumber(
      pageWidthOvershoot,
      2,
    )}px page / ${formatSimplePdfNumber(scrollHeightOvershoot, 2)}px scroll`,
  };
}

function collectSimplePdfVerticalOvershootMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const anchorTopOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRunOvershoot(
        run,
        (sample) => sample.primaryAnchorTop ?? Number.NaN,
      ),
    ),
  );
  const documentTopOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRunOvershoot(run, (sample) => sample.documentTop),
    ),
  );
  const scrollTopOvershoot = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRunOvershoot(run, (sample) => sample.scrollTop),
    ),
  );
  const overshoot = Math.max(anchorTopOvershoot, scrollTopOvershoot);

  return {
    budget: "<= 2px",
    detail:
      "Visible reading anchor and scrollTop must stay inside their start/end vertical intervals; document top is diagnostic because resize uses a transform.",
    id: "vertical-overshoot",
    label: "Vertical overshoot",
    passed: overshoot <= 2,
    value: `${formatSimplePdfNumber(
      anchorTopOvershoot,
      2,
    )}px anchor / ${formatSimplePdfNumber(
      documentTopOvershoot,
      2,
    )}px document / ${formatSimplePdfNumber(scrollTopOvershoot, 2)}px scroll`,
  };
}

function collectSimplePdfSettleJitterMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const maxAnchorTopRange = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRange(
        getSimplePdfSettledSamples(run).map(
          (sample) => sample.primaryAnchorTop ?? Number.NaN,
        ),
      ),
    ),
  );
  const maxDocumentTopRange = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRange(
        getSimplePdfSettledSamples(run).map((sample) => sample.documentTop),
      ),
    ),
  );
  const maxScrollTopRange = Math.max(
    0,
    ...runs.map((run) =>
      getSimplePdfRange(
        getSimplePdfSettledSamples(run).map((sample) => sample.scrollTop),
      ),
    ),
  );
  const maxReversals = Math.max(
    0,
    ...runs.map((run) => {
      const settledSamples = getSimplePdfSettledSamples(run);
      return Math.max(
        countSimplePdfReversals(
          settledSamples.map(
            (sample) => sample.primaryAnchorTop ?? sample.documentTop,
          ),
          SIMPLE_PDF_SETTLE_SCROLL_EPSILON_PX,
        ),
        countSimplePdfReversals(
          settledSamples.map((sample) => sample.scrollTop),
          SIMPLE_PDF_SETTLE_SCROLL_EPSILON_PX,
        ),
      );
    }),
  );
  const maxRange = Math.max(maxAnchorTopRange, maxScrollTopRange);

  return {
    budget: "<= 1px settled range, 0 reversals over 0.25px",
    detail:
      "After endpoint geometry is reached, the reading anchor and scrollTop should not tremble; document top is diagnostic because resize uses a transform.",
    id: "settle-jitter",
    label: "Settle jitter",
    passed: maxRange <= 1 && maxReversals === 0,
    value: `${formatSimplePdfNumber(
      maxAnchorTopRange,
      2,
    )}px anchor / ${formatSimplePdfNumber(
      maxDocumentTopRange,
      2,
    )}px document / ${formatSimplePdfNumber(
      maxScrollTopRange,
      2,
    )}px scroll / ${maxReversals} reversals`,
  };
}

function collectSimplePdfResizeLinearityMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const maxProgressError = Math.max(
    0,
    ...runs.map((run) => getSimplePdfResizeProgressError(run)),
  );
  const minMotionCoverage = Math.min(
    1,
    ...runs.map((run) => getSimplePdfResizeMotionCoverage(run)),
  );

  return {
    budget: "<= 15% progress error, >= 85% page-width coverage",
    detail:
      "Visible page width should progress with sidebar width during the motion instead of waiting for the final settle.",
    id: "resize-linearity",
    label: "Resize linearity",
    passed: maxProgressError <= 0.15 && minMotionCoverage >= 0.85,
    value: `${formatSimplePdfNumber(
      maxProgressError * 100,
      1,
    )}% error / ${formatSimplePdfNumber(minMotionCoverage * 100, 1)}% coverage`,
  };
}

function collectSimplePdfScrollDriftMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const scrollReversals = Math.max(
    0,
    ...runs.map((run) =>
      countSimplePdfReversals(
        getSimplePdfMotionSamples(run).map((sample) => sample.scrollTop),
        SIMPLE_PDF_REVERSAL_EPSILON,
      ),
    ),
  );
  const scrollEvents = runs.reduce(
    (count, run) => count + run.scrollEventCount + run.windowScrollEventCount,
    0,
  );

  return {
    budget: "0 reversals over 8px",
    detail:
      "Continuous anchor rebasing during resize is acceptable; meaningful direction changes are not.",
    id: "scroll-drift",
    label: "Scroll drift",
    passed: scrollReversals === 0,
    value: `${scrollReversals} reversals / ${scrollEvents} events`,
  };
}

function collectSimplePdfScrollGeometryMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const maxSettleScrollHeightSnap = Math.max(
    0,
    ...runs.map((run) => getSimplePdfSettleScrollHeightSnap(run)),
  );
  const maxAnchorYRatioDrift = Math.max(
    0,
    ...runs.map((run) => getSimplePdfAnchorYRatioDrift(run)),
  );
  const anchorIdentityFailures = runs.reduce(
    (count, run) => count + getSimplePdfAnchorIdentityFailureCount(run),
    0,
  );

  return {
    budget:
      "<= 1px post-endpoint scrollHeight snap, <= 1.5% anchor y-ratio drift, 0 anchor changes",
    detail:
      "Scroll height may resize during motion; once endpoint geometry is sampled it must stay stable, and the same intra-page reading anchor must stay stable.",
    id: "scroll-geometry",
    label: "Scroll identity",
    passed:
      maxSettleScrollHeightSnap <= 1 &&
      maxAnchorYRatioDrift <= 0.015 &&
      anchorIdentityFailures === 0,
    value: `${formatSimplePdfNumber(
      maxSettleScrollHeightSnap,
      2,
    )}px / ${formatSimplePdfNumber(
      maxAnchorYRatioDrift * 100,
      2,
    )}% / ${anchorIdentityFailures} anchor changes`,
  };
}

function collectSimplePdfGapStabilityMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const maxGapReversals = Math.max(
    0,
    ...runs.map((run) =>
      countSimplePdfReversals(
        run.samples.map((sample) => getSimplePdfMedian(sample.gapValues)),
        0.5,
      ),
    ),
  );
  const maxSettleSnap = Math.max(
    0,
    ...runs.map((run) => getSimplePdfSettleGapSnap(run)),
  );

  return {
    budget: "0 reversals, <= 2px settle snap",
    detail:
      "Measures the visible gaps between consecutive pages; this catches page-gap jumps even when the anchor looks stable.",
    id: "gap-stability",
    label: "Page gap stability",
    passed: maxGapReversals === 0 && maxSettleSnap <= 2,
    value: `${maxGapReversals} reversals / ${formatSimplePdfNumber(
      maxSettleSnap,
      2,
    )}px snap`,
  };
}

function collectSimplePdfRendererContinuityMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const loadingFrames = getSimplePdfAllSamples(runs).filter(
    (sample) =>
      sample.visibleLoadingPageCount > 0 || sample.visibleErrorPageCount > 0,
  ).length;
  const emptyVisibleFrames = getSimplePdfAllSamples(runs).filter(
    (sample) =>
      sample.visiblePageCount > 0 && sample.visibleReadyCanvasPageCount === 0,
  ).length;

  return {
    budget: "0 loading/error/empty-canvas visible frames",
    detail:
      "Visible pages must stay rendered through motion and settle; this catches canvas flash and rerender blanking.",
    id: "renderer-continuity",
    label: "Renderer continuity",
    passed: loadingFrames === 0 && emptyVisibleFrames === 0,
    value: `${loadingFrames} loading / ${emptyVisibleFrames} empty canvas`,
  };
}

function collectSimplePdfCanvasPixelContinuityMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  let missingSamples = 0;
  let signatureChanges = 0;
  let inkDropFrames = 0;

  for (const run of runs) {
    const baselineId = run.before.primaryAnchorId;
    const baselineSignature = run.before.primaryAnchorPixelSignature;
    const baselineInkRatio = run.before.primaryAnchorInkRatio ?? 0;
    if (!baselineId || !baselineSignature) {
      missingSamples += 1;
      continue;
    }

    for (const sample of [run.before, ...run.samples, run.after]) {
      if (sample.primaryAnchorId !== baselineId) continue;
      if (!sample.primaryAnchorPixelSignature) {
        missingSamples += 1;
        continue;
      }
      if (sample.primaryAnchorPixelSignature !== baselineSignature) {
        signatureChanges += 1;
      }
      if (
        baselineInkRatio >= 0.04 &&
        (sample.primaryAnchorInkRatio ?? 0) < baselineInkRatio * 0.35
      ) {
        inkDropFrames += 1;
      }
    }
  }

  return {
    budget: "0 signature changes, 0 ink-drop frames, 0 missing samples",
    detail:
      "Samples normalized pixels from the visible anchor canvas; a ready canvas that clears or flashes white now fails telemetry.",
    id: "canvas-pixel-continuity",
    label: "Canvas pixels",
    passed:
      signatureChanges === 0 && inkDropFrames === 0 && missingSamples === 0,
    value: `${signatureChanges} changes / ${inkDropFrames} ink drops / ${missingSamples} missing`,
  };
}

function collectSimplePdfRasterHeadroomMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const minHeadroom = Math.min(
    0,
    ...getSimplePdfAllSamples(runs).map((sample) => {
      if (
        sample.primaryAnchorCanvasWidth == null ||
        sample.primaryAnchorCanvasWidth <= 0 ||
        sample.devicePixelRatio <= 0
      ) {
        return 0;
      }

      const canvasCssWidth =
        sample.primaryAnchorCanvasWidth / sample.devicePixelRatio;
      const maxSidebarResizePageWidth = Math.max(
        1,
        sample.bodyWidth - SIMPLE_PDF_PAGE_PADDING * 2,
      );
      return canvasCssWidth - maxSidebarResizePageWidth;
    }),
  );

  return {
    budget: ">= 0px visible canvas backing headroom",
    detail:
      "Visible canvases should already be rasterized for the largest sidebar-resize page width, so no delayed post-resize bitmap swap is needed.",
    id: "raster-headroom",
    label: "Raster headroom",
    passed: minHeadroom >= 0,
    value: `${formatSimplePdfNumber(minHeadroom, 2)}px`,
  };
}

function collectSimplePdfDomMutationsMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const mutationCount = runs.reduce(
    (count, run) => count + run.mutationCount,
    0,
  );
  const changedNodeCount = runs.reduce(
    (count, run) => count + run.addedNodeCount + run.removedNodeCount,
    0,
  );
  const renderStatusMutationCount = runs.reduce(
    (count, run) => count + run.renderStatusMutationCount,
    0,
  );
  const canvasResizeMutationCount = runs.reduce(
    (count, run) => count + run.canvasResizeMutationCount,
    0,
  );
  const attributeMutationCount = runs.reduce(
    (count, run) => count + run.attributeMutationCount,
    0,
  );

  return {
    budget: "0 added/removed nodes, 0 visible render-status/canvas churn",
    detail:
      "The PDF pages are non-virtualized; sidebar motion should not mount, unmount, resize, or change render status in renderer DOM.",
    id: "dom-mutations",
    label: "DOM mutations",
    passed:
      changedNodeCount === 0 &&
      renderStatusMutationCount === 0 &&
      canvasResizeMutationCount === 0,
    value: `${changedNodeCount} nodes / ${renderStatusMutationCount} status / ${canvasResizeMutationCount} canvas / ${attributeMutationCount} attrs / ${mutationCount} records`,
  };
}

function collectSimplePdfLayoutShiftMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const layoutShiftCount = runs.reduce(
    (count, run) => count + run.layoutShiftCount,
    0,
  );
  const layoutShiftScore = runs.reduce(
    (score, run) => score + run.layoutShiftScore,
    0,
  );

  return {
    budget: "diagnostic only for programmatic telemetry",
    detail:
      "Raw layout-shift observer score is logged, but strict pass/fail is owned by geometry and continuity metrics because telemetry.run() is programmatic.",
    id: "layout-shift",
    label: "Layout shift",
    passed: true,
    value: `${formatSimplePdfNumber(layoutShiftScore, 4)} / ${layoutShiftCount}`,
  };
}

function collectSimplePdfMainThreadMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const frameDurations = runs.flatMap((run) =>
    getSimplePdfFrameDurations(run.samples),
  );
  const p95Frame = getSimplePdfPercentile(frameDurations, 0.95);
  const maxFrame = Math.max(0, ...frameDurations);
  const longTaskDuration = runs.reduce(
    (duration, run) => duration + run.longTaskDuration,
    0,
  );

  return {
    budget: "p95 <= 24ms, max <= 100ms, long tasks 0ms",
    detail:
      "Frame cadence and long-task duration during the transition sampling window.",
    id: "main-thread",
    label: "Main thread",
    passed: p95Frame <= 24 && maxFrame <= 100 && longTaskDuration <= 0,
    value: `${formatSimplePdfNumber(p95Frame, 1)}ms p95 / ${formatSimplePdfNumber(
      maxFrame,
      1,
    )}ms max / ${formatSimplePdfNumber(longTaskDuration, 1)}ms long tasks`,
  };
}

function collectSimplePdfGeometrySyncMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const maxResidual = Math.max(
    0,
    ...getSimplePdfAllSamples(runs).map((sample) =>
      Math.abs(sample.bodyWidth - sample.sidebarWidth - sample.viewportWidth),
    ),
  );

  return {
    budget: "<= 2px residual",
    detail:
      "Body width should equal sidebar width plus PDF viewport width every sampled frame.",
    id: "geometry-sync",
    label: "Geometry sync",
    passed: maxResidual <= 2,
    value: `${formatSimplePdfNumber(maxResidual, 2)}px`,
  };
}

function collectSimplePdfCycleInvarianceMetric(
  runs: readonly SimplePdfTelemetryRun[],
): SimplePdfTelemetryMetric {
  const scenarios = Array.from(new Set(runs.map((run) => run.scenario)));
  if (scenarios.length === 0) {
    return {
      budget: "<= 2px",
      detail: "No telemetry runs were recorded.",
      id: "cycle-invariance",
      label: "Cycle invariance",
      passed: false,
      value: "missing",
    };
  }

  const invariants = scenarios.map((scenario) => {
    const scenarioRuns = runs.filter((run) => run.scenario === scenario);
    const firstRun = scenarioRuns[0];
    const lastRun = scenarioRuns[scenarioRuns.length - 1];
    if (!firstRun || !lastRun) {
      return {
        fingerprintStable: false,
        geometryDelta: Number.POSITIVE_INFINITY,
        readingDrift: Number.POSITIVE_INFINITY,
      };
    }

    const viewportWidthDelta = Math.abs(
      firstRun.before.clientWidth - lastRun.after.clientWidth,
    );
    const sidebarWidthDelta = Math.abs(
      firstRun.before.sidebarWidth - lastRun.after.sidebarWidth,
    );

    return {
      fingerprintStable:
        firstRun.before.fingerprint === lastRun.after.fingerprint,
      geometryDelta: Math.max(viewportWidthDelta, sidebarWidthDelta),
      readingDrift: getSimplePdfSettledReadingFractionDrift(
        firstRun.before,
        lastRun.after,
      ),
    };
  });
  const maxDelta = Math.max(
    ...invariants.map((invariant) => invariant.geometryDelta),
  );
  const readingDrift = Math.max(
    ...invariants.map((invariant) => invariant.readingDrift),
  );
  const fingerprintStable = invariants.every(
    (invariant) => invariant.fingerprintStable,
  );

  return {
    budget: "<= 2px geometry, <= 0.5% reading drift, same fingerprint",
    detail:
      "After each two-toggle scenario the viewport, sidebar, reading position, and renderer fingerprint should return to that scenario's starting state.",
    id: "cycle-invariance",
    label: "Cycle invariance",
    passed: maxDelta <= 2 && readingDrift <= 0.005 && fingerprintStable,
    value: `${formatSimplePdfNumber(maxDelta, 2)}px / ${formatSimplePdfNumber(
      readingDrift * 100,
      2,
    )}% / ${fingerprintStable ? "same" : "changed"}`,
  };
}

function getSimplePdfAllSamples(runs: readonly SimplePdfTelemetryRun[]) {
  return runs.flatMap((run) => run.samples);
}

function getSimplePdfReadingFraction(sample: SimplePdfTelemetrySample) {
  const range = Math.max(1, sample.scrollHeight - sample.clientHeight);
  return clampSimplePdfNumber(sample.scrollTop / range, 0, 1);
}

function getSimplePdfSettledReadingFractionDrift(
  before: SimplePdfTelemetrySample,
  after: SimplePdfTelemetrySample,
) {
  return Math.abs(
    getSimplePdfReadingFraction(after) - getSimplePdfReadingFraction(before),
  );
}

function getSimplePdfResizeProgressError(run: SimplePdfTelemetryRun) {
  const beforePageWidth = getSimplePdfSamplePageWidth(run.before);
  const afterPageWidth = getSimplePdfSamplePageWidth(run.after);
  if (
    Math.abs(run.after.sidebarWidth - run.before.sidebarWidth) <= 1 ||
    Math.abs(afterPageWidth - beforePageWidth) <= 1
  ) {
    return 0;
  }

  return Math.max(
    0,
    ...getSimplePdfMotionSamples(run).map((sample) => {
      const sidebarProgress = getSimplePdfProgress(
        sample.sidebarWidth,
        run.before.sidebarWidth,
        run.after.sidebarWidth,
      );
      const pageProgress = getSimplePdfProgress(
        getSimplePdfSamplePageWidth(sample),
        beforePageWidth,
        afterPageWidth,
      );
      return Math.abs(sidebarProgress - pageProgress);
    }),
  );
}

function getSimplePdfResizeMotionCoverage(run: SimplePdfTelemetryRun) {
  const beforePageWidth = getSimplePdfSamplePageWidth(run.before);
  const afterPageWidth = getSimplePdfSamplePageWidth(run.after);
  if (
    Math.abs(run.after.sidebarWidth - run.before.sidebarWidth) <= 1 ||
    Math.abs(afterPageWidth - beforePageWidth) <= 1
  ) {
    return 1;
  }

  const samples = getSimplePdfMotionSamples(run);
  const sidebarProgressRange = getSimplePdfRange(
    samples.map((sample) =>
      getSimplePdfProgress(
        sample.sidebarWidth,
        run.before.sidebarWidth,
        run.after.sidebarWidth,
      ),
    ),
  );
  const pageProgressRange = getSimplePdfRange(
    samples.map((sample) =>
      getSimplePdfProgress(
        getSimplePdfSamplePageWidth(sample),
        beforePageWidth,
        afterPageWidth,
      ),
    ),
  );

  if (sidebarProgressRange <= 0.001) return 1;
  return clampSimplePdfNumber(pageProgressRange / sidebarProgressRange, 0, 1);
}

function getSimplePdfProgress(
  value: number,
  fromValue: number,
  toValue: number,
) {
  const delta = toValue - fromValue;
  if (Math.abs(delta) <= 0.001) return 1;
  return clampSimplePdfNumber((value - fromValue) / delta, 0, 1);
}

function getSimplePdfSamplePageWidth(sample: SimplePdfTelemetrySample) {
  return sample.primaryAnchorWidth ?? sample.documentWidth;
}

function getSimplePdfSampleAnchorLeft(sample: SimplePdfTelemetrySample) {
  return sample.primaryAnchorLeft ?? sample.documentLeft;
}

function getSimplePdfSampleAnchorCenterX(sample: SimplePdfTelemetrySample) {
  if (sample.primaryAnchorLeft != null && sample.primaryAnchorWidth != null) {
    return sample.primaryAnchorLeft + sample.primaryAnchorWidth / 2;
  }

  return sample.documentLeft + sample.documentWidth / 2;
}

function getSimplePdfAnchorYRatioDrift(run: SimplePdfTelemetryRun) {
  const yRatios = [run.before, ...run.samples, run.after].map(
    getSimplePdfAnchorYRatio,
  );
  if (yRatios.some((yRatio) => yRatio == null)) return 1;

  return getSimplePdfRange(yRatios as number[]);
}

function getSimplePdfAnchorYRatio(sample: SimplePdfTelemetrySample) {
  if (
    sample.primaryAnchorTop == null ||
    sample.primaryAnchorHeight == null ||
    sample.primaryAnchorHeight <= 0
  ) {
    return null;
  }

  return clampSimplePdfRatio(
    (sample.primaryAnchorMarkerOffset - sample.primaryAnchorTop) /
      sample.primaryAnchorHeight,
  );
}

function getSimplePdfSettleScrollHeightSnap(run: SimplePdfTelemetryRun) {
  const settledSample = run.samples.find((sample) =>
    isSimplePdfSampleAtSettledGeometry(sample, run.after),
  );
  const fallbackSample = run.samples.at(-1);
  return Math.abs(
    run.after.scrollHeight -
      (settledSample ?? fallbackSample ?? run.after).scrollHeight,
  );
}

function getSimplePdfSettledSamples(run: SimplePdfTelemetryRun) {
  const settledIndex = run.samples.findIndex((sample) =>
    isSimplePdfSampleAtSettledGeometry(sample, run.after),
  );
  if (settledIndex < 0) return [run.after];
  return [...run.samples.slice(settledIndex), run.after];
}

function isSimplePdfSampleAtSettledGeometry(
  sample: SimplePdfTelemetrySample,
  settledSample: SimplePdfTelemetrySample,
) {
  return (
    Math.abs(sample.sidebarWidth - settledSample.sidebarWidth) <=
      SIMPLE_PDF_MOTION_SETTLE_EPSILON_PX &&
    Math.abs(sample.clientWidth - settledSample.clientWidth) <= 1 &&
    Math.abs(sample.documentHeight - settledSample.documentHeight) <= 1 &&
    Math.abs(sample.documentWidth - settledSample.documentWidth) <= 1 &&
    Math.abs(
      getSimplePdfSamplePageWidth(sample) -
        getSimplePdfSamplePageWidth(settledSample),
    ) <= 1
  );
}

function getSimplePdfAnchorIdentityFailureCount(run: SimplePdfTelemetryRun) {
  const anchorId = run.before.primaryAnchorId;
  if (!anchorId) return 1;

  const anchorSamples = [...getSimplePdfMotionSamples(run), run.after];
  return anchorSamples.some((sample) => sample.primaryAnchorId !== anchorId)
    ? 1
    : 0;
}

function getSimplePdfMotionSamples(run: SimplePdfTelemetryRun) {
  return run.samples.filter(
    (sample) => sample.elapsedMs <= SIMPLE_PDF_SIDEBAR_MOTION_MS,
  );
}

function getSimplePdfTelemetryScenarios({
  rootElement,
  viewportElement,
}: {
  rootElement: HTMLElement;
  viewportElement: HTMLElement;
}): Array<{ id: SimplePdfTelemetryRun["scenario"]; scrollTop: number }> {
  return [
    {
      id: "deep-scroll",
      scrollTop: getSimplePdfTelemetryScrollTarget(viewportElement),
    },
    {
      id: "page-edge",
      scrollTop: getSimplePdfTelemetryPageEdgeScrollTarget({
        rootElement,
        viewportElement,
      }),
    },
  ];
}

function getSimplePdfTelemetryScrollTarget(viewportElement: HTMLElement) {
  const maxScrollTop = Math.max(
    0,
    viewportElement.scrollHeight - viewportElement.clientHeight,
  );
  return clampSimplePdfNumber(
    maxScrollTop * SIMPLE_PDF_TELEMETRY_SCROLL_DEPTH_RATIO,
    0,
    maxScrollTop,
  );
}

function getSimplePdfTelemetryPageEdgeScrollTarget({
  rootElement,
  viewportElement,
}: {
  rootElement: HTMLElement;
  viewportElement: HTMLElement;
}) {
  const pages = Array.from(
    rootElement.querySelectorAll<HTMLElement>('[data-slot="simple-pdf-page"]'),
  );
  const targetPage =
    pages[
      Math.max(0, Math.min(pages.length - 1, Math.ceil(pages.length * 0.7)))
    ];
  if (!targetPage) return getSimplePdfTelemetryScrollTarget(viewportElement);

  const viewportRect = viewportElement.getBoundingClientRect();
  const pageRect = targetPage.getBoundingClientRect();
  const maxScrollTop = Math.max(
    0,
    viewportElement.scrollHeight - viewportElement.clientHeight,
  );

  return clampSimplePdfNumber(
    viewportElement.scrollTop + pageRect.top - viewportRect.top,
    0,
    maxScrollTop,
  );
}

async function waitForSimplePdfReadyPages(
  rootElement: HTMLElement,
  timeoutMs: number,
) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const pages = Array.from(
      rootElement.querySelectorAll<HTMLElement>(
        '[data-slot="simple-pdf-page"]',
      ),
    );
    if (
      pages.length > 0 &&
      pages.every(
        (page) =>
          page.dataset.renderStatus === "ready" &&
          page.dataset.renderRefreshing !== "true",
      )
    ) {
      return;
    }
    await waitForSimplePdfFrames(1);
  }
}

function waitForSimplePdfFrames(frameCount: number) {
  return new Promise<void>((resolve) => {
    let remainingFrames = Math.max(1, frameCount);
    const tick = () => {
      remainingFrames -= 1;
      if (remainingFrames <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function countSimplePdfReversals(values: readonly unknown[], epsilon: number) {
  let direction = 0;
  let reversals = 0;
  let previous: number | null = null;

  for (const rawValue of values) {
    const value = typeof rawValue === "number" ? rawValue : Number.NaN;
    if (!Number.isFinite(value)) continue;
    if (previous === null) {
      previous = value;
      continue;
    }

    const delta = value - previous;
    previous = value;
    if (Math.abs(delta) <= epsilon) continue;

    const nextDirection = delta > 0 ? 1 : -1;
    if (direction !== 0 && nextDirection !== direction) reversals += 1;
    direction = nextDirection;
  }

  return reversals;
}

function getSimplePdfRunOvershoot(
  run: SimplePdfTelemetryRun,
  getValue: (sample: SimplePdfTelemetrySample) => number,
) {
  const beforeValue = getValue(run.before);
  const afterValue = getValue(run.after);
  if (!Number.isFinite(beforeValue) || !Number.isFinite(afterValue)) return 0;

  return getSimplePdfOvershoot(
    run.samples.map(getValue),
    beforeValue,
    afterValue,
  );
}

function getSimplePdfOvershoot(
  values: readonly number[],
  fromValue: number,
  toValue: number,
) {
  const minValue = Math.min(fromValue, toValue);
  const maxValue = Math.max(fromValue, toValue);
  return values.reduce((overshoot, value) => {
    if (!Number.isFinite(value)) return overshoot;
    if (value < minValue) return Math.max(overshoot, minValue - value);
    if (value > maxValue) return Math.max(overshoot, value - maxValue);
    return overshoot;
  }, 0);
}

function getSimplePdfRange(values: readonly number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return 0;
  return Math.max(...finiteValues) - Math.min(...finiteValues);
}

function getSimplePdfSettleGapSnap(run: SimplePdfTelemetryRun) {
  const beforeSettleGap = getSimplePdfMedian(
    run.samples
      .filter((sample) => sample.elapsedMs <= SIMPLE_PDF_SIDEBAR_MOTION_MS)
      .at(-1)?.gapValues ?? [],
  );
  const afterGap = getSimplePdfMedian(run.after.gapValues);
  if (!Number.isFinite(beforeSettleGap) || !Number.isFinite(afterGap)) return 0;
  return Math.abs(beforeSettleGap - afterGap);
}

function getSimplePdfMedian(values: readonly number[]) {
  const finiteValues = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (finiteValues.length === 0) return Number.NaN;
  return finiteValues[Math.floor(finiteValues.length / 2)];
}

function getSimplePdfFrameDurations(
  samples: readonly SimplePdfTelemetrySample[],
) {
  const durations: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    durations.push(samples[index].timestamp - samples[index - 1].timestamp);
  }
  return durations.filter(
    (duration) => Number.isFinite(duration) && duration >= 0,
  );
}

function getSimplePdfPercentile(values: readonly number[], percentile: number) {
  const finiteValues = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (finiteValues.length === 0) return 0;
  const index = clampSimplePdfNumber(
    Math.ceil(finiteValues.length * percentile) - 1,
    0,
    finiteValues.length - 1,
  );
  return finiteValues[index];
}

function loadSimplePdfjs() {
  if (!simplePdfjsPromise) {
    simplePdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(
      (pdfjs) => {
        const pdfjsModule = pdfjs as unknown as SimplePdfjsModule;
        if (!pdfjsModule.GlobalWorkerOptions.workerSrc) {
          pdfjsModule.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }
        return pdfjsModule;
      },
    );
  }

  return simplePdfjsPromise;
}

function clampSimplePdfScale(scale: number) {
  return Math.min(
    SIMPLE_PDF_MAX_SCALE,
    Math.max(SIMPLE_PDF_MIN_SCALE, Number(scale.toFixed(4))),
  );
}

function clampSimplePdfZoomFactor(zoomFactor: number) {
  return Math.min(
    SIMPLE_PDF_MAX_ZOOM_FACTOR,
    Math.max(SIMPLE_PDF_MIN_ZOOM_FACTOR, Number(zoomFactor.toFixed(2))),
  );
}

function clampSimplePdfRatio(value: number) {
  return clampSimplePdfNumber(value, 0, 1);
}

function clampSimplePdfNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatSimplePdfNumber(value: number, fractionDigits: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(fractionDigits));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function isPdfRenderCancelled(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "RenderingCancelledException" ||
      error.message.includes("Rendering cancelled"))
  );
}

function toSimplePdfError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error("Unknown PDF error.");
}
