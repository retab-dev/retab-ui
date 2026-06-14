import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import ts from "typescript"
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

const publicDocsRoots = ["content/docs/components", "content/docs/viewers"]

const compoundViewerDocContracts = [
  {
    file: "content/docs/viewers/pdf-viewer.mdx",
    provider: "PdfViewerProvider",
    easyApi: "PdfViewer",
  },
  {
    file: "content/docs/viewers/email-viewer.mdx",
    provider: "EmailViewerProvider",
    easyApi: "EmailViewer",
  },
  {
    file: "content/docs/components/split-viewer.mdx",
    provider: "SplitViewerProvider",
    easyApi: "SplitViewer",
  },
  {
    file: "content/docs/components/file-system.mdx",
    provider: "FileSystemProvider",
    easyApi: "FileSystem",
  },
  {
    file: "content/docs/viewers/parse-viewer.mdx",
    provider: "ParseViewerProvider",
    easyApi: "ParseViewer",
  },
  {
    file: "content/docs/components/partition-viewer.mdx",
    provider: "PartitionViewerProvider",
    easyApi: "PartitionViewer",
  },
  {
    file: "content/docs/components/classification-viewer.mdx",
    provider: "ClassifierViewerProvider",
    easyApi: "ClassifierViewer",
  },
]

const anchoredDocumentDocContracts = [
  {
    file: "content/docs/components/extract-viewer.mdx",
    required: ["AnchoredDocumentProvider", "FieldAnchorLink"],
  },
  {
    file: "content/docs/components/json-form.mdx",
    required: ["FieldAnchorLink"],
  },
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

const removedSourceLinkDocNames = [
  ["use", "Source", "Link"],
  ["Use", "Source", "Link", "Result"],
  ["Field", "Source", "Link"],
  ["source", "Link"],
  ["render", "Pdf", "Source", "Overlay"],
  ["use", "Pdf", "Source", "Target"],
  ["hover", "Path"],
  ["pinned", "Path"],
  ["set", "Sources", "Field", "Path"],
].map((parts) => parts.join(""))

const canonicalViewerNames = new Set([
  "code-viewer",
  "csv-viewer",
  "pdf-viewer",
  "pdf-viewer-thumbnails",
  "pdf-thumbnails-block",
  "docx-viewer",
  "email-viewer",
  "image-viewer",
  "pptx-viewer",
  "xlsx-viewer",
  "file-viewer",
  "file-system",
  "file-system-block",
  "split-viewer-block",
  "dropzone-block",
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

function textFilesUnder(path: string, extensions: string[]): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) return textFilesUnder(fullPath, extensions)
    if (!extensions.some((extension) => entry.endsWith(extension))) return []
    return [relative(repoRoot, fullPath)]
  })
}

function publicDocFiles(): string[] {
  return publicDocsRoots.flatMap((root) =>
    textFilesUnder(join(repoRoot, root), [".md", ".mdx"])
  )
}

function viewerSidebarTags(content: string): string[] {
  return Array.from(
    content.matchAll(/<ViewerSidebar\b(?:[^"'>]|"[^"]*"|'[^']*')*>/g)
  ).map((match) => match[0])
}

function viewerRegistryItems(registry: Registry): RegistryItem[] {
  return registry.items.filter((item) => canonicalViewerNames.has(item.name))
}

function fileContent(file: string): string {
  return readFileSync(join(repoRoot, file), "utf8")
}

function compactWhitespace(content: string): string {
  return content.replace(/\s+/g, " ")
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

function jsxTagName(node: ts.JsxTagNameExpression): string {
  return node.getText()
}

function jsxTags(file: string): string[] {
  const content = fileContent(file)
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const tags: string[] = []

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      tags.push(jsxTagName(node.tagName))
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return tags
}

type JsxOpeningElementInfo = {
  file: string
  line: number
  tag: string
  attributes: string[]
}

function jsxOpeningElements(file: string): JsxOpeningElementInfo[] {
  const content = fileContent(file)
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const elements: JsxOpeningElementInfo[] = []

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile)
      )
      elements.push({
        file,
        line: position.line + 1,
        tag: jsxTagName(node.tagName),
        attributes: node.attributes.properties.map((property) =>
          ts.isJsxAttribute(property)
            ? property.name.getText(sourceFile)
            : "..."
        ),
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return elements
}

function tsxFilesUnderRoots(roots: string[]): string[] {
  return roots.flatMap((root) =>
    sourceFilesUnder(join(repoRoot, root)).filter((file) =>
      file.endsWith(".tsx")
    )
  )
}

function expectJsxTagsInOrder(file: string, expectedTags: string[]) {
  const tags = jsxTags(file)
  let previousIndex = -1

  for (const expectedTag of expectedTags) {
    const tag = expectedTag.replace(/^</, "")
    const index = tags.indexOf(tag, previousIndex + 1)
    expect(
      index,
      `${file} contains JSX <${tag}> after tag index ${previousIndex}. Tags: ${tags.join(
        ", "
      )}`
    ).toBeGreaterThan(previousIndex)
    previousIndex = index
  }
}

function exportedFunctions(content: string): string[] {
  return Array.from(content.matchAll(/\bexport function ([A-Za-z0-9_]+)/g)).map(
    (match) => match[1]
  )
}

describe("viewer architecture", () => {
  it("keeps generic viewer primitives to spatial parts and sidebar control", () => {
    const content = fileContent("registry/new-york-v4/ui/viewer.tsx")
    const rootProps =
      content.match(/export type ViewerRootProps = [\s\S]*?\n\}/)?.[0] ?? ""
    const sidebarTriggerProps =
      content.match(/export type ViewerSidebarTriggerProps = [^\n]+/)?.[0] ?? ""

    expect(exportedFunctions(content).sort()).toEqual(
      [
        "ViewerBody",
        "ViewerHeader",
        "ViewerRoot",
        "ViewerSidebar",
        "ViewerSidebarTrigger",
        "ViewerSurface",
        "useOptionalViewerSidebar",
        "useViewerSidebar",
      ].sort()
    )
    expect(content).not.toContain("ViewerShell")
    expect(content).not.toContain("ViewerPanel")
    expect(content).not.toContain("ViewerRail")
    expect(content).not.toContain("ViewerDocumentSurface")
    expect(content).not.toContain("ViewerInspectorSidebar")
    expect(content).not.toContain("ViewerNavigationSidebar")
    expect(content).not.toContain("ViewerContent")
    expect(content).not.toContain("ViewerPanel")
    expect(content).not.toContain("ViewerMain")
    expect(content).not.toContain("ViewerAside")
    expect(content).not.toContain("ViewerSidebarProvider")
    expect(content).not.toContain("ViewerLayoutProvider")
    expect(content).not.toContain("ViewerPartsProvider")
    expect(content).not.toContain("ViewerSidebarPurpose")
    expect(content).not.toContain("ViewerSurfaceRole")
    expect(content).not.toContain("viewerPurpose")
    expect(content).not.toContain("viewerRole")
    expect(content).not.toContain("sidebarKind")
    expect(content).not.toContain("data-viewer-purpose")
    expect(content).not.toContain("data-viewer-role")
    expect(content).not.toContain("data-viewer-kind")
    expect(content).not.toContain("data-viewer-sidebar-purpose")
    expect(content).not.toContain("data-viewer-surface-file-type")
    expect(content).not.toContain('"outline"')
    expect(content).not.toContain("ViewerSidebarTriggerProps = ButtonProps &")
    expect(content).not.toMatch(/ViewerSidebarTrigger[^\n]*side=/)
    expect(rootProps).not.toMatch(/\bvariant\??:/)
    expect(rootProps).not.toMatch(/\blayout\??:/)
    expect(rootProps).not.toMatch(/\bsidebarKind\??:/)
    expect(rootProps).toMatch(/\bopen\??:/)
    expect(rootProps).toMatch(/\bdefaultOpen\??:/)
    expect(rootProps).toMatch(/\bonOpenChange\??:/)
    expect(rootProps).toMatch(/\bmode\??:/)
    expect(rootProps).toMatch(/\bsidebarSide\??:/)
    expect(rootProps).toMatch(/\bsidebarCollapsible\??:/)
    expect(rootProps).not.toMatch(/\bsidebarOpen\??:/)
    expect(rootProps).not.toMatch(/\bdefaultSidebarOpen\??:/)
    expect(rootProps).not.toMatch(/\bonSidebarOpenChange\??:/)
    expect(rootProps).not.toMatch(/\bsidebarMode\??:/)
    expect(sidebarTriggerProps).toContain("ButtonProps")
  })

  it("keeps structural viewer parts non-polymorphic until evidence proves the need", () => {
    const content = fileContent("registry/new-york-v4/ui/viewer.tsx")

    for (const component of [
      "ViewerRoot",
      "ViewerHeader",
      "ViewerBody",
      "ViewerSidebar",
      "ViewerSurface",
    ]) {
      const start = content.indexOf(`export function ${component}`)
      const next = content.indexOf("\nexport ", start + 1)
      const functionBody =
        start === -1 ? "" : content.slice(start, next === -1 ? undefined : next)
      expect(functionBody, `${component} is exported`).toContain(
        `export function ${component}`
      )
      expect(functionBody, `${component} has no asChild prop`).not.toContain(
        "asChild"
      )
      expect(functionBody, `${component} has no render prop`).not.toMatch(
        /\brender\b/
      )
    }

    expect(content).toContain(
      "export type ViewerSidebarTriggerProps = ButtonProps"
    )
    expect(content).not.toContain("export const ViewerContent")
    expect(content).not.toContain("export const ViewerPanel")
    expect(content).not.toContain("export const ViewerMain")
    expect(content).not.toContain("export const ViewerAside")
  })

  it("keeps viewer slots anatomical and viewer data attributes state-only", () => {
    const content = fileContent("registry/new-york-v4/ui/viewer.tsx")

    for (const slot of [
      "viewer-root",
      "viewer-header",
      "viewer-body",
      "viewer-sidebar",
      "viewer-surface",
      "viewer-sidebar-trigger",
    ]) {
      expect(content).toContain(`data-slot="${slot}"`)
    }

    for (const attribute of [
      "data-viewer-sidebar-mode",
      "data-viewer-sidebar-open",
      "data-viewer-sidebar-state",
      "data-side",
      "data-collapsible",
    ]) {
      expect(content).toContain(attribute)
    }

    for (const forbiddenAttribute of [
      "data-viewer-kind",
      "data-viewer-sidebar-purpose",
      "data-viewer-surface-file-type",
      "data-viewer-purpose",
      "data-viewer-role",
    ]) {
      expect(content).not.toContain(forbiddenAttribute)
    }
  })

  it("keeps public viewer sidebar hooks on the public context", () => {
    const content = fileContent("registry/new-york-v4/ui/viewer.tsx")

    expect(content).toContain("const ViewerSidebarStateContext =")
    expect(content).toContain("const ViewerSidebarRegistrationContext =")
    expect(content).not.toContain("toPublicViewerSidebarContext")
    expect(content).not.toContain("publicSidebar")
    expect(content).not.toContain("useViewerSidebarInternal")
    const publicSidebarContext =
      content.match(
        /export type ViewerSidebarContextValue = \{[\s\S]*?\n\}/
      )?.[0] ?? ""
    const privateSidebarContext =
      content.match(
        /type ViewerSidebarRegistrationContextValue = \{[\s\S]*?\n\}/
      )?.[0] ?? ""
    expect(publicSidebarContext).not.toContain("sidebarId")
    expect(privateSidebarContext).toContain("sidebarId: string")
    expect(content).toMatch(
      /export function useViewerSidebar\(\): ViewerSidebarContextValue \{[\s\S]*?React\.useContext\(ViewerSidebarStateContext\)[\s\S]*?return context[\s\S]*?\}/
    )
    expect(content).toMatch(
      /function useViewerSidebarRegistrationContext\([\s\S]*?consumer: string[\s\S]*?\): ViewerSidebarRegistrationContextValue \{[\s\S]*?React\.useContext\(ViewerSidebarRegistrationContext\)/
    )
  })

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

  it("keeps viewer runtime code free of slot-object type aliases", () => {
    for (const file of sourceFilesUnder(
      join(repoRoot, "registry/new-york-v4/ui")
    )) {
      if (!/(?:^|\/)[a-z0-9-]+viewer(?:-types)?\.tsx?$/.test(file)) continue
      const content = fileContent(file)
      expect(
        /\b[A-Z][A-Za-z0-9]*ViewerSlots\b/.test(content),
        `${file} exports a slot-object alias`
      ).toBe(false)
    }
  })

  it("keeps viewer runtime code free of removed shell and slot concepts", () => {
    const forbiddenPatterns = [
      /\bViewerShell\b/,
      /\bViewerSlots\b/,
      /\bPdfViewerSlots\b/,
      /\bslots\.(?:left|right|top|bottom|overlay)\b/,
      /\bslots=\{/,
      /\brenderDocument\b/,
      /\brenderDocument\(\{\s*slots\s*\}\)/,
      /\bFileIntakeViewerFrame\b/,
    ]

    for (const file of architectureSourceFiles()) {
      const content = fileContent(file)
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(false)
      }
    }
  })

  it("keeps source routers and PDF props out of composition concerns", () => {
    const fileViewerFiles = [
      "registry/new-york-v4/ui/file-viewer.tsx",
      "registry/new-york-v4/ui/file-viewer-core.ts",
    ]
    const forbiddenFileViewerPatterns = [
      /\bEmailViewerProvider\b/,
      /\bFileSystemProvider\b/,
      /\bSplitViewerProvider\b/,
      /\bFileIntakeViewerProvider\b/,
      /\bAnchoredDocumentProvider\b/,
      /\bViewerSidebar\b/,
      /\bViewerBody\b/,
      /\banchoredItems\??:/,
      /\bsourceMap\??:/,
      /\brenderDocument\??:/,
      /\bslots\??:/,
    ]

    for (const file of fileViewerFiles) {
      const content = fileContent(file)
      for (const pattern of forbiddenFileViewerPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(false)
      }
    }

    const pdfTypeFiles = [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/pdf-viewer-types.ts",
    ]
    const forbiddenPdfPropPatterns = [
      /\bthumbnails\??:/,
      /\bsidebar\??:/,
      /\banchoredItems\??:/,
      /\bsourceMap\??:/,
      /\brenderThumbnail\??:/,
    ]

    for (const file of pdfTypeFiles) {
      const content = fileContent(file)
      for (const pattern of forbiddenPdfPropPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(false)
      }
    }
  })

  it("keeps document viewer toolbars on the shared ViewerToolbar primitive", () => {
    const registry = readJson<Registry>("registry.json")
    const viewerToolbarItem = registry.items.find(
      (item) => item.name === "viewer-toolbar"
    )
    const migratedViewerItems = [
      "pdf-viewer",
      "docx-viewer",
      "image-viewer",
      "pptx-viewer",
      "xlsx-viewer",
      "csv-viewer",
      "code-viewer",
      "text-viewer",
      "markdown-document-viewer",
    ]
    const removedToolbarFiles = [
      "registry/new-york-v4/ui/pdf-viewer-toolbar.tsx",
      "registry/new-york-v4/ui/pptx-viewer-toolbar.tsx",
      "registry/new-york-v4/ui/xlsx-toolbar.tsx",
      "registry/new-york-v4/ui/csv-viewer-toolbar.tsx",
      "components/ui/pdf-viewer-toolbar.tsx",
      "components/ui/pptx-viewer-toolbar.tsx",
      "components/ui/xlsx-toolbar.tsx",
      "components/ui/csv-viewer-toolbar.tsx",
    ]
    const migratedSourceFiles = [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/docx-viewer-content.tsx",
      "registry/new-york-v4/ui/image-viewer-content.tsx",
      "registry/new-york-v4/ui/pptx-viewer.tsx",
      "registry/new-york-v4/ui/xlsx-viewer-session.tsx",
      "registry/new-york-v4/ui/csv-viewer-chrome.tsx",
      "registry/new-york-v4/ui/code-viewer-chrome.tsx",
      "registry/new-york-v4/ui/text-viewer-chrome.tsx",
      "registry/new-york-v4/ui/markdown-document-viewer.tsx",
      "components/viewers/page-markdown/page-markdown-toolbar.tsx",
    ]
    const forbiddenNames = [
      "PdfViewerToolbar",
      "PdfViewerControls",
      "PptxToolbar",
      "XlsxToolbar",
      "CsvViewerToolbar",
      "DocxViewerToolbar",
      "ImageViewerToolbar",
      "TextCodeViewerToolbarFrame",
      "TextCodeViewerZoomControls",
      "TextCodeViewerIconButton",
      "ToolbarIconButton",
    ]

    expect(viewerToolbarItem).toBeTruthy()
    expect(viewerToolbarItem?.files.map((file) => file.path)).toContain(
      "registry/new-york-v4/ui/viewer-toolbar.tsx"
    )

    for (const itemName of migratedViewerItems) {
      const item = registry.items.find((entry) => entry.name === itemName)
      expect(item?.registryDependencies ?? []).toContain("viewer-toolbar")
      expect(item?.files.map((file) => file.path) ?? []).not.toEqual(
        expect.arrayContaining(removedToolbarFiles)
      )
    }

    for (const file of removedToolbarFiles) {
      expect(existsSync(join(repoRoot, file)), `${file} still exists`).toBe(
        false
      )
    }

    for (const file of migratedSourceFiles) {
      const content = fileContent(file)
      expect(content, `${file} uses ViewerToolbar`).toContain("ViewerToolbar")
      for (const forbiddenName of forbiddenNames) {
        expect(content, `${file} contains ${forbiddenName}`).not.toContain(
          forbiddenName
        )
      }
    }
  })

  it("keeps FileViewer registry installs wired to Pretext Markdown", () => {
    const registry = readJson<Registry>("registry.json")
    const fileViewerItem = registry.items.find(
      (item) => item.name === "file-viewer"
    )
    const publicFileViewerItem = readJson<RegistryItem>(
      "public/r/file-viewer.json"
    )
    const fileViewerSource = fileContent(
      "registry/new-york-v4/ui/file-viewer.tsx"
    )
    const publicFileViewerSource =
      publicFileViewerItem.files.find(
        (file) => file.path === "registry/new-york-v4/ui/file-viewer.tsx"
      )?.content ?? ""

    expect(fileViewerItem).toBeTruthy()
    expect(fileViewerItem?.registryDependencies ?? []).toContain(
      "pretext-markdown-viewer"
    )
    expect(fileViewerItem?.registryDependencies ?? []).not.toContain(
      "markdown-document-viewer"
    )
    expect(publicFileViewerItem.registryDependencies ?? []).toContain(
      "pretext-markdown-viewer"
    )
    expect(publicFileViewerItem.registryDependencies ?? []).not.toContain(
      "markdown-document-viewer"
    )
    expect(fileViewerSource).toContain(
      'import("@/components/ui/pretext-markdown-viewer")'
    )
    expect(publicFileViewerSource).toContain(
      'import("@/components/ui/pretext-markdown-viewer")'
    )
    expect(publicFileViewerSource).not.toContain("markdown-document-viewer")
  })

  it("keeps dropzone examples away from file viewer internals", () => {
    const dropzoneFiles = [
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
      "registry/new-york-v4/blocks/dropzone-trigger-examples.tsx",
    ]
    const forbiddenPatterns = [
      /file-viewer-core/,
      /file-viewer-chrome/,
      /ResourceDocShell/,
      /PdfViewerPages/,
      /PdfViewerProvider/,
    ]

    for (const file of dropzoneFiles) {
      const content = fileContent(file)
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(false)
      }
    }
  })

  it("keeps anchored document core free of source-map and leaf viewer imports", () => {
    const content = fileContent(
      "registry/new-york-v4/ui/anchored-document-viewer.tsx"
    )
    const forbiddenPatterns = [
      /SourceMap/,
      /document-source/,
      /pdf-viewer/,
      /image-viewer/,
      /text-viewer/,
      /csv-viewer/,
      /xlsx-viewer/,
      /docx-viewer/,
      /JsonForm/,
    ]

    for (const pattern of forbiddenPatterns) {
      expect(pattern.test(content), `${pattern} leaks into anchored core`).toBe(
        false
      )
    }
  })

  it("keeps split viewer document composition explicit", () => {
    const content = fileContent("components/viewers/split/split-viewer.tsx")
    const viewportController = fileContent(
      "registry/new-york-v4/ui/use-segment-viewport-controller.ts"
    )
    const sharedRail = fileContent(
      "registry/new-york-v4/ui/segment-page-rail.tsx"
    )
    const registry = readJson<Registry>("registry.json")
    const itemsByName = new Map(registry.items.map((item) => [item.name, item]))
    const splitItem = itemsByName.get("split-viewer-block")
    const segmentPageRailItem = itemsByName.get("segment-page-rail")

    expect(content).not.toContain("renderDocument")
    expect(content).toContain("children?: ReactNode")
    expect(content).toContain("export type SplitViewerModel")
    expect(content).toContain("export function createSplitViewerModel")
    expect(content).toContain(
      "export function createSplitSegmentedDocumentModel"
    )
    expect(content).toContain("SegmentedDocumentProvider")
    expect(content).toContain("useSegmentedDocumentViewport")
    expect(content).toContain("model: SplitViewerModel")
    expect(content).toContain("viewport: SegmentViewportController")
    expect(content).toContain("segments: DocumentSegment[]")
    expect(content).not.toContain("useSegmentViewportController")
    expect(content).not.toContain("ReturnType<typeof toSegments>")
    expect(content).not.toContain("controller:")
    expect(content).not.toContain("setViewerHandle")
    expect(content).toContain("useSplitViewerDocumentControls")
    expect(content).toContain("export function SplitViewerRoot")
    expect(content).toContain("export function useSplitViewerHeader")
    expect(content).toContain("export function useSplitViewerPageRail")
    expect(content).toContain("export function useSplitViewerLegend")
    expect(content).toContain("export function useSplitViewerDocument")
    expect(content).toContain("export function SplitViewerBody")
    expect(content).toContain("export function SplitViewerSidebar")
    expect(content).toContain("export function SplitViewerSurface")
    expect(content).toContain("export function SplitViewerPageRail")
    expect(content).toContain("export function SplitViewerLegend")
    expect(content).toContain("export function SplitViewerDocument")
    expect(content).toContain("export function SplitViewerEmptyState")
    expect(content).toContain("@/components/ui/segment-page-rail")
    expect(content).not.toContain("./segment-page-rail")
    expect(content).toContain("useSplitViewerHeader()")
    expect(content).toContain("useSplitViewerPageRail()")
    expect(content).toContain("useSplitViewerLegend()")
    expect(content).toContain("useSplitViewerDocument()")
    expect(viewportController).toContain("export type SegmentDocumentHandle")
    expect(viewportController).toContain("scrollToAnchor")
    expect(viewportController).toContain(
      "export type SegmentedDocumentViewport"
    )
    expect(viewportController).toContain("setDocumentHandle")
    expect(viewportController).not.toContain("PdfViewerHandle")
    expect(viewportController).not.toContain("setViewerHandle")
    expect(sharedRail).toContain("export function SegmentPageRail")
    expect(sharedRail).not.toContain("components/viewers/split")
    expect(segmentPageRailItem?.registryDependencies ?? []).toEqual([
      "segments",
      "segment-interaction",
      "page-ribbon",
      "utils",
    ])
    expect(splitItem?.registryDependencies ?? []).toContain("segment-page-rail")
    expect(splitItem?.registryDependencies ?? []).toContain(
      "segmented-document"
    )
    expect(splitItem?.registryDependencies ?? []).not.toContain("page-ribbon")
    expect(splitItem?.files.map((file) => file.path) ?? []).not.toContain(
      "components/viewers/segmented-document/use-segment-viewport-controller.ts"
    )
  })

  it("keeps compound easy APIs as preassembled named-part composition", () => {
    const easyApis = [
      {
        file: "registry/new-york-v4/ui/pdf-viewer.tsx",
        symbols: [
          "<PdfViewerProvider",
          "<ViewerRoot",
          "<PdfViewerHeader",
          "<ViewerBody",
          "<ViewerSurface",
          "<PdfViewerPages",
        ],
      },
      {
        file: "registry/new-york-v4/ui/email-viewer.tsx",
        symbols: [
          "<EmailViewerProvider",
          "<ViewerRoot",
          "<EmailHeader",
          "<ViewerBody",
          "<ViewerSurface",
          "<EmailContent",
          "<ViewerSidebar",
          "<EmailPartsSidebar",
        ],
      },
      {
        file: "components/viewers/split/split-viewer.tsx",
        symbols: [
          "<SplitViewerProvider",
          "<SplitViewerRoot",
          "<SplitViewerHeader",
          "<SplitViewerBody",
          "<SplitViewerSidebar",
          "<SplitViewerSurface",
          "<SplitViewerLegend",
          "<SplitViewerDocument",
        ],
      },
      {
        file: "registry/new-york-v4/ui/file-system.tsx",
        symbols: [
          "<FileSystemProvider",
          "<ViewerRoot",
          "<ViewerHeader",
          "<FileSystemHeader",
          "<ViewerBody",
          "<ViewerSidebar",
          "<FileSystemBrowser",
          "<ViewerSurface",
          "<FileSystemSelection",
        ],
      },
      {
        file: "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
        symbols: [
          "<FileIntakeViewerProvider",
          "<FileIntakeViewerRoot",
          "<FileIntakeViewerHeader",
          "<ViewerBody",
          "<FileIntakeViewerSidebar",
          "<FileIntakeViewerSurface",
        ],
      },
      {
        file: "components/viewers/page-markdown/page-markdown-viewer.tsx",
        symbols: [
          "<PageMarkdownViewerProvider",
          "<ViewerRoot",
          "<ViewerBody",
          "<ViewerSurface",
          "<PageMarkdownViewerContent",
        ],
      },
      {
        file: "components/viewers/parse/parse-viewer.tsx",
        symbols: [
          "<ParseViewerProvider",
          "<ViewerRoot",
          "<ViewerBody",
          "<ViewerSurface",
          "<ParseViewerMarkdown",
        ],
      },
      {
        file: "components/viewers/partition/partition-viewer.tsx",
        symbols: [
          "<PartitionViewerProvider",
          "<ViewerRoot",
          "<PartitionViewerHeader",
          "<ViewerBody",
          "<ViewerSurface",
          "<PartitionViewerDocument",
        ],
      },
      {
        file: "components/viewers/classify/classifier-viewer.tsx",
        symbols: [
          "<ClassifierViewerProvider",
          "<ViewerRoot",
          "<ClassifierViewerHeader",
          "<ViewerBody",
          "<ViewerSurface",
          "<ClassifierViewerDocumentState",
        ],
      },
    ]

    for (const { file, symbols } of easyApis) {
      const content = fileContent(file)
      expectJsxTagsInOrder(file, symbols)
      expect(content, `${file} accepts slot object props`).not.toContain(
        "slots?:"
      )
      expect(content, `${file} accepts renderDocument`).not.toContain(
        "renderDocument"
      )
    }
  })

  it("uses root terminology for file-intake viewer composition", () => {
    const parts = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx"
    )
    const wrapper = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx"
    )

    expect(parts).toContain("FileIntakeViewerRoot")
    expect(wrapper).toContain("FileIntakeViewerRoot")
    expect(wrapper).toContain("export function FileIntakeViewer")
    expect(wrapper).not.toContain("DropzoneUploaderViewer")
    expect(parts).not.toContain("UploadableFileViewer")
    expect(wrapper).not.toContain("UploadableFileViewer")
    expect(parts).not.toContain("FileIntakeViewerFrame")
    expect(wrapper).not.toContain("FileIntakeViewerFrame")
  })

  it("keeps the file-intake viewer easy API preassembled", () => {
    const wrapper = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx"
    )
    const parts = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx"
    )

    expect(wrapper).toContain(
      "renderViewer?: (source: BlobViewerSource) => React.ReactNode"
    )
    expect(wrapper).toContain(
      "<FileIntakeViewerSurface renderViewer={renderViewer} />"
    )
    expect(wrapper).not.toContain("DropzoneUploaderViewer")
    expect(parts).toContain("<FileViewer")
  })

  it("keeps file-intake viewer named parts on narrow hooks", () => {
    const content = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx"
    )

    expect(content).toContain("export function useFileIntakeViewerRoot")
    expect(content).toContain("export function useFileIntakeViewerHeader")
    expect(content).toContain("export function useFileIntakeViewerSidebar")
    expect(content).toContain("export function useFileIntakeViewerSurface")
    expect(content).toContain("type FileIntakeViewerContextValue = {")
    expect(content).toContain("model: FileIntakeViewerModel")
    expect(content).toContain("actions: FileIntakeViewerActions")
    expect(content).toContain("export type FileIntakeSummary")
    expect(content).toContain("export type FileIntakeViewerRejection")
    expect(content).toContain("createFileIntakeViewerModel")
    expect(content).toContain("createFileIntakeSummary")
    expect(content).toContain("createFileIntakeViewerRejection")
    expect(content).toContain("getRootDropProps")
    expect(content).toContain("getFileInputProps")
    expect(content).toContain("getUploadButtonProps")
    expect(content).toContain("getReplaceButtonProps")
    expect(content).toContain("getEmptySurfaceProps")
    expect(content).not.toContain("dropzone: UseDropzoneReturn")
    expect(content).not.toContain("getRootProps: UseDropzoneReturn")
    expect(content).not.toContain("getInputProps: UseDropzoneReturn")
    expect(content).not.toContain("getButtonProps: UseDropzoneReturn")
    expect(content).not.toContain("getTriggerProps: UseDropzoneReturn")
    expect(content).not.toContain("openFileDialog: () => void")
    expect(content).not.toContain("canOpenFileDialog")
    expect(content).not.toContain("UploadableFileViewer")
    expect(content).not.toContain("UploadableFileSummary")
    expect(content).not.toContain("FileIntakeViewerSummary")
    expect(content).not.toContain("FileIntakeViewerContent")
    expect(content).toContain("useFileIntakeViewerSidebar()")
    expect(content).toContain("useFileIntakeViewerSurface()")
  })

  it("keeps email viewer named parts on narrow hooks", () => {
    const content = fileContent("registry/new-york-v4/ui/email-viewer.tsx")
    const model = fileContent("registry/new-york-v4/ui/email-viewer-model.ts")
    const types = fileContent("registry/new-york-v4/ui/email-viewer-types.ts")

    expect(content).toContain("export function useEmailHeader")
    expect(content).toContain("export function useEmailPartsSidebar")
    expect(content).toContain("export function useEmailContent")
    expect(content).toContain("model: EmailViewerModel")
    expect(content).toContain("selectPart: (node: MimePartNode) => void")
    expect(content).not.toContain("MimeDisplayPart")
    expect(content).not.toContain("display:")
    expect(content).not.toContain("setSelectedNode")
    expect(content).not.toContain("getSidebarSections")
    expect(content).not.toContain("getBodyNode")
    expect(content).not.toContain("walkCurrentMessageNodes")
    expect(model).toContain("export function deriveEmailViewerModel")
    expect(model).toContain("export function deriveEmailSidebarModel")
    expect(model).toContain("export function deriveEmailContentModel")
    expect(model).toContain("export function createMimeMessageScope")
    expect(model).toContain("function walkCurrentMessageNodes")
    expect(model).toContain("DEFAULT_EMAIL_BODY_SELECTION_POLICY")
    expect(model).not.toContain("function reparentMimeNode")
    expect(types).toContain("facts: MimePartFacts")
    expect(types).toContain("parentPath: MimePartPath | null")
    expect(types).toContain("export type MimePartKind")
    expect(types).not.toContain("MimePartRole")
    expect(types).not.toContain("isMultipart: boolean")
    expect(types).not.toContain("isMessage: boolean")
    expect(types).not.toContain("isAttachment: boolean")
    expect(types).not.toContain("isInlineResource: boolean")
  })

  it("keeps email parts on ViewerSidebar without a nested shadcn sidebar", () => {
    const content = fileContent("registry/new-york-v4/ui/email-viewer.tsx")

    expect(importSpecifiers(content)).not.toContain("./sidebar")
    expect(content).not.toContain("EmbeddedSidebarProvider")
    expect(content).not.toMatch(/<Sidebar(?:\s|>)/)
    expect(content).not.toMatch(/<Sidebar(?:Content|Group|Header|Menu|Rail)/)
    expect(content).toContain('aria-label="Email parts"')
    expect(content).not.toContain("viewerPurpose")
    expect(content).toContain('data-slot="mime-part-sidebar"')
  })

  it("keeps PDF viewer named parts on narrow hooks", () => {
    const viewer = fileContent("registry/new-york-v4/ui/pdf-viewer.tsx")
    const context = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-context.tsx"
    )
    const thumbnails = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-thumbnails.tsx"
    )

    expect(thumbnails).not.toContain("PdfThumbnailSidebar")
    expect(readJson<Registry>("registry.json").items).not.toContainEqual(
      expect.objectContaining({ name: "pdf-thumbnail-sidebar" })
    )
    expect(context).toContain("export function usePdfViewerHeader")
    expect(context).toContain("export function usePdfViewerPages")
    expect(context).toContain("export function usePdfViewerThumbnails")
    expect(context).not.toContain(
      "export function useOptionalPdfViewerThumbnails"
    )
    expect(context).toContain(
      "export function useOptionalPdfViewerHeaderControls"
    )
    expect(viewer).toContain(
      "const { currentPage, headerControls, resource } = usePdfViewerHeader()"
    )
    expect(viewer).toContain(
      "const { resource, setCurrentPage, setViewerHandle } = usePdfViewerPages()"
    )
    expect(viewer).toContain(
      "const setHeaderControls = useOptionalPdfViewerHeaderControls()"
    )
    expect(thumbnails).toContain("const thumbnails = usePdfViewerThumbnails()")
    expect(thumbnails).toContain("export interface PdfThumbnailRailProps")
    expect(thumbnails).toContain("export function PdfThumbnailRail")
    expect(thumbnails).toContain("thumbnailWidth?: number")
    const viewerThumbnailsProps =
      thumbnails.match(
        /export interface PdfViewerThumbnailsProps \{[\s\S]*?\n\}/
      )?.[0] ?? ""
    expect(viewerThumbnailsProps).toContain("thumbnailWidth?: number")
    expect(viewerThumbnailsProps).toContain("className?: string")
    expect(viewerThumbnailsProps).not.toContain("resource")
    expect(viewerThumbnailsProps).not.toContain("currentPage")
    expect(viewerThumbnailsProps).not.toContain("onSelectPage")
    expect(viewerThumbnailsProps).not.toContain("width?: number")
  })

  it("keeps the PDF thumbnails block identical to canonical composition", () => {
    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/pdf-thumbnails-block.tsx",
      [
        "<PdfViewerProvider",
        "<ViewerRoot",
        "<PdfViewerHeader",
        "<ViewerBody",
        "<ViewerSidebar",
        "<PdfViewerThumbnails",
        "<ViewerSurface",
        "<PdfViewerPages",
      ]
    )
  })

  it("keeps file-system domain parts on narrow hooks", () => {
    const easyApi = fileContent("registry/new-york-v4/ui/file-system.tsx")
    const provider = fileContent(
      "registry/new-york-v4/ui/file-system-provider.tsx"
    )
    const parts = fileContent("registry/new-york-v4/ui/file-system-parts.tsx")
    const dialog = fileContent(
      "registry/new-york-v4/ui/file-system-open-preview-dialog.tsx"
    )
    const browserState = fileContent(
      "registry/new-york-v4/ui/file-system-browser-state.ts"
    )
    const browserController = fileContent(
      "registry/new-york-v4/ui/file-system-browser-controller.ts"
    )
    const kernel = fileContent("registry/new-york-v4/ui/file-system-kernel.ts")
    const kernelRuntime = fileContent(
      "registry/new-york-v4/ui/file-system-kernel-runtime.ts"
    )
    const kernelCommandEffects = fileContent(
      "registry/new-york-v4/ui/file-system-kernel-command-effects.ts"
    )
    const asyncTask = fileContent(
      "registry/new-york-v4/ui/file-system-async-task.ts"
    )
    const folderTask = fileContent(
      "registry/new-york-v4/ui/file-system-folder-task.ts"
    )
    const controlledProps = fileContent(
      "registry/new-york-v4/ui/file-system-controlled-props.ts"
    )
    const kernelSelectors = fileContent(
      "registry/new-york-v4/ui/file-system-kernel-selectors.ts"
    )
    const selectionSourceTask = fileContent(
      "registry/new-york-v4/ui/file-system-selection-source-task.ts"
    )
    const openSourceTask = fileContent(
      "registry/new-york-v4/ui/file-system-open-source-task.ts"
    )
    const explorerControllerName = "FileSystem" + "ExplorerController"
    const explorerControllerFile =
      "registry/new-york-v4/ui/file-system-explorer" + "-controllers.ts"
    const deletedSliceFiles = [
      "registry/new-york-v4/ui/file-system-" + "controller.ts",
      "registry/new-york-v4/ui/file-system-" + "index-state.ts",
      "registry/new-york-v4/ui/file-system-" + "kernel-effects.ts",
      "registry/new-york-v4/ui/file-system-" + "loading-controller.ts",
      "registry/new-york-v4/ui/file-system-" + "navigation-controller.ts",
      "registry/new-york-v4/ui/file-system-" + "path-history.ts",
      "registry/new-york-v4/ui/file-system-" + "query-controller.ts",
      "registry/new-york-v4/ui/file-system-" + "selection-controller.ts",
      "registry/new-york-v4/ui/file-system-" + "view-controller.ts",
      "registry/new-york-v4/ui/use-file-system-" + "children-loader.ts",
    ]

    expect(easyApi).toContain("./file-system-provider")
    expect(easyApi).toContain("./file-system-parts")
    expect(easyApi).toContain("./file-system-open-preview-dialog")
    expect(easyApi).not.toContain("React.useState")
    expect(easyApi).not.toContain("React.useCallback")
    expect(easyApi).not.toContain("./file-system-controls")
    expect(easyApi).not.toContain("./file-system-chrome")
    expect(provider).toContain("export function useFileSystem")
    expect(provider).not.toContain("controller:")
    expect(provider).not.toContain("openFilePreviewState")
    expect(provider).toContain("export type FileSystemCompositionState")
    expect(provider).toContain("useFileSystemKernelRuntime")
    expect(provider).toContain("selectFileSystemBrowserState")
    expect(provider).toContain("selectFileSystemSelectionState")
    expect(provider).toContain("browser,")
    expect(provider).toContain("selection,")
    expect(provider).toContain("openPreview: FileSystemOpenPreviewController")
    expect(provider).not.toContain("useFileSystem" + "StateSlices")
    expect(provider).not.toContain("query: state.query")
    expect(provider).not.toContain("view: state.view")
    expect(provider).not.toContain("source: state.source")
    expect(provider).not.toContain("index: state.index")
    expect(provider).not.toContain("loading: state.loading")
    expect(provider).not.toContain("selection: state.selection")
    expect(provider).not.toContain("navigation: state.navigation")
    expect(browserState).toContain("export type FileSystemBrowserState")
    expect(browserState).toContain("entries: FileSystemEntry[]")
    expect(browserState).toContain("canGoBack: boolean")
    expect(browserState).toContain("canGoForward: boolean")
    expect(browserState).toContain("ensureChildren: (")
    expect(browserState).toContain("folderErrors: ReadonlyMap<string, string>")
    expect(browserState).toContain("loadingFolders: ReadonlySet<string>")
    expect(browserState).toContain("navigateTo: (path: string) => void")
    expect(browserState).toContain(
      "selectEntry: (entry: FileSystemEntry | null) => void"
    )
    expect(browserState).toContain("selectedEntry: FileSystemEntry | null")
    expect(browserState).toContain("selectedPath: string | null")
    expect(browserState).not.toContain("loading: FileSystemBrowserLoadingState")
    expect(browserState).not.toContain(
      "navigation: FileSystemBrowserNavigationState"
    )
    expect(browserState).not.toContain(
      "selection: FileSystemBrowserSelectionState"
    )
    expect(browserState).not.toContain("commands: FileSystemBrowserCommands")
    expect(browserState).not.toContain(
      "export type FileSystemBrowserSelectionState"
    )
    expect(browserState).not.toContain(
      "export type FileSystemBrowserLoadingState"
    )
    expect(browserState).not.toContain(
      "export type FileSystemBrowserNavigationState"
    )
    expect(browserState).not.toContain("export type FileSystemBrowserCommands")
    expect(browserState).toContain("export type FileSystemHeaderState")
    expect(browserState).toContain("createFileSystemHeaderState")
    expect(browserState).toContain("entry: FileSystemEntry | null")
    expect(browserState).toContain("resolveSource: FileSystemSourceResolver")
    expect(browserState).not.toContain(
      "FileSystemHeaderState = FileSystemBrowserState"
    )
    expect(browserState).toContain("export type FileSystemSelectionState")
    expect(browserState).not.toContain("createFileSystemBrowserState")
    expect(browserState).not.toContain("createFileSystemSelectionState")
    expect(kernel).toContain("export type FileSystemKernelState")
    expect(kernel).toContain("export type FileSystemKernelEvent")
    expect(kernel).toContain("export type FileSystemKernelCommand")
    expect(kernel).toContain("reduceFileSystemKernel")
    expect(kernel).toContain("folder.loadSucceeded")
    expect(kernel).toContain("current.requestId !== event.requestId")
    expect(kernelRuntime).toContain("useFileSystemKernelRuntime")
    expect(kernelRuntime).toContain("dispatch")
    expect(kernelRuntime).toContain("consumeCommands")
    expect(kernelRuntime).not.toContain("AbortController")
    expect(kernelRuntime).not.toContain("predicted")
    expect(kernelCommandEffects).toContain("useFileSystemKernelCommandEffects")
    expect(kernelCommandEffects).toContain("callback.pathChanged")
    expect(kernelCommandEffects).toContain("file.open")
    expect(kernelCommandEffects).not.toContain("AbortController")
    expect(asyncTask).toContain("FileSystemAsyncTask")
    expect(asyncTask).toContain("FileSystemAsyncTaskWaiter")
    expect(asyncTask).toContain("AbortController")
    expect(asyncTask).toContain("task.id")
    expect(asyncTask).toContain("task.key")
    expect(asyncTask).not.toContain("@pierre/trees")
    expect(folderTask).toContain("useFileSystemFolderTask")
    expect(folderTask).toContain("FolderLoadRequest")
    expect(folderTask).toContain("FolderLoadWaiter")
    expect(folderTask).toContain("AbortController")
    expect(folderTask).toContain("waitersBy" + "RequestId")
    expect(folderTask).toContain("requestsBy" + "Path")
    expect(folderTask).toContain("settleRequestFromCommittedChildren")
    expect(folderTask).not.toContain("createFileSystemAsyncTaskRuntime")
    expect(folderTask).not.toContain("taskRuntime")
    expect(folderTask).not.toContain("onPathChange")
    expect(folderTask).not.toContain("onQueryChange")
    expect(folderTask).not.toContain("onSelectionChange")
    expect(folderTask).not.toContain("onViewChange")
    expect(folderTask).not.toContain("predicted")
    expect(controlledProps).toContain("useFileSystemControlledProps")
    expect(controlledProps).toContain('source: "controlled-prop"')
    expect(controlledProps).not.toContain("loadChildren")
    expect(controlledProps).not.toContain("AbortController")
    expect(kernelSelectors).toContain("selectFileSystemBrowserState")
    expect(kernelSelectors).toContain("selectFileSystemSelectionState")
    expect(kernelSelectors).not.toContain("AbortController")
    expect(kernelSelectors).not.toContain("@pierre/trees")
    expect(selectionSourceTask).toContain("useFileSystemSelectionSourceTask")
    expect(selectionSourceTask).toContain("createFileSystemAsyncTaskRuntime")
    expect(openSourceTask).toContain("useFileSystemOpenSourceTask")
    expect(openSourceTask).toContain("createFileSystemAsyncTaskRuntime")
    expect(openSourceTask).not.toContain("FileSystemOpenSourceRequest")
    expect(browserController).toContain(
      "export type FileSystemBrowserController"
    )
    expect(browserController).toContain("browser: FileSystemBrowserState")
    expect(browserController).toContain(
      "export type FileSystemFileActionController"
    )
    expect(browserController).toContain(
      "fileActions: FileSystemFileActionController"
    )
    expect(browserController).toContain(
      "openPreview: FileSystemOpenPreviewCommand"
    )
    expect(browserController).toContain(
      'resolveFileSource: FileSystemSourceController["resolveFileSource"]'
    )
    const browserControllerShape =
      browserController.match(
        /export type FileSystemBrowserController = \{[\s\S]*?\n\}/
      )?.[0] ?? ""
    expect(browserControllerShape).not.toContain("openPreview:")
    expect(browserControllerShape).not.toContain("resolveFileSource:")
    expect(provider).toContain("useFileSystemOpenPreviewController")
    expect(provider).toContain("export type FileSystemContextValue = {")
    expect(provider).toContain(
      "browser: ReturnType<typeof selectFileSystemBrowserState>"
    )
    expect(provider).toContain(
      "selection: ReturnType<typeof selectFileSystemSelectionState>"
    )
    expect(parts).toContain("./file-system-controls")
    expect(parts).toContain("export function useFileSystemHeader")
    expect(parts).toContain("export function useFileSystemBrowser")
    expect(parts).toContain("export function useFileSystemSelection")
    expect(parts).toContain("export function FileSystemHeader")
    expect(parts).toContain("export function FileSystemBrowser")
    expect(parts).toContain("export function FileSystemSelection")
    expect(parts).toContain("createFileSystemBrowserController")
    expect(parts).toContain("export type FileSystemBrowserPartState")
    expect(parts).toContain("const header = useFileSystemHeader()")
    expect(parts).toContain("useFileSystemBrowser()")
    expect(parts).toContain("useFileSystemSelection()")
    expect(parts).toContain("const controller = useFileSystemBrowser()")
    expect(parts).not.toContain("const { navigation, query, title, view }")
    expect(parts).not.toContain("const { renderers, selection, source }")
    expect(parts).not.toContain("explorerController")
    expect(parts).not.toContain("const { browser } = useFileSystemBrowser()")
    expect(existsSync(join(repoRoot, explorerControllerFile))).toBe(false)
    for (const file of deletedSliceFiles) {
      expect(
        existsSync(join(repoRoot, file)),
        `${file} should be deleted`
      ).toBe(false)
    }
    expect(dialog).toContain("export function useFileSystemOpenPreview")
    expect(dialog).toContain("export function FileSystemOpenPreview")
    expect(dialog).toContain('status === "resolving"')
    expect(dialog).toContain('status === "unavailable"')
    expect(dialog).toContain('status === "failed"')
  })

  it("keeps file-system easy API on invariant browser plus preview grammar", () => {
    const content = fileContent("registry/new-york-v4/ui/file-system.tsx")
    const sidebarTag = content.match(/<ViewerSidebar[\s\S]*?>/)?.[0] ?? ""
    const surfaceTag = content.match(/<ViewerSurface[\s\S]*?>/)?.[0] ?? ""

    expect(content).not.toContain("const isGallery")
    expect(sidebarTag).toContain('aria-label="Files"')
    expect(sidebarTag).toContain('width="min(22rem, 85vw)"')
    expect(sidebarTag).not.toContain('width="58%"')
    expect(content).not.toContain("{isGallery ? null : (")
    expect(surfaceTag).not.toMatch(/\bhidden\b/)
    expect(surfaceTag).not.toContain("w-[42%]")
    expect(content).not.toContain('width="58%"')
  })

  it("keeps Pierre out of the main file-system browser", () => {
    const registry = readJson<Registry>("registry.json")
    const fileSystemItem = registry.items.find(
      (item) => item.name === "file-system"
    )
    const fileSystemLightItem = registry.items.find(
      (item) => item.name === "file-system-light"
    )
    const fileSystemPaths = fileSystemItem?.files.map((file) => file.path) ?? []
    const fileSystemLightPaths =
      fileSystemLightItem?.files.map((file) => file.path) ?? []
    const listModelPath = "registry/new-york-v4/ui/file-system-list-model.ts"
    const listView = fileContent(
      "registry/new-york-v4/ui/file-system-list-view.tsx"
    )
    const light = fileContent("registry/new-york-v4/ui/file-system-light.tsx")
    const lightTree = fileContent(
      "registry/new-york-v4/ui/file-system-light-tree.tsx"
    )
    const gridView = fileContent(
      "registry/new-york-v4/ui/file-system-grid-view.tsx"
    )
    const columnsView = fileContent(
      "registry/new-york-v4/ui/file-system-columns-view.tsx"
    )
    const explorerControllerName = "FileSystem" + "ExplorerController"
    const explorerControllerImport = "file-system-explorer" + "-controllers"
    const explorerControllerFile =
      "registry/new-york-v4/ui/file-system-explorer" + "-controllers.ts"
    const pierreFiles = [
      "registry/new-york-v4/ui/file-system-pierre-adapter.ts",
      "registry/new-york-v4/ui/file-system-pierre-decoration.ts",
      "registry/new-york-v4/ui/file-system-pierre-expansion.ts",
      "registry/new-york-v4/ui/file-system-pierre-lazy-retry.ts",
      "registry/new-york-v4/ui/file-system-pierre-model.ts",
      "registry/new-york-v4/ui/file-system-pierre-reset.ts",
      "registry/new-york-v4/ui/file-system-pierre-selection.ts",
    ]
    const deletedPierrePolicyFiles = [
      "registry/new-york-v4/ui/file-system-pierre-" + "reset-identity.ts",
      "registry/new-york-v4/ui/file-system-pierre-" + "reset-plan.ts",
      "registry/new-york-v4/ui/file-system-pierre-" + "expansion-snapshot.ts",
    ]

    expect(fileSystemItem?.dependencies ?? []).not.toContain("@pierre/trees")
    expect(fileSystemPaths).toContain(
      "registry/new-york-v4/ui/file-system-list-view.tsx"
    )
    expect(fileSystemPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-list-continuity.ts"
    )
    expect(fileSystemPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-pierre-list-tree.tsx"
    )
    expect(fileSystemPaths).not.toContain(listModelPath)
    for (const file of pierreFiles) {
      expect(fileSystemPaths).not.toContain(file)
    }
    for (const file of deletedPierrePolicyFiles) {
      expect(fileSystemPaths).not.toContain(file)
      expect(existsSync(join(repoRoot, file))).toBe(false)
    }
    expect(fileSystemLightPaths).toContain(
      "registry/new-york-v4/ui/file-system-light-tree.tsx"
    )
    expect(fileSystemLightPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-pierre-light-tree.tsx"
    )
    expect(existsSync(join(repoRoot, listModelPath))).toBe(false)
    expect(listView).toContain("useVirtualizer")
    expect(listView).toContain("FileSystemListEntryRow")
    expect(listView).toContain("FileSystemBrowserController")
    expect(listView).toContain("fileActions.openPreview")
    expect(listView).toContain("browser.ensureChildren")
    expect(listView).toContain("browser.selectedPath")
    expect(listView).not.toContain("@pierre/trees/react")
    expect(listView).not.toContain("FileSystemListTree")
    expect(listView).not.toContain("useFileSystemListModel")
    expect(listView).not.toContain("useFileSystemPierreModel")
    expect(listView).not.toContain("buildFileSystemPierreInput")
    expect(listView).not.toContain("file-system-pierre-input")
    expect(listView).not.toContain("file-system-pierre-model")
    expect(listView).not.toContain("file-system-pierre-decoration-version")
    expect(listView).not.toContain("file-system-pierre-adapter")
    expect(listView).not.toContain(explorerControllerName)
    expect(listView).not.toContain("new PierreFileTreeModel")
    expect(listView).not.toContain("SortHeader")
    expect(light).not.toContain("pierre")
    expect(light).toContain("./file-system-light-tree")
    expect(light).not.toContain("./file-system-pierre-light-tree")
    expect(lightTree).toContain("@pierre/trees/react")
    expect(existsSync(join(repoRoot, explorerControllerFile))).toBe(false)
    expect(gridView).toContain("FileSystemBrowserController")
    expect(gridView).toContain("fileActions.openPreview")
    expect(gridView).toContain("fileActions.resolveFileSource")
    expect(gridView).toContain("fileActions")
    expect(gridView).not.toContain(explorerControllerName)
    expect(gridView).not.toContain("file-system-pierre")
    expect(columnsView).toMatch(/FileSystem(ColumnsView|Browser)Controller/)
    expect(columnsView).toContain("fileActions.openPreview")
    expect(columnsView).toContain("fileActions.resolveFileSource")
    expect(columnsView).toContain("fileActions")
    expect(columnsView).not.toContain(explorerControllerName)
    expect(columnsView).not.toContain("file-system-pierre")
    for (const file of pierreFiles) {
      if (!existsSync(join(repoRoot, file))) continue

      const content = fileContent(file)
      expect(
        content,
        `${file} imports broad explorer controller`
      ).not.toContain(explorerControllerName)
      expect(
        content,
        `${file} imports explorer composition boundary`
      ).not.toContain(explorerControllerImport)
      expect(
        content,
        `${file} imports file-system-${"controller"}`
      ).not.toContain("./file-system-" + "controller")
    }
  })

  it("keeps workflow viewer named parts on narrow hooks", () => {
    const pageMarkdown = fileContent(
      "components/viewers/page-markdown/page-markdown-viewer.tsx"
    )
    const parse = fileContent("components/viewers/parse/parse-viewer.tsx")
    const partition = fileContent(
      "components/viewers/partition/partition-viewer.tsx"
    )
    const partitionModel = fileContent(
      "components/viewers/partition/partition-viewer-model.ts"
    )
    const classifier = fileContent(
      "components/viewers/classify/classifier-viewer.tsx"
    )

    expect(pageMarkdown).toContain(
      "export function usePageMarkdownViewerContent"
    )
    expect(pageMarkdown).toContain(
      "export function usePageMarkdownViewerDocument"
    )
    expect(pageMarkdown).toContain("export function PageMarkdownViewerToolbar")
    expect(parse).toContain("export function useParseViewerDocument")
    expect(parse).toContain("export function useParseViewerMarkdown")
    expect(partition).toContain("export function usePartitionViewerHeader")
    expect(partition).toContain(
      "export function usePartitionViewerDocumentControls"
    )
    expect(partition).toContain("export function usePartitionViewerModel")
    expect(partition).toContain("createPartitionViewerModel")
    expect(partition).toContain("SegmentedDocumentProvider")
    expect(partition).toContain("useSegmentedDocumentViewport")
    expect(partition).not.toContain("useSegmentViewportController")
    expect(partition).toContain("viewport: SegmentViewportController")
    expect(partition).not.toContain("scrollRequest")
    expect(partition).not.toContain("requestPageScroll")
    expect(partition).not.toContain("PartitionDocumentScrollRequest")
    expect(partition).not.toContain("buildColorMap")
    expect(partition).not.toContain("segmentDisplayLabel")
    expect(partition).not.toContain("maxChunkPage")
    expect(partitionModel).toContain(
      "export function createPartitionViewerModel"
    )
    expect(partitionModel).toContain(
      "export function createPartitionLegendSegments"
    )
    expect(partitionModel).toContain(
      "export function createPartitionRibbonRows"
    )
    expect(partitionModel).toContain(
      "export function createPartitionSegmentedDocumentModel"
    )
    expect(partitionModel).toContain("export type PartitionViewerModel")
    expect(partitionModel).toContain("viewportSegments: DocumentSegment[]")
    expect(partitionModel).toContain("export type PartitionRibbonRow")
    expect(classifier).toContain("export function useClassifierViewerHeader")
  })

  it("keeps workflow registry blocks on visible viewer composition", () => {
    expectJsxTagsInOrder("registry/new-york-v4/blocks/parse-viewer-block.tsx", [
      "<ParseViewerProvider",
      "<ViewerRoot",
      "<ViewerBody",
      "<ResizablePanelGroup",
      "<ViewerSurface",
      "<ParseSourceDocument",
      "<ViewerSurface",
      "<ParseViewerMarkdown",
    ])
    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/partition-viewer-block.tsx",
      [
        "<PartitionViewerProvider",
        "<ViewerRoot",
        "<PartitionViewerHeader",
        "<ViewerBody",
        "<ViewerSurface",
        "<PartitionSourceDocument",
      ]
    )
  })

  it("keeps public viewer docs free of removed shell and slot language", () => {
    const forbiddenPatterns = [
      /\bViewerShell\b/,
      /\bViewerSlots\b/,
      /\bPdfViewerSlots\b/,
      /\bviewer shell\b/i,
      /\bslots\.(?:left|right|top|bottom|overlay)\b/,
      /\bslots=\{/,
      /\brenderDocument\b/,
    ]

    for (const file of publicDocFiles()) {
      const content = fileContent(file)
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(false)
      }
    }
  })

  it("keeps public ViewerSidebar examples labeled by domain", () => {
    const unlabeledSidebars: string[] = []

    for (const file of publicDocFiles()) {
      for (const tag of viewerSidebarTags(fileContent(file))) {
        if (/\baria-label=/.test(tag)) continue
        unlabeledSidebars.push(`${file}: ${tag.replace(/\s+/g, " ")}`)
      }
    }

    expect(unlabeledSidebars).toEqual([])
  })

  it("keeps composed viewer sidebars labeled by domain", () => {
    const sidebars = [
      {
        file: "registry/new-york-v4/blocks/pdf-thumbnails-block.tsx",
        label: 'aria-label="PDF pages"',
      },
      {
        file: "registry/new-york-v4/ui/email-viewer.tsx",
        label: 'aria-label="Email parts"',
      },
      {
        file: "registry/new-york-v4/ui/file-system.tsx",
        label: 'aria-label="Files"',
      },
      {
        file: "registry/new-york-v4/blocks/extract-viewer-block.tsx",
        label: 'aria-label="Extracted fields"',
      },
      {
        file: "registry/new-york-v4/blocks/extraction-viewer-block.tsx",
        label: 'aria-label="Extraction fields"',
      },
      {
        file: "registry/new-york-v4/ui/layout-blocks.tsx",
        label: 'aria-label="OCR blocks"',
      },
    ]

    for (const { file, label } of sidebars) {
      const content = fileContent(file)
      expect(content, `${file} renders ViewerSidebar`).toContain(
        "<ViewerSidebar"
      )
      expect(content, `${file} labels ViewerSidebar`).toContain(label)
    }
  })

  it("keeps every source ViewerSidebar explicitly labeled and trigger side implicit", () => {
    const files = tsxFilesUnderRoots([
      "registry/new-york-v4",
      "components/viewers",
    ])
    const unlabeledSidebars: string[] = []
    const explicitTriggerSides: string[] = []

    for (const file of files) {
      for (const element of jsxOpeningElements(file)) {
        if (element.tag === "ViewerSidebar") {
          if (
            !element.attributes.includes("aria-label") &&
            !element.attributes.includes("aria-labelledby")
          ) {
            unlabeledSidebars.push(`${file}:${element.line}`)
          }
        }

        if (
          element.tag === "ViewerSidebarTrigger" &&
          element.attributes.includes("side")
        ) {
          explicitTriggerSides.push(`${file}:${element.line}`)
        }
      }
    }

    expect(unlabeledSidebars).toEqual([])
    expect(explicitTriggerSides).toEqual([])
  })

  it("keeps viewer sidebar child panels content-only when nested inside viewer rails", () => {
    const panelFiles = [
      "registry/new-york-v4/ui/layout-blocks-panel.tsx",
      "registry/new-york-v4/ui/file-system-preview.tsx",
    ]

    for (const file of panelFiles) {
      expect(
        jsxTags(file),
        `${file} must not render a local aside`
      ).not.toContain("aside")
    }
  })

  it("documents intentional sidebar composition boundaries", () => {
    const sidebarDoc = fileContent("content/docs/components/sidebar.mdx")
    const compactSidebarDoc = compactWhitespace(sidebarDoc)
    const segmentSidebarDoc = fileContent(
      "content/docs/components/segment-sidebar.mdx"
    )
    const compactSegmentSidebarDoc = compactWhitespace(segmentSidebarDoc)
    const sidebarListDoc = fileContent(
      "content/docs/components/sidebar-list.mdx"
    )
    const attachmentSidebarDoc = fileContent(
      "content/docs/components/attachment-sidebar.mdx"
    )
    const sidebarDesign = fileContent(
      "design/sidebar-domain-composition-design.md"
    )
    const compactSidebarDesign = compactWhitespace(sidebarDesign)
    const segmentSidebar = fileContent(
      "registry/new-york-v4/ui/segment-sidebar.tsx"
    )

    expect(sidebarDoc).toContain(
      "`ViewerSidebar` owns a spatial rail inside `ViewerBody`"
    )
    expect(sidebarDoc).toContain(
      "Viewer primitives do not encode domain purpose."
    )
    expect(sidebarDoc).toContain(
      "Root ids, trigger markers, and transition readiness attributes are internal"
    )
    expect(compactSidebarDoc).toContain(
      "`ViewerSidebarTrigger` is natively disabled when no toggleable sidebar has registered."
    )
    expect(sidebarDoc).not.toContain("semantic wrapper")
    expect(sidebarDoc).not.toContain("data-viewer-purpose")
    expect(sidebarDoc).not.toContain("data-viewer-role")
    expect(compactSidebarDoc).toContain(
      "`SidebarList*` owns providerless grouped-row grammar"
    )
    expect(sidebarDoc).not.toContain('`SegmentSidebar` is the "list" surface')
    expect(sidebarListDoc).toContain(
      "`SidebarList*` primitives provide sidebar row grammar without"
    )
    expect(attachmentSidebarDoc).toContain(
      "`AttachmentSidebar` renders selectable file attachments"
    )
    expect(compactSegmentSidebarDoc).toMatch(
      /`SegmentSidebar` owns only the segment-row model and interaction semantics/
    )
    expect(segmentSidebarDoc).toContain(
      "`SegmentSidebar` uses providerless `SidebarList*` primitives"
    )

    expect(segmentSidebar).not.toContain("EmbeddedSidebarProvider")
    expect(segmentSidebar).toContain("<SidebarListRoot")
    expectJsxTagsInOrder(
      "registry/new-york-v4/ui/segmented-document-viewer.tsx",
      ["<ViewerSidebar", "<SegmentSidebar"]
    )

    expect(compactSidebarDesign).toContain(
      "`SegmentSidebar` inside `ViewerSidebar` is therefore a nested composition"
    )
    expect(compactSidebarDesign).toContain(
      "render a complete `PdfViewer bare` inside `ViewerSurface`"
    )
    expect(sidebarDesign).toContain(
      "MIME parts are currently email-owned rail content"
    )
    expect(sidebarDesign).not.toContain(
      "Make `EmailViewer` consume `AttachmentSidebar`"
    )
    expect(sidebarDesign).not.toContain(
      "`ViewerShell` as the shared compound viewer frame"
    )
    expect(sidebarDesign).not.toContain("`FileViewer slots`")
  })

  it("documents nested ViewerRoot and bare mode boundaries", () => {
    const emailViewerDoc = fileContent("content/docs/viewers/email-viewer.mdx")
    const fileViewerDoc = fileContent("content/docs/viewers/file-viewer.mdx")
    const compactFileViewerDoc = compactWhitespace(fileViewerDoc)

    expect(emailViewerDoc).toContain(
      "Nested `ViewerRoot` is correct only for a complete nested viewer."
    )
    expect(emailViewerDoc).toContain("`message/rfc822`")
    expect(emailViewerDoc).toContain(
      "A `ViewerSidebarTrigger` always targets the nearest `ViewerRoot`"
    )
    expect(emailViewerDoc).toContain(
      "<EmailViewer message={nestedMessage} bare"
    )
    expect(emailViewerDoc).toContain(
      "<FileViewer source={attachment.source} bare"
    )
    expect(emailViewerDoc).toContain(
      "Do not nest `ViewerRoot` just to add another toolbar or border"
    )

    expect(fileViewerDoc).toContain(
      "`ViewerRoot bare` removes the spatial frame."
    )
    expect(compactFileViewerDoc).toContain(
      "`FileViewer bare` removes the file-renderer chrome."
    )
    expect(compactFileViewerDoc).toContain(
      "`DomainViewer bare` chooses whether the domain viewer's internal `ViewerRoot` is framed."
    )
  })

  it("keeps public anchored docs free of removed source-link vocabulary", () => {
    for (const { file, required } of anchoredDocumentDocContracts) {
      const content = fileContent(file)
      for (const symbol of removedSourceLinkDocNames) {
        expect(content.includes(symbol), `${file} contains ${symbol}`).toBe(
          false
        )
      }
      for (const symbol of required) {
        expect(content, `${file} contains ${symbol}`).toContain(symbol)
      }
    }
  })

  it("keeps anchored evidence out of the provider primitive", () => {
    const provider = fileContent(
      "registry/new-york-v4/ui/anchored-document-viewer.tsx"
    )
    const documentAnchor = fileContent(
      "registry/new-york-v4/ui/document-anchor.ts"
    )

    expect(provider).toContain("export type AnchoredItemLink")
    expect(provider).toContain("export function useAnchoredItemLink")
    expect(provider).toContain("./document-anchor")
    expect(provider).not.toContain("export type DocumentAnchor")
    expect(documentAnchor).toContain("export type DocumentAnchor")
    expect(documentAnchor).not.toContain('"use client"')
    expect(documentAnchor).not.toContain('from "react"')
    expect(provider).not.toContain("anchored-evidence")
    expect(provider).not.toContain("source-evidence")
    expect(provider).not.toContain("layout-blocks-model")
    expect(provider).not.toContain("EvidenceItem")
    expect(provider).not.toContain("AnchorResolution")
    expect(provider).not.toContain("FieldAnchorLink")
    expect(provider).not.toContain("useAnchoredFieldLink")
    expect(provider).not.toContain("activePath")
    expect(provider).not.toContain("onFieldHover")
  })

  it("keeps field anchor vocabulary in its adapter module", () => {
    const fieldAnchorLink = fileContent(
      "registry/new-york-v4/ui/field-anchor-link.ts"
    )

    expect(fieldAnchorLink).toContain("export type FieldAnchorLink")
    expect(fieldAnchorLink).toContain("export function useAnchoredFieldLink")
    expect(fieldAnchorLink).toContain("useAnchoredItemLink")
  })

  it("keeps source anchor conversion pure and source evidence adapter-free", () => {
    const sourceAnchor = fileContent("registry/new-york-v4/ui/source-anchor.ts")
    const sourceEvidence = fileContent(
      "registry/new-york-v4/ui/source-evidence.ts"
    )
    const anchoredEvidence = fileContent(
      "registry/new-york-v4/ui/anchored-evidence.ts"
    )

    expect(sourceAnchor).not.toContain('"use client"')
    expect(sourceAnchor).not.toContain('from "react"')
    expect(sourceAnchor).toContain("./document-anchor")
    expect(sourceAnchor).not.toContain("./anchored-document-viewer")
    expect(sourceAnchor).not.toContain(".tsx")
    expect(sourceAnchor).not.toContain("pdf-anchor-target")
    expect(sourceAnchor).not.toContain("pdf-source")
    expect(sourceAnchor).not.toContain("image-source")
    expect(sourceAnchor).not.toContain("text-source")
    expect(sourceAnchor).not.toContain("csv-source")
    expect(sourceAnchor).not.toContain("xlsx-source")
    expect(sourceAnchor).not.toContain("docx-source")
    expect(sourceEvidence).toContain("./source-anchor")
    expect(sourceEvidence).toContain("SourceEvidencePayload")
    expect(sourceEvidence).toContain("payload:")
    expect(anchoredEvidence).toContain("EvidenceItem<Payload>")
    expect(anchoredEvidence).not.toContain("metadata?:")
    expect(anchoredEvidence).not.toContain("label:")
    expect(anchoredEvidence).not.toContain("confidence")
    for (const forbidden of [
      "pdf-anchor-target",
      "pdf-source",
      "image-source",
      "text-source",
      "csv-source",
      "xlsx-source",
      "docx-source",
    ]) {
      expect(
        sourceEvidence.includes(forbidden),
        `source-evidence imports ${forbidden}`
      ).toBe(false)
    }
  })

  it("keeps Sources/OCR projection in evidence and model modules", () => {
    const segmentedProvider = fileContent(
      "registry/new-york-v4/ui/segmented-document-provider.tsx"
    )
    const segmentedModel = fileContent(
      "registry/new-york-v4/ui/segmented-document-model.ts"
    )
    const sourceSegmentedModel = fileContent(
      "registry/new-york-v4/ui/source-segmented-document-model.ts"
    )
    const layoutSegmentedModel = fileContent(
      "registry/new-york-v4/ui/layout-blocks-segmented-document-model.ts"
    )
    const sourceFieldList = fileContent(
      "registry/new-york-v4/ui/source-field-list.tsx"
    )
    const layoutPanel = fileContent(
      "registry/new-york-v4/ui/layout-blocks-panel.tsx"
    )
    const layoutBlocks = fileContent(
      "registry/new-york-v4/ui/layout-blocks.tsx"
    )

    expect(segmentedProvider).not.toContain("document-source")
    expect(segmentedProvider).not.toContain("source-evidence")
    expect(segmentedModel).not.toContain("document-source")
    expect(sourceSegmentedModel).toContain("@/lib/document-source")
    expect(sourceSegmentedModel).toContain("createSegmentedDocumentModel")
    expect(sourceSegmentedModel).toContain(
      "export function sourceFieldsToSegmentedDocumentModel"
    )
    expect(sourceSegmentedModel).toContain(
      "export function sourceMapToSegmentedDocumentModel"
    )
    expect(sourceSegmentedModel).toContain(
      "export function sourceToSegmentAnchor"
    )
    expect(layoutSegmentedModel).toContain(
      "export function layoutItemsToSegmentedDocumentModel"
    )
    expect(layoutSegmentedModel).toContain("createSegmentedDocumentModel")
    expect(layoutSegmentedModel).toContain("layout-blocks-types")
    expect(sourceFieldList).toContain("AnchoredItemList")
    expect(sourceFieldList).toContain("sourceFieldToEvidenceItem")
    expect(sourceFieldList).toContain("item.payload")
    expect(layoutPanel).toContain("AnchoredItemList")
    expect(layoutPanel).toContain("LayoutEvidenceItem")
    expect(layoutPanel).toContain("item.payload")
    expect(layoutPanel).not.toContain("metadata")
    expect(layoutBlocks).toContain("createLayoutBlocksViewerModel")
    expect(layoutBlocks).toContain("layoutItemsToSegmentedDocumentModel")
    expect(layoutBlocks).toContain("SegmentedDocumentProvider")
    expect(layoutBlocks).toContain("useSegmentedDocumentModel")
    expect(layoutBlocks).toContain("useSegmentedDocumentViewport")
    expect(layoutBlocks).toContain("setDocumentHandle(handle)")
    expect(layoutBlocks).toContain("scrollToAnchor(anchor)")
    expect(layoutBlocks).toContain("onScrollProgressChange")
    expect(layoutBlocks).toContain("onVisiblePageChange")
    expect(layoutBlocks).not.toContain("AnchoredDocumentProvider")
    expect(layoutBlocks).not.toContain("useAnchoredDocument")
    expect(layoutBlocks).not.toContain("usePdfAnchoredTarget")
    expect(layoutBlocks).not.toContain("map((item) => ({")
    expect(layoutBlocks).not.toContain("anchor: {")
  })

  it("keeps bbox source blocks on segmented document mechanics", () => {
    const fieldAnchorLink = fileContent(
      "registry/new-york-v4/ui/field-anchor-link.ts"
    )
    const jsonFormSources = fileContent(
      "registry/new-york-v4/blocks/json-form-sources-block.tsx"
    )
    const imageSources = fileContent(
      "registry/new-york-v4/blocks/image-sources-block.tsx"
    )

    expect(fieldAnchorLink).toContain("export function useSegmentedFieldLink")
    expect(fieldAnchorLink).toContain("useSegmentedDocument")
    expect(fieldAnchorLink).toContain("scrollToAnchor(anchor)")
    expect(fieldAnchorLink).toContain("scrollToSegmentStart(segment)")

    for (const [file, content] of [
      ["json-form-sources-block", jsonFormSources],
      ["image-sources-block", imageSources],
    ] as const) {
      expect(content, `${file} uses segmented provider`).toContain(
        "SegmentedDocumentProvider"
      )
      expect(content, `${file} uses segmented field link`).toContain(
        "useSegmentedFieldLink"
      )
      expect(content, `${file} registers document handle`).toContain(
        "setDocumentHandle"
      )
      expect(content, `${file} tracks current page`).toContain(
        "onCurrentPageChange"
      )
      expect(content, `${file} tracks scroll progress`).toContain(
        "onScrollProgressChange"
      )
      expect(content, `${file} uses source segmented adapter`).toContain(
        "source-segmented-document-model"
      )
      expect(content, `${file} does not use anchored provider`).not.toContain(
        "AnchoredDocumentProvider"
      )
      expect(content, `${file} does not use anchored hook`).not.toContain(
        "useAnchoredDocument"
      )
    }

    expect(jsonFormSources).toContain("sourceMapToSegmentedDocumentModel")
    expect(jsonFormSources).toContain("PdfHighlight")
    expect(jsonFormSources).not.toContain("usePdfAnchoredTarget")
    expect(jsonFormSources).not.toContain("usePdfAnchoredOverlay")
    expect(imageSources).toContain("sourceFieldsToSegmentedDocumentModel")
    expect(imageSources).toContain("scrollToFrameArea")
  })

  it("keeps source blocks from rebuilding document anchors inline", () => {
    const evidenceSourceBlocks = [
      "registry/new-york-v4/blocks/text-sources-block.tsx",
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
      "registry/new-york-v4/blocks/xlsx-sources-block.tsx",
      "registry/new-york-v4/blocks/docx-sources-block.tsx",
      "registry/new-york-v4/blocks/json-form-sources-block.tsx",
      "registry/new-york-v4/blocks/extract-viewer-block.tsx",
      "registry/new-york-v4/blocks/extraction-viewer-block.tsx",
    ]
    const forbidden = [
      "sourceToPdfAnchor",
      "imageAnchorToTarget",
      "textAnchorToTarget",
      "csvAnchorToTarget",
      "xlsxAnchorToTarget",
      "docxAnchorToTarget",
      "sourceToDocumentAnchor",
      "sourcesToAnchoredItems",
    ]

    for (const file of evidenceSourceBlocks) {
      const content = fileContent(file)
      expect(content, `${file} uses source evidence projection`).toContain(
        "source-evidence"
      )
    }

    for (const file of [
      ...evidenceSourceBlocks,
      "registry/new-york-v4/blocks/image-sources-block.tsx",
    ]) {
      const content = fileContent(file)
      for (const symbol of forbidden) {
        expect(content.includes(symbol), `${file} contains ${symbol}`).toBe(
          false
        )
      }
    }
  })

  it("registers anchored evidence files as installable registry artifacts", () => {
    const registry = readJson<Registry>("registry.json")
    const itemsByName = new Map(registry.items.map((item) => [item.name, item]))

    expect(itemsByName.get("anchored-evidence")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/anchored-evidence.ts",
      }),
    ])
    expect(itemsByName.get("anchored-item-list")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/anchored-item-list.tsx",
      }),
    ])
    expect(itemsByName.get("source-evidence")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-evidence.ts",
      }),
    ])
    expect(itemsByName.get("source-anchor")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-anchor.ts",
      }),
    ])
    expect(itemsByName.get("segmented-document")?.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "registry/new-york-v4/ui/segmented-document-model.ts",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/segmented-document-provider.tsx",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/use-segment-viewport-controller.ts",
        }),
      ])
    )
    expect(itemsByName.get("source-segmented-document")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-segmented-document-model.ts",
      }),
    ])
    expect(itemsByName.get("layout-blocks-segmented-document")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/layout-blocks-segmented-document-model.ts",
      }),
    ])
    expect(itemsByName.get("field-anchor-link")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/field-anchor-link.ts",
      }),
    ])
    expect(itemsByName.get("layout-blocks")?.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "registry/new-york-v4/ui/layout-blocks-model.ts",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/layout-blocks-segmented-document-model.ts",
        }),
      ])
    )
    expect(itemsByName.get("source-field-list")?.registryDependencies).toEqual(
      expect.arrayContaining([
        "anchored-item-list",
        "field-anchor-link",
        "source-evidence",
      ])
    )
    expect(itemsByName.get("source-evidence")?.registryDependencies).toEqual(
      expect.arrayContaining(["anchored-evidence", "source-anchor"])
    )
    expect(
      itemsByName.get("source-segmented-document")?.registryDependencies
    ).toEqual(expect.arrayContaining(["document-source", "segmented-document"]))
    expect(
      itemsByName.get("layout-blocks-segmented-document")?.registryDependencies
    ).toEqual(expect.arrayContaining(["layout-blocks", "segmented-document"]))
    expect(itemsByName.get("layout-blocks")?.registryDependencies).toEqual(
      expect.arrayContaining([
        "anchored-evidence",
        "anchored-item-list",
        "segmented-document",
      ])
    )
    expect(itemsByName.get("layout-blocks")?.registryDependencies).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"])
    )
    expect(
      itemsByName.get("json-form-sources-block")?.registryDependencies
    ).toEqual(
      expect.arrayContaining([
        "segmented-document",
        "source-segmented-document",
      ])
    )
    expect(
      itemsByName.get("json-form-sources-block")?.registryDependencies
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"])
    )
    expect(
      itemsByName.get("image-sources-block")?.registryDependencies
    ).toEqual(
      expect.arrayContaining([
        "segmented-document",
        "source-segmented-document",
      ])
    )
    expect(
      itemsByName.get("image-sources-block")?.registryDependencies
    ).not.toEqual(expect.arrayContaining(["anchored-document-viewer"]))
  })

  it("keeps anchored examples on provider, body, sidebar, surface grammar", () => {
    const examples = [
      {
        file: "registry/new-york-v4/blocks/extract-viewer-block.tsx",
        symbols: [
          "<AnchoredDocumentProvider",
          "<ViewerRoot",
          "<ViewerBody",
          "<ViewerSurface",
          "<PdfViewerProvider",
          "<PdfViewerPages",
          "<ViewerSidebar",
          "<JsonForm",
        ],
      },
      {
        file: "registry/new-york-v4/ui/layout-blocks.tsx",
        symbols: [
          "<SegmentedDocumentProvider",
          "<DocumentAiLayoutBlocksContent",
          "<ViewerRoot",
          "<ViewerBody",
          "<ViewerSurface",
          "<PdfViewerProvider",
          "<PdfViewerPages",
          "<ViewerSidebar",
          "<LayoutBlocksPanel",
        ],
      },
      {
        file: "components/viewers/edit/edit-viewer.tsx",
        symbols: [
          "<EditViewerProvider",
          "<ViewerRoot",
          "<EditViewerHeader",
          "<ViewerBody",
          "<ViewerSurface",
          "<EditViewerDocument",
          "<ViewerSidebar",
          "<EditViewerFields",
        ],
      },
    ]

    for (const { file, symbols } of examples) {
      expectJsxTagsInOrder(file, symbols)
    }
  })

  it("keeps edit viewer provider and parts on clean composition boundaries", () => {
    const easyApi = fileContent("components/viewers/edit/edit-viewer.tsx")
    const provider = fileContent(
      "components/viewers/edit/edit-viewer-provider.tsx"
    )
    const header = fileContent("components/viewers/edit/edit-viewer-header.tsx")
    const document = fileContent(
      "components/viewers/edit/edit-viewer-document.tsx"
    )
    const fields = fileContent("components/viewers/edit/edit-viewer-fields.tsx")
    const fieldPanel = fileContent(
      "components/viewers/edit/edit-viewer-field-panel.tsx"
    )
    const model = fileContent("components/viewers/edit/edit-viewer-model.ts")
    const types = fileContent("components/viewers/edit/edit-viewer-types.ts")
    const docs = fileContent("content/docs/components/edit-viewer.mdx")
    const editFiles = readdirSync(join(repoRoot, "components/viewers/edit"))
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => ({
        file,
        content: fileContent(`components/viewers/edit/${file}`),
      }))

    expect(easyApi).toContain("EditViewerProvider")
    expect(easyApi).toContain("EditViewerHeader")
    expect(easyApi).toContain("EditViewerDocument")
    expect(easyApi).toContain("EditViewerFields")
    expect(easyApi).toContain("<ViewerRoot")
    expect(easyApi).toContain("<ViewerSidebar")
    expect(easyApi).not.toContain("useAnchoredDocument")
    expect(easyApi).not.toContain("AnchoredDocumentProvider")
    expect(easyApi).not.toContain("useEditViewerController")
    expect(easyApi).not.toContain("EditViewerContent")
    expect(easyApi).not.toContain("export function EditViewerRoot")

    expect(provider).toContain("AnchoredDocumentProvider")
    expect(provider).toContain("useAnchoredDocument")
    expect(provider).toContain("usePdfAnchoredTarget")
    expect(provider).toContain("createEditViewerFieldProjection")
    expect(provider).toContain("resolveEditViewerDocumentTarget")
    expect(provider).toContain("useEditViewerSelectionBridge")
    expect(provider).toContain("useEditViewerPageOverlay")
    expect(provider).toContain("editAnchorItemToAnchoredItem")
    expect(provider).not.toContain("function resolveEditViewerDocumentTarget")
    expect(provider).not.toContain("function createEditViewerFieldMap")
    expect(provider).not.toContain("ViewerRoot")
    expect(provider).not.toContain("ViewerSidebar")
    expect(provider).not.toContain("ViewerSurface")

    expect(model).toContain("createEditViewerFieldProjection")
    expect(model).toContain("createEditViewerAnchorItems")
    expect(model).toContain("resolveEditViewerDocumentTarget")
    expect(model).not.toContain('from "react"')
    expect(model).not.toContain("anchored-document-viewer")
    expect(types).toContain("EditViewerDocumentSource")
    expect(types).not.toContain("interface EditViewerDocument ")
    expect(docs.indexOf("## Composition")).toBeLessThan(
      docs.indexOf("## Easy API")
    )
    expect(docs).not.toContain("EditViewerRoot")
    expect(docs).toContain("EditViewerFields` is content-only")
    expect(
      editFiles
        .filter(({ content }) => content.includes("useAnchoredDocument"))
        .map(({ file }) => file)
    ).toEqual(["edit-viewer-provider.tsx"])

    expect(header).toContain("ViewerHeader")
    expect(header).toContain("ViewerSidebarTrigger")
    expect(document).toContain("EditViewerDocumentPane")
    expect(document).not.toContain("ViewerRoot")
    expect(document).not.toContain("ViewerSidebar")
    expect(fields).toContain("EditViewerFieldPanel")
    expect(fields).not.toContain("ViewerSidebar")
    expect(fieldPanel).not.toContain("ViewerSidebar")
    expect(fieldPanel).not.toContain("useEditViewer")
    expect(
      existsSync(
        join(repoRoot, "components/viewers/edit/use-edit-viewer-controller.ts")
      )
    ).toBe(false)
  })

  it("keeps source blocks on viewer sidebar plus content-list composition", () => {
    const anchoredSourceBlocks = [
      "registry/new-york-v4/blocks/text-sources-block.tsx",
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
      "registry/new-york-v4/blocks/xlsx-sources-block.tsx",
      "registry/new-york-v4/blocks/docx-sources-block.tsx",
    ]
    const sourceFieldList = fileContent(
      "registry/new-york-v4/ui/source-field-list.tsx"
    )

    expect(sourceFieldList).not.toContain("<aside")
    expect(sourceFieldList).not.toContain("<ViewerSidebar")
    expect(sourceFieldList).toContain('data-slot="source-field-list"')

    for (const file of anchoredSourceBlocks) {
      expectJsxTagsInOrder(file, [
        "<AnchoredDocumentProvider",
        "<ViewerRoot",
        "<ViewerBody",
        "<ViewerSurface",
        "<ViewerSidebar",
        "<SourceFieldList",
      ])
      expect(fileContent(file)).toContain('aria-label="Source fields"')
    }

    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/image-sources-block.tsx",
      [
        "<SegmentedDocumentProvider",
        "<ViewerRoot",
        "<ViewerBody",
        "<ViewerSurface",
        "<ViewerSidebar",
        "<SourceFieldList",
      ]
    )
    expect(
      fileContent("registry/new-york-v4/blocks/image-sources-block.tsx")
    ).toContain('aria-label="Source fields"')

    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/json-form-sources-block.tsx",
      [
        "<SegmentedDocumentProvider",
        "<ViewerRoot",
        "<ViewerBody",
        "<ViewerSurface",
        "<ViewerSidebar",
        "<JsonForm",
      ]
    )
    expect(
      fileContent("registry/new-york-v4/blocks/json-form-sources-block.tsx")
    ).toContain('aria-label="Extracted data sources"')
  })

  it("teaches compound viewer composition before easy APIs", () => {
    for (const { file, provider, easyApi } of compoundViewerDocContracts) {
      const content = fileContent(file)
      const compositionIndex = content.search(/^## Viewer Composition/im)
      const usageIndex = content.search(/^## Usage/im)

      expect(
        compositionIndex,
        `${file} has a Viewer Composition section`
      ).toBeGreaterThanOrEqual(0)
      expect(usageIndex, `${file} has a Usage section`).toBeGreaterThanOrEqual(
        0
      )
      expect(
        compositionIndex,
        `${file} teaches composition before easy API usage`
      ).toBeLessThan(usageIndex)

      const compositionSection = content.slice(compositionIndex, usageIndex)
      const usageSection = content.slice(usageIndex)

      expect(
        compositionSection.includes(provider),
        `${file} composition section includes ${provider}`
      ).toBe(true)
      expect(
        compositionSection.includes("<ViewerRoot"),
        `${file} composition section includes ViewerRoot`
      ).toBe(true)
      expect(
        usageSection.includes(easyApi),
        `${file} usage section includes ${easyApi}`
      ).toBe(true)
    }
  })

  it("lists every relative internal module imported by registry viewer entries", () => {
    const registry = readJson<Registry>("registry.json")
    const registryItemsByName = new Map(
      registry.items.map((item) => [item.name, item])
    )
    const missingModules: string[] = []

    for (const item of viewerRegistryItems(registry)) {
      const listedFiles = new Set(item.files.map((file) => file.path))
      const dependencyFiles = new Set(
        (item.registryDependencies ?? []).flatMap(
          (name) =>
            registryItemsByName.get(name)?.files.map((file) => file.path) ?? []
        )
      )

      for (const file of item.files) {
        const content = fileContent(file.path)
        for (const specifier of importSpecifiers(content)) {
          const importedFile = resolveRelativeImport(file.path, specifier)
          if (!importedFile?.startsWith("registry/new-york-v4/")) continue
          if (listedFiles.has(importedFile)) continue
          if (dependencyFiles.has(importedFile)) continue
          missingModules.push(
            `${item.name}: ${file.path} imports ${importedFile}`
          )
        }
      }
    }

    expect(missingModules).toEqual([])
  })

  it("keeps sidebar primitive dependency topology exact", () => {
    const registry = readJson<Registry>("registry.json")
    const itemByName = new Map(registry.items.map((item) => [item.name, item]))
    const sidebar = itemByName.get("sidebar")
    const sidebarRow = itemByName.get("sidebar-row")
    const sidebarList = itemByName.get("sidebar-list")
    const segmentSidebar = itemByName.get("segment-sidebar")
    const attachmentSidebar = itemByName.get("attachment-sidebar")
    const sidebarSource = fileContent("registry/new-york-v4/ui/sidebar.tsx")
    const sidebarListSource = fileContent(
      "registry/new-york-v4/ui/sidebar-list.tsx"
    )
    const attachmentSidebarSource = fileContent(
      "registry/new-york-v4/ui/attachment-sidebar.tsx"
    )
    const segmentSidebarSource = fileContent(
      "registry/new-york-v4/ui/segment-sidebar.tsx"
    )

    expect(sidebarRow?.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/ui/sidebar-row.ts",
    ])
    expect(sidebar?.registryDependencies ?? []).toContain("sidebar-row")
    expect(sidebar?.dependencies ?? []).not.toContain(
      "class-variance-authority@^0.7.1"
    )
    expect(sidebarSource).toContain('from "./sidebar-row"')
    expect(sidebarSource).not.toContain("EmbeddedSidebarProvider")
    expect(sidebarSource).not.toContain("scope?:")
    expect(sidebarSource).not.toContain("data-sidebar-scope")

    expect(sidebarList?.registryDependencies ?? []).toContain("sidebar-row")
    expect(sidebarList?.registryDependencies ?? []).not.toContain("sidebar")
    expect(sidebarListSource).toContain('from "./sidebar-row"')
    expect(sidebarListSource).not.toContain('from "./sidebar"')

    expect(segmentSidebar?.registryDependencies ?? []).toContain("sidebar-list")
    expect(segmentSidebar?.registryDependencies ?? []).not.toContain("sidebar")
    expect(segmentSidebarSource).toContain('from "./sidebar-list"')
    expect(segmentSidebarSource).not.toContain("EmbeddedSidebarProvider")

    expect(attachmentSidebar?.registryDependencies ?? []).toContain(
      "sidebar-list"
    )
    expect(attachmentSidebar?.registryDependencies ?? []).not.toContain(
      "sidebar"
    )
    expect(attachmentSidebarSource).toContain('from "./sidebar-list"')
    expect(attachmentSidebarSource).not.toContain("providerClassName")
    expect(attachmentSidebarSource).not.toContain("EmbeddedSidebarProvider")
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
