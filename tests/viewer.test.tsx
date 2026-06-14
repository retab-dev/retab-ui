// @vitest-environment jsdom

import { existsSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  useViewerSidebar,
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/registry/new-york-v4/ui/viewer"

afterEach(() => {
  cleanup()
})

const repoRoot = process.cwd()

describe("viewer primitives", () => {
  it("exposes the named viewer primitive hierarchy", () => {
    const { container } = render(
      <ViewerRoot>
        <ViewerHeader>Header</ViewerHeader>
        <ViewerBody>
          <ViewerSidebar>Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(container.querySelector('[data-slot="viewer-root"]')).toBeTruthy()
    expect(
      container.querySelector('[data-slot="viewer-header"]')?.textContent
    ).toBe("Header")
    expect(container.querySelector('[data-slot="viewer-body"]')).toBeTruthy()
    expect(
      container.querySelector('[data-slot="viewer-sidebar"]')?.textContent
    ).toBe("Sidebar")
    expect(
      container.querySelector('[data-slot="viewer-surface"]')?.textContent
    ).toBe("Surface")
  })

  it("does not ship the removed slot-object shell modules", () => {
    expect(
      existsSync(join(repoRoot, "registry/new-york-v4/ui/viewer-shell.tsx"))
    ).toBe(false)
    expect(
      existsSync(join(repoRoot, "registry/new-york-v4/ui/viewer-slots.ts"))
    ).toBe(false)
  })

  it("lets a trigger toggle the nearest root sidebar", () => {
    render(
      <ViewerRoot>
        <ViewerHeader>
          <ViewerSidebarTrigger data-testid="trigger" />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    const trigger = screen.getByTestId("trigger")
    const sidebar = screen.getByTestId("sidebar")

    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(trigger.getAttribute("aria-controls")).toBe(sidebar.id)
    expect(sidebar.getAttribute("aria-hidden")).toBe("true")
    expect(sidebar.hasAttribute("inert")).toBe(true)

    fireEvent.click(trigger)

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(sidebar.hasAttribute("aria-hidden")).toBe(false)
    expect(sidebar.hasAttribute("inert")).toBe(false)
  })

  it("supports controlled sidebar state", () => {
    const onOpenChange = vi.fn()

    function ControlledViewer() {
      const [open, setOpen] = React.useState(false)
      return (
        <ViewerRoot
          sidebarOpen={open}
          onSidebarOpenChange={(nextOpen) => {
            onOpenChange(nextOpen)
            setOpen(nextOpen)
          }}
        >
          <ViewerSidebarTrigger data-testid="trigger" />
          <ViewerBody>
            <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )
    }

    render(<ControlledViewer />)

    fireEvent.click(screen.getByTestId("trigger"))

    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.getByTestId("trigger").getAttribute("aria-expanded")).toBe(
      "true"
    )
    expect(screen.getByTestId("sidebar").hasAttribute("aria-hidden")).toBe(
      false
    )
  })

  it("respects prevented trigger clicks and disabled states", () => {
    const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
    })

    render(
      <ViewerRoot>
        <ViewerSidebarTrigger data-testid="prevented" onClick={onClick} />
        <ViewerSidebarTrigger data-testid="disabled" disabled />
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    fireEvent.click(screen.getByTestId("prevented"))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("sidebar").getAttribute("data-state")).toBe(
      "collapsed"
    )

    fireEvent.click(screen.getByTestId("disabled"))
    expect(screen.getByTestId("sidebar").getAttribute("data-state")).toBe(
      "collapsed"
    )
  })

  it("keeps nested viewer sidebar state isolated", () => {
    render(
      <ViewerRoot defaultSidebarOpen>
        <ViewerSidebarTrigger data-testid="outer-trigger" />
        <ViewerBody>
          <ViewerSidebar data-testid="outer-sidebar">Outer</ViewerSidebar>
          <ViewerSurface>
            <ViewerRoot>
              <ViewerSidebarTrigger data-testid="inner-trigger" />
              <ViewerBody>
                <ViewerSidebar data-testid="inner-sidebar">Inner</ViewerSidebar>
                <ViewerSurface>Nested surface</ViewerSurface>
              </ViewerBody>
            </ViewerRoot>
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    fireEvent.click(screen.getByTestId("inner-trigger"))

    expect(screen.getByTestId("outer-sidebar").getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(screen.getByTestId("inner-sidebar").getAttribute("data-state")).toBe(
      "expanded"
    )

    fireEvent.click(screen.getByTestId("outer-trigger"))

    expect(screen.getByTestId("outer-sidebar").getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(screen.getByTestId("inner-sidebar").getAttribute("data-state")).toBe(
      "expanded"
    )
  })

  it("derives sidebar mode from measured root width without exposing width", async () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const originalWindowResizeObserver = window.ResizeObserver
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect
    const callbacks: ResizeObserverCallback[] = []
    let width = 320

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback)
      }
      observe() {}
      disconnect() {}
    }

    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver
    window.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver
    HTMLElement.prototype.getBoundingClientRect = function () {
      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: width,
        toJSON: () => ({}),
        top: 0,
        width,
        x: 0,
        y: 0,
      }
    }

    function ModeProbe() {
      const sidebar = useViewerSidebar()
      return <div data-testid="mode">{sidebar.mode}</div>
    }

    try {
      render(
        <ViewerRoot sidebarInlineBreakpoint={768}>
          <ModeProbe />
          <ViewerBody>
            <ViewerSidebar>Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )

      await waitFor(() => {
        expect(screen.getByTestId("mode").textContent).toBe("overlay")
      })

      width = 1024
      act(() => {
        callbacks.forEach((callback) => callback([], {} as ResizeObserver))
      })

      expect(screen.getByTestId("mode").textContent).toBe("inline")
    } finally {
      globalThis.ResizeObserver = originalResizeObserver
      window.ResizeObserver = originalWindowResizeObserver
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect
    }
  })

  it("throws when the trigger is rendered outside ViewerRoot", () => {
    expect(() => render(<ViewerSidebarTrigger />)).toThrow(
      "useViewerSidebar must be used within a ViewerRoot."
    )
  })
})
