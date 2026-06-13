import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { describe, expect, it } from "vitest"

type RegistryFile = {
  path: string
  content?: string
  target?: string
  type?: string
}

type RegistryItem = {
  name: string
  type: string
  dependencies?: string[]
  registryDependencies?: string[]
  files: RegistryFile[]
}

type Registry = {
  items: RegistryItem[]
}

const repoRoot = process.cwd()

const sharedUseIsClientFiles = new Set([
  "components/ui/use-is-client.ts",
  "registry/new-york-v4/ui/use-is-client.ts",
])

const architectureRoots = [
  "registry/new-york-v4/ui",
  "components/ui",
  "components/viewers",
  "lib",
]

const sourceAdapterFiles = [
  "registry/new-york-v4/ui/pdf-source.tsx",
  "registry/new-york-v4/ui/docx-source.tsx",
  "registry/new-york-v4/ui/image-source.tsx",
  "registry/new-york-v4/ui/text-source.tsx",
  "registry/new-york-v4/ui/csv-source.tsx",
  "registry/new-york-v4/ui/xlsx-source.tsx",
  "components/ui/pdf-source.tsx",
  "components/ui/docx-source.tsx",
  "components/ui/image-source.tsx",
  "components/ui/text-source.tsx",
  "components/ui/csv-source.tsx",
  "components/ui/xlsx-source.tsx",
]

const staleSourceAdapterNames = [
  ["target", "Range"],
  ["pdfAnchor", "ToLocation"],
  ["imageAnchor", "ToArea"],
  ["imageAnchor", "ToFrame"],
  ["textAnchor", "ToLines"],
  ["csvAnchor", "ToCell"],
  ["spreadsheetAnchor", "ToCell"],
  ["docxSource", "ToTarget"],
].map((parts) => parts.join(""))

const canonicalViewerNames = new Set([
  "csv-viewer",
  "pdf-viewer",
  "docx-viewer",
  "image-viewer",
  "pptx-viewer",
  "xlsx-viewer",
  "file-viewer",
  "text-viewer",
])

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as T
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

function architectureSourceFiles(): string[] {
  return architectureRoots.flatMap((root) =>
    sourceFilesUnder(join(repoRoot, root))
  )
}

function viewerRegistryItems(registry: Registry): RegistryItem[] {
  return registry.items.filter((item) => canonicalViewerNames.has(item.name))
}

function fileContent(file: string): string {
  return readFileSync(join(repoRoot, file), "utf8")
}

function importSpecifiers(content: string): string[] {
  const imports: string[] = []
  const importExportPattern =
    /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g
  const dynamicImportPattern = /\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g

  for (const match of content.matchAll(importExportPattern)) {
    imports.push(match[1])
  }
  for (const match of content.matchAll(dynamicImportPattern)) {
    imports.push(match[1])
  }

  return imports
}

function resolveRelativeImport(
  importer: string,
  specifier: string
): string | null {
  const withoutQuery = specifier.split("?")[0]
  const basePath = join(dirname(join(repoRoot, importer)), withoutQuery)
  const candidates = sourceExtensions.flatMap((extension) => [
    `${basePath}${extension}`,
    join(basePath, `index${extension}`),
  ])

  for (const candidate of candidates) {
    if (existsSync(candidate)) return relative(repoRoot, candidate)
  }

  if (existsSync(basePath) && statSync(basePath).isFile()) {
    return relative(repoRoot, basePath)
  }

  return null
}

describe("viewer architecture", () => {
  it("keeps public source adapters off stale compatibility names", () => {
    for (const file of sourceAdapterFiles) {
      if (!existsSync(join(repoRoot, file))) continue
      const content = fileContent(file)
      for (const symbol of staleSourceAdapterNames) {
        expect(content.includes(symbol), `${file} contains ${symbol}`).toBe(
          false
        )
      }
    }
  })

  it("keeps viewer runtime code on the shared useIsClient primitive", () => {
    const localUseIsClientPattern =
      /\b(?:export\s+)?function\s+useIsClient\b|\b(?:const|let|var)\s+useIsClient\b/

    for (const file of architectureSourceFiles()) {
      if (sharedUseIsClientFiles.has(file)) continue
      const content = fileContent(file)
      expect(
        localUseIsClientPattern.test(content),
        `${file} defines a local useIsClient`
      ).toBe(false)
    }
  })

  it("keeps viewer slot exports as aliases to ViewerSlots", () => {
    for (const file of sourceFilesUnder(
      join(repoRoot, "registry/new-york-v4/ui")
    )) {
      if (!/(?:^|\/)[a-z0-9-]+viewer(?:-types)?\.tsx?$/.test(file)) continue
      const content = fileContent(file)
      const interfaceMatch = content.match(
        /\binterface\s+([A-Z][A-Za-z0-9]*ViewerSlots)\b/
      )
      expect(
        interfaceMatch?.[1],
        `${file} declares ${interfaceMatch?.[1]} as an interface`
      ).toBeUndefined()

      for (const match of content.matchAll(
        /\bexport\s+type\s+([A-Z][A-Za-z0-9]*ViewerSlots)\s*=/g
      )) {
        const slotName = match[1]
        const aliasPattern = new RegExp(
          `\\bexport\\s+type\\s+${slotName}\\s*=\\s*ViewerSlots\\b`
        )
        expect(
          aliasPattern.test(content),
          `${file} must export ${slotName} as ViewerSlots`
        ).toBe(true)
      }
    }
  })

  it("lists every relative internal module imported by registry viewer entries", () => {
    const registry = readJson<Registry>("registry.json")
    const missingModules: string[] = []

    for (const item of viewerRegistryItems(registry)) {
      const listedFiles = new Set(item.files.map((file) => file.path))

      for (const file of item.files) {
        const content = fileContent(file.path)
        for (const specifier of importSpecifiers(content)) {
          const importedFile = resolveRelativeImport(file.path, specifier)
          if (!importedFile?.startsWith("registry/new-york-v4/")) continue
          if (listedFiles.has(importedFile)) continue
          missingModules.push(
            `${item.name}: ${file.path} imports ${importedFile}`
          )
        }
      }
    }

    expect(missingModules).toEqual([])
  })

  it("keeps public/r viewer metadata and payloads aligned with registry.json", () => {
    const registry = readJson<Registry>("registry.json")
    const publicRegistry = readJson<Registry>("public/r/registry.json")
    const publicItemsByName = new Map(
      publicRegistry.items.map((item) => [item.name, item])
    )
    const mismatches: string[] = []

    for (const item of viewerRegistryItems(registry)) {
      const publicItem = publicItemsByName.get(item.name)
      if (!publicItem) {
        mismatches.push(`${item.name}: missing from public/r/registry.json`)
        continue
      }

      expect(
        {
          type: publicItem.type,
          dependencies: publicItem.dependencies ?? [],
          registryDependencies: publicItem.registryDependencies ?? [],
          files: publicItem.files.map(({ path, target, type }) => ({
            path,
            target,
            type,
          })),
        },
        `${item.name}: public/r/registry.json differs from registry.json`
      ).toEqual({
        type: item.type,
        dependencies: item.dependencies ?? [],
        registryDependencies: item.registryDependencies ?? [],
        files: item.files.map(({ path, target, type }) => ({
          path,
          target,
          type,
        })),
      })

      const publicItemPayload = readJson<RegistryItem>(
        `public/r/${item.name}.json`
      )
      expect(
        publicItemPayload.files.map(({ path, target, type }) => ({
          path,
          target,
          type,
        })),
        `${item.name}: public/r/${item.name}.json file list differs from registry.json`
      ).toEqual(
        item.files.map(({ path, target, type }) => ({ path, target, type }))
      )

      for (const publicFile of publicItemPayload.files) {
        expect(
          publicFile.content,
          `${item.name}: ${publicFile.path} content differs in public/r`
        ).toBe(fileContent(publicFile.path))
      }
    }

    expect(mismatches).toEqual([])
  })
})
