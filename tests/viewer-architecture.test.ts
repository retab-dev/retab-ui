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
  "split-viewer-block",
  "dropzone-block",
  "text-viewer",
])

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as T
}

function publicRegistryFileContent(itemName: string, filePath: string): string {
  const item = readJson<RegistryItem>(`public/r/${itemName}.json`)
  const file = item.files.find((candidate) => candidate.path === filePath)
  if (!file?.content) {
    throw new Error(`${itemName} is missing embedded file ${filePath}`)
  }
  return file.content
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
  it("keeps composed viewer provider contexts private and broad hooks absent", () => {
    const contextContracts = [
      {
        file: "registry/new-york-v4/ui/email-viewer.tsx",
        contextHook: "useEmailViewerContext",
        contextType: "EmailViewerContextValue",
      },
      {
        file: "components/viewers/page-markdown/page-markdown-viewer.tsx",
        contextHook: "usePageMarkdownViewerContext",
        contextType: "PageMarkdownViewerContextValue",
      },
      {
        file: "components/viewers/edit/edit-viewer-provider.tsx",
        contextHook: "useEditViewerContext",
        contextType: "EditViewerContextValue",
      },
      {
        file: "components/viewers/split/split-viewer.tsx",
        contextHook: "useSplitViewerContext",
        contextType: "SplitViewerContextValue",
      },
      {
        file: "components/viewers/partition/partition-viewer.tsx",
        contextHook: "usePartitionViewerContext",
        contextType: "PartitionViewerContextValue",
      },
      {
        file: "components/viewers/classify/classifier-viewer.tsx",
        contextHook: "useClassifierViewerContext",
        contextType: "ClassifierViewerContextValue",
      },
      {
        file: "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
        contextHook: "useFileIntakeViewerContext",
        contextType: "FileIntakeViewerContextValue",
      },
      {
        file: "registry/new-york-v4/ui/pdf-viewer-context.tsx",
        contextHook: "usePdfViewerContext",
        contextType: "PdfViewerContextValue",
      },
    ]
    const broadHooks = [
      "useEmailViewer",
      "usePageMarkdownViewer",
      "useEditViewer",
      "useParseViewer",
      "useSplitViewer",
      "usePartitionViewer",
      "useClassifierViewer",
      "useFileIntakeViewer",
      "usePdfViewer",
    ]
    const broadStateTypes = [
      "EmailViewerState",
      "PageMarkdownViewerState",
      "EditViewerState",
      "ParseViewerState",
      "SplitViewerState",
      "PartitionViewerState",
      "ClassifierViewerState",
      "FileIntakeViewerState",
      "PdfViewerState",
    ]

    for (const contract of contextContracts) {
      const content = fileContent(contract.file)

      expect(
        content,
        `${contract.file} has a private full-context hook`
      ).toContain(`function ${contract.contextHook}`)
      expect(
        content,
        `${contract.file} does not export the context hook`
      ).not.toContain(`export function ${contract.contextHook}`)
      expect(
        content,
        `${contract.file} does not export its context type`
      ).not.toContain(`export type ${contract.contextType}`)
    }

    for (const file of [
      "registry/new-york-v4/ui/email-viewer.tsx",
      "components/viewers/page-markdown/page-markdown-viewer.tsx",
      "components/viewers/edit/edit-viewer-provider.tsx",
      "components/viewers/parse/parse-viewer.tsx",
      "components/viewers/split/split-viewer.tsx",
      "components/viewers/partition/partition-viewer.tsx",
      "components/viewers/classify/classifier-viewer.tsx",
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
      "registry/new-york-v4/ui/pdf-viewer-context.tsx",
    ]) {
      const content = fileContent(file)

      for (const hook of broadHooks) {
        expect(content, `${file} does not export ${hook}`).not.toContain(
          `export function ${hook}(`
        )
      }
      for (const stateType of broadStateTypes) {
        expect(content, `${file} does not export ${stateType}`).not.toContain(
          `export type ${stateType}`
        )
      }
    }
  })

  it("keeps raw React context objects private outside shadcn primitives", () => {
    const allowedContextTypeExports = new Set([
      "registry/new-york-v4/ui/viewer.tsx",
    ])
    const allowedContextConstExports = new Set([
      "registry/new-york-v4/ui/sidebar.tsx",
    ])

    for (const file of architectureSourceFiles()) {
      if (file.includes("/file-system")) continue

      const content = fileContent(file)

      if (!allowedContextConstExports.has(file)) {
        expect(
          content,
          `${file} exports a raw React context object`
        ).not.toMatch(/\bexport const [A-Za-z0-9_]*Context\b/)
      }

      if (!allowedContextTypeExports.has(file)) {
        expect(content, `${file} exports a full context type`).not.toMatch(
          /\bexport (?:type|interface) [A-Za-z0-9_]*ContextValue\b/
        )
      }
    }
  })

  it("keeps public composed-viewer hooks to real composition seams", () => {
    const publicHookContracts = [
      {
        file: "components/viewers/split/split-viewer.tsx",
        hooks: ["useSplitViewerDocumentControls"],
      },
      {
        file: "components/viewers/partition/partition-viewer.tsx",
        hooks: ["usePartitionViewerDocumentControls"],
      },
      {
        file: "components/viewers/page-markdown/page-markdown-viewer.tsx",
        hooks: ["usePageMarkdownViewerDocument"],
      },
      {
        file: "components/viewers/parse/parse-viewer.tsx",
        hooks: ["useParseViewerDocument"],
      },
      {
        file: "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
        hooks: ["useFileIntakeViewerSurface"],
      },
    ]

    for (const contract of publicHookContracts) {
      const exportedViewerHooks = exportedFunctions(fileContent(contract.file))
        .filter((name) => /^use.*Viewer/.test(name))
        .sort()

      expect(exportedViewerHooks).toEqual(contract.hooks.sort())
    }

    const editEntrypoint = fileContent(
      "components/viewers/edit/edit-viewer.tsx"
    )
    const editProviderExports =
      editEntrypoint.match(
        /export \{[\s\S]*?\} from "\.\/edit-viewer-provider"/
      )?.[0] ?? ""
    expect(editProviderExports).toContain("useEditViewerDocument")
    expect(editProviderExports).toContain("useEditViewerFields")
    expect(editProviderExports).not.toContain("useEditViewer,")
    expect(editProviderExports).not.toContain("useEditViewerHeader")
    expect(editProviderExports).not.toContain("useEditViewerLayout")
    expect(editProviderExports).not.toContain("useEditViewerBusy")
    expect(editProviderExports).not.toContain("useEditViewerEmpty")
    expect(editProviderExports).not.toContain("useEditViewerSelection")

    const pdfEntrypoint = fileContent("registry/new-york-v4/ui/pdf-viewer.tsx")
    const pdfExportBlock =
      pdfEntrypoint.match(
        /export \{[\s\S]*?\} from "\.\/pdf-viewer-context"/
      )?.[0] ?? ""
    expect(pdfExportBlock).toContain("usePdfViewerThumbnails")
    expect(pdfExportBlock).not.toContain("usePdfViewer,")
    expect(pdfExportBlock).not.toContain("usePdfViewerHeader")
    expect(pdfExportBlock).not.toContain("usePdfViewerPages")

    const email = fileContent("registry/new-york-v4/ui/email-viewer.tsx")
    expect(
      exportedFunctions(email).filter((name) => /^useEmail/.test(name))
    ).toEqual([])
  })

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
    expect(content).toContain('mode = "auto"')
    expect(content).toContain(
      'type ViewerSidebarCollapsible = "offcanvas" | "none"'
    )
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
    const fileViewer = fileContent("registry/new-york-v4/ui/file-viewer.tsx")
    expect(fileViewer).toContain("<ViewerRoot")
    expect(fileViewer).toContain("<ViewerBody")
    expect(fileViewer).toContain("<ViewerSurface")

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
    expect(fileViewerSource).toContain("export function FileViewerProvider")
    expect(fileViewerSource).toContain("export function FileViewerContent")
    expect(fileViewerSource).toContain("export function FileViewerHeader")
    expect(fileViewerSource).not.toContain("export function useFileViewer")
    expect(fileViewerSource).not.toContain(
      "export function useFileViewerHeader"
    )
    expect(fileViewerSource).not.toContain(
      "export function useFileViewerContent"
    )
    expect(fileViewerSource).not.toContain("export type FileViewerState")
    expect(fileViewerSource).not.toContain("export type FileViewerHeaderState")
    expect(fileViewerSource).not.toContain("export type FileViewerContentState")
    expect(fileViewerSource).toContain("function useFileViewerContext")
    expect(fileViewerSource).toContain("} = useFileViewerContent()")
    expect(fileViewerSource).toContain(
      "const { descriptor, resource } = useFileViewerHeader()"
    )
    expect(fileViewerSource).toContain("CsvFileContent")
    expect(fileViewerSource).toContain("HtmlFileContent")
    expect(fileViewerSource).not.toContain("CsvDocViewer")
    expect(fileViewerSource).not.toContain("HtmlDocViewer")
    expect(fileViewerSource).toContain("<FileViewerProvider")
    expect(fileViewerSource).toContain("<FileViewerContent")
    expect(publicFileViewerSource).toContain(
      'import("@/components/ui/pretext-markdown-viewer")'
    )
    expect(publicFileViewerSource).toContain(
      "export function FileViewerProvider"
    )
    expect(publicFileViewerSource).toContain(
      "export function FileViewerContent"
    )
    expect(publicFileViewerSource).toContain("export function FileViewerHeader")
    expect(publicFileViewerSource).not.toContain(
      "export function useFileViewer"
    )
    expect(publicFileViewerSource).not.toContain(
      "export function useFileViewerHeader"
    )
    expect(publicFileViewerSource).not.toContain(
      "export function useFileViewerContent"
    )
    expect(publicFileViewerSource).not.toContain("export type FileViewerState")
    expect(publicFileViewerSource).not.toContain("markdown-document-viewer")
  })

  it("keeps FileViewer leaf download ownership explicit", () => {
    const fileViewerSource = fileContent(
      "registry/new-york-v4/ui/file-viewer.tsx"
    )
    const leafPropFiles = [
      "registry/new-york-v4/ui/docx-viewer-types.ts",
      "registry/new-york-v4/ui/image-viewer-types.ts",
      "registry/new-york-v4/ui/pptx-viewer-types.ts",
      "registry/new-york-v4/ui/xlsx-viewer-types.ts",
    ]

    expect(fileViewerSource).toContain("showLeafDownload={false}")
    for (const route of [
      "PdfResourceContent",
      "ImageResourceContent",
      "PptxResourceContent",
      "DocxResourceContent",
      "XlsxResourceContent",
    ]) {
      expect(fileViewerSource, `${route} receives showLeafDownload`).toMatch(
        new RegExp(
          `<${route}\\b(?:(?!/>)[\\s\\S])*\\bdownload=\\{showLeafDownload\\}`
        )
      )
    }

    expect(fileContent("registry/new-york-v4/ui/pdf-viewer.tsx")).toContain(
      "download?: boolean"
    )
    for (const file of leafPropFiles) {
      const content = fileContent(file)
      expect(content, `${file} exposes a leaf download control`).toContain(
        "download?: boolean"
      )
    }

    for (const file of [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/docx-viewer-content.tsx",
      "registry/new-york-v4/ui/image-viewer-content.tsx",
      "registry/new-york-v4/ui/pptx-viewer.tsx",
      "registry/new-york-v4/ui/xlsx-viewer-session.tsx",
    ]) {
      const content = fileContent(file)
      expect(content, `${file} defaults leaf download on`).toContain(
        "download = true"
      )
    }

    for (const file of [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/docx-viewer.tsx",
      "registry/new-york-v4/ui/image-viewer.tsx",
      "registry/new-york-v4/ui/pptx-viewer.tsx",
      "registry/new-york-v4/ui/xlsx-viewer.tsx",
    ]) {
      const content = fileContent(file)
      expect(content, `${file} suppresses error-boundary download`).toContain(
        "props.download === false ? null : resource.originalDownload"
      )
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

  it("keeps the removed anchored provider out of the registry", () => {
    const registry = readJson<Registry>("registry.json")
    const itemNames = registry.items.map((item) => item.name)

    expect(itemNames).not.toContain("anchored-document-viewer")
    expect(itemNames).not.toContain("pdf-anchor-target")
    expect(
      existsSync(
        join(repoRoot, "registry/new-york-v4/ui/anchored-document-viewer.tsx")
      )
    ).toBe(false)
    expect(
      existsSync(
        join(repoRoot, "registry/new-york-v4/ui/pdf-anchor-target.tsx")
      )
    ).toBe(false)
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
    expect(content).not.toContain("children?: ReactNode")
    expect(content).toContain("document?: ReactNode")
    expect(content).toContain("<SplitViewerDocument document={document} />")
    expect(content).toContain("export type SplitViewerModel")
    expect(content).not.toContain("export type SplitViewerState")
    expect(content).toContain("export function createSplitViewerModel")
    expect(content).toContain("function createSplitSegmentedDocumentModel")
    expect(content).not.toContain(
      "export function createSplitSegmentedDocumentModel"
    )
    expect(content).toContain(
      "function useSplitViewerContext(): SplitViewerContextValue"
    )
    expect(content).not.toContain("export function useSplitViewer(")
    expect(content).not.toContain("export type SplitViewerContextValue")
    expect(content).not.toContain(
      "export function useSplitViewer(): SplitViewerContextValue"
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
    expect(content).toContain("export function useSplitViewerDocumentControls")
    expect(content).toContain("function useSplitViewerHeader")
    expect(content).toContain("function useSplitViewerPageRail")
    expect(content).toContain("function useSplitViewerLegend")
    expect(content).toContain("function useSplitViewerDocument")
    expect(content).not.toContain("export function useSplitViewerHeader")
    expect(content).not.toContain("export function useSplitViewerPageRail")
    expect(content).not.toContain("export function useSplitViewerLegend")
    expect(content).not.toMatch(/\bexport function useSplitViewerDocument\(/)
    expect(content).not.toContain("export function SplitViewerRoot")
    expect(content).not.toContain("export function SplitViewerBody")
    expect(content).not.toContain("export function SplitViewerSurface")
    expect(content).toContain("export function SplitViewerSidebar")
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

  it("keeps segment primitives typed as semantic document segments", () => {
    for (const file of [
      "registry/new-york-v4/ui/segment-legend.tsx",
      "registry/new-york-v4/ui/segment-sidebar.tsx",
      "registry/new-york-v4/ui/segment-page-rail.tsx",
      "registry/new-york-v4/ui/page-ribbon.tsx",
    ]) {
      const content = fileContent(file)
      expect(content, `${file} imports DocumentSegment`).toContain(
        "DocumentSegment"
      )
      expect(content, `${file} does not expose Segment[] props`).not.toContain(
        "segments: Segment[]"
      )
      expect(
        content,
        `${file} does not expose Segment callbacks`
      ).not.toContain("(segment: Segment)")
    }
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
          "<EmailViewerContent",
          "<ViewerSidebar",
          "<EmailViewerPartsSidebar",
        ],
      },
      {
        file: "components/viewers/split/split-viewer.tsx",
        symbols: [
          "<SplitViewerProvider",
          "<ViewerRoot",
          "<SplitViewerHeader",
          "<ViewerBody",
          "<SplitViewerSidebar",
          "<ViewerSurface",
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
          "<FileIntakeViewerDropTarget",
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
          "<PartitionViewerRibbon",
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
          "<ClassifierViewerDocument",
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

    expect(parts).toContain("FileIntakeViewerDropTarget")
    expect(parts).toContain("FileIntakeViewerRoot")
    expect(wrapper).toContain("FileIntakeViewerRoot")
    expect(wrapper).toContain("FileIntakeViewerDropTarget")
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

    expect(wrapper).not.toContain("renderViewer")
    expect(wrapper).toContain("<FileIntakeViewerDropTarget>")
    expect(wrapper).toContain("<FileIntakeViewerSurface />")
    expect(wrapper).not.toContain("DropzoneUploaderViewer")
    expect(parts).toContain("<FileViewer")
    expect(parts).not.toContain("renderViewer")
  })

  it("keeps file-intake viewer named parts on narrow hooks", () => {
    const content = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx"
    )

    expect(content).toContain("function useFileIntakeViewerDropTarget")
    expect(content).not.toContain(
      "export function useFileIntakeViewerDropTarget"
    )
    expect(content).toContain(
      "function useFileIntakeViewerContext(): FileIntakeViewerContextValue"
    )
    expect(content).not.toContain("export function useFileIntakeViewer(")
    expect(content).toContain("function useFileIntakeViewerHeader")
    expect(content).toContain("function useFileIntakeViewerSidebar")
    expect(content).not.toContain("export function useFileIntakeViewerHeader")
    expect(content).not.toContain("export function useFileIntakeViewerSidebar")
    expect(content).toContain("export function useFileIntakeViewerSurface")
    expect(content).toContain("type FileIntakeViewerContextValue = {")
    expect(content).toContain("model: FileIntakeViewerModel")
    expect(content).toContain("actions: FileIntakeViewerActions")
    expect(content).toContain("type FileIntakeSummary")
    expect(content).not.toContain("export type FileIntakeSummary")
    expect(content).not.toContain("export type FileIntakeViewerState")
    expect(content).toContain("export type FileIntakeViewerRejection")
    expect(content).toContain("createFileIntakeViewerModel")
    expect(content).toContain("createFileIntakeSummary")
    expect(content).toContain("createFileIntakeViewerRejection")
    expect(content).toContain("getRootDropProps")
    expect(content).toContain("getFileInputProps")
    expect(content).toContain("getUploadButtonProps")
    expect(content).toContain("getReplaceButtonProps")
    expect(content).toContain("getEmptySurfaceProps")
    expect(content).toContain("export function FileIntakeViewerDropTarget")
    expect(content).toContain("export function FileIntakeViewerRoot")
    expect(content).toContain("group-data-[dragging]/file-intake-drop")
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
    expect(content).not.toContain("export type FileIntakeViewerContextValue")
    expect(content).not.toContain(
      "export function useFileIntakeViewer(): FileIntakeViewerContextValue"
    )
    expect(content).toContain("useFileIntakeViewerSidebar()")
    expect(content).toContain("useFileIntakeViewerSurface()")
  })

  it("keeps email viewer named parts on narrow hooks", () => {
    const content = fileContent("registry/new-york-v4/ui/email-viewer.tsx")
    const model = fileContent("registry/new-york-v4/ui/email-viewer-model.ts")
    const types = fileContent("registry/new-york-v4/ui/email-viewer-types.ts")

    expect(content).toContain("function useEmailViewerHeaderState")
    expect(content).toContain("function useEmailViewerPartsSidebarState")
    expect(content).toContain("function useEmailViewerContentState")
    expect(content).toContain("export function EmailViewerHeader")
    expect(content).toContain("export function EmailViewerContent")
    expect(content).toContain("export function EmailViewerPartsSidebar")
    expect(content).not.toContain("export function useEmailHeader")
    expect(content).not.toContain("export function useEmailPartsSidebar")
    expect(content).not.toContain("export function useEmailContent")
    expect(content).not.toContain("export function EmailHeader")
    expect(content).not.toContain("export function EmailContent")
    expect(content).not.toContain("export function EmailPartsSidebar")
    expect(content).not.toContain("export function useEmailSelection")
    expect(content).not.toContain("export type EmailViewerState")
    expect(content).not.toContain("export type EmailSelectionState")
    expect(content).toContain("function useEmailViewerContext()")
    expect(content).not.toContain("export function useEmailViewer(")
    expect(content).not.toContain("export function EmailViewerFrame")
    expect(content).not.toContain("EmailViewerChrome")
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
    const registry = readJson<Registry>("registry.json")

    expect(thumbnails).not.toContain("PdfThumbnailSidebar")
    expect(registry.items).not.toContainEqual(
      expect.objectContaining({ name: "pdf-thumbnail-sidebar" })
    )
    expect(registry.items).not.toContainEqual(
      expect.objectContaining({
        files: expect.arrayContaining([
          expect.objectContaining({
            path: "registry/new-york-v4/ui/pdf-viewer-internal-context.tsx",
          }),
        ]),
      })
    )
    expect(context).toContain("usePdfViewerThumbnails")
    expect(context).toContain("PdfViewerProvider")
    expect(context).not.toMatch(/\bexport function usePdfViewerHeader\(/)
    expect(context).not.toMatch(/\bexport function usePdfViewerPages\(/)
    expect(context).not.toContain(
      "export function useOptionalPdfViewerHeaderControls"
    )
    expect(context).toContain("export function usePdfViewerHeaderState")
    expect(context).toContain("export function usePdfViewerPagesState")
    expect(context).toContain("export function usePdfViewerHeaderControlSetter")
    expect(context).toContain("function usePdfViewerContext")
    expect(context).toContain("const PdfViewerContext")
    expect(context).not.toContain("export const PdfViewerContext")
    expect(context).not.toContain("export type PdfViewerContextValue")
    expect(context).not.toContain("useInternalPdfViewer")
    const viewerContextExports =
      viewer.match(/export \{[\s\S]*?\} from "\.\/pdf-viewer-context"/)?.[0] ??
      ""
    expect(viewerContextExports).toContain("usePdfViewerThumbnails")
    expect(viewerContextExports).not.toContain("usePdfViewer,")
    expect(viewerContextExports).not.toContain("usePdfViewerHeader")
    expect(viewerContextExports).not.toContain("usePdfViewerPages")
    expect(viewerContextExports).not.toContain("useInternal")
    expect(context).not.toContain("export * from")
    expect(viewer).toContain("usePdfViewerHeaderState")
    expect(viewer).toContain("usePdfViewerPagesState")
    expect(viewer).toContain("usePdfViewerHeaderControlSetter")
    expect(viewer).not.toContain("PdfViewerContext")
    expect(viewer).not.toContain("useInternalPdfViewer")
    expect(viewer).not.toContain("pdf-viewer-internal-context")
    expect(thumbnails).toContain("const thumbnails = usePdfViewerThumbnails()")
    expect(thumbnails).toContain("export interface PdfThumbnailRailProps")
    expect(thumbnails).toContain("export function PdfThumbnailRail")
    expect(thumbnails).toContain("thumbnailWidth?: number")
    expect(thumbnails).toContain("thumbnailShape?: PdfThumbnailShape")
    const viewerThumbnailsProps =
      thumbnails.match(
        /export interface PdfViewerThumbnailsProps \{[\s\S]*?\n\}/
      )?.[0] ?? ""
    expect(viewerThumbnailsProps).toContain("thumbnailWidth?: number")
    expect(viewerThumbnailsProps).toContain(
      "thumbnailShape?: PdfThumbnailShape"
    )
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
    expect(folderTask).toContain("FileSystemFolderTask")
    expect(folderTask).toContain("folder.loadRequested")
    expect(folderTask).toContain("folder.loadSucceeded")
    expect(folderTask).toContain("folder.loadFailed")
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
    expect(parts).not.toContain("FileViewer")
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
    expect(easyApi).toContain("FileSystemDefaultSelectionContent")
    expect(easyApi).toContain("<FileViewer")
    expect(easyApi).not.toContain("FileSystemSelectionSurface")
    expect(easyApi).not.toContain("./file-system-preview")
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
    expect(fileSystemPaths).toContain(
      "registry/new-york-v4/ui/file-system-thumbnail.tsx"
    )
    expect(fileSystemPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-preview.tsx"
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
    const pageMarkdownPane = fileContent(
      "components/viewers/page-markdown/page-markdown-pane.tsx"
    )
    const pageMarkdownSync = fileContent(
      "components/viewers/page-markdown/page-markdown-sync.ts"
    )
    const parse = fileContent("components/viewers/parse/parse-viewer.tsx")
    const parseDocs = fileContent("content/docs/viewers/parse-viewer.mdx")
    const parseRegistry = fileContent("public/r/parse-viewer-block.json")
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
      "function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue"
    )
    expect(pageMarkdown).not.toContain("export function usePageMarkdownViewer(")
    expect(pageMarkdown).toContain("function usePageMarkdownViewerContent")
    expect(pageMarkdown).not.toContain(
      "export function usePageMarkdownViewerContent"
    )
    expect(pageMarkdown).toContain(
      "export function usePageMarkdownViewerDocument"
    )
    expect(pageMarkdown).toContain("function usePageMarkdownViewerHeader")
    expect(pageMarkdown).not.toContain(
      "export function usePageMarkdownViewerHeader"
    )
    expect(pageMarkdown).not.toContain("export type PageMarkdownViewerState")
    expect(pageMarkdown).not.toContain(
      "export type PageMarkdownViewerContentState"
    )
    expect(pageMarkdown).not.toContain(
      "export type PageMarkdownViewerHeaderState"
    )
    expect(pageMarkdown).toContain("content: PageMarkdownViewerContentState")
    expect(pageMarkdown).toContain("document: PageMarkdownDocumentState")
    expect(pageMarkdown).toContain("header: PageMarkdownViewerHeaderState")
    expect(pageMarkdown).toContain("export function PageMarkdownViewerHeader")
    expect(pageMarkdown).toContain("} = usePageMarkdownViewerHeader()")
    expect(compactWhitespace(pageMarkdown)).toContain(
      "<PageMarkdownViewerHeader /> <ViewerBody>"
    )
    expect(pageMarkdownPane).not.toContain("PageMarkdownToolbar")
    expect(pageMarkdown).not.toContain(
      "export type PageMarkdownViewerContextValue"
    )
    expect(pageMarkdown).not.toContain(
      "export function usePageMarkdownViewer(): PageMarkdownViewerContextValue"
    )
    expect(pageMarkdown).not.toContain(
      "export function PageMarkdownViewerToolbar"
    )
    expect(pageMarkdown).not.toContain("function usePageMarkdownViewerToolbar")
    expect(pageMarkdown).not.toContain("SegmentedDocumentProvider")
    expect(pageMarkdown).not.toContain("useSegmented")
    expect(pageMarkdown).not.toContain("segmented-document")
    expect(pageMarkdownSync).not.toContain("version:")
    expect(pageMarkdownSync).not.toContain("version: number")
    expect(parse).not.toContain("ParseViewerContextValue")
    expect(parse).not.toContain("useParseViewerContext")
    expect(parse).not.toContain("export function useParseViewer(")
    expect(parse).not.toContain("export type ParseViewerState")
    expect(parse).toContain("export function useParseViewerDocument")
    expect(parse).not.toContain("export function useParseViewerMarkdown")
    expect(parse).not.toContain("export type ParseViewerContextValue")
    expect(parse).not.toContain("SegmentedDocumentProvider")
    expect(parse).not.toContain("useSegmented")
    expect(parse).not.toContain("segmented-document")
    expect(parse).toContain("PageMarkdownViewerProvider")
    expect(parse).toContain("export function ParseViewerHeader")
    expect(compactWhitespace(parse)).toContain(
      "<ParseViewerHeader /> <ViewerBody>"
    )
    expect(parseDocs).toContain("ParseViewerHeader")
    expect(parseRegistry).not.toContain("ParseViewerContextValue")
    expect(parseRegistry).not.toContain("export function useParseViewer(")
    expect(parseRegistry).not.toContain("export type ParseViewerContextValue")
    expect(parseRegistry).toContain("PageMarkdownViewerHeader")
    expect(parseRegistry).toContain("ParseViewerHeader")
    expect(parseRegistry).not.toContain("PageMarkdownViewerToolbar")
    expect(parseRegistry).toContain(
      "function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue"
    )
    expect(parseRegistry).not.toContain(
      "export function usePageMarkdownViewer("
    )
    expect(parseRegistry).not.toContain(
      "export type PageMarkdownViewerContextValue"
    )
    expect(partition).toContain(
      "function usePartitionViewerContext(): PartitionViewerContextValue"
    )
    expect(partition).not.toContain("export function usePartitionViewer(")
    expect(partition).toContain("function usePartitionViewerHeader")
    expect(partition).toContain("function usePartitionViewerRibbon")
    expect(partition).not.toContain("export function usePartitionViewerHeader")
    expect(partition).not.toContain("export function usePartitionViewerRibbon")
    expect(partition).toContain(
      "export function usePartitionViewerDocumentControls"
    )
    expect(partition).toContain("function usePartitionViewerDocument")
    expect(partition).toContain("function usePartitionViewerEmpty")
    expect(partition).not.toMatch(
      /\bexport function usePartitionViewerDocument\(/
    )
    expect(partition).not.toContain("export function usePartitionViewerEmpty")
    expect(partition).not.toContain("export function usePartitionViewerModel")
    expect(partition).not.toContain("export type PartitionViewerState")
    expect(partition).not.toContain("export type PartitionViewerContextValue")
    expect(partition).not.toContain(
      "export function usePartitionViewer(): PartitionViewerContextValue"
    )
    expect(partition).toContain("document?: React.ReactNode")
    expect(partition).toContain(
      "<PartitionViewerDocument document={document} />"
    )
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
    expect(classifier).toContain(
      "function useClassifierViewerContext(): ClassifierViewerContextValue"
    )
    expect(classifier).not.toContain("export function useClassifierViewer(")
    expect(classifier).toContain("function useClassifierViewerHeader")
    expect(classifier).toContain("function useClassifierViewerEmpty")
    expect(classifier).toContain("function useClassifierViewerDocument")
    expect(classifier).not.toContain(
      "export function useClassifierViewerHeader"
    )
    expect(classifier).not.toContain("export function useClassifierViewerEmpty")
    expect(classifier).not.toContain(
      "export function useClassifierViewerDocument"
    )
    expect(classifier).not.toContain("export type ClassifierViewerState")
    expect(classifier).not.toContain("export type ClassifierViewerContextValue")
    expect(classifier).not.toContain(
      "export function useClassifierViewer(): ClassifierViewerContextValue"
    )
    expect(classifier).toContain("document?: React.ReactNode")
    expect(classifier).toContain(
      "<ClassifierViewerDocument document={document} />"
    )
    expect(classifier).toContain("export function ClassifierViewerDocument")
    expect(classifier).not.toContain(
      "export type ClassifierViewerDocumentState"
    )
    expect(classifier).not.toContain("SegmentLegend")
    expect(classifier).not.toContain("useSegmentInteraction")
    expect(classifier).not.toContain("buildColorMap")
    expect(classifier).not.toContain("requestDocumentStart")
    expect(classifier).not.toContain("onSelectDocumentStart")
  })

  it("keeps common FileThumbnail usages on shape and size tokens", () => {
    const squareTokenFiles = [
      "content/docs/components/file-thumbnail.mdx",
      "components/file-thumbnail-demo.tsx",
      "components/file-thumbnail-formats-demo.tsx",
      "registry/new-york-v4/blocks/dropzone-media-transcript-queue.tsx",
      "registry/new-york-v4/blocks/dropzone-intake-router.tsx",
      "registry/new-york-v4/blocks/dropzone-required-packet-slots.tsx",
      "registry/new-york-v4/blocks/dropzone-evidence-timeline.tsx",
      "registry/new-york-v4/blocks/dropzone-comparison-pair-upload.tsx",
    ]
    const sizedWorkflowFiles = [
      "registry/new-york-v4/blocks/dropzone-media-transcript-queue.tsx",
      "registry/new-york-v4/blocks/dropzone-intake-router.tsx",
      "registry/new-york-v4/blocks/dropzone-required-packet-slots.tsx",
      "registry/new-york-v4/blocks/dropzone-evidence-timeline.tsx",
      "registry/new-york-v4/blocks/dropzone-comparison-pair-upload.tsx",
    ]
    const attachmentSidebar = fileContent(
      "registry/new-york-v4/ui/attachment-sidebar.tsx"
    )

    for (const file of squareTokenFiles) {
      const content = fileContent(file)
      expect(content, file).toContain('thumbnailShape="square"')
      expect(content, file).not.toContain("previewAspectRatio={1}")
    }

    for (const file of sizedWorkflowFiles) {
      expect(fileContent(file), file).toContain("thumbnailSize=")
    }

    expect(attachmentSidebar).toContain('thumbnailShape="document"')
    expect(attachmentSidebar).toContain('thumbnailSize="md"')
    expect(attachmentSidebar).not.toContain("previewAspectRatio={3 / 4}")
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
        "<PartitionViewerRibbon",
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

  it("keeps public email docs on final named anatomy", () => {
    const emailDocs = fileContent("content/docs/viewers/email-viewer.mdx")
    const supersededDocs = [
      "design/email-viewer-final-blueprint.md",
      "design/email-viewer-terminal-perfection-blueprint.md",
      "design/email-viewer-remaining-perfection-blueprint.md",
      "design/viewer-primitives-platonic-ideal-blueprint.md",
      "design/viewer-system-cleanliness-audit-blueprint.md",
      "design/viewer-system-cleanliness-final-blueprint.md",
      "design/viewer-system-next-cut-blueprint.md",
      "design/viewer-system-next-iteration-blueprint.md",
      "design/viewer-system-terminal-platonic-blueprint.md",
    ]

    expect(emailDocs).toContain("EmailViewerHeader")
    expect(emailDocs).toContain("EmailViewerContent")
    expect(emailDocs).toContain("EmailViewerPartsSidebar")
    expect(emailDocs).not.toContain("EmailViewerFrame")
    expect(emailDocs).not.toContain("<EmailHeader")
    expect(emailDocs).not.toContain("<EmailContent")
    expect(emailDocs).not.toContain("<EmailPartsSidebar")

    for (const file of supersededDocs) {
      const content = fileContent(file)
      expect(
        content,
        `${file} should not teach removed email hooks`
      ).not.toMatch(/\buseEmail(?:Viewer|Header|PartsSidebar|Content)\b/)
      expect(
        content,
        `${file} should not teach the removed frame export`
      ).not.toContain("EmailViewerFrame")
    }
  })

  it("keeps internal selector modules out of shipped viewer APIs", () => {
    const publicEntryFiles = [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/pdf-viewer-context.tsx",
      "components/viewers/edit/edit-viewer-provider.tsx",
    ]
    const exampleAndDocFiles = [
      ...publicDocFiles(),
      ...sourceFilesUnder(join(repoRoot, "registry/new-york-v4/blocks")),
    ]
    const registryText = fileContent("registry.json")

    expect(registryText).not.toContain("internal-context")
    expect(
      existsSync(
        join(
          repoRoot,
          "components/viewers/edit/edit-viewer-internal-context.tsx"
        )
      )
    ).toBe(false)
    expect(
      existsSync(
        join(
          repoRoot,
          "registry/new-york-v4/ui/pdf-viewer-internal-context.tsx"
        )
      )
    ).toBe(false)

    for (const file of publicEntryFiles) {
      expect(
        fileContent(file),
        `${file} does not export internal selectors`
      ).not.toContain("useInternal")
      expect(
        fileContent(file),
        `${file} does not wildcard-export internal modules`
      ).not.toContain("export * from")
    }

    for (const file of exampleAndDocFiles) {
      expect(
        fileContent(file),
        `${file} imports an internal viewer context`
      ).not.toContain("internal-context")
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
        file: "registry/new-york-v4/blocks/sources-viewer-block.tsx",
        label: 'aria-label="Source-linked fields"',
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
      "registry/new-york-v4/ui/file-system-thumbnail.tsx",
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
    const registrySource = fileContent("registry.json")

    expect(compactSidebarDoc).toContain(
      "`ViewerSidebar` owns placement, width, collapse state, and the accessible rail label."
    )
    expect(sidebarDoc).toContain(
      "Put domain meaning in the named rail component and accessible label"
    )
    expect(sidebarDoc).toContain('data-slot="viewer-root"')
    expect(compactSidebarDoc).toContain(
      "`ViewerSidebarTrigger` is disabled until a `ViewerSidebar` registers with the nearest `ViewerRoot`."
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
    expect(registrySource).not.toContain('"name": "segmented-document-viewer"')
    expect(registrySource).not.toContain("segmented-document-viewer.tsx")

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

  it("keeps evidence and document-anchor pure after removing anchored provider", () => {
    const documentAnchor = fileContent(
      "registry/new-york-v4/ui/document-anchor.ts"
    )
    const documentEvidence = fileContent(
      "registry/new-york-v4/ui/document-evidence.ts"
    )
    const registry = readJson<Registry>("registry.json")
    const itemNames = registry.items.map((item) => item.name)

    expect(itemNames).toContain("document-evidence")
    expect(itemNames).not.toContain("anchored-evidence")
    expect(itemNames).not.toContain("anchored-document-viewer")
    expect(itemNames).not.toContain("pdf-anchor-target")
    expect(documentAnchor).toContain("export type DocumentAnchor")
    expect(documentAnchor).not.toContain('"use client"')
    expect(documentAnchor).not.toContain('from "react"')
    expect(documentEvidence).toContain("./document-anchor")
    expect(documentEvidence).toContain("EvidenceItem<Payload>")
    expect(documentEvidence).not.toContain("anchored-document-viewer")
    expect(documentEvidence).not.toContain("AnchoredItem")
    expect(documentEvidence).not.toContain("evidenceToAnchoredItem")
    expect(documentEvidence).not.toContain("evidenceItemsToAnchoredItems")
  })

  it("keeps source field link vocabulary in its adapter module", () => {
    const sourceFieldLink = fileContent(
      "registry/new-york-v4/ui/source-field-link.ts"
    )

    expect(sourceFieldLink).toContain("export type SourceFieldLink")
    expect(sourceFieldLink).toContain(
      "export function useSegmentedSourceFieldLink"
    )
    expect(sourceFieldLink).toContain("useSegmentedItemLink")
    expect(sourceFieldLink).not.toContain("anchored-document-viewer")
    expect(sourceFieldLink).not.toContain("useAnchoredItemLink")
    expect(sourceFieldLink).not.toContain("useAnchoredSourceFieldLink")
  })

  it("keeps source anchor conversion pure and source evidence adapter-free", () => {
    const sourceAnchor = fileContent("registry/new-york-v4/ui/source-anchor.ts")
    const sourceEvidence = fileContent(
      "registry/new-york-v4/ui/source-evidence.ts"
    )
    const documentEvidence = fileContent(
      "registry/new-york-v4/ui/document-evidence.ts"
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
    expect(sourceEvidence).toContain("./document-evidence")
    expect(sourceEvidence).toContain("SourceEvidencePayload")
    expect(sourceEvidence).toContain("payload:")
    expect(documentEvidence).toContain("EvidenceItem<Payload>")
    expect(documentEvidence).not.toContain("metadata?:")
    expect(documentEvidence).not.toContain("label:")
    expect(documentEvidence).not.toContain("confidence")
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
    const segmentedItemLink = fileContent(
      "registry/new-york-v4/ui/segmented-item-link.ts"
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
    expect(segmentedProvider).not.toContain(
      "export type SegmentedDocumentContextValue"
    )
    expect(segmentedProvider).not.toContain(
      "export function useSegmentedDocument("
    )
    expect(segmentedProvider).toContain("function useSegmentedDocumentContext")
    expect(segmentedProvider).toContain(
      "export function useSegmentedDocumentViewport"
    )
    expect(segmentedProvider).toContain(
      "export function useSegmentedDocumentModel"
    )
    expect(segmentedModel).not.toContain("document-source")
    expect(segmentedModel).toContain(
      "Viewport/navigation projection used for page ownership and jumps."
    )
    expect(segmentedModel).toContain(
      "domain vote/output semantics stay outside"
    )
    expect(segmentedItemLink).toContain("export function useSegmentedItemLink")
    expect(segmentedItemLink).toContain("useSegmentedDocumentModel")
    expect(segmentedItemLink).toContain("useSegmentedDocumentViewport")
    expect(segmentedItemLink).not.toContain("useSegmentedDocument()")
    expect(segmentedItemLink).toContain("activeAnchors")
    expect(segmentedItemLink).toContain("anchorsBySegmentId")
    expect(segmentedItemLink).toContain("scrollToAnchor(anchor, options)")
    expect(segmentedItemLink).toContain(
      "scrollToSegmentStart(segment, options)"
    )
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
    expect(sourceFieldList).toContain("InteractiveItemList")
    expect(sourceFieldList).toContain("sourceFieldToEvidenceItem")
    expect(sourceFieldList).toContain("item.payload")
    expect(layoutPanel).toContain("InteractiveItemList")
    expect(layoutPanel).toContain("LayoutEvidenceItem")
    expect(layoutPanel).toContain("item.payload")
    expect(layoutPanel).not.toContain("metadata")
    expect(layoutBlocks).toContain("createLayoutBlocksViewerModel")
    expect(layoutBlocks).toContain("layoutItemsToSegmentedDocumentModel")
    expect(layoutBlocks).toContain("SegmentedDocumentProvider")
    expect(layoutBlocks).toContain("useSegmentedItemLink")
    expect(layoutBlocks).toContain("useSegmentedDocumentViewport")
    expect(layoutBlocks).toContain("setDocumentHandle(handle)")
    expect(layoutBlocks).not.toContain("useSegmentedDocumentModel")
    expect(layoutBlocks).not.toContain("anchorsBySegmentId")
    expect(layoutBlocks).toContain("onScrollProgressChange")
    expect(layoutBlocks).toContain("onVisiblePageChange")
    expect(layoutBlocks).not.toContain("AnchoredDocumentProvider")
    expect(layoutBlocks).not.toContain("useAnchoredDocument")
    expect(layoutBlocks).not.toContain("usePdfAnchoredTarget")
    expect(layoutBlocks).not.toContain("map((item) => ({")
    expect(layoutBlocks).not.toContain("anchor: {")
  })

  it("keeps bbox source blocks on segmented document mechanics", () => {
    const sourceFieldLink = fileContent(
      "registry/new-york-v4/ui/source-field-link.ts"
    )
    const jsonFormSources = fileContent(
      "registry/new-york-v4/blocks/json-form-sources-block.tsx"
    )
    const imageSources = fileContent(
      "registry/new-york-v4/blocks/image-sources-block.tsx"
    )
    const extractSources = fileContent(
      "registry/new-york-v4/blocks/extract-viewer-block.tsx"
    )
    const sourcesViewer = fileContent(
      "registry/new-york-v4/blocks/sources-viewer-block.tsx"
    )
    const sourceSegmentedOverlays = fileContent(
      "registry/new-york-v4/ui/source-segmented-document-overlays.tsx"
    )

    expect(sourceFieldLink).toContain(
      "export function useSegmentedSourceFieldLink"
    )
    expect(sourceFieldLink).toContain("useSegmentedItemLink")
    expect(sourceFieldLink).toContain("activeAnchors")
    expect(sourceFieldLink).not.toContain("anchorsBySegmentId")
    expect(sourceFieldLink).not.toContain("scrollToAnchor(anchor, options)")
    expect(sourceFieldLink).not.toContain(
      "scrollToSegmentStart(segment, options)"
    )

    for (const [file, content] of [
      ["json-form-sources-block", jsonFormSources],
      ["image-sources-block", imageSources],
      ["extract-viewer-block", extractSources],
    ] as const) {
      expect(content, `${file} uses segmented provider`).toContain(
        "SegmentedDocumentProvider"
      )
      expect(content, `${file} uses segmented field link`).toContain(
        "useSegmentedSourceFieldLink"
      )
      expect(content, `${file} uses shared source overlay helpers`).toContain(
        "source-segmented-document-overlays"
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
    expect(jsonFormSources).toContain("useSegmentedPdfSourceOverlay")
    expect(jsonFormSources).not.toContain("usePdfAnchoredTarget")
    expect(jsonFormSources).not.toContain("usePdfAnchoredOverlay")
    expect(imageSources).toContain("sourceFieldsToSegmentedDocumentModel")
    expect(imageSources).toContain("useSegmentedImageSourceOverlay")
    expect(extractSources).toContain("sourceFieldsToSegmentedDocumentModel")
    expect(extractSources).toContain("PdfViewerPages")
    expect(extractSources).toContain("useSegmentedPdfSourceOverlay")
    expect(sourcesViewer).toContain("sourceMapToSegmentedDocumentModel")
    expect(sourcesViewer).toContain("sourceFieldsToSegmentedDocumentModel")
    expect(sourcesViewer).toContain("function SourcesShell")
    expect(sourcesViewer).toContain("SegmentedDocumentProvider")
    expect(sourcesViewer).toContain("useSegmentedSourceFieldLink")
    expect(sourcesViewer).toContain("useSegmentedPdfSourceOverlay")
    expect(sourcesViewer).toContain("useSegmentedImageSourceOverlay")
    expect(sourcesViewer).not.toContain("SegmentedSourcesShell")
    expect(sourcesViewer).not.toContain("AnchoredDocumentProvider")
    expect(sourcesViewer).not.toContain("useAnchoredDocument")
    expect(sourcesViewer).not.toContain("pdf-anchor-target")
    expect(sourceSegmentedOverlays).toContain("setDocumentHandle")
    expect(sourceSegmentedOverlays).toContain("useSegmentedPdfViewerHandle")
    expect(sourceSegmentedOverlays).toContain("useSegmentedImageViewerHandle")
    expect(sourceSegmentedOverlays).toContain("activeAnchorsForPage")
    expect(sourceSegmentedOverlays).toContain("PdfHighlight")
    expect(sourceSegmentedOverlays).toContain("scrollToFrameArea")
  })

  it("keeps source blocks from rebuilding document anchors inline", () => {
    const evidenceSourceBlocks = [
      "registry/new-york-v4/blocks/text-sources-block.tsx",
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
      "registry/new-york-v4/blocks/xlsx-sources-block.tsx",
      "registry/new-york-v4/blocks/docx-sources-block.tsx",
      "registry/new-york-v4/blocks/json-form-sources-block.tsx",
      "registry/new-york-v4/blocks/sources-viewer-block.tsx",
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
      expect(content, `${file} uses segmented source projection`).toContain(
        "source-segmented-document-model"
      )
      expect(content, `${file} uses segmented field link`).toContain(
        "useSegmentedSourceFieldLink"
      )
      expect(content, `${file} uses segmented provider`).toContain(
        "SegmentedDocumentProvider"
      )
    }

    for (const file of [
      ...evidenceSourceBlocks,
      "registry/new-york-v4/blocks/image-sources-block.tsx",
      "registry/new-york-v4/blocks/extract-viewer-block.tsx",
    ]) {
      const content = fileContent(file)
      for (const symbol of forbidden) {
        expect(content.includes(symbol), `${file} contains ${symbol}`).toBe(
          false
        )
      }
    }
  })

  it("registers document evidence files as installable registry artifacts", () => {
    const registry = readJson<Registry>("registry.json")
    const itemsByName = new Map(registry.items.map((item) => [item.name, item]))

    expect(itemsByName.get("document-evidence")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/document-evidence.ts",
      }),
    ])
    expect(itemsByName.get("interactive-item-list")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/interactive-item-list.tsx",
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
          path: "registry/new-york-v4/ui/segmented-item-link.ts",
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
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-segmented-document-overlays.tsx",
      }),
    ])
    expect(itemsByName.get("layout-blocks-segmented-document")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/layout-blocks-segmented-document-model.ts",
      }),
    ])
    expect(itemsByName.get("source-field-link")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-field-link.ts",
      }),
    ])
    expect(itemsByName.get("source-field-link")?.registryDependencies).toEqual(
      expect.arrayContaining(["segmented-document"])
    )
    expect(
      itemsByName.get("source-field-link")?.registryDependencies
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"])
    )
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
        "interactive-item-list",
        "source-field-link",
        "source-evidence",
      ])
    )
    expect(itemsByName.get("source-evidence")?.registryDependencies).toEqual(
      expect.arrayContaining(["document-evidence", "source-anchor"])
    )
    expect(
      itemsByName.get("source-segmented-document")?.registryDependencies
    ).toEqual(expect.arrayContaining(["document-source", "segmented-document"]))
    expect(
      itemsByName.get("layout-blocks-segmented-document")?.registryDependencies
    ).toEqual(expect.arrayContaining(["layout-blocks", "segmented-document"]))
    expect(itemsByName.get("layout-blocks")?.registryDependencies).toEqual(
      expect.arrayContaining([
        "document-evidence",
        "interactive-item-list",
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
    expect(
      itemsByName.get("extract-viewer-block")?.registryDependencies
    ).toEqual(
      expect.arrayContaining([
        "segmented-document",
        "source-segmented-document",
      ])
    )
    expect(
      itemsByName.get("extract-viewer-block")?.registryDependencies
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"])
    )
    expect(
      itemsByName.get("sources-viewer-block")?.registryDependencies
    ).toEqual(
      expect.arrayContaining([
        "segmented-document",
        "source-segmented-document",
      ])
    )
    expect(
      itemsByName.get("sources-viewer-block")?.registryDependencies
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"])
    )
  })

  it("keeps source examples on provider, body, sidebar, surface grammar", () => {
    const examples = [
      {
        file: "registry/new-york-v4/blocks/extract-viewer-block.tsx",
        symbols: [
          "<SegmentedDocumentProvider",
          "<ExtractViewerContent",
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
    const editRegistry = fileContent("public/r/edit-viewer-block.json")
    const editRegistryEasyApi = publicRegistryFileContent(
      "edit-viewer-block",
      "components/viewers/edit/edit-viewer.tsx"
    )
    const header = fileContent("components/viewers/edit/edit-viewer-header.tsx")
    const document = fileContent(
      "components/viewers/edit/edit-viewer-document.tsx"
    )
    const fields = fileContent("components/viewers/edit/edit-viewer-fields.tsx")
    const overlays = fileContent(
      "components/viewers/edit/edit-viewer-overlays.tsx"
    )
    const fieldPanel = fileContent(
      "components/viewers/edit/edit-viewer-field-panel.tsx"
    )
    const model = fileContent("components/viewers/edit/edit-viewer-model.ts")
    const types = fileContent("components/viewers/edit/edit-viewer-types.ts")
    const editDocsPath = "content/docs/components/edit-viewer.mdx"
    const docs = existsSync(join(repoRoot, editDocsPath))
      ? fileContent(editDocsPath)
      : null
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
    expect(easyApi).not.toContain("const edit = useEditViewer()")
    expect(easyApi).not.toContain("useEditViewerLayout")
    expect(easyApi).not.toContain("useEditViewerBusy(")
    expect(easyApi).not.toContain("useEditViewerEmpty(")
    expect(easyApi).not.toContain("useInternalEditViewer")
    expect(easyApi).not.toContain("useEditViewerContext")
    expect(easyApi).not.toContain("EditViewerContext")

    expect(provider).toContain("SegmentedDocumentProvider")
    expect(provider).toContain("useSegmentedItemLink")
    expect(provider).toContain("createEditViewerSegmentedDocumentModel")
    expect(provider).not.toContain("AnchoredDocumentProvider")
    expect(provider).not.toContain("useAnchoredDocument")
    expect(provider).not.toContain("usePdfAnchoredTarget")
    expect(provider).not.toContain("pdf-anchor-target")
    expect(provider).toContain("createEditViewerFieldProjection")
    expect(provider).toContain("resolveEditViewerDocumentTarget")
    expect(provider).toContain("useEditViewerSelectionBridge")
    expect(provider).toContain("useEditViewerPageOverlay")
    expect(provider).not.toContain("editAnchorItemToAnchoredItem")
    expect(provider).toContain("const EditViewerContext")
    expect(provider).toContain("function useEditViewerContext")
    expect(provider).not.toContain("export const EditViewerContext")
    expect(provider).not.toContain("export function useEditViewer(")
    expect(provider).not.toContain("export type EditViewerState")
    expect(provider).not.toContain(
      "export function useEditViewerLayout(): EditViewerLayoutState"
    )
    expect(provider).not.toContain(
      "export function useEditViewerBusy(): EditViewerBusyState"
    )
    expect(provider).not.toContain(
      "export function useEditViewerEmpty(): EditViewerEmptyStatusState"
    )
    expect(provider).not.toContain("export function useEditViewerHeader")
    expect(provider).not.toContain("useInternalEditViewer")
    expect(provider).not.toContain("export type EditViewerContextValue")
    expect(editRegistry).not.toContain("edit-viewer-internal-context.tsx")
    expect(editRegistry).not.toContain("useInternalEditViewer")
    expect(editRegistry).not.toContain("export function useEditViewer(")
    expect(editRegistry).not.toContain("export type EditViewerState")
    expect(editRegistry).not.toContain(
      "export function useEditViewerLayout(): EditViewerLayoutState"
    )
    expect(editRegistry).not.toContain("export type EditViewerContextValue")
    expect(editRegistryEasyApi).not.toContain("const edit = useEditViewer()")
    expect(editRegistryEasyApi).not.toContain("useInternalEditViewer")
    expect(provider).not.toContain("function resolveEditViewerDocumentTarget")
    expect(provider).not.toContain("function createEditViewerFieldMap")
    expect(provider).not.toContain("ViewerRoot")
    expect(provider).not.toContain("ViewerSidebar")
    expect(provider).not.toContain("ViewerSurface")

    expect(model).toContain("createEditViewerFieldProjection")
    expect(model).toContain("createEditViewerSegmentedDocumentModel")
    expect(model).toContain("createSegmentedDocumentModel")
    expect(model).toContain("editFieldTargetFromBBox")
    expect(model).toContain("normalizeEditViewerFieldLocation")
    expect(model).toContain("getEditViewerPdfAreaAnchor")
    expect(model).toContain('targetStatus: { state: "invalid"')
    expect(model).toContain("resolveEditViewerDocumentTarget")
    expect(model).not.toContain('from "react"')
    expect(model).not.toContain("anchored-document-viewer")
    expect(types).toContain("EditViewerDocumentSource")
    expect(types).toContain("target: DocumentAnchor | null")
    expect(types).toContain("EditViewerFieldTargetStatus")
    expect(types).not.toContain("interface EditViewerDocument ")
    expect(overlays).toContain("getEditViewerPdfAreaAnchor")
    expect(overlays).not.toContain("field.bbox")
    if (docs) {
      expect(docs.indexOf("## Composition")).toBeLessThan(
        docs.indexOf("## Easy API")
      )
      expect(docs).not.toContain("EditViewerRoot")
      expect(docs).toContain("EditViewerFields` is content-only")
    }
    expect(
      editFiles
        .filter(({ content }) => content.includes("useAnchoredDocument"))
        .map(({ file }) => file)
    ).toEqual([])

    expect(header).toContain("ViewerHeader")
    expect(header).toContain("ViewerSidebarTrigger")
    expect(header).not.toContain("EditViewerContext")
    expect(header).not.toContain("useEditViewerContext")
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

  it("keeps source blocks on segmented viewer sidebar plus content-list composition", () => {
    const segmentedSourceBlocks = [
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

    for (const file of segmentedSourceBlocks) {
      expectJsxTagsInOrder(file, [
        "<SegmentedDocumentProvider",
        "<ViewerRoot",
        "<ViewerBody",
        "<ViewerSurface",
        "<ViewerSidebar",
        "<SourceFieldList",
      ])
      const content = fileContent(file)
      expect(content).toContain('aria-label="Source fields"')
      expect(content).toContain("useSegmentedSourceFieldLink")
      expect(content).toContain("sourceFieldsToSegmentedDocumentModel")
      expect(content).not.toContain("AnchoredDocumentProvider")
      expect(content).not.toContain("useAnchoredDocument")
      expect(content).not.toContain("useAnchoredSourceFieldLink")
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
