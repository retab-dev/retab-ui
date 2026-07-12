import { describe, expect, it } from "vitest";

import {
  FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY,
  createFileViewerAlignTranslateSurfaceMotionResolver,
  createFileViewerFitWidthSurfaceMotionResolver,
} from "@/registry/new-york-v4/ui/file-viewer-fit-width-motion";
import { DEFAULT_FILE_VIEWER_MOTION_FRAME } from "@/registry/new-york-v4/ui/file-viewer-motion-kernel";

// Commit-then-relax: the stage is laid out at the motion's TARGET width from
// the first sliding frame, and the resolver reprojects it to the in-flight
// visual width. The transform must start at exactly the pre-toggle stage size
// and terminate on identity.
describe("file viewer fit-width motion", () => {
  it("starts at exactly the pre-toggle stage size (affine width delta)", () => {
    // Closing the sidebar: layout 966 → 1246; the settled stage measures 1246
    // (fit-width, zero padding). At the first sliding frame (layout still at
    // the from width) the visual stage must be the pre-toggle 966.
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      isFitWidth: true,
      stageInlineSize: 1246,
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 966,
      layoutInlineSize: 966,
      phase: "sliding",
      toInlineSize: 1246,
    });

    // (1246 + (966 − 1246)) / 1246 = 966 / 1246
    expect(style?.transform).toContain("scale(0.775281)");
    expect(style?.transform).toContain(
      `var(${FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY}, 0px)`,
    );
  });

  it("terminates on identity at the settled width", () => {
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      isFitWidth: true,
      stageInlineSize: 1246,
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 966,
      layoutInlineSize: 1246,
      phase: "sliding",
      toInlineSize: 1246,
    });

    expect(style?.transform).toBe("");
  });

  it("clears every motion style outside the sliding phase", () => {
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      isFitWidth: true,
      stageInlineSize: 1246,
    });

    for (const phase of ["settling", "idle"] as const) {
      const style = resolveMotionStyle({
        ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
        fromInlineSize: 966,
        layoutInlineSize: 1100,
        phase,
        toInlineSize: 1246,
      });

      expect(style?.transform).toBe("");
      expect(style?.transformOrigin).toBe("");
      expect(style?.willChange).toBe("");
    }
  });

  it("handles a stage narrower than the kernel width (padding offset)", () => {
    // pptx-style stage: fit subtracts padding/scrollbar, so stage ≠ layout
    // width. The affine unit-slope reprojection must still start exactly at
    // the pre-toggle stage size: 848-stage at layout 848→1128 opening in
    // reverse. stage + (layout − to) = 832 + (1128 − 848) = 1112... use
    // opening: to = 848, from = 1128, stage measured at target = 832.
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      isFitWidth: true,
      stageInlineSize: 832,
    });

    const startStyle = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1128,
      layoutInlineSize: 1128,
      phase: "sliding",
      toInlineSize: 848,
    });

    // (832 + (1128 − 848)) / 832 = 1112 / 832
    expect(startStyle?.transform).toContain("scale(1.336538)");

    const midStyle = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1128,
      layoutInlineSize: 988,
      phase: "sliding",
      toInlineSize: 848,
    });

    // (832 + (988 − 848)) / 832 = 972 / 832
    expect(midStyle?.transform).toContain("scale(1.168269)");
  });

  it("keeps content inside constant wrapper padding continuous", () => {
    // Image and DOCX fit the visible page to pane − 32px, then wrap it in
    // symmetric 16px padding. Scaling the OUTER stage reproduces the wrapper
    // width but scales those 16px too, so the visible page first moves the
    // wrong way. The content scale and inset correction must reproduce both
    // visible edges exactly at the first frame.
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      isFitWidth: true,
      stageInlineSize: 1246,
      stageInlinePadding: 32,
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 966,
      layoutInlineSize: 966,
      phase: "sliding",
      toInlineSize: 1246,
    });

    // content scale = (966 − 32) / (1246 − 32) = 934 / 1214
    expect(style?.transform).toContain("scale(0.769357)");
    // (1 − scale) × 16px keeps the visible content's left inset at 16px.
    expect(style?.transform).toContain("translate3d(3.69px,");
  });

  it("keeps an overflowing stage inside constant outer frame padding", () => {
    // PDF pages are outside the 16px frame inset, not wrapped inside the
    // transformed stage. On the opening leg the old widest page can overflow
    // the newly committed stage; margin resolution must still happen inside
    // the padded content box or the stage escapes left by exactly 16px.
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      isFitWidth: true,
      stageInlineSize: 1140,
      stageOuterInlinePadding: 32,
      stageInlineSlope: 1.028571,
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1406,
      layoutInlineSize: 1406,
      phase: "sliding",
      toInlineSize: 1126,
    });

    expect(style?.transform).toContain("translate3d(-117px,");
    expect(style?.transform).toContain("scale(1.252631)");
  });

  // RTL: the margin model must speak physical-left. The only branch where
  // direction changes the answer for a centered stage is the over-constrained
  // one — the settled stage (laid out for the wider target) overflowing the
  // still-narrow live container on the close leg. CSS pins that box to the
  // direction's start edge: left edge 0 in LTR, at the negative free space in
  // RTL. The old unconditional max(0, …) clamp made the RTL close leg
  // overshoot by exactly that overflow.
  it("compensates the RTL overflow pinning on the close leg's first frame", () => {
    // stage 1200 laid out for target 1246 inside live 966: free = −234.
    const makeResolver = (direction: "ltr" | "rtl") =>
      createFileViewerFitWidthSurfaceMotionResolver({
        align: "center",
        direction,
        isFitWidth: true,
        stageInlineSize: 1200,
      });
    const frame = {
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 966,
      layoutInlineSize: 966,
      phase: "sliding" as const,
      toInlineSize: 1246,
    };

    // visual stage = 1200 + (966 − 1246) = 920; visual free = 46.
    // LTR: settled left 0 (pinned left), visual left 23 → +23.
    expect(makeResolver("ltr")(frame)?.transform).toContain(
      "translate3d(23px,",
    );
    // RTL: settled left −234 (pinned right, overflowing left), visual left 23
    // → +257. The uncorrected LTR math shipped +23 here — a ~234px flight
    // displacement that vanished mid-flight once the live width passed the
    // stage, which read as an overshoot-and-return.
    expect(makeResolver("rtl")(frame)?.transform).toContain(
      "translate3d(257px,",
    );
  });

  it("matches LTR in RTL once nothing overflows (centered stage)", () => {
    const makeResolver = (direction: "ltr" | "rtl") =>
      createFileViewerFitWidthSurfaceMotionResolver({
        align: "center",
        direction,
        isFitWidth: true,
        stageInlineSize: 1200,
      });
    const frame = {
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 966,
      layoutInlineSize: 1230,
      phase: "sliding" as const,
      toInlineSize: 1246,
    };

    // settled left (1230 − 1200)/2 = 15; visual stage 1184, left 23 → +8.
    expect(makeResolver("ltr")(frame)?.transform).toContain("translate3d(8px,");
    expect(makeResolver("rtl")(frame)?.transform).toContain("translate3d(8px,");
  });

  it("returns identity while not fit-width", () => {
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      isFitWidth: false,
      stageInlineSize: 1246,
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 966,
      layoutInlineSize: 1000,
      phase: "sliding",
      toInlineSize: 1246,
    });

    expect(style?.transform).toBe("");
  });
});

// The clamped-column resolver (markdown reading column): the stage's inline
// size is min(canvas, max-width), so a pane width change moves only the
// align margin — the reprojection is a translate, never a scale. The canvas
// commits the TARGET width via minWidth, so the CLOSE leg (widening pane)
// is the leg that engages it; the OPEN leg's canvas tracks the live width
// and the resolver must stay identity there.
describe("file viewer align-translate motion (clamped column)", () => {
  const makeResolver = (direction: "ltr" | "rtl" = "ltr") =>
    createFileViewerAlignTranslateSurfaceMotionResolver({
      align: "center",
      direction,
      maxStageInlineSize: 896,
    });

  it("cancels the close-leg recenter at the first sliding frame", () => {
    // Closing: pane 1160 → 1440; the canvas already lays out at 1440, so the
    // 896 column's settled margin is (1440−896)/2 = 272 while the reader
    // still sees a 1160 pane whose margin is (1160−896)/2 = 132. The first
    // frame must translate the full −140 half-delta back.
    const style = makeResolver()({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1160,
      layoutInlineSize: 1160,
      phase: "sliding",
      toInlineSize: 1440,
    });

    expect(style?.transform).toBe("translate3d(-140px, 0px, 0)");
    expect(style?.willChange).toBe("transform");
  });

  it("terminates on identity as the live width reaches the target", () => {
    const style = makeResolver()({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1160,
      layoutInlineSize: 1440,
      phase: "sliding",
      toInlineSize: 1440,
    });

    expect(style?.transform).toBe("");
  });

  it("stays identity on the open leg (canvas tracks the live width)", () => {
    // Opening: pane 1440 → 1160. The canvas lays out at max(live, target) =
    // live, so the chunk margin already follows the live width every frame —
    // the glide is layout-owned and the resolver must not double-move it.
    const style = makeResolver()({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1440,
      layoutInlineSize: 1300,
      phase: "sliding",
      toInlineSize: 1160,
    });

    expect(style?.transform).toBe("");
  });

  it("clears every motion style outside the sliding phase", () => {
    for (const phase of ["settling", "idle"] as const) {
      const style = makeResolver()({
        ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
        fromInlineSize: 1160,
        layoutInlineSize: 1200,
        phase,
        toInlineSize: 1440,
      });

      expect(style?.transform).toBe("");
      expect(style?.transformOrigin).toBe("");
      expect(style?.willChange).toBe("");
    }
  });

  it("pins the column to the pane's start edge while it overflows", () => {
    // Mid-close on a narrow pane: live 800 < column 896 ≤ canvas 1000. The
    // ideal rest state at 800 pins the column to the start edge; the layout
    // places it at the canvas margin (1000−896)/2 = 52 → translate −52.
    const style = makeResolver()({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 720,
      layoutInlineSize: 800,
      phase: "sliding",
      toInlineSize: 1000,
    });

    expect(style?.transform).toBe("translate3d(-52px, 0px, 0)");
  });

  it("compensates the RTL canvas overflow pinning on the close leg", () => {
    // In RTL an overflowing canvas pins its RIGHT edge to the pane, hanging
    // the overflow off the left: canvas left = live − canvas = −280. The
    // column's pane-space left is −280 + 272 = −8, the live margin is 132 →
    // translate +140 (equal and opposite to LTR's −140).
    const frame = {
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1160,
      layoutInlineSize: 1160,
      phase: "sliding" as const,
      toInlineSize: 1440,
    };

    expect(makeResolver("ltr")(frame)?.transform).toBe(
      "translate3d(-140px, 0px, 0)",
    );
    expect(makeResolver("rtl")(frame)?.transform).toBe(
      "translate3d(140px, 0px, 0)",
    );
  });
});
