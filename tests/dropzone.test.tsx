// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DropzoneBlock } from "@/registry/new-york-v4/blocks/dropzone-block"
import {
  matchesDropzoneAccept,
  parseDropzoneAccept,
  useDropzone,
  validateDropzoneFiles,
  type DropzoneFileItem,
} from "@/registry/new-york-v4/ui/dropzone"
import { formatFileSize } from "@/registry/new-york-v4/ui/file-size-format"
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
      items: files.map((item) => ({ kind: "file", type: item.type })),
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
  it("parses and matches MIME types, wildcard MIME types, and extensions", () => {
    expect(parseDropzoneAccept(" .PDF, image/*, application/json ,, ")).toEqual(
      [
        { type: "extension", value: ".pdf" },
        { type: "mime-prefix", value: "image/" },
        { type: "mime", value: "application/json" },
      ]
    )
    expect(
      matchesDropzoneAccept(file("statement.pdf", "application/pdf"), ".pdf")
    ).toBe(true)
    expect(
      matchesDropzoneAccept(file("photo.png", "image/png"), "image/*")
    ).toBe(true)
    expect(
      matchesDropzoneAccept(file("notes.txt", "text/plain"), "application/pdf")
    ).toBe(false)
  })

  it("returns structured rejection facts without UI messages", () => {
    const intake = validateDropzoneFiles(
      [
        file("first.pdf", "application/pdf", "pdf"),
        file("second.pdf", "application/pdf", "pdf"),
        file("large.pdf", "application/pdf", "x".repeat(8)),
        file("notes.txt", "text/plain"),
      ],
      {
        accept: "application/pdf",
        maxFiles: 1,
        maxSize: 4,
      }
    )

    expect(intake.acceptedFiles.map((item) => item.name)).toEqual(["first.pdf"])
    expect(intake.fileRejections).toEqual([
      expect.objectContaining({
        file: expect.objectContaining({ name: "second.pdf" }),
        maxFiles: 1,
        reason: "too-many-files",
      }),
      expect.objectContaining({
        file: expect.objectContaining({ name: "large.pdf" }),
        maxSize: 4,
        reason: "file-too-large",
      }),
      expect.objectContaining({
        acceptRules: [{ type: "mime", value: "application/pdf" }],
        file: expect.objectContaining({ name: "notes.txt" }),
        reason: "file-invalid-type",
      }),
    ])
    for (const rejection of intake.fileRejections) {
      expect("message" in rejection).toBe(false)
    }
  })

  it("updates lastIntake and supports explicit reset semantics", () => {
    function Probe() {
      const dropzone = useDropzone({ accept: "application/pdf" })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          <div>
            files:{dropzone.files.length}
            rejected:{dropzone.lastIntake.fileRejections.length}
          </div>
          <button type="button" onClick={dropzone.clearFiles}>
            clear files
          </button>
          <button type="button" onClick={dropzone.resetIntake}>
            reset intake
          </button>
          <button type="button" onClick={dropzone.reset}>
            reset all
          </button>
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(
      root!,
      dropData([
        file("first.pdf", "application/pdf"),
        file("notes.txt", "text/plain"),
      ])
    )
    expect(root!.textContent).toContain("files:1rejected:1")

    fireEvent.click(screen.getByText("clear files"))
    expect(root!.textContent).toContain("files:0rejected:1")

    fireEvent.click(screen.getByText("reset intake"))
    expect(root!.textContent).toContain("files:0rejected:0")

    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))
    fireEvent.click(screen.getByText("reset all"))
    expect(root!.textContent).toContain("files:0rejected:0")
  })

  it("tracks file drag state and ignores non-file drags", () => {
    function Probe() {
      const dropzone = useDropzone()
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          dragging:{dropzone.isDragging ? "yes" : "no"}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.dragEnter(root!, textDragData())
    expect(root?.hasAttribute("data-dragging")).toBe(false)
    expect(root!.textContent).toContain("dragging:no")

    fireEvent.dragEnter(root!, dropData([file("first.pdf", "application/pdf")]))
    expect(root?.hasAttribute("data-dragging")).toBe(true)
    expect(root!.textContent).toContain("dragging:yes")

    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))
    expect(root?.hasAttribute("data-dragging")).toBe(false)
    expect(root!.textContent).toContain("dragging:no")
  })

  it("uses functional uncontrolled transitions for rapid consecutive intake", () => {
    function Probe() {
      const dropzone = useDropzone({ multiple: true })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          {dropzone.files.map((item) => item.file.name).join(",")}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))
    fireEvent.drop(root!, dropData([file("second.pdf", "application/pdf")]))

    expect(root!.textContent).toContain("first.pdf,second.pdf")
  })

  it("limits single-file intake before validation and selected state", () => {
    const onIntake = vi.fn()

    function Probe() {
      const dropzone = useDropzone({
        multiple: false,
        onIntake,
      })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          {dropzone.files.map((item) => item.file.name).join(",")}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(
      root!,
      dropData([
        file("first.pdf", "application/pdf"),
        file("second.pdf", "application/pdf"),
      ])
    )

    expect(root!.textContent).toContain("first.pdf")
    expect(root!.textContent).not.toContain("second.pdf")
    expect(onIntake).toHaveBeenCalledWith({
      acceptedFiles: [expect.objectContaining({ name: "first.pdf" })],
      fileRejections: [],
    })
  })

  it("keeps controlled files controlled and reports the requested transition", () => {
    const onFilesChange = vi.fn()

    function Probe() {
      const dropzone = useDropzone({
        files: [],
        onFilesChange,
      })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          <div {...dropzone.getTriggerProps()}>{dropzone.files.length}</div>
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.dragEnter(root!, textDragData())
    expect(root?.hasAttribute("data-dragging")).toBe(false)

    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))
    expect(root!.textContent).toContain("0")
    expect(onFilesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        file: expect.objectContaining({ name: "first.pdf" }),
      }),
    ])
  })

  it("calls intake and change callbacks with structured file outcomes", () => {
    const onFilesChange = vi.fn()
    const onIntake = vi.fn()

    function Probe() {
      const dropzone = useDropzone({
        accept: "application/pdf",
        onFilesChange,
        onIntake,
      })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          <div>rejections:{dropzone.lastIntake.fileRejections.length}</div>
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(
      root!,
      dropData([
        file("first.pdf", "application/pdf"),
        file("notes.txt", "text/plain"),
      ])
    )

    expect(onIntake).toHaveBeenCalledOnce()
    expect(onIntake).toHaveBeenCalledWith({
      acceptedFiles: [expect.objectContaining({ name: "first.pdf" })],
      fileRejections: [
        expect.objectContaining({ reason: "file-invalid-type" }),
      ],
    })
    expect(onFilesChange).toHaveBeenCalledOnce()
    expect(root!.textContent).toContain("rejections:1")
  })

  it("does not report selected-file changes for rejected-only attempts", () => {
    const onFilesChange = vi.fn()
    const onIntake = vi.fn()

    function Probe() {
      const dropzone = useDropzone({
        accept: "application/pdf",
        onFilesChange,
        onIntake,
      })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          rejected:{dropzone.lastIntake.fileRejections.length}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(root!, dropData([file("notes.txt", "text/plain")]))

    expect(onIntake).toHaveBeenCalledOnce()
    expect(onFilesChange).not.toHaveBeenCalled()
    expect(root!.textContent).toContain("rejected:1")
  })

  it("supports native button and non-button trigger semantics", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click")

    function Probe() {
      const dropzone = useDropzone()
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          <div {...dropzone.getTriggerProps()}>non-button</div>
          <button {...dropzone.getButtonProps()}>native button</button>
        </div>
      )
    }

    render(<Probe />)
    const nonButton = screen.getByText("non-button")
    const button = screen.getByRole("button", { name: "native button" })

    expect(nonButton.getAttribute("role")).toBe("button")
    expect(button.getAttribute("role")).toBeNull()

    fireEvent.keyDown(nonButton, { key: "Enter" })
    fireEvent.click(button)
    expect(clickSpy).toHaveBeenCalledTimes(2)
  })

  it("blocks file dialog and intake while disabled", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click")
    const onFilesChange = vi.fn()
    const onIntake = vi.fn()

    function Probe() {
      const dropzone = useDropzone({
        disabled: true,
        onFilesChange,
        onIntake,
      })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          <button {...dropzone.getButtonProps()}>native button</button>
          files:{dropzone.files.length}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')
    const button = screen.getByRole("button", { name: "native button" })

    fireEvent.click(button)
    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))

    expect(clickSpy).not.toHaveBeenCalled()
    expect(onIntake).not.toHaveBeenCalled()
    expect(onFilesChange).not.toHaveBeenCalled()
    expect(root!.textContent).toContain("files:0")
  })
})

describe("FileUploader", () => {
  it("renders selected files inside the upload area with thumbnails and formatted sizes", () => {
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
    expect(root.textContent).toContain(formatFileSize(14))
    expect(onFilesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        file: expect.objectContaining({ name: "first.pdf" }),
      }),
      expect.objectContaining({
        file: expect.objectContaining({ name: "second.pdf" }),
      }),
    ])
  })

  it("renders structured rejection messages in the visual layer", () => {
    render(<FileUploader accept="application/pdf" maxSize={4} />)
    const root = screen.getByRole("button")

    fireEvent.drop(
      root,
      dropData([file("large.pdf", "application/pdf", "xxxxx")])
    )
    expect(root.textContent).toContain("File must be 4 B or smaller.")

    fireEvent.drop(root, dropData([file("notes.txt", "text/plain")]))
    expect(root.textContent).toContain("This file type is not supported here.")
  })
})

describe("DropzoneBlock", () => {
  it("renders focused primitive proofs", () => {
    const { container } = render(<DropzoneBlock />)

    expect(
      container.querySelectorAll('[data-slot="dropzone"]').length
    ).toBeGreaterThanOrEqual(18)
    expect(
      container.querySelectorAll("button[data-slot='dropzone-trigger']").length
    ).toBeGreaterThanOrEqual(10)

    for (const label of [
      "Default file uploader",
      "Non-button trigger",
      "Native button trigger",
      "Controlled queue",
      "Validation only",
      "Custom thumbnail grid",
      "Audio transcript queue",
      "Avatar image slot",
      "Spreadsheet mapper",
      "Evidence timeline",
      "Comparison pair",
      "Original",
      "Revision",
      "Intake router",
      "Required packet",
      "Identity proof",
      "Bank statement",
      "Board approval",
      "Pinboard drop surface",
      "Disabled state",
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
    const dropzoneCoreSource = readFileSync(
      "registry/new-york-v4/ui/dropzone-core.ts",
      "utf8"
    )
    const fileUploaderSource = readFileSync(
      "registry/new-york-v4/ui/file-uploader.tsx",
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
    const dropzoneBlock = registry.items.find(
      (item) => item.name === "dropzone-block"
    )

    expect(dropzoneSource).not.toContain("lucide-react")
    expect(dropzoneSource).not.toContain("FileThumbnail")
    expect(dropzoneSource).not.toContain("formatDropzoneBytes")
    expect(dropzoneSource).not.toContain("onFilesAccepted")
    expect(dropzoneSource).not.toContain("onFilesRejected")
    expect(dropzoneSource).not.toContain("hasFiles")
    expect(dropzoneSource).not.toContain("DropzoneState")
    expect(dropzoneSource).not.toContain(
      "fileRejections: lastIntake.fileRejections"
    )
    expect(dropzoneSource).not.toContain("export type DropzoneDataAttributes")
    expect(dropzoneSource).not.toContain("export type DropzoneRootGetterProps")
    expect(dropzoneSource).not.toContain("export type DropzoneInputGetterProps")
    expect(dropzoneSource).not.toContain(
      "export type DropzoneTriggerGetterProps"
    )
    expect(dropzoneSource).not.toContain("export type DropzoneButtonGetterProps")
    expect(dropzoneSource).not.toContain("export function DropzoneRoot")
    expect(dropzoneSource).not.toContain("DropzoneContext")
    expect(dropzoneCoreSource).not.toContain("message:")
    expect(dropzoneCoreSource).not.toContain("formatDropzoneBytes")
    expect(fileUploaderSource).toContain(
      "This file type is not supported here."
    )
    expect(dropzone?.dependencies ?? []).toEqual([])
    expect(dropzone?.registryDependencies ?? []).toEqual([])
    expect(dropzone?.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/ui/dropzone.tsx",
      "registry/new-york-v4/ui/dropzone-core.ts",
    ])
    expect(fileUploader?.dependencies).toEqual(["lucide-react"])
    expect(fileUploader?.registryDependencies).toEqual([
      "dropzone",
      "file-thumbnail",
      "file-size-format",
      "utils",
    ])
    expect(dropzoneBlock?.registryDependencies).toContain("file-size-format")
  })
})
