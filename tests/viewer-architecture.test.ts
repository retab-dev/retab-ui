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
    provider: "FileSystemViewerProvider",
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
  "pdf-thumbnail-sidebar",
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

function expectInOrder(content: string, file: string, symbols: string[]) {
  let previousIndex = -1
  for (const symbol of symbols) {
    const index = content.indexOf(symbol, previousIndex + 1)
    expect(
      index,
      `${file} contains ${symbol} after offset ${previousIndex}`
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
  it("keeps generic viewer primitives at the five spatial parts", () => {
    const content = fileContent("registry/new-york-v4/ui/viewer.tsx")

    expect(exportedFunctions(content).sort()).toEqual(
      [
        "ViewerBody",
        "ViewerHeader",
        "ViewerRoot",
        "ViewerSidebar",
        "ViewerSurface",
      ].sort()
    )
    expect(content).not.toContain("ViewerShell")
    expect(content).not.toContain("ViewerPanel")
    expect(content).not.toContain("ViewerRail")
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
      /\bFileSystemViewerProvider\b/,
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
          "<ViewerSidebar",
          "<EmailViewerPartsList",
          "<ViewerSurface",
          "<EmailViewerSelectedPart",
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
          "<FileSystemViewerProvider",
          "<ViewerRoot",
          "<FileSystemViewerHeader",
          "<ViewerBody",
          "<ViewerSidebar",
          "<FileSystemViewerTree",
          "<ViewerSurface",
          "<FileSystemViewerSelectedFile",
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
      expectInOrder(content, file, symbols)
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

  it("keeps PDF viewer named parts on narrow hooks", () => {
    const viewer = fileContent("registry/new-york-v4/ui/pdf-viewer.tsx")
    const context = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-context.tsx"
    )
    const thumbnails = fileContent(
      "registry/new-york-v4/ui/pdf-thumbnail-sidebar.tsx"
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
    const content = fileContent(
      "registry/new-york-v4/blocks/pdf-thumbnails-block.tsx"
    )

    expectInOrder(
      content,
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

  it("keeps file-system viewer named parts on narrow hooks", () => {
    const content = fileContent("registry/new-york-v4/ui/file-system.tsx")

    expect(content).toContain("./file-system-controls")
    expect(content).not.toContain("./file-system-chrome")
    expect(content).toContain("export function useFileSystemViewerHeader")
    expect(content).toContain("export function useFileSystemViewerTree")
    expect(content).toContain("export function useFileSystemViewerSelectedFile")
    expect(content).toContain(
      "const { controller, title } = useFileSystemViewerHeader()"
    )
    expect(content).toContain("useFileSystemViewerTree()")
    expect(content).toContain("useFileSystemViewerSelectedFile()")
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
    const parse = fileContent("registry/new-york-v4/blocks/parse-viewer-block.tsx")
    const partition = fileContent(
      "registry/new-york-v4/blocks/partition-viewer-block.tsx"
    )

    expectInOrder(parse, "registry/new-york-v4/blocks/parse-viewer-block.tsx", [
      "<ParseViewerProvider",
      "<ViewerRoot",
      "<ViewerBody",
      "<ResizablePanelGroup",
      "<ViewerSurface",
      "<ParseSourceDocument",
      "<ViewerSurface",
      "<ParseViewerMarkdown",
    ])
    expectInOrder(
      partition,
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

    for (const file of publicDocsRoots.flatMap((root) =>
      textFilesUnder(join(repoRoot, root), [".md", ".mdx"])
    )) {
      const content = fileContent(file)
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(false)
      }
    }
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
          "<PdfViewer",
          "<ViewerSidebar",
          "<JsonForm",
          "anchorLink={link}",
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
          "<PdfViewer",
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
      expectInOrder(fileContent(file), file, symbols)
    }
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
