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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarProvider,
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
