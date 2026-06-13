// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  Dropzone,
  matchesDropzoneAccept,
} from "@/registry/new-york-v4/ui/dropzone"

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

describe("Dropzone", () => {
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

  it("accepts dropped files and limits to one file when multiple is false", () => {
    const onFilesAccepted = vi.fn()

    render(<Dropzone multiple={false} onFilesAccepted={onFilesAccepted} />)

    fireEvent.drop(
      screen.getByRole("button"),
      dropData([
        file("first.pdf", "application/pdf"),
        file("second.pdf", "application/pdf"),
      ])
    )

    expect(onFilesAccepted).toHaveBeenCalledTimes(1)
    expect(onFilesAccepted.mock.calls[0][0]).toHaveLength(1)
    expect(onFilesAccepted.mock.calls[0][0][0].name).toBe("first.pdf")
  })

  it("rejects unsupported dropped files", () => {
    const onFilesAccepted = vi.fn()
    const onFilesRejected = vi.fn()

    render(
      <Dropzone
        accept="application/pdf"
        onFilesAccepted={onFilesAccepted}
        onFilesRejected={onFilesRejected}
      />
    )

    fireEvent.drop(
      screen.getByRole("button"),
      dropData([file("notes.txt", "text/plain")])
    )

    expect(onFilesAccepted).not.toHaveBeenCalled()
    expect(onFilesRejected).toHaveBeenCalledWith([
      expect.objectContaining({
        reason: "file-invalid-type",
      }),
    ])
    expect(screen.getByRole("button").textContent).toContain(
      "This file type is not supported here."
    )
  })
})
