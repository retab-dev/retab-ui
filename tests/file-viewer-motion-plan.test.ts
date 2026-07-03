import { describe, expect, it } from "vitest";

import {
  createFileViewerIdleMotionFrame,
  createFileViewerMotionPlan,
  createFileViewerMotionRestFrame,
} from "@/registry/new-york-v4/ui/file-viewer-motion-plan";

describe("FileViewer motion plan", () => {
  it("precomputes inline sidebar open geometry", () => {
    const currentFrame = createFileViewerIdleMotionFrame(
      createFileViewerMotionRestFrame({
        shellInlineSize: 1000,
        durationMs: 150,
        mode: "inline",
        open: false,
        side: "right",
        sidebarWidth: 240,
      }),
    );
    const plan = createFileViewerMotionPlan({
      animate: true,
      currentFrame,
      nextTarget: {
        shellInlineSize: 1000,
        durationMs: 150,
        mode: "inline",
        open: true,
        side: "right",
        sidebarWidth: 240,
      },
    });

    expect(plan.shouldAnimate).toBe(true);
    expect(plan.currentRestFrame.layoutInlineSize).toBe(1000);
    expect(plan.nextRestFrame).toMatchObject({
      layoutInlineSize: 760,
      open: true,
      sidebarInlineSize: 240,
    });
    expect(plan.fromInlineSize).toBe(1000);
  });

  it("does not animate overlay sidebars", () => {
    const currentFrame = createFileViewerIdleMotionFrame(
      createFileViewerMotionRestFrame({
        shellInlineSize: 1000,
        durationMs: 150,
        mode: "overlay",
        open: false,
        side: "left",
        sidebarWidth: 240,
      }),
    );
    const plan = createFileViewerMotionPlan({
      animate: true,
      currentFrame,
      nextTarget: {
        shellInlineSize: 1000,
        durationMs: 150,
        mode: "overlay",
        open: true,
        side: "left",
        sidebarWidth: 240,
      },
    });

    expect(plan.shouldAnimate).toBe(false);
    expect(plan.nextRestFrame.layoutInlineSize).toBe(1000);
    expect(plan.nextRestFrame.sidebarInlineSize).toBe(0);
  });

  it("preserves the original raster width when retargeting mid-motion", () => {
    const currentFrame = {
      ...createFileViewerIdleMotionFrame(
        createFileViewerMotionRestFrame({
          shellInlineSize: 1000,
          durationMs: 150,
          mode: "inline",
          open: true,
          side: "right",
          sidebarWidth: 240,
        }),
      ),
      isTransitioning: true,
      fromInlineSize: 1000,
      fallbackSurfaceScale: 0.9,
    };
    const plan = createFileViewerMotionPlan({
      animate: true,
      currentFrame,
      nextTarget: {
        shellInlineSize: 1000,
        durationMs: 150,
        mode: "inline",
        open: false,
        side: "right",
        sidebarWidth: 240,
      },
    });

    expect(plan.shouldAnimate).toBe(true);
    expect(plan.fromInlineSize).toBe(1000);
  });
});
