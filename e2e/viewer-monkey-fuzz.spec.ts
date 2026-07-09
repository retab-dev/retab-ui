import { expect, test } from "@playwright/test";

import {
  installConsoleSentinel,
  setViewerScroll,
} from "./helpers/reading-line-trace";

// Seeded monkey fuzzer: random interleavings of every viewer interaction —
// toggle, wheel, scroll jump, zoom, rapid double-toggle, and format
// switching (which unmounts a viewer mid-anything, the one transition no
// scripted matrix covers). The invariants are the ones the rest of the
// suite already trusts:
//   1. zero page errors and zero console errors/warnings;
//   2. the active document stays attached and visible at the end;
//   3. the shell's resource census stays bounded vs its baseline;
//   4. the GC'd JS heap returns near its baseline (chromium only) —
//      retained closures, listeners, and detached subtrees are invisible
//      to the DOM census but survive a forced garbage collection.
//
// The seed prints on every run — a failure line carries everything needed
// to replay it exactly: MONKEY_SEED=<n> pnpm verify:viewer-monkey-fuzz.

const SEED = Number(process.env.MONKEY_SEED ?? 20260709);
const ACTION_COUNT = Number(process.env.MONKEY_ACTIONS ?? 40);
const NODE_GROWTH_BUDGET = 120;
const CANVAS_PIXEL_GROWTH_RATIO = 1.6;
// Post-GC heap vs post-GC baseline. Renderer caches (pdf.js, raster
// stores, docx-preview stylesheets) legitimately survive GC, so the
// budget bounds growth, not equality. Survey: 14MB baseline plateaus at
// ~28MB whether the run is 40 actions or 120 — a one-time warm-up step,
// not per-action retention. A leak scales with the action count and
// walks through this ceiling.
const HEAP_GROWTH_RATIO = 1.8;
const HEAP_GROWTH_FLOOR_BYTES = 64 * 1024 * 1024;

test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 1000 } });

// Mulberry32 — tiny, deterministic, good enough for action sequencing.
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FORMATS = ["image", "docx", "pptx", "markdown", "text"] as const;

const READY: Record<(typeof FORMATS)[number], string> = {
  image:
    '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
  docx: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
  pptx: '[data-slot="pptx-slide"]',
  markdown: '[data-slot="markdown-virtual-canvas"]',
  text: '[data-slot="text-virtual-canvas"]',
};

const FRAME: Record<(typeof FORMATS)[number], string> = {
  image: '[data-slot="image-frame"]',
  docx: '[data-slot="docx-viewer"] .docx-wrapper',
  pptx: '[data-slot="pptx-slide"]',
  markdown: '[data-slot="markdown-virtual-canvas"]',
  text: '[data-slot="text-virtual-canvas"]',
};

test("seeded monkey run stays error-free and bounded", async ({
  page,
  browserName,
}) => {
  test.setTimeout(420_000);
  const sentinel = installConsoleSentinel(page, {
    expect: (errors) =>
      expect(errors, `console/page errors during monkey run:\n${errors.join("\n")}`).toEqual([]),
  });

  await page.goto("/view/file-viewer-sidebar-benchmark");
  await page.waitForTimeout(1_200);

  const census = () =>
    page.evaluate(() => {
      const root = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-slot="file-viewer-root"]',
        ),
      ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
      const canvases = Array.from(root.querySelectorAll("canvas"));
      return {
        nodes: root.querySelectorAll("*").length,
        canvasPixels: canvases.reduce(
          (sum, canvas) => sum + canvas.width * canvas.height,
          0,
        ),
      };
    });

  const rng = createRng(SEED);
  const pick = <T,>(items: readonly T[]) =>
    items[Math.floor(rng() * items.length)];

  let currentFormat: (typeof FORMATS)[number] = "image";
  await page
    .locator(`[data-benchmark-format-option="${currentFormat}"]`)
    .click();
  await expect(page.locator(READY[currentFormat]).first()).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForTimeout(800);
  const baseline = await census();

  // GC'd-heap reading: force a real collection first, or the number is
  // dominated by whatever garbage happens to be pending. CDP-only.
  const cdp =
    browserName === "chromium"
      ? await page.context().newCDPSession(page)
      : null;
  const heapAfterGC = async () => {
    if (!cdp) return null;
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(300);
    await cdp.send("HeapProfiler.collectGarbage");
    const { usedSize } = (await cdp.send("Runtime.getHeapUsage")) as {
      usedSize: number;
    };
    return usedSize;
  };
  const heapBaseline = await heapAfterGC();

  const viewerRoot = page
    .locator('[data-slot="file-viewer-root"]:visible')
    .first();
  const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });
  const actionLog: string[] = [];

  for (let index = 0; index < ACTION_COUNT; index += 1) {
    const action = pick([
      "toggle",
      "toggle",
      "rapid",
      "wheel",
      "wheel",
      "scrollJump",
      "zoomIn",
      "zoomOut",
      "switchFormat",
      "pause",
    ] as const);
    actionLog.push(action);
    try {
      switch (action) {
        case "toggle":
          await trigger.click();
          await page.waitForTimeout(60 + Math.floor(rng() * 500));
          break;
        case "rapid":
          await trigger.click();
          await page.waitForTimeout(30 + Math.floor(rng() * 90));
          await trigger.click();
          await page.waitForTimeout(60 + Math.floor(rng() * 400));
          break;
        case "wheel":
          await page.locator(FRAME[currentFormat]).first().hover();
          await page.mouse.wheel(0, Math.floor(rng() * 900) - 300);
          await page.waitForTimeout(40 + Math.floor(rng() * 200));
          break;
        case "scrollJump":
          await setViewerScroll(page, FRAME[currentFormat], rng());
          await page.waitForTimeout(40 + Math.floor(rng() * 200));
          break;
        case "zoomIn":
        case "zoomOut": {
          const zoom = viewerRoot.getByRole("button", {
            name: action === "zoomIn" ? "Zoom in" : "Zoom out",
          });
          if (await zoom.isVisible().catch(() => false)) {
            if (await zoom.isEnabled().catch(() => false)) {
              await zoom.click();
            }
          }
          await page.waitForTimeout(60 + Math.floor(rng() * 200));
          break;
        }
        case "switchFormat": {
          // Deliberately allowed to land mid-flight: unmount-during-motion
          // is the transition no scripted matrix exercises.
          const next = pick(FORMATS.filter((f) => f !== currentFormat));
          await page
            .locator(`[data-benchmark-format-option="${next}"]`)
            .click();
          currentFormat = next;
          await expect(page.locator(READY[next]).first()).toBeVisible({
            timeout: 60_000,
          });
          await page.waitForTimeout(150 + Math.floor(rng() * 300));
          break;
        }
        case "pause":
          await page.waitForTimeout(200 + Math.floor(rng() * 600));
          break;
      }
    } catch (error) {
      throw new Error(
        `monkey action #${index} (${action}) failed with seed ${SEED}; log: ${actionLog.join(",")}\n${String(error)}`,
      );
    }
  }

  // settle tail, then the invariants
  await page.waitForTimeout(2_000);
  console.log(`MONKEY seed=${SEED} actions=${actionLog.join(",")}`);

  await expect(
    page.locator(FRAME[currentFormat]).first(),
    "active document detached after the monkey run",
  ).toBeVisible();

  // Bound resources against the run's own start. Format switches mount
  // different renderers, so the budget is loose — it exists to catch
  // unbounded growth, not byte equality.
  const after = await census();
  console.log(
    `MONKEY census nodes ${baseline.nodes}->${after.nodes} pixels ${baseline.canvasPixels}->${after.canvasPixels}`,
  );
  expect(after.nodes - baseline.nodes).toBeLessThanOrEqual(
    NODE_GROWTH_BUDGET,
  );
  if (baseline.canvasPixels > 0) {
    expect(after.canvasPixels).toBeLessThanOrEqual(
      Math.max(baseline.canvasPixels * CANVAS_PIXEL_GROWTH_RATIO, 40_000_000),
    );
  }

  const heapAfter = await heapAfterGC();
  if (heapBaseline != null && heapAfter != null) {
    console.log(
      `MONKEY heap ${(heapBaseline / 1e6).toFixed(1)}MB->${(heapAfter / 1e6).toFixed(1)}MB (gc'd)`,
    );
    expect(
      heapAfter,
      `GC'd heap grew ${((heapAfter - heapBaseline) / 1e6).toFixed(1)}MB over the run — retained closures/listeners the DOM census cannot see`,
    ).toBeLessThanOrEqual(
      Math.max(
        heapBaseline * HEAP_GROWTH_RATIO,
        heapBaseline + HEAP_GROWTH_FLOOR_BYTES,
      ),
    );
  }

  sentinel.assertClean();
});
