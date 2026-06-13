import { describe, expect, it } from "vitest"

import { buildFileSystemIndex } from "@/registry/new-york-v4/ui/file-system-index"
import {
  buildFileSystemPierreListInput,
  fileSystemPathToPierrePath,
  fileSystemPierrePathToEntry,
} from "@/registry/new-york-v4/ui/file-system-pierre-list-adapter"
import type { FileSystemItem } from "@/registry/new-york-v4/ui/file-system-types"

const items: FileSystemItem[] = [
  { kind: "folder", path: "archive/", hasChildren: true },
  { kind: "file", path: "invoices/2025/december.csv" },
  { kind: "file", path: "invoices/2026/january.pdf" },
]

describe("file-system Pierre list adapter", () => {
  it("returns current-folder-relative Pierre paths", () => {
    const input = buildFileSystemPierreListInput(
      buildFileSystemIndex(items),
      "invoices/"
    )

    expect(input.paths).toEqual([
      "2025/",
      "2025/december.csv",
      "2026/",
      "2026/january.pdf",
    ])
  })

  it("omits entries outside currentPath", () => {
    const input = buildFileSystemPierreListInput(
      buildFileSystemIndex(items),
      "invoices/"
    )

    expect(input.paths).not.toContain("archive/")
    expect([...input.pathEntries.values()].map((entry) => entry.path)).toEqual([
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
    const input = buildFileSystemPierreListInput(
      buildFileSystemIndex(items),
      "invoices/"
    )

    expect(fileSystemPierrePathToEntry(null, input.pathEntries)).toBeNull()
    expect(
      fileSystemPierrePathToEntry("missing.pdf", input.pathEntries)
    ).toBeNull()
  })
})
