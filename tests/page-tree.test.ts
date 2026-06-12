import { describe, expect, it } from "vitest"

import {
  getAllPagesFromFolder,
  getCurrentBase,
  getNestedPagesFromFolder,
  getPagesFromFolder,
  type PageTreeFolder,
  type PageTreePage,
} from "@/lib/page-tree"

// ---------------------------------------------------------------------------
// Fixture builders. The real types come from fumadocs' source.pageTree, which
// is a runtime-heavy structure; for unit tests we build the minimal shape the
// functions actually read and cast through `unknown`.
// ---------------------------------------------------------------------------

function page(url: string, name = url): PageTreePage {
  return { type: "page", name, url } as unknown as PageTreePage
}

function folder(
  init: {
    $id?: string
    name?: string
    children?: Array<PageTreePage | PageTreeFolder>
  } = {}
): PageTreeFolder {
  return {
    type: "folder",
    $id: init.$id,
    name: init.name,
    children: init.children ?? [],
  } as unknown as PageTreeFolder
}

// ---------------------------------------------------------------------------
// getAllPagesFromFolder
// ---------------------------------------------------------------------------

describe("getAllPagesFromFolder", () => {
  it("collects pages across nested folders depth-first", () => {
    const tree = folder({
      children: [
        page("/a"),
        folder({
          children: [page("/b/1"), folder({ children: [page("/b/2/deep")] })],
        }),
        page("/c"),
      ],
    })

    expect(getAllPagesFromFolder(tree).map((p) => p.url)).toEqual([
      "/a",
      "/b/1",
      "/b/2/deep",
      "/c",
    ])
  })

  it("returns an empty list for a folder with no pages", () => {
    expect(getAllPagesFromFolder(folder())).toEqual([])
    expect(
      getAllPagesFromFolder(folder({ children: [folder(), folder()] }))
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getCurrentBase
// ---------------------------------------------------------------------------

describe("getCurrentBase", () => {
  it("extracts radix or base from a component subpage", () => {
    expect(getCurrentBase("/docs/components/radix/accordion")).toBe("radix")
    expect(getCurrentBase("/docs/components/base/accordion")).toBe("base")
  })

  it("defaults to radix for non-component and bare paths", () => {
    expect(getCurrentBase("/docs")).toBe("radix")
    expect(getCurrentBase("/docs/components")).toBe("radix")
    expect(getCurrentBase("/docs/viewers/pdf")).toBe("radix")
    expect(getCurrentBase("")).toBe("radix")
  })

  it("requires a trailing slash after the base segment", () => {
    // The regex `/\/docs\/components\/(radix|base)\//` demands a slash *after*
    // the base name, so an exact section-index path is not recognized and
    // falls back to the radix default.
    expect(getCurrentBase("/docs/components/radix")).toBe("radix") // default masks it
    // NOTE: this is the suspicious case — a visitor on the Base UI index would
    // be classified as "radix". Captured here as current behavior.
    expect(getCurrentBase("/docs/components/base")).toBe("radix")
  })

  it("only matches the components path, not arbitrary radix/base segments", () => {
    expect(getCurrentBase("/docs/guides/base/intro")).toBe("radix")
    expect(getCurrentBase("/blog/components/base/x")).toBe("radix")
  })
})

// ---------------------------------------------------------------------------
// getPagesFromFolder — components branch
// ---------------------------------------------------------------------------

describe("getPagesFromFolder (components folder)", () => {
  const components = folder({
    $id: "components",
    name: "Components",
    children: [
      folder({
        $id: "radix",
        name: "Radix UI",
        children: [page("/docs/components/radix/accordion"), folder()],
      }),
      folder({
        $id: "base",
        name: "Base UI",
        children: [page("/docs/components/base/accordion")],
      }),
    ],
  })

  it("returns the matching base subfolder's direct pages", () => {
    expect(getPagesFromFolder(components, "radix").map((p) => p.url)).toEqual([
      "/docs/components/radix/accordion",
    ])
    expect(getPagesFromFolder(components, "base").map((p) => p.url)).toEqual([
      "/docs/components/base/accordion",
    ])
  })

  it("matches the components folder by name when $id is absent", () => {
    const byName = folder({
      name: "Components",
      children: [
        folder({
          name: "Radix UI",
          children: [page("/docs/components/radix/tabs")],
        }),
      ],
    })

    expect(getPagesFromFolder(byName, "radix").map((p) => p.url)).toEqual([
      "/docs/components/radix/tabs",
    ])
  })

  it("falls back to all nested pages (minus the index) when the base is unknown", () => {
    expect(
      getPagesFromFolder(components, "unknown-base").map((p) => p.url)
    ).toEqual([
      "/docs/components/radix/accordion",
      "/docs/components/base/accordion",
    ])
  })

  it("drops the components index page in the fallback list", () => {
    const withIndex = folder({
      $id: "components",
      name: "Components",
      children: [page("/docs/components"), page("/docs/components/misc")],
    })

    expect(getPagesFromFolder(withIndex, "missing").map((p) => p.url)).toEqual([
      "/docs/components/misc",
    ])
  })
})

// ---------------------------------------------------------------------------
// getPagesFromFolder — generic branch
// ---------------------------------------------------------------------------

describe("getPagesFromFolder (generic folder)", () => {
  it("returns direct page children only", () => {
    const viewers = folder({
      $id: "viewers",
      name: "Viewers",
      children: [
        page("/docs/viewers/pdf"),
        page("/docs/viewers/image"),
        folder({ children: [page("/docs/viewers/nested/deep")] }),
      ],
    })

    expect(getPagesFromFolder(viewers, "radix").map((p) => p.url)).toEqual([
      "/docs/viewers/pdf",
      "/docs/viewers/image",
    ])
  })

  it("removes a direct page that is the parent of another direct page", () => {
    const section = folder({
      $id: "api",
      children: [
        page("/docs/api"),
        page("/docs/api/auth"),
        page("/docs/api/users"),
      ],
    })

    expect(getPagesFromFolder(section, "radix").map((p) => p.url)).toEqual([
      "/docs/api/auth",
      "/docs/api/users",
    ])
  })

  it("does not treat a shared string prefix as a parent relationship", () => {
    // "/docs/api" is a string prefix of "/docs/apiv2" but not a path parent;
    // the trailing-slash guard must keep both.
    const section = folder({
      $id: "api",
      children: [page("/docs/api"), page("/docs/apiv2")],
    })

    expect(getPagesFromFolder(section, "radix").map((p) => p.url)).toEqual([
      "/docs/api",
      "/docs/apiv2",
    ])
  })
})

// ---------------------------------------------------------------------------
// getNestedPagesFromFolder
// ---------------------------------------------------------------------------

describe("getNestedPagesFromFolder", () => {
  const root = folder({
    children: [
      folder({
        $id: "pdf",
        name: "PDF Viewer",
        children: [
          page("/docs/components/pdf/usage"),
          page("/docs/components/pdf/api"),
        ],
      }),
      folder({
        name: "Image Viewer",
        children: [page("/docs/components/image-viewer/usage")],
      }),
    ],
  })

  it("matches a nested folder by $id", () => {
    expect(getNestedPagesFromFolder(root, "pdf").map((p) => p.url)).toEqual([
      "/docs/components/pdf/usage",
      "/docs/components/pdf/api",
    ])
  })

  it("matches a nested folder by slugified name", () => {
    expect(
      getNestedPagesFromFolder(root, "image-viewer").map((p) => p.url)
    ).toEqual(["/docs/components/image-viewer/usage"])
  })

  it("matches a nested folder by component-url containment", () => {
    const byUrl = folder({
      children: [
        folder({
          $id: "unrelated-id",
          name: "Unrelated",
          children: [page("/docs/components/tooltip/usage")],
        }),
      ],
    })

    expect(
      getNestedPagesFromFolder(byUrl, "tooltip").map((p) => p.url)
    ).toEqual(["/docs/components/tooltip/usage"])
  })

  it("returns an empty list when no nested folder matches", () => {
    expect(getNestedPagesFromFolder(root, "does-not-exist")).toEqual([])
  })
})
