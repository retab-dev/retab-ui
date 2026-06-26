import { expect, test, type Page } from "@playwright/test";

type FileViewerLayoutSample = {
  canvasBitmapWidth: number | null;
  canvasCssWidth: number | null;
  frameRight: number | null;
  frameWidth: number | null;
  pageWidth: number | null;
  surfaceLeft: number | null;
  surfaceWidth: number | null;
};

test("FileViewer inline sidebar resizes the PDF surface without overlap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/files");

  const viewerRoot = page.locator('[data-slot="file-viewer-root"]').first();
  const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });

  await expect(viewerRoot).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    viewerRoot.locator('[data-slot="pdf-page"] canvas').first(),
  ).toHaveAttribute("data-pdf-render-status", "rendered");

  const samples = await sampleSidebarCloseTransition(page);
  const frameWidths = samples
    .map((sample) => sample.frameWidth)
    .filter((width): width is number => width !== null);
  const pageWidths = samples
    .map((sample) => sample.pageWidth)
    .filter((width): width is number => width !== null);
  const distinctFrameWidths = new Set(
    frameWidths.map((width) => Math.round(width)),
  );

  expect(frameWidths[0]).toBeGreaterThan(100);
  expect(Math.min(...frameWidths)).toBeLessThan(1);
  expect(distinctFrameWidths.size).toBeGreaterThan(4);
  expect(isMonotonic(frameWidths, "decreasing")).toBe(true);
  expect(isMonotonic(pageWidths, "increasing")).toBe(true);

  for (const sample of samples) {
    expect(edgeDelta(sample)).toBeLessThan(1.5);
    expect(overlapWidth(sample)).toBeLessThan(1);
  }

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>(
            '[data-slot="file-viewer-root"] [data-slot="pdf-page"] canvas',
          );
          const canvasRect = canvas?.getBoundingClientRect();

          if (!canvas || !canvasRect) return false;

          return canvas.width >= canvasRect.width - 1;
        }),
      {
        message: "PDF canvas bitmap width should catch up after resize settles",
      },
    )
    .toBe(true);
});

async function sampleSidebarCloseTransition(page: Page) {
  return page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>(
      '[data-slot="file-viewer-root"]',
    );
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );

    if (!root || !trigger) {
      throw new Error("FileViewer sidebar trigger is not mounted.");
    }

    if (root.dataset.viewerSidebarOpen !== "true") {
      trigger.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
    }

    const readSample = (): FileViewerLayoutSample => {
      const frame = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar"]',
      );
      const surface = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-surface"]',
      );
      const pageElement = root.querySelector<HTMLElement>(
        '[data-slot="pdf-page"]',
      );
      const canvas = root.querySelector<HTMLCanvasElement>(
        '[data-slot="pdf-page"] canvas',
      );
      const frameRect = frame?.getBoundingClientRect();
      const surfaceRect = surface?.getBoundingClientRect();
      const pageRect = pageElement?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();

      return {
        canvasBitmapWidth: canvas?.width ?? null,
        canvasCssWidth: canvasRect?.width ?? null,
        frameRight: frameRect?.right ?? null,
        frameWidth: frameRect?.width ?? null,
        pageWidth: pageRect?.width ?? null,
        surfaceLeft: surfaceRect?.left ?? null,
        surfaceWidth: surfaceRect?.width ?? null,
      };
    };

    const samples: FileViewerLayoutSample[] = [];
    trigger.click();

    for (let index = 0; index < 16; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(readSample());
    }

    return samples;
  });
}

function edgeDelta(sample: FileViewerLayoutSample) {
  if (sample.frameRight === null || sample.surfaceLeft === null) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(sample.frameRight - sample.surfaceLeft);
}

function overlapWidth(sample: FileViewerLayoutSample) {
  if (sample.frameRight === null || sample.surfaceLeft === null) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, sample.frameRight - sample.surfaceLeft);
}

function isMonotonic(values: number[], direction: "decreasing" | "increasing") {
  return values.every((value, index) => {
    if (index === 0) return true;

    const previous = values[index - 1];
    return direction === "decreasing"
      ? value <= previous + 1
      : value >= previous - 1;
  });
}
