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

type CookieSetOptions = {
  expires: number
  name: string
  path: string
  value: string
}

const cookieSet = vi.fn(async (_options: CookieSetOptions) => {})
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

function installBrowserShims({ withCookieStore = true } = {}) {
  if (withCookieStore) {
    vi.stubGlobal("cookieStore", { set: cookieSet })
  } else {
    vi.stubGlobal("cookieStore", undefined)
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

  return (
    <button
      onClick={() => {
        setOpenMobile((open) => !open)
        setOpenMobile((open) => !open)
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
})

beforeEach(() => {
  cookieSet.mockClear()
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
    expect(cookieSet).toHaveBeenCalledWith({
      expires: expect.any(Number),
      name: "sidebar_state",
      path: "/",
      value: "false",
    })
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
    expect(cookieSet).not.toHaveBeenCalled()
    expect(onTriggerClick).toHaveBeenCalledTimes(1)
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
    expect(cookieSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: "false" })
    )
  })

  it("composes a custom rail click handler with the built-in toggle", async () => {
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
    expect(onRailClick).toHaveBeenCalledTimes(1)
  })

  it("lets a custom rail click handler prevent the built-in toggle", () => {
    const onRailClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
    })
    const { container } = renderSidebar(
      <>
        <Sidebar collapsible="icon">
          <SidebarRail onClick={onRailClick} />
        </Sidebar>
        <ContextProbe />
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
    expect(onRailClick).toHaveBeenCalledTimes(1)
  })

  it("uses ctrl/cmd+b as the desktop shortcut and ignores plain b", async () => {
    const { container } = renderSidebar(<ContextProbe />)

    fireEvent.keyDown(window, { key: "b" })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { ctrlKey: true, key: "b" })

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(cookieSet).toHaveBeenCalledTimes(1)
  })

  it("treats the keyboard shortcut key case-insensitively", async () => {
    const { container } = renderSidebar(<ContextProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: "B" })

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(cookieSet).toHaveBeenCalledTimes(1)
  })

  it("ignores repeated keyboard shortcut events", () => {
    const { container } = renderSidebar(<ContextProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: "b", repeat: true })

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("applies multiple synchronous uncontrolled toggles against latest state", async () => {
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
    expect(cookieSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ value: "false" })
    )
    expect(cookieSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ value: "true" })
    )
  })

  it("does not hijack the desktop shortcut while typing in editable fields", () => {
    const { container } = renderSidebar(
      <>
        <SidebarInput aria-label="Filter" />
        <div
          aria-label="Document title"
          contentEditable
          role="textbox"
          suppressContentEditableWarning
        >
          Editable document title
        </div>
        <ContextProbe />
      </>
    )

    const inputEvent = fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Filter" }),
      { ctrlKey: true, key: "b" }
    )
    const editorEvent = fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Document title" }),
      { metaKey: true, key: "b" }
    )

    expect(inputEvent).toBe(true)
    expect(editorEvent).toBe(true)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("does not toggle when another key handler already prevented the shortcut", () => {
    const { container } = renderSidebar(
      <>
        <button onKeyDown={(event) => event.preventDefault()} type="button">
          Handled shortcut
        </button>
        <ContextProbe />
      </>
    )

    const keyEvent = fireEvent.keyDown(
      screen.getByRole("button", { name: "Handled shortcut" }),
      { ctrlKey: true, key: "b" }
    )

    expect(keyEvent).toBe(false)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
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
    expect(cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({ value: "true" })
    )
  })

  it("updates internal state when uncontrolled with onOpenChange", async () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <SidebarProvider defaultOpen onOpenChange={onOpenChange}>
        <SidebarTrigger />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({ value: "false" })
    )
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
    expect(cookieSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ value: "true" })
    )
    expect(cookieSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ value: "false" })
    )
  })

  it("keeps toggling when the browser does not support cookieStore", async () => {
    vi.unstubAllGlobals()
    installBrowserShims({ withCookieStore: false })
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
  })

  it("keeps toggling when cookieStore rejects a write", async () => {
    cookieSet.mockRejectedValueOnce(new Error("cookie write denied"))
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
    expect(cookieSet).toHaveBeenCalledTimes(1)
  })

  it("keeps toggling when cookieStore throws synchronously", async () => {
    cookieSet.mockImplementationOnce(() => {
      throw new Error("cookie store unavailable")
    })
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
    expect(cookieSet).toHaveBeenCalledTimes(1)
  })

  it("keeps toggling when cookieStore returns a non-promise value", async () => {
    cookieSet.mockReturnValueOnce(undefined as never)
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
    expect(cookieSet).toHaveBeenCalledTimes(1)
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
    expect(sidebar?.getAttribute("data-sidebar")).toBe("sidebar")
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
    expect(cookieSet).not.toHaveBeenCalled()
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
    expect(cookieSet).not.toHaveBeenCalled()
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

  it("forwards sidebar DOM props to the mobile sidebar popup", async () => {
    setMobileViewport(true)

    renderSidebar(
      <>
        <SidebarTrigger />
        <Sidebar
          className="custom-mobile-sidebar"
          data-testid="mobile-sidebar"
          style={{ "--sidebar-width": "21rem" } as React.CSSProperties}
        >
          Mobile nav
        </Sidebar>
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    const mobileSidebar = await screen.findByTestId("mobile-sidebar")
    expect(mobileSidebar.getAttribute("data-mobile")).toBe("true")
    expect(mobileSidebar.className).toContain("custom-mobile-sidebar")
    expect(mobileSidebar.style.getPropertyValue("--sidebar-width")).toBe(
      "21rem"
    )
  })

  it("clears stale mobile open state after returning to desktop", async () => {
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
    expect(
      container.querySelector("output")?.getAttribute("data-openmobile")
    ).toBe("false")
  })
})

describe("Sidebar compound components", () => {
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

  it("forwards asChild/render props to menu buttons without nesting buttons", () => {
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
      </SidebarMenu>
    )

    const settings = screen.getByRole("link", { name: "Settings" })
    const billing = screen.getByRole("link", { name: "Billing" })

    expect(settings.getAttribute("href")).toBe("/settings")
    expect(settings.getAttribute("data-sidebar")).toBe("menu-button")
    expect(settings.getAttribute("data-active")).toBe("true")
    expect(settings.querySelector("button")).toBeNull()
    expect(billing.getAttribute("href")).toBe("/billing")
    expect(billing.getAttribute("data-sidebar")).toBe("menu-sub-button")
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
