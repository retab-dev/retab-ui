import { preparePresortedFileTreeInput } from "@pierre/trees"
import { describe, expect, it } from "vitest"

import type { FileSystemPierreExpansionSnapshot } from "@/registry/new-york-v4/ui/file-system-pierre-expansion-snapshot"
import type { FileSystemPierreInput } from "@/registry/new-york-v4/ui/file-system-pierre-input"
import {
  createFileSystemPierreLazyFolderCommand,
  createFileSystemPierreLazyRetryCommand,
} from "@/registry/new-york-v4/ui/file-system-pierre-lazy-retry"
import {
  classifyFileSystemPierreResetTransition,
  type FileSystemPierreResetIdentity,
} from "@/registry/new-york-v4/ui/file-system-pierre-reset-identity"
import { createFileSystemPierreResetPlan } from "@/registry/new-york-v4/ui/file-system-pierre-reset-plan"
import type { FileSystemEntry } from "@/registry/new-york-v4/ui/file-system-types"

function input(pierrePaths: string[]): FileSystemPierreInput {
  return {
    entriesByPierrePath: new Map(
      pierrePaths.map((path) => [
        path,
        {
          kind: path.endsWith("/") ? "folder" : "file",
          path,
        } as FileSystemEntry,
      ])
    ),
    pierrePaths,
    preparedInput: preparePresortedFileTreeInput(pierrePaths),
  }
}

function identity({
  currentPath = "",
  decorationVersion = "stable",
  hasSemanticQuery = false,
  pierrePaths = ["reports/", "reports/report.pdf"],
}: {
  currentPath?: string
  decorationVersion?: string
  hasSemanticQuery?: boolean
  pierrePaths?: string[]
} = {}): FileSystemPierreResetIdentity {
  return {
    currentPath,
    decorationVersion,
    hasSemanticQuery,
    input: input(pierrePaths),
  }
}

function snapshots(
  entries: Array<[string, FileSystemPierreExpansionSnapshot]>
) {
  return new Map(entries)
}

describe("file-system Pierre lifecycle", () => {
  it("classifies unchanged identity as same", () => {
    const previous = identity()

    expect(
      classifyFileSystemPierreResetTransition(previous, previous)
    ).toMatchObject({ kind: "same" })
  })

  it("classifies path, query, decoration, and input transitions by semantic priority", () => {
    const previous = identity()
    const nextInput = identity({ pierrePaths: ["archive/", "archive/a.pdf"] })

    expect(
      classifyFileSystemPierreResetTransition(
        previous,
        identity({ currentPath: "archive/" })
      ).kind
    ).toBe("path")
    expect(
      classifyFileSystemPierreResetTransition(
        previous,
        identity({ hasSemanticQuery: true })
      ).kind
    ).toBe("query-enter")
    expect(
      classifyFileSystemPierreResetTransition(
        identity({ hasSemanticQuery: true }),
        identity({ hasSemanticQuery: true, pierrePaths: ["reports/"] })
      ).kind
    ).toBe("query-update")
    expect(
      classifyFileSystemPierreResetTransition(
        identity({ hasSemanticQuery: true }),
        identity({ hasSemanticQuery: false })
      ).kind
    ).toBe("query-exit")
    expect(
      classifyFileSystemPierreResetTransition(
        previous,
        identity({ decorationVersion: "loading" })
      ).kind
    ).toBe("decoration")
    expect(
      classifyFileSystemPierreResetTransition(previous, nextInput).kind
    ).toBe("input")
  })

  it("creates no reset plan for an unchanged lifecycle", () => {
    const previous = identity()
    const transition = classifyFileSystemPierreResetTransition(
      previous,
      previous
    )

    expect(
      createFileSystemPierreResetPlan({
        snapshotsByCurrentPath: snapshots([]),
        transition,
      })
    ).toEqual({ kind: "none" })
  })

  it("restores compatible normal expansion for path, input, query-exit, and decoration transitions", () => {
    const currentSnapshot: FileSystemPierreExpansionSnapshot = {
      expandedPierrePaths: new Set(["reports/", "removed/"]),
      mode: "normal",
    }
    const cases = [
      {
        next: identity({ currentPath: "archive/" }),
        previous: identity({ currentPath: "" }),
        snapshotKey: "archive/",
      },
      {
        next: identity({ decorationVersion: "changed" }),
        previous: identity(),
        snapshotKey: "",
      },
      {
        next: identity({ pierrePaths: ["reports/", "reports/next.pdf"] }),
        previous: identity(),
        snapshotKey: "",
      },
      {
        next: identity({ hasSemanticQuery: false }),
        previous: identity({ hasSemanticQuery: true }),
        snapshotKey: "",
      },
    ]

    for (const { next, previous, snapshotKey } of cases) {
      const transition = classifyFileSystemPierreResetTransition(previous, next)
      const plan = createFileSystemPierreResetPlan({
        snapshotsByCurrentPath: snapshots([[snapshotKey, currentSnapshot]]),
        transition,
      })

      if (plan.kind === "reset") {
        expect(plan.initialExpandedPaths).toEqual(["reports/"])
      }
    }
  })

  it("opens all directories while semantic query is active without needing a normal snapshot", () => {
    const transition = classifyFileSystemPierreResetTransition(
      identity(),
      identity({
        hasSemanticQuery: true,
        pierrePaths: ["reports/", "reports/report.pdf", "archive/"],
      })
    )

    expect(
      createFileSystemPierreResetPlan({
        snapshotsByCurrentPath: snapshots([]),
        transition,
      })
    ).toMatchObject({
      initialExpandedPaths: ["reports/", "archive/"],
      kind: "reset",
    })
  })

  it("creates lazy retry commands only for failed folder selections", () => {
    const folderSelection = {
      entry: { kind: "folder", path: "lazy/" } as FileSystemEntry,
      pierrePath: "lazy/",
    }
    const fileSelection = {
      entry: { kind: "file", path: "lazy/file.pdf" } as FileSystemEntry,
      pierrePath: "lazy/file.pdf",
    }

    expect(
      createFileSystemPierreLazyRetryCommand({
        folderErrors: new Map([["lazy/", "failed"]]),
        selection: folderSelection,
      })
    ).toEqual({
      entryPath: "lazy/",
      kind: "retry-and-expand",
      pierrePath: "lazy/",
    })
    expect(
      createFileSystemPierreLazyRetryCommand({
        folderErrors: new Map(),
        selection: folderSelection,
      })
    ).toBeNull()
    expect(
      createFileSystemPierreLazyRetryCommand({
        folderErrors: new Map([["lazy/", "failed"]]),
        selection: fileSelection,
      })
    ).toBeNull()
  })

  it("creates normal lazy load commands for folders without errors", () => {
    expect(
      createFileSystemPierreLazyFolderCommand({
        folderErrors: new Map(),
        selection: {
          entry: { kind: "folder", path: "lazy/" } as FileSystemEntry,
          pierrePath: "lazy/",
        },
      })
    ).toEqual({ entryPath: "lazy/", kind: "load" })
  })
})
