// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AnchoredDocumentProvider,
  type AnchoredDocumentTarget,
  type AnchoredItem,
  useAnchoredDocument,
} from "@/registry/new-york-v4/ui/anchored-document-viewer"
import { usePdfAnchoredOverlay } from "@/registry/new-york-v4/ui/pdf-anchor-target"

afterEach(() => {
  cleanup()
})

const repoRoot = process.cwd()

const items: AnchoredItem[] = [
  {
    id: "account_name",
    anchor: {
      kind: "pdf-area",
      pageNumber: 1,
      left: 10,
      top: 20,
      width: 30,
      height: 4,
    },
  },
  {
    id: "balance",
    anchor: {
      kind: "pdf-area",
      pageNumber: 2,
      left: 15,
      top: 25,
      width: 35,
      height: 5,
    },
  },
]

function Probe() {
  const {
    activeAnchor,
    activeItemId,
    activateItem,
    clear,
    clearPreview,
    clearSelection,
    previewItem,
    selectedItemId,
    selectItem,
  } = useAnchoredDocument()

  return (
    <div>
      <output data-testid="active">{activeItemId ?? ""}</output>
      <output data-testid="selected">{selectedItemId ?? ""}</output>
      <output data-testid="active-anchor">{activeAnchor?.kind ?? ""}</output>
      <button type="button" onClick={() => previewItem("account_name")}>
        preview account
      </button>
      <button type="button" onClick={clearPreview}>
        clear preview
      </button>
      <button type="button" onClick={() => selectItem("balance")}>
        select balance
      </button>
      <button type="button" onClick={() => activateItem("balance")}>
        activate balance
      </button>
      <button type="button" onClick={clearSelection}>
        clear selection
      </button>
      <button type="button" onClick={clear}>
        clear all
      </button>
    </div>
  )
}

function fileContent(file: string) {
  return readFileSync(join(repoRoot, file), "utf8")
}

function InteractiveOverlayProbe({
  overlayItems = items,
}: {
  overlayItems?: AnchoredItem[]
}) {
  const renderPageOverlay = usePdfAnchoredOverlay({
    getItemLabel: (item) => `item ${item.id}`,
    items: overlayItems,
    mode: "interactive",
  })

  return (
    <div>
      {renderPageOverlay({
        height: 1000,
        pageNumber: 1,
        rotation: 0,
        scale: 1,
        width: 800,
      })}
    </div>
  )
}

function ActiveOverlayProbe() {
  const renderPageOverlay = usePdfAnchoredOverlay({ mode: "active" })

  return (
    <div data-testid="active-overlay">
      {renderPageOverlay({
        height: 1000,
        pageNumber: 1,
        rotation: 0,
        scale: 1,
        width: 800,
      })}
    </div>
  )
}

describe("anchored document viewer", () => {
  it("shares preview, selection, and activation across anchored items", () => {
    const scrollToAnchor =
      vi.fn<NonNullable<AnchoredDocumentTarget["scrollToAnchor"]>>()

    render(
      <AnchoredDocumentProvider
        items={items}
        target={{ scrollToAnchor }}
        initialItemId="account_name"
      >
        <Probe />
      </AnchoredDocumentProvider>
    )

    expect(screen.getByTestId("active").textContent).toBe("account_name")
    expect(screen.getByTestId("selected").textContent).toBe("account_name")

    fireEvent.click(screen.getByRole("button", { name: "select balance" }))
    expect(screen.getByTestId("active").textContent).toBe("balance")
    expect(screen.getByTestId("selected").textContent).toBe("balance")
    expect(scrollToAnchor).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "activate balance" }))
    expect(screen.getByTestId("active").textContent).toBe("balance")
    expect(screen.getByTestId("selected").textContent).toBe("balance")
    expect(scrollToAnchor).toHaveBeenLastCalledWith(items[1]?.anchor, {
      behavior: "smooth",
    })

    fireEvent.click(screen.getByRole("button", { name: "preview account" }))
    expect(screen.getByTestId("active").textContent).toBe("account_name")
    expect(screen.getByTestId("selected").textContent).toBe("balance")
    expect(scrollToAnchor).toHaveBeenLastCalledWith(items[0]?.anchor, {
      behavior: "auto",
    })

    fireEvent.click(screen.getByRole("button", { name: "clear preview" }))
    expect(screen.getByTestId("active").textContent).toBe("balance")
    expect(screen.getByTestId("selected").textContent).toBe("balance")

    fireEvent.click(screen.getByRole("button", { name: "clear selection" }))
    expect(screen.getByTestId("active").textContent).toBe("")
    expect(screen.getByTestId("selected").textContent).toBe("")
  })

  it("allows selecting items without anchors without navigating", () => {
    const scrollToAnchor =
      vi.fn<NonNullable<AnchoredDocumentTarget["scrollToAnchor"]>>()

    function MissingAnchorProbe() {
      const { activeAnchor, activeItemId, selectedItemId, selectItem } =
        useAnchoredDocument()
      return (
        <div>
          <output data-testid="active">{activeItemId ?? ""}</output>
          <output data-testid="selected">{selectedItemId ?? ""}</output>
          <output data-testid="active-anchor">{activeAnchor?.kind ?? ""}</output>
          <button
            type="button"
            onClick={() => selectItem("missing_anchor")}
          >
            select missing anchor
          </button>
        </div>
      )
    }

    render(
      <AnchoredDocumentProvider
        items={[...items, { id: "missing_anchor", anchor: null }]}
        target={{ scrollToAnchor }}
      >
        <MissingAnchorProbe />
      </AnchoredDocumentProvider>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "select missing anchor" })
    )
    expect(screen.getByTestId("active").textContent).toBe("missing_anchor")
    expect(screen.getByTestId("selected").textContent).toBe("missing_anchor")
    expect(screen.getByTestId("active-anchor").textContent).toBe("")
    expect(scrollToAnchor).not.toHaveBeenCalled()
  })

  it("does not activate disabled items", () => {
    const scrollToAnchor =
      vi.fn<NonNullable<AnchoredDocumentTarget["scrollToAnchor"]>>()

    function DisabledProbe() {
      const { activeItemId, activateItem, selectedItemId } =
        useAnchoredDocument()
      return (
        <div>
          <output data-testid="active">{activeItemId ?? ""}</output>
          <output data-testid="selected">{selectedItemId ?? ""}</output>
          <button type="button" onClick={() => activateItem("disabled")}>
            activate disabled
          </button>
        </div>
      )
    }

    render(
      <AnchoredDocumentProvider
        items={[...items, { ...items[0]!, id: "disabled", disabled: true }]}
        target={{ scrollToAnchor }}
      >
        <DisabledProbe />
      </AnchoredDocumentProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "activate disabled" }))
    expect(screen.getByTestId("active").textContent).toBe("")
    expect(screen.getByTestId("selected").textContent).toBe("")
    expect(scrollToAnchor).not.toHaveBeenCalled()
  })

  it("clears selected and previewed items when they leave the item registry", () => {
    function DynamicItemsProbe() {
      const {
        activeItemId,
        clearPreview,
        previewItem,
        selectedItemId,
        selectItem,
      } = useAnchoredDocument()

      return (
        <div>
          <output data-testid="active">{activeItemId ?? ""}</output>
          <output data-testid="selected">{selectedItemId ?? ""}</output>
          <button type="button" onClick={() => selectItem("balance")}>
            select balance
          </button>
          <button type="button" onClick={() => previewItem("account_name")}>
            preview account
          </button>
          <button type="button" onClick={clearPreview}>
            clear preview
          </button>
        </div>
      )
    }

    const { rerender } = render(
      <AnchoredDocumentProvider items={items}>
        <DynamicItemsProbe />
      </AnchoredDocumentProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "select balance" }))
    fireEvent.click(screen.getByRole("button", { name: "preview account" }))
    expect(screen.getByTestId("active").textContent).toBe("account_name")
    expect(screen.getByTestId("selected").textContent).toBe("balance")

    rerender(
      <AnchoredDocumentProvider items={[items[0]!]}>
        <DynamicItemsProbe />
      </AnchoredDocumentProvider>
    )
    expect(screen.getByTestId("active").textContent).toBe("account_name")
    expect(screen.getByTestId("selected").textContent).toBe("")

    rerender(
      <AnchoredDocumentProvider items={[]}>
        <DynamicItemsProbe />
      </AnchoredDocumentProvider>
    )
    expect(screen.getByTestId("active").textContent).toBe("")
    expect(screen.getByTestId("selected").textContent).toBe("")
  })

  it("renders a shared interactive PDF overlay that previews and activates items", () => {
    const scrollToAnchor =
      vi.fn<NonNullable<AnchoredDocumentTarget["scrollToAnchor"]>>()

    render(
      <AnchoredDocumentProvider items={items} target={{ scrollToAnchor }}>
        <Probe />
        <InteractiveOverlayProbe />
      </AnchoredDocumentProvider>
    )

    const accountRegion = screen.getByRole("button", {
      name: "item account_name",
    })
    expect(accountRegion.getAttribute("data-anchored-item-id")).toBe(
      "account_name"
    )

    fireEvent.pointerEnter(accountRegion)
    expect(screen.getByTestId("active").textContent).toBe("account_name")
    expect(screen.getByTestId("selected").textContent).toBe("")
    expect(scrollToAnchor).toHaveBeenLastCalledWith(items[0]?.anchor, {
      behavior: "auto",
    })

    fireEvent.click(accountRegion)
    expect(screen.getByTestId("active").textContent).toBe("account_name")
    expect(screen.getByTestId("selected").textContent).toBe("account_name")
    expect(scrollToAnchor).toHaveBeenLastCalledWith(items[0]?.anchor, {
      behavior: "smooth",
    })
  })

  it("renders the passive PDF overlay from the active anchor only", () => {
    render(
      <AnchoredDocumentProvider items={items} initialItemId="account_name">
        <ActiveOverlayProbe />
      </AnchoredDocumentProvider>
    )

    expect(
      screen
        .getByTestId("active-overlay")
        .querySelector("[data-slot='pdf-highlight']")
    ).toBeTruthy()
  })

  it("keeps anchored-document outside leaf viewers", () => {
    for (const file of [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/file-viewer.tsx",
      "registry/new-york-v4/ui/image-viewer.tsx",
      "registry/new-york-v4/ui/text-viewer.tsx",
      "registry/new-york-v4/ui/viewer.tsx",
    ]) {
      expect(
        fileContent(file),
        `${file} imports anchored document`
      ).not.toContain("anchored-document")
    }
  })

  it("uses anchored-document only in composed anchored viewers", () => {
    expect(
      fileContent("registry/new-york-v4/blocks/extract-viewer-block.tsx")
    ).toContain("AnchoredDocumentProvider")
    expect(fileContent("registry/new-york-v4/ui/layout-blocks.tsx")).toContain(
      "AnchoredDocumentProvider"
    )
    expect(fileContent("components/viewers/edit/edit-viewer.tsx")).toContain(
      "AnchoredDocumentProvider"
    )
    expect(
      fileContent("registry/new-york-v4/blocks/extraction-viewer-block.tsx")
    ).toContain("AnchoredDocumentProvider")
  })

  it("keeps extraction source maps outside anchored-document core", () => {
    expect(
      fileContent("registry/new-york-v4/ui/anchored-document-viewer.tsx")
    ).not.toMatch(new RegExp(`SourceMap|useAnchored${"Source"}Link`))
    expect(
      fileContent("registry/new-york-v4/blocks/extraction-viewer-block.tsx")
    ).not.toMatch(new RegExp(`use${"Source"}Link|Use${"Source"}LinkResult`))
  })

  it("keeps the public anchor vocabulary aligned with the blueprint", () => {
    const core = fileContent(
      "registry/new-york-v4/ui/anchored-document-viewer.tsx"
    )
    const pdfTarget = fileContent("registry/new-york-v4/ui/pdf-anchor-target.tsx")
    const xlsxAnchor = core.match(
      /export type XlsxCellAnchor = \{[\s\S]*?\n\}/
    )?.[0]

    expect(core).toContain("frameNumber?: number")
    expect(xlsxAnchor).toContain("sheetIndex: number")
    expect(xlsxAnchor).toContain("rowIndex: number")
    expect(xlsxAnchor).toContain("columnIndex: number")
    expect(xlsxAnchor).not.toMatch(
      /\bsheet: number\b|\brow: number\b|\bcol: number\b/
    )
    expect(pdfTarget).toContain("sourceToPdfAnchor")
    expect(pdfTarget).not.toContain(`sourceToPdf${"Area"}Anchor`)
  })
})
