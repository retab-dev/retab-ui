import type { Page } from "@playwright/test";

// Shared reading-line trajectory probe for sidebar-toggle gates.
//
// Traces the screen position of the CONTENT at a format's pinned reading
// line through a toggle (or a rapid mid-flight retarget), plus the frame
// center's horizontal path. Three scores per axis:
// - settleDrift: destination error;
// - corridor: max distance from start during the whole flight;
// - excursion: corridor − |net| — the literal back-and-forth number.
//
// Hard-won probe rules (each cost an investigation round when violated):
// - Track the ELEMENT UNDER THE READING LINE, never a virtualization
//   wrapper — window churn reads as content drift.
// - At scroll 0 every format pins the document TOP (the clamp permits
//   nothing else); probe ratio 0 there, the format's own line deeper.
// - Reproduce at OVERFLOWING geometry with NON-ZERO scroll: at scroll 0
//   most rebase bugs multiply out to exactly zero.

export type ReadingLineTrace = {
  scrollBefore: number;
  scrollAfter: number;
  settleDrift: number;
  corridor: number;
  excursion: number;
  settleDriftX: number;
  corridorX: number;
  samples: number;
};

export type ReadingLineTarget = {
  /** Element used to locate the scroller (must be inside it). */
  frameSelector: string;
  /** Candidates for the tracked content element (page/frame/slide). */
  trackSelector: string;
  /** The viewport line this format's rebase pins (0 = top, 1 = bottom). */
  markerRatio: number;
  /**
   * Horizontal observable: a centered document's CENTER is its pinned
   * x-line (it legitimately recenters by half the pane delta); a
   * start-aligned container's LEFT EDGE must not move at all — its center
   * displaces with the pane width by construction.
   */
  align: "center" | "start";
};

export async function setViewerScroll(
  page: Page,
  frameSelector: string,
  scroll: "zero" | "quarter" | "half" | "max",
): Promise<boolean> {
  return page.evaluate(
    ({ frameSelector, scroll }) => {
      const root = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-slot="file-viewer-root"]',
        ),
      ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
      const frame = root.querySelector<HTMLElement>(frameSelector);
      const scroller = Array.from(
        root.querySelectorAll<HTMLElement>("*"),
      ).find(
        (el) =>
          el.scrollHeight > el.clientHeight + 4 &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
          frame != null &&
          el.contains(frame),
      );
      if (!scroller) return scroll === "zero";
      const range = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop =
        scroll === "zero"
          ? 0
          : scroll === "quarter"
            ? range * 0.25
            : scroll === "half"
              ? range * 0.5
              : range;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      return true;
    },
    { frameSelector, scroll },
  );
}

export async function traceReadingLineThroughToggle(
  page: Page,
  { frameSelector, trackSelector, markerRatio, align }: ReadingLineTarget,
  { rapid = false }: { rapid?: boolean } = {},
): Promise<ReadingLineTrace> {
  return page.evaluate(
    async ({ frameSelector, trackSelector, markerRatio, align, rapid }) => {
      const root = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-slot="file-viewer-root"]',
        ),
      ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
      const trigger = root.querySelector<HTMLButtonElement>(
        '[data-slot="file-viewer-sidebar-trigger"]',
      )!;
      // A deep scroll jump right after a toggle can catch the virtualization
      // window mid-rebuild, with no frame mounted for a few frames — wait it
      // out rather than tracing a null frame.
      let frame = root.querySelector<HTMLElement>(frameSelector);
      for (let index = 0; index < 120 && !frame; index += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        frame = root.querySelector<HTMLElement>(frameSelector);
      }
      if (!frame) {
        throw new Error(`reading-line trace: no frame for ${frameSelector}`);
      }
      const scroller = Array.from(
        root.querySelectorAll<HTMLElement>("*"),
      ).find(
        (el) =>
          el.scrollHeight > el.clientHeight + 4 &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
          el.contains(frame),
      );

      const scrollerRect = scroller?.getBoundingClientRect();
      const markerY = scrollerRect
        ? scrollerRect.top + (scroller?.clientHeight ?? 0) * markerRatio
        : frame.getBoundingClientRect().top;
      // Pick the candidate UNDER the marker line; when the line sits in
      // inter-page/padding space (e.g. the viewport bottom at max scroll),
      // fall back to the NEAREST candidate — never candidates[0], which is a
      // virtualization-window edge that unmounts mid-flight and reads as a
      // full-viewport drift.
      const queryCandidates = () =>
        Array.from(root.querySelectorAll<HTMLElement>(trackSelector));
      const pickTracked = () => {
        const candidates = queryCandidates();
        let nearest: HTMLElement | undefined;
        let nearestDistance = Infinity;
        for (const el of candidates) {
          const r = el.getBoundingClientRect();
          if (r.height <= 0) continue;
          const distance =
            r.bottom < markerY
              ? markerY - r.bottom
              : Math.max(0, r.top - markerY);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = el;
          }
        }
        return nearest ?? candidates[0] ?? frame;
      };
      const tracked = pickTracked();
      // Survive keyed remounts (PDF pages re-raster at the committed scale):
      // re-resolve the SAME logical page by its identity attribute when the
      // original node detaches; a detached rect reads as a zero box at the
      // origin, which scores as a phantom full-viewport excursion.
      const trackedKey =
        tracked.getAttribute("data-page") ??
        tracked.getAttribute("data-page-number");
      const resolveTracked = () => {
        if (tracked.isConnected) return tracked;
        if (trackedKey == null) return null;
        return (
          queryCandidates().find(
            (el) =>
              (el.getAttribute("data-page") ??
                el.getAttribute("data-page-number")) === trackedKey &&
              el.getBoundingClientRect().height > 0,
          ) ?? null
        );
      };
      const rect0 = tracked.getBoundingClientRect();
      const contentAtMarker = (markerY - rect0.top) / rect0.height;
      const scrollBefore = scroller?.scrollTop ?? 0;
      const readX = (rect: DOMRect) =>
        align === "center" ? rect.left + rect.width / 2 : rect.left;
      const centerX0 = readX(rect0);

      const positions: number[] = [];
      const centersX: number[] = [];
      trigger.click();
      if (rapid) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        trigger.click();
      }
      for (let index = 0; index < 90; index += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const element = resolveTracked();
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        positions.push(rect.top + contentAtMarker * rect.height - markerY);
        centersX.push(readX(rect) - centerX0);
      }

      const settleDrift = positions.at(-1) ?? 0;
      let corridor = 0;
      for (const position of positions) {
        corridor = Math.max(corridor, Math.abs(position));
      }
      let corridorX = 0;
      for (const centerX of centersX) {
        corridorX = Math.max(corridorX, Math.abs(centerX));
      }
      return {
        scrollBefore,
        scrollAfter: scroller?.scrollTop ?? 0,
        settleDrift,
        corridor,
        excursion: corridor - Math.abs(settleDrift),
        settleDriftX: centersX.at(-1) ?? 0,
        corridorX,
        samples: positions.length,
      };
    },
    { frameSelector, trackSelector, markerRatio, align, rapid },
  );
}
