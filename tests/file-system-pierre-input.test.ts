import { describe, expect, it } from "vitest"

import { buildFileSystemIndex } from "@/registry/new-york-v4/ui/file-system-index"
import {
  buildFileSystemPierreInput,
  fileSystemPathToPierrePath,
  pierrePathToFileSystemEntry,
} from "@/registry/new-york-v4/ui/file-system-pierre-input"
import type { FileSystemItem } from "@/registry/new-york-v4/ui/file-system-types"

const items: FileSystemItem[] = [
  { kind: "folder", path: "archive/", hasChildren: true },
  { kind: "file", path: "invoices/2025/december.csv" },
  { kind: "file", path: "invoices/2026/january.pdf" },
]

describe("file-system Pierre input", () => {
  it("returns current-folder-relative Pierre paths", () => {
    const input = buildFileSystemPierreInput({
      currentPath: "invoices/",
      index: buildFileSystemIndex(items),
    })

    expect(input.pierrePaths).toEqual([
      "2025/",
      "2025/december.csv",
      "2026/",
      "2026/january.pdf",
    ])
    expect(input.preparedInput).toBeTruthy()
  })

  it("omits entries outside currentPath", () => {
    const input = buildFileSystemPierreInput({
      currentPath: "invoices/",
      index: buildFileSystemIndex(items),
    })

    expect(input.pierrePaths).not.toContain("archive/")
    expect(
      [...input.entriesByPierrePath.values()].map((entry) => entry.path)
    ).toEqual([
      "invoices/2025/",
      "invoices/2025/december.csv",
      "invoices/2026/",
      "invoices/2026/january.pdf",
    ])
  })

  it("normalizes folder paths with trailing slash", () => {
    expect(fileSystemPathToPierrePath("invoices/2026/", "invoices/")).toBe(
      "2026/"
    )
  })

  it("returns null for null or unknown Pierre paths", () => {
    const input = buildFileSystemPierreInput({
      currentPath: "invoices/",
      index: buildFileSystemIndex(items),
    })

    expect(pierrePathToFileSystemEntry(null, input)).toBeNull()
    expect(pierrePathToFileSystemEntry("missing.pdf", input)).toBeNull()
  })
})
