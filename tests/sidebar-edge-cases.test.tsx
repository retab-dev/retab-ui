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

// ---------------------------------------------------------------------------
// Shared browser shims (mirrors tests/sidebar.test.tsx so the two suites can
// run independently).
// ---------------------------------------------------------------------------

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

function installBrowserShims() {
  vi.stubGlobal("cookieStore", { set: cookieSet })
  // base-ui's ScrollArea (used by SidebarContent) calls getAnimations() on a
  // timer; jsdom does not implement it. Shim it so its cleanup does not raise
  // unhandled errors that Vitest reports as potential false positives.
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

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  mediaListeners.clear()
  mediaMatches = false
})

beforeEach(() => {
  cookieSet.mockClear()
  installBrowserShims()
})

// ---------------------------------------------------------------------------
// Provider state and props
// ---------------------------------------------------------------------------

describe("SidebarProvider initial state and props", () => {
  it("starts collapsed when defaultOpen is false and persists true on first toggle", async () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <SidebarTrigger />
        <ContextProbe />
      </SidebarProvider>
    )

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(cookieSet).not.toHaveBeenCalled()

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("expanded")
    })
    expect(cookieSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: "true" })
    )
  })

  it("lets a controlled open prop win over defaultOpen", () => {
    const { container } = render(
      <SidebarProvider defaultOpen open={false} onOpenChange={() => {}}>
        <ContextProbe />
      </SidebarProvider>
    )

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(container.querySelector("output")?.getAttribute("data-open")).toBe(
      "false"
    )
  })

  it("reacts to external controlled open changes without a user gesture", () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <SidebarProvider open={open} onOpenChange={() => {}}>
          <ContextProbe />
        </SidebarProvider>
      )
    }

    const { container, rerender } = render(<Harness open={false} />)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )

    rerender(<Harness open />)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    // Externally driven prop changes must not write the cookie.
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("lets a caller style override the provider CSS variables", () => {
    const { container } = render(
      <SidebarProvider
        data-testid="wrapper"
        style={{ "--sidebar-width": "30rem" } as React.CSSProperties}
      >
        <ContextProbe />
      </SidebarProvider>
    )

    const wrapper = container.querySelector(
      '[data-slot="sidebar-wrapper"]'
    ) as HTMLElement
    expect(wrapper.getAttribute("data-testid")).toBe("wrapper")
    expect(wrapper.style.getPropertyValue("--sidebar-width")).toBe("30rem")
    // The icon width default still comes through.
    expect(wrapper.style.getPropertyValue("--sidebar-width-icon")).toBe("3rem")
  })

  it("keeps two providers isolated", async () => {
    function Pair() {
      return (
        <>
          <SidebarProvider defaultOpen>
            <SidebarTrigger />
            <output data-testid="a" data-state-probe="" />
            <StateMirror id="a" />
          </SidebarProvider>
          <SidebarProvider defaultOpen>
            <StateMirror id="b" />
          </SidebarProvider>
        </>
      )
    }
    function StateMirror({ id }: { id: string }) {
      const { state } = useSidebar()
      return <span data-testid={`state-${id}`}>{state}</span>
    }

    render(<Pair />)
    expect(screen.getByTestId("state-a").textContent).toBe("expanded")
    expect(screen.getByTestId("state-b").textContent).toBe("expanded")

    fireEvent.click(getTrigger(document.body))

    await waitFor(() => {
      expect(screen.getByTestId("state-a").textContent).toBe("collapsed")
    })
    // The second provider must not move.
    expect(screen.getByTestId("state-b").textContent).toBe("expanded")
  })
})

// ---------------------------------------------------------------------------
// setOpen exposed through context
// ---------------------------------------------------------------------------

describe("useSidebar().setOpen", () => {
  it("persists the cookie even when setting the same value it already has", async () => {
    function SetOpenTrue() {
      const { setOpen } = useSidebar()
      return (
        <button onClick={() => setOpen(true)} type="button">
          Set open true
        </button>
      )
    }

    const { container } = render(
      <SidebarProvider defaultOpen>
        <SetOpenTrue />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Set open true" }))

    await waitFor(() => {
      expect(cookieSet).toHaveBeenCalledWith(
        expect.objectContaining({ value: "true" })
      )
    })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
  })

  it("accepts a direct boolean value (not just an updater)", async () => {
    function SetOpenFalse() {
      const { setOpen } = useSidebar()
      return (
        <button onClick={() => setOpen(false)} type="button">
          Close
        </button>
      )
    }

    const { container } = render(
      <SidebarProvider defaultOpen>
        <SetOpenFalse />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(cookieSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: "false" })
    )
  })
})

// ---------------------------------------------------------------------------
// Keyboard shortcut edge cases
// ---------------------------------------------------------------------------

describe("keyboard shortcut edge cases", () => {
  it("toggles on meta+b at the window level", async () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.keyDown(window, { key: "b", metaKey: true })

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
  })

  it("ignores shift+b and alt+b without ctrl/meta", () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.keyDown(window, { key: "b", shiftKey: true })
    fireEvent.keyDown(window, { key: "b", altKey: true })
    fireEvent.keyDown(window, { key: "B", shiftKey: true })

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("ignores ctrl chords for other keys", () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    fireEvent.keyDown(window, { key: "a", metaKey: true })

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("suppresses the shortcut for a non-editable child inside a contenteditable region", () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <div contentEditable suppressContentEditableWarning role="textbox">
          <span data-testid="inner-span">nested text</span>
        </div>
        <ContextProbe />
      </SidebarProvider>
    )

    const handled = fireEvent.keyDown(screen.getByTestId("inner-span"), {
      key: "b",
      ctrlKey: true,
    })

    expect(handled).toBe(true)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  // NOTE: the "contenteditable=false should still fire the shortcut" path
  // cannot be exercised under jsdom — jsdom implements neither
  // `.contentEditable` nor `.isContentEditable` (both return `undefined`), so
  // the component's `editableParent.contentEditable !== "false"` guard reads
  // `undefined !== "false"` → true and over-suppresses. The behavior is
  // correct in real browsers; it is just not observable here.

  it("routes the keyboard shortcut through controlled onOpenChange", async () => {
    const onOpenChange = vi.fn()
    render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.keyDown(window, { key: "b", ctrlKey: true })

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true)
    })
    // Controlled: still no cookie write expected via the shortcut path either.
  })
})

// ---------------------------------------------------------------------------
// Cross-viewport flows
// ---------------------------------------------------------------------------

describe("desktop/mobile interplay", () => {
  it("preserves the desktop collapsed state across a mobile round trip", async () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger />
        <Sidebar>
          <SidebarContent>Nav</SidebarContent>
        </Sidebar>
        <ContextProbe />
      </SidebarProvider>
    )

    // Collapse on desktop.
    fireEvent.click(getTrigger(container))
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })

    // Go mobile and open the drawer.
    act(() => setMobileViewport(true))
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-openmobile")
      ).toBe("true")
    })

    // Return to desktop. Mobile state resets; desktop stays collapsed.
    act(() => setMobileViewport(false))
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-ismobile")
      ).toBe("false")
    })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(
      container.querySelector("output")?.getAttribute("data-openmobile")
    ).toBe("false")
  })

  it("renders collapsible=none as a plain container even on mobile (no Sheet)", () => {
    setMobileViewport(true)
    const { container } = render(
      <SidebarProvider>
        <Sidebar collapsible="none">Static</Sidebar>
        <ContextProbe />
      </SidebarProvider>
    )

    const sidebar = container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.textContent).toBe("Static")
    expect(sidebar?.getAttribute("data-mobile")).toBeNull()
    expect(document.querySelector('[data-mobile="true"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Primitive default attributes
// ---------------------------------------------------------------------------

describe("sidebar primitive defaults", () => {
  it("gives SidebarMenuButton button defaults", () => {
    render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>Inbox</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>
    )

    const button = screen.getByRole("button", { name: "Inbox" })
    expect(button.tagName).toBe("BUTTON")
    expect(button.getAttribute("type")).toBe("button")
    expect(button.getAttribute("data-active")).toBe("false")
    expect(button.getAttribute("data-size")).toBe("default")
    expect(button.getAttribute("data-slot")).toBe("sidebar-menu-button")
  })

  it("renders SidebarMenuSubButton as an anchor with no button type", () => {
    render(
      <SidebarProvider>
        <SidebarMenuSubButton href="/sub">Child</SidebarMenuSubButton>
      </SidebarProvider>
    )

    const link = screen.getByRole("link", { name: "Child" })
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("type")).toBeNull()
    expect(link.getAttribute("data-size")).toBe("md")
    expect(link.getAttribute("data-active")).toBe("false")
  })

  it("adds hover-reveal classes to SidebarMenuAction only when showOnHover", () => {
    render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuAction aria-label="Plain action" />
            <SidebarMenuAction aria-label="Hover action" showOnHover />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>
    )

    const plain = screen.getByRole("button", { name: "Plain action" })
    const hover = screen.getByRole("button", { name: "Hover action" })
    expect(plain.className).not.toContain("md:opacity-0")
    expect(hover.className).toContain("md:opacity-0")
  })

  it("renders SidebarGroupLabel with a custom element via render", () => {
    render(
      <SidebarProvider>
        <SidebarGroup>
          <SidebarGroupLabel render={<h2 />}>Projects</SidebarGroupLabel>
        </SidebarGroup>
      </SidebarProvider>
    )

    const label = screen.getByRole("heading", { name: "Projects" })
    expect(label.tagName).toBe("H2")
    expect(label.getAttribute("data-sidebar")).toBe("group-label")
  })

  it("forwards arbitrary props through SidebarContent to the inner content node", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarContent data-testid="content" className="custom-content">
          Body
        </SidebarContent>
      </SidebarProvider>
    )

    const content = container.querySelector('[data-sidebar="content"]')
    expect(content?.getAttribute("data-testid")).toBe("content")
    expect(content?.className).toContain("custom-content")
    expect(content?.textContent).toBe("Body")
  })

  it("respects an explicit type on a SidebarTrigger render element", () => {
    // The component should not clobber a type the caller set deliberately.
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <SidebarProvider>
          <SidebarTrigger render={<button type="submit" />} />
        </SidebarProvider>
      </form>
    )

    expect(getTrigger(document.body).getAttribute("type")).toBe("submit")
  })
})

// ---------------------------------------------------------------------------
// Additional bug-hunt coverage
// ---------------------------------------------------------------------------

describe("sidebar bug-hunt coverage", () => {
  it("sets the cookie expiry to seven days from the toggle time", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-12T12:00:00.000Z"))

    const { container } = render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(getTrigger(container))

    expect(cookieSet).toHaveBeenCalledTimes(1)
    expect(cookieSet).toHaveBeenCalledWith({
      expires: new Date("2026-06-19T12:00:00.000Z").getTime(),
      name: "sidebar_state",
      path: "/",
      value: "false",
    })
  })

  it("does not toggle from a loading trigger", () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger loading />
        <ContextProbe />
      </SidebarProvider>
    )

    const trigger = getTrigger(container)
    expect(trigger).toHaveProperty("disabled", true)
    expect(trigger.getAttribute("aria-disabled")).toBe("true")

    fireEvent.click(trigger)

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("toggles from a rendered trigger link and keeps link semantics", async () => {
    const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
    })

    const { container } = render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger
          onClick={onClick}
          render={<a href="#navigation" />}
        />
        <ContextProbe />
      </SidebarProvider>
    )

    const trigger = getTrigger(container)
    expect(trigger.tagName).toBe("A")
    expect(trigger.getAttribute("href")).toBe("#navigation")
    expect(trigger.getAttribute("type")).toBeNull()

    fireEvent.click(trigger)

    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("expanded")
    })
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("lets a rendered trigger link toggle when its handler does not prevent default", async () => {
    const onClick = vi.fn()

    const { container } = render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger
          onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
          render={<span role="button" tabIndex={0} />}
        />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(cookieSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: "false" })
    )
  })

  it("closes the mobile sidebar through the sheet close button", async () => {
    setMobileViewport(true)

    const { container } = render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger />
        <Sidebar>
          <SidebarHeader>Mobile navigation</SidebarHeader>
        </Sidebar>
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))
    expect(await screen.findByText("Mobile navigation")).toBeTruthy()
    expect(
      container.querySelector("output")?.getAttribute("data-openmobile")
    ).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-openmobile")
      ).toBe("false")
    })
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("does not write a desktop cookie when mobile sheet close changes open state", async () => {
    setMobileViewport(true)

    render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger />
        <Sidebar>
          <SidebarHeader>Mobile navigation</SidebarHeader>
        </Sidebar>
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))
    expect(await screen.findByText("Mobile navigation")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(screen.queryByText("Mobile navigation")).toBeNull()
    })
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("removes the media query listener when the provider unmounts", () => {
    const { unmount } = render(
      <SidebarProvider>
        <ContextProbe />
      </SidebarProvider>
    )

    expect(mediaListeners.size).toBe(1)
    unmount()
    expect(mediaListeners.size).toBe(0)
  })

  it("does not reset uncontrolled state when defaultOpen changes after mount", async () => {
    function Harness({ defaultOpen }: { defaultOpen: boolean }) {
      return (
        <SidebarProvider defaultOpen={defaultOpen}>
          <SidebarTrigger />
          <ContextProbe />
        </SidebarProvider>
      )
    }

    const { container, rerender } = render(<Harness defaultOpen />)
    fireEvent.click(getTrigger(container))
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })

    rerender(<Harness defaultOpen={false} />)

    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
  })

  it("prevents the browser default for the handled shortcut", async () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <ContextProbe />
      </SidebarProvider>
    )

    const handled = fireEvent.keyDown(window, { ctrlKey: true, key: "b" })

    expect(handled).toBe(false)
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
  })

  it("does not treat ctrl+alt+b as the sidebar shortcut", () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <ContextProbe />
      </SidebarProvider>
    )

    const handled = fireEvent.keyDown(window, {
      altKey: true,
      ctrlKey: true,
      key: "b",
    })

    expect(handled).toBe(true)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("does not treat meta+alt+b as the sidebar shortcut", () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <ContextProbe />
      </SidebarProvider>
    )

    const handled = fireEvent.keyDown(window, {
      altKey: true,
      key: "b",
      metaKey: true,
    })

    expect(handled).toBe(true)
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "expanded"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("routes the shortcut through the latest desktop/mobile mode", async () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <Sidebar>
          <SidebarHeader>Mobile navigation</SidebarHeader>
        </Sidebar>
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.keyDown(window, { ctrlKey: true, key: "b" })
    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-state")
      ).toBe("collapsed")
    })
    expect(cookieSet).toHaveBeenCalledTimes(1)

    cookieSet.mockClear()
    act(() => setMobileViewport(true))
    fireEvent.keyDown(window, { ctrlKey: true, key: "b" })

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-openmobile")
      ).toBe("true")
    })
    expect(container.querySelector("output")?.getAttribute("data-state")).toBe(
      "collapsed"
    )
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("clears openMobile if a consumer sets it while on desktop", async () => {
    function OpenMobileFromDesktop() {
      const { setOpenMobile } = useSidebar()
      return (
        <button onClick={() => setOpenMobile(true)} type="button">
          Open mobile
        </button>
      )
    }

    const { container } = render(
      <SidebarProvider defaultOpen>
        <OpenMobileFromDesktop />
        <ContextProbe />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open mobile" }))

    await waitFor(() => {
      expect(
        container.querySelector("output")?.getAttribute("data-openmobile")
      ).toBe("false")
    })
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("uses the default mobile sidebar width unless the caller overrides it", async () => {
    setMobileViewport(true)

    render(
      <SidebarProvider>
        <SidebarTrigger />
        <Sidebar data-testid="mobile-sidebar">Mobile nav</Sidebar>
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    const mobileSidebar = await screen.findByTestId("mobile-sidebar")
    expect(mobileSidebar.style.getPropertyValue("--sidebar-width")).toBe(
      "18rem"
    )
  })

  it("keeps sidebar DOM metadata stable for right offcanvas collapse", async () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="offcanvas" side="right" variant="sidebar">
          <SidebarRail />
          Right nav
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    const shell = container.querySelector('[data-slot="sidebar"]')
    const gap = container.querySelector('[data-slot="sidebar-gap"]')
    const panel = container.querySelector('[data-slot="sidebar-container"]')
    const inner = container.querySelector('[data-slot="sidebar-inner"]')
    expect(shell?.getAttribute("data-side")).toBe("right")
    expect(shell?.getAttribute("data-collapsible")).toBe("")
    expect(gap?.className).toContain("group-data-[side=right]:rotate-180")
    expect(panel?.className).toContain("right-0")
    expect(inner?.textContent).toContain("Right nav")

    fireEvent.click(getTrigger(container))

    await waitFor(() => {
      expect(shell?.getAttribute("data-state")).toBe("collapsed")
    })
    expect(shell?.getAttribute("data-collapsible")).toBe("offcanvas")
  })

  it("forwards props and structure through every layout primitive", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar collapsible="none" data-testid="static" style={{ color: "red" }}>
          <SidebarHeader data-testid="header">Header</SidebarHeader>
          <SidebarContent data-testid="content">Content</SidebarContent>
          <SidebarFooter data-testid="footer">Footer</SidebarFooter>
          <SidebarSeparator data-testid="separator" />
        </Sidebar>
      </SidebarProvider>
    )

    expect(screen.getByTestId("static").style.color).toBe("red")
    expect(screen.getByTestId("header").getAttribute("data-sidebar")).toBe(
      "header"
    )
    expect(screen.getByTestId("content").getAttribute("data-sidebar")).toBe(
      "content"
    )
    expect(screen.getByTestId("footer").getAttribute("data-sidebar")).toBe(
      "footer"
    )
    expect(
      screen.getByTestId("separator").getAttribute("data-sidebar")
    ).toBe("separator")
    expect(container.querySelectorAll("[data-sidebar]").length).toBeGreaterThan(
      4
    )
  })

  it("does not put button-only attributes on rendered action links", () => {
    render(
      <SidebarProvider>
        <SidebarGroup>
          <SidebarGroupAction
            aria-label="Group link"
            render={<a href="/group" />}
          />
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<a href="/button-link" />}>
                  Button link
                </SidebarMenuButton>
                <SidebarMenuAction
                  aria-label="Menu action link"
                  render={<a href="/action" />}
                />
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="/sub-link">
                      Sub link
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarProvider>
    )

    for (const name of ["Group link", "Button link", "Menu action link"]) {
      const link = screen.getByRole("link", { name })
      expect(link.getAttribute("type")).toBeNull()
    }
    expect(screen.getByRole("link", { name: "Sub link" }).tagName).toBe("A")
  })

  it("preserves deliberate submit types on rendered sidebar buttons", () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
    })

    render(
      <form onSubmit={onSubmit}>
        <SidebarProvider>
          <SidebarGroupAction
            aria-label="Submit group"
            render={<button type="submit" />}
          />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<button type="submit" />}>
                Submit menu
              </SidebarMenuButton>
              <SidebarMenuAction
                aria-label="Submit action"
                render={<button type="submit" />}
              />
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton render={<button type="submit" />}>
                    Submit sub
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarProvider>
      </form>
    )

    for (const name of [
      "Submit group",
      "Submit menu",
      "Submit action",
      "Submit sub",
    ]) {
      expect(screen.getByRole("button", { name }).getAttribute("type")).toBe(
        "submit"
      )
    }

    fireEvent.click(screen.getByRole("button", { name: "Submit group" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit menu" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit action" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit sub" }))

    expect(onSubmit).toHaveBeenCalledTimes(4)
  })

  it("composes menu button child props when using asChild", () => {
    const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
    })

    render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="outer-class" isActive>
              <a className="inner-class" href="/inbox" onClick={onClick}>
                Inbox
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>
    )

    const link = screen.getByRole("link", { name: "Inbox" })
    expect(link.className).toContain("outer-class")
    expect(link.className).toContain("inner-class")
    expect(link.getAttribute("data-active")).toBe("true")

    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("renders badges, labels, and skeletons with deterministic metadata", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.999)

    const { container } = render(
      <SidebarProvider>
        <SidebarGroup>
          <SidebarGroupLabel className="label-class">Group</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Inbox</SidebarMenuButton>
              <SidebarMenuBadge data-testid="badge">3</SidebarMenuBadge>
              <SidebarMenuSkeleton data-testid="first-skeleton" showIcon />
              <SidebarMenuSkeleton data-testid="second-skeleton" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarProvider>
    )

    expect(
      container.querySelector('[data-sidebar="group-label"]')?.className
    ).toContain("label-class")
    expect(screen.getByTestId("badge").getAttribute("data-slot")).toBe(
      "sidebar-menu-badge"
    )
    expect(
      screen
        .getByTestId("first-skeleton")
        .querySelector('[data-sidebar="menu-skeleton-icon"]')
    ).toBeTruthy()
    expect(
      (
        screen
          .getByTestId("first-skeleton")
          .querySelector(
            '[data-sidebar="menu-skeleton-text"]'
          ) as HTMLElement
      ).style.getPropertyValue("--skeleton-width")
    ).toBe("50%")
    expect(
      (
        screen
          .getByTestId("second-skeleton")
          .querySelector(
            '[data-sidebar="menu-skeleton-text"]'
          ) as HTMLElement
      ).style.getPropertyValue("--skeleton-width")
    ).toBe("89%")
  })
})
