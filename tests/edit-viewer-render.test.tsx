// @vitest-environment jsdom
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
import {
  EditViewer,
  EditViewerDocument,
  EditViewerFields,
  EditViewerHeader,
  EditViewerProvider,
} from "@/components/viewers/edit/edit-viewer"
import type { EditViewerField } from "@/components/viewers/edit/edit-viewer-types"

const viewerMocks = vi.hoisted(() => ({
  scrollToPageArea: vi.fn(),
}))

vi.mock("@/components/ui/pdf-viewer", () => ({
  PdfViewer: React.forwardRef(function PdfViewerMock(
    props: {
      source: { kind: "url"; url: string; fileName?: string }
      renderPageOverlay?: (props: {
        pageNumber: number
        width: number
        height: number
        scale: number
        rotation: number
      }) => React.ReactNode
    },
    ref: React.ForwardedRef<{
      scrollToPage: (pageNumber: number, options?: ScrollToOptions) => void
      scrollToPageArea: typeof viewerMocks.scrollToPageArea
      getViewportElement: () => HTMLDivElement | null
    }>
  ) {
    React.useImperativeHandle(ref, () => ({
      scrollToPage: vi.fn(),
      scrollToPageArea: viewerMocks.scrollToPageArea,
      getViewportElement: () => null,
    }))
    return (
      <div data-testid="pdf-viewer" data-src={props.source.url}>
        {props.renderPageOverlay?.({
          pageNumber: 1,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </div>
    )
  }),
}))

vi.mock("@/components/ui/file-viewer", () => ({
  FileViewer: (props: {
    source: { kind: "url"; url: string; fileName?: string }
  }) => (
    <div data-testid="file-viewer" data-src={props.source.url}>
      {props.source.fileName}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  viewerMocks.scrollToPageArea.mockClear()
})

const fields: EditViewerField[] = [
  {
    key: "name",
    description: "Primary owner",
    type: "text",
    value: "Ada Lovelace",
    bbox: { page: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.04 },
    target: {
      kind: "pdf-area",
      pageNumber: 1,
      left: 10,
      top: 20,
      width: 30,
      height: 4,
    },
    targetStatus: { state: "resolved" },
  },
  {
    key: "send_wire",
    description: "Send wire checkbox",
    type: "checkbox",
    value: "checked",
    bbox: { page: 1, left: 0.2, top: 0.4, width: 0.05, height: 0.04 },
    target: {
      kind: "pdf-area",
      pageNumber: 1,
      left: 20,
      top: 40,
      width: 5,
      height: 4,
    },
    targetStatus: { state: "resolved" },
  },
  {
    key: "memo",
    description: "Internal memo",
    type: "text",
    value: "",
    target: null,
    targetStatus: { state: "missing" },
  },
]

const sourceDocument = {
  src: "/original.pdf",
  mimeType: "application/pdf",
  filename: "original.pdf",
}

const filledDocument = {
  src: "/filled.pdf",
  mimeType: "application/pdf",
  filename: "filled.pdf",
}

const filledTextDocument = {
  src: "/filled.txt",
  mimeType: "text/plain",
  filename: "filled.txt",
}

describe("EditViewer", () => {
  it("defaults to the actual filled document when it exists", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        filledDocument={filledDocument}
      />
    )

    expect(screen.getByTestId("file-viewer").dataset.src).toBe("/filled.pdf")
    expect(screen.getByRole("tab", { name: "Filled view" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Preview view" })).toBeTruthy()
  })

  it("renders non-PDF filled output through the file viewer", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        filledDocument={filledTextDocument}
      />
    )

    expect(screen.getByTestId("file-viewer").dataset.src).toBe("/filled.txt")
    expect(screen.getByText("filled.txt")).toBeTruthy()
  })

  it("uses preview instead of filled when only source overlay data exists", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        mode="preview"
      />
    )

    expect(screen.queryByRole("tab", { name: "Filled view" })).toBeNull()
    expect(screen.getByRole("tab", { name: "Preview view" })).toBeTruthy()
    expect(screen.getByLabelText("name, text, Ada Lovelace")).toBeTruthy()
  })

  it("renders source mode without value overlays", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        mode="source"
      />
    )

    expect(screen.getByTestId("pdf-viewer").dataset.src).toBe("/original.pdf")
    expect(screen.queryByLabelText("name, text, Ada Lovelace")).toBeNull()
    expect(screen.getByRole("tab", { name: "Source view" })).toBeTruthy()
  })

  it("treats null controlled mode as best available display mode", () => {
    const onModeChange = vi.fn()

    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        mode={null}
        onModeChange={onModeChange}
      />
    )

    expect(screen.getByRole("tab", { name: "Preview view" })).toBeTruthy()
    expect(screen.getByLabelText("name, text, Ada Lovelace")).toBeTruthy()
    expect(onModeChange).not.toHaveBeenCalled()
  })

  it("searches and filters the field panel", () => {
    render(<EditViewer result={{ fields }} sourceDocument={sourceDocument} />)

    fireEvent.change(screen.getByLabelText("Search form fields"), {
      target: { value: "wire" },
    })
    expect(screen.getByText("send_wire")).toBeTruthy()
    expect(screen.queryByText("name")).toBeNull()

    fireEvent.change(screen.getByLabelText("Search form fields"), {
      target: { value: "" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Empty" }))
    expect(screen.getByText("memo")).toBeTruthy()
    expect(screen.queryByText("send_wire")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "No location" }))
    expect(screen.getByText("memo")).toBeTruthy()
    expect(screen.queryByText("name")).toBeNull()
  })

  it("exposes the expected accessibility contract", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        status={{ state: "detecting", message: "Reading fields" }}
      />
    )

    expect(screen.getByLabelText("Document fields")).toBeTruthy()
    expect(screen.getByLabelText("Toggle sidebar")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Preview view" })).toBeTruthy()
    expect(screen.getByRole("status").textContent).toContain("Reading fields")

    const memoRow = screen.getByText("memo").closest("button")
    expect(memoRow?.tagName).toBe("BUTTON")
    fireEvent.click(screen.getByText("memo"))
    expect(memoRow?.getAttribute("aria-current")).toBe("true")

    const emptyFilter = screen.getByRole("button", { name: "Empty" })
    expect(emptyFilter.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(emptyFilter)
    expect(emptyFilter.getAttribute("aria-pressed")).toBe("true")
  })

  it("applies constrained viewer options", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        options={{ preview: false, search: false, filters: false }}
      />
    )

    expect(screen.queryByRole("tab", { name: "Preview view" })).toBeNull()
    expect(screen.queryByLabelText("Search form fields")).toBeNull()
    expect(screen.queryByRole("button", { name: "Empty" })).toBeNull()
  })

  it("omits the sidebar trigger and sidebar when the field panel is disabled", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        options={{ fieldPanel: false }}
      />
    )

    expect(screen.queryByLabelText("Toggle sidebar")).toBeNull()
    expect(screen.queryByLabelText("Document fields")).toBeNull()
  })

  it("hides the header when no document modes are available", () => {
    render(<EditViewer result={{ fields }} />)

    expect(screen.queryByRole("tab")).toBeNull()
    expect(screen.getByText("No edit view is available.")).toBeTruthy()
    expect(screen.getByText("Form fields")).toBeTruthy()
  })

  it("scrolls to a selected field with normalized percentages", () => {
    render(<EditViewer result={{ fields }} sourceDocument={sourceDocument} />)

    fireEvent.click(screen.getByText("name"))

    expect(viewerMocks.scrollToPageArea).toHaveBeenCalledWith(
      {
        height: 4,
        left: 10,
        pageNumber: 1,
        top: 20,
        width: 30,
      },
      { behavior: "smooth" }
    )
  })

  it("clears a stale controlled selected field", () => {
    const onSelectedFieldKeyChange = vi.fn()

    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        selectedFieldKey="missing"
        onSelectedFieldKeyChange={onSelectedFieldKeyChange}
      />
    )

    expect(onSelectedFieldKeyChange).toHaveBeenCalledWith(null)
  })

  it("notifies controlled selection from sidebar rows and overlay buttons", () => {
    const onSelectedFieldKeyChange = vi.fn()

    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        mode="preview"
        onSelectedFieldKeyChange={onSelectedFieldKeyChange}
      />
    )

    fireEvent.click(screen.getByText("memo"))
    expect(onSelectedFieldKeyChange).toHaveBeenLastCalledWith("memo")
    expect(
      screen.getByText("memo").closest("button")?.getAttribute("aria-current")
    ).toBe("true")

    fireEvent.click(screen.getByLabelText("name, text, Ada Lovelace"))
    expect(onSelectedFieldKeyChange).toHaveBeenLastCalledWith("name")
  })

  it("previews field hover without committing controlled selection", () => {
    const onSelectedFieldKeyChange = vi.fn()

    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        mode="preview"
        onSelectedFieldKeyChange={onSelectedFieldKeyChange}
      />
    )

    fireEvent.mouseEnter(screen.getByLabelText("name, text, Ada Lovelace"))
    expect(onSelectedFieldKeyChange).not.toHaveBeenCalled()
  })

  it("restores the committed field highlight after hover preview leaves", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        mode="preview"
      />
    )

    const memoRow = screen.getByText("memo").closest("button")
    const nameOverlay = screen.getByLabelText("name, text, Ada Lovelace")

    fireEvent.click(screen.getByText("memo"))
    expect(memoRow?.classList.contains("bg-muted")).toBe(true)

    fireEvent.mouseEnter(nameOverlay)
    expect(memoRow?.classList.contains("bg-muted")).toBe(false)

    fireEvent.mouseLeave(nameOverlay)
    expect(memoRow?.classList.contains("bg-muted")).toBe(true)
  })

  it("shows status messages without changing mode semantics", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        status={{ state: "filling", message: "Generating filled PDF" }}
      />
    )

    expect(screen.getAllByText("Generating filled PDF").length).toBeGreaterThan(
      0
    )
    expect(screen.getByRole("tab", { name: "Preview view" })).toBeTruthy()
  })

  it("shows detecting status as an accessible overlay", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        status={{ state: "detecting", message: "Reading fields" }}
      />
    )

    expect(screen.getByRole("status")).toBeTruthy()
    expect(screen.getAllByText("Reading fields").length).toBeGreaterThan(0)
  })

  it("shows errors as a first-class document state", () => {
    render(
      <EditViewer
        result={{ fields }}
        sourceDocument={sourceDocument}
        status={{ state: "error", message: "Could not fill document" }}
      />
    )

    expect(screen.getByRole("alert").textContent).toContain(
      "Could not fill document"
    )
    expect(screen.queryByTestId("pdf-viewer")).toBeNull()
  })

  it("does not overlay or scroll to malformed field locations", () => {
    render(
      <EditViewer
        result={{
          fields: [
            {
              key: "bad_location",
              description: "Bad location",
              type: "text",
              value: "Ignored",
              bbox: { page: 1, left: 0.2, top: 0.3, width: 0, height: 0.1 },
            },
          ],
        }}
        sourceDocument={sourceDocument}
        mode="preview"
      />
    )

    expect(screen.queryByLabelText("bad_location, text, Ignored")).toBeNull()
    fireEvent.click(screen.getByText("bad_location"))
    expect(viewerMocks.scrollToPageArea).not.toHaveBeenCalled()
  })

  it("renders the same viewer from provider and named parts", () => {
    render(
      <EditViewerProvider result={{ fields }} sourceDocument={sourceDocument}>
        <ViewerRoot defaultOpen>
          <EditViewerHeader />
          <ViewerBody>
            <ViewerSurface>
              <EditViewerDocument />
            </ViewerSurface>
            <ViewerSidebar aria-label="Document fields" side="right">
              <EditViewerFields />
            </ViewerSidebar>
          </ViewerBody>
        </ViewerRoot>
      </EditViewerProvider>
    )

    expect(screen.getByRole("tab", { name: "Preview view" })).toBeTruthy()
    expect(screen.getByLabelText("Document fields")).toBeTruthy()
    expect(screen.getByText("name")).toBeTruthy()
    expect(screen.getByTestId("pdf-viewer").dataset.src).toBe("/original.pdf")
  })

  it("keeps EditViewerFields content-only", () => {
    const { container } = render(
      <EditViewerProvider result={{ fields }} sourceDocument={sourceDocument}>
        <EditViewerFields />
      </EditViewerProvider>
    )

    expect(screen.getByText("Form fields")).toBeTruthy()
    expect(container.querySelector("aside")).toBeNull()
  })
})
