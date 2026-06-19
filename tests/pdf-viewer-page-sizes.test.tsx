/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

// @vitest-environment jsdom
import * as React from "react";
import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { usePdfPageSizes } from "@/registry/new-york-v4/ui/pdf-viewer-page-sizes";

describe("usePdfPageSizes", () => {
  afterEach(() => cleanup());

  it("starts empty and records page sizes", () => {
    const { result } = renderHook(() => usePdfPageSizes("doc-a"));

    expect(result.current.pageSizeByNumber.size).toBe(0);

    act(() => {
      result.current.setPageSize(2, { width: 200, height: 400 });
    });

    expect(result.current.pageSizeByNumber.get(2)).toEqual({
      width: 200,
      height: 400,
    });
  });

  it("keeps map identity when a page size is unchanged", () => {
    const { result } = renderHook(() => usePdfPageSizes("doc-a"));

    act(() => {
      result.current.setPageSize(1, { width: 100, height: 200 });
    });
    const previousMap = result.current.pageSizeByNumber;

    act(() => {
      result.current.setPageSize(1, { width: 100, height: 200 });
    });

    expect(result.current.pageSizeByNumber).toBe(previousMap);
  });

  it("sets multiple page sizes while keeping map identity when unchanged", () => {
    const { result } = renderHook(() => usePdfPageSizes("doc-a"));

    act(() => {
      result.current.setPageSizes(
        new Map([
          [1, { width: 100, height: 200 }],
          [2, { width: 300, height: 400 }],
        ]),
      );
    });

    expect(result.current.pageSizeByNumber.get(1)).toEqual({
      width: 100,
      height: 200,
    });
    expect(result.current.pageSizeByNumber.get(2)).toEqual({
      width: 300,
      height: 400,
    });

    const previousMap = result.current.pageSizeByNumber;

    act(() => {
      result.current.setPageSizes(
        new Map([
          [1, { width: 100, height: 200 }],
          [2, { width: 300, height: 400 }],
        ]),
      );
    });

    expect(result.current.pageSizeByNumber).toBe(previousMap);
  });

  it("resets when the reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => usePdfPageSizes(resetKey),
      { initialProps: { resetKey: "doc-a" } },
    );

    act(() => {
      result.current.setPageSize(1, { width: 100, height: 200 });
    });
    expect(result.current.pageSizeByNumber.size).toBe(1);

    rerender({ resetKey: "doc-b" });

    expect(result.current.pageSizeByNumber.size).toBe(0);
  });

  it("does not expose stale page sizes during the reset-key render", async () => {
    const snapshots: Array<{ resetKey: string; size: number }> = [];

    function Harness({ resetKey }: { resetKey: string }) {
      const { pageSizeByNumber, setPageSize } = usePdfPageSizes(resetKey);
      snapshots.push({ resetKey, size: pageSizeByNumber.size });

      React.useEffect(() => {
        if (resetKey === "doc-a" && pageSizeByNumber.size === 0) {
          setPageSize(1, { width: 100, height: 200 });
        }
      }, [pageSizeByNumber.size, resetKey, setPageSize]);

      return null;
    }

    const view = render(<Harness resetKey="doc-a" />);

    await waitFor(() =>
      expect(snapshots.some((snapshot) => snapshot.size === 1)).toBe(true),
    );

    view.rerender(<Harness resetKey="doc-b" />);

    const docBSnapshots = snapshots.filter(
      (snapshot) => snapshot.resetKey === "doc-b",
    );
    expect(docBSnapshots.length).toBeGreaterThan(0);
    expect(docBSnapshots.every((snapshot) => snapshot.size === 0)).toBe(true);
  });
});
