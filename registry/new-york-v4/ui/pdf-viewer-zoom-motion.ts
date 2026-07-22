import {
  findPdfPageByOffset,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { clamp } from "./pdf-viewer-scale";
import type { ViewerDocumentZoomMotionController } from "./viewer-types";

// A toolbar zoom step re-anchors the viewport CENTER on both axes (Apple
// Preview semantics): the content point under the viewport center before the
// step is back under the viewport center after it, and a short FLIP relax
// scales the painted surface about that fixed point. The reading-marker
// restore (20% from the top, block axis only) stays the semantics for every
// other geometry change — re-fits, rotation, container resizes — where the
// intent is "keep my reading position", not "zoom the camera".
const PDF_ZOOM_CENTER_MARKER_RATIO = 0.5;
const PDF_ZOOM_MOTION_DURATION_MS = 200;
// easeOutCubic: fast attack, gentle landing — a linear relax reads as a
// hard stop at settle.
const PDF_ZOOM_MOTION_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";
const PDF_ZOOM_MOTION_CLEANUP_MS = PDF_ZOOM_MOTION_DURATION_MS + 50;
const PDF_ZOOM_MOTION_MIN_TRANSLATE_PX = 0.5;
const PDF_ZOOM_MOTION_MIN_SCALE_DELTA = 0.001;
// A rebased (paged) physical scroll detaches the stage box from the content
// scale, so the whole-surface FLIP would warp. The two axes then stop scaling
// by the same ratio, which is exactly the detectable symptom.
const PDF_ZOOM_MOTION_AXIS_MISMATCH_RATIO = 0.02;

// The exact wait-out of the relax before the visual clip re-tightens; clip
// release is React-rendered state, so it outlives the inline transition.
export const PDF_ZOOM_MOTION_TOTAL_MS = PDF_ZOOM_MOTION_CLEANUP_MS + 50;

const PDF_ZOOM_SCROLL_RANGE_SELECTOR = '[data-slot="pdf-viewer-scroll-range"]';
const PDF_ZOOM_VISUAL_LAYER_SELECTOR = '[data-slot="pdf-viewer-visual-clip"]';

export type PdfZoomTransaction = {
  pageNumber: number;
  /**
   * Deliberately unclamped, like the reading anchor: the layout is linear in
   * scale, so a center marker resting in a gap or the edge padding restores
   * by the same page-relative fraction.
   */
  yPercent: number;
  /** Viewport-center position as a fraction of the stage's inline size. */
  inlineFraction: number | null;
  /** Painted visual-layer rect at click time — the FLIP's "first" frame. */
  previousVisualRect: DOMRectReadOnly | null;
};

export function createPdfZoomMotionController(
  layout: PdfPageLayoutModel,
): ViewerDocumentZoomMotionController<PdfZoomTransaction> {
  return {
    capture: ({ scrollTop, viewportElement }) =>
      capturePdfZoomTransaction({ layout, scrollTop, viewportElement }),
    resolveScrollTarget: ({ transaction, viewportElement }) =>
      resolvePdfZoomScrollTarget({ layout, transaction, viewportElement }),
    play: ({ transaction, viewportElement }) =>
      playPdfZoomMotion({ transaction, viewportElement }),
  };
}

export function capturePdfZoomTransaction({
  layout,
  scrollTop,
  viewportElement,
}: {
  layout: PdfPageLayoutModel;
  scrollTop: number;
  viewportElement: HTMLDivElement;
}): PdfZoomTransaction | null {
  if (layout.pageCount === 0) return null;

  const viewportBlockSize = Math.max(0, viewportElement.clientHeight);
  const centerOffset =
    Math.max(0, scrollTop) + viewportBlockSize * PDF_ZOOM_CENTER_MARKER_RATIO;
  const pageNumber = findPdfPageByOffset(layout, centerOffset);
  const pageLayout = getPdfPageLayout(layout, pageNumber);
  if (!pageLayout || pageLayout.height <= 0) return null;

  return {
    pageNumber,
    yPercent: (centerOffset - pageLayout.offsetTop) / pageLayout.height,
    inlineFraction: capturePdfZoomInlineFraction(viewportElement),
    previousVisualRect: readElementRect(
      findPdfZoomVisualLayer(viewportElement),
    ),
  };
}

export function resolvePdfZoomScrollTarget({
  layout,
  transaction,
  viewportElement,
}: {
  layout: PdfPageLayoutModel;
  transaction: PdfZoomTransaction;
  viewportElement: HTMLDivElement;
}): { left?: number; top: number } | null {
  const pageLayout = getPdfPageLayout(layout, transaction.pageNumber);
  if (!pageLayout) return null;

  const viewportBlockSize = Math.max(0, viewportElement.clientHeight);
  const maxScrollTop = Math.max(0, layout.totalHeight - viewportBlockSize);
  const top = clamp(
    pageLayout.offsetTop +
      pageLayout.height * transaction.yPercent -
      viewportBlockSize * PDF_ZOOM_CENTER_MARKER_RATIO,
    0,
    maxScrollTop,
  );

  const left = resolvePdfZoomScrollLeft(viewportElement, transaction);
  return { top, ...(left == null ? null : { left }) };
}

// The stage (scroll range) is measured by live rects rather than re-deriving
// its centered offset, so the math is direction-agnostic: RTL scrollLeft
// coordinate spaces and the browser's own clamping both fall out for free.
function capturePdfZoomInlineFraction(viewportElement: HTMLDivElement) {
  const rangeRect = readElementRect(
    viewportElement.querySelector<HTMLElement>(PDF_ZOOM_SCROLL_RANGE_SELECTOR),
  );
  if (!rangeRect || rangeRect.width <= 0) return null;
  return (
    (getViewportCenterX(viewportElement) - rangeRect.left) / rangeRect.width
  );
}

function resolvePdfZoomScrollLeft(
  viewportElement: HTMLDivElement,
  transaction: PdfZoomTransaction,
) {
  if (transaction.inlineFraction == null) return undefined;
  const rangeRect = readElementRect(
    viewportElement.querySelector<HTMLElement>(PDF_ZOOM_SCROLL_RANGE_SELECTOR),
  );
  if (!rangeRect || rangeRect.width <= 0) return undefined;

  // Scroll right by however far the anchored content point currently sits
  // right of the viewport center; the browser clamps to the scrollable range
  // (which also zeroes it out when the stage fits without overflow).
  return (
    viewportElement.scrollLeft +
    (rangeRect.left + rangeRect.width * transaction.inlineFraction) -
    getViewportCenterX(viewportElement)
  );
}

export function playPdfZoomMotion({
  transaction,
  viewportElement,
}: {
  transaction: PdfZoomTransaction;
  viewportElement: HTMLDivElement;
}): (() => void) | null {
  if (typeof requestAnimationFrame !== "function") return null;
  if (prefersReducedMotion()) return null;

  const previousRect = transaction.previousVisualRect;
  const visualLayer = findPdfZoomVisualLayer(viewportElement);
  if (!previousRect || !visualLayer) return null;

  const currentRect = readElementRect(visualLayer);
  if (
    !currentRect ||
    previousRect.width <= 0 ||
    previousRect.height <= 0 ||
    currentRect.width <= 0 ||
    currentRect.height <= 0
  ) {
    return null;
  }

  const scaleX = previousRect.width / currentRect.width;
  const scaleY = previousRect.height / currentRect.height;
  if (
    Math.abs(scaleX - scaleY) >
    PDF_ZOOM_MOTION_AXIS_MISMATCH_RATIO * Math.max(scaleX, scaleY)
  ) {
    return null;
  }

  const translateX = previousRect.left - currentRect.left;
  const translateY = previousRect.top - currentRect.top;
  const hasVisibleDelta =
    Math.abs(translateX) > PDF_ZOOM_MOTION_MIN_TRANSLATE_PX ||
    Math.abs(translateY) > PDF_ZOOM_MOTION_MIN_TRANSLATE_PX ||
    Math.abs(1 - scaleX) > PDF_ZOOM_MOTION_MIN_SCALE_DELTA ||
    Math.abs(1 - scaleY) > PDF_ZOOM_MOTION_MIN_SCALE_DELTA;
  if (!hasVisibleDelta) return null;

  // Re-express the FLIP about the viewport center instead of the stage's
  // top-left: the stage is the full document (hundreds of thousands of px
  // tall), and a scale that far from its origin runs into GPU float
  // precision. Anchoring at the viewport keeps the rasterized region's
  // coordinates small; the mapping is identical.
  const originX = getViewportCenterX(viewportElement) - currentRect.left;
  const originY =
    viewportElement.getBoundingClientRect().top +
    Math.max(0, viewportElement.clientHeight) / 2 -
    currentRect.top;
  const anchoredTranslateX = translateX + (scaleX - 1) * originX;
  const anchoredTranslateY = translateY + (scaleY - 1) * originY;

  let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
  let startFrame = 0;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (startFrame !== 0) cancelAnimationFrame(startFrame);
    if (cleanupTimeout !== null) clearTimeout(cleanupTimeout);
    visualLayer.style.transition = "";
    visualLayer.style.transform = "";
    visualLayer.style.transformOrigin = "";
    visualLayer.style.willChange = "";
  };

  visualLayer.style.transition = "none";
  visualLayer.style.transformOrigin = `${originX}px ${originY}px`;
  visualLayer.style.transform = `translate3d(${anchoredTranslateX}px, ${anchoredTranslateY}px, 0px) scale(${scaleX}, ${scaleY})`;
  visualLayer.style.willChange = "transform";

  startFrame = requestAnimationFrame(() => {
    startFrame = 0;
    if (finished) return;
    visualLayer.style.transition = `transform ${PDF_ZOOM_MOTION_DURATION_MS}ms ${PDF_ZOOM_MOTION_EASING}`;
    visualLayer.style.transform = "translate3d(0px, 0px, 0px) scale(1, 1)";
  });
  cleanupTimeout = setTimeout(finish, PDF_ZOOM_MOTION_CLEANUP_MS);

  return finish;
}

function findPdfZoomVisualLayer(viewportElement: HTMLDivElement) {
  if (typeof viewportElement.querySelector !== "function") return null;
  return viewportElement.querySelector<HTMLElement>(
    PDF_ZOOM_VISUAL_LAYER_SELECTOR,
  );
}

function getViewportCenterX(viewportElement: HTMLDivElement) {
  return (
    viewportElement.getBoundingClientRect().left +
    Math.max(0, viewportElement.clientWidth) / 2
  );
}

function readElementRect(element: HTMLElement | null) {
  if (!element || typeof element.getBoundingClientRect !== "function") {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function prefersReducedMotion() {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
