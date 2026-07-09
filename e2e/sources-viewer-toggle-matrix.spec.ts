import { expect, test, type Page } from "@playwright/test";

// Geometry-sweep matrix for the sources viewer sidebar toggle. Traces the
// screen trajectory of the content at the format's pinned reading line
// through BOTH toggle directions, across viewport sizes and scroll depths.
//
// Three numbers per run:
// - settleDrift: where the reading-line content ends vs where it started
//   (destination correctness);
// - corridor: how far it strays from its start DURING the slide (flight
//   correctness — a slide that carries the content away and back scores
//   high here even if the destination is perfect);
// - excursion: corridor minus |net displacement| — the literal
//   back-and-forth number, ~0 for a slide that goes one way and stays.
//
// Survey mode (MATRIX_SURVEY=1) prints every run without failing, for
// calibration. Gate mode asserts the budgets.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const SETTLE_DRIFT_BUDGET_PX = 14;
const EXCURSION_BUDGET_PX = 16;
// A rapid retarget travels toward the target before reversing; its excursion
// is bounded by how far one 60ms leg gets, not by the full corridor budget.
const RAPID_EXCURSION_BUDGET_PX = 220;

// The two heights that discriminated during calibration: the in-flight
// clamp-drag only appeared at viewports >= 1000px tall (deeper max scroll).
// Add widths/heights here when a new geometry-dependent report arrives.
const VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 2000, height: 1250 },
] as const;

const SCROLLS = ["zero", "quarter", "half", "max"] as const;

const FORMATS = [
  {
    name: "Image",
    readySelector: '[data-slot="image-viewer-document"] canvas',
    frameSelector: '[data-slot="image-frame"]',
    trackSelector: '[data-slot="image-frame"]',
    markerRatio: 0,
  },
  {
    name: "DOCX",
    readySelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    frameSelector: '[data-slot="docx-viewer"] .docx-wrapper',
    // Track the PAGE under the marker, not the wrapper: the wrapper is the
    // virtualization window, and its box changes when pages mount/unmount
    // at settle — tracking it reads window churn as content drift.
    trackSelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    markerRatio: 0.2,
  },
] as const;

type ToggleTrace = {
  scrollBefore: number;
  scrollAfter: number;
  settleDrift: number;
  corridor: number;
  excursion: number;
  samples: number;
};

async function traceToggle(
  page: Page,
  frameSelector: string,
  trackSelector: string,
  markerRatio: number,
  rapid = false,
): Promise<ToggleTrace> {
  return page.evaluate(
    async ({ frameSelector, trackSelector, markerRatio, rapid }) => {
      const root = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-slot="file-viewer-root"]',
        ),
      ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
      const trigger = root.querySelector<HTMLButtonElement>(
        '[data-slot="file-viewer-sidebar-trigger"]',
      )!;
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
      // Track the page/frame whose box contains the reading line — it stays
      // mounted (it is visible) while virtualization windows churn around it.
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
      // The content coordinate (as a fraction of the frame) sitting at the
      // reading line before the toggle. Its screen position is the tracked
      // trajectory: rigid content ⇒ this stays at markerY the whole flight.
      const contentAtMarker = (markerY - rect0.top) / rect0.height;
      const scrollBefore = scroller?.scrollTop ?? 0;

      const positions: number[] = [];
      trigger.click();
      if (rapid) {
        // Interrupt the slide mid-flight: the retarget must carry the
        // reading line straight back home.
        await new Promise((resolve) => setTimeout(resolve, 60));
        trigger.click();
      }
      for (let index = 0; index < 90; index += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const rect = tracked.getBoundingClientRect();
        positions.push(rect.top + contentAtMarker * rect.height - markerY);
      }

      const settleDrift = positions.at(-1) ?? 0;
      let corridor = 0;
      for (const position of positions) {
        corridor = Math.max(corridor, Math.abs(position));
      }
      return {
        scrollBefore,
        scrollAfter: scroller?.scrollTop ?? 0,
        settleDrift,
        corridor,
        excursion: corridor - Math.abs(settleDrift),
        samples: positions.length,
      };
    },
    { frameSelector, trackSelector, markerRatio, rapid },
  );
}

for (const viewport of VIEWPORTS) {
  for (const format of FORMATS) {
    test(`${format.name} toggle trajectory at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(300_000);
      await page.setViewportSize(viewport);
      await page.goto("/examples/sources-viewer");
      await page.getByRole("tab", { name: format.name }).click();
      await expect(page.locator(format.readySelector).first()).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(1_500);

      const failures: string[] = [];
      for (const scroll of SCROLLS) {
        const scrolled = await page.evaluate(
          ({ frameSelector, scroll }) => {
            const root = Array.from(
              document.querySelectorAll<HTMLElement>(
                '[data-slot="file-viewer-root"]',
              ),
            ).find(
              (candidate) => candidate.getBoundingClientRect().width > 0,
            )!;
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
          { frameSelector: format.frameSelector, scroll },
        );
        if (!scrolled) continue;
        await page.waitForTimeout(600);

        for (const action of ["close", "open", "rapid"] as const) {
          // At scroll 0 every format pins the document TOP (the clamp
          // permits nothing else), so that is the line to probe there;
          // deeper, each format pins its own reading line.
          const trace = await traceToggle(
            page,
            format.frameSelector,
            format.trackSelector,
            scroll === "zero" ? 0 : format.markerRatio,
            action === "rapid",
          );
          await page.waitForTimeout(500);
          const line = `${format.name} ${viewport.width}x${viewport.height} scroll=${scroll} ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} excursion=${trace.excursion.toFixed(1)} (scroll ${trace.scrollBefore.toFixed(0)}->${trace.scrollAfter.toFixed(0)})`;
          console.log(`MATRIX ${line}`);
          // A rapid retarget legitimately travels toward the target before
          // reversing home, so its corridor is motion, not error: gate its
          // DESTINATION strictly and its excursion loosely (it must come
          // back without wild swings beyond the two legs).
          const excursionBudget =
            action === "rapid"
              ? RAPID_EXCURSION_BUDGET_PX
              : EXCURSION_BUDGET_PX;
          if (
            Math.abs(trace.settleDrift) > SETTLE_DRIFT_BUDGET_PX ||
            trace.excursion > excursionBudget
          ) {
            failures.push(line);
          }
        }
      }

      if (!SURVEY) {
        expect(failures, failures.join("\n")).toEqual([]);
      }
    });
  }
}
