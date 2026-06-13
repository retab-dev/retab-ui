import { describe, expect, it } from "vitest"

import {
  DEFAULT_FILE_SYSTEM_DEMO_QUERY,
  FILE_SYSTEM_DEMO_ITEMS,
  LARGE_FILE_SYSTEM_DEMO_ITEMS,
  collectFileSystemDemoFolderPaths,
  collectFileSystemDemoItemPaths,
  formatFileSystemDemoState,
  parseFileSystemDemoState,
  type FileSystemDemoState,
} from "@/registry/new-york-v4/blocks/file-system-demo-state"

const fallbackState: FileSystemDemoState = {
  path: "",
  query: DEFAULT_FILE_SYSTEM_DEMO_QUERY,
  selectedPath: null,
  view: "list",
}

const folderPaths = collectFileSystemDemoFolderPaths(FILE_SYSTEM_DEMO_ITEMS)
const itemPaths = collectFileSystemDemoItemPaths(FILE_SYSTEM_DEMO_ITEMS)

describe("file-system demo state", () => {
  it("falls back from invalid URL state", () => {
    const state = parseFileSystemDemoState(
      new URLSearchParams(
        "path=missing/&selectedPath=missing.pdf&view=missing&filters.updatedAfter=never&sort.key=missing&sort.direction=sideways"
      ),
      { fallbackState, folderPaths, itemPaths }
    )

    expect(state).toEqual(fallbackState)
  })

  it("parses valid URL state", () => {
    const state = parseFileSystemDemoState(
      new URLSearchParams(
        "path=research/&search= attention &selectedPath=research/attention.pdf&view=grid&filters.categories=pdf&sort.key=kind&sort.direction=desc"
      ),
      { fallbackState, folderPaths, itemPaths }
    )

    expect(state).toEqual({
      path: "research/",
      query: {
        filters: { categories: ["pdf"], updatedAfter: null },
        search: "attention",
        sort: { direction: "desc", key: "kind" },
      },
      selectedPath: "research/attention.pdf",
      view: "grid",
    })
  })

  it("formats non-default state with stable params", () => {
    const value = formatFileSystemDemoState(
      {
        path: "research/",
        query: {
          filters: { categories: ["pdf"], updatedAfter: "last30" },
          search: "attention",
          sort: { direction: "desc", key: "kind" },
        },
        selectedPath: "research/attention.pdf",
        view: "grid",
      },
      fallbackState
    )
    const searchParams = new URLSearchParams(value)

    expect([...searchParams.keys()]).toEqual([
      "path",
      "search",
      "selectedPath",
      "view",
      "filters.categories",
      "filters.updatedAfter",
      "sort.key",
      "sort.direction",
    ])
    expect(searchParams.get("path")).toBe("research/")
    expect(searchParams.get("search")).toBe("attention")
    expect(searchParams.get("selectedPath")).toBe("research/attention.pdf")
    expect(searchParams.get("view")).toBe("grid")
  })

  it("generates the large manifest once at module scope", () => {
    expect(LARGE_FILE_SYSTEM_DEMO_ITEMS).toHaveLength(5_001)
    expect(LARGE_FILE_SYSTEM_DEMO_ITEMS[1]?.path).toBe("large/file-0000.pdf")
    expect(LARGE_FILE_SYSTEM_DEMO_ITEMS[5000]?.path).toBe(
      "large/file-4999.pdf"
    )
  })
})
