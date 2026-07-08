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
