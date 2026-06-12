// @vitest-environment jsdom
import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createPdfPageLayout,
  getPdfPageLayout,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout"
import { usePdfPageVirtualization } from "@/registry/new-york-v4/ui/pdf-viewer-virtualization"

describe("usePdfPageVirtualization", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("coalesces scroll measurements into one animation frame", async () => {
    const layout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    })
    const frameCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})

    let viewportElement!: HTMLDivElement
    let measureVisiblePages!: () => void

    function Harness() {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: 0,
            clientHeight: 200,
          }) as HTMLDivElement
      )
      const result = usePdfPageVirtualization({
        layout,
        viewportElement: viewport,
      })

      viewportElement = viewport
      measureVisiblePages = result.measureVisiblePages

      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      )
    }

    render(<Harness />)

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4")
    )

    viewportElement.scrollTop = getPdfPageLayout(layout, 10)!.offsetTop

    act(() => {
      measureVisiblePages()
      measureVisiblePages()
      measureVisiblePages()
    })

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4")

    act(() => {
      frameCallbacks[0]?.(0)
    })

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13")
    )
  })
})
