import { expect, test, type Page } from "@playwright/test";

// The destination gate the motion telemetry was missing: every smoothness
// metric verifies the JOURNEY (continuity, easing, pixels), none verified the
// slide arrives at the right place. This gate scrolls the document, toggles
// the sidebar, and asserts the CONTENT at the format's pinned reading line is
// still there at settle. Image pins the viewport top (linear content); DOCX
// pins the reading marker 20% down (paginated anchor) — each format is probed
// at the line its rebase promises to hold.
// The geometry matters: the document must overflow its viewport, and the
// scroll position must be non-zero — at scrollTop 0 every rebase bug
// multiplies out to zero, which is how one shipped unseen.
test.use({ deviceScaleFactor: 2, viewport: { width: 1720, height: 880 } });

const DRIFT_BUDGET_PX = 14;

type MarkerProbe = {
  drift: number;
  scrollTop: number;
};

async function readMarkerDriftAfter(
  page: Page,
  frameSelector: string,
  markerRatio: number,
  action: () => Promise<void>,
): Promise<MarkerProbe> {
  const before = await page.evaluate(
    ({ frameSelector, markerRatio }) => {
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
          el.scrollHeight > el.clientHeight + 10 &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
          el.contains(frame),
      )!;
      const scrollerRect = scroller.getBoundingClientRect();
      const markerY = scrollerRect.top + scroller.clientHeight * markerRatio;
      const rect = frame.getBoundingClientRect();
      return {
        markerY,
        contentAtMarker: (markerY - rect.top) / rect.height,
      };
    },
    { frameSelector, markerRatio },
  );

  await action();

  return page.evaluate(
    ({ frameSelector, before }) => {
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
          el.scrollHeight > el.clientHeight + 10 &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
          el.contains(frame),
      )!;
      const rect = frame.getBoundingClientRect();
      const markerScreenNow = rect.top + before.contentAtMarker * rect.height;
      return {
        drift: markerScreenNow - before.markerY,
        scrollTop: scroller.scrollTop,
      };
    },
    { frameSelector, before },
  );
}

for (const format of [
  {
    name: "Image",
    readySelector: '[data-slot="image-viewer-document"] canvas',
    frameSelector: '[data-slot="image-frame"]',
    scrollTo: "max" as const,
    markerRatio: 0,
  },
  {
    name: "DOCX",
    readySelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    frameSelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    scrollTo: 300 as const,
    markerRatio: 0.2,
  },
] as const) {
  test(`${format.name} sidebar toggle keeps the reading marker content`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/examples/sources-viewer");
    await page.getByRole("tab", { name: format.name }).click();
    await expect(page.locator(format.readySelector).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);

    await page.evaluate(
      ({ frameSelector, scrollTo }) => {
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
            el.scrollHeight > el.clientHeight + 10 &&
            /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
            frame != null &&
            el.contains(frame),
        );
        if (!scroller) throw new Error("document does not overflow");
        scroller.scrollTop =
          scrollTo === "max" ? scroller.scrollHeight : scrollTo;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      },
      { frameSelector: format.frameSelector, scrollTo: format.scrollTo },
    );
    await page.waitForTimeout(700);

    const viewerRoot = page
      .locator('[data-slot="file-viewer-root"]:visible')
      .first();
    const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });

    for (const action of ["close", "open"] as const) {
      const probe = await readMarkerDriftAfter(
        page,
        format.frameSelector,
        format.markerRatio,
        async () => {
          await trigger.click();
          await page.waitForTimeout(900);
        },
      );
      expect(
        Math.abs(probe.drift),
        `${action}: content under the reading marker drifted ${probe.drift.toFixed(1)}px (scrollTop ${probe.scrollTop.toFixed(1)})`,
      ).toBeLessThanOrEqual(DRIFT_BUDGET_PX);
    }
  });
}
