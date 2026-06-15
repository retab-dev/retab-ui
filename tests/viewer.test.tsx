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

function mockElementRect(
  element: Element,
  rect: Pick<DOMRect, "bottom" | "height" | "left" | "right" | "top" | "width">
) {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        ...rect,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }) as DOMRect
  )
}

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
      container
        .querySelector('[data-slot="viewer-sidebar"]')
        ?.getAttribute("data-viewer-sidebar-mode")
    ).toBe("overlay")
    expect(
      container.querySelector('[data-slot="viewer-surface"]')?.textContent
    ).toBe("Surface")
  })

  it("defaults the sidebar mode to responsive auto", async () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const originalWindowResizeObserver = window.ResizeObserver
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect
    const callbacks: ResizeObserverCallback[] = []
    let width = 1024

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
        <ViewerRoot>
          <ModeProbe />
          <ViewerBody>
            <ViewerSidebar>Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )

      await waitFor(() => {
        expect(screen.getByTestId("mode").textContent).toBe("inline")
      })

      width = 320
      act(() => {
        callbacks.forEach((callback) => callback([], {} as ResizeObserver))
      })

      expect(screen.getByTestId("mode").textContent).toBe("overlay")
    } finally {
      globalThis.ResizeObserver = originalResizeObserver
      window.ResizeObserver = originalWindowResizeObserver
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect
    }
  })

  it("uses framed chrome by default and removes all frame styling in bare mode", () => {
    const { rerender } = render(
      <ViewerRoot data-testid="root">
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(screen.getByTestId("root").className).toContain("rounded-xl")
    expect(screen.getByTestId("root").className).toContain("border")
    expect(screen.getByTestId("root").className).toContain("bg-muted/30")

    rerender(
      <ViewerRoot bare data-testid="root">
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(screen.getByTestId("root").className).not.toContain("rounded-xl")
    expect(screen.getByTestId("root").className).not.toContain("border")
    expect(screen.getByTestId("root").className).not.toContain("bg-muted")
  })

  it("does not bake domain semantics into the primitive sidebar or surface", () => {
    const { container } = render(
      <ViewerRoot>
        <ViewerBody>
          <ViewerSidebar>Pages</ViewerSidebar>
          <ViewerSurface>Document</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(
      container
        .querySelector('[data-slot="viewer-sidebar"]')
        ?.getAttribute("data-viewer-purpose")
    ).toBeNull()
    expect(
      container
        .querySelector('[data-slot="viewer-surface"]')
        ?.getAttribute("data-viewer-role")
    ).toBeNull()
    expect(
      container.querySelector('[data-slot="viewer-sidebar"]')?.className
    ).not.toContain("bg-background")
  })

  it("uses explicit side on the base sidebar", () => {
    const { container } = render(
      <ViewerRoot>
        <ViewerBody>
          <ViewerSurface>Document</ViewerSurface>
          <ViewerSidebar side="right">Fields</ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    )

    const sidebar = container.querySelector('[data-slot="viewer-sidebar"]')
    expect(sidebar?.getAttribute("data-side")).toBe("right")
  })

  it("scopes overlay sidebar layout to the body below the header", () => {
    const { container } = render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerHeader data-testid="header">Header</ViewerHeader>
        <ViewerBody data-testid="body">
          <ViewerSidebar data-testid="sidebar">Pages</ViewerSidebar>
          <ViewerSurface data-testid="surface">
            <div data-testid="legend">Legend</div>
            <div>Document</div>
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    const root = container.querySelector('[data-slot="viewer-root"]')!
    const header = screen.getByTestId("header")
    const body = screen.getByTestId("body")
    const sidebar = screen.getByTestId("sidebar")
    const surface = screen.getByTestId("surface")
    const legend = screen.getByTestId("legend")

    mockElementRect(root, {
      top: 0,
      bottom: 360,
      left: 0,
      right: 640,
      width: 640,
      height: 360,
    })
    mockElementRect(header, {
      top: 0,
      bottom: 48,
      left: 0,
      right: 640,
      width: 640,
      height: 48,
    })
    mockElementRect(body, {
      top: 48,
      bottom: 360,
      left: 0,
      right: 640,
      width: 640,
      height: 312,
    })
    mockElementRect(sidebar, {
      top: 48,
      bottom: 360,
      left: 0,
      right: 160,
      width: 160,
      height: 312,
    })
    mockElementRect(surface, {
      top: 48,
      bottom: 360,
      left: 160,
      right: 640,
      width: 480,
      height: 312,
    })
    mockElementRect(legend, {
      top: 48,
      bottom: 96,
      left: 160,
      right: 640,
      width: 480,
      height: 48,
    })

    expect(
      Array.from(root.children).map((child) => child.getAttribute("data-slot"))
    ).toEqual(["viewer-header", "viewer-body"])
    expect(sidebar.parentElement).toBe(body)
    expect(legend.closest('[data-slot="viewer-surface"]')).toBe(surface)
    expect(body.className).toContain("relative")
    expect(sidebar.className).toContain("absolute")
    expect(sidebar.className).toContain("inset-y-0")

    const headerRect = header.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    const sidebarRect = sidebar.getBoundingClientRect()
    const surfaceRect = surface.getBoundingClientRect()
    const legendRect = legend.getBoundingClientRect()

    expect(sidebarRect.top).toBe(bodyRect.top)
    expect(sidebarRect.bottom).toBe(bodyRect.bottom)
    expect(sidebarRect.top).toBeGreaterThanOrEqual(headerRect.bottom)
    expect(legendRect.top).toBeGreaterThanOrEqual(bodyRect.top)
    expect(legendRect.left).toBeGreaterThanOrEqual(surfaceRect.left)
  })

  it("keeps inline sidebar in body flow beside the document surface", () => {
    render(
      <ViewerRoot defaultOpen mode="inline">
        <ViewerHeader data-testid="header">Header</ViewerHeader>
        <ViewerBody data-testid="body">
          <ViewerSidebar data-testid="sidebar">Pages</ViewerSidebar>
          <ViewerSurface data-testid="surface">Document</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    const header = screen.getByTestId("header")
    const body = screen.getByTestId("body")
    const sidebar = screen.getByTestId("sidebar")
    const surface = screen.getByTestId("surface")

    mockElementRect(header, {
      top: 0,
      bottom: 52,
      left: 0,
      right: 800,
      width: 800,
      height: 52,
    })
    mockElementRect(body, {
      top: 52,
      bottom: 420,
      left: 0,
      right: 800,
      width: 800,
      height: 368,
    })
    mockElementRect(sidebar, {
      top: 52,
      bottom: 420,
      left: 0,
      right: 160,
      width: 160,
      height: 368,
    })
    mockElementRect(surface, {
      top: 52,
      bottom: 420,
      left: 160,
      right: 800,
      width: 640,
      height: 368,
    })

    expect(sidebar.parentElement).toBe(body)
    expect(surface.parentElement).toBe(body)
    expect(sidebar.className).toContain("relative")
    expect(sidebar.className).not.toContain("absolute")

    const headerRect = header.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    const sidebarRect = sidebar.getBoundingClientRect()
    const surfaceRect = surface.getBoundingClientRect()

    expect(sidebarRect.top).toBe(bodyRect.top)
    expect(sidebarRect.bottom).toBe(bodyRect.bottom)
    expect(sidebarRect.top).toBeGreaterThanOrEqual(headerRect.bottom)
    expect(surfaceRect.left).toBe(sidebarRect.right)
  })

  it("keeps private sidebar registration fields out of the public hook value", () => {
    let keys: string[] = []

    function Probe() {
      const sidebar = useViewerSidebar()
      React.useEffect(() => {
        keys = Object.keys(sidebar).sort()
      }, [sidebar])
      return null
    }

    render(
      <ViewerRoot>
        <Probe />
        <ViewerBody>
          <ViewerSidebar>Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(keys).toEqual(
      [
        "canToggleSidebar",
        "mode",
        "open",
        "setOpen",
        "state",
        "toggleSidebar",
      ].sort()
    )
  })

  it("keeps the public sidebar context stable across unrelated root rerenders", async () => {
    const values: ReturnType<typeof useViewerSidebar>[] = []

    function Probe() {
      const sidebar = useViewerSidebar()
      values.push(sidebar)
      return null
    }

    const tree = (className: string) => (
      <ViewerRoot className={className} data-testid="root">
        <Probe />
        <ViewerBody>
          <ViewerSidebar>Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )
    const { rerender } = render(tree("first"))

    await waitFor(() => {
      expect(values.at(-1)?.canToggleSidebar).toBe(true)
    })

    const stableValue = values.at(-1)
    rerender(tree("second"))

    expect(values.at(-1)).toBe(stableValue)
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
          open={open}
          onOpenChange={(nextOpen) => {
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
    expect(
      screen.getByTestId("sidebar").getAttribute("data-viewer-sidebar-state")
    ).toBe("collapsed")

    fireEvent.click(screen.getByTestId("disabled"))
    expect(
      screen.getByTestId("sidebar").getAttribute("data-viewer-sidebar-state")
    ).toBe("collapsed")
  })

  it("uses real DOM disabled semantics for disabled, loading, and aria-disabled triggers", () => {
    render(
      <ViewerRoot>
        <ViewerSidebarTrigger data-testid="disabled" disabled />
        <ViewerSidebarTrigger data-testid="loading" loading />
        <ViewerSidebarTrigger data-testid="aria-disabled" aria-disabled />
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect((screen.getByTestId("disabled") as HTMLButtonElement).disabled).toBe(
      true
    )
    expect((screen.getByTestId("loading") as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(
      (screen.getByTestId("aria-disabled") as HTMLButtonElement).disabled
    ).toBe(true)
    expect(
      screen.getByTestId("sidebar").getAttribute("data-viewer-sidebar-state")
    ).toBe("collapsed")
  })

  it("keeps nested viewer sidebar state isolated", () => {
    render(
      <ViewerRoot defaultOpen>
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

    expect(
      screen
        .getByTestId("outer-sidebar")
        .getAttribute("data-viewer-sidebar-state")
    ).toBe("expanded")
    expect(
      screen
        .getByTestId("inner-sidebar")
        .getAttribute("data-viewer-sidebar-state")
    ).toBe("expanded")

    fireEvent.click(screen.getByTestId("outer-trigger"))

    expect(
      screen
        .getByTestId("outer-sidebar")
        .getAttribute("data-viewer-sidebar-state")
    ).toBe("collapsed")
    expect(
      screen
        .getByTestId("inner-sidebar")
        .getAttribute("data-viewer-sidebar-state")
    ).toBe("expanded")
  })

  it("infers trigger side from the registered sidebar", async () => {
    render(
      <ViewerRoot defaultOpen>
        <ViewerHeader>
          <ViewerSidebarTrigger data-testid="trigger" />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
          <ViewerSidebar side="right" data-testid="sidebar">
            Sidebar
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(screen.getByTestId("trigger").getAttribute("data-side")).toBe(
        "right"
      )
    })
    expect(screen.getByTestId("trigger").getAttribute("aria-controls")).toBe(
      screen.getByTestId("sidebar").id
    )
    expect(
      screen.getByTestId("trigger").querySelector("svg")?.getAttribute("class")
    ).toContain("lucide-panel-right")
  })

  it("lets ViewerRoot provide the default sidebar side", async () => {
    render(
      <ViewerRoot defaultOpen sidebarSide="right">
        <ViewerHeader>
          <ViewerSidebarTrigger data-testid="trigger" />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSurface>Surface</ViewerSurface>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(screen.getByTestId("sidebar").getAttribute("data-side")).toBe(
        "right"
      )
      expect(screen.getByTestId("trigger").getAttribute("data-side")).toBe(
        "right"
      )
    })
  })

  it("lets ViewerRoot provide the default sidebar collapsibility", async () => {
    render(
      <ViewerRoot sidebarCollapsible="none">
        <ViewerHeader>
          <ViewerSidebarTrigger data-testid="trigger" />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(
        screen.getByTestId("sidebar").getAttribute("data-collapsible")
      ).toBe("none")
    })
    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBeNull()
    expect(screen.getByTestId("trigger").getAttribute("aria-disabled")).toBe(
      "true"
    )
  })

  it("uses left trigger icon semantics for a left registered sidebar", async () => {
    render(
      <ViewerRoot defaultOpen>
        <ViewerHeader>
          <ViewerSidebarTrigger data-testid="trigger" />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(screen.getByTestId("trigger").getAttribute("data-side")).toBe(
        "left"
      )
    })
    expect(
      screen.getByTestId("trigger").querySelector("svg")?.getAttribute("class")
    ).toContain("lucide-panel-left")
  })

  it("uses a caller-provided sidebar id for trigger aria-controls", async () => {
    render(
      <ViewerRoot>
        <ViewerSidebarTrigger data-testid="trigger" />
        <ViewerBody>
          <ViewerSidebar id="pages-sidebar" data-testid="sidebar">
            Pages
          </ViewerSidebar>
          <ViewerSurface>Document</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(screen.getByTestId("trigger").getAttribute("aria-controls")).toBe(
        "pages-sidebar"
      )
    })
    expect(screen.getByTestId("sidebar").id).toBe("pages-sidebar")
  })

  it("lets custom trigger children override the default icon", async () => {
    render(
      <ViewerRoot>
        <ViewerSidebarTrigger data-testid="trigger">
          <span>Custom trigger</span>
        </ViewerSidebarTrigger>
        <ViewerBody>
          <ViewerSidebar>Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(screen.getByTestId("trigger").getAttribute("aria-disabled")).toBe(
        null
      )
    })
    expect(screen.getByTestId("trigger").textContent).toBe("Custom trigger")
  })

  it("prevents trigger actions when no sidebar is registered", () => {
    const onClick = vi.fn()

    render(
      <ViewerRoot>
        <ViewerSidebarTrigger data-testid="trigger" onClick={onClick} />
        <ViewerSurface>Surface</ViewerSurface>
      </ViewerRoot>
    )

    const trigger = screen.getByTestId("trigger")

    expect(trigger.getAttribute("aria-disabled")).toBe("true")
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
    expect(trigger.getAttribute("aria-controls")).toBeNull()
    expect(trigger.getAttribute("aria-expanded")).toBeNull()
    expect(
      screen.getByTestId("trigger").querySelector("svg")?.getAttribute("class")
    ).toContain("lucide-panel-left")
    fireEvent.click(trigger)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("reports non-collapsible sidebars as open and non-toggleable", async () => {
    function Probe() {
      const sidebar = useViewerSidebar()
      return (
        <div data-testid="sidebar-state">
          {sidebar.open ? "open" : "closed"}:{sidebar.state}:
          {sidebar.canToggleSidebar ? "toggleable" : "fixed"}
        </div>
      )
    }

    render(
      <ViewerRoot>
        <ViewerHeader>
          <ViewerSidebarTrigger data-testid="trigger" />
        </ViewerHeader>
        <Probe />
        <ViewerBody>
          <ViewerSidebar collapsible="none" data-testid="sidebar">
            Sidebar
          </ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state").textContent).toBe(
        "open:expanded:fixed"
      )
    })
    expect(
      screen.getByTestId("sidebar").getAttribute("data-viewer-sidebar-open")
    ).toBe("true")
    expect(screen.getByTestId("trigger").getAttribute("aria-disabled")).toBe(
      "true"
    )
    expect((screen.getByTestId("trigger") as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  it("enforces collapsed sidebar accessibility props over caller props", () => {
    render(
      <ViewerRoot>
        <ViewerBody>
          <ViewerSidebar
            aria-hidden={false}
            inert={false}
            data-testid="sidebar"
          >
            Sidebar
          </ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    const sidebar = screen.getByTestId("sidebar")

    expect(sidebar.getAttribute("data-viewer-sidebar-state")).toBe("collapsed")
    expect(sidebar.getAttribute("aria-hidden")).toBe("true")
    expect(sidebar.hasAttribute("inert")).toBe(true)
  })

  it("uses the sidebar width prop as the collapse width token", async () => {
    render(
      <ViewerRoot data-testid="root">
        <ViewerBody>
          <ViewerSidebar
            width="14rem"
            className="w-36"
            style={{ width: "4rem", backgroundColor: "red" }}
            data-testid="sidebar"
          >
            Sidebar
          </ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    await waitFor(() => {
      expect(
        screen
          .getByTestId("root")
          .style.getPropertyValue("--viewer-sidebar-width")
      ).toBe("14rem")
    })

    const sidebar = screen.getByTestId("sidebar")

    expect(sidebar.style.getPropertyValue("--viewer-sidebar-width")).toBe(
      "14rem"
    )
    expect(sidebar.style.width).toBe("")
    expect(sidebar.style.backgroundColor).toBe("red")
    expect(sidebar.className).toContain("w-(--viewer-sidebar-width)")
    expect(sidebar.className).not.toContain("w-36")
  })

  it("activates a conditional trigger when a sidebar later registers", async () => {
    function ConditionalViewer() {
      const [showSidebar, setShowSidebar] = React.useState(false)
      return (
        <ViewerRoot>
          <ViewerSidebarTrigger data-testid="trigger" />
          <button type="button" onClick={() => setShowSidebar(true)}>
            Show sidebar
          </button>
          <ViewerBody>
            {showSidebar ? (
              <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
            ) : null}
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )
    }

    render(<ConditionalViewer />)

    expect(screen.getByTestId("trigger").getAttribute("aria-disabled")).toBe(
      "true"
    )
    expect((screen.getByTestId("trigger") as HTMLButtonElement).disabled).toBe(
      true
    )
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }))

    await waitFor(() => {
      expect(screen.getByTestId("trigger").getAttribute("aria-disabled")).toBe(
        null
      )
      expect(
        (screen.getByTestId("trigger") as HTMLButtonElement).disabled
      ).toBe(false)
    })

    fireEvent.click(screen.getByTestId("trigger"))
    expect(
      screen.getByTestId("sidebar").getAttribute("data-viewer-sidebar-state")
    ).toBe("expanded")
  })

  it("rejects multiple sidebars in one root", () => {
    expect(() =>
      render(
        <ViewerRoot>
          <ViewerBody>
            <ViewerSidebar>First</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
            <ViewerSidebar>Second</ViewerSidebar>
          </ViewerBody>
        </ViewerRoot>
      )
    ).toThrow("ViewerRoot supports one primary ViewerSidebar")
  })

  it("does not emit controlled changes when open state is unchanged", () => {
    const onOpenChange = vi.fn()

    function CloseAgain() {
      const sidebar = useViewerSidebar()
      return (
        <button type="button" onClick={() => sidebar.setOpen(false)}>
          Close again
        </button>
      )
    }

    render(
      <ViewerRoot open={false} onOpenChange={onOpenChange}>
        <CloseAgain />
        <ViewerBody>
          <ViewerSidebar>Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    fireEvent.click(screen.getByRole("button", { name: "Close again" }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("does not emit controlled changes when opening an already open sidebar", () => {
    const onOpenChange = vi.fn()

    function OpenAgain() {
      const sidebar = useViewerSidebar()
      return (
        <button type="button" onClick={() => sidebar.setOpen(true)}>
          Open again
        </button>
      )
    }

    render(
      <ViewerRoot open onOpenChange={onOpenChange}>
        <OpenAgain />
        <ViewerBody>
          <ViewerSidebar>Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open again" }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("does not emit controlled changes for disabled or prevented trigger clicks", () => {
    const onOpenChange = vi.fn()
    const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
    })

    render(
      <ViewerRoot open={false} onOpenChange={onOpenChange}>
        <ViewerSidebarTrigger data-testid="prevented" onClick={onClick} />
        <ViewerSidebarTrigger data-testid="disabled" disabled />
        <ViewerBody>
          <ViewerSidebar>Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    fireEvent.click(screen.getByTestId("prevented"))
    fireEvent.click(screen.getByTestId("disabled"))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("closes an open overlay sidebar on Escape", () => {
    render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerSidebarTrigger data-testid="trigger" />
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBeNull()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.getByTestId("trigger").getAttribute("aria-expanded")).toBe(
      "false"
    )
    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  it("returns focus to the trigger when Escape closes an overlay sidebar", () => {
    render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerSidebarTrigger data-testid="trigger" />
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>
            <button type="button">Surface action</button>
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    screen.getByRole("button", { name: "Surface action" }).focus()
    expect(document.activeElement).not.toBe(screen.getByTestId("trigger"))

    fireEvent.keyDown(document, { key: "Escape" })

    expect(document.activeElement).toBe(screen.getByTestId("trigger"))
    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  it("does not trap focus inside an open overlay sidebar", () => {
    render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerBody>
          <ViewerSidebar>
            <button type="button">Sidebar action</button>
          </ViewerSidebar>
          <ViewerSurface>
            <button type="button">Surface action</button>
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    screen.getByRole("button", { name: "Sidebar action" }).focus()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Sidebar action" })
    )

    screen.getByRole("button", { name: "Surface action" }).focus()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Surface action" })
    )
  })

  it("classifies open overlay sidebars as non-modal", () => {
    render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">
            <button type="button">Sidebar action</button>
          </ViewerSidebar>
          <ViewerSurface data-testid="surface">
            <button type="button">Surface action</button>
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(screen.getByTestId("sidebar").getAttribute("aria-modal")).toBeNull()
    expect(screen.getByTestId("surface").hasAttribute("inert")).toBe(false)
    expect(
      screen
        .getByRole("button", { name: "Surface action" })
        .closest('[aria-hidden="true"]')
    ).toBeNull()
  })

  it("does not close an inline sidebar on Escape", () => {
    render(
      <ViewerRoot defaultOpen mode="inline">
        <ViewerSidebarTrigger data-testid="trigger" />
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.getByTestId("trigger").getAttribute("aria-expanded")).toBe(
      "true"
    )
    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBeNull()
  })

  it("lets the root trigger close an open overlay sidebar", () => {
    render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerSidebarTrigger data-testid="trigger" />
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    const trigger = screen.getByTestId("trigger")

    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  it("does not close an open overlay sidebar on inside pointer down", () => {
    render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">
            <button type="button">Sidebar action</button>
          </ViewerSidebar>
          <ViewerSurface>Surface</ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Sidebar action" })
    )

    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBeNull()
  })

  it("closes an open overlay sidebar on outside pointer down", () => {
    render(
      <ViewerRoot defaultOpen mode="overlay">
        <ViewerBody>
          <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
          <ViewerSurface>
            <button type="button">Surface action</button>
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    )

    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBeNull()

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Surface action" })
    )

    expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBe(
      "true"
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
        <ViewerRoot mode="auto" inlineBreakpoint={768}>
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

  it("keeps auto mode overlay when ResizeObserver is unavailable", () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const originalWindowResizeObserver = window.ResizeObserver

    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver
    window.ResizeObserver = undefined as unknown as typeof ResizeObserver

    function ModeProbe() {
      const sidebar = useViewerSidebar()
      return <div data-testid="mode">{sidebar.mode}</div>
    }

    try {
      render(
        <ViewerRoot mode="auto">
          <ModeProbe />
          <ViewerBody>
            <ViewerSidebar>Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )

      expect(screen.getByTestId("mode").textContent).toBe("overlay")
    } finally {
      globalThis.ResizeObserver = originalResizeObserver
      window.ResizeObserver = originalWindowResizeObserver
    }
  })

  it("ignores zero-width auto measurements", async () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const originalWindowResizeObserver = window.ResizeObserver
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect
    const callbacks: ResizeObserverCallback[] = []
    let width = 0

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
        <ViewerRoot mode="auto" inlineBreakpoint={768}>
          <ModeProbe />
          <ViewerBody>
            <ViewerSidebar>Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )

      act(() => {
        callbacks.forEach((callback) => callback([], {} as ResizeObserver))
      })

      expect(screen.getByTestId("mode").textContent).toBe("overlay")

      width = 1024
      act(() => {
        callbacks.forEach((callback) => callback([], {} as ResizeObserver))
      })

      await waitFor(() => {
        expect(screen.getByTestId("mode").textContent).toBe("inline")
      })
    } finally {
      globalThis.ResizeObserver = originalResizeObserver
      window.ResizeObserver = originalWindowResizeObserver
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect
    }
  })

  it("does not thrash auto mode around the breakpoint", async () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const originalWindowResizeObserver = window.ResizeObserver
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect
    const callbacks: ResizeObserverCallback[] = []
    let width = 800

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
        <ViewerRoot mode="auto" inlineBreakpoint={768}>
          <ModeProbe />
          <ViewerBody>
            <ViewerSidebar>Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )

      await waitFor(() => {
        expect(screen.getByTestId("mode").textContent).toBe("inline")
      })

      width = 760
      act(() => {
        callbacks.forEach((callback) => callback([], {} as ResizeObserver))
      })
      expect(screen.getByTestId("mode").textContent).toBe("inline")

      width = 740
      act(() => {
        callbacks.forEach((callback) => callback([], {} as ResizeObserver))
      })
      expect(screen.getByTestId("mode").textContent).toBe("overlay")

      width = 776
      act(() => {
        callbacks.forEach((callback) => callback([], {} as ResizeObserver))
      })
      expect(screen.getByTestId("mode").textContent).toBe("overlay")

      width = 790
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

  it("marks sidebar transitions ready after two animation frames", () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame
    const frameCallbacks: FrameRequestCallback[] = []

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    window.cancelAnimationFrame = vi.fn()

    try {
      render(
        <ViewerRoot>
          <ViewerBody>
            <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )

      const sidebar = screen.getByTestId("sidebar")
      expect(sidebar.hasAttribute("data-viewer-sidebar-transitions")).toBe(
        false
      )

      act(() => {
        frameCallbacks.shift()?.(0)
      })
      expect(sidebar.hasAttribute("data-viewer-sidebar-transitions")).toBe(
        false
      )

      act(() => {
        frameCallbacks.shift()?.(16)
      })
      expect(sidebar.getAttribute("data-viewer-sidebar-transitions")).toBe(
        "ready"
      )
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
    }
  })

  it("does not enable transition classes before a collapsed initial sidebar is ready", () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame
    const frameCallbacks: FrameRequestCallback[] = []

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    window.cancelAnimationFrame = vi.fn()

    try {
      render(
        <ViewerRoot>
          <ViewerBody>
            <ViewerSidebar data-testid="sidebar">Sidebar</ViewerSidebar>
            <ViewerSurface>Surface</ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      )

      const sidebar = screen.getByTestId("sidebar")
      expect(sidebar.getAttribute("data-viewer-sidebar-state")).toBe(
        "collapsed"
      )
      expect(sidebar.hasAttribute("data-viewer-sidebar-transitions")).toBe(
        false
      )
      expect(sidebar.className).toContain("transition-none")
      expect(sidebar.className).toContain(
        "data-[viewer-sidebar-transitions=ready]:transition-[translate,margin-left,margin-right,border-color]"
      )
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
    }
  })

  it("throws when the trigger is rendered outside ViewerRoot", () => {
    expect(() => render(<ViewerSidebarTrigger />)).toThrow(
      "ViewerSidebarTrigger must be used within a ViewerRoot."
    )
  })

  it("throws when the sidebar is rendered outside ViewerRoot", () => {
    expect(() => render(<ViewerSidebar />)).toThrow(
      "ViewerSidebar must be used within a ViewerRoot."
    )
  })
})
