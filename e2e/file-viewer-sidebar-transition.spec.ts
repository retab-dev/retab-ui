import { expect, test, type Page } from "@playwright/test";

type FileViewerLayoutSample = {
  canvasBitmapWidth: number | null;
  canvasCssWidth: number | null;
  documentFrameLeft: number | null;
  documentFrameWidth: number | null;
  pageWidth: number | null;
  sidebarGapRight: number | null;
  sidebarGapWidth: number | null;
};

type PdfSidebarToggleSample = {
  mountedPages: string;
  pageHeight: number | null;
  pageStyleWidth: number | null;
  pageWidth: number | null;
  scrollTop: number;
  sidebarGapWidth: number | null;
  transform: string | null;
  zoomText: string | null;
};

type SourcesImageToggleSample = {
  canvasCount: number;
  canvasId: number | null;
  canvasWidth: number | null;
  documentHeight: number | null;
  rendered: boolean;
};

type SourcesTextToggleSample = {
  canvasWidth: number | null;
  scrollTop: number;
  viewportWidth: number;
};

type SourcesDocxToggleSample = {
  documentFrameWidth: number | null;
  mountedPages: string;
  scrollTop: number;
  sidebarGapWidth: number | null;
  transform: string | null;
  zoom: number | null;
};

type PptxSidebarToggleSample = {
  canvasHeight: number | null;
  canvasMinWidth: number | null;
  mountedSlides: string;
  scrollTop: number;
  sidebarGapWidth: number | null;
  transform: string | null;
  viewportWidth: number;
};

type MarkdownSidebarToggleSample = {
  canvasHeight: number | null;
  canvasMinWidth: number | null;
  measuredHeightKeys: string;
  mountedChunks: string;
  scrollTop: number;
  sidebarGapWidth: number | null;
  transform: string | null;
  viewportWidth: number;
};

test("FileViewer inline sidebar resizes the PDF document frame without overlap", async ({
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
  const gapWidths = samples
    .map((sample) => sample.sidebarGapWidth)
    .filter((width): width is number => width !== null);
  const pageWidths = samples
    .map((sample) => sample.pageWidth)
    .filter((width): width is number => width !== null);

  expect(Math.max(...gapWidths) - Math.min(...gapWidths)).toBeGreaterThan(20);
  expect(Math.min(...gapWidths)).toBeLessThan(1);
  expect(isMonotonic(gapWidths, "decreasing")).toBe(true);
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

test("PDF keeps scroll identity stable while FileViewer sidebar slides", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/files");

  const viewerRoot = page.locator('[data-slot="file-viewer-root"]').first();
  await expect(viewerRoot).toBeVisible();
  await expect(
    viewerRoot.locator('[data-slot="pdf-page"] canvas').first(),
  ).toHaveAttribute("data-pdf-render-status", "rendered");

  const {
    beforeScrollTop,
    closeSamples,
    openSamples,
    settledClose,
    settledOpen,
  } = await samplePdfSidebarToggle(page);
  const closeSlidingSamples = closeSamples.filter(isDocumentSurfaceScaled);
  const openSlidingSamples = openSamples.filter(isDocumentSurfaceScaled);

  expect(beforeScrollTop).toBeGreaterThan(0);
  expect(closeSamples.length).toBeGreaterThan(4);
  expect(openSamples.length).toBeGreaterThan(4);
  expect(closeSlidingSamples.length).toBeGreaterThanOrEqual(4);
  expect(openSlidingSamples.length).toBeGreaterThanOrEqual(4);

  expect(
    distinctRoundedValues(closeSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);
  expect(
    distinctRoundedValues(openSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);

  expect(distinctRoundedValues(closeSlidingSamples, "scrollTop").size).toBe(1);
  expect(
    distinctRoundedValues(closeSlidingSamples, "pageStyleWidth").size,
  ).toBe(1);
  expect(distinctStringValues(closeSlidingSamples, "zoomText").size).toBe(1);
  expect(
    distinctRoundedValues(closeSlidingSamples, "pageWidth").size,
  ).toBeGreaterThan(1);
  expect(
    distinctRoundedValues(closeSlidingSamples, "pageHeight").size,
  ).toBeGreaterThan(1);
  expect(distinctStringValues(closeSlidingSamples, "mountedPages").size).toBe(
    1,
  );

  expect(distinctRoundedValues(openSlidingSamples, "scrollTop").size).toBe(1);
  expect(distinctRoundedValues(openSlidingSamples, "pageStyleWidth").size).toBe(
    1,
  );
  expect(distinctStringValues(openSlidingSamples, "zoomText").size).toBe(1);
  expect(
    distinctRoundedValues(openSlidingSamples, "pageWidth").size,
  ).toBeGreaterThan(1);
  expect(
    distinctRoundedValues(openSlidingSamples, "pageHeight").size,
  ).toBeGreaterThan(1);
  expect(distinctStringValues(openSlidingSamples, "mountedPages").size).toBe(1);

  expect(Math.round(settledClose.pageWidth ?? 0)).not.toBe(
    Math.round(closeSamples[0]?.pageWidth ?? 0),
  );
  expect(Math.round(settledClose.scrollTop)).not.toBe(
    Math.round(beforeScrollTop),
  );
  expect(Math.round(settledOpen.scrollTop)).toBe(Math.round(beforeScrollTop));
  expect(
    Math.max(...compactNumbers(closeSamples, "pageWidth")),
  ).toBeLessThanOrEqual((settledClose.pageWidth ?? 0) + 1);
  expect(
    Math.min(...compactNumbers(openSamples, "pageWidth")),
  ).toBeGreaterThanOrEqual((settledOpen.pageWidth ?? 0) - 1);
});

test("Sources Viewer image and text renderers keep document identity during sidebar toggle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/examples/sources-viewer");

  await page.getByRole("tab", { name: "Image" }).click();
  await expect(
    page.locator('[data-slot="image-viewer-document"] canvas'),
  ).toHaveAttribute("data-image-frame-rendered", "true");

  const imageSamples = await sampleSourcesImageSidebarToggle(page);
  const imageCanvasIds = new Set(
    imageSamples
      .map((sample) => sample.canvasId)
      .filter((canvasId): canvasId is number => canvasId !== null),
  );

  expect(imageCanvasIds.size).toBe(1);
  expect(imageSamples.every((sample) => sample.canvasCount === 1)).toBe(true);
  expect(imageSamples.every((sample) => sample.rendered)).toBe(true);
  expect(
    distinctRoundedValues(imageSamples, "canvasWidth").size,
  ).toBeGreaterThan(1);

  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.locator('[data-slot="text-virtual-canvas"]')).toBeVisible();

  const { beforeScrollTop, samples: textSamples } =
    await sampleSourcesTextSidebarToggle(page);

  expect(beforeScrollTop).toBeGreaterThan(0);
  expect(
    textSamples.every((sample) => sample.scrollTop === beforeScrollTop),
  ).toBe(true);
  expect(distinctRoundedValues(textSamples, "canvasWidth").size).toBe(1);
  expect(
    distinctRoundedValues(textSamples, "viewportWidth").size,
  ).toBeGreaterThan(4);
});

// Commit-then-relax: the DOCX layout commits its TARGET zoom inside the
// toggle's own task — the first sampled frame already holds the settled value
// and nothing re-lays-out at settle.
test("Sources Viewer DOCX commits the target layout at slide start", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/examples/sources-viewer");

  await page.getByRole("tab", { name: "DOCX" }).click();
  await expect(
    page
      .locator('[data-slot="docx-viewer"] .docx-wrapper > section.docx')
      .first(),
  ).toBeVisible({ timeout: 30_000 });

  const {
    beforeScrollTop,
    closeSamples,
    openSamples,
    settledClose,
    settledOpen,
  } = await sampleSourcesDocxSidebarToggle(page);

  expect(beforeScrollTop).toBeGreaterThan(0);
  expect(closeSamples.length).toBeGreaterThan(4);
  expect(openSamples.length).toBeGreaterThan(4);

  expect(
    distinctRoundedValues(closeSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);
  expect(
    distinctRoundedValues(openSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);

  expect(distinctScaledValues(closeSamples, "zoom", 1000).size).toBe(1);
  expect(distinctRoundedValues(closeSamples, "scrollTop").size).toBe(1);
  expect(distinctStringValues(closeSamples, "mountedPages").size).toBe(1);

  expect(distinctScaledValues(openSamples, "zoom", 1000).size).toBe(1);
  expect(distinctRoundedValues(openSamples, "scrollTop").size).toBe(1);
  expect(distinctStringValues(openSamples, "mountedPages").size).toBe(1);

  // The first sampled frame already carries the settled zoom; settle changes
  // nothing.
  expect(Math.round((settledClose.zoom ?? 0) * 1000)).toBe(
    Math.round((closeSamples[0]?.zoom ?? 0) * 1000),
  );
  // The toggle really re-fits: the two settled states differ.
  expect(Math.round((settledClose.zoom ?? 0) * 1000)).not.toBe(
    Math.round((settledOpen.zoom ?? 0) * 1000),
  );
});

// Commit-then-relax: the PPTX slide layout commits its TARGET width inside
// the toggle's own task; the surface transform reprojects it mid-slide and
// terminates on identity, so settle changes nothing.
test("PPTX commits the target slide layout at slide start", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/view/pptx-sidebar-transition");
  await expect(page.locator('[data-slot="pptx-slide"]').first()).toBeVisible({
    timeout: 30_000,
  });

  const {
    beforeScrollTop,
    closeSamples,
    openSamples,
    settledClose,
    settledOpen,
  } = await samplePptxSidebarToggle(page);

  expect(beforeScrollTop).toBeGreaterThan(0);
  expect(closeSamples.length).toBeGreaterThan(4);
  expect(openSamples.length).toBeGreaterThan(4);

  expect(
    distinctRoundedValues(closeSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);
  expect(
    distinctRoundedValues(openSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);

  expect(distinctRoundedValues(closeSamples, "canvasMinWidth").size).toBe(1);
  expect(distinctRoundedValues(closeSamples, "canvasHeight").size).toBe(1);
  expect(distinctRoundedValues(closeSamples, "scrollTop").size).toBe(1);
  expect(distinctStringValues(closeSamples, "mountedSlides").size).toBe(1);
  expect(
    closeSamples.some(
      (sample) => sample.transform !== null && sample.transform !== "none",
    ),
  ).toBe(true);

  expect(distinctRoundedValues(openSamples, "canvasMinWidth").size).toBe(1);
  expect(distinctRoundedValues(openSamples, "canvasHeight").size).toBe(1);
  expect(distinctRoundedValues(openSamples, "scrollTop").size).toBe(1);
  expect(distinctStringValues(openSamples, "mountedSlides").size).toBe(1);
  expect(
    openSamples.some(
      (sample) => sample.transform !== null && sample.transform !== "none",
    ),
  ).toBe(true);

  // The first sampled frame already carries the settled slide width; settle
  // changes nothing — but the toggle really re-fits between states.
  expect(Math.round(settledClose.canvasMinWidth ?? 0)).toBe(
    Math.round(closeSamples[0]?.canvasMinWidth ?? 0),
  );
  expect(Math.round(settledClose.canvasMinWidth ?? 0)).not.toBe(
    Math.round(settledOpen.canvasMinWidth ?? 0),
  );
});

// Commit-then-relax: Markdown re-wraps once at slide start (text reflow is
// not geometrically scalable, so it takes no transform) and holds that
// settled layout through the motion.
test("Markdown commits the target document layout at slide start", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/view/markdown-sidebar-transition");
  await expect(
    page.locator('[data-slot="markdown-virtual-canvas"]'),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[data-markdown-chunk]").first()).toBeVisible({
    timeout: 30_000,
  });

  const {
    beforeScrollTop,
    closeSamples,
    openSamples,
    settledClose,
    settledOpen,
  } = await sampleMarkdownSidebarToggle(page);

  expect(beforeScrollTop).toBeGreaterThan(0);
  expect(closeSamples.length).toBeGreaterThan(4);
  expect(openSamples.length).toBeGreaterThan(4);

  expect(
    distinctRoundedValues(closeSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);
  expect(
    distinctRoundedValues(openSamples, "sidebarGapWidth").size,
  ).toBeGreaterThan(4);

  expect(distinctRoundedValues(closeSamples, "canvasMinWidth").size).toBe(1);
  expect(distinctRoundedValues(closeSamples, "canvasHeight").size).toBe(1);
  expect(distinctRoundedValues(closeSamples, "scrollTop").size).toBe(1);
  expect(distinctStringValues(closeSamples, "mountedChunks").size).toBe(1);
  expect(distinctStringValues(closeSamples, "measuredHeightKeys").size).toBe(1);
  expect(
    distinctRoundedValues(closeSamples, "viewportWidth").size,
  ).toBeGreaterThan(4);

  expect(distinctRoundedValues(openSamples, "canvasMinWidth").size).toBe(1);
  expect(distinctRoundedValues(openSamples, "canvasHeight").size).toBe(1);
  expect(distinctRoundedValues(openSamples, "scrollTop").size).toBe(1);
  expect(distinctStringValues(openSamples, "mountedChunks").size).toBe(1);
  expect(distinctStringValues(openSamples, "measuredHeightKeys").size).toBe(1);
  expect(
    distinctRoundedValues(openSamples, "viewportWidth").size,
  ).toBeGreaterThan(4);

  // The first sampled frame already carries the settled canvas width; settle
  // changes nothing — but the toggle really re-wraps between states.
  expect(Math.round(settledClose.canvasMinWidth ?? 0)).toBe(
    Math.round(closeSamples[0]?.canvasMinWidth ?? 0),
  );
  expect(Math.round(settledClose.canvasMinWidth ?? 0)).not.toBe(
    Math.round(settledOpen.canvasMinWidth ?? 0),
  );
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

    if (root.dataset.fileViewerSidebarOpen !== "true") {
      trigger.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
    }

    const readSample = (): FileViewerLayoutSample => {
      const sidebarGap = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar-gap"]',
      );
      const documentFrame = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-document-frame"]',
      );
      const pageElement = root.querySelector<HTMLElement>(
        '[data-slot="pdf-page"]',
      );
      const canvas = root.querySelector<HTMLCanvasElement>(
        '[data-slot="pdf-page"] canvas',
      );
      const sidebarGapRect = sidebarGap?.getBoundingClientRect();
      const documentFrameRect = documentFrame?.getBoundingClientRect();
      const pageRect = pageElement?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();

      return {
        canvasBitmapWidth: canvas?.width ?? null,
        canvasCssWidth: canvasRect?.width ?? null,
        documentFrameLeft: documentFrameRect?.left ?? null,
        documentFrameWidth: documentFrameRect?.width ?? null,
        pageWidth: pageRect?.width ?? null,
        sidebarGapRight: sidebarGapRect?.right ?? null,
        sidebarGapWidth: sidebarGapRect?.width ?? null,
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

async function samplePdfSidebarToggle(page: Page) {
  return page.evaluate(async () => {
    const nextAnimationFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const sampleAnimationFrames = async (
      count: number,
      readSample: () => void,
    ) => {
      for (let index = 0; index < count; index += 1) {
        await nextAnimationFrame();
        readSample();
      }
    };
    const openSidebarIfNeeded = async (
      root: HTMLElement,
      trigger: HTMLButtonElement,
    ) => {
      if (root.dataset.fileViewerSidebarOpen === "true") return;
      trigger.click();
      await sampleAnimationFrames(24, () => {});
    };
    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer"]',
    );
    const root = viewer?.closest<HTMLElement>('[data-slot="file-viewer-root"]');
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );
    const viewport = viewer?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    const documentSurface = viewer?.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer-visual-stage"]',
    );

    if (!root || !trigger || !viewer || !viewport || !documentSurface) {
      throw new Error("PDF FileViewer sidebar fixture is not mounted.");
    }

    await openSidebarIfNeeded(root, trigger);

    viewport.scrollTop = Math.min(
      2600,
      Math.max(0, viewport.scrollHeight - viewport.clientHeight),
    );
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sampleAnimationFrames(3, () => {});

    const beforeScrollTop = viewport.scrollTop;
    const readSample = (): PdfSidebarToggleSample => {
      const sidebarGap = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar-gap"]',
      );
      const pageElement = viewer.querySelector<HTMLElement>(
        '[data-slot="pdf-page"]',
      );
      const sidebarGapRect = sidebarGap?.getBoundingClientRect();
      const pageRect = pageElement?.getBoundingClientRect();
      const surfaceStyle = getComputedStyle(documentSurface);
      const transform =
        documentSurface.style.transform || surfaceStyle.transform || null;
      const zoomText =
        Array.from(root.querySelectorAll<HTMLElement>("button,span,div"))
          .map((element) => element.textContent?.trim() ?? "")
          .find((text) => /^\d+%$/.test(text)) ?? null;

      return {
        mountedPages: Array.from(
          viewer.querySelectorAll<HTMLElement>('[data-slot="pdf-page-slot"]'),
        )
          .map((pageSlot) => pageSlot.dataset.pageNumber ?? "")
          .join(","),
        pageHeight: pageRect?.height ?? null,
        pageStyleWidth: pageElement
          ? Number.parseFloat(pageElement.style.width || "0")
          : null,
        pageWidth: pageRect?.width ?? null,
        scrollTop: viewport.scrollTop,
        sidebarGapWidth: sidebarGapRect?.width ?? null,
        transform,
        zoomText,
      };
    };

    const closeSamples: PdfSidebarToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(12, () => {
      closeSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledClose = readSample();

    const openSamples: PdfSidebarToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(12, () => {
      openSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledOpen = readSample();

    return {
      beforeScrollTop,
      closeSamples,
      openSamples,
      settledClose,
      settledOpen,
    };
  });
}

async function sampleSourcesImageSidebarToggle(page: Page) {
  return page.evaluate(async () => {
    const nextAnimationFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const sampleAnimationFrames = async (
      count: number,
      readSample: () => void,
    ) => {
      for (let index = 0; index < count; index += 1) {
        await nextAnimationFrame();
        readSample();
      }
    };
    const openSidebarIfNeeded = async (
      root: HTMLElement,
      trigger: HTMLButtonElement,
    ) => {
      if (root.dataset.fileViewerSidebarOpen === "true") return;
      trigger.click();
      await sampleAnimationFrames(18, () => {});
    };
    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="image-viewer"]',
    );
    const root = viewer?.closest<HTMLElement>('[data-slot="file-viewer-root"]');
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );

    if (!root || !trigger) {
      throw new Error("Sources image FileViewer is not mounted.");
    }

    await openSidebarIfNeeded(root, trigger);

    let nextCanvasId = 1;
    const canvasIds = new WeakMap<HTMLCanvasElement, number>();
    const samples: SourcesImageToggleSample[] = [];

    for (let toggleIndex = 0; toggleIndex < 2; toggleIndex += 1) {
      trigger.click();
      await sampleAnimationFrames(40, () => {
        const canvas = root.querySelector<HTMLCanvasElement>(
          '[data-slot="image-viewer-document"] canvas',
        );
        const documentElement = root.querySelector<HTMLElement>(
          '[data-slot="image-viewer-document"]',
        );

        if (canvas && !canvasIds.has(canvas)) {
          canvasIds.set(canvas, nextCanvasId);
          nextCanvasId += 1;
        }

        samples.push({
          canvasCount: root.querySelectorAll(
            '[data-slot="image-viewer-document"] canvas',
          ).length,
          canvasId: canvas ? (canvasIds.get(canvas) ?? null) : null,
          canvasWidth: canvas?.width ?? null,
          documentHeight: documentElement
            ? Number.parseFloat(documentElement.style.height || "0")
            : null,
          rendered: canvas?.dataset.imageFrameRendered === "true",
        });
      });
    }

    return samples;
  });
}

async function sampleSourcesTextSidebarToggle(page: Page) {
  return page.evaluate(async () => {
    const nextAnimationFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const sampleAnimationFrames = async (
      count: number,
      readSample: () => void,
    ) => {
      for (let index = 0; index < count; index += 1) {
        await nextAnimationFrame();
        readSample();
      }
    };
    const openSidebarIfNeeded = async (
      root: HTMLElement,
      trigger: HTMLButtonElement,
    ) => {
      if (root.dataset.fileViewerSidebarOpen === "true") return;
      trigger.click();
      await sampleAnimationFrames(18, () => {});
    };
    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="text-viewer"]',
    );
    const root = viewer?.closest<HTMLElement>('[data-slot="file-viewer-root"]');
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );
    const viewport = root?.querySelector<HTMLElement>(
      '[data-slot="text-viewer"] [data-slot="scroll-area-viewport"]',
    );
    const canvas = root?.querySelector<HTMLElement>(
      '[data-slot="text-virtual-canvas"]',
    );

    if (!root || !trigger || !viewport || !canvas) {
      throw new Error("Sources text FileViewer is not mounted.");
    }

    await openSidebarIfNeeded(root, trigger);

    viewport.scrollTop = Math.min(
      180,
      Math.max(0, viewport.scrollHeight - viewport.clientHeight),
    );
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await nextAnimationFrame();

    const beforeScrollTop = viewport.scrollTop;
    const samples: SourcesTextToggleSample[] = [];

    for (let toggleIndex = 0; toggleIndex < 2; toggleIndex += 1) {
      trigger.click();
      await sampleAnimationFrames(40, () => {
        samples.push({
          canvasWidth: Number.parseFloat(canvas.style.minWidth || "0"),
          scrollTop: viewport.scrollTop,
          viewportWidth: viewport.clientWidth,
        });
      });
    }

    return { beforeScrollTop, samples };
  });
}

async function sampleSourcesDocxSidebarToggle(page: Page) {
  return page.evaluate(async () => {
    const nextAnimationFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const sampleAnimationFrames = async (
      count: number,
      readSample: () => void,
    ) => {
      for (let index = 0; index < count; index += 1) {
        await nextAnimationFrame();
        readSample();
      }
    };
    const openSidebarIfNeeded = async (
      root: HTMLElement,
      trigger: HTMLButtonElement,
    ) => {
      if (root.dataset.fileViewerSidebarOpen === "true") return;
      trigger.click();
      await sampleAnimationFrames(24, () => {});
    };
    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"]',
    );
    const root = viewer?.closest<HTMLElement>('[data-slot="file-viewer-root"]');
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );
    const viewport = viewer?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );

    if (!root || !trigger || !viewer || !viewport) {
      throw new Error("Sources DOCX FileViewer is not mounted.");
    }

    await openSidebarIfNeeded(root, trigger);

    viewport.scrollTop = Math.min(
      1600,
      Math.max(0, viewport.scrollHeight - viewport.clientHeight),
    );
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sampleAnimationFrames(2, () => {});

    const beforeScrollTop = viewport.scrollTop;
    const readSample = (): SourcesDocxToggleSample => {
      const wrapper = viewer.querySelector<HTMLElement>(".docx-wrapper");
      const host = wrapper?.parentElement as HTMLElement | null | undefined;
      const sidebarGap = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar-gap"]',
      );
      const documentFrame = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-document-frame"]',
      );
      const sidebarGapRect = sidebarGap?.getBoundingClientRect();
      const documentFrameRect = documentFrame?.getBoundingClientRect();

      if (!host) {
        throw new Error("Sources DOCX document host is not mounted.");
      }

      const hostStyle = getComputedStyle(host);
      const transform = host.style.transform || hostStyle.transform || null;
      const zoom = Number.parseFloat(host.style.zoom || hostStyle.zoom || "1");

      return {
        documentFrameWidth: documentFrameRect?.width ?? null,
        mountedPages: Array.from(
          viewer.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx"),
        )
          .map((pageElement) => pageElement.dataset.pageNumber ?? "")
          .join(","),
        scrollTop: viewport.scrollTop,
        sidebarGapWidth: sidebarGapRect?.width ?? null,
        transform,
        zoom: Number.isFinite(zoom) ? zoom : null,
      };
    };

    const closeSamples: SourcesDocxToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(12, () => {
      closeSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledClose = readSample();

    const openSamples: SourcesDocxToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(12, () => {
      openSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledOpen = readSample();

    return {
      beforeScrollTop,
      closeSamples,
      openSamples,
      settledClose,
      settledOpen,
    };
  });
}

async function samplePptxSidebarToggle(page: Page) {
  return page.evaluate(async () => {
    const nextAnimationFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const sampleAnimationFrames = async (
      count: number,
      readSample: () => void,
    ) => {
      for (let index = 0; index < count; index += 1) {
        await nextAnimationFrame();
        readSample();
      }
    };
    const openSidebarIfNeeded = async (
      root: HTMLElement,
      trigger: HTMLButtonElement,
    ) => {
      if (root.dataset.fileViewerSidebarOpen === "true") return;
      trigger.click();
      await sampleAnimationFrames(24, () => {});
    };
    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="pptx-viewer"]',
    );
    const root = viewer?.closest<HTMLElement>('[data-slot="file-viewer-root"]');
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );
    const viewport = viewer?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    const canvas = viewer?.querySelector<HTMLElement>(
      '[data-slot="pptx-slide-virtual-canvas"]',
    );
    const surface = viewer?.querySelector<HTMLElement>(
      '[data-slot="pptx-viewer-document-surface"]',
    );

    if (!root || !trigger || !viewer || !viewport || !canvas || !surface) {
      throw new Error("PPTX FileViewer sidebar fixture is not mounted.");
    }

    await openSidebarIfNeeded(root, trigger);

    viewport.scrollTop = Math.min(
      1600,
      Math.max(0, viewport.scrollHeight - viewport.clientHeight),
    );
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sampleAnimationFrames(3, () => {});

    const beforeScrollTop = viewport.scrollTop;
    const readSample = (): PptxSidebarToggleSample => {
      const sidebarGap = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar-gap"]',
      );
      const sidebarGapRect = sidebarGap?.getBoundingClientRect();
      const canvasStyle = getComputedStyle(canvas);
      const surfaceStyle = getComputedStyle(surface);
      const transform =
        surface.style.transform || surfaceStyle.transform || null;

      return {
        canvasHeight: Number.parseFloat(canvasStyle.height || "0"),
        canvasMinWidth: Number.parseFloat(canvasStyle.minWidth || "0"),
        mountedSlides: Array.from(
          viewer.querySelectorAll<HTMLElement>('[data-slot="pptx-slide-slot"]'),
        )
          .map((slideElement) => slideElement.dataset.virtualSlideNumber ?? "")
          .join(","),
        scrollTop: viewport.scrollTop,
        sidebarGapWidth: sidebarGapRect?.width ?? null,
        transform,
        viewportWidth: viewport.clientWidth,
      };
    };

    const closeSamples: PptxSidebarToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(12, () => {
      closeSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledClose = readSample();

    const openSamples: PptxSidebarToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(12, () => {
      openSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledOpen = readSample();

    return {
      beforeScrollTop,
      closeSamples,
      openSamples,
      settledClose,
      settledOpen,
    };
  });
}

async function sampleMarkdownSidebarToggle(page: Page) {
  return page.evaluate(async () => {
    const nextAnimationFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const sampleAnimationFrames = async (
      count: number,
      readSample: () => void,
    ) => {
      for (let index = 0; index < count; index += 1) {
        await nextAnimationFrame();
        readSample();
      }
    };
    const openSidebarIfNeeded = async (
      root: HTMLElement,
      trigger: HTMLButtonElement,
    ) => {
      if (root.dataset.fileViewerSidebarOpen === "true") return;
      trigger.click();
      await sampleAnimationFrames(24, () => {});
    };
    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="text-viewer"]',
    );
    const root = viewer?.closest<HTMLElement>('[data-slot="file-viewer-root"]');
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );
    const viewport = viewer?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    const canvas = viewer?.querySelector<HTMLElement>(
      '[data-slot="markdown-virtual-canvas"]',
    );

    if (!root || !trigger || !viewer || !viewport || !canvas) {
      throw new Error("Markdown FileViewer sidebar fixture is not mounted.");
    }

    await openSidebarIfNeeded(root, trigger);
    await sampleAnimationFrames(24, () => {});

    viewport.scrollTop = Math.min(
      1800,
      Math.max(0, viewport.scrollHeight - viewport.clientHeight),
    );
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sampleAnimationFrames(6, () => {});

    const beforeScrollTop = viewport.scrollTop;
    const readSample = (): MarkdownSidebarToggleSample => {
      const sidebarGap = root.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar-gap"]',
      );
      const sidebarGapRect = sidebarGap?.getBoundingClientRect();
      const canvasStyle = getComputedStyle(canvas);
      const transform = canvas.style.transform || canvasStyle.transform || null;

      return {
        canvasHeight: Number.parseFloat(canvasStyle.height || "0"),
        canvasMinWidth: Number.parseFloat(canvasStyle.minWidth || "0"),
        measuredHeightKeys: Array.from(
          viewer.querySelectorAll<HTMLElement>(
            "[data-pretext-measured-height-key]",
          ),
        )
          .map(
            (chunkElement) =>
              chunkElement.dataset.pretextMeasuredHeightKey ?? "",
          )
          .join("|"),
        mountedChunks: Array.from(
          viewer.querySelectorAll<HTMLElement>("[data-markdown-chunk]"),
        )
          .map(
            (chunkElement) =>
              `${chunkElement.dataset.sourceStartLine ?? ""}-${chunkElement.dataset.sourceEndLine ?? ""}`,
          )
          .join(","),
        scrollTop: viewport.scrollTop,
        sidebarGapWidth: sidebarGapRect?.width ?? null,
        transform,
        viewportWidth: viewport.clientWidth,
      };
    };

    const closeSamples: MarkdownSidebarToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(8, () => {
      closeSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledClose = readSample();

    const openSamples: MarkdownSidebarToggleSample[] = [];
    trigger.click();
    await sampleAnimationFrames(8, () => {
      openSamples.push(readSample());
    });
    await sampleAnimationFrames(24, () => {});
    const settledOpen = readSample();

    return {
      beforeScrollTop,
      closeSamples,
      openSamples,
      settledClose,
      settledOpen,
    };
  });
}

function distinctRoundedValues<T>(samples: T[], key: keyof T) {
  const values: number[] = [];

  for (const sample of samples) {
    const value = sample[key];
    if (typeof value === "number") {
      values.push(Math.round(value));
    }
  }

  return new Set(values);
}

function compactNumbers<T>(samples: T[], key: keyof T) {
  const values: number[] = [];

  for (const sample of samples) {
    const value = sample[key];
    if (typeof value === "number") values.push(value);
  }

  return values;
}

function distinctScaledValues<T>(samples: T[], key: keyof T, scale: number) {
  const values: number[] = [];

  for (const sample of samples) {
    const value = sample[key];
    if (typeof value === "number") {
      values.push(Math.round(value * scale));
    }
  }

  return new Set(values);
}

function distinctStringValues<T>(samples: T[], key: keyof T) {
  const values: string[] = [];

  for (const sample of samples) {
    const value = sample[key];
    if (typeof value === "string") values.push(value);
  }

  return new Set(values);
}

function isDocumentSurfaceScaled(sample: { transform: string | null }) {
  return sample.transform !== null && sample.transform !== "none";
}

function edgeDelta(sample: FileViewerLayoutSample) {
  if (sample.sidebarGapRight === null || sample.documentFrameLeft === null) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(sample.sidebarGapRight - sample.documentFrameLeft);
}

function overlapWidth(sample: FileViewerLayoutSample) {
  if (sample.sidebarGapRight === null || sample.documentFrameLeft === null) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, sample.sidebarGapRight - sample.documentFrameLeft);
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
