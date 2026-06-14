import { describe, expect, it } from "vitest"

import {
  createFileSystemKernelState,
  reduceFileSystemKernel,
} from "@/registry/new-york-v4/ui/file-system-kernel"
import {
  selectFileSystemKernel,
  selectFolderErrors,
  selectLoadingFolders,
} from "@/registry/new-york-v4/ui/file-system-kernel-selectors"
import type { FileSystemItem } from "@/registry/new-york-v4/ui/file-system-types"

const items: FileSystemItem[] = [
  { kind: "folder", path: "reports/" },
  { kind: "file", path: "reports/report.pdf", mimeType: "application/pdf" },
  { kind: "folder", path: "lazy/", hasChildren: true },
]

describe("FileSystemKernel", () => {
  it("normalizes initial state into durable file-system truth", () => {
    const state = createFileSystemKernelState({
      defaultPath: "/reports",
      defaultSelectedPath: "reports/report.pdf",
      items,
    })

    expect(state.path).toBe("reports/")
    expect(state.selectionPath).toBe("reports/report.pdf")
    expect(selectFileSystemKernel({ state }).visibleEntries).toEqual([
      expect.objectContaining({ path: "reports/report.pdf" }),
    ])
  })

  it("updates path, history, query, and selection for user navigation", () => {
    const state = createFileSystemKernelState({
      defaultPath: "reports/",
      defaultSelectedPath: "reports/report.pdf",
      defaultQuery: { search: "report" },
      items,
    })
    const result = reduceFileSystemKernel(state, {
      path: "lazy/",
      source: "user",
      type: "path.changed",
    })

    expect(result.state.path).toBe("lazy/")
    expect(result.state.history.back).toEqual(["reports/"])
    expect(result.state.history.forward).toEqual([])
    expect(result.state.query.search).toBe("")
    expect(result.state.selectionPath).toBeNull()
    expect(result.commands).toEqual([
      { path: "lazy/", type: "callback.pathChanged" },
      { entry: null, type: "callback.selectionChanged" },
    ])
  })

  it("reconciles controlled path without public callback commands", () => {
    const state = createFileSystemKernelState({ items })
    const result = reduceFileSystemKernel(state, {
      path: "reports/",
      source: "controlled-prop",
      type: "path.changed",
    })

    expect(result.state.path).toBe("reports/")
    expect(result.state.history.back).toEqual([])
    expect(result.commands).toEqual([])
  })

  it("moves history backward and forward explicitly", () => {
    const start = createFileSystemKernelState({ items })
    const navigated = reduceFileSystemKernel(start, {
      path: "reports/",
      source: "user",
      type: "path.changed",
    }).state
    const back = reduceFileSystemKernel(navigated, { type: "history.back" })
    const forward = reduceFileSystemKernel(back.state, {
      type: "history.forward",
    })

    expect(back.state.path).toBe("")
    expect(back.state.history.forward).toEqual(["reports/"])
    expect(back.commands[0]).toEqual({ path: "", type: "callback.pathChanged" })
    expect(forward.state.path).toBe("reports/")
    expect(forward.state.history.back).toEqual([""])
  })

  it("rejects stale folder load success and failure by request id", () => {
    const loading = reduceFileSystemKernel(createFileSystemKernelState({ items }), {
      path: "lazy/",
      reason: "expand",
      requestId: "current",
      type: "folder.loadRequested",
    }).state
    const staleSuccess = reduceFileSystemKernel(loading, {
      items: [{ kind: "file", path: "lazy/stale.txt", mimeType: "text/plain" }],
      path: "lazy/",
      requestId: "stale",
      type: "folder.loadSucceeded",
    })
    const staleFailure = reduceFileSystemKernel(staleSuccess.state, {
      error: "stale failed",
      path: "lazy/",
      requestId: "stale",
      type: "folder.loadFailed",
    })

    expect(staleSuccess.state.tree.entriesByPath.has("lazy/stale.txt")).toBe(
      false
    )
    expect(selectLoadingFolders(staleFailure.state).has("lazy/")).toBe(true)
    expect(selectFolderErrors(staleFailure.state).has("lazy/")).toBe(false)
  })

  it("applies current folder load success exactly once", () => {
    const loading = reduceFileSystemKernel(createFileSystemKernelState({ items }), {
      path: "lazy/",
      reason: "expand",
      requestId: "current",
      type: "folder.loadRequested",
    }).state
    const success = reduceFileSystemKernel(loading, {
      items: [{ kind: "file", path: "lazy/loaded.txt", mimeType: "text/plain" }],
      path: "lazy/",
      requestId: "current",
      type: "folder.loadSucceeded",
    })

    expect(success.state.tree.entriesByPath.has("lazy/loaded.txt")).toBe(true)
    expect(selectLoadingFolders(success.state).has("lazy/")).toBe(false)
    expect(selectFolderErrors(success.state).has("lazy/")).toBe(false)
  })
})
