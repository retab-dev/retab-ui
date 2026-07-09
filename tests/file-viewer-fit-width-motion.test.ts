import { describe, expect, it } from "vitest";

import {
  FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY,
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
