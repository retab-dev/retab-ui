import { describe, expect, it } from "vitest";

import {
  getAllPagesFromFolder,
  getCurrentBase,
  getNestedPagesFromFolder,
  getPagesFromFolder,
  getSidebarGroupsFromFolder,
  type PageTreeFolder,
  type PageTreePage,
} from "@/lib/page-tree";

// ---------------------------------------------------------------------------
// Fixture builders. The real types come from fumadocs' source.pageTree, which
// is a runtime-heavy structure; for unit tests we build the minimal shape the
// functions actually read and cast through `unknown`.
// ---------------------------------------------------------------------------

function page(url: string, name = url): PageTreePage {
  return { type: "page", name, url } as unknown as PageTreePage;
}

function folder(
  init: {
    $id?: string;
    name?: string;
    children?: Array<PageTreePage | PageTreeFolder>;
  } = {},
): PageTreeFolder {
  return {
    type: "folder",
    $id: init.$id,
    name: init.name,
    children: init.children ?? [],
  } as unknown as PageTreeFolder;
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
    });

    expect(getAllPagesFromFolder(tree).map((p) => p.url)).toEqual([
      "/a",
      "/b/1",
      "/b/2/deep",
      "/c",
    ]);
  });

  it("returns an empty list for a folder with no pages", () => {
    expect(getAllPagesFromFolder(folder())).toEqual([]);
    expect(
      getAllPagesFromFolder(folder({ children: [folder(), folder()] })),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getCurrentBase
// ---------------------------------------------------------------------------

describe("getCurrentBase", () => {
  it("extracts radix or base from a component subpage", () => {
    expect(getCurrentBase("/docs/components/radix/accordion")).toBe("radix");
    expect(getCurrentBase("/docs/components/base/accordion")).toBe("base");
  });

  it("defaults to radix for non-component and bare paths", () => {
    expect(getCurrentBase("/docs")).toBe("radix");
    expect(getCurrentBase("/docs/components")).toBe("radix");
    expect(getCurrentBase("/docs/components/file-viewer/pdf")).toBe("radix");
    expect(getCurrentBase("")).toBe("radix");
  });

  it("requires a trailing slash after the base segment", () => {
    // The regex `/\/docs\/components\/(radix|base)\//` demands a slash *after*
    // the base name, so an exact section-index path is not recognized and
    // falls back to the radix default.
    expect(getCurrentBase("/docs/components/radix")).toBe("radix"); // default masks it
    // NOTE: this is the suspicious case — a visitor on the Base UI index would
    // be classified as "radix". Captured here as current behavior.
    expect(getCurrentBase("/docs/components/base")).toBe("radix");
  });

  it("only matches the components path, not arbitrary radix/base segments", () => {
    expect(getCurrentBase("/docs/guides/base/intro")).toBe("radix");
    expect(getCurrentBase("/blog/components/base/x")).toBe("radix");
  });
});

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
  });

  it("returns the matching base subfolder's direct pages", () => {
    expect(getPagesFromFolder(components, "radix").map((p) => p.url)).toEqual([
      "/docs/components/radix/accordion",
    ]);
    expect(getPagesFromFolder(components, "base").map((p) => p.url)).toEqual([
      "/docs/components/base/accordion",
    ]);
  });

  it("matches the components folder by name when $id is absent", () => {
    const byName = folder({
      name: "Components",
      children: [
        folder({
          name: "Radix UI",
          children: [page("/docs/components/radix/tabs")],
        }),
      ],
    });

    expect(getPagesFromFolder(byName, "radix").map((p) => p.url)).toEqual([
      "/docs/components/radix/tabs",
    ]);
  });

  it("falls back to all nested pages (minus the index) when the base is unknown", () => {
    expect(
      getPagesFromFolder(components, "unknown-base").map((p) => p.url),
    ).toEqual([
      "/docs/components/radix/accordion",
      "/docs/components/base/accordion",
    ]);
  });

  it("drops the components index page in the fallback list", () => {
    const withIndex = folder({
      $id: "components",
      name: "Components",
      children: [page("/docs/components"), page("/docs/components/misc")],
    });

    expect(getPagesFromFolder(withIndex, "missing").map((p) => p.url)).toEqual([
      "/docs/components/misc",
    ]);
  });

  it("excludes retired direct component pages from the fallback jump list", () => {
    const components = folder({
      $id: "components",
      name: "Components",
      children: [
        page("/docs/components/data-cell", "Data Cell"),
        page("/docs/components/json-form", "JSON Form"),
        page("/docs/components/parse-viewer", "Parse Viewer"),
        page("/docs/components/file-thumbnail", "File Thumbnail"),
      ],
    });

    expect(getPagesFromFolder(components, "missing").map((p) => p.url)).toEqual(
      ["/docs/components/json-form", "/docs/components/file-thumbnail"],
    );
  });
});

// ---------------------------------------------------------------------------
// getPagesFromFolder — generic branch
// ---------------------------------------------------------------------------

describe("getPagesFromFolder (generic folder)", () => {
  it("returns direct page children only", () => {
    const viewers = folder({
      $id: "viewers",
      name: "Viewers",
      children: [
        page("/docs/components/file-viewer/pdf"),
        page("/docs/components/file-viewer/image"),
        folder({
          children: [page("/docs/components/file-viewer/nested/deep")],
        }),
      ],
    });

    expect(getPagesFromFolder(viewers, "radix").map((p) => p.url)).toEqual([
      "/docs/components/file-viewer/pdf",
      "/docs/components/file-viewer/image",
    ]);
  });

  it("keeps a direct index page beside its child pages", () => {
    const section = folder({
      $id: "api",
      children: [
        page("/docs/api"),
        page("/docs/api/auth"),
        page("/docs/api/users"),
      ],
    });

    expect(getPagesFromFolder(section, "radix").map((p) => p.url)).toEqual([
      "/docs/api",
      "/docs/api/auth",
      "/docs/api/users",
    ]);
  });

  it("does not treat a shared string prefix as a parent relationship", () => {
    // "/docs/api" is a string prefix of "/docs/apiv2" but not a path parent;
    // the trailing-slash guard must keep both.
    const section = folder({
      $id: "api",
      children: [page("/docs/api"), page("/docs/apiv2")],
    });

    expect(getPagesFromFolder(section, "radix").map((p) => p.url)).toEqual([
      "/docs/api",
      "/docs/apiv2",
    ]);
  });
});

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
  });

  it("matches a nested folder by $id", () => {
    expect(getNestedPagesFromFolder(root, "pdf").map((p) => p.url)).toEqual([
      "/docs/components/pdf/usage",
      "/docs/components/pdf/api",
    ]);
  });

  it("matches a nested folder by slugified name", () => {
    expect(
      getNestedPagesFromFolder(root, "image-viewer").map((p) => p.url),
    ).toEqual(["/docs/components/image-viewer/usage"]);
  });

  it("matches a nested folder by component-url containment", () => {
    const byUrl = folder({
      children: [
        folder({
          $id: "unrelated-id",
          name: "Unrelated",
          children: [page("/docs/components/tooltip/usage")],
        }),
      ],
    });

    expect(
      getNestedPagesFromFolder(byUrl, "tooltip").map((p) => p.url),
    ).toEqual(["/docs/components/tooltip/usage"]);
  });

  it("returns an empty list when no nested folder matches", () => {
    expect(getNestedPagesFromFolder(root, "does-not-exist")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getSidebarGroupsFromFolder
// ---------------------------------------------------------------------------

// Cast through PageTreePage so the fixture's children array accepts it; the
// production code only reads `type` / `name`, both present at runtime.
function separator(name: string): PageTreePage {
  return { type: "separator", name } as unknown as PageTreePage;
}

describe("getSidebarGroupsFromFolder", () => {
  it("promotes a nested folder's index page to the group label link instead of duplicating its name", () => {
    const components = folder({
      $id: "components",
      name: "Components",
      children: [
        separator("File Viewer"),
        folder({
          name: "File Viewer",
          children: [
            page("/docs/components/file-viewer", "File Viewer"),
            page("/docs/components/file-viewer/anatomy", "Anatomy"),
            page("/docs/components/file-viewer/renderers/pdf", "PDF Viewer"),
          ],
        }),
      ],
    });

    const groups = getSidebarGroupsFromFolder(components, "radix");
    const fileViewer = groups.find((g) => g.name === "File Viewer");

    expect(fileViewer?.url).toBe("/docs/components/file-viewer");
    // The index page is no longer repeated as the first child entry.
    expect(fileViewer?.pages.map((p) => p.name)).toEqual([
      "Anatomy",
      "PDF Viewer",
    ]);
  });

  it("keeps nested component folders as sidebar sections", () => {
    const components = folder({
      $id: "components",
      name: "Components",
      children: [
        separator("File Viewer"),
        folder({
          name: "File Viewer",
          children: [
            page("/docs/components/file-viewer", "Overview"),
            folder({
              name: "Anatomy",
              children: [
                page("/docs/components/file-viewer/anatomy", "Anatomy"),
                page(
                  "/docs/components/file-viewer/anatomy/file-viewer",
                  "FileViewer",
                ),
                page(
                  "/docs/components/file-viewer/anatomy/file-viewer-header",
                  "FileViewerHeader",
                ),
              ],
            }),
            folder({
              name: "Renderers",
              children: [
                page("/docs/components/file-viewer/renderers/pdf", "PDF"),
                page("/docs/components/file-viewer/renderers/image", "Image"),
              ],
            }),
          ],
        }),
      ],
    });

    const groups = getSidebarGroupsFromFolder(components, "radix");
    const fileViewer = groups.find((g) => g.name === "File Viewer");

    expect(fileViewer?.url).toBeUndefined();
    expect(fileViewer?.pages.map((p) => p.name)).toEqual(["Overview"]);
    expect(fileViewer?.sections?.map((section) => section.name)).toEqual([
      "Anatomy",
      "Renderers",
    ]);
    expect(fileViewer?.sections?.[0]?.url).toBe(
      "/docs/components/file-viewer/anatomy",
    );
    expect(fileViewer?.sections?.[0]?.pages.map((p) => p.name)).toEqual([
      "FileViewer",
      "FileViewerHeader",
    ]);
    expect(fileViewer?.sections?.[1]?.url).toBeUndefined();
    expect(fileViewer?.sections?.[1]?.pages.map((p) => p.name)).toEqual([
      "PDF",
      "Image",
    ]);
  });

  it("leaves a separator group untouched when no nested index page shares its name", () => {
    const components = folder({
      $id: "components",
      name: "Components",
      children: [
        separator("Result Viewers"),
        page("/docs/components/classification-viewer", "Classification Viewer"),
        page("/docs/components/partition-viewer", "Partition Viewer"),
      ],
    });

    const groups = getSidebarGroupsFromFolder(components, "radix");
    const resultViewers = groups.find((g) => g.name === "Result Viewers");

    expect(resultViewers?.url).toBeUndefined();
    expect(resultViewers?.pages.map((p) => p.name)).toEqual([
      "Classification Viewer",
      "Partition Viewer",
    ]);
  });

  it("hides retired component pages and folds stale File Intake pages into Forms & Data", () => {
    const components = folder({
      $id: "components",
      name: "Components",
      children: [
        separator("Forms & Data"),
        page("/docs/components/data-cell", "Data Cell"),
        page("/docs/components/json-form", "JSON Form"),
        page("/docs/components/json-table", "JSON Table"),
        page("/docs/components/schema-builder", "Schema Builder"),
        page("/docs/components/parse-viewer", "Parse Viewer"),
        separator("File Intake"),
        page("/docs/components/dropzone", "Dropzone"),
        page("/docs/components/file-thumbnail", "File Thumbnail"),
      ],
    });

    const groups = getSidebarGroupsFromFolder(components, "radix");

    expect(groups.map((g) => g.name)).toEqual(["Forms & Data"]);
    expect(groups[0]?.pages.map((p) => p.name)).toEqual([
      "JSON Form",
      "JSON Table",
      "Schema Builder",
      "Dropzone",
      "File Thumbnail",
    ]);
  });
});
