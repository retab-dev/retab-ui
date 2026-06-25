// @vitest-environment jsdom

import type * as React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCodeProjectionScheduler } from "@/registry/new-york-v4/ui/code-viewer-projection-scheduler";
import { TEXT_SCROLL_INTERACTION_RESTORE_DELAY_MS } from "@/registry/new-york-v4/ui/text-viewer-scroll-interactions";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    window.clearTimeout(id);
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useCodeProjectionScheduler", () => {
  it("restores prior inline scroll interaction styles and priorities after scrolling", () => {
    mockMobileSafari();
    const project = vi.fn();
    const viewport = document.createElement("div");
    const renderWindow = document.createElement("div");
    const rowHost = document.createElement("pre");
    renderWindow.append(rowHost);
    renderWindow.style.setProperty("overflow-x", "scroll", "important");
    rowHost.style.setProperty("pointer-events", "auto", "important");

    renderHook(() =>
      useCodeProjectionScheduler({
        project,
        rowHostRef: refFor(rowHost),
        viewportRef: refFor(viewport),
      }),
    );

    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(rowHost.style.getPropertyValue("pointer-events")).toBe("none");
    expect(rowHost.style.getPropertyPriority("pointer-events")).toBe("");
    expect(renderWindow.style.getPropertyValue("overflow-x")).toBe("hidden");
    expect(renderWindow.style.getPropertyPriority("overflow-x")).toBe("");

    act(() => {
      vi.advanceTimersByTime(TEXT_SCROLL_INTERACTION_RESTORE_DELAY_MS);
    });

    expect(rowHost.style.getPropertyValue("pointer-events")).toBe("auto");
    expect(rowHost.style.getPropertyPriority("pointer-events")).toBe(
      "important",
    );
    expect(renderWindow.style.getPropertyValue("overflow-x")).toBe("scroll");
    expect(renderWindow.style.getPropertyPriority("overflow-x")).toBe(
      "important",
    );
  });

  it("restores the previous row host before suspending a new row host", () => {
    mockMobileSafari();
    const project = vi.fn();
    const viewport = document.createElement("div");
    const first = codeScrollElements();
    const second = codeScrollElements();
    const rowHostRef = refFor(first.rowHost);

    renderHook(() =>
      useCodeProjectionScheduler({
        project,
        rowHostRef,
        viewportRef: refFor(viewport),
      }),
    );

    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(first.rowHost.style.pointerEvents).toBe("none");
    expect(first.renderWindow.style.overflowX).toBe("hidden");

    rowHostRef.current = second.rowHost;

    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(first.rowHost.style.getPropertyValue("pointer-events")).toBe("auto");
    expect(first.rowHost.style.getPropertyPriority("pointer-events")).toBe(
      "important",
    );
    expect(first.renderWindow.style.getPropertyValue("overflow-x")).toBe(
      "scroll",
    );
    expect(first.renderWindow.style.getPropertyPriority("overflow-x")).toBe(
      "important",
    );
    expect(second.rowHost.style.pointerEvents).toBe("none");
    expect(second.renderWindow.style.overflowX).toBe("hidden");
  });
});

function codeScrollElements() {
  const renderWindow = document.createElement("div");
  const rowHost = document.createElement("pre");
  renderWindow.append(rowHost);
  renderWindow.style.setProperty("overflow-x", "scroll", "important");
  rowHost.style.setProperty("pointer-events", "auto", "important");
  return { renderWindow, rowHost };
}

function refFor<Element extends HTMLElement>(
  current: Element,
): React.RefObject<Element | null> {
  return { current };
}

function mockMobileSafari() {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
}
