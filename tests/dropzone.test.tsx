// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import * as React from "react"
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DropzoneBlock } from "@/registry/new-york-v4/blocks/dropzone-block"
import { DropzoneUploaderViewer } from "@/registry/new-york-v4/blocks/dropzone-uploader-viewer"
import {
  matchesDropzoneAccept,
  parseDropzoneAccept,
  useDropzone,
  validateDropzoneFile,
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

function emptyFileDragData() {
  return {
    dataTransfer: {
      files: [],
      items: [],
      types: [],
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
    expect(matchesDropzoneAccept(file("README", ""), "")).toBe(true)
    expect(matchesDropzoneAccept(file("workbook.XLSX", ""), ".xlsx")).toBe(true)
    expect(
      matchesDropzoneAccept(file("photo.jpeg", "IMAGE/JPEG"), "image/jpeg,.png")
    ).toBe(true)
  })

  it("validates single files with structured rejection-specific facts", () => {
    expect(
      validateDropzoneFile(file("ok.pdf", "application/pdf"), {
        accept: ".pdf,application/json",
        maxSize: 10,
      })
    ).toBeNull()

    expect(
      validateDropzoneFile(file("notes.txt", "text/plain"), {
        accept: ".pdf,application/pdf",
      })
    ).toEqual({
      acceptRules: [
        { type: "extension", value: ".pdf" },
        { type: "mime", value: "application/pdf" },
      ],
      file: expect.objectContaining({ name: "notes.txt" }),
      reason: "file-invalid-type",
    })

    expect(
      validateDropzoneFile(file("large.pdf", "application/pdf", "xxxxx"), {
        maxSize: 4,
      })
    ).toEqual({
      file: expect.objectContaining({ name: "large.pdf" }),
      maxSize: 4,
      reason: "file-too-large",
    })
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

  it("applies maxFiles against existing selected count", () => {
    const intake = validateDropzoneFiles(
      [
        file("first.pdf", "application/pdf"),
        file("second.pdf", "application/pdf"),
      ],
      {
        currentCount: 2,
        maxFiles: 3,
      }
    )

    expect(intake.acceptedFiles.map((item) => item.name)).toEqual(["first.pdf"])
    expect(intake.fileRejections).toEqual([
      expect.objectContaining({
        file: expect.objectContaining({ name: "second.pdf" }),
        maxFiles: 3,
        reason: "too-many-files",
      }),
    ])
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

  it("keeps default files and removes individual selected files", () => {
    const initialFile = file("initial.pdf", "application/pdf")
    const defaultFiles = [{ id: "initial", file: initialFile }]

    function Probe() {
      const dropzone = useDropzone({ defaultFiles })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          <div>{dropzone.files.map((item) => item.file.name).join(",")}</div>
          <button type="button" onClick={() => dropzone.removeFile("initial")}>
            remove initial
          </button>
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    expect(root!.textContent).toContain("initial.pdf")
    fireEvent.click(screen.getByText("remove initial"))
    expect(root!.textContent).not.toContain("initial.pdf")
  })

  it("tracks nested file drag state and ignores non-file drags", () => {
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
    fireEvent.dragEnter(
      root!,
      dropData([file("second.pdf", "application/pdf")])
    )
    expect(root?.hasAttribute("data-dragging")).toBe(true)
    expect(root!.textContent).toContain("dragging:yes")

    fireEvent.dragLeave(
      root!,
      dropData([file("second.pdf", "application/pdf")])
    )
    expect(root?.hasAttribute("data-dragging")).toBe(true)
    expect(root!.textContent).toContain("dragging:yes")

    fireEvent.dragLeave(root!, dropData([file("first.pdf", "application/pdf")]))
    expect(root?.hasAttribute("data-dragging")).toBe(false)
    expect(root!.textContent).toContain("dragging:no")

    fireEvent.dragEnter(root!, dropData([file("first.pdf", "application/pdf")]))
    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))
    expect(root?.hasAttribute("data-dragging")).toBe(false)
    expect(root!.textContent).toContain("dragging:no")
  })

  it("ignores empty file drags without preventing default", () => {
    const onDrop = vi.fn()

    function Probe() {
      const dropzone = useDropzone()
      return (
        <div {...dropzone.getRootProps({ onDrop })}>
          <input {...dropzone.getInputProps()} />
          files:{dropzone.files.length}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(root!, emptyFileDragData())

    expect(onDrop).toHaveBeenCalledOnce()
    expect(onDrop.mock.calls[0][0].defaultPrevented).toBe(false)
    expect(root!.textContent).toContain("files:0")
  })

  it("marks file dragover as copy and leaves non-file dragover alone", () => {
    function Probe() {
      const dropzone = useDropzone()
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')
    const fileDragOver = createEvent.dragOver(root!, {
      dataTransfer: {
        files: [],
        items: [{ kind: "file", type: "application/pdf" }],
        types: ["Files"],
        dropEffect: "none",
      },
    })
    const textDragOver = createEvent.dragOver(root!, textDragData())

    fireEvent(root!, fileDragOver)
    fireEvent(root!, textDragOver)

    expect(fileDragOver.defaultPrevented).toBe(true)
    expect((fileDragOver as DragEvent).dataTransfer?.dropEffect).toBe("copy")
    expect(textDragOver.defaultPrevented).toBe(false)
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

  it("commits file input changes and clears the input value for reselection", () => {
    function Probe() {
      const dropzone = useDropzone({ multiple: true })
      return (
        <div {...dropzone.getRootProps()}>
          <input data-testid="file-input" {...dropzone.getInputProps()} />
          {dropzone.files.map((item) => item.file.name).join(",")}
        </div>
      )
    }

    render(<Probe />)
    const input = screen.getByTestId("file-input") as HTMLInputElement
    Object.defineProperty(input, "value", {
      configurable: true,
      value: "C:\\fakepath\\first.pdf",
      writable: true,
    })

    fireEvent.change(input, {
      target: {
        files: [file("first.pdf", "application/pdf")],
      },
    })

    expect(screen.getByText("first.pdf")).toBeTruthy()
    expect(input.value).toBe("")
  })

  it("lets external input change handlers cancel file intake", () => {
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      event.preventDefault()
    })
    const onFilesChange = vi.fn()

    function Probe() {
      const dropzone = useDropzone({ onFilesChange })
      return (
        <div {...dropzone.getRootProps()}>
          <input
            {...dropzone.getInputProps({
              "data-testid": "file-input",
              onChange,
            })}
          />
          files:{dropzone.files.length}
        </div>
      )
    }

    render(<Probe />)
    const input = screen.getByTestId("file-input") as HTMLInputElement
    Object.defineProperty(input, "value", {
      configurable: true,
      value: "C:\\fakepath\\blocked.pdf",
      writable: true,
    })

    fireEvent.change(input, {
      target: {
        files: [file("blocked.pdf", "application/pdf")],
      },
    })

    expect(onChange).toHaveBeenCalledOnce()
    expect(onFilesChange).not.toHaveBeenCalled()
    expect(screen.getByText("files:0")).toBeTruthy()
    expect(input.value).toBe("C:\\fakepath\\blocked.pdf")
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

  it("replaces existing selected files when multiple is false", () => {
    function Probe() {
      const dropzone = useDropzone({ multiple: false })
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
    expect(root!.textContent).toContain("first.pdf")

    fireEvent.drop(root!, dropData([file("second.pdf", "application/pdf")]))
    expect(root!.textContent).not.toContain("first.pdf")
    expect(root!.textContent).toContain("second.pdf")
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

  it("emits max-file transitions from controlled state without mutating rendered files", () => {
    const current = [
      { id: "existing", file: file("existing.pdf", "application/pdf") },
    ]
    const onFilesChange = vi.fn()

    function Probe() {
      const dropzone = useDropzone({
        files: current,
        maxFiles: 2,
        onFilesChange,
      })
      return (
        <div {...dropzone.getRootProps()}>
          <input {...dropzone.getInputProps()} />
          {dropzone.files.map((item) => item.file.name).join(",")}
          rejected:{dropzone.lastIntake.fileRejections.length}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.drop(
      root!,
      dropData([
        file("accepted.pdf", "application/pdf"),
        file("rejected.pdf", "application/pdf"),
      ])
    )

    expect(root!.textContent).toContain("existing.pdf")
    expect(root!.textContent).not.toContain("accepted.pdf")
    expect(root!.textContent).toContain("rejected:1")
    expect(onFilesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        file: expect.objectContaining({ name: "existing.pdf" }),
      }),
      expect.objectContaining({
        file: expect.objectContaining({ name: "accepted.pdf" }),
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

  it("composes external event handlers and respects defaultPrevented", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click")
    const rootDrop = vi.fn((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
    })
    const triggerClick = vi.fn((event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
    })

    function Probe() {
      const dropzone = useDropzone()
      return (
        <div {...dropzone.getRootProps({ onDrop: rootDrop })}>
          <input {...dropzone.getInputProps()} />
          <div {...dropzone.getTriggerProps({ onClick: triggerClick })}>
            blocked trigger
          </div>
          files:{dropzone.files.length}
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')

    fireEvent.click(screen.getByText("blocked trigger"))
    fireEvent.drop(root!, dropData([file("first.pdf", "application/pdf")]))

    expect(triggerClick).toHaveBeenCalledOnce()
    expect(rootDrop).toHaveBeenCalledOnce()
    expect(clickSpy).not.toHaveBeenCalled()
    expect(root!.textContent).toContain("files:0")
  })

  it("sets input and trigger attributes from state and options", () => {
    function Probe() {
      const dropzone = useDropzone({
        accept: ".pdf",
        disabled: true,
        multiple: false,
      })
      return (
        <div {...dropzone.getRootProps()}>
          <input data-testid="file-input" {...dropzone.getInputProps()} />
          <div {...dropzone.getTriggerProps()}>custom trigger</div>
          <button {...dropzone.getButtonProps({ type: "submit" })}>
            submit trigger
          </button>
        </div>
      )
    }

    const { container } = render(<Probe />)
    const root = container.querySelector('[data-slot="dropzone"]')
    const input = screen.getByTestId("file-input") as HTMLInputElement
    const customTrigger = screen.getByText("custom trigger")
    const buttonTrigger = screen.getByRole("button", { name: "submit trigger" })

    expect(root?.getAttribute("aria-disabled")).toBe("true")
    expect(input.accept).toBe(".pdf")
    expect(input.disabled).toBe(true)
    expect(input.multiple).toBe(false)
    expect(customTrigger.getAttribute("aria-disabled")).toBe("true")
    expect(customTrigger.getAttribute("tabindex")).toBe("-1")
    expect(buttonTrigger.getAttribute("type")).toBe("submit")
    expect((buttonTrigger as HTMLButtonElement).disabled).toBe(true)
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

    fireEvent.keyDown(nonButton, { key: " " })
    expect(clickSpy).toHaveBeenCalledTimes(3)
  })

  it("tracks focus state for custom and native triggers", () => {
    function Probe() {
      const dropzone = useDropzone()
      return (
        <div>
          <input {...dropzone.getInputProps()} />
          <div {...dropzone.getTriggerProps({ "data-testid": "custom" })}>
            custom trigger
          </div>
          <button {...dropzone.getButtonProps({ "data-testid": "native" })}>
            native trigger
          </button>
          state:{dropzone.isFocused ? "focused" : "blurred"}
        </div>
      )
    }

    render(<Probe />)
    const customTrigger = screen.getByTestId("custom")
    const nativeTrigger = screen.getByTestId("native")

    expect(customTrigger.hasAttribute("data-focused")).toBe(false)
    expect(nativeTrigger.hasAttribute("data-focused")).toBe(false)
    expect(document.body.textContent).toContain("state:blurred")

    fireEvent.focus(customTrigger)
    expect(customTrigger.hasAttribute("data-focused")).toBe(true)
    expect(nativeTrigger.hasAttribute("data-focused")).toBe(true)
    expect(document.body.textContent).toContain("state:focused")

    fireEvent.blur(customTrigger)
    expect(customTrigger.hasAttribute("data-focused")).toBe(false)
    expect(nativeTrigger.hasAttribute("data-focused")).toBe(false)
    expect(document.body.textContent).toContain("state:blurred")

    fireEvent.focus(nativeTrigger)
    expect(customTrigger.hasAttribute("data-focused")).toBe(true)
    expect(nativeTrigger.hasAttribute("data-focused")).toBe(true)
    expect(document.body.textContent).toContain("state:focused")
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
  it("switches the uploader-viewer showcase from empty upload state to viewer state", () => {
    const viewerSources: Array<{
      fileName?: string
      identityKey: string
      kind: string
      mimeType?: string
    }> = []

    render(
      <DropzoneUploaderViewer
        renderViewer={(source) => {
          viewerSources.push(source)
          return <div data-testid="viewer">{source.fileName}</div>
        }}
      />
    )

    const viewerSection = screen
      .getByText("Uploader + viewer")
      .closest("section") as HTMLElement
    const input = viewerSection.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement

    expect(within(viewerSection).getByText("No file selected")).toBeTruthy()
    expect(
      within(viewerSection).getAllByText("Upload file").length
    ).toBeGreaterThanOrEqual(2)

    fireEvent.change(input, {
      target: {
        files: [file("preview.txt", "text/plain", "hello")],
      },
    })

    expect(within(viewerSection).queryByText("No file selected")).toBeNull()
    expect(
      within(viewerSection).getAllByText("preview.txt").length
    ).toBeGreaterThanOrEqual(2)
    expect(within(viewerSection).getByText(formatFileSize(5))).toBeTruthy()
    expect(within(viewerSection).getByText("text/plain")).toBeTruthy()
    expect(screen.getByTestId("viewer").textContent).toBe("preview.txt")
    expect(viewerSources.at(-1)).toEqual(
      expect.objectContaining({
        fileName: "preview.txt",
        kind: "blob",
        mimeType: "text/plain",
      })
    )
    expect(viewerSources.at(-1)?.identityKey).toContain("preview.txt-5")

    fireEvent.click(
      within(viewerSection).getByRole("button", { name: "Remove preview.txt" })
    )

    expect(within(viewerSection).getByText("No file selected")).toBeTruthy()
    expect(screen.queryByTestId("viewer")).toBeNull()
  })

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
      "Uploader + viewer",
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
    const dropzoneUploaderViewerSource = readFileSync(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
      "utf8"
    )
    const dropzoneDocsSource = readFileSync(
      "content/docs/components/dropzone.mdx",
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
    expect(dropzoneSource).not.toContain(
      "export type DropzoneButtonGetterProps"
    )
    expect(dropzoneSource).not.toContain("export function DropzoneRoot")
    expect(dropzoneSource).not.toContain("DropzoneContext")
    expect(dropzoneCoreSource).not.toContain("message:")
    expect(dropzoneCoreSource).not.toContain("formatDropzoneBytes")
    expect(dropzoneUploaderViewerSource).not.toContain(
      "@/components/ui/file-viewer"
    )
    expect(dropzoneUploaderViewerSource).toContain("renderViewer")
    expect(dropzoneDocsSource).toContain("Browser file intake is not upload.")
    expect(dropzoneDocsSource).toContain("`files` is selected-file state.")
    expect(dropzoneDocsSource).toContain(
      "`lastIntake` is the latest file-intake attempt."
    )
    expect(dropzoneDocsSource).toContain(
      "`getButtonProps` is for real `<button>` elements."
    )
    expect(dropzoneDocsSource).toContain(
      "`getTriggerProps` is for anything else that opens the file dialog."
    )
    expect(dropzoneDocsSource).toContain("export function FileIntakeTarget")
    expect(dropzoneDocsSource).not.toContain("export function UploadTarget")
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
    expect(dropzoneBlock?.registryDependencies).toEqual([
      "dropzone",
      "file-viewer",
      "file-size-format",
      "file-uploader",
      "file-thumbnail",
    ])
    expect(dropzoneBlock?.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/blocks/dropzone-block.tsx",
      "registry/new-york-v4/blocks/dropzone-showcase.tsx",
      "registry/new-york-v4/blocks/dropzone-example-shared.tsx",
      "registry/new-york-v4/blocks/dropzone-file-uploader-example.tsx",
      "registry/new-york-v4/blocks/dropzone-file-viewer-example.tsx",
      "registry/new-york-v4/blocks/dropzone-trigger-examples.tsx",
      "registry/new-york-v4/blocks/dropzone-file-examples.tsx",
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
      "registry/new-york-v4/blocks/dropzone-workflow-examples.tsx",
    ])
  })
})
