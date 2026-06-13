// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ViewerShell } from "@/registry/new-york-v4/ui/viewer-shell"

afterEach(() => {
  cleanup()
})

describe("ViewerShell", () => {
  it("places compound viewer chrome around the primary document surface", () => {
    const { container } = render(
      <ViewerShell
        slots={{
          header: <div>Header</div>,
          toolbar: <div>Toolbar</div>,
          left: <aside>Left rail</aside>,
          top: <div>Top strip</div>,
          bottom: <div>Bottom strip</div>,
          right: <aside>Right rail</aside>,
          overlay: <div>Overlay</div>,
        }}
      >
        <main>Document</main>
      </ViewerShell>
    )

    expect(container.querySelector('[data-slot="viewer-shell"]')).toBeTruthy()
    expect(
      container.querySelector('[data-slot="viewer-shell-header"]')?.textContent
    ).toBe("Header")
    expect(
      container.querySelector('[data-slot="viewer-shell-toolbar"]')?.textContent
    ).toBe("Toolbar")
    expect(
      container.querySelector('[data-slot="viewer-shell-left"]')?.textContent
    ).toBe("Left rail")
    expect(
      container.querySelector('[data-slot="viewer-shell-top"]')?.textContent
    ).toBe("Top strip")
    expect(
      container.querySelector('[data-slot="viewer-shell-content"]')?.textContent
    ).toBe("Document")
    expect(
      container.querySelector('[data-slot="viewer-shell-bottom"]')?.textContent
    ).toBe("Bottom strip")
    expect(
      container.querySelector('[data-slot="viewer-shell-right"]')?.textContent
    ).toBe("Right rail")
    expect(screen.getByText("Overlay")).toBeTruthy()
  })
})
