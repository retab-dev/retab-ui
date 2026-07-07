import { describe, expect, it } from "vitest";

import {
  createFileViewerRendererFrame,
  resolveFileViewerRendererLayoutInlineSize,
  type FileViewerRendererFrame,
} from "@/registry/new-york-v4/ui/file-viewer-renderer-contract";
import { DEFAULT_FILE_VIEWER_MOTION_FRAME } from "@/registry/new-york-v4/ui/file-viewer-motion-kernel";

const STABLE_FRAME: FileViewerRendererFrame = {
  align: "start",
  canToggleSidebar: false,
  documentTransition: {
    layoutPolicy: "live",
    scrollPolicy: "preserve",
    source: "none",
    transitionId: null,
    visualPolicy: "none",
  },
  element: null,
  fromInlineSize: 640,
  isTransitioning: false,
  layoutInlineSize: 640,
  motionDurationMs: 150,
  phase: "idle",
  rasterInlineSize: 640,
  settledInlineSize: 640,
  shellInlineSize: null,
  toInlineSize: 640,
  usesShellGeometry: false,
};

describe("file viewer renderer contract", () => {
  it("uses the live layout size outside shell motion", () => {
    expect(
      resolveFileViewerRendererLayoutInlineSize({
        fallbackInlineSize: 320,
        rendererFrame: frame({ layoutInlineSize: 640 }),
      }),
    ).toBe(640);
  });

  it("falls back to measured width when no renderer frame width is available", () => {
    expect(
      resolveFileViewerRendererLayoutInlineSize({
        fallbackInlineSize: 480,
        rendererFrame: frame({ layoutInlineSize: null }),
      }),
    ).toBe(480);
  });

  it("ignores zero-width measurements outside FileViewer shell geometry", () => {
    expect(
      createFileViewerRendererFrame({
        align: "center",
        canToggleSidebar: false,
        element: null,
        fallbackInlineSize: 0,
        motionFrame: DEFAULT_FILE_VIEWER_MOTION_FRAME,
        motionDurationMs: 0,
        usesShellGeometry: false,
      }).layoutInlineSize,
    ).toBeNull();
    expect(
      resolveFileViewerRendererLayoutInlineSize({
        fallbackInlineSize: 0,
        rendererFrame: frame({ layoutInlineSize: null }),
      }),
    ).toBeNull();
  });

  it("freezes renderer layout width at the motion origin while the shell slides", () => {
    expect(
      resolveFileViewerRendererLayoutInlineSize({
        fallbackInlineSize: 900,
        rendererFrame: frame({
          layoutInlineSize: 720,
          fromInlineSize: 480,
          documentTransition: {
            layoutPolicy: "frozen",
            scrollPolicy: "defer",
            source: "viewer-shell",
            transitionId: 1,
            visualPolicy: "shell-transform",
          },
        }),
      }),
    ).toBe(480);
  });

  it("uses the target layout width after the shell leaves the sliding phase", () => {
    expect(
      resolveFileViewerRendererLayoutInlineSize({
        fallbackInlineSize: 900,
        rendererFrame: frame({
          layoutInlineSize: 720,
          fromInlineSize: 480,
          documentTransition: {
            layoutPolicy: "target",
            scrollPolicy: "rebase",
            source: "viewer-shell",
            transitionId: 1,
            visualPolicy: "shell-transform",
          },
        }),
      }),
    ).toBe(720);
  });

  it("derives the raster width from the widest frame the motion touches", () => {
    const rendererFrame = createFileViewerRendererFrame({
      align: "center",
      canToggleSidebar: true,
      element: null,
      fallbackInlineSize: null,
      motionFrame: {
        ...DEFAULT_FILE_VIEWER_MOTION_FRAME,
        shellInlineSize: 840,
        fromInlineSize: 420,
        layoutInlineSize: 630,
        mode: "inline",
        motionId: 1,
        motionProgress: 0.5,
        phase: "sliding",
        toInlineSize: 840,
      },
      motionDurationMs: 150,
      usesShellGeometry: true,
    });

    expect(rendererFrame.rasterInlineSize).toBe(840);
    expect(rendererFrame.shellInlineSize).toBe(840);
    expect(rendererFrame.settledInlineSize).toBe(840);
    expect(rendererFrame.documentTransition.layoutPolicy).toBe("frozen");
    expect(rendererFrame.isTransitioning).toBe(true);
  });
});

function frame(
  overrides: Partial<FileViewerRendererFrame> & {
    documentTransition?: Partial<FileViewerRendererFrame["documentTransition"]>;
  },
): FileViewerRendererFrame {
  const documentTransition = {
    ...STABLE_FRAME.documentTransition,
    ...overrides.documentTransition,
  };

  return {
    ...STABLE_FRAME,
    ...overrides,
    documentTransition,
  };
}
