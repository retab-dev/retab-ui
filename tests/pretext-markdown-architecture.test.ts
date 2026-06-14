import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

type RegistryFile = {
  path: string
}

type RegistryItem = {
  dependencies?: string[]
  files: RegistryFile[]
  name: string
  registryDependencies?: string[]
}

type Registry = {
  items: RegistryItem[]
}

const repoRoot = process.cwd()
const pretextMarkdownFiles = [
  "registry/new-york-v4/ui/pretext-markdown-viewer.tsx",
  "registry/new-york-v4/ui/pretext-markdown-viewer-content.tsx",
  "registry/new-york-v4/ui/pretext-markdown-document-model.ts",
  "registry/new-york-v4/ui/pretext-markdown-layout.ts",
  "registry/new-york-v4/ui/pretext-markdown-parser.ts",
  "registry/new-york-v4/ui/pretext-markdown-policy.ts",
  "registry/new-york-v4/ui/pretext-markdown-table-accessibility.ts",
  "registry/new-york-v4/ui/pretext-markdown-virtualizer.ts",
  "registry/new-york-v4/ui/pretext-markdown-renderer.tsx",
]
const textViewerFiles = [
  "registry/new-york-v4/ui/text-viewer.tsx",
  "registry/new-york-v4/ui/text-viewer-content.tsx",
  "registry/new-york-v4/ui/text-viewer-chenglou.tsx",
  "registry/new-york-v4/ui/text-viewer-chenglou-content.tsx",
  "registry/new-york-v4/ui/text-viewer-vanillacheng.tsx",
  "registry/new-york-v4/ui/text-viewer-layout.ts",
  "registry/new-york-v4/ui/text-viewer-virtualization.ts",
  "registry/new-york-v4/ui/text-viewer-resource.ts",
  "registry/new-york-v4/ui/text-viewer-types.ts",
  "registry/new-york-v4/ui/text-viewer-ranges.ts",
  "registry/new-york-v4/ui/text-viewer-scale.ts",
  "registry/new-york-v4/ui/text-viewer-chrome.tsx",
  "components/ui/text-viewer.tsx",
  "components/ui/text-viewer-content.tsx",
  "components/ui/text-viewer-chenglou.tsx",
  "components/ui/text-viewer-vanillacheng.tsx",
  "components/ui/text-viewer-layout.ts",
  "components/ui/text-viewer-virtualization.ts",
  "components/ui/text-viewer-resource.ts",
  "components/ui/text-viewer-types.ts",
  "components/ui/text-viewer-ranges.ts",
  "components/ui/text-viewer-scale.ts",
  "components/ui/text-viewer-chrome.tsx",
]

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8")
}

function readRegistry() {
  return JSON.parse(read("registry.json")) as Registry
}

function importSpecifiers(source: string) {
  return Array.from(
    source.matchAll(/\bimport(?:\s+type)?[\s\S]*?\bfrom\s+["']([^"']+)["']/g)
  ).map((match) => match[1]!)
}

describe("Pretext Markdown architecture", () => {
  it("keeps the implementation independent from old Markdown Document modules", () => {
    for (const file of pretextMarkdownFiles) {
      const source = read(file)
      for (const specifier of importSpecifiers(source)) {
        expect(
          isOldMarkdownDocumentImport(specifier),
          `${file} imports old Markdown module ${specifier}`
        ).toBe(false)
      }
    }
  })

  it("keeps the registry item separate from markdown-document-viewer", () => {
    const registry = readRegistry()
    const item = registry.items.find(
      (registryItem) => registryItem.name === "pretext-markdown-viewer"
    )

    expect(item).toBeTruthy()
    expect(item?.registryDependencies ?? []).not.toContain(
      "markdown-document-viewer"
    )
    expect(item?.dependencies ?? []).not.toContain("markdown-document-viewer")
    expect(item?.files.map((file) => file.path).sort()).toEqual(
      [...pretextMarkdownFiles].sort()
    )
  })

  it("keeps virtual chunks from becoming visible page chrome", () => {
    const forbiddenPageChrome = [
      "data-pretext-markdown-page",
      'data-slot="markdown-document-page"',
      "data-slot='markdown-document-page'",
      "Page 1 of",
      "Page {",
      "Page ${",
    ]

    for (const file of pretextMarkdownFiles) {
      const source = read(file)
      for (const token of forbiddenPageChrome) {
        expect(
          source.includes(token),
          `${file} contains visible page chrome token ${token}`
        ).toBe(false)
      }
    }
  })

  it("keeps the viewer content on the private Pretext layout and virtualizer", () => {
    const imports = importSpecifiers(
      read("registry/new-york-v4/ui/pretext-markdown-viewer-content.tsx")
    )

    expect(imports).toContain("./pretext-markdown-layout")
    expect(imports).toContain("./pretext-markdown-virtualizer")
    expect(imports).not.toContain("./markdown-document-layout")
    expect(imports).not.toContain("./markdown-document-virtualizer")
    expect(imports).not.toContain("./text-viewer-layout")
    expect(imports).not.toContain("./text-viewer-virtualization")
  })

  it("keeps the parser dependency behind the Pretext Markdown parser adapter", () => {
    const parserImports = importSpecifiers(
      read("registry/new-york-v4/ui/pretext-markdown-parser.ts")
    )
    expect(parserImports).toContain("marked")

    for (const file of pretextMarkdownFiles) {
      if (file.endsWith("pretext-markdown-parser.ts")) continue
      const imports = importSpecifiers(read(file))
      expect(imports, `${file} imports marked directly`).not.toContain("marked")
    }
  })

  it("keeps heading IDs owned by the document model instead of rehype slugging", () => {
    const policySource = read(
      "registry/new-york-v4/ui/pretext-markdown-policy.ts"
    )
    const modelSource = read(
      "registry/new-york-v4/ui/pretext-markdown-document-model.ts"
    )

    expect(policySource).toContain("remarkPretextHeadingIds")
    expect(policySource).not.toContain("rehypeSlug")
    expect(policySource).not.toContain("rehype-slug")
    expect(modelSource).toContain("createPretextMarkdownHeadingSlug")
  })

  it("keeps TextViewer modules from importing the Pretext Markdown fork", () => {
    for (const file of textViewerFiles) {
      const imports = importSpecifiers(read(file))
      for (const specifier of imports) {
        expect(
          specifier.includes("pretext-markdown"),
          `${file} imports Pretext Markdown module ${specifier}`
        ).toBe(false)
      }
    }
  })
})

function isOldMarkdownDocumentImport(specifier: string) {
  if (specifier.includes("pretext-markdown-")) return false
  return (
    specifier.includes("markdown-document-") ||
    specifier.includes("markdown-document-viewer") ||
    specifier.includes("MarkdownDocument")
  )
}
