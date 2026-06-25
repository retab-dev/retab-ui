// @vitest-environment jsdom

import type * as React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TEXT_SCROLL_INTERACTION_RESTORE_DELAY_MS,
  useTextViewerScrollInteractions,
} from "@/registry/new-york-v4/ui/text-viewer-scroll-interactions";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useTextViewerScrollInteractions", () => {
  it("disables target pointer events while scrolling and restores them after the delay", () => {
    vi.useFakeTimers();
    const viewport = document.createElement("div");
    const target = document.createElement("div");
    const onScroll = vi.fn();

    renderHook(() =>
      useTextViewerScrollInteractions({
        getInteractionTarget: () => target,
        onScroll,
        viewportRef: refFor(viewport),
      }),
    );

    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(target.style.pointerEvents).toBe("none");
    expect(onScroll).toHaveBeenCalledWith(viewport);

    act(() => {
      vi.advanceTimersByTime(TEXT_SCROLL_INTERACTION_RESTORE_DELAY_MS - 1);
    });

    expect(target.style.pointerEvents).toBe("none");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(target.style.pointerEvents).toBe("");
  });

  it("extends the restore delay when another scroll arrives", () => {
    vi.useFakeTimers();
    const viewport = document.createElement("div");
    const target = document.createElement("div");

    renderHook(() =>
      useTextViewerScrollInteractions({
        getInteractionTarget: () => target,
        onScroll: () => {},
        viewportRef: refFor(viewport),
      }),
    );

    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(60);
      viewport.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(60);
    });

    expect(target.style.pointerEvents).toBe("none");

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(target.style.pointerEvents).toBe("");
  });

  it("hides horizontal overflow on mobile Safari and restores previous inline styles", () => {
    vi.useFakeTimers();
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    const viewport = document.createElement("div");
    const overflowTarget = document.createElement("div");
    const target = document.createElement("div");
    overflowTarget.style.overflowX = "scroll";
    target.style.pointerEvents = "auto";

    renderHook(() =>
      useTextViewerScrollInteractions({
        getInteractionTarget: () => target,
        getOverflowTarget: () => overflowTarget,
        onScroll: () => {},
        viewportRef: refFor(viewport),
      }),
    );

    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(target.style.pointerEvents).toBe("none");
    expect(overflowTarget.style.overflowX).toBe("hidden");

    act(() => {
      vi.advanceTimersByTime(TEXT_SCROLL_INTERACTION_RESTORE_DELAY_MS);
    });

    expect(target.style.pointerEvents).toBe("auto");
    expect(overflowTarget.style.overflowX).toBe("scroll");
  });

  it("restores active styles on cleanup", () => {
    vi.useFakeTimers();
    mockUserAgent(
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    const viewport = document.createElement("div");
    const overflowTarget = document.createElement("div");
    const target = document.createElement("div");
    overflowTarget.style.overflowX = "auto";

    const { unmount } = renderHook(() =>
      useTextViewerScrollInteractions({
        getInteractionTarget: () => target,
        getOverflowTarget: () => overflowTarget,
        onScroll: () => {},
        viewportRef: refFor(viewport),
      }),
    );

    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(target.style.pointerEvents).toBe("none");
    expect(overflowTarget.style.overflowX).toBe("hidden");

    unmount();

    expect(target.style.pointerEvents).toBe("");
    expect(overflowTarget.style.overflowX).toBe("auto");
  });
});

function refFor(current: HTMLElement): React.RefObject<HTMLElement | null> {
  return { current };
}

function mockUserAgent(userAgent: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}
