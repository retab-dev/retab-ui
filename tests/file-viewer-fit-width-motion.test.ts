import { describe, expect, it } from "vitest";

import { createFileViewerFitWidthSurfaceMotionResolver } from "@/registry/new-york-v4/ui/file-viewer-fit-width-motion";
import { DEFAULT_FILE_VIEWER_MOTION_FRAME } from "@/registry/new-york-v4/ui/file-viewer-motion-kernel";

describe("file viewer fit-width motion", () => {
  it("keeps inline-scale motion proportional to the frozen stage width", () => {
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "start",
      fitContentInlineSize: 612,
      frozenStageInlineSize: 993,
      isFitWidth: true,
      mode: "inline-scale",
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 966,
      layoutInlineSize: 986,
      phase: "sliding",
      toInlineSize: 1246,
    });

    expect(style?.transform).toContain("scaleX(1.020704)");
  });

  it("starts uniform-scale motion at exactly the frozen stage size", () => {
    // The pptx stage is narrower than the kernel width (fit subtracts padding
    // and the scrollbar). The first sliding frame must still resolve to
    // scale 1, or the surface bbox inflates and bumps the scroller's
    // scrollHeight at motion start.
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "center",
      fitContentInlineSize: 960,
      frozenStageInlineSize: 1112,
      isFitWidth: true,
      mode: "uniform-scale",
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1128,
      layoutInlineSize: 1128,
      phase: "sliding",
      toInlineSize: 848,
    });

    expect(style?.transform).toBe("");

    const midSlide = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1128,
      layoutInlineSize: 988,
      phase: "sliding",
      toInlineSize: 848,
    });

    // frozenStage + (layout - from) = 1112 - 140 = 972 → 972 / 1112
    expect(midSlide?.transform).toContain("scale(0.874101)");
  });

  it("does not shrink below the target stage while opening an inline sidebar", () => {
    const resolveMotionStyle = createFileViewerFitWidthSurfaceMotionResolver({
      align: "start",
      fitContentInlineSize: 612,
      frozenStageInlineSize: 1281,
      isFitWidth: true,
      mode: "inline-scale",
    });

    const style = resolveMotionStyle({
      ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
      fromInlineSize: 1246,
      layoutInlineSize: 982,
      phase: "sliding",
      toInlineSize: 966,
    });

    expect(style?.transform).toContain("scaleX(0.788122)");
  });
});
