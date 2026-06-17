// @vitest-environment jsdom
import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  SidebarListButton,
  SidebarListMenu,
  SidebarListMenuItem,
  SidebarListRoot,
} from "@/components/ui/sidebar-list"

const SIDEBAR_COOKIE_NAME = "sidebar_state"

function readSidebarCookie(): string | null {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
  if (!match) return null
  return match.slice(SIDEBAR_COOKIE_NAME.length + 1)
}

function clearSidebarCookie(): void {
  document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`
}

let mediaMatches = false
const mediaListeners = new Set<EventListenerOrEventListenerObject>()

function notifyMediaListener(listener: EventListenerOrEventListenerObject) {
  const event = { matches: mediaMatches } as MediaQueryListEvent
  if (typeof listener === "function") {
    listener(event)
    return
  }
  listener.handleEvent(event)
}

function installBrowserShims() {
  // SidebarContent renders a base-ui ScrollArea that calls getAnimations() on a
  // timer; jsdom does not implement it, so shim it to avoid unhandled errors.
  if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
    Element.prototype.getAnimations = () => []
  }
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.stubGlobal("matchMedia", (query: string) => {
    return {
      addEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject | null
      ) => {
        if (listener) mediaListeners.add(listener)
      },
      addListener: (listener: EventListenerOrEventListenerObject | null) => {
        if (listener) mediaListeners.add(listener)
      },
      dispatchEvent: () => true,
      matches: mediaMatches,
      media: query,
      onchange: null,
      removeEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject | null
      ) => {
        if (listener) mediaListeners.delete(listener)
      },
      removeListener: (listener: EventListenerOrEventListenerObject | null) => {
        if (listener) mediaListeners.delete(listener)
      },
    } as MediaQueryList
  })
}

function setMobileViewport(isMobile: boolean) {
  mediaMatches = isMobile
  mediaListeners.forEach(notifyMediaListener)
}

function renderSidebar(children: React.ReactNode, defaultOpen = true) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>{children}</SidebarProvider>
  )
}

function getTrigger(container: HTMLElement) {
  const trigger = container.querySelector('[data-sidebar="trigger"]')
  expect(trigger).toBeTruthy()
  return trigger as HTMLElement
}

function ContextProbe() {
  const { isMobile, open, openMobile, state } = useSidebar()

  return (
    <output
      data-ismobile={String(isMobile)}
      data-open={String(open)}
      data-openmobile={String(openMobile)}
      data-state={state}
    />
  )
}

function DoubleToggleButton() {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      onClick={() => {
        toggleSidebar()
        toggleSidebar()
      }}
      type="button"
    >
      Double toggle
    </button>
  )
}

function DoubleMobileSetterButton() {
  const { setOpenMobile } = useSidebar()
  // Stock shadcn narrows the context type to `(open: boolean) => void`, but the
  // underlying value is the raw React `useState` dispatcher, so functional
  // updaters still apply against the latest state at runtime. Cast to exercise
  // that here.
  const setOpenMobileFn = setOpenMobile as React.Dispatch<
    React.SetStateAction<boolean>
  >

  return (
    <button
      onClick={() => {
        setOpenMobileFn((open) => !open)
        setOpenMobileFn((open) => !open)
      }}
      type="button"
    >
      Double mobile setter
    </button>
  )
}

function ControlledSidebarHarness() {
  const [open, setOpen] = React.useState(false)

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <SidebarTrigger />
      <ContextProbe />
    </SidebarProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  mediaListeners.clear()
  mediaMatches = false
  clearSidebarCookie()
})

beforeEach(() => {
  clearSidebarCookie()
  installBrowserShims()
})

describe("SidebarProvider and useSidebar", () => {
  it("throws a clear error when the hook is used outside the provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    function BrokenConsumer() {
      useSidebar()
      return null
    }

    expect(() => render(<BrokenConsumer />)).toThrow(
      "useSidebar must be used within a SidebarProvider."
    )
    consoleError.mockRestore()
  })

  it("exposes default expanded state and provider CSS variables", () => {
    const { container } = renderSidebar(<ContextProbe />)

    const wrapper = container.querySelector('[data-slot="sidebar-wrapper"]')
    const probe = container.querySelector("output")

    expect(wrapper).toBeTruthy()
    expect(
      (wrapper as HTMLElement).style.getPropertyValue("--sidebar-width")
    ).toBe("16rem")
    expect(
      (wrapper as HTMLElement).style.getPropertyValue("--sidebar-width-icon")
    ).toBe("3rem")
    expect(probe?.getAttribute("data-state")).toBe("expanded")
    expect(probe?.getAttribute("data-open")).toBe("true")
    expect(probe?.getAttribute("data-ismobile")).toBe("false")
  })

  it("toggles desktop state from the trigger and persists the cookie", async () => {
    const onTriggerClick = vi.fn()
    const { container } = renderSidebar(
      <>
        <SidebarTrigger onClick={onTriggerClick} />
        <Sidebar collapsible="offcanvas">
          <SidebarRail />
        </Sidebar>
        <ContextProbe />
      </>
    )

    expect(
      container
        .querySelector('[data-slot="sidebar"]')
        ?.getAttribute("data-state")
    ).toBe("expanded")

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container
          .querySelector('[data-slot="sidebar"]')
          ?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(onTriggerClick).toHaveBeenCalledTimes(1)
    expect(readSidebarCookie()).toBe("false")
  })

  it("lets a custom trigger click handler prevent the built-in toggle", () => {
    const onTriggerClick = vi.fn(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
      }
    )
    const { container } = renderSidebar(
      <>
        <SidebarTrigger onClick={onTriggerClick} />
        <ContextProbe />
      </>
    )

    fireEvent.click(getTrigger(container))

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(readSidebarCookie()).toBeNull()
    expect(onTriggerClick).toHaveBeenCalledTimes(1)
  })

  it("toggles the sidebar from a trigger rendered inside a form via asChild", async () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
    })
    const { container } = render(
      <form onSubmit={onSubmit}>
        <SidebarProvider>
          <SidebarTrigger asChild>
            <button type="button">Toggle</button>
          </SidebarTrigger>
          <ContextProbe />
        </SidebarProvider>
      </form>
    )

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(getTrigger(container).getAttribute("type")).toBe("button")
  })

  it("renders the trigger as a link via asChild without button-only attributes", () => {
    const { container } = renderSidebar(
      <SidebarTrigger asChild>
        <a href="/nav">Navigate</a>
      </SidebarTrigger>
    )

    const trigger = getTrigger(container)
    expect(trigger.tagName).toBe("A")
    expect(trigger.getAttribute("href")).toBe("/nav")
    expect(trigger.getAttribute("type")).toBeNull()
  })

  it("toggles from the desktop rail without entering the tab order", async () => {
    const { container } = renderSidebar(
      <>
        <Sidebar collapsible="icon">
          <SidebarRail />
        </Sidebar>
        <ContextProbe />
      </>
    )

    const rail = screen.getByRole("button", { name: "Toggle Sidebar" })
    expect(rail.getAttribute("tabindex")).toBe("-1")

    fireEvent.click(rail)

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(readSidebarCookie()).toBe("false")
  })

  it("composes a custom rail click handler with the built-in toggle", async () => {
    // SidebarRail calls the consumer onClick first, then toggles unless the
    // handler prevented default, so a plain custom handler still collapses.
    const onRailClick = vi.fn()
    const { container } = renderSidebar(
      <>
        <Sidebar collapsible="icon">
          <SidebarRail onClick={onRailClick} />
        </Sidebar>
        <ContextProbe />
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(readSidebarCookie()).toBe("false")
    expect(onRailClick).toHaveBeenCalledTimes(1)
  })

  it("does not toggle from disabled trigger or rail controls", () => {
    const onTriggerClick = vi.fn()
    const onRailClick = vi.fn()
    const { container } = renderSidebar(
      <>
        <SidebarTrigger disabled onClick={onTriggerClick} />
        <Sidebar collapsible="icon">
          <SidebarRail disabled onClick={onRailClick} />
        </Sidebar>
        <ContextProbe />
      </>
    )

    fireEvent.click(getTrigger(container))
    fireEvent.click(container.querySelector('[data-sidebar="rail"]')!)

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(readSidebarCookie()).toBeNull()
    expect(onTriggerClick).not.toHaveBeenCalled()
    expect(onRailClick).not.toHaveBeenCalled()
  })

  it("uses ctrl/cmd+b as the desktop shortcut and ignores plain b", async () => {
    const { container } = renderSidebar(<ContextProbe />)

    fireEvent.keyDown(window, { key: "b" })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(readSidebarCookie()).toBeNull()

    fireEvent.keyDown(window, { ctrlKey: true, key: "b" })

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(readSidebarCookie()).toBe("false")
  })

  it("matches the shortcut key case-insensitively but still ignores a held shift", async () => {
    // The handler lowercases event.key, so ctrl+b reported as "B" (no shift)
    // still toggles; a genuine shift chord is filtered separately.
    const { container } = renderSidebar(<ContextProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: "B" })

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(readSidebarCookie()).toBe("false")

    fireEvent.keyDown(window, { ctrlKey: true, key: "B", shiftKey: true })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
  })

  it("ignores auto-repeated keyboard shortcut events", () => {
    // The handler guards event.repeat, so a held shortcut does not fire again.
    const { container } = renderSidebar(<ContextProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: "b", repeat: true })

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(readSidebarCookie()).toBeNull()
  })

  it("applies multiple synchronous uncontrolled toggles against the latest state", async () => {
    // setOpen tracks the latest value through a ref, so two synchronous toggles
    // resolve from the live state (true -> false -> true) and net to expanded.
    const { container } = renderSidebar(
      <>
        <DoubleToggleButton />
        <ContextProbe />
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "Double toggle" }))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("expanded")
    })
    expect(readSidebarCookie()).toBe("true")
  })

  it("suppresses the desktop shortcut while typing in editable fields", () => {
    // The handler guards editable targets, so ctrl/cmd+b inside an input neither
    // toggles nor calls preventDefault.
    const { container } = renderSidebar(
      <>
        <SidebarInput aria-label="Filter" />
        <ContextProbe />
      </>
    )

    const inputEvent = fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Filter" }),
      { ctrlKey: true, key: "b" }
    )

    // The handler skipped this target, so the event is not prevented.
    expect(inputEvent).toBe(true)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(readSidebarCookie()).toBeNull()
  })

  it("does not toggle when another handler already prevented the shortcut event", () => {
    // The handler checks event.defaultPrevented before toggling.
    const { container } = renderSidebar(
      <>
        <button onKeyDown={(event) => event.preventDefault()} type="button">
          Handled shortcut
        </button>
        <ContextProbe />
      </>
    )

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Handled shortcut" }),
      { ctrlKey: true, key: "b" }
    )

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(readSidebarCookie()).toBeNull()
  })

  it("removes the keyboard shortcut listener on unmount", () => {
    const { unmount } = renderSidebar(<ContextProbe />)

    unmount()
    fireEvent.keyDown(window, { ctrlKey: true, key: "b" })

    expect(readSidebarCookie()).toBeNull()
  })

  it("calls onOpenChange without mutating controlled desktop state", async () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <SidebarTrigger />
        <Sidebar />
        <ContextProbe />
      </SidebarProvider>
    )

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true)
    })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(readSidebarCookie()).toBe("true")
  })

  it("updates internal state and notifies onOpenChange when no open prop is set", async () => {
    // Without an `open` prop the sidebar is uncontrolled: it manages its own
    // state and still calls onOpenChange as a notification on each toggle.
    const onOpenChange = vi.fn()
    const { container } = render(
      <SidebarProvider defaultOpen onOpenChange={onOpenChange}>
        <SidebarTrigger />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(readSidebarCookie()).toBe("false")
  })

  it("derives repeated controlled toggles from the controlled open prop", async () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <SidebarTrigger />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(getTrigger(container))
    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledTimes(2)
    })
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true)
    expect(onOpenChange).toHaveBeenNthCalledWith(2, true)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
  })

  it("tracks controlled state after the parent applies onOpenChange", async () => {
    const { container } = render(<ControlledSidebarHarness />)

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("expanded")
    })

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    // Stock persists via document.cookie, so only the latest value remains.
    expect(readSidebarCookie()).toBe("false")
  })

  it("persists the sidebar state to document.cookie on toggle", async () => {
    document.cookie = "sidebar_state=; path=/; max-age=0"
    const { container } = renderSidebar(
      <>
        <SidebarTrigger />
        <ContextProbe />
      </>
    )

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(document.cookie).toContain("sidebar_state=false")
    expect(readSidebarCookie()).toBe("false")
  })
})

describe("Sidebar desktop and mobile rendering", () => {
  it("renders the non-collapsible sidebar as a simple full-width container", () => {
    const { container } = renderSidebar(
      <Sidebar collapsible="none" className="custom-sidebar">
        Static sidebar
      </Sidebar>
    )

    const sidebar = container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.textContent).toBe("Static sidebar")
    expect(sidebar?.getAttribute("data-state")).toBeNull()
    expect(sidebar?.className).toContain("custom-sidebar")
  })

  it("sets side, variant, and collapsible metadata on the desktop shell", async () => {
    const { container } = renderSidebar(
      <>
        <Sidebar side="right" variant="floating" collapsible="icon">
          <SidebarRail />
          Floating sidebar
        </Sidebar>
        <SidebarTrigger />
      </>
    )

    const sidebar = container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-side")).toBe("right")
    expect(sidebar?.getAttribute("data-variant")).toBe("floating")
    expect(sidebar?.getAttribute("data-collapsible")).toBe("")

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(sidebar?.getAttribute("data-state")).toBe("collapsed")
    })
    expect(sidebar?.getAttribute("data-collapsible")).toBe("icon")
  })

  it("forwards sidebar DOM props to the desktop sidebar container", () => {
    renderSidebar(
      <Sidebar
        className="custom-desktop-sidebar"
        data-testid="desktop-sidebar"
        style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
      >
        Desktop nav
      </Sidebar>
    )

    const sidebar = screen.getByTestId("desktop-sidebar")
    expect(sidebar.getAttribute("data-slot")).toBe("sidebar-container")
    expect(sidebar.className).toContain("custom-desktop-sidebar")
    expect(sidebar.style.getPropertyValue("--sidebar-width")).toBe("20rem")
    expect(sidebar.textContent).toBe("Desktop nav")
  })

  it("opens mobile content from the same trigger without writing the desktop cookie", async () => {
    setMobileViewport(true)

    const { container } = renderSidebar(
      <>
        <SidebarTrigger />
        <Sidebar>
          <SidebarHeader>Mobile nav</SidebarHeader>
        </Sidebar>
        <ContextProbe />
      </>
    )

    expect(
      container.querySelector("output")?.getAttribute("data-ismobile")
    ).toBe("true")
    expect(screen.queryByText("Mobile nav")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    expect(await screen.findByText("Mobile nav")).toBeTruthy()
    expect(
      container.querySelector("output")?.getAttribute("data-openmobile")
    ).toBe("true")
    expect(readSidebarCookie()).toBeNull()
    expect(document.querySelector('[data-mobile="true"]')).toBeTruthy()
  })

  it("uses the keyboard shortcut for mobile drawer state without writing the desktop cookie", async () => {
    setMobileViewport(true)

    const { container } = renderSidebar(
      <>
        <Sidebar>
          <SidebarHeader>Mobile nav</SidebarHeader>
        </Sidebar>
        <ContextProbe />
      </>
    )

    fireEvent.keyDown(window, { ctrlKey: true, key: "b" })

    expect(await screen.findByText("Mobile nav")).toBeTruthy()
    expect(
      container.querySelector("output")?.getAttribute("data-openmobile")
    ).toBe("true")
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(readSidebarCookie()).toBeNull()
  })

  it("does not call controlled desktop onOpenChange from mobile toggles", async () => {
    setMobileViewport(true)
    const onOpenChange = vi.fn()
    const { container } = render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <SidebarTrigger />
        <Sidebar>
          <SidebarHeader>Mobile nav</SidebarHeader>
        </Sidebar>
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    expect(await screen.findByText("Mobile nav")).toBeTruthy()
    expect(
      container.querySelector("output")?.getAttribute("data-openmobile")
    ).toBe("true")
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(readSidebarCookie()).toBeNull()
  })

  it("applies multiple synchronous mobile setter updates against latest state", async () => {
    setMobileViewport(true)

    const { container } = renderSidebar(
      <>
        <DoubleMobileSetterButton />
        <Sidebar>
          <SidebarHeader>Mobile nav</SidebarHeader>
        </Sidebar>
        <ContextProbe />
      </>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Double mobile setter" })
    )

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-openmobile")
      ).toBe("false")
    })
    expect(screen.queryByText("Mobile nav")).toBeNull()
  })

  it("renders the mobile sidebar popup with its content slot metadata", async () => {
    // Stock spreads sidebar props onto the Radix Sheet root (no DOM node), so
    // consumer className/style/testid are not forwarded to the popup; the popup
    // carries its own hardcoded slot attributes and the sidebar children.
    setMobileViewport(true)

    renderSidebar(
      <>
        <SidebarTrigger />
        <Sidebar>Mobile nav</Sidebar>
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    const mobileSidebar = await screen.findByText("Mobile nav")
    const popup = mobileSidebar.closest('[data-mobile="true"]')
    expect(popup).toBeTruthy()
    expect(popup?.getAttribute("data-slot")).toBe("sidebar")
    expect(popup?.getAttribute("data-sidebar")).toBe("sidebar")
  })

  it("resets mobile open state when returning to desktop", async () => {
    // An effect clears openMobile when leaving the mobile breakpoint so the
    // drawer flag does not leak across the transition.
    setMobileViewport(true)

    const { container } = renderSidebar(
      <>
        <SidebarTrigger />
        <Sidebar>
          <SidebarHeader>Mobile nav</SidebarHeader>
        </Sidebar>
        <ContextProbe />
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))
    expect(await screen.findByText("Mobile nav")).toBeTruthy()
    expect(
      container.querySelector("output")?.getAttribute("data-openmobile")
    ).toBe("true")

    act(() => setMobileViewport(false))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-ismobile")
      ).toBe("false")
    })
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-openmobile")
      ).toBe("false")
    })
  })
})

describe("Sidebar compound components", () => {
  it("renders providerless SidebarList rows outside SidebarProvider", () => {
    render(
      <SidebarListRoot>
        <SidebarListMenu>
          <SidebarListMenuItem>
            <SidebarListButton isActive>Inbox</SidebarListButton>
          </SidebarListMenuItem>
          <SidebarListMenuItem>
            <SidebarListButton asChild>
              <a href="/reports">Reports</a>
            </SidebarListButton>
          </SidebarListMenuItem>
        </SidebarListMenu>
      </SidebarListRoot>
    )

    const inbox = screen.getByRole("button", { name: "Inbox" })
    const reports = screen.getByRole("link", { name: "Reports" })

    expect(inbox.getAttribute("type")).toBe("button")
    expect(inbox.getAttribute("data-active")).toBe("true")
    expect(reports.getAttribute("href")).toBe("/reports")
  })

  it("renders expected slots for the standard sidebar layout", () => {
    const { container } = renderSidebar(
      <Sidebar>
        <SidebarHeader>Header</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Group</SidebarGroupLabel>
            <SidebarGroupAction aria-label="Add group" />
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive size="lg" variant="outline">
                    <span>Inbox</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction aria-label="More" showOnHover />
                  <SidebarMenuBadge>12</SidebarMenuBadge>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="/archive" isActive size="sm">
                        Archive
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarInput aria-label="Filter" defaultValue="query" />
        </SidebarFooter>
        <SidebarInset>Inset</SidebarInset>
      </Sidebar>
    )

    expect(
      container.querySelector('[data-sidebar="header"]')?.textContent
    ).toBe("Header")
    expect(container.querySelector('[data-sidebar="content"]')).toBeTruthy()
    expect(
      container.querySelector('[data-sidebar="group-label"]')?.textContent
    ).toBe("Group")
    expect(screen.getByRole("button", { name: "Add group" })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Inbox" }).getAttribute("data-active")
    ).toBe("true")
    expect(
      screen.getByRole("button", { name: "Inbox" }).getAttribute("data-size")
    ).toBe("lg")
    expect(
      screen.getByRole("button", { name: "More" }).getAttribute("data-sidebar")
    ).toBe("menu-action")
    expect(
      container.querySelector('[data-sidebar="menu-badge"]')?.textContent
    ).toBe("12")
    expect(
      screen.getByRole("link", { name: "Archive" }).getAttribute("data-active")
    ).toBe("true")
    expect(screen.getByRole("textbox", { name: "Filter" })).toHaveProperty(
      "value",
      "query"
    )
    expect(
      container.querySelector('[data-slot="sidebar-inset"]')?.textContent
    ).toBe("Inset")
  })

  it("forwards asChild props to menu buttons without nesting buttons", () => {
    renderSidebar(
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive>
            <a href="/settings">
              <span>Settings</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuSubButton asChild>
            <a href="/billing">Billing</a>
          </SidebarMenuSubButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a href="/reports">Reports</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuSubButton asChild>
            <a href="/teams">Teams</a>
          </SidebarMenuSubButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )

    const settings = screen.getByRole("link", { name: "Settings" })
    const billing = screen.getByRole("link", { name: "Billing" })
    const reports = screen.getByRole("link", { name: "Reports" })
    const teams = screen.getByRole("link", { name: "Teams" })

    expect(settings.getAttribute("href")).toBe("/settings")
    expect(settings.getAttribute("data-sidebar")).toBe("menu-button")
    expect(settings.getAttribute("data-active")).toBe("true")
    expect(settings.getAttribute("type")).toBeNull()
    expect(settings.querySelector("button")).toBeNull()
    expect(billing.getAttribute("href")).toBe("/billing")
    expect(billing.getAttribute("data-sidebar")).toBe("menu-sub-button")
    expect(reports.getAttribute("data-sidebar")).toBe("menu-button")
    expect(reports.getAttribute("type")).toBeNull()
    expect(teams.getAttribute("data-sidebar")).toBe("menu-sub-button")
    expect(teams.getAttribute("type")).toBeNull()
  })

  it("preserves menu button metadata when wrapped with a tooltip", () => {
    renderSidebar(
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Open inbox">Inbox</SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>,
      false
    )

    const button = screen.getByRole("button", { name: "Inbox" })
    expect(button.getAttribute("data-sidebar")).toBe("menu-button")
    expect(button.getAttribute("data-slot")).toBe("sidebar-menu-button")
    expect(button.getAttribute("type")).toBe("button")
  })

  it("does not submit parent forms from sidebar button primitives", () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
    })

    renderSidebar(
      <form onSubmit={onSubmit}>
        <SidebarGroup>
          <SidebarGroupAction aria-label="Group action" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Menu item</SidebarMenuButton>
              <SidebarMenuAction aria-label="Menu action" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </form>
    )

    fireEvent.click(screen.getByRole("button", { name: "Group action" }))
    fireEvent.click(screen.getByRole("button", { name: "Menu item" }))
    fireEvent.click(screen.getByRole("button", { name: "Menu action" }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Group action" }).getAttribute("type")
    ).toBe("button")
    expect(
      screen.getByRole("button", { name: "Menu item" }).getAttribute("type")
    ).toBe("button")
    expect(
      screen.getByRole("button", { name: "Menu action" }).getAttribute("type")
    ).toBe("button")
  })

  it("preserves explicit button types on asChild sidebar buttons in a form", () => {
    // With asChild, the consumer owns the rendered element; a deliberate
    // type="button" is preserved so the control does not submit the form.
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
    })

    renderSidebar(
      <form onSubmit={onSubmit}>
        <SidebarGroup>
          <SidebarGroupAction asChild aria-label="As child group action">
            <button type="button" />
          </SidebarGroupAction>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button type="button">As child menu item</button>
              </SidebarMenuButton>
              <SidebarMenuAction asChild aria-label="As child menu action">
                <button type="button" />
              </SidebarMenuAction>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild>
                    <button type="button">As child submenu item</button>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </form>
    )

    const names = [
      "As child group action",
      "As child menu item",
      "As child menu action",
      "As child submenu item",
    ]
    for (const name of names) {
      fireEvent.click(screen.getByRole("button", { name }))
    }

    expect(onSubmit).not.toHaveBeenCalled()
    for (const name of names) {
      expect(screen.getByRole("button", { name }).getAttribute("type")).toBe(
        "button"
      )
    }
  })

  it("keeps skeleton width stable across rerenders and within documented bounds", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5)

    const { container, rerender } = renderSidebar(
      <SidebarMenuSkeleton showIcon data-testid="skeleton" />
    )
    const text = container.querySelector('[data-sidebar="menu-skeleton-text"]')

    expect(
      container.querySelector('[data-sidebar="menu-skeleton-icon"]')
    ).toBeTruthy()
    expect(text).toBeTruthy()
    expect(
      (text as HTMLElement).style.getPropertyValue("--skeleton-width")
    ).toBe("70%")

    rerender(
      <SidebarProvider>
        <SidebarMenuSkeleton showIcon data-testid="skeleton" />
      </SidebarProvider>
    )

    expect(
      (
        container.querySelector(
          '[data-sidebar="menu-skeleton-text"]'
        ) as HTMLElement
      ).style.getPropertyValue("--skeleton-width")
    ).toBe("70%")
    expect(Math.random).toHaveBeenCalledTimes(1)
  })
})
