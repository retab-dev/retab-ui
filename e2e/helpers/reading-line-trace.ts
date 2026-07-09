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
  scroll: "zero" | "quarter" | "half" | "max" | number,
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
      if (!scroller) return scroll === "zero" || scroll === 0;
      const range = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop =
        typeof scroll === "number"
          ? range * scroll
          : scroll === "zero"
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
  { rapid = false, cycles = 0 }: { rapid?: boolean; cycles?: number } = {},
): Promise<ReadingLineTrace> {
  return page.evaluate(
    async ({
      frameSelector,
      trackSelector,
      markerRatio,
      align,
      rapid,
      cycles,
    }) => {
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
      const sampleFrames = async (count: number) => {
        for (let index = 0; index < count; index += 1) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          const element = resolveTracked();
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          positions.push(rect.top + contentAtMarker * rect.height - markerY);
          centersX.push(readX(rect) - centerX0);
        }
      };

      if (cycles > 0) {
        // Accumulation detector: repeated full close+open cycles must return
        // the reading line to its origin — capture/restore pairs that lose a
        // fraction per leg compound into visible creep over a session.
        for (let cycle = 0; cycle < cycles; cycle += 1) {
          trigger.click();
          await sampleFrames(28);
          trigger.click();
          await sampleFrames(28);
        }
        await sampleFrames(20);
      } else {
        trigger.click();
        if (rapid) {
          await new Promise((resolve) => setTimeout(resolve, 60));
          trigger.click();
        }
        await sampleFrames(90);
      }

      if (positions.length === 0) {
        // Every sample missed: the tracked content was unmounted for the
        // whole flight. Zero samples would score as a perfect run — fail
        // loudly instead.
        throw new Error(
          `reading-line trace: tracked ${trackSelector} never resolvable during the toggle`,
        );
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
    { frameSelector, trackSelector, markerRatio, align, rapid, cycles },
  );
}


// Resize-sweep detector: the same re-fit machinery a toggle exercises once
// fires continuously while the viewport resizes. Steps the viewport width
// down and back up, sampling the reading line after each step: a per-step
// capture/restore error compounds across the sweep, and the round trip must
// land back at the origin.
export async function traceReadingLineThroughResize(
  page: Page,
  { frameSelector, trackSelector, markerRatio, align }: ReadingLineTarget,
  {
    stepPx = 48,
    steps = 5,
    settleMs = 320,
  }: { stepPx?: number; steps?: number; settleMs?: number } = {},
): Promise<{ positions: number[]; positionsX: number[] }> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");

  await page.evaluate(
    ({ frameSelector, trackSelector, markerRatio, align }) => {
      const root = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-slot="file-viewer-root"]',
        ),
      ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
      const frame = root.querySelector<HTMLElement>(frameSelector)!;
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
      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>(trackSelector),
      );
      const tracked =
        candidates.find((el) => {
          const r = el.getBoundingClientRect();
          return r.top <= markerY && r.bottom >= markerY;
        }) ??
        candidates[0] ??
        frame;
      const rect0 = tracked.getBoundingClientRect();
      const readX = (rect: DOMRect) =>
        align === "center" ? rect.left + rect.width / 2 : rect.left;
      (window as unknown as { __rlResize?: unknown }).__rlResize = {
        tracked,
        // Scrollerless panes (transform-virtualized grids/canvases) have no
        // marker line in scroll space; their reference is the container's
        // own initial screen top, which a resize must not move.
        markerYFallback: markerY,
        trackSelector,
        trackedKey:
          tracked.getAttribute("data-page") ??
          tracked.getAttribute("data-page-number") ??
          tracked.getAttribute("data-slide") ??
          null,
        trackedIndex: candidates.indexOf(tracked),
        root,
        contentAtMarker: (markerY - rect0.top) / rect0.height,
        markerFraction: markerRatio,
        scroller: scroller ?? null,
        x0: readX(rect0),
        align,
      };
    },
    { frameSelector, trackSelector, markerRatio, align },
  );

  const positions: number[] = [];
  const positionsX: number[] = [];
  const widths = [
    ...Array.from(
      { length: steps },
      (_, index) => viewport.width - (index + 1) * stepPx,
    ),
    ...Array.from(
      { length: steps },
      (_, index) => viewport.width - (steps - 1 - index) * stepPx,
    ),
  ];
  for (const width of widths) {
    await page.setViewportSize({ width, height: viewport.height });
    await page.waitForTimeout(settleMs);
    const sample = await page.evaluate(() => {
      const state = (
        window as unknown as {
          __rlResize?: {
            tracked: HTMLElement;
            markerYFallback: number;
            trackSelector: string;
            trackedKey: string | null;
            trackedIndex: number;
            root: HTMLElement;
            contentAtMarker: number;
            markerFraction: number;
            scroller: HTMLElement | null;
            x0: number;
            align: "center" | "start";
          };
        }
      ).__rlResize!;
      // Re-resolve across keyed remounts (slides, grids, and text canvases
      // remount on width change); a detached node's zero rect at the origin
      // otherwise reads as a constant phantom offset of exactly -markerY.
      // The SCROLLER remounts too on some formats — a detached scroller's
      // zero rect collapses markerY to 0, which reads as +rect.top.
      if (state.scroller && !state.scroller.isConnected) {
        const frame = state.tracked.isConnected ? state.tracked : state.root;
        state.scroller =
          Array.from(state.root.querySelectorAll<HTMLElement>("*")).find(
            (el) =>
              el.scrollHeight > el.clientHeight + 4 &&
              /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
              el.contains(frame),
          ) ?? null;
      }
      if (!state.tracked.isConnected) {
        const candidates = Array.from(
          state.root.querySelectorAll<HTMLElement>(state.trackSelector),
        );
        const rehomed =
          (state.trackedKey != null
            ? candidates.find(
                (el) =>
                  (el.getAttribute("data-page") ??
                    el.getAttribute("data-page-number") ??
                    el.getAttribute("data-slide")) === state.trackedKey,
              )
            : undefined) ?? candidates[state.trackedIndex];
        if (rehomed) state.tracked = rehomed;
      }
      const rect = state.tracked.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      const scrollerRect = state.scroller?.getBoundingClientRect();
      const markerY = scrollerRect
        ? scrollerRect.top +
          (state.scroller?.clientHeight ?? 0) * state.markerFraction
        : state.markerYFallback;
      const x =
        state.align === "center" ? rect.left + rect.width / 2 : rect.left;
      return {
        y: rect.top + state.contentAtMarker * rect.height - markerY,
        x: x - state.x0,
      };
    });
    if (sample) {
      positions.push(sample.y);
      positionsX.push(sample.x);
    }
  }
  if (positions.length === 0) {
    throw new Error(
      "reading-line resize trace: tracked element never resolvable",
    );
  }
  await page.setViewportSize(viewport);
  await page.waitForTimeout(settleMs);
  return { positions, positionsX };
}
