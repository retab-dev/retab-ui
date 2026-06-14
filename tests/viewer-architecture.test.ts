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
    expect(content).not.toContain("ViewerSidebarPurpose")
    expect(content).not.toContain("ViewerSurfaceRole")
    expect(content).not.toContain("viewerPurpose")
    expect(content).not.toContain("viewerRole")
    expect(content).not.toContain("data-viewer-purpose")
    expect(content).not.toContain("data-viewer-role")
    expect(content).not.toContain('"outline"')
    expect(content).not.toContain("ViewerSidebarTriggerProps = ButtonProps &")
    expect(content).not.toMatch(/ViewerSidebarTrigger[^\n]*side=/)
  })

  it("keeps public viewer sidebar hooks on the public context", () => {
    const content = fileContent("registry/new-york-v4/ui/viewer.tsx")

    expect(content).toContain("const ViewerSidebarStateContext =")
    expect(content).toContain("const ViewerSidebarRegistrationContext =")
    expect(content).not.toContain("toPublicViewerSidebarContext")
    expect(content).not.toContain("publicSidebar")
    expect(content).not.toContain("useViewerSidebarInternal")
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
      /\bUploadableFileViewerFrame\b/,
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
      /\bUploadableFileViewerProvider\b/,
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

    expect(content).not.toContain("renderDocument")
    expect(content).toContain("children?: ReactNode")
    expect(content).toContain("useSplitViewerDocumentControls")
    expect(content).toContain("export function useSplitViewerHeader")
    expect(content).toContain("export function useSplitViewerPageRail")
    expect(content).toContain("export function useSplitViewerLegend")
    expect(content).toContain("export function useSplitViewerDocument")
    expect(content).toContain("useSplitViewerHeader()")
    expect(content).toContain("useSplitViewerPageRail()")
    expect(content).toContain("useSplitViewerLegend()")
    expect(content).toContain("useSplitViewerDocument()")
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
          "<EmailViewerHeader",
          "<ViewerBody",
          "<ViewerSurface",
          "<EmailViewerSelectedPart",
          "<ViewerSidebar",
          "<EmailViewerPartsList",
        ],
      },
      {
        file: "components/viewers/split/split-viewer.tsx",
        symbols: [
          "<SplitViewerProvider",
          "<ViewerRoot",
          "<SplitViewerHeader",
          "<SplitViewerBody",
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
          "<FileSystemPreview",
        ],
      },
      {
        file: "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
        symbols: [
          "<UploadableFileViewerProvider",
          "<UploadableFileViewerRoot",
          "<UploadableFileViewerHeader",
          "<ViewerBody",
          "<UploadableFileViewerSummary",
          "<UploadableFileViewerContent",
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
          "<PartitionViewerDocumentState",
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

  it("uses root terminology for uploadable viewer composition", () => {
    const parts = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx"
    )
    const wrapper = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx"
    )

    expect(parts).toContain("UploadableFileViewerRoot")
    expect(wrapper).toContain("UploadableFileViewerRoot")
    expect(parts).not.toContain("UploadableFileViewerFrame")
    expect(wrapper).not.toContain("UploadableFileViewerFrame")
  })

  it("keeps the uploadable viewer easy API preassembled", () => {
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
      "<UploadableFileViewerContent renderViewer={renderViewer} />"
    )
    expect(parts).toContain("<FileViewer")
  })

  it("keeps uploadable viewer named parts on narrow hooks", () => {
    const content = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx"
    )

    expect(content).toContain("export function useUploadableFileViewerRoot")
    expect(content).toContain("export function useUploadableFileViewerHeader")
    expect(content).toContain("export function useUploadableFileViewerSummary")
    expect(content).toContain("export function useUploadableFileViewerContent")
    expect(content).toContain(
      "const { dropzone } = useUploadableFileViewerRoot()"
    )
    expect(content).toContain(
      "const { dropzone, selectedFile } = useUploadableFileViewerHeader()"
    )
    expect(content).toContain("useUploadableFileViewerSummary()")
    expect(content).toContain("useUploadableFileViewerContent()")
  })

  it("keeps email viewer named parts on narrow hooks", () => {
    const content = fileContent("registry/new-york-v4/ui/email-viewer.tsx")

    expect(content).toContain("export function useEmailViewerHeader")
    expect(content).toContain("export function useEmailViewerPartsList")
    expect(content).toContain("export function useEmailViewerSelectedPart")
    expect(content).toContain("const { message } = useEmailViewerHeader()")
    expect(content).toContain(
      "const { rootNode, selectedPath, setSelectedNode } = useEmailViewerPartsList()"
    )
    expect(content).toContain(
      "const { display, message, selectedNode } = useEmailViewerSelectedPart()"
    )
  })

  it("keeps email parts on ViewerSidebar without a nested shadcn sidebar", () => {
    const content = fileContent("registry/new-york-v4/ui/email-viewer.tsx")

    expect(importSpecifiers(content)).not.toContain("./sidebar")
    expect(content).not.toContain("EmbeddedSidebarProvider")
    expect(content).not.toMatch(/<Sidebar(?:\s|>)/)
    expect(content).not.toMatch(/<Sidebar[A-Z]/)
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
    expect(context).toContain("export function useOptionalPdfViewerThumbnails")
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
    expect(thumbnails).toContain(
      "const thumbnails = useOptionalPdfViewerThumbnails()"
    )
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
    const controller = fileContent(
      "registry/new-york-v4/ui/file-system-controller.ts"
    )
    const explorerControllerName = "FileSystem" + "ExplorerController"
    const explorerControllerFile =
      "registry/new-york-v4/ui/file-system-explorer" + "-controllers.ts"

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
    expect(controller).toContain("export type FileSystemDomainState")
    expect(provider).toContain("export type FileSystemCompositionState")
    expect(controller).toContain("browser: FileSystemBrowserState")
    expect(controller).toContain("preview: FileSystemPreviewState")
    expect(provider).toContain("browser,")
    expect(provider).toContain("preview,")
    expect(provider).toContain("openPreview: FileSystemOpenPreviewController")
    expect(provider).not.toContain("query: state.query")
    expect(provider).not.toContain("view: state.view")
    expect(provider).not.toContain("source: state.source")
    expect(provider).not.toContain("index: state.index")
    expect(provider).not.toContain("loading: state.loading")
    expect(provider).not.toContain("selection: state.selection")
    expect(provider).not.toContain("navigation: state.navigation")
    expect(browserState).toContain("export type FileSystemBrowserState")
    expect(browserState).toContain("entries: FileSystemEntry[]")
    expect(browserState).toContain("loading: FileSystemBrowserLoadingState")
    expect(browserState).toContain(
      "navigation: FileSystemBrowserNavigationState"
    )
    expect(browserState).toContain("selection: FileSystemBrowserSelectionState")
    expect(browserState).toContain("commands: FileSystemBrowserCommands")
    expect(browserState).toContain(
      "export type FileSystemBrowserSelectionState"
    )
    expect(browserState).toContain("export type FileSystemBrowserLoadingState")
    expect(browserState).toContain(
      "export type FileSystemBrowserNavigationState"
    )
    expect(browserState).toContain("export type FileSystemBrowserCommands")
    expect(browserState).toContain("export type FileSystemHeaderState")
    expect(browserState).toContain("createFileSystemHeaderState")
    expect(browserState).toContain("entry: FileSystemEntry | null")
    expect(browserState).toContain(
      'resolveSource: FileSystemSourceController["resolveFileSource"]'
    )
    expect(browserState).not.toContain(
      "FileSystemHeaderState = FileSystemBrowserState"
    )
    expect(browserState).toContain("export type FileSystemPreviewState")
    expect(browserState).toContain("createFileSystemBrowserState")
    expect(browserState).toContain("createFileSystemPreviewState")
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
    expect(provider).toContain("useFileSystemStateSlices")
    expect(provider).toContain("export type FileSystemContextValue = {")
    expect(provider).toContain(
      "browser: ReturnType<typeof createFileSystemBrowserState>"
    )
    expect(provider).toContain(
      "preview: ReturnType<typeof createFileSystemPreviewState>"
    )
    expect(parts).toContain("./file-system-controls")
    expect(parts).toContain("export function useFileSystemHeader")
    expect(parts).toContain("export function useFileSystemBrowser")
    expect(parts).toContain("export function useFileSystemPreview")
    expect(parts).toContain("export function FileSystemHeader")
    expect(parts).toContain("export function FileSystemBrowser")
    expect(parts).toContain("export function FileSystemPreview")
    expect(parts).toContain("createFileSystemBrowserController")
    expect(parts).toContain("export type FileSystemBrowserPartState")
    expect(parts).toContain("const header = useFileSystemHeader()")
    expect(parts).toContain("useFileSystemBrowser()")
    expect(parts).toContain("useFileSystemPreview()")
    expect(parts).toContain("const controller = useFileSystemBrowser()")
    expect(parts).not.toContain("const { navigation, query, title, view }")
    expect(parts).not.toContain("const { renderers, selection, source }")
    expect(parts).not.toContain("explorerController")
    expect(parts).not.toContain("const { browser } = useFileSystemBrowser()")
    expect(controller).not.toContain(explorerControllerName)
    expect(
      existsSync(join(repoRoot, explorerControllerFile))
    ).toBe(false)
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

  it("keeps Pierre private to the file-system list-view boundary", () => {
    const listView = fileContent(
      "registry/new-york-v4/ui/file-system-list-view.tsx"
    )
    const listModel = fileContent(
      "registry/new-york-v4/ui/file-system-list-model.ts"
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
    const model = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-model.ts"
    )
    const adapter = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-adapter.ts"
    )
    const input = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-input.ts"
    )
    const decoration = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-decoration.ts"
    )
    const expansion = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-expansion.ts"
    )
    const resetIdentity = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-reset-identity.ts"
    )
    const resetPlan = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-reset-plan.ts"
    )
    const snapshot = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-expansion-snapshot.ts"
    )
    const lazyRetry = fileContent(
      "registry/new-york-v4/ui/file-system-pierre-lazy-retry.ts"
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
      "registry/new-york-v4/ui/file-system-pierre-reset-identity.ts",
      "registry/new-york-v4/ui/file-system-pierre-selection.ts",
    ]

    expect(listView).toContain("@pierre/trees/react")
    expect(listView).toContain("useFileSystemListModel")
    expect(listView).toContain("FileSystemBrowserController")
    expect(listView).not.toContain("useFileSystemPierreModel")
    expect(listView).not.toContain("buildFileSystemPierreInput")
    expect(listView).not.toContain("file-system-pierre-input")
    expect(listView).not.toContain("file-system-pierre-model")
    expect(listView).not.toContain("file-system-pierre-decoration-version")
    expect(listView).not.toContain("file-system-pierre-adapter")
    expect(listView).not.toContain(explorerControllerName)
    expect(listView).not.toContain("new PierreFileTreeModel")
    expect(listView).not.toContain("SortHeader")
    expect(listModel).not.toContain("@pierre/trees/react")
    expect(listModel).toContain("useFileSystemListModel")
    expect(listModel).toContain("useFileSystemPierreModel")
    expect(listModel).toContain("buildFileSystemPierreInput")
    expect(listModel).toContain("createFileSystemPierreAdapterState")
    expect(listModel).toContain("createFileSystemPierreAdapterSource")
    expect(listModel).toContain("browser.commands.ensureChildren")
    expect(listModel).toContain("browser.commands.navigateTo")
    expect(listModel).toContain("browser.selection.selectedPath")
    expect(
      existsSync(
        join(repoRoot, "registry/new-york-v4/ui/file-system-list-model.ts")
      )
    ).toBe(true)
    expect(
      existsSync(
        join(
          repoRoot,
          "registry/new-york-v4/ui/file-system-pierre-list-tree.tsx"
        )
      )
    ).toBe(false)
    expect(light).not.toContain("pierre")
    expect(light).toContain("./file-system-light-tree")
    expect(lightTree).toContain("@pierre/trees/react")
    expect(
      existsSync(
        join(
          repoRoot,
          explorerControllerFile
        )
      )
    ).toBe(false)
    expect(gridView).toContain("FileSystemBrowserController")
    expect(gridView).toContain("fileActions")
    expect(gridView).not.toContain(explorerControllerName)
    expect(gridView).not.toContain("file-system-pierre")
    expect(columnsView).toMatch(/FileSystem(ColumnsView|Browser)Controller/)
    expect(columnsView).toContain("fileActions")
    expect(columnsView).not.toContain(explorerControllerName)
    expect(columnsView).not.toContain("file-system-pierre")
    expect(adapter).toContain("FileSystemPierreAdapterSource")
    expect(adapter).toContain("createFileSystemPierreAdapterState")
    expect(adapter).toContain("FileSystemIndex")
    expect(adapter).not.toContain("FileSystemBrowserState")
    expect(adapter).not.toContain(explorerControllerImport)
    expect(model).toContain("useFileTree")
    expect(model).not.toContain(explorerControllerName)
    expect(model).not.toContain(explorerControllerImport)
    expect(model).toContain("./file-system-pierre-adapter")
    expect(model).not.toContain("./file-system-controller")
    expect(model).toContain("selection.selectedPath")
    expect(model).toContain("currentLoading.folderErrors")
    expect(input).toContain("preparePresortedFileTreeInput")
    expect(input).toContain("entriesByPierrePath")
    expect(input).toContain("pierrePaths")
    expect(input).not.toContain("pathEntries")
    expect(input).not.toContain("revision")
    expect(input).not.toContain("toPierrePath")
    expect(input).not.toContain("fromPierrePath")
    expect(decoration).toContain("fileSystemPierreRowDecoration")
    expect(decoration).toContain("transport detail stays local")
    expect(expansion).toContain("useFileSystemPierreLazyRetryExpansion")
    expect(expansion).toContain("rememberFileSystemPierreExpansionSnapshot")
    expect(resetIdentity).toContain("classifyFileSystemPierreResetTransition")
    expect(resetPlan).toContain("createFileSystemPierreResetPlan")
    expect(resetPlan).toContain("resolveFileSystemPierreInitialExpansion")
    expect(snapshot).toContain("filterFileSystemPierreExpandedPaths")
    expect(lazyRetry).toContain("createFileSystemPierreLazyFolderCommand")
    expect(lazyRetry).toContain("retry-and-expand")
    for (const file of pierreFiles) {
      const content = fileContent(file)
      expect(
        content,
        `${file} imports broad explorer controller`
      ).not.toContain(explorerControllerName)
      expect(
        content,
        `${file} imports explorer composition boundary`
      ).not.toContain(explorerControllerImport)
      expect(content, `${file} imports file-system-controller`).not.toContain(
        "./file-system-controller"
      )
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
    expect(partition).toContain("export function usePartitionViewerDocument")
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
    expect(sidebarDoc).toContain(
      "`ViewerSidebarTrigger` stays focusable when no sidebar has registered yet."
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
          "<AnchoredDocumentProvider",
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
          "<AnchoredDocumentProvider",
          "<EditViewerContent",
          "<ViewerRoot",
          "<ViewerBody",
          "<ViewerSurface",
          "<EditViewerDocumentPane",
          "<ViewerSidebar",
          "<EditViewerFieldPanel",
        ],
      },
    ]

    for (const { file, symbols } of examples) {
      expectJsxTagsInOrder(file, symbols)
    }
  })

  it("keeps source blocks on viewer sidebar plus content-list composition", () => {
    const sourceBlocks = [
      "registry/new-york-v4/blocks/text-sources-block.tsx",
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
      "registry/new-york-v4/blocks/xlsx-sources-block.tsx",
      "registry/new-york-v4/blocks/docx-sources-block.tsx",
      "registry/new-york-v4/blocks/image-sources-block.tsx",
    ]
    const sourceFieldList = fileContent(
      "registry/new-york-v4/ui/source-field-list.tsx"
    )

    expect(sourceFieldList).not.toContain("<aside")
    expect(sourceFieldList).not.toContain("<ViewerSidebar")
    expect(sourceFieldList).toContain('data-slot="source-field-list"')

    for (const file of sourceBlocks) {
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
      "registry/new-york-v4/blocks/json-form-sources-block.tsx",
      [
        "<AnchoredDocumentProvider",
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
