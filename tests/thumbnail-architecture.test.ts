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
      "components/file-thumbnail",
      "document" + "-thumbnail",
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

  it("uses the shared client gate instead of a local thumbnail copy", () => {
    const localUseIsClient =
      /\b(?:export\s+)?function\s+useIsClient\b|\b(?:const|let|var)\s+useIsClient\b/

    for (const file of sourceFilesUnder(
      join(repoRoot, "components/file-thumbnail")
    )) {
      const source = read(file)
      expect(
        localUseIsClient.test(source),
        `${file} defines a local useIsClient`
      ).toBe(false)
    }
  })

  it("keeps renderers independent from the public FileThumbnail facade", () => {
    for (const file of sourceFilesUnder(
      join(repoRoot, "components/file-thumbnail/renderers")
    )) {
      const source = read(file)
      expect(
        /from\s+["']@\/components\/ui\/file-thumbnail["']/.test(source),
        `${file} imports the facade`
      ).toBe(false)
    }
  })

  it("keeps public FileThumbnail behind the generated preview boundary", () => {
    const source = read("registry/new-york-v4/ui/file-thumbnail.tsx")

    expect(source).toContain("@/components/file-thumbnail/generated-preview")
    expect(source).not.toContain("@/components/file-thumbnail/descriptor")
    expect(source).not.toContain("@/components/file-thumbnail/keys")
    expect(source).not.toContain(
      "@/components/file-thumbnail/thumbnail-client-preview"
    )
    expect(source).not.toContain(
      "@/components/file-thumbnail/thumbnail-direct-image"
    )
    expect(source).not.toContain(
      "@/components/file-thumbnail/thumbnail-error-state"
    )
    expect(source).not.toContain(
      "@/components/file-thumbnail/thumbnail-options"
    )
  })

  it("keeps PDF and DOCX thumbnails independent from full viewers", () => {
    const renderers = [
      "components/file-thumbnail/renderers/pdf-thumbnail.tsx",
      "components/file-thumbnail/renderers/docx-thumbnail.tsx",
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
      "components/file-thumbnail/renderers/tiff-thumbnail.tsx",
      "components/file-thumbnail/renderers/xlsx-thumbnail.tsx",
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
      join(repoRoot, "components/file-thumbnail/renderers")
    )) {
      expect(read(file), `${file} defines a direct Map cache`).not.toMatch(
        /\bnew Map\s*</
      )
    }
  })

  it("keeps cache, worker, and suspense reset hooks registered", () => {
    const resetBackedFiles = [
      "components/file-thumbnail/thumbnail-cache.ts",
      "components/file-thumbnail/thumbnail-decode-queue.ts",
      "components/file-thumbnail/thumbnail-resource.ts",
      "components/file-thumbnail/thumbnail-worker-client.ts",
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

  it("keeps file-thumbnail registry metadata complete after the thumbnail cutover", () => {
    const registry = JSON.parse(read("registry.json")) as {
      items: Array<{
        name: string
        type: string
        dependencies?: string[]
        registryDependencies?: string[]
        files: Array<{ path: string }>
      }>
    }
    const item = registry.items.find(
      (candidate) => candidate.name === "file-thumbnail"
    )

    expect(
      registry.items.some(
        (candidate) => candidate.name === "document" + "-thumbnail"
      )
    ).toBe(false)
    expect(item).toBeTruthy()
    expect(item!.type).toBe("registry:ui")
    expect(item!.dependencies).toEqual([
      "@e965/xlsx",
      "dompurify",
      "jszip",
      "marked",
      "pptxviewjs",
      "utif",
    ])
    expect(item!.registryDependencies).toEqual([
      "file-thumbnail-frame",
      "pdf-document-resource",
      "docx-document-resource",
      "csv",
      "xlsx-worker-protocol",
      "utils",
    ])
    const files = item!.files.map((file) => file.path)
    expect(files).toContain("registry/new-york-v4/ui/file-thumbnail.tsx")
    expect(files).toContain("registry/new-york-v4/ui/file-thumbnail-types.ts")
    expect(files).toContain("components/file-thumbnail/generated-preview.tsx")
    expect(files).toContain(
      "components/file-thumbnail/thumbnail-direct-image.tsx"
    )
    expect(files).toContain(
      "components/file-thumbnail/renderers/pdf-thumbnail.tsx"
    )
    expect(files).toContain("components/file-thumbnail-tiff.worker.ts")
    expect(files).toContain("components/file-thumbnail-xlsx.worker.ts")
  })
})
