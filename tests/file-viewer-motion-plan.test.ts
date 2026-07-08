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

  // A mid-flight retarget continues from the picture the reader is looking
  // at: the live interpolated width, not the interrupted motion's origin.
  // Renderers solve their anchor with this as the first-frame width, so the
  // retarget frame stays pixel-continuous.
  it("continues from the live interpolated width when retargeting mid-motion", () => {
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
      phase: "sliding" as const,
      motionId: 1,
      motionProgress: 0.4,
      // Mid-flight: gap interpolated to 96px → live layout width 904.
      sidebarInlineSize: 96,
      layoutInlineSize: 904,
      fromInlineSize: 1000,
      toInlineSize: 760,
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
    expect(plan.fromInlineSize).toBe(904);
  });
});
