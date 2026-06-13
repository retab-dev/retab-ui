// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DropzoneBlock } from "@/registry/new-york-v4/blocks/dropzone-block"
import {
  Dropzone,
  matchesDropzoneAccept,
  useDropzone,
  validateDropzoneFiles,
} from "@/registry/new-york-v4/ui/dropzone"
import { FileUploader } from "@/registry/new-york-v4/ui/file-uploader"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function file(name: string, type: string, content = "content") {
  return new File([content], name, { type })
}

function dropData(files: File[]) {
  return {
    dataTransfer: {
      files,
      items: files.map((item) => ({
        kind: "file",
        type: item.type,
      })),
      types: ["Files"],
    },
  }
}

function textDragData() {
  return {
    dataTransfer: {
      files: [],
      items: [{ kind: "string", type: "text/plain" }],
      types: ["text/plain"],
    },
  }
}

describe("Dropzone primitive", () => {
  it("matches MIME types, wildcard MIME types, and extensions", () => {
    expect(
      matchesDropzoneAccept(
        file("statement.pdf", "application/pdf"),
        "application/pdf"
      )
    ).toBe(true)
    expect(
      matchesDropzoneAccept(file("photo.png", "image/png"), "image/*")
    ).toBe(true)
    expect(
      matchesDropzoneAccept(
        file("workbook.xlsx", ""),
        ".csv,.xlsx,application/pdf"
      )
    ).toBe(true)
    expect(
      matchesDropzoneAccept(file("notes.txt", "text/plain"), "application/pdf")
    ).toBe(false)
  })

  it("validates max size and max files", () => {
    const result = validateDropzoneFiles(
      [
        file("first.pdf", "application/pdf", "pdf"),
        file("second.pdf", "application/pdf", "pdf"),
        file("large.pdf", "application/pdf", "x".repeat(8)),
        file("notes.txt", "text/plain"),
      ],
      {
        accept: "application/pdf",
        currentCount: 0,
        maxFiles: 1,
        maxSize: 4,
      }
    )

    expect(result.accepted.map((item) => item.name)).toEqual(["first.pdf"])
    expect(result.rejected.map((item) => item.reason)).toEqual([
      "too-many-files",
      "file-too-large",
      "file-invalid-type",
    ])
  })

  it("accepts dropped files through the headless root", () => {
    const onFilesAccepted = vi.fn()
    const onFilesChange = vi.fn()
    const { container } = render(
      <Dropzone
        multiple={false}
        onFilesAccepted={onFilesAccepted}
        onFilesChange={onFilesChange}
      >
        {(dropzone) => (
          <>
            <input {...dropzone.getInputProps({ className: "hidden" })} />
            <div {...dropzone.getTriggerProps()}>{dropzone.files.length}</div>
          </>
        )}
      </Dropzone>
    )
    const root = container.querySelector('[data-slot="dropzone"]')
    expect(root).not.toBeNull()

    fireEvent.drop(
      root!,
      dropData([
        file("first.pdf", "application/pdf"),
        file("second.pdf", "application/pdf"),
      ])
    )

    expect(onFilesAccepted).toHaveBeenCalledWith([
      expect.objectContaining({ name: "first.pdf" }),
    ])
    expect(onFilesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        file: expect.objectContaining({ name: "first.pdf" }),
      }),
    ])
    expect(root!.textContent).toContain("1")
  })

  it("keeps controlled file state controlled", () => {
    const onFilesChange = vi.fn()
    const { container } = render(
      <Dropzone files={[]} onFilesChange={onFilesChange}>
        {(dropzone) => (
          <div {...dropzone.getTriggerProps()}>{dropzone.files.length}</div>
        )}
      </Dropzone>
    )
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))

    expect(root!.textContent).toContain("0")
    expect(onFilesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        file: expect.objectContaining({ name: "first.pdf" }),
      }),
    ])
  })

  it("ignores non-file drags", () => {
    const { container } = render(<Dropzone />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.dragEnter(root!, textDragData())

    expect(root?.hasAttribute("data-dragging")).toBe(false)
  })

  it("composes trigger handlers and respects preventDefault", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click")

    function Probe() {
      const dropzone = useDropzone()
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          <div
            {...dropzone.getTriggerProps({
              onClick: (event) => event.preventDefault(),
            })}
          >
            blocked
          </div>
        </div>
      )
    }

    render(<Probe />)
    fireEvent.click(screen.getByText("blocked"))

    expect(clickSpy).not.toHaveBeenCalled()
  })
})

describe("FileUploader", () => {
  it("renders selected files inside the upload area with thumbnails", () => {
    const onFilesChange = vi.fn()
    const { container } = render(<FileUploader onFilesChange={onFilesChange} />)
    const root = screen.getByRole("button")

    fireEvent.drop(
      root,
      dropData([
        file("first.pdf", "application/pdf"),
        file("second.pdf", "application/pdf"),
      ])
    )

    expect(
      container.querySelector('[data-slot="file-uploader-file-list"]')
    ).not.toBeNull()
    expect(
      container.querySelectorAll('[data-slot="file-thumbnail"]')
    ).toHaveLength(2)
    expect(root.textContent).toContain("2 files ready")
    expect(root.textContent).toContain("first.pdf")
    expect(onFilesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        file: expect.objectContaining({ name: "first.pdf" }),
      }),
      expect.objectContaining({
        file: expect.objectContaining({ name: "second.pdf" }),
      }),
    ])
  })

  it("removes selected files without reopening the file dialog", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click")
    const { container } = render(<FileUploader />)
    const root = screen.getByRole("button")

    fireEvent.drop(
      root,
      dropData([
        file("first.pdf", "application/pdf"),
        file("second.pdf", "application/pdf"),
      ])
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove first.pdf" }))

    expect(
      container.querySelectorAll('[data-slot="file-uploader-file-item"]')
    ).toHaveLength(1)
    expect(root.textContent).not.toContain("first.pdf")
    expect(root.textContent).toContain("second.pdf")
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it("renders rejection messages and custom file items", () => {
    const { container } = render(
      <FileUploader
        accept="application/pdf"
        renderFileItem={(item) => (
          <div data-slot="custom-file-item">{item.file.name}</div>
        )}
      />
    )
    const root = screen.getByRole("button")

    fireEvent.drop(root, dropData([file("first.pdf", "application/pdf")]))
    fireEvent.drop(root, dropData([file("notes.txt", "text/plain")]))

    expect(
      container.querySelector('[data-slot="custom-file-item"]')
    ).not.toBeNull()
    expect(root.textContent).toContain("This file type is not supported here.")
  })
})

describe("DropzoneBlock", () => {
  it("renders the primitive lab variants", () => {
    const { container } = render(<DropzoneBlock />)

    expect(
      container.querySelectorAll('[data-slot="dropzone"]').length
    ).toBeGreaterThanOrEqual(9)
    for (const label of [
      "Document intake",
      "Single PDF",
      "Images",
      "Small files",
      "Toolbar upload",
      "Attachment cell",
      "Controlled queue",
      "Validation only",
      "Custom thumbnail grid",
      "Disabled",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })
})

describe("Dropzone registry split", () => {
  it("keeps dropzone headless and file-uploader visual", () => {
    const dropzoneSource = readFileSync(
      "registry/new-york-v4/ui/dropzone.tsx",
      "utf8"
    )
    const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
      items: Array<{
        name: string
        dependencies?: string[]
        registryDependencies?: string[]
        files: Array<{ path: string }>
      }>
    }
    const dropzone = registry.items.find((item) => item.name === "dropzone")
    const fileUploader = registry.items.find(
      (item) => item.name === "file-uploader"
    )

    expect(dropzoneSource).not.toContain("lucide-react")
    expect(dropzoneSource).not.toContain("FileThumbnail")
    expect(dropzone?.dependencies ?? []).toEqual([])
    expect(dropzone?.registryDependencies ?? []).toEqual([])
    expect(dropzone?.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/ui/dropzone.tsx",
    ])
    expect(fileUploader?.dependencies).toEqual(["lucide-react"])
    expect(fileUploader?.registryDependencies).toEqual([
      "dropzone",
      "file-thumbnail",
      "utils",
    ])
  })
})
