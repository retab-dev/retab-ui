import type { CDPSession, Page } from "@playwright/test";

// Screen-space pixel probe: captures real composited frames over CDP while an
// action runs, then scores the painted output. This is the only detector that
// sees paint-level artifacts (compositor layer drops, canvas clear-then-draw
// windows, transform/layout desync) — DOM sampling inside rAF is always
// self-consistent and structurally cannot catch them.
export type ScreencastFrame = {
  data: string;
  elapsedMs: number;
};

export type ScreencastFrameStats = {
  changedRatio: number;
  elapsedMs: number;
  hfEnergy: number;
  inkRatio: number;
  meanAbsDiff: number;
  meanLuminance: number;
};

export type ScreencastRegion = {
  heightRatio: number;
  leftRatio: number;
  topRatio: number;
  widthRatio: number;
};

// The central document area: clear of the sidebar (max ~25% of the viewport)
// and the header chrome, so the score reflects document pixels only.
export const SCREENCAST_DOCUMENT_REGION: ScreencastRegion = {
  heightRatio: 0.68,
  leftRatio: 0.38,
  topRatio: 0.18,
  widthRatio: 0.55,
};

export async function captureScreencastDuring(
  page: Page,
  action: () => Promise<void>,
  { settleMs = 800 }: { settleMs?: number } = {},
): Promise<ScreencastFrame[]> {
  const session: CDPSession = await page.context().newCDPSession(page);
  const frames: ScreencastFrame[] = [];
  const startedAt = Date.now();

  const handleFrame = (event: {
    data: string;
    sessionId: number;
  }) => {
    frames.push({ data: event.data, elapsedMs: Date.now() - startedAt });
    void session
      .send("Page.screencastFrameAck", { sessionId: event.sessionId })
      .catch(() => {});
  };

  session.on("Page.screencastFrame", handleFrame);
  await session.send("Page.startScreencast", {
    everyNthFrame: 1,
    format: "jpeg",
    quality: 90,
  });

  try {
    await action();
    await page.waitForTimeout(settleMs);
  } finally {
    await session.send("Page.stopScreencast").catch(() => {});
    session.off("Page.screencastFrame", handleFrame);
    await session.detach().catch(() => {});
  }

  return frames;
}

export async function analyzeScreencastFrames(
  page: Page,
  frames: readonly ScreencastFrame[],
  region: ScreencastRegion = SCREENCAST_DOCUMENT_REGION,
): Promise<ScreencastFrameStats[]> {
  return page.evaluate(
    async ({ frames, region }) => {
      const stats: {
        changedRatio: number;
        elapsedMs: number;
        hfEnergy: number;
        inkRatio: number;
        meanAbsDiff: number;
        meanLuminance: number;
      }[] = [];
      const width = 160;
      const height = 120;
      let previousLuminance: Float64Array | null = null;

      for (const frame of frames) {
        const bytes = Uint8Array.from(atob(frame.data), (character) =>
          character.charCodeAt(0),
        );
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: "image/jpeg" }),
        );
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          bitmap.close();
          continue;
        }
        context.drawImage(
          bitmap,
          bitmap.width * region.leftRatio,
          bitmap.height * region.topRatio,
          bitmap.width * region.widthRatio,
          bitmap.height * region.heightRatio,
          0,
          0,
          width,
          height,
        );
        bitmap.close();

        const pixels = context.getImageData(0, 0, width, height).data;
        const luminance = new Float64Array(width * height);
        let inkCount = 0;
        let luminanceSum = 0;
        for (let index = 0; index < width * height; index += 1) {
          const value =
            pixels[index * 4] * 0.2126 +
            pixels[index * 4 + 1] * 0.7152 +
            pixels[index * 4 + 2] * 0.0722;
          luminance[index] = value;
          luminanceSum += value;
          if (value < 200) inkCount += 1;
        }

        let diffSum = 0;
        let changedCount = 0;
        if (previousLuminance) {
          for (let index = 0; index < width * height; index += 1) {
            const delta = Math.abs(luminance[index] - previousLuminance[index]);
            diffSum += delta;
            if (delta > 24) changedCount += 1;
          }
        }

        // High-frequency energy: mean horizontal+vertical gradient magnitude.
        // A rigid slide preserves stroke contrast almost exactly; raster
        // checkpoints and sampling-phase beats swing it frame to frame.
        let gradientSum = 0;
        for (let y = 0; y < height - 1; y += 1) {
          for (let x = 0; x < width - 1; x += 1) {
            const index = y * width + x;
            gradientSum +=
              Math.abs(luminance[index] - luminance[index + 1]) +
              Math.abs(luminance[index] - luminance[index + width]);
          }
        }

        stats.push({
          changedRatio: previousLuminance
            ? changedCount / (width * height)
            : 0,
          elapsedMs: Math.round(frame.elapsedMs),
          hfEnergy: gradientSum / ((width - 1) * (height - 1)),
          inkRatio: inkCount / (width * height),
          meanAbsDiff: previousLuminance ? diffSum / (width * height) : 0,
          meanLuminance: luminanceSum / (width * height),
        });
        previousLuminance = luminance;
      }

      return stats;
    },
    { frames: frames as ScreencastFrame[], region },
  );
}

export type ScreencastMotionVerdict = {
  failures: string[];
  inkEndpointFloor: number;
  inkOscillationRatio: number;
  maxMidInkRatio: number;
  minMidInkRatio: number;
  postMotionMaxDiff: number;
  whiteoutFrameCount: number;
};

// Scores one toggle capture. Content in transit between two states must stay
// inside the visual interval spanned by those states and move through it
// steadily:
// - whiteout: a frame with almost no ink while both endpoints have ink;
// - ink dip: mid-motion ink falling well below BOTH endpoints (the
//   settle-boundary wobble signature — content leaves the endpoint interval
//   and comes back);
// - ink spike: mid-motion ink rising well above BOTH endpoints (overshoot
//   that returns — content transiently denser than either resting state);
// - ink oscillation: total frame-to-frame ink variation far exceeding the
//   net endpoint change (the shimmer signature — strokes pulsing bold/soft
//   as a raster is resampled through sweeping fractional scales);
// - post-motion churn: pixels still changing after the motion and its settle
//   tail are over.
export function scoreScreencastMotion(
  stats: readonly ScreencastFrameStats[],
  {
    inkDipRatioBudget = 0.8,
    inkOscillationBudget = 2.5,
    inkSpikeRatioBudget = 1.6,
    motionEndMs,
    postMotionMaxDiffBudget = 1.5,
  }: {
    inkDipRatioBudget?: number;
    inkOscillationBudget?: number;
    inkSpikeRatioBudget?: number;
    motionEndMs: number;
    postMotionMaxDiffBudget?: number;
  },
): ScreencastMotionVerdict {
  const failures: string[] = [];
  const inks = stats.map((sample) => sample.inkRatio);
  const first = inks.at(0) ?? 0;
  const last = inks.at(-1) ?? 0;
  const inkEndpointFloor = Math.min(first, last);
  const midInks = inks.slice(1, -1);
  const minMidInkRatio = midInks.length > 0 ? Math.min(...midInks) : first;

  let whiteoutFrameCount = 0;
  if (inkEndpointFloor > 0.005) {
    for (const ink of midInks) {
      if (ink < inkEndpointFloor * 0.2) whiteoutFrameCount += 1;
    }
  }
  if (whiteoutFrameCount > 0) {
    failures.push(
      `${whiteoutFrameCount} whiteout frames (ink < 20% of endpoint floor ${inkEndpointFloor.toFixed(4)})`,
    );
  }

  if (
    inkEndpointFloor > 0.005 &&
    minMidInkRatio < inkEndpointFloor * inkDipRatioBudget
  ) {
    failures.push(
      `mid-motion ink ${minMidInkRatio.toFixed(4)} dips below ${(inkEndpointFloor * inkDipRatioBudget).toFixed(4)} (${inkDipRatioBudget} x endpoint floor ${inkEndpointFloor.toFixed(4)})`,
    );
  }

  const inkEndpointCeil = Math.max(first, last);
  const maxMidInkRatio = midInks.length > 0 ? Math.max(...midInks) : first;
  if (
    inkEndpointCeil > 0.005 &&
    maxMidInkRatio > inkEndpointCeil * inkSpikeRatioBudget
  ) {
    failures.push(
      `mid-motion ink ${maxMidInkRatio.toFixed(4)} spikes above ${(inkEndpointCeil * inkSpikeRatioBudget).toFixed(4)} (${inkSpikeRatioBudget} x endpoint ceiling ${inkEndpointCeil.toFixed(4)})`,
    );
  }

  // Shimmer: sum of frame-to-frame ink movement beyond the legitimate net
  // endpoint change, normalized by the endpoint span. A steady interpolation
  // scores ~0; strokes pulsing bold/soft as a raster sweeps fractional
  // scales rack up variation with no net progress.
  let inkTotalVariation = 0;
  for (let index = 1; index < inks.length; index += 1) {
    inkTotalVariation += Math.abs(inks[index] - inks[index - 1]);
  }
  const inkNetChange = Math.abs(last - first);
  const inkSpan = Math.max(first, last, 0.005);
  const inkOscillationRatio = (inkTotalVariation - inkNetChange) / inkSpan;
  if (inkEndpointFloor > 0.005 && inkOscillationRatio > inkOscillationBudget) {
    failures.push(
      `mid-motion ink oscillation ${inkOscillationRatio.toFixed(2)} exceeds ${inkOscillationBudget} (total variation ${inkTotalVariation.toFixed(4)} vs net change ${inkNetChange.toFixed(4)})`,
    );
  }

  let postMotionMaxDiff = 0;
  for (const sample of stats) {
    if (sample.elapsedMs <= motionEndMs) continue;
    postMotionMaxDiff = Math.max(postMotionMaxDiff, sample.meanAbsDiff);
  }
  if (postMotionMaxDiff > postMotionMaxDiffBudget) {
    failures.push(
      `post-motion pixels still churning: meanAbsDiff ${postMotionMaxDiff.toFixed(2)} > ${postMotionMaxDiffBudget} after ${motionEndMs}ms`,
    );
  }

  return {
    failures,
    inkEndpointFloor,
    inkOscillationRatio,
    maxMidInkRatio,
    minMidInkRatio,
    postMotionMaxDiff,
    whiteoutFrameCount,
  };
}
