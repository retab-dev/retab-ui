// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { usePdfPageSizes } from "@/registry/new-york-v4/ui/pdf-viewer-page-sizes"

describe("usePdfPageSizes", () => {
  it("starts empty and records page sizes", () => {
    const { result } = renderHook(() => usePdfPageSizes("doc-a"))

    expect(result.current.pageSizeByNumber.size).toBe(0)

    act(() => {
      result.current.setPageSize(2, { width: 200, height: 400 })
    })

    expect(result.current.pageSizeByNumber.get(2)).toEqual({
      width: 200,
      height: 400,
    })
  })

  it("keeps map identity when a page size is unchanged", () => {
    const { result } = renderHook(() => usePdfPageSizes("doc-a"))

    act(() => {
      result.current.setPageSize(1, { width: 100, height: 200 })
    })
    const previousMap = result.current.pageSizeByNumber

    act(() => {
      result.current.setPageSize(1, { width: 100, height: 200 })
    })

    expect(result.current.pageSizeByNumber).toBe(previousMap)
  })

  it("resets when the reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => usePdfPageSizes(resetKey),
      { initialProps: { resetKey: "doc-a" } }
    )

    act(() => {
      result.current.setPageSize(1, { width: 100, height: 200 })
    })
    expect(result.current.pageSizeByNumber.size).toBe(1)

    rerender({ resetKey: "doc-b" })

    expect(result.current.pageSizeByNumber.size).toBe(0)
  })
})
