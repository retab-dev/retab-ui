import { readFileSync } from "node:fs"
import { join, posix as pathPosix } from "node:path"
import { describe, expect, it } from "vitest"

type RegistryFile = {
  content?: string
  path: string
  target?: string
  type?: string
}

type InstalledRegistryFile = RegistryFile & {
  itemName: string
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
const pretextMarkdownDocsPath =
  "content/docs/viewers/pretext-markdown-viewer.mdx"
const viewerDocsPaths = [
  "content/docs/viewers/index.mdx",
  "content/docs/viewers/file-viewer.mdx",
  "content/docs/viewers/text-viewer.mdx",
  "content/docs/viewers/markdown-viewer.mdx",
  pretextMarkdownDocsPath,
]

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8")
}

function readRegistry() {
  return JSON.parse(read("registry.json")) as Registry
}

function readPretextMarkdownRegistryArtifact() {
  return JSON.parse(
    read("public/r/pretext-markdown-viewer.json")
  ) as RegistryItem & {
    type: string
  }
}

function importSpecifiers(source: string) {
  return Array.from(
    source.matchAll(/\bimport(?:\s+type)?[\s\S]*?\bfrom\s+["']([^"']+)["']/g)
  ).map((match) => match[1]!)
}

function relativeImportSpecifiers(source: string) {
  const imports: string[] = []
  const importExportPattern =
    /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g
  const dynamicImportPattern = /\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g

  for (const match of source.matchAll(importExportPattern)) {
    imports.push(match[1]!)
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    imports.push(match[1]!)
  }

  return imports
}

function moduleImportSpecifiers(source: string) {
  const imports: string[] = []
  const importExportPattern =
    /(?:^|\n)\s*(?:import|export)(?:\s+type)?\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g
  const dynamicImportPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g

  for (const match of source.matchAll(importExportPattern)) {
    imports.push(match[1]!)
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    imports.push(match[1]!)
  }

  return imports
}

function registryInstallFilesFor(
  item: RegistryItem,
  itemsByName: Map<string, RegistryItem>,
  visited = new Set<string>()
): InstalledRegistryFile[] {
  if (visited.has(item.name)) return []
  visited.add(item.name)

  return [
    ...item.files.map((file) => ({ ...file, itemName: item.name })),
    ...(item.registryDependencies ?? []).flatMap((dependencyName) => {
      const dependency = itemsByName.get(dependencyName)
      return dependency
        ? registryInstallFilesFor(dependency, itemsByName, visited)
        : []
    }),
  ]
}

function registryInstallTargetsFor(
  item: RegistryItem,
  itemsByName: Map<string, RegistryItem>
): string[] {
  return registryInstallFilesFor(item, itemsByName).map(
    (file) => file.target ?? file.path
  )
}

function registryInstallDependenciesFor(
  item: RegistryItem,
  itemsByName: Map<string, RegistryItem>,
  visited = new Set<string>()
): string[] {
  if (visited.has(item.name)) return []
  visited.add(item.name)

  return [
    ...(item.dependencies ?? []),
    ...(item.registryDependencies ?? []).flatMap((dependencyName) => {
      const dependency = itemsByName.get(dependencyName)
      return dependency
        ? registryInstallDependenciesFor(dependency, itemsByName, visited)
        : []
    }),
  ]
}

function resolveInstalledRegistryImport({
  importerTarget,
  installedTargets,
  specifier,
}: {
  importerTarget: string
  installedTargets: Set<string>
  specifier: string
}) {
  const basePath = pathPosix.normalize(
    pathPosix.join(pathPosix.dirname(importerTarget), specifier.split("?")[0]!)
  )
  const candidates = [
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    `${basePath}/index.tsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.jsx`,
    `${basePath}/index.js`,
    basePath,
  ]

  return candidates.find((candidate) => installedTargets.has(candidate)) ?? null
}

function resolveInstalledRegistryAliasImport({
  installedTargets,
  specifier,
}: {
  installedTargets: Set<string>
  specifier: string
}) {
  const basePath = installedTargetForAliasSpecifier(specifier)
  if (!basePath) return null
  return resolveInstalledRegistryTarget({ basePath, installedTargets })
}

function resolveInstalledRegistryTarget({
  basePath,
  installedTargets,
}: {
  basePath: string
  installedTargets: Set<string>
}) {
  const candidates = [
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    `${basePath}/index.tsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.jsx`,
    `${basePath}/index.js`,
    basePath,
  ]

  return candidates.find((candidate) => installedTargets.has(candidate)) ?? null
}

function installedTargetForAliasSpecifier(specifier: string) {
  const withoutQuery = specifier.split("?")[0]!
  if (withoutQuery.startsWith("@/components/ui/")) {
    return `@ui/${withoutQuery.slice("@/components/ui/".length)}`
  }
  if (withoutQuery.startsWith("@/registry/new-york-v4/ui/")) {
    return `@ui/${withoutQuery.slice("@/registry/new-york-v4/ui/".length)}`
  }
  if (withoutQuery.startsWith("@/lib/")) {
    return `@lib/${withoutQuery.slice("@/lib/".length)}`
  }
  if (withoutQuery.startsWith("@/registry/new-york-v4/lib/")) {
    return `@lib/${withoutQuery.slice("@/registry/new-york-v4/lib/".length)}`
  }
  return null
}

function packageNameForSpecifier(specifier: string) {
  if (specifier.startsWith(".") || specifier.startsWith("@/")) return null
  if (specifier.startsWith("node:")) return null
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/")
    return scope && name ? `${scope}/${name}` : specifier
  }
  return specifier.split("/")[0] ?? null
}

function packageNameForDependency(dependency: string) {
  if (dependency.startsWith("@")) {
    const match = dependency.match(/^(@[^/]+\/[^@]+)(?:@.+)?$/)
    return match?.[1] ?? dependency
  }
  return dependency.replace(/@.+$/, "")
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

  it("ships a synchronized registry artifact for installation", () => {
    const artifact = readPretextMarkdownRegistryArtifact()

    expect(artifact.name).toBe("pretext-markdown-viewer")
    expect(artifact.type).toBe("registry:ui")
    expect(artifact.registryDependencies ?? []).toEqual([
      "text-viewer",
      "button",
    ])
    expect(artifact.dependencies ?? []).toEqual([
      "@chenglou/pretext",
      "dompurify@3.4.9",
      "katex",
      "lucide-react",
      "marked@18.0.5",
      "mermaid",
      "react-markdown",
      "rehype-katex",
      "rehype-pretty-code",
      "rehype-raw",
      "rehype-sanitize",
      "remark-breaks",
      "remark-directive",
      "remark-gemoji",
      "remark-gfm",
      "remark-math",
      "remark-smartypants",
      "unified",
      "unist-util-visit",
    ])
    expect(artifact.files.map((file) => file.path).sort()).toEqual(
      [...pretextMarkdownFiles].sort()
    )

    for (const file of artifact.files) {
      expect(file.type, `${file.path} registry type`).toBe("registry:ui")
      expect(file.target, `${file.path} registry target`).toMatch(
        /^@ui\/pretext-markdown-/
      )
      expect(file.content, `${file.path} registry content`).toBe(
        read(file.path)
      )
    }
  })

  it("ships an installable registry artifact with a complete import closure", () => {
    const registry = readRegistry()
    const itemsByName = new Map(
      registry.items.map((registryItem) => [registryItem.name, registryItem])
    )
    const artifact = readPretextMarkdownRegistryArtifact()
    const installedFiles = registryInstallFilesFor(artifact, itemsByName)
    const installedTargets = new Set(
      installedFiles.map((file) => file.target ?? file.path)
    )
    const installedPackages = new Set(
      registryInstallDependenciesFor(artifact, itemsByName).map(
        packageNameForDependency
      )
    )
    const missingImports: string[] = []
    const missingPackages: string[] = []

    for (const file of installedFiles) {
      expect(file.target, `${file.path} registry target`).toBeTruthy()
      const content = file.content ?? read(file.path)
      expect(content, `${file.path} registry content`).toBeTruthy()

      for (const specifier of relativeImportSpecifiers(content)) {
        const resolved = resolveInstalledRegistryImport({
          importerTarget: file.target!,
          installedTargets,
          specifier,
        })
        if (resolved) continue
        missingImports.push(
          `${file.target} imports ${specifier}, but no installed registry file resolves it`
        )
      }

      for (const specifier of moduleImportSpecifiers(content)) {
        if (specifier.startsWith(".")) continue

        if (specifier.startsWith("@/")) {
          const resolved = resolveInstalledRegistryAliasImport({
            installedTargets,
            specifier,
          })
          if (resolved) continue
          missingImports.push(
            `${file.target} imports ${specifier}, but no installed registry file resolves it`
          )
          continue
        }

        const packageName = packageNameForSpecifier(specifier)
        if (
          !packageName ||
          packageName === "react" ||
          packageName === "react-dom"
        ) {
          continue
        }
        if (installedPackages.has(packageName)) continue
        missingPackages.push(
          `${file.target} imports ${specifier}, but ${packageName} is not declared by the installed registry tree`
        )
      }
    }

    expect(missingImports).toEqual([])
    expect(missingPackages).toEqual([])
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

  it("documents the Pretext Markdown migration contract", () => {
    const docs = read(pretextMarkdownDocsPath)

    expect(docs).toContain("## Feature Matrix")
    expect(docs).toContain("## Unsupported Syntax")
    expect(docs).toContain("## Migration Plan")
    expect(docs).toContain("## Replacement Checklist")
    expect(docs).toMatch(
      /\|\s*Capability\s*\|\s*Markdown Viewer\s*\|\s*Text Viewer Markdown mode\s*\|\s*Pretext Markdown Viewer\s*\|/
    )
    expect(docs).toContain(
      "No visible page labels, page frames, page gaps, or page delimiters"
    )
    expect(docs).toContain("Registry artifact install/import smoke tests pass")
    expect(docs).toContain(
      "File Viewer routes Markdown URL, Blob, inline text, and MIME-only sources"
    )
  })

  it("keeps public viewer docs aligned with Pretext Markdown routing", () => {
    const docs = Object.fromEntries(
      viewerDocsPaths.map((path) => [path, read(path)])
    )

    expect(docs["content/docs/viewers/index.mdx"]).toContain(
      "[Pretext Markdown Viewer](/docs/viewers/pretext-markdown-viewer)"
    )
    expect(docs["content/docs/viewers/file-viewer.mdx"]).toContain(
      "| Markdown     | `md`, `markdown`, `text/markdown`"
    )
    expect(docs["content/docs/viewers/file-viewer.mdx"]).toContain(
      "Pretext Markdown Viewer"
    )
    expect(docs["content/docs/viewers/file-viewer.mdx"]).toContain(
      "Markdown URL, Blob,\n  inline text, and MIME-only sources route to `PretextMarkdownViewer`"
    )
    expect(docs["content/docs/viewers/text-viewer.mdx"]).toContain(
      "Markdown files and inline Markdown sources use\n[`PretextMarkdownViewer`]"
    )
    expect(docs["content/docs/viewers/markdown-viewer.mdx"]).toContain(
      "[Pretext Markdown Viewer](/docs/viewers/pretext-markdown-viewer)"
    )

    for (const [path, content] of Object.entries(docs)) {
      expect(
        content.includes("routes Markdown documents to `TextViewer`"),
        `${path} still claims Markdown routes to TextViewer`
      ).toBe(false)
      expect(
        content.includes('mode="markdown"'),
        `${path} still documents TextViewer mode="markdown" routing`
      ).toBe(false)
      expect(
        /\|\s*Markdown\s*\|[^\n|]*\|[^\n|]*\|\s*Pretext Text Viewer\s*\|/.test(
          content
        ),
        `${path} still lists Markdown as Pretext Text Viewer`
      ).toBe(false)
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
