// @vitest-environment jsdom

import { existsSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
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
})
