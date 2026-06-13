import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8")
}

function sourceFilesUnder(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) return sourceFilesUnder(fullPath)
    if (!/\.(ts|tsx)$/.test(entry)) return []
    return [relative(repoRoot, fullPath)]
  })
}

describe("thumbnail architecture", () => {
  it("keeps FileThumbnailFrame as a dependency-free shell", () => {
    const primitiveFiles = [
      "registry/new-york-v4/ui/file-thumbnail-frame.tsx",
      "registry/new-york-v4/ui/file-thumbnail-frame-types.ts",
      "registry/new-york-v4/ui/file-thumbnail-extension.ts",
      "registry/new-york-v4/ui/file-thumbnail-fallback.tsx",
      "registry/new-york-v4/ui/file-thumbnail-image.tsx",
      "registry/new-york-v4/ui/file-thumbnail-shimmer.tsx",
      "components/ui/file-thumbnail-frame.tsx",
    ]
    const forbidden = [
      "components/document-thumbnail",
      "document-thumbnail",
      "pdfjs-dist",
      "docx-preview",
      "pptxviewjs",
      "@e965/xlsx",
      "utif",
    ]

    for (const file of primitiveFiles) {
      const source = read(file)
      for (const token of forbidden) {
        expect(source.includes(token), `${file} imports ${token}`).toBe(false)
      }
    }
  })

  it("keeps the direct image path out of the DocumentThumbnail facade", () => {
    const facade = read("components/document-thumbnail.tsx")
    const directImage = read(
      "components/document-thumbnail/thumbnail-direct-image.tsx"
    )

    expect(facade).toContain("thumbnail-direct-image")
    expect(facade).not.toContain("previewImageUrl")
    expect(facade).not.toContain("createThumbnailImageLoadError")
    expect(facade).not.toContain("ANCHOR_OBJECT_POSITION")
    expect(directImage).toContain("previewImageUrl")
    expect(directImage).toContain("createThumbnailImageLoadError")
    expect(directImage).toContain("ANCHOR_OBJECT_POSITION")
  })

  it("does not re-export internal thumbnail key helpers from the facade", () => {
    const facade = read("components/document-thumbnail.tsx")

    expect(facade).not.toMatch(
      /export\s+\{\s*getThumbnailKey|export\s+\{\s*getThumbnailRenderKey/
    )
  })

  it("uses the shared client gate instead of a local thumbnail copy", () => {
    const localUseIsClient =
      /\b(?:export\s+)?function\s+useIsClient\b|\b(?:const|let|var)\s+useIsClient\b/

    for (const file of sourceFilesUnder(
      join(repoRoot, "components/document-thumbnail")
    ).concat(["components/document-thumbnail.tsx"])) {
      const source = read(file)
      expect(
        localUseIsClient.test(source),
        `${file} defines a local useIsClient`
      ).toBe(false)
    }
  })

  it("keeps renderers independent from the DocumentThumbnail facade", () => {
    for (const file of sourceFilesUnder(
      join(repoRoot, "components/document-thumbnail/renderers")
    )) {
      const source = read(file)
      expect(
        /from\s+["']@\/components\/document-thumbnail["']/.test(source),
        `${file} imports the facade`
      ).toBe(false)
    }
  })

  it("keeps PDF and DOCX thumbnails independent from full viewers", () => {
    const renderers = [
      "components/document-thumbnail/renderers/pdf-thumbnail.tsx",
      "components/document-thumbnail/renderers/docx-thumbnail.tsx",
    ]

    for (const file of renderers) {
      const source = read(file)
      expect(source, `${file} imports pdf-viewer`).not.toContain(
        "@/components/ui/pdf-viewer"
      )
      expect(source, `${file} imports docx-viewer`).not.toContain(
        "@/components/ui/docx-viewer"
      )
    }

    expect(read(renderers[0])).toContain("@/lib/pdf-document-resource")
    expect(read(renderers[1])).toContain("@/lib/docx-document-resource")
  })

  it("keeps worker-backed renderers on the shared worker client", () => {
    const workerRenderers = [
      "components/document-thumbnail/renderers/tiff-thumbnail.tsx",
      "components/document-thumbnail/renderers/xlsx-thumbnail.tsx",
    ]

    for (const file of workerRenderers) {
      const source = read(file)
      expect(source).toContain("createThumbnailWorkerClient")
      expect(source).not.toMatch(/\bnew Map\s*</)
      expect(source).not.toMatch(/\b(?:let|const)\s+\w*(?:ReqId|Pending)\b/)
    }
  })

  it("keeps renderer artifact caches behind the bounded cache primitive", () => {
    for (const file of sourceFilesUnder(
      join(repoRoot, "components/document-thumbnail/renderers")
    )) {
      expect(read(file), `${file} defines a direct Map cache`).not.toMatch(
        /\bnew Map\s*</
      )
    }
  })

  it("keeps cache, worker, and suspense reset hooks registered", () => {
    const resetBackedFiles = [
      "components/document-thumbnail/thumbnail-cache.ts",
      "components/document-thumbnail/thumbnail-decode-queue.ts",
      "components/document-thumbnail/thumbnail-resource.ts",
      "components/document-thumbnail/thumbnail-worker-client.ts",
    ]

    for (const file of resetBackedFiles) {
      expect(read(file), `${file} must register test reset`).toContain(
        "registerThumbnailTestReset"
      )
    }
  })

  it("keeps file-thumbnail-frame registry metadata scoped to the shell", () => {
    const registry = JSON.parse(read("registry.json")) as {
      items: Array<{
        name: string
        registryDependencies?: string[]
        files: Array<{ path: string }>
      }>
    }
    const item = registry.items.find(
      (candidate) => candidate.name === "file-thumbnail-frame"
    )

    expect(item).toBeTruthy()
    expect(item!.registryDependencies).toEqual(["utils"])
    expect(item!.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/ui/file-thumbnail-frame.tsx",
      "registry/new-york-v4/ui/file-thumbnail-frame-types.ts",
      "registry/new-york-v4/ui/file-thumbnail-extension.ts",
      "registry/new-york-v4/ui/file-thumbnail-fallback.tsx",
      "registry/new-york-v4/ui/file-thumbnail-shimmer.tsx",
      "registry/new-york-v4/ui/file-thumbnail-image.tsx",
    ])
  })

  it("keeps PDF and DOCX resource registry items renderless", () => {
    const registry = JSON.parse(read("registry.json")) as {
      items: Array<{
        name: string
        type: string
        dependencies?: string[]
        registryDependencies?: string[]
        files: Array<{ path: string }>
      }>
    }
    const pdfResource = registry.items.find(
      (candidate) => candidate.name === "pdf-document-resource"
    )
    const docxResource = registry.items.find(
      (candidate) => candidate.name === "docx-document-resource"
    )
    const pdfViewer = registry.items.find(
      (candidate) => candidate.name === "pdf-viewer"
    )
    const docxViewer = registry.items.find(
      (candidate) => candidate.name === "docx-viewer"
    )

    expect(pdfResource).toMatchObject({
      type: "registry:lib",
      dependencies: ["pdfjs-dist@5.4.296"],
    })
    expect(pdfResource!.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/lib/pdf-document-resource.ts",
      "registry/new-york-v4/lib/viewer-errors.ts",
      "registry/new-york-v4/lib/viewer-resource.ts",
    ])
    expect(docxResource).toMatchObject({ type: "registry:lib" })
    expect(docxResource!.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/lib/docx-document-resource.ts",
      "registry/new-york-v4/lib/viewer-resource.ts",
    ])
    expect(pdfViewer!.registryDependencies).toContain("pdf-document-resource")
    expect(docxViewer!.registryDependencies).toContain("docx-document-resource")
    expect(pdfViewer!.files.map((file) => file.path)).not.toContain(
      "registry/new-york-v4/ui/pdf-viewer-resource.ts"
    )
    expect(docxViewer!.files.map((file) => file.path)).not.toContain(
      "registry/new-york-v4/ui/docx-viewer-resource.ts"
    )
  })

  it("keeps document-thumbnail registry metadata complete and separate", () => {
    const registry = JSON.parse(read("registry.json")) as {
      items: Array<{
        name: string
        type: string
        registryDependencies?: string[]
        files: Array<{ path: string }>
      }>
    }
    const item = registry.items.find(
      (candidate) => candidate.name === "document-thumbnail"
    )

    expect(item).toBeTruthy()
    expect(item!.type).toBe("registry:component")
    expect(item!.registryDependencies).toEqual([
      "file-thumbnail-frame",
      "pdf-document-resource",
      "docx-document-resource",
      "csv",
      "xlsx-worker-protocol",
      "utils",
    ])
    expect(item!.files.map((file) => file.path)).toEqual([
      "components/document-thumbnail.tsx",
      "components/document-thumbnail/descriptor.ts",
      "components/document-thumbnail/errors.tsx",
      "components/document-thumbnail/keys.ts",
      "components/document-thumbnail/renderer-registry.tsx",
      "components/document-thumbnail/thumbnail-cache.ts",
      "components/document-thumbnail/thumbnail-client-preview.tsx",
      "components/document-thumbnail/thumbnail-decode-queue.ts",
      "components/document-thumbnail/thumbnail-direct-image.tsx",
      "components/document-thumbnail/thumbnail-error-state.ts",
      "components/document-thumbnail/thumbnail-errors.ts",
      "components/document-thumbnail/thumbnail-in-view.ts",
      "components/document-thumbnail/thumbnail-limits.ts",
      "components/document-thumbnail/thumbnail-options.ts",
      "components/document-thumbnail/thumbnail-profile.ts",
      "components/document-thumbnail/thumbnail-resource.ts",
      "components/document-thumbnail/thumbnail-test-reset.ts",
      "components/document-thumbnail/thumbnail-text.ts",
      "components/document-thumbnail/thumbnail-worker-client.ts",
      "components/document-thumbnail/types.ts",
      "components/document-thumbnail/renderers/csv-thumbnail.tsx",
      "components/document-thumbnail/renderers/docx-thumbnail.tsx",
      "components/document-thumbnail/renderers/html-thumbnail.tsx",
      "components/document-thumbnail/renderers/image-thumbnail.tsx",
      "components/document-thumbnail/renderers/layout.tsx",
      "components/document-thumbnail/renderers/markdown-thumbnail.tsx",
      "components/document-thumbnail/renderers/pdf-thumbnail.tsx",
      "components/document-thumbnail/renderers/pptx-thumbnail.tsx",
      "components/document-thumbnail/renderers/text-thumbnail.tsx",
      "components/document-thumbnail/renderers/tiff-thumbnail.tsx",
      "components/document-thumbnail/renderers/use-object-url.ts",
      "components/document-thumbnail/renderers/xlsx-thumbnail.tsx",
      "components/document-thumbnail-tiff.worker.ts",
      "components/document-thumbnail-xlsx.worker.ts",
    ])
  })
})
