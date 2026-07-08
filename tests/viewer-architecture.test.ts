import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// The single source of truth for the install-safe import rewrite applied to
// built registry payloads.
import { rewriteContentImports } from "../scripts/rewrite-registry-imports.mjs";

type RegistryFile = {
  path: string;
  content?: string;
  target?: string;
  type?: string;
};

type RegistryItem = {
  name: string;
  type: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
};

type Registry = {
  items: RegistryItem[];
};

const repoRoot = process.cwd();

const sharedUseIsClientFiles = new Set([
  "components/ui/use-is-client.ts",
  "registry/new-york-v4/ui/use-is-client.ts",
]);

const architectureRoots = [
  "registry/new-york-v4/ui",
  "components/ui",
  "components/viewers",
  "lib",
];

const publicDocsRoots = ["content/docs/components"];

const compoundViewerDocContracts = [
  {
    file: "content/docs/components/file-viewer/renderers/pdf.mdx",
    provider: "PdfViewerProvider",
    root: "<FileViewer",
    easyApi: "PdfViewer",
  },
  {
    file: "content/docs/components/file-viewer/renderers/email.mdx",
    provider: "EmailViewerProvider",
    root: "<ViewerRoot",
    easyApi: "EmailViewer",
  },
  {
    file: "content/docs/components/parse-viewer.mdx",
    provider: "ParseViewerProvider",
    root: "<ViewerRoot",
    easyApi: "ParseViewer",
  },
];

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
];

const staleSourceAdapterNames = [
  ["target", "Range"],
  ["pdfAnchor", "ToLocation"],
  ["imageAnchor", "ToArea"],
  ["imageAnchor", "ToFrame"],
  ["textAnchor", "ToLines"],
  ["csvAnchor", "ToCell"],
  ["spreadsheetAnchor", "ToCell"],
  ["docxSource", "ToTarget"],
].map((parts) => parts.join(""));

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
]);

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

// The 14 primitives migrated to stock shadcn. They are referenced as bare
// registry dependencies and resolve to upstream shadcn files, so they no
// longer ship their own files inside registry.json. Their in-repo source
// still lives at registry/new-york-v4/ui/<name>.tsx, so relative imports to
// them are satisfied by the bare dependency, not by a listed registry file.
const migratedShadcnPrimitives = new Set([
  "button",
  "dialog",
  "sheet",
  "dropdown-menu",
  "popover",
  "tooltip",
  "select",
  "tabs",
  "accordion",
  "collapsible",
  "separator",
  "card",
  "badge",
  "breadcrumb",
]);

const migratedShadcnPrimitiveFiles = new Set(
  Array.from(migratedShadcnPrimitives).map(
    (name) => `registry/new-york-v4/ui/${name}.tsx`,
  ),
);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as T;
}

function registryDependencyItemName(name: string) {
  return name.replace(/^@retab\//, "");
}

function publicRegistryFileContent(itemName: string, filePath: string): string {
  const item = readJson<RegistryItem>(`public/r/${itemName}.json`);
  const file = item.files.find((candidate) => candidate.path === filePath);
  if (!file?.content) {
    throw new Error(`${itemName} is missing embedded file ${filePath}`);
  }
  return file.content;
}

function sourceFilesUnder(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry);
    if (relative(repoRoot, fullPath).split("/").includes("old")) return [];
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return sourceFilesUnder(fullPath);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [relative(repoRoot, fullPath)];
  });
}

function architectureSourceFiles(): string[] {
  return architectureRoots.flatMap((root) =>
    sourceFilesUnder(join(repoRoot, root)),
  );
}

function textFilesUnder(path: string, extensions: string[]): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return textFilesUnder(fullPath, extensions);
    if (!extensions.some((extension) => entry.endsWith(extension))) return [];
    return [relative(repoRoot, fullPath)];
  });
}

function publicDocFiles(): string[] {
  return publicDocsRoots.flatMap((root) =>
    textFilesUnder(join(repoRoot, root), [".md", ".mdx"]),
  );
}

function viewerSidebarTags(content: string): string[] {
  return Array.from(
    content.matchAll(
      /<(?:FileViewerSidebar|ViewerSidebar)\b(?:[^"'>]|"[^"]*"|'[^']*')*>/g,
    ),
  ).map((match) => match[0]);
}

function viewerRootTags(content: string): string[] {
  return Array.from(
    content.matchAll(/<ViewerRoot\b(?:[^"'>]|"[^"]*"|'[^']*')*>/g),
  ).map((match) => match[0]);
}

function viewerRegistryItems(registry: Registry): RegistryItem[] {
  return registry.items.filter((item) => canonicalViewerNames.has(item.name));
}

function fileContent(file: string): string {
  return readFileSync(join(repoRoot, file), "utf8");
}

function viewerImplementationContent(): string {
  return [
    "registry/new-york-v4/ui/viewer-root.tsx",
    "registry/new-york-v4/ui/viewer-body.tsx",
    "registry/new-york-v4/ui/viewer-chrome.tsx",
    "registry/new-york-v4/ui/viewer-sidebar.tsx",
    "registry/new-york-v4/ui/viewer-surface.tsx",
    "registry/new-york-v4/ui/viewer-internals.tsx",
    "registry/new-york-v4/ui/viewer-types.ts",
  ]
    .map(fileContent)
    .join("\n");
}

function compactWhitespace(content: string): string {
  return content.replace(/\s+/g, " ");
}

function moduleSpecifiers(content: string): string[] {
  const imports: string[] = [];
  const importExportPattern =
    /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImportPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of content.matchAll(importExportPattern)) {
    imports.push(match[1]);
  }
  for (const match of content.matchAll(dynamicImportPattern)) {
    imports.push(match[1]);
  }

  return imports;
}

function importSpecifiers(content: string): string[] {
  return moduleSpecifiers(content).filter((specifier) =>
    specifier.startsWith("."),
  );
}

function resolveRelativeImport(
  importer: string,
  specifier: string,
): string | null {
  const withoutQuery = specifier.split("?")[0];
  const basePath = join(dirname(join(repoRoot, importer)), withoutQuery);
  const candidates = sourceExtensions.flatMap((extension) => [
    `${basePath}${extension}`,
    join(basePath, `index${extension}`),
  ]);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return relative(repoRoot, candidate);
  }

  if (existsSync(basePath) && statSync(basePath).isFile()) {
    return relative(repoRoot, basePath);
  }

  return null;
}

function jsxTagName(node: ts.JsxTagNameExpression): string {
  return node.getText();
}

function jsxTags(file: string): string[] {
  const content = fileContent(file);
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const tags: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      tags.push(jsxTagName(node.tagName));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return tags;
}

type JsxOpeningElementInfo = {
  file: string;
  line: number;
  tag: string;
  attributes: string[];
};

function jsxOpeningElements(file: string): JsxOpeningElementInfo[] {
  const content = fileContent(file);
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const elements: JsxOpeningElementInfo[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      elements.push({
        file,
        line: position.line + 1,
        tag: jsxTagName(node.tagName),
        attributes: node.attributes.properties.map((property) =>
          ts.isJsxAttribute(property)
            ? property.name.getText(sourceFile)
            : "...",
        ),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return elements;
}

type JsxElementDescendantsInfo = {
  file: string;
  line: number;
  tag: string;
  descendantTags: string[];
};

function jsxElementsWithDescendants(
  file: string,
  tagName: string,
): JsxElementDescendantsInfo[] {
  const content = fileContent(file);
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const elements: JsxElementDescendantsInfo[] = [];

  function collectDescendantTags(node: ts.Node, tags: string[]) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      tags.push(jsxTagName(node.tagName));
    }
    ts.forEachChild(node, (child) => collectDescendantTags(child, tags));
  }

  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      jsxTagName(node.openingElement.tagName) === tagName
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.openingElement.getStart(sourceFile),
      );
      const descendantTags: string[] = [];
      for (const child of node.children) {
        collectDescendantTags(child, descendantTags);
      }
      elements.push({
        file,
        line: position.line + 1,
        tag: tagName,
        descendantTags,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return elements;
}

function tsxFilesUnderRoots(roots: string[]): string[] {
  return roots.flatMap((root) =>
    sourceFilesUnder(join(repoRoot, root)).filter((file) =>
      file.endsWith(".tsx"),
    ),
  );
}

function expectJsxTagsInOrder(file: string, expectedTags: string[]) {
  const tags = jsxTags(file);
  let previousIndex = -1;

  for (const expectedTag of expectedTags) {
    const tag = expectedTag.replace(/^</, "");
    const index = tags.indexOf(tag, previousIndex + 1);
    expect(
      index,
      `${file} contains JSX <${tag}> after tag index ${previousIndex}. Tags: ${tags.join(
        ", ",
      )}`,
    ).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

function exportedFunctions(content: string): string[] {
  const sourceFile = ts.createSourceFile(
    "source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const functions: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      functions.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return functions;
}

function namedReExports(
  content: string,
  moduleSpecifier: string,
  options: { typeOnly?: boolean } = {},
): string[] {
  const sourceFile = ts.createSourceFile(
    "source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const names: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (!statement.exportClause) continue;
    if (!ts.isNamedExports(statement.exportClause)) continue;
    if (!statement.moduleSpecifier) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== moduleSpecifier) continue;

    for (const specifier of statement.exportClause.elements) {
      const isTypeOnly = statement.isTypeOnly || specifier.isTypeOnly;
      if (options.typeOnly === true && !isTypeOnly) continue;
      if (options.typeOnly === false && isTypeOnly) continue;
      names.push(specifier.name.text);
    }
  }

  return names;
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
    ];
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
    ];
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
    ];

    for (const contract of contextContracts) {
      const content = fileContent(contract.file);

      expect(
        content,
        `${contract.file} has a private full-context hook`,
      ).toContain(`function ${contract.contextHook}`);
      expect(
        content,
        `${contract.file} does not export the context hook`,
      ).not.toContain(`export function ${contract.contextHook}`);
      expect(
        content,
        `${contract.file} does not export its context type`,
      ).not.toContain(`export type ${contract.contextType}`);
    }

    for (const file of [
      "registry/new-york-v4/ui/email-viewer.tsx",
      "components/viewers/page-markdown/page-markdown-viewer.tsx",
      "components/viewers/edit/edit-viewer.tsx",
      "components/viewers/edit/edit-viewer-provider.tsx",
      "components/viewers/edit/edit-viewer-store.tsx",
      "components/viewers/parse/parse-viewer.tsx",
      "components/viewers/split/split-viewer.tsx",
      "components/viewers/partition/partition-viewer.tsx",
      "components/viewers/classify/classifier-viewer.tsx",
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
      "registry/new-york-v4/ui/pdf-viewer-context.tsx",
    ]) {
      const content = fileContent(file);

      for (const hook of broadHooks) {
        expect(content, `${file} does not export ${hook}`).not.toContain(
          `export function ${hook}(`,
        );
      }
      for (const stateType of broadStateTypes) {
        expect(content, `${file} does not export ${stateType}`).not.toContain(
          `export type ${stateType}`,
        );
      }
    }
  });

  it("keeps raw React context objects private outside shadcn primitives", () => {
    const allowedContextTypeExports = new Set([
      "registry/new-york-v4/ui/viewer.tsx",
      "registry/new-york-v4/ui/file-viewer-context.tsx",
    ]);
    const allowedContextConstExports = new Set([
      "registry/new-york-v4/ui/sidebar.tsx",
      "registry/new-york-v4/ui/file-viewer-context.tsx",
    ]);

    for (const file of architectureSourceFiles()) {
      if (file.includes("/file-system")) continue;

      const content = fileContent(file);

      if (!allowedContextConstExports.has(file)) {
        expect(
          content,
          `${file} exports a raw React context object`,
        ).not.toMatch(/\bexport const [A-Za-z0-9_]*Context\b/);
      }

      if (!allowedContextTypeExports.has(file)) {
        expect(content, `${file} exports a full context type`).not.toMatch(
          /\bexport (?:type|interface) [A-Za-z0-9_]*ContextValue\b/,
        );
      }
    }
  });

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
    ];

    for (const contract of publicHookContracts) {
      const exportedViewerHooks = exportedFunctions(fileContent(contract.file))
        .filter((name) => /^use.*Viewer/.test(name))
        .sort();

      expect(exportedViewerHooks).toEqual(contract.hooks.sort());
    }

    const editEntrypoint = fileContent(
      "components/viewers/edit/edit-viewer.tsx",
    );
    expect(
      namedReExports(editEntrypoint, "./edit-viewer-provider", {
        typeOnly: false,
      }),
    ).toEqual(["EditViewerProvider"]);
    expect(
      namedReExports(editEntrypoint, "./edit-viewer-provider", {
        typeOnly: true,
      }),
    ).toEqual(["EditViewerProviderProps"]);

    const pdfEntrypoint = fileContent("registry/new-york-v4/ui/pdf-viewer.tsx");
    const pdfContextExports = namedReExports(
      pdfEntrypoint,
      "./pdf-viewer-context",
      { typeOnly: false },
    );
    expect(pdfContextExports).toEqual(
      expect.arrayContaining([
        "PdfViewerPages",
        "PdfViewerProvider",
        "usePdfViewerThumbnails",
      ]),
    );
    const pdfViewerHeader = ["Pdf", "ViewerHeader"].join("");
    const pdfHeaderHook = ["usePdf", "ViewerHeader"].join("");
    expect(pdfContextExports).not.toContain(pdfViewerHeader);
    expect(pdfContextExports).not.toContain("usePdfViewer");
    expect(pdfContextExports).not.toContain(pdfHeaderHook);
    expect(pdfContextExports).not.toContain("usePdfViewerPages");

    const email = fileContent("registry/new-york-v4/ui/email-viewer.tsx");
    expect(
      exportedFunctions(email).filter((name) => /^useEmail/.test(name)),
    ).toEqual([]);
  });

  it("keeps generic viewer primitives to spatial parts and sidebar control", () => {
    const content = viewerImplementationContent();
    const publicEntrypoint = fileContent("registry/new-york-v4/ui/viewer.tsx");
    const rootProps =
      content.match(/export type ViewerRootProps = [\s\S]*?\n\}/)?.[0] ?? "";
    const sidebarTriggerProps =
      content.match(/export type ViewerSidebarTriggerProps = [^\n]+/)?.[0] ??
      "";
    const publicValueExports = [
      ...namedReExports(publicEntrypoint, "./viewer-body", { typeOnly: false }),
      ...namedReExports(publicEntrypoint, "./viewer-chrome", {
        typeOnly: false,
      }),
      ...namedReExports(publicEntrypoint, "./viewer-root", { typeOnly: false }),
      ...namedReExports(publicEntrypoint, "./viewer-sidebar", {
        typeOnly: false,
      }),
      ...namedReExports(publicEntrypoint, "./viewer-surface", {
        typeOnly: false,
      }),
    ];

    expect(publicValueExports.sort()).toEqual(
      [
        "ViewerBody",
        "ViewerFrame",
        "ViewerHeader",
        "ViewerRoot",
        "ViewerSidebar",
        "ViewerSidebarTrigger",
        "ViewerSurface",
        "ViewerViewport",
        "useOptionalViewerSidebar",
        "useViewerSidebar",
      ].sort(),
    );
    expect(content).not.toContain("ViewerShell");
    expect(content).not.toContain("ViewerPanel");
    expect(content).not.toContain("ViewerRail");
    expect(content).not.toContain("ViewerDocumentSurface");
    expect(content).not.toContain("ViewerInspectorSidebar");
    expect(content).not.toContain("ViewerNavigationSidebar");
    expect(content).not.toContain("ViewerContent");
    expect(content).not.toContain("ViewerPanel");
    expect(content).not.toContain("ViewerMain");
    expect(content).not.toContain("ViewerAside");
    expect(content).not.toContain("ViewerSidebarProvider");
    expect(content).not.toContain("ViewerLayoutProvider");
    expect(content).not.toContain("ViewerPartsProvider");
    expect(content).not.toContain("ViewerSidebarPurpose");
    expect(content).not.toContain("ViewerSurfaceRole");
    expect(content).not.toContain("viewerPurpose");
    expect(content).not.toContain("viewerRole");
    expect(content).not.toContain("sidebarKind");
    expect(content).not.toContain("data-viewer-purpose");
    expect(content).not.toContain("data-viewer-role");
    expect(content).not.toContain("data-viewer-kind");
    expect(content).not.toContain("data-viewer-sidebar-purpose");
    expect(content).not.toContain("data-viewer-surface-file-type");
    expect(content).not.toContain('"outline"');
    expect(content).not.toContain("ViewerSidebarTriggerProps = ButtonProps &");
    expect(content).not.toMatch(/ViewerSidebarTrigger[^\n]*side=/);
    expect(rootProps).not.toMatch(/\bbare\??:/);
    expect(rootProps).not.toMatch(/\bvariant\??:/);
    expect(rootProps).not.toMatch(/\blayout\??:/);
    expect(rootProps).not.toMatch(/\bsidebarKind\??:/);
    expect(rootProps).toMatch(/\bopen\??:/);
    expect(rootProps).toMatch(/\bdefaultOpen\??:/);
    expect(rootProps).toMatch(/\bonOpenChange\??:/);
    expect(rootProps).toMatch(/\bmode\??:/);
    expect(rootProps).toMatch(/\bsidebarSide\??:/);
    expect(rootProps).toMatch(/\bsidebarCollapsible\??:/);
    expect(content).toContain('mode = "auto"');
    expect(content).toContain(
      'type ViewerSidebarCollapsible = "offcanvas" | "none"',
    );
    expect(rootProps).not.toMatch(/\bsidebarOpen\??:/);
    expect(rootProps).not.toMatch(/\bdefaultSidebarOpen\??:/);
    expect(rootProps).not.toMatch(/\bonSidebarOpenChange\??:/);
    expect(rootProps).not.toMatch(/\bsidebarMode\??:/);
    expect(sidebarTriggerProps).toContain("ButtonProps");
    const rootStart = content.indexOf("export function ViewerRoot");
    const frameStart = content.indexOf("export function ViewerFrame");
    const rootBody = content.slice(rootStart, frameStart);
    const frameBody = content.slice(frameStart);
    expect(rootBody).not.toContain("rounded-xl");
    expect(rootBody).not.toContain("border bg-muted/30");
    expect(rootBody).not.toContain("bg-background");
    expect(frameBody).toContain('data-slot="viewer-frame"');
    expect(frameBody).toContain("bg-background");
    expect(frameBody).toContain("rounded-xl");
    expect(frameBody).toContain("border");
  });

  it("keeps viewer frame ownership explicit in first-party compositions", () => {
    const files = [
      ...textFilesUnder(join(repoRoot, "registry/new-york-v4"), [
        ".tsx",
        ".mdx",
      ]),
      ...textFilesUnder(join(repoRoot, "components"), [".tsx", ".mdx"]),
      ...textFilesUnder(join(repoRoot, "content/docs/components"), [".mdx"]),
    ].map((file) => relative(repoRoot, file));
    const viewerRootBareTags = files.flatMap((file) =>
      viewerRootTags(fileContent(file))
        .filter((tag) => /\bbare\b/.test(tag))
        .map((tag) => `${file}: ${tag}`),
    );

    expect(viewerRootBareTags).toEqual([]);

    const csvSourcesBlock = fileContent(
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
    );
    const sourcesViewerBlock = fileContent(
      "registry/new-york-v4/blocks/sources-viewer-block.tsx",
    );
    const fileViewerCsv = fileContent(
      "registry/new-york-v4/ui/file-viewer-csv-viewer.tsx",
    );
    const csvViewer = fileContent("registry/new-york-v4/ui/csv-viewer.tsx");

    expect(csvSourcesBlock).toContain("CsvViewerDocument");
    expect(csvSourcesBlock).not.toContain("rounded-none border-0");
    expect(sourcesViewerBlock).toContain("CsvViewerGrid");
    expect(sourcesViewerBlock).not.toContain("rounded-none border-0");
    expect(fileViewerCsv).toContain("CsvResourceContent");
    expect(fileViewerCsv).not.toContain("rounded-none border-0");
    expect(csvViewer).toContain("export const CsvViewerDocument");
    expect(csvViewer).toContain("frame={false}");
  });

  it("keeps structural viewer parts non-polymorphic until evidence proves the need", () => {
    const content = viewerImplementationContent();

    for (const component of [
      "ViewerRoot",
      "ViewerHeader",
      "ViewerBody",
      "ViewerSidebar",
      "ViewerSurface",
    ]) {
      const start = content.indexOf(`export function ${component}`);
      const next = content.indexOf("\nexport ", start + 1);
      const functionBody =
        start === -1
          ? ""
          : content.slice(start, next === -1 ? undefined : next);
      expect(functionBody, `${component} is exported`).toContain(
        `export function ${component}`,
      );
      expect(functionBody, `${component} has no asChild prop`).not.toContain(
        "asChild",
      );
      expect(functionBody, `${component} has no render prop`).not.toMatch(
        /\brender\b/,
      );
    }

    expect(content).toContain(
      "export type ViewerSidebarTriggerProps = ButtonProps",
    );
    expect(content).not.toContain("export const ViewerContent");
    expect(content).not.toContain("export const ViewerPanel");
    expect(content).not.toContain("export const ViewerMain");
    expect(content).not.toContain("export const ViewerAside");
  });

  it("keeps viewer slots anatomical and viewer data attributes state-only", () => {
    const content = viewerImplementationContent();

    for (const slot of [
      "viewer-root",
      "viewer-frame",
      "viewer-header",
      "viewer-body",
      "viewer-surface",
      "viewer-sidebar-trigger",
    ]) {
      expect(content).toContain(`data-slot="${slot}"`);
    }
    expect(content).toContain('?? "viewer-sidebar"');

    for (const attribute of [
      "data-viewer-sidebar-mode",
      "data-viewer-sidebar-open",
      "data-viewer-sidebar-state",
      "data-side",
      "data-collapsible",
    ]) {
      expect(content).toContain(attribute);
    }

    for (const forbiddenAttribute of [
      "data-viewer-kind",
      "data-viewer-sidebar-purpose",
      "data-viewer-surface-file-type",
      "data-viewer-purpose",
      "data-viewer-role",
    ]) {
      expect(content).not.toContain(forbiddenAttribute);
    }
  });

  it("keeps public viewer sidebar hooks on the public context", () => {
    const content = viewerImplementationContent();

    expect(content).toContain("const ViewerSidebarStateContext =");
    expect(content).toContain("const ViewerSidebarRegistrationContext =");
    expect(content).not.toContain("export const ViewerSidebarStateContext");
    expect(content).not.toContain(
      "export const ViewerSidebarRegistrationContext",
    );
    expect(content).not.toContain("toPublicViewerSidebarContext");
    expect(content).not.toContain("publicSidebar");
    expect(content).not.toContain("useViewerSidebarInternal");
    const publicSidebarContext =
      content.match(
        /export type ViewerSidebarStateValue = \{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    const privateSidebarContext =
      content.match(
        /type ViewerSidebarRegistrationState = \{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    expect(publicSidebarContext).not.toContain("sidebarId");
    expect(privateSidebarContext).toContain("sidebarId: string");
    expect(content).toMatch(
      /export function useViewerSidebar\(\): ViewerSidebarStateValue \{[\s\S]*?return useViewerSidebarState\("useViewerSidebar"\)[\s\S]*?\}/,
    );
    expect(content).toMatch(
      /function useViewerSidebarRegistrationContext\([\s\S]*?consumer: string[\s\S]*?\): ViewerSidebarRegistrationState \{[\s\S]*?useOptionalViewerSidebarRegistration\(\)/,
    );
  });

  it("keeps public source adapters off stale compatibility names", () => {
    for (const file of sourceAdapterFiles) {
      if (!existsSync(join(repoRoot, file))) continue;
      const content = fileContent(file);
      for (const symbol of staleSourceAdapterNames) {
        expect(content.includes(symbol), `${file} contains ${symbol}`).toBe(
          false,
        );
      }
    }
  });

  it("keeps viewer runtime code on the shared useIsClient primitive", () => {
    const localUseIsClientPattern =
      /\b(?:export\s+)?function\s+useIsClient\b|\b(?:const|let|var)\s+useIsClient\b/;

    for (const file of architectureSourceFiles()) {
      if (sharedUseIsClientFiles.has(file)) continue;
      const content = fileContent(file);
      expect(
        localUseIsClientPattern.test(content),
        `${file} defines a local useIsClient`,
      ).toBe(false);
    }
  });

  it("keeps viewer runtime code free of slot-object type aliases", () => {
    for (const file of sourceFilesUnder(
      join(repoRoot, "registry/new-york-v4/ui"),
    )) {
      if (!/(?:^|\/)[a-z0-9-]+viewer(?:-types)?\.tsx?$/.test(file)) continue;
      const content = fileContent(file);
      expect(
        /\b[A-Z][A-Za-z0-9]*ViewerSlots\b/.test(content),
        `${file} exports a slot-object alias`,
      ).toBe(false);
    }
  });

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
    ];

    for (const file of architectureSourceFiles()) {
      const content = fileContent(file);
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(
          false,
        );
      }
    }
  });

  it("keeps source routers and PDF props out of composition concerns", () => {
    const fileViewerFiles = [
      "registry/new-york-v4/ui/file-viewer.tsx",
      "registry/new-york-v4/ui/file-viewer-core.ts",
    ];
    const forbiddenFileViewerPatterns = [
      /\bEmailViewerProvider\b/,
      /\bFileSystemProvider\b/,
      /\bSplitViewerProvider\b/,
      /\bFileIntakeViewerProvider\b/,
      /\bAnchoredDocumentProvider\b/,
      /\banchoredItems\??:/,
      /\bsourceMap\??:/,
      /\brenderDocument\??:/,
      /\bslots\??:/,
    ];

    for (const file of fileViewerFiles) {
      const content = fileContent(file);
      for (const pattern of forbiddenFileViewerPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(
          false,
        );
      }
    }
    const fileViewerFrame = fileContent(
      "registry/new-york-v4/ui/file-viewer-frame.tsx",
    );
    const fileViewerFrameController = fileContent(
      "registry/new-york-v4/ui/file-viewer-frame-controller.ts",
    );
    const fileViewerFrameKeyboard = fileContent(
      "registry/new-york-v4/ui/file-viewer-frame-keyboard.ts",
    );
    const fileViewerContent = fileContent(
      "registry/new-york-v4/ui/file-viewer-content.tsx",
    );
    const fileViewerLayout = fileContent(
      "registry/new-york-v4/ui/file-viewer-layout.tsx",
    );
    const fileViewerSidebar = fileContent(
      "registry/new-york-v4/ui/file-viewer-sidebar.tsx",
    );
    const fileViewerSidebarController = fileContent(
      "registry/new-york-v4/ui/file-viewer-sidebar-controller.ts",
    );
    const fileViewerSourceList = fileContent(
      "registry/new-york-v4/ui/file-viewer-source-list.tsx",
    );
    const fileViewerSidebarOpenState = fileContent(
      "registry/new-york-v4/ui/file-viewer-sidebar-open-state.ts",
    );
    const fileViewerSidebarRegistration = fileContent(
      "registry/new-york-v4/ui/file-viewer-sidebar-registration.ts",
    );
    const fileViewerBody = [
      fileViewerContent,
      fileViewerLayout,
      fileViewerSidebar,
      fileViewerSourceList,
    ].join("\n");
    const fileViewerAccessibility = fileContent(
      "registry/new-york-v4/ui/file-viewer-accessibility.ts",
    );
    const fileViewerContext = fileContent(
      "registry/new-york-v4/ui/file-viewer-context.tsx",
    );
    const fileViewerElements = fileContent(
      "registry/new-york-v4/ui/file-viewer-elements.ts",
    );
    const fileViewerMotionKernel = fileContent(
      "registry/new-york-v4/ui/file-viewer-motion-kernel.ts",
    );
    const fileViewerKeyboard = fileContent(
      "registry/new-york-v4/ui/file-viewer-keyboard.ts",
    );
    const fileViewerRendererContract = fileContent(
      "registry/new-york-v4/ui/file-viewer-renderer-contract.ts",
    );
    const fileViewerRendererFrame = fileContent(
      "registry/new-york-v4/ui/file-viewer-renderer-frame.tsx",
    );
    const fileViewerMotionPlan = fileContent(
      "registry/new-york-v4/ui/file-viewer-motion-plan.ts",
    );
    const fileViewerEntrypoint = fileContent(
      "registry/new-york-v4/ui/file-viewer.tsx",
    );
    const fileViewerPreview = fileContent(
      "registry/new-york-v4/ui/file-viewer-preview.tsx",
    );
    const fileViewerHeader = fileContent(
      "registry/new-york-v4/ui/file-viewer-header.tsx",
    );
    const fileViewerProvider = fileContent(
      "registry/new-york-v4/ui/file-viewer-provider.tsx",
    );
    const fileViewerState = fileContent(
      "registry/new-york-v4/ui/file-viewer-state.tsx",
    );
    const fileViewerFallback = fileContent(
      "registry/new-york-v4/ui/file-viewer-fallback.tsx",
    );
    const fileViewerAnatomy = [
      fileViewerFrame,
      fileViewerBody,
      fileViewerHeader,
      fileViewerState,
      fileViewerFallback,
    ].join("\n");
    const fileViewerRuntime = [
      fileViewerFrameController,
      fileViewerFrameKeyboard,
      fileViewerMotionKernel,
      fileViewerRendererContract,
      fileViewerRendererFrame,
      fileViewerSidebarController,
      fileViewerMotionPlan,
      fileViewerSidebarOpenState,
      fileViewerSidebarRegistration,
    ].join("\n");
    const viewerHeaderOutlet = fileContent(
      "registry/new-york-v4/ui/viewer-header-outlet.tsx",
    );
    expect(fileViewerFrame).toContain("FileViewerShellStaticContext.Provider");
    expect(fileViewerFrame).toContain(
      "FileViewerSidebarDynamicContext.Provider",
    );
    expect(fileViewerFrame).toContain("useFileViewerFrameController");
    expect(fileViewerAccessibility).toContain(
      "resolveFileViewerSidebarAccessibilityProps",
    );
    expect(fileViewerAccessibility).toContain(
      "resolveFileViewerSidebarTriggerAccessibilityProps",
    );
    expect(fileViewerAccessibility).not.toContain("React.");
    expect(fileViewerFrameController).toContain("createFileViewerMotionKernel");
    expect(fileViewerFrameController).toContain("useFileViewerFrameKeyboard");
    expect(fileViewerFrameController).toContain(
      "useFileViewerSidebarOpenController",
    );
    expect(fileViewerFrameController).toContain(
      "useFileViewerSidebarRegistration",
    );
    expect(fileViewerFrameKeyboard).toContain(
      "shouldCloseFileViewerSidebarOnEscape",
    );
    expect(fileViewerFrameKeyboard).toContain("closeSidebar()");
    expect(fileViewerKeyboard).toContain(
      "shouldCloseFileViewerSidebarOnEscape",
    );
    expect(fileViewerKeyboard).toContain(
      "isFileViewerActiveElementInsideShell",
    );
    expect(fileViewerKeyboard).not.toContain("React.");
    expect(fileViewerFrameController).toContain(
      "createFileViewerElementRegistry",
    );
    expect(fileViewerFrameController).toContain(
      "resolveFileViewerSidebarInteractive",
    );
    expect(fileViewerFrameController).toContain("motionKernel.startMotion");
    expect(fileViewerFrameController).toContain(
      "elementRegistry.registerViewerShellElement",
    );
    expect(fileViewerFrameController).toContain("isSidebarRequestedOpen");
    expect(fileViewerFrameController).toContain("isSidebarInteractive");
    expect(fileViewerFrameController).not.toContain("isSidebarVisible");
    expect(fileViewerFrameController).not.toContain(
      "shouldCloseFileViewerSidebarOnEscape",
    );
    expect(fileViewerFrameController).not.toContain("window.setTimeout");
    expect(fileViewerFrameController).not.toContain(
      "--file-viewer-sidebar-inline-size",
    );
    expect(fileViewerFrameController).not.toContain("cssTransition");
    expect(fileViewerFrameController).not.toContain("transitionend");
    expect(fileViewerFrameController).not.toContain(
      "resolveFileViewerCssLength",
    );
    expect(fileViewerFrame).not.toContain("<ViewerRoot");
    for (const slot of [
      "file-viewer-root",
      "file-viewer-header",
      "file-viewer-header-title-group",
      "file-viewer-title",
      "file-viewer-meta",
      "file-viewer-controls",
      "file-viewer-content",
      "file-viewer-sidebar-gap",
      "file-viewer-sidebar",
      "file-viewer-sidebar-rail",
      "file-viewer-inset",
      "file-viewer-document-frame",
      "file-viewer-viewport",
      "file-viewer-document-fallback",
    ]) {
      expect(fileViewerAnatomy).toContain(`data-slot="${slot}"`);
    }
    for (const forbiddenSlotContract of [
      "data-file-viewer-slot",
      "file-viewer-surface",
      "file-viewer-sidebar-container",
    ]) {
      expect(fileViewerAnatomy).not.toContain(forbiddenSlotContract);
    }
    expect(fileViewerAnatomy).toContain('from "radix-ui"');
    expect(fileViewerAnatomy).toContain("Slot.Root");
    expect(fileViewerAnatomy).not.toContain("@radix-ui/react-slot");
    expect(fileViewerBody).toContain('data-slot="file-viewer-content"');
    expect(fileViewerBody).toContain("export function FileViewerSidebar");
    expect(fileViewerSidebar).toContain("useFileViewerSidebarController");
    expect(fileViewerBody).not.toContain("useFileViewerMotionFrame");
    expect(fileViewerBody).not.toContain("useFileViewerRendererFrame");
    expect(fileViewerBody).not.toContain("usesFileViewerInlineGeometry");
    expect(fileViewerRendererFrame).toContain("useFileViewerMotionFrame");
    expect(fileViewerRendererFrame).toContain("useFileViewerRendererFrame");
    expect(fileViewerRendererFrame).toContain(
      "useOptionalFileViewerRendererEnvironment",
    );
    expect(fileViewerRendererFrame).toContain("usesShellGeometry");
    expect(fileViewerRendererContract).toContain("usesShellGeometry");
    expect(fileViewerRendererFrame).not.toContain("FileViewerViewportSize");
    expect(fileViewerRendererFrame).not.toContain(
      "FileViewerViewportSizeProvider",
    );
    expect(fileViewerRendererFrame).not.toContain(
      "useOptionalFileViewerViewportSize",
    );
    expect(fileViewerRendererFrame).not.toContain("useFileViewerViewportSize");
    const rendererShellContextImporters = sourceFilesUnder(
      join(repoRoot, "registry/new-york-v4/ui"),
    ).filter(
      (file) =>
        file !== "registry/new-york-v4/ui/file-viewer.tsx" &&
        !file.includes("/file-viewer-") &&
        fileContent(file).includes('from "./file-viewer-context"'),
    );
    expect(rendererShellContextImporters).toEqual([]);
    const fileViewerSourceFiles = sourceFilesUnder(
      join(repoRoot, "registry/new-york-v4/ui"),
    ).filter((file) => /^registry\/new-york-v4\/ui\/file-viewer/.test(file));
    const fileViewerDomReadFiles = fileViewerSourceFiles.filter((file) =>
      /getBoundingClientRect|getComputedStyle|document\.createElement|querySelector/.test(
        fileContent(file),
      ),
    );
    const fileViewerDomWriteFiles = fileViewerSourceFiles.filter((file) =>
      /\.style\.|\.setAttribute\(|\.removeAttribute\(|\.inert\b|\.focus\(/.test(
        fileContent(file),
      ),
    );
    expect(fileViewerDomReadFiles).toEqual([]);
    expect(fileViewerDomWriteFiles.sort()).toEqual(
      [
        "registry/new-york-v4/ui/file-viewer-accessibility.ts",
        "registry/new-york-v4/ui/file-viewer-motion-kernel.ts",
      ].sort(),
    );
    expect(fileViewerContent).toContain('from "./file-viewer-layout"');
    expect(fileViewerContent).toContain('from "./file-viewer-sidebar"');
    expect(fileViewerContent).toContain('from "./file-viewer-source-list"');
    expect(fileViewerLayout).toContain("export function FileViewerContent");
    expect(fileViewerSidebar).toContain("export function FileViewerSidebar");
    expect(fileViewerSourceList).toContain(
      "export function FileViewerSourceList",
    );
    expect(viewerHeaderOutlet).toContain('"titleGroup" | "controls"');
    expect(viewerHeaderOutlet).toContain('["titleGroup", "controls"]');
    expect(fileViewerHeader).toContain('name="titleGroup"');
    expect(fileViewerProvider).toContain("hasTitleGroupOutlet");
    for (const staleHeaderContract of [
      '"identity"',
      "identityOutlet",
      "hasIdentityOutlet",
    ]) {
      expect(viewerHeaderOutlet).not.toContain(staleHeaderContract);
      expect(fileViewerHeader).not.toContain(staleHeaderContract);
      expect(fileViewerProvider).not.toContain(staleHeaderContract);
    }
    expect(fileViewerSidebar).not.toContain(
      "elementRegistry.registerSidebarGapElement",
    );
    expect(fileViewerSidebar).not.toContain(
      "elementRegistry.registerSidebarElement",
    );
    expect(fileViewerSidebarController).toContain(
      "elementRegistry.registerSidebarGapElement",
    );
    expect(fileViewerSidebarController).toContain(
      "elementRegistry.registerSidebarElement",
    );
    expect(fileViewerBody).not.toContain(
      "elementRegistry.registerDocumentViewportElement",
    );
    expect(fileViewerBody).not.toContain("motionKernel.setSidebar");
    expect(fileViewerSidebarController).toContain("declaredWidthPixels");
    expect(fileViewerSidebarController).toContain("useStableCssLength");
    expect(fileViewerSidebarController).toContain(
      "useStableElementSize<HTMLElement>",
    );
    expect(fileViewerBody).not.toContain("declaredWidthPixels");
    expect(fileViewerBody).not.toContain("useStableCssLength");
    expect(fileViewerBody).not.toContain("useStableElementSize<HTMLElement>");
    expect(fileViewerBody).not.toContain("resolveFileViewerCssLength");
    expect(fileViewerBody).not.toContain("readFileViewerElementInlineSize");
    expect(fileViewerBody).not.toContain("ResizeObserverConstructor");
    expect(fileViewerBody).not.toContain("getBoundingClientRect");
    expect(fileViewerBody).not.toContain("clientWidth");
    expect(fileViewerBody).not.toContain(
      "getFileViewerSidebarPanelMotionStyle",
    );
    expect(fileViewerBody).not.toContain("panelMotionStyle");
    expect(fileViewerBody).not.toContain("--file-viewer-viewport-width");
    expect(fileViewerBody).not.toContain("--file-viewer-viewport-height");
    expect(fileViewerBody).not.toContain("transitionProperty: isInline");
    expect(fileViewerContext).toContain("FileViewerSidebarDynamicContextValue");
    expect(fileViewerContext).not.toContain("file-viewer-state-machine");
    expect(fileViewerContext).not.toContain("isSidebarVisible");
    expect(fileViewerContext).toContain(
      "elementRegistry: FileViewerElementRegistry",
    );
    expect(fileViewerContext).not.toContain("accessibilityOpen");
    expect(fileViewerContext).not.toContain("accessibilityState");
    expect(fileViewerFrameController).not.toContain("accessibilityOpen");
    expect(fileViewerFrameController).not.toContain("accessibilityState");
    expect(fileViewerElements).toContain("FileViewerElementRegistry");
    expect(fileViewerElements).toContain("registerViewerShellElement");
    expect(fileViewerElements).toContain("registerDocumentSurface");
    expect(fileViewerElements).toContain("registerSidebarElement");
    expect(fileViewerElements).toContain("registerSidebarGapElement");
    expect(fileViewerElements).toContain("registerSidebarTriggerElement");
    for (const deadElementContract of [
      "documentViewportElement",
      "viewerControlsElement",
      "viewerOverlayElement",
      "registerDocumentViewportElement",
      "registerViewerControlsElement",
      "registerViewerOverlayElement",
    ]) {
      expect(fileViewerElements).not.toContain(deadElementContract);
      expect(fileViewerBody).not.toContain(deadElementContract);
    }
    expect(fileViewerMotionKernel).toContain("createFileViewerMotionKernel");
    expect(fileViewerMotionKernel).toContain("createFileViewerMotionPlan");
    expect(fileViewerMotionPlan).toContain("createFileViewerMotionPlan");
    expect(fileViewerMotionPlan).toContain("fromInlineSize");
    expect(fileViewerMotionPlan).toContain("shellInlineSize");
    expect(fileViewerMotionPlan).not.toContain("React.");
    expect(fileViewerRuntime).toContain("shellInlineSize");
    expect(fileViewerRuntime).not.toContain("bodyInlineSize");
    expect(fileViewerMotionKernel).not.toContain("getComputedStyle");
    expect(fileViewerMotionKernel).not.toContain("getBoundingClientRect");
    expect(fileViewerMotionKernel).not.toContain("document.createElement");
    expect(fileViewerMotionKernel).not.toContain("resolveFileViewerCssLength");
    expect(fileViewerMotionKernel).not.toContain("cssTransition");
    expect(fileViewerMotionKernel).toContain("fromInlineSize");
    expect(fileViewerMotionKernel).toContain("toInlineSize");
    expect(fileViewerMotionKernel).not.toContain(
      "transactionFromDocumentInlineSize",
    );
    expect(fileViewerMotionKernel).not.toContain(
      "transactionToDocumentInlineSize",
    );
    expect(fileViewerMotionKernel).toContain("setSidebarGapElement");
    expect(fileViewerMotionKernel).toContain("setDocumentSurface");
    expect(fileViewerMotionKernel).not.toContain("setSidebarPanelElement");
    expect(fileViewerMotionKernel).toContain("writeSidebarGapStyle");
    expect(fileViewerMotionKernel).toContain("writeDocumentSurfaceStyle");
    expect(fileViewerMotionKernel).not.toContain("writeSidebarPanelStyle");
    expect(fileViewerMotionKernel).toContain("sidebarGapElement.style.width");
    expect(fileViewerMotionKernel).toContain("element.style.transform");
    expect(fileViewerMotionKernel).not.toContain(
      '"--file-viewer-sidebar-inline-size"',
    );
    expect(fileViewerMotionKernel).toContain("startMotion");
    expect(fileViewerMotionKernel).toContain("prefers-reduced-motion");
    expect(fileViewerMotionKernel).not.toContain("publishSettledTarget");
    expect(fileViewerMotionKernel).not.toContain("setTimeout(settle");
    expect(fileViewerMotionKernel).not.toContain(
      '"--file-viewer-document-inline-size"',
    );
    expect(fileViewerMotionKernel).not.toContain(
      '"--file-viewer-document-visual-scale"',
    );
    expect(fileViewerMotionKernel).not.toContain(
      '"--file-viewer-motion-progress"',
    );
    expect(fileViewerRendererContract).toContain("FileViewerRendererFrame");
    expect(fileViewerRendererContract).toContain(
      "createFileViewerRendererFrame",
    );
    expect(fileViewerRendererContract).toContain("rasterInlineSize");
    expect(fileViewerRendererContract).toContain("fromInlineSize");
    expect(fileViewerBody).not.toContain("<ViewerBody");
    expect(fileViewerBody).not.toContain("<ViewerSurface");
    expect(fileViewerBody).toContain("const FileViewerInsetContext");
    expect(fileViewerBody).toContain(
      "FileViewerViewport must be rendered inside FileViewerInset.",
    );
    expect(fileViewerBody).not.toContain("export function FileViewerSurface");
    expect(fileViewerBody).not.toContain(
      "export function FileViewerDocumentFrame",
    );
    expect(fileViewerBody).toContain("FileViewerSidebarRail");
    expect(fileViewerBody).toContain("file-viewer-sidebar-rail");
    expect(fileViewerBody).toContain("sidebar-rail");
    expect(fileViewerBody).toContain("toggleSidebarRequestedOpen");
    const fileViewerSidebarStateType =
      fileViewerContext.match(
        /export type FileViewerSidebarStateValue = \{[\s\S]*?\};/,
      )?.[0] ?? "";
    expect(fileViewerSidebarStateType).not.toContain("setOpen:");
    expect(fileViewerSidebarStateType).not.toContain("toggleSidebar:");
    expect(fileViewerSidebarStateType).not.toContain("open: boolean");
    expect(fileViewerSidebarStateType).not.toContain(
      "state: FileViewerSidebarState",
    );
    expect(fileViewerContext).toContain("sidebarState");
    expect(fileViewerContext).not.toContain("requestSidebarClose");
    expect(fileViewerContext).toContain("setSidebarRequestedOpen");
    expect(fileViewerEntrypoint).not.toContain("FileViewerSurface");
    expect(fileViewerEntrypoint).not.toContain("FileViewerDocumentFrameProps");
    expect(fileViewerEntrypoint).toContain("FileViewerSidebarRail");
    expect(fileViewerEntrypoint).toContain("FileViewerHeader");
    for (const dottedPart of [
      "Root",
      "Header",
      "Toolbar",
      "Document",
      "Sidebar",
    ]) {
      expect(fileViewerEntrypoint).not.toContain(`FileViewer.${dottedPart}`);
    }
    expect(fileViewerEntrypoint).not.toContain("FileHeader");
    expect(fileViewerPreview).toContain("<FileViewerContent");
    expect(fileViewerPreview).toContain("<FileViewerInset");
    expect(fileViewerPreview).toContain("<FileViewerViewport");
    expect(fileViewerPreview).toContain("<FileViewerDocument");

    const pdfTypeFiles = [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/pdf-viewer-types.ts",
    ];
    const forbiddenPdfPropPatterns = [
      /\bthumbnails\??:/,
      /\bsidebar\??:/,
      /\banchoredItems\??:/,
      /\bsourceMap\??:/,
      /\brenderThumbnail\??:/,
    ];

    for (const file of pdfTypeFiles) {
      const content = fileContent(file);
      for (const pattern of forbiddenPdfPropPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(
          false,
        );
      }
    }
  });

  it("keeps FileViewer DOM reads and writes in internal contracts", () => {
    const allowedDomContractFiles = new Set([
      "registry/new-york-v4/ui/file-viewer-accessibility.ts",
      "registry/new-york-v4/ui/file-viewer-frame-keyboard.ts",
      "registry/new-york-v4/ui/file-viewer-keyboard.ts",
      "registry/new-york-v4/ui/file-viewer-motion-kernel.ts",
    ]);
    const domContractPattern =
      /\b(?:querySelector|getBoundingClientRect|clientWidth|clientHeight|scrollWidth|scrollHeight|ownerDocument|activeElement)\b|globalThis\.document|window\.document|\.contains\(|\.focus\(|\.style\.|\.setAttribute\(|\.removeAttribute\(|\.inert\b|\.scrollTop\b|\.scrollTo\(/;
    const violations = sourceFilesUnder(
      join(repoRoot, "registry/new-york-v4/ui"),
    )
      .filter((file) => /\/file-viewer/.test(file))
      .filter((file) => !allowedDomContractFiles.has(file))
      .filter((file) => domContractPattern.test(fileContent(file)));

    expect(violations).toEqual([]);
  });

  it("keeps document viewer controls on the shared ViewerControls primitive", () => {
    const registry = readJson<Registry>("registry.json");
    const viewerControlsItem = registry.items.find(
      (item) => item.name === "viewer-controls",
    );
    const viewerToolbarItem = registry.items.find(
      (item) => item.name === "viewer-toolbar",
    );
    const migratedViewerItems = [
      "pdf-viewer",
      "docx-viewer",
      "image-viewer",
      "pptx-viewer",
      "xlsx-viewer",
      "csv-viewer",
      "code-viewer",
      "text-viewer",
    ];
    const removedToolbarFiles = [
      "registry/new-york-v4/ui/viewer-toolbar.tsx",
      "registry/new-york-v4/ui/pdf-viewer-toolbar.tsx",
      "registry/new-york-v4/ui/pptx-viewer-toolbar.tsx",
      "registry/new-york-v4/ui/xlsx-toolbar.tsx",
      "registry/new-york-v4/ui/csv-viewer-toolbar.tsx",
      "components/ui/viewer-toolbar.tsx",
      "components/ui/pdf-viewer-toolbar.tsx",
      "components/ui/pptx-viewer-toolbar.tsx",
      "components/ui/xlsx-toolbar.tsx",
      "components/ui/csv-viewer-toolbar.tsx",
      "components/viewers/page-markdown/page-markdown-toolbar.tsx",
      "components/viewers/edit/edit-viewer-toolbar.tsx",
    ];
    const migratedSourceFiles = [
      "registry/new-york-v4/ui/pdf-viewer-content.tsx",
      "registry/new-york-v4/ui/docx-viewer-content.tsx",
      "registry/new-york-v4/ui/image-viewer-content.tsx",
      "registry/new-york-v4/ui/pptx-viewer.tsx",
      "registry/new-york-v4/ui/xlsx-viewer-session.tsx",
      "registry/new-york-v4/ui/csv-viewer-chrome.tsx",
      "registry/new-york-v4/ui/code-viewer-chrome.tsx",
      "registry/new-york-v4/ui/text-viewer-chrome.tsx",
      "registry/new-york-v4/ui/markdown-greenfield-content.tsx",
      "components/viewers/page-markdown/page-markdown-controls.tsx",
    ];
    const forbiddenNames = [
      "ViewerToolbar",
      "PdfViewerToolbar",
      "PptxToolbar",
      "XlsxToolbar",
      "CsvViewerToolbar",
      "DocxViewerToolbar",
      "ImageViewerToolbar",
      "CodeViewerToolbar",
      "TextViewerToolbar",
      "TextCodeViewerToolbarFrame",
      "TextCodeViewerZoomToolbar",
      "TextCodeViewerIconButton",
      "ToolbarIconButton",
    ];

    expect(viewerControlsItem).toBeTruthy();
    expect(viewerToolbarItem).toBeFalsy();
    expect(viewerControlsItem?.files.map((file) => file.path)).toContain(
      "registry/new-york-v4/ui/viewer-controls.tsx",
    );

    for (const itemName of migratedViewerItems) {
      const item = registry.items.find((entry) => entry.name === itemName);
      const registryDependencies = (item?.registryDependencies ?? []).map(
        registryDependencyItemName,
      );
      expect(registryDependencies).toContain("viewer-controls");
      expect(registryDependencies).not.toContain("viewer-toolbar");
      expect(item?.files.map((file) => file.path) ?? []).not.toEqual(
        expect.arrayContaining(removedToolbarFiles),
      );
    }

    for (const file of removedToolbarFiles) {
      expect(existsSync(join(repoRoot, file)), `${file} still exists`).toBe(
        false,
      );
    }

    for (const file of migratedSourceFiles) {
      const content = fileContent(file);
      expect(content, `${file} uses ViewerControls`).toContain(
        "ViewerControls",
      );
      expect(content, `${file} imports old viewer-toolbar`).not.toContain(
        "viewer-toolbar",
      );
      for (const forbiddenName of forbiddenNames) {
        expect(content, `${file} contains ${forbiddenName}`).not.toContain(
          forbiddenName,
        );
      }
    }
  });

  it("keeps public viewer visibility props named controls, not toolbar", () => {
    const propFiles = [
      "registry/new-york-v4/ui/code-viewer-types.ts",
      "registry/new-york-v4/ui/csv-viewer-types.ts",
      "registry/new-york-v4/ui/docx-viewer-types.ts",
      "registry/new-york-v4/ui/image-viewer-types.ts",
      "registry/new-york-v4/ui/pdf-viewer-content.tsx",
      "registry/new-york-v4/ui/pptx-viewer-types.ts",
      "registry/new-york-v4/ui/text-viewer-types.ts",
      "registry/new-york-v4/ui/xlsx-viewer-types.ts",
    ];
    const sourceFiles = [
      "registry/new-york-v4/ui/code-viewer-content.tsx",
      "registry/new-york-v4/ui/csv-viewer.tsx",
      "registry/new-york-v4/ui/docx-viewer.tsx",
      "registry/new-york-v4/ui/image-viewer.tsx",
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/plain-text-viewer-frame.tsx",
      "registry/new-york-v4/ui/pptx-viewer.tsx",
      "registry/new-york-v4/ui/markdown-greenfield-content.tsx",
      "registry/new-york-v4/ui/text-viewer-content.tsx",
      "registry/new-york-v4/ui/text-viewer-chenglou-content.tsx",
      "registry/new-york-v4/ui/xlsx-viewer.tsx",
    ];

    for (const file of propFiles) {
      const content = fileContent(file);
      expect(content, `${file} exposes controls?: boolean`).toContain(
        "controls?: boolean",
      );
      expect(content, `${file} exposes toolbar?: boolean`).not.toContain(
        "toolbar?: boolean",
      );
    }

    for (const file of sourceFiles) {
      const content = fileContent(file);
      expect(content, `${file} still reads props.toolbar`).not.toContain(
        "props.toolbar",
      );
      expect(content, `${file} still destructures toolbar`).not.toMatch(
        /\btoolbar\s*=/,
      );
      expect(content, `${file} still passes toolbar as JSX`).not.toMatch(
        /\btoolbar=/,
      );
    }
  });

  it("keeps FileViewer DOM discovery and motion writes centralized", () => {
    const fileViewerRuntimeFiles = [
      "registry/new-york-v4/ui/file-viewer-accessibility.ts",
      "registry/new-york-v4/ui/file-viewer-content.tsx",
      "registry/new-york-v4/ui/file-viewer-context.tsx",
      "registry/new-york-v4/ui/file-viewer-document.tsx",
      "registry/new-york-v4/ui/file-viewer-elements.ts",
      "registry/new-york-v4/ui/file-viewer-frame.tsx",
      "registry/new-york-v4/ui/file-viewer-frame-controller.ts",
      "registry/new-york-v4/ui/file-viewer-frame-keyboard.ts",
      "registry/new-york-v4/ui/file-viewer-header.tsx",
      "registry/new-york-v4/ui/file-viewer-keyboard.ts",
      "registry/new-york-v4/ui/file-viewer-motion-kernel.ts",
      "registry/new-york-v4/ui/file-viewer-renderer-contract.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-controller.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-open-state.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-registration.ts",
      "registry/new-york-v4/ui/file-viewer-motion-plan.ts",
    ];
    const filesWithoutLayoutReads = [
      "registry/new-york-v4/ui/file-viewer-content.tsx",
      "registry/new-york-v4/ui/file-viewer-accessibility.ts",
      "registry/new-york-v4/ui/file-viewer-context.tsx",
      "registry/new-york-v4/ui/file-viewer-document.tsx",
      "registry/new-york-v4/ui/file-viewer-elements.ts",
      "registry/new-york-v4/ui/file-viewer-frame.tsx",
      "registry/new-york-v4/ui/file-viewer-frame-controller.ts",
      "registry/new-york-v4/ui/file-viewer-frame-keyboard.ts",
      "registry/new-york-v4/ui/file-viewer-header.tsx",
      "registry/new-york-v4/ui/file-viewer-keyboard.ts",
      "registry/new-york-v4/ui/file-viewer-renderer-contract.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-controller.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-open-state.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-registration.ts",
      "registry/new-york-v4/ui/file-viewer-motion-plan.ts",
    ];
    const elementRegistry = fileContent(
      "registry/new-york-v4/ui/file-viewer-elements.ts",
    );
    const frame = fileContent(
      "registry/new-york-v4/ui/file-viewer-frame-controller.ts",
    );
    const motionWriteOwner = fileContent(
      "registry/new-york-v4/ui/file-viewer-motion-kernel.ts",
    );
    const body = fileContent("registry/new-york-v4/ui/file-viewer-content.tsx");
    const pdfPagesLayer = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-pages-layer.tsx",
    );

    for (const file of fileViewerRuntimeFiles) {
      const content = fileContent(file);
      expect(content, `${file} uses querySelector`).not.toContain(
        "querySelector",
      );
      expect(content, `${file} uses closest`).not.toContain(".closest(");
    }

    for (const file of filesWithoutLayoutReads) {
      const content = fileContent(file);
      expect(content, `${file} reads layout`).not.toMatch(
        /\b(?:getBoundingClientRect|offsetWidth|clientWidth|scrollWidth|getComputedStyle)\b/,
      );
      expect(content, `${file} observes layout`).not.toContain(
        "ResizeObserver",
      );
    }

    expect(motionWriteOwner).toContain("sidebarGapElement.style.width");
    expect(motionWriteOwner).toContain("element.style.transform");
    expect(motionWriteOwner).not.toContain("sidebarPanelElement");
    expect(elementRegistry).toContain("motionKernel.setSidebarGapElement");
    expect(elementRegistry).toContain("motionKernel.setDocumentSurface");
    expect(elementRegistry).not.toContain("setSidebarPanelElement");
    expect(frame).not.toContain("motionKernel.setDocumentSurfaceElement");
    expect(frame).not.toContain("motionKernel.setSidebarGapElement");
    expect(body).not.toContain(".style.transform");
    expect(body).not.toContain(".style.willChange");
    expect(body).not.toContain("motionKernel.setSidebar");
    expect(pdfPagesLayer).toContain("useOptionalFileViewerRendererEnvironment");
    expect(pdfPagesLayer).toContain("setDocumentSurfaceElement");
    expect(pdfPagesLayer).not.toContain("file-viewer-context");
    expect(pdfPagesLayer).not.toContain("fileViewerMotionKernel");
    expect(pdfPagesLayer).not.toContain("transform: documentTransform");
    expect(pdfPagesLayer).not.toContain('willChange: "transform"');
  });

  it("routes FileViewer sidebar commands through the frame controller", () => {
    const context = fileContent(
      "registry/new-york-v4/ui/file-viewer-context.tsx",
    );
    const frame = fileContent(
      "registry/new-york-v4/ui/file-viewer-frame-controller.ts",
    );
    const openState = fileContent(
      "registry/new-york-v4/ui/file-viewer-sidebar-open-state.ts",
    );
    const header = fileContent(
      "registry/new-york-v4/ui/file-viewer-header.tsx",
    );

    expect(context).toContain("setSidebarRequestedOpen");
    expect(context).not.toContain("requestSidebarOpen");
    expect(context).not.toContain("requestSidebarClose");
    expect(context).toContain("toggleSidebarRequestedOpen");
    expect(context).not.toContain("commandBus");
    expect(frame).toContain("setSidebarRequestedOpen");
    expect(frame).not.toContain("commandBus");
    expect(openState).toContain("onOpenChange?.(nextIsSidebarRequestedOpen)");
    expect(frame).toContain("motionKernel.syncTarget(motionTarget)");
    expect(frame).not.toContain("[context.sidebarOpenProps");
    expect(frame).not.toContain("const toggleSidebar = React.useCallback");
    expect(header).toContain("toggleSidebarRequestedOpen()");
    expect(header).not.toContain("commandBus");
    expect(header).not.toContain("toggleSidebar();");
  });

  it("routes FileViewer sidebar accessibility through the coordinator", () => {
    const accessibility = fileContent(
      "registry/new-york-v4/ui/file-viewer-accessibility.ts",
    );
    const sidebar = fileContent(
      "registry/new-york-v4/ui/file-viewer-sidebar.tsx",
    );
    const sidebarController = fileContent(
      "registry/new-york-v4/ui/file-viewer-sidebar-controller.ts",
    );
    const frameController = fileContent(
      "registry/new-york-v4/ui/file-viewer-frame-controller.ts",
    );
    const header = fileContent(
      "registry/new-york-v4/ui/file-viewer-header.tsx",
    );

    expect(accessibility).toContain("FileViewerSidebarAccessibilityProps");
    expect(accessibility).toContain(
      "FileViewerSidebarTriggerAccessibilityProps",
    );
    expect(accessibility).toContain("restoreFileViewerSidebarFocusOnClose");
    expect(sidebar).toContain("useFileViewerSidebarController");
    expect(sidebar).not.toContain("resolveFileViewerSidebarAccessibilityProps");
    expect(sidebar).not.toContain("restoreFileViewerSidebarFocusOnClose");
    expect(sidebarController).toContain(
      "resolveFileViewerSidebarAccessibilityProps",
    );
    expect(sidebarController).not.toContain(
      "restoreFileViewerSidebarFocusOnClose",
    );
    expect(frameController).toContain("restoreFileViewerSidebarFocusOnClose");
    expect(header).toContain(
      "resolveFileViewerSidebarTriggerAccessibilityProps",
    );
    expect(header).toContain("elementRegistry.registerSidebarTriggerElement");
    expect(sidebar).not.toContain('"aria-hidden": true');
    expect(sidebar).not.toContain("inert: true");
    expect(header).not.toContain("aria-controls={canToggleSidebar");
    expect(header).not.toContain("aria-expanded={canToggleSidebar");
  });

  it("keeps FileViewer registry installs wired to Markdown", () => {
    const registry = readJson<Registry>("registry.json");
    const fileViewerItem = registry.items.find(
      (item) => item.name === "file-viewer",
    );
    const publicFileViewerItem = readJson<RegistryItem>(
      "public/r/file-viewer.json",
    );
    const fileViewerSource = fileContent(
      "registry/new-york-v4/ui/file-viewer.tsx",
    );
    const routeFileViewerSource = fileContent(
      "registry/new-york-v4/ui/file-viewer-route.tsx",
    );
    const publicFileViewerSource =
      publicFileViewerItem.files.find(
        (file) => file.path === "registry/new-york-v4/ui/file-viewer.tsx",
      )?.content ?? "";
    const publicRouteFileViewerSource =
      publicFileViewerItem.files.find(
        (file) => file.path === "registry/new-york-v4/ui/file-viewer-route.tsx",
      )?.content ?? "";
    const listedPaths = (fileViewerItem?.files ?? []).map((file) => file.path);
    const requiredSplitFiles = [
      "registry/new-york-v4/ui/file-viewer.tsx",
      "registry/new-york-v4/ui/file-viewer-accessibility.ts",
      "registry/new-york-v4/ui/file-viewer-content.tsx",
      "registry/new-york-v4/ui/file-viewer-context.tsx",
      "registry/new-york-v4/ui/file-viewer-document.tsx",
      "registry/new-york-v4/ui/file-viewer-elements.ts",
      "registry/new-york-v4/ui/file-viewer-frame.tsx",
      "registry/new-york-v4/ui/file-viewer-header.tsx",
      "registry/new-york-v4/ui/file-viewer-keyboard.ts",
      "registry/new-york-v4/ui/file-viewer-motion-kernel.ts",
      "registry/new-york-v4/ui/file-viewer-preview.tsx",
      "registry/new-york-v4/ui/file-viewer-provider.tsx",
      "registry/new-york-v4/ui/file-viewer-renderer-contract.ts",
      "registry/new-york-v4/ui/file-viewer-resource-state.ts",
      "registry/new-york-v4/ui/file-viewer-route.tsx",
      "registry/new-york-v4/ui/file-viewer-state.tsx",
      "registry/new-york-v4/ui/file-viewer-sidebar-controller.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-open-state.ts",
      "registry/new-york-v4/ui/file-viewer-sidebar-registration.ts",
      "registry/new-york-v4/ui/file-viewer-motion-plan.ts",
      "registry/new-york-v4/ui/viewer.tsx",
      "registry/new-york-v4/ui/viewer-root.tsx",
      "registry/new-york-v4/ui/viewer-body.tsx",
      "registry/new-york-v4/ui/viewer-chrome.tsx",
      "registry/new-york-v4/ui/viewer-sidebar.tsx",
      "registry/new-york-v4/ui/viewer-surface.tsx",
      "registry/new-york-v4/ui/viewer-types.ts",
    ];

    expect(fileViewerItem).toBeTruthy();
    expect(listedPaths).toEqual(expect.arrayContaining(requiredSplitFiles));
    expect(listedPaths).not.toContain(
      "registry/new-york-v4/ui/file-viewer-internal.tsx",
    );
    expect(fileViewerItem?.registryDependencies ?? []).toContain(
      "@retab/markdown-viewer",
    );
    expect(fileViewerItem?.registryDependencies ?? []).not.toContain(
      "@retab/markdown-document-viewer",
    );
    expect(publicFileViewerItem.registryDependencies ?? []).toContain(
      "@retab/markdown-viewer",
    );
    expect(publicFileViewerItem.registryDependencies ?? []).not.toContain(
      "@retab/markdown-document-viewer",
    );
    expect(fileViewerSource).not.toContain(
      'import("@/components/ui/markdown-viewer")',
    );
    expect(routeFileViewerSource).toContain(
      'import("@/components/ui/markdown-viewer")',
    );
    expect(publicFileViewerSource).not.toContain(
      'import("@/components/ui/markdown-viewer")',
    );
    expect(publicRouteFileViewerSource).toContain(
      'import("@/components/ui/markdown-viewer")',
    );
    expect(fileViewerSource).toMatch(
      /export {[\s\S]*FileViewerProvider[\s\S]*} from "\.\/file-viewer-provider"/,
    );
    expect(fileViewerSource).toMatch(
      /export {[\s\S]*FileViewerPreview[\s\S]*} from "\.\/file-viewer-preview"/,
    );
    expect(fileViewerSource).not.toContain("file-viewer-internal");
    expect(publicFileViewerSource).not.toContain("file-viewer-internal");
  });

  it("keeps FileViewer document chrome ownership explicit", () => {
    const fileViewerSource = fileContent(
      "registry/new-york-v4/ui/file-viewer.tsx",
    );
    const documentFileViewerSource = fileContent(
      "registry/new-york-v4/ui/file-viewer-document.tsx",
    );
    const routeFileViewerSource = fileContent(
      "registry/new-york-v4/ui/file-viewer-route.tsx",
    );
    const downloadPropFiles = [
      "registry/new-york-v4/ui/docx-viewer-types.ts",
      "registry/new-york-v4/ui/image-viewer-types.ts",
      "registry/new-york-v4/ui/pptx-viewer-types.ts",
      "registry/new-york-v4/ui/xlsx-viewer-types.ts",
    ];

    for (const source of [
      fileViewerSource,
      documentFileViewerSource,
      routeFileViewerSource,
    ]) {
      expect(source).not.toContain("showLeafDownload");
      expect(source).not.toContain("showLeafControls");
      expect(source).not.toContain("leafDownload");
      expect(source).not.toContain("leafControls");
    }

    expect(fileViewerSource).toContain('from "./file-viewer-document"');
    expect(fileViewerSource).not.toContain("<FileViewerDocument bare");
    expect(documentFileViewerSource).toContain(
      "export type FileViewerDocumentProps = {",
    );
    expect(documentFileViewerSource).toContain("className?: string");
    expect(documentFileViewerSource).toContain("controls?: boolean");
    expect(documentFileViewerSource).toContain(
      "FileViewerDocument must be rendered inside FileViewerViewport.",
    );
    expect(documentFileViewerSource).not.toContain('"bare" | "className"');
    expect(documentFileViewerSource).not.toContain(
      "export function FileViewerDocument({ bare",
    );
    expect(
      fileContent("registry/new-york-v4/ui/file-viewer-core.ts"),
    ).not.toContain("FileViewerControlsPlacement");
    // Chrome is derived from explicit frame/control props,
    // not assembled into per-call chrome structs.
    expect(routeFileViewerSource).toContain('const bare = frame === "none"');
    expect(routeFileViewerSource).toContain("controls: boolean");
    expect(routeFileViewerSource).not.toContain("localControls");
    expect(routeFileViewerSource).not.toContain("fileViewerRouteChrome");
    expect(routeFileViewerSource).not.toContain("rendererChrome");
    expect(routeFileViewerSource).not.toContain("localChrome");
    expect(routeFileViewerSource).not.toContain("fallbackChrome");
    expect(routeFileViewerSource).not.toContain("rendererDownload");
    expect(routeFileViewerSource).not.toContain("fallbackDownload");

    const expectEveryRouteOpeningContains = (
      component: string,
      value: string,
    ) => {
      const openings = Array.from(
        routeFileViewerSource.matchAll(
          new RegExp(`<${component}\\b(?:(?!/>)[\\s\\S])*?/>`, "g"),
        ),
      );

      expect(openings.length, `${component} route count`).toBeGreaterThan(0);
      for (const opening of openings) {
        expect(opening[0], `${component} receives ${value}`).toContain(value);
      }
    };

    const expectEveryRouteOpeningExcludes = (
      component: string,
      value: string,
    ) => {
      const openings = Array.from(
        routeFileViewerSource.matchAll(
          new RegExp(`<${component}\\b(?:(?!/>)[\\s\\S])*?/>`, "g"),
        ),
      );

      expect(openings.length, `${component} route count`).toBeGreaterThan(0);
      for (const opening of openings) {
        expect(opening[0], `${component} omits ${value}`).not.toContain(value);
      }
    };

    // Renderer-chrome leaves receive both the controls flag and the download
    // affordance (a bare `download` prop).
    for (const route of [
      "PdfResourceContent",
      "ImageResourceContent",
      "PptxResourceContent",
      "DocxResourceContent",
      "XlsxResourceContent",
      "MarkdownViewer",
      "ProseTextViewer",
      "CodeTextViewer",
    ]) {
      expectEveryRouteOpeningContains(route, "controls={controls}");
      expectEveryRouteOpeningContains(route, "download");
    }
    // Local-chrome leaves receive controls but own their own download chrome,
    // so the route never passes them a download prop.
    for (const route of ["CsvFileContent", "HtmlFileContent"]) {
      expectEveryRouteOpeningContains(route, "controls={controls}");
      expectEveryRouteOpeningExcludes(route, "download");
    }
    // The unsupported fallback exposes download only in standalone chrome.
    expectEveryRouteOpeningContains(
      "UnsupportedCard",
      "showDownload={controls}",
    );

    expect(
      fileContent("registry/new-york-v4/ui/pdf-viewer-content.tsx"),
    ).toContain("download?: boolean");
    for (const file of downloadPropFiles) {
      const content = fileContent(file);
      expect(content, `${file} exposes a renderer download control`).toContain(
        "download?: boolean",
      );
    }

    for (const file of [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/docx-viewer-content.tsx",
      "registry/new-york-v4/ui/image-viewer-content.tsx",
      "registry/new-york-v4/ui/pptx-viewer.tsx",
      "registry/new-york-v4/ui/xlsx-viewer-session.tsx",
    ]) {
      const content = fileContent(file);
      expect(content, `${file} defaults renderer download on`).toContain(
        "download = true",
      );
    }

    for (const file of [
      "registry/new-york-v4/ui/pdf-viewer-content.tsx",
      "registry/new-york-v4/ui/docx-viewer.tsx",
      "registry/new-york-v4/ui/image-viewer.tsx",
      "registry/new-york-v4/ui/pptx-viewer.tsx",
      "registry/new-york-v4/ui/xlsx-viewer.tsx",
    ]) {
      const content = fileContent(file);
      expect(content, `${file} suppresses error-boundary download`).toContain(
        "props.controls === false || props.download === false",
      );
    }
    expect(fileContent("registry/new-york-v4/ui/csv-viewer.tsx")).toContain(
      "showDownload: controls",
    );
    expect(
      fileContent("registry/new-york-v4/ui/csv-viewer-chrome.tsx"),
    ).toContain("download={showDownload ? resource?.originalDownload : null}");
    expect(fileContent("components/ui/pptx-viewer.tsx")).toContain(
      'export * from "@/registry/new-york-v4/ui/pptx-viewer"',
    );
    expect(fileContent("components/ui/csv-viewer-chrome.tsx")).toContain(
      'export * from "@/registry/new-york-v4/ui/csv-viewer-chrome"',
    );
  });

  it("keeps dropzone examples away from file viewer internals", () => {
    const dropzoneFiles = [
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
      "registry/new-york-v4/blocks/dropzone-trigger-examples.tsx",
    ];
    const forbiddenPatterns = [
      /file-viewer-core/,
      /file-viewer-fallback/,
      /viewer-zoom/,
      /ResourceDocShell/,
      /PdfViewerPages/,
      /PdfViewerProvider/,
    ];

    for (const file of dropzoneFiles) {
      const content = fileContent(file);
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(
          false,
        );
      }
    }
  });

  it("keeps the removed anchored provider out of the registry", () => {
    const registry = readJson<Registry>("registry.json");
    const itemNames = registry.items.map((item) => item.name);

    expect(itemNames).not.toContain("anchored-document-viewer");
    expect(itemNames).not.toContain("pdf-anchor-target");
    expect(
      existsSync(
        join(repoRoot, "registry/new-york-v4/ui/anchored-document-viewer.tsx"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(repoRoot, "registry/new-york-v4/ui/pdf-anchor-target.tsx"),
      ),
    ).toBe(false);
  });

  it("keeps split viewer document composition explicit", () => {
    const content = fileContent("components/viewers/split/split-viewer.tsx");
    const viewportController = fileContent(
      "registry/new-york-v4/ui/use-segment-viewport-controller.ts",
    );
    const sharedRail = fileContent(
      "registry/new-york-v4/ui/segment-page-rail.tsx",
    );
    const registry = readJson<Registry>("registry.json");
    const itemsByName = new Map(
      registry.items.map((item) => [item.name, item]),
    );
    const splitItem = itemsByName.get("split-viewer-block");
    const segmentPageRailItem = itemsByName.get("segment-page-rail");

    expect(content).not.toContain("renderDocument");
    expect(content).not.toContain("children?: ReactNode");
    expect(content).toContain("document?: ReactNode");
    expect(content).toContain("<SplitViewerDocument document={document} />");
    expect(content).toContain("export type SplitViewerModel");
    expect(content).not.toContain("export type SplitViewerState");
    expect(content).toContain("export function createSplitViewerModel");
    expect(content).toContain("function createSplitSegmentedDocumentModel");
    expect(content).not.toContain(
      "export function createSplitSegmentedDocumentModel",
    );
    expect(content).toContain(
      "function useSplitViewerContext(): SplitViewerContextValue",
    );
    expect(content).not.toContain("export function useSplitViewer(");
    expect(content).not.toContain("export type SplitViewerContextValue");
    expect(content).not.toContain(
      "export function useSplitViewer(): SplitViewerContextValue",
    );
    expect(content).toContain("SegmentedDocumentProvider");
    expect(content).toContain("useSegmentedDocumentViewport");
    expect(content).toContain("model: SplitViewerModel");
    expect(content).toContain("viewport: SegmentViewportController");
    expect(content).toContain("segments: DocumentSegment[]");
    expect(content).not.toContain("SegmentedViewer");
    expect(content).not.toContain("useDomainSegmentedViewport");
    expect(content).not.toContain("useSegmentViewportController");
    expect(content).not.toContain("ReturnType<typeof toSegments>");
    expect(content).not.toContain("controller:");
    expect(content).not.toContain("setViewerHandle");
    expect(content).toContain("export function useSplitViewerDocumentControls");
    expect(content).toContain("function useSplitViewerHeader");
    expect(content).toContain("function useSplitViewerPageRail");
    expect(content).toContain("function useSplitViewerLegend");
    expect(content).toContain("function useSplitViewerDocument");
    expect(content).not.toContain("export function useSplitViewerHeader");
    expect(content).not.toContain("export function useSplitViewerPageRail");
    expect(content).not.toContain("export function useSplitViewerLegend");
    expect(content).not.toMatch(/\bexport function useSplitViewerDocument\(/);
    expect(content).not.toContain("export function SplitViewerRoot");
    expect(content).not.toContain("export function SplitViewerBody");
    expect(content).not.toContain("export function SplitViewerSurface");
    expect(content).toContain("export function SplitViewerSidebar");
    expect(content).toContain("export function SplitViewerPageRail");
    expect(content).toContain("export function SplitViewerLegend");
    expect(content).toContain("export function SplitViewerDocument");
    expect(content).toContain("export function SplitViewerEmptyState");
    expect(content).toContain("@/components/ui/segment-page-rail");
    expect(content).not.toContain("./segment-page-rail");
    expect(content).toContain("useSplitViewerHeader()");
    expect(content).toContain("useSplitViewerPageRail()");
    expect(content).toContain("useSplitViewerLegend()");
    expect(content).toContain("useSplitViewerDocument()");
    expect(viewportController).toContain("export type SegmentDocumentHandle");
    expect(viewportController).toContain("scrollToAnchor");
    expect(viewportController).toContain(
      "export type SegmentedDocumentViewport",
    );
    expect(viewportController).toContain("setDocumentHandle");
    expect(viewportController).not.toContain("PdfViewerHandle");
    expect(viewportController).not.toContain("setViewerHandle");
    expect(sharedRail).toContain("export function SegmentPageRail");
    expect(sharedRail).not.toContain("components/viewers/split");
    expect(segmentPageRailItem?.registryDependencies ?? []).toEqual([
      "@retab/segments",
      "@retab/segment-interaction",
      "@retab/page-ribbon",
      "@retab/utils",
    ]);
    expect(splitItem?.registryDependencies ?? []).toContain(
      "@retab/segment-page-rail",
    );
    expect(splitItem?.registryDependencies ?? []).toContain(
      "@retab/segmented-document",
    );
    expect(splitItem?.registryDependencies ?? []).not.toContain(
      "@retab/page-ribbon",
    );
    expect(splitItem?.files.map((file) => file.path) ?? []).not.toContain(
      "components/viewers/segmented-document/use-segment-viewport-controller.ts",
    );
  });

  it("keeps segment primitives typed as semantic document segments", () => {
    for (const file of [
      "registry/new-york-v4/ui/segment-legend.tsx",
      "registry/new-york-v4/ui/segment-sidebar.tsx",
      "registry/new-york-v4/ui/segment-page-rail.tsx",
      "registry/new-york-v4/ui/page-ribbon.tsx",
    ]) {
      const content = fileContent(file);
      expect(content, `${file} imports DocumentSegment`).toContain(
        "DocumentSegment",
      );
      expect(content, `${file} does not expose Segment[] props`).not.toContain(
        "segments: Segment[]",
      );
      expect(
        content,
        `${file} does not expose Segment callbacks`,
      ).not.toContain("(segment: Segment)");
    }
  });

  it("keeps compound easy APIs as preassembled named-part composition", () => {
    const easyApis = [
      {
        file: "registry/new-york-v4/ui/pdf-viewer.tsx",
        symbols: [
          "<FileViewerProvider",
          "<FileViewer",
          "<PdfViewerProvider",
          "<FileViewerHeader",
          "<FileViewerTitle",
          "<FileViewerControls",
          "<FileViewerContent",
          "<FileViewerInset",
          "<FileViewerViewport",
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
          "<FileViewerProvider",
          "<FileViewer",
          "<SplitViewerFileHeader",
          "<FileViewerContent",
          "<SplitViewerSidebar",
          "<FileViewerInset",
          "<FileViewerLegend",
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
          "<FileViewerProvider",
          "<FileViewer",
          "<PartitionViewerFileHeader",
          "<FileViewerContent",
          "<FileViewerInset",
          "<FileViewerLegend",
          "<PartitionViewerLegend",
          "<PartitionViewerRibbon",
          "<PartitionViewerDocument",
        ],
      },
      {
        file: "components/viewers/classify/classifier-viewer.tsx",
        symbols: [
          "<ClassifierViewerProvider",
          "<ViewerRoot",
          "<ViewerBody",
          "<ViewerSurface",
          "<ClassifierViewerDocument",
        ],
      },
    ];

    for (const { file, symbols } of easyApis) {
      const content = fileContent(file);
      expectJsxTagsInOrder(file, symbols);
      expect(content, `${file} accepts slot object props`).not.toContain(
        "slots?:",
      );
      expect(content, `${file} accepts renderDocument`).not.toContain(
        "renderDocument",
      );
    }
  });

  it("uses root terminology for file-intake viewer composition", () => {
    const parts = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
    );
    const wrapper = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
    );

    expect(parts).toContain("FileIntakeViewerDropTarget");
    expect(parts).toContain("FileIntakeViewerRoot");
    expect(wrapper).toContain("FileIntakeViewerRoot");
    expect(wrapper).toContain("FileIntakeViewerDropTarget");
    expect(wrapper).toContain("export function FileIntakeViewer");
    expect(wrapper).not.toContain("DropzoneUploaderViewer");
    expect(parts).not.toContain("UploadableFileViewer");
    expect(wrapper).not.toContain("UploadableFileViewer");
    expect(parts).not.toContain("FileIntakeViewerFrame");
    expect(wrapper).not.toContain("FileIntakeViewerFrame");
  });

  it("keeps the file-intake viewer easy API preassembled", () => {
    const wrapper = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx",
    );
    const parts = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
    );

    expect(wrapper).not.toContain("renderViewer");
    expect(wrapper).toContain("<FileIntakeViewerDropTarget>");
    expect(wrapper).toContain("<FileIntakeViewerSurface />");
    expect(wrapper).not.toContain("DropzoneUploaderViewer");
    expect(parts).toContain("<FileViewer");
    expect(parts).not.toContain("renderViewer");
  });

  it("keeps file-intake viewer named parts on narrow hooks", () => {
    const content = fileContent(
      "registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx",
    );

    expect(content).toContain("function useFileIntakeViewerDropTarget");
    expect(content).not.toContain(
      "export function useFileIntakeViewerDropTarget",
    );
    expect(content).toContain(
      "function useFileIntakeViewerContext(): FileIntakeViewerContextValue",
    );
    expect(content).not.toContain("export function useFileIntakeViewer(");
    expect(content).toContain("function useFileIntakeViewerHeader");
    expect(content).toContain("function useFileIntakeViewerSidebar");
    expect(content).not.toContain("export function useFileIntakeViewerHeader");
    expect(content).not.toContain("export function useFileIntakeViewerSidebar");
    expect(content).toContain("export function useFileIntakeViewerSurface");
    expect(content).toContain("type FileIntakeViewerContextValue = {");
    expect(content).toContain("model: FileIntakeViewerModel");
    expect(content).toContain("actions: FileIntakeViewerActions");
    expect(content).toContain("type FileIntakeSummary");
    expect(content).not.toContain("export type FileIntakeSummary");
    expect(content).not.toContain("export type FileIntakeViewerState");
    expect(content).toContain("export type FileIntakeViewerRejection");
    expect(content).toContain("createFileIntakeViewerModel");
    expect(content).toContain("createFileIntakeSummary");
    expect(content).toContain("createFileIntakeViewerRejection");
    expect(content).toContain("getRootDropProps");
    expect(content).toContain("getFileInputProps");
    expect(content).toContain("getUploadButtonProps");
    // Upload and replace are one native-button trigger; the redundant second
    // getter is collapsed away. Guard the collapse so it cannot return.
    expect(content).not.toContain("getReplaceButtonProps");
    expect(content).toContain("getEmptySurfaceProps");
    expect(content).toContain("export function FileIntakeViewerDropTarget");
    expect(content).toContain("export function FileIntakeViewerRoot");
    expect(content).toContain("group-data-[dragging]/file-intake-drop");
    expect(content).not.toContain("dropzone: UseDropzoneReturn");
    expect(content).not.toContain("getRootProps: UseDropzoneReturn");
    expect(content).not.toContain("getInputProps: UseDropzoneReturn");
    expect(content).not.toContain("getButtonProps: UseDropzoneReturn");
    expect(content).not.toContain("getTriggerProps: UseDropzoneReturn");
    expect(content).not.toContain("openFileDialog: () => void");
    expect(content).not.toContain("canOpenFileDialog");
    expect(content).not.toContain("UploadableFileViewer");
    expect(content).not.toContain("UploadableFileSummary");
    expect(content).not.toContain("FileIntakeViewerSummary");
    expect(content).not.toContain("FileIntakeViewerContent");
    expect(content).not.toContain("export type FileIntakeViewerContextValue");
    expect(content).not.toContain(
      "export function useFileIntakeViewer(): FileIntakeViewerContextValue",
    );
    expect(content).toContain("useFileIntakeViewerSidebar()");
    expect(content).toContain("useFileIntakeViewerSurface()");
  });

  it("keeps email viewer named parts on narrow hooks", () => {
    const content = fileContent("registry/new-york-v4/ui/email-viewer.tsx");
    const model = fileContent("registry/new-york-v4/ui/email-viewer-model.ts");
    const types = fileContent("registry/new-york-v4/ui/email-viewer-types.ts");

    expect(content).toContain("function useEmailViewerHeaderState");
    expect(content).toContain("function useEmailViewerPartsSidebarState");
    expect(content).toContain("function useEmailViewerContentState");
    expect(content).toContain("export function EmailViewerHeader");
    expect(content).toContain("export function EmailViewerContent");
    expect(content).toContain("export function EmailViewerPartsSidebar");
    expect(content).not.toContain("export function useEmailHeader");
    expect(content).not.toContain("export function useEmailPartsSidebar");
    expect(content).not.toContain("export function useEmailContent");
    expect(content).not.toContain("export function EmailHeader");
    expect(content).not.toContain("export function EmailContent");
    expect(content).not.toContain("export function EmailPartsSidebar");
    expect(content).not.toContain("export function useEmailSelection");
    expect(content).not.toContain("export type EmailViewerState");
    expect(content).not.toContain("export type EmailSelectionState");
    expect(content).toContain("function useEmailViewerContext()");
    expect(content).not.toContain("export function useEmailViewer(");
    expect(content).not.toContain("export function EmailViewerFrame");
    expect(content).not.toContain("EmailViewerChrome");
    expect(content).toContain("model: EmailViewerModel");
    expect(content).toContain("selectPart: (node: MimePartNode) => void");
    expect(content).not.toContain("MimeDisplayPart");
    expect(content).not.toContain("display:");
    expect(content).not.toContain("setSelectedNode");
    expect(content).not.toContain("getSidebarSections");
    expect(content).not.toContain("getBodyNode");
    expect(content).not.toContain("walkCurrentMessageNodes");
    expect(model).toContain("export function deriveEmailViewerModel");
    expect(model).toContain("export function deriveEmailSidebarModel");
    expect(model).toContain("export function deriveEmailContentModel");
    expect(model).toContain("export function createMimeMessageScope");
    expect(model).toContain("function walkCurrentMessageNodes");
    expect(model).toContain("DEFAULT_EMAIL_BODY_SELECTION_POLICY");
    expect(model).not.toContain("function reparentMimeNode");
    expect(types).toContain("facts: MimePartFacts");
    expect(types).toContain("parentPath: MimePartPath | null");
    expect(types).toContain("export type MimePartKind");
    expect(types).not.toContain("MimePartRole");
    expect(types).not.toContain("isMultipart: boolean");
    expect(types).not.toContain("isMessage: boolean");
    expect(types).not.toContain("isAttachment: boolean");
    expect(types).not.toContain("isInlineResource: boolean");
  });

  it("keeps email parts on ViewerSidebar without a nested shadcn sidebar", () => {
    const content = fileContent("registry/new-york-v4/ui/email-viewer.tsx");

    expect(importSpecifiers(content)).not.toContain("./sidebar");
    expect(content).not.toContain("EmbeddedSidebarProvider");
    expect(content).not.toMatch(/<Sidebar(?:\s|>)/);
    expect(content).not.toMatch(/<Sidebar(?:Content|Group|Header|Menu|Rail)/);
    expect(content).toContain('aria-label="Email parts"');
    expect(content).not.toContain("viewerPurpose");
    expect(content).toContain('data-slot="mime-part-sidebar"');
  });

  it("keeps PDF viewer named parts on narrow hooks", () => {
    const viewer = fileContent("registry/new-york-v4/ui/pdf-viewer.tsx");
    const content = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-content.tsx",
    );
    const controls = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-document-controls.ts",
    );
    const layout = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-document-layout.ts",
    );
    const resource = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-document-resource.ts",
    );
    const runtime = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-document-runtime.ts",
    );
    const pagesLayer = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-pages-layer.tsx",
    );
    const context = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-context.tsx",
    );
    const types = fileContent("registry/new-york-v4/ui/pdf-viewer-types.ts");
    const thumbnails = fileContent(
      "registry/new-york-v4/ui/pdf-viewer-thumbnails.tsx",
    );
    const registry = readJson<Registry>("registry.json");
    const pdfViewerHeader = ["Pdf", "ViewerHeader"].join("");
    const pdfViewerHeaderControls = [pdfViewerHeader, "Controls"].join("");
    const pdfHeaderHook = ["usePdf", "ViewerHeader"].join("");
    const optionalPdfHeaderControlsHook = [
      "useOptional",
      pdfViewerHeaderControls,
    ].join("");
    const pdfDocumentViewportControls = [
      "PdfDocument",
      "ViewportControls",
    ].join("");
    const pdfViewportRegistrationProvider = [
      "PdfDocument",
      "ViewportRegistrationProvider",
    ].join("");
    const pdfViewportRegistrationHook = [
      "usePdfDocument",
      "ViewportRegistration",
    ].join("");
    const pdfViewportModulePath = [
      "registry/new-york-v4/ui/pdf-viewer",
      "-viewport.tsx",
    ].join("");
    const pdfViewportState = ["viewport", "Controls"].join("");
    const pdfViewportChangeHandler = ["handleViewport", "ControlsChange"].join(
      "",
    );
    const pdfViewportSetter = ["setViewport", "Controls"].join("");
    const headerControlsSetter = ["setHeader", "Controls"].join("");
    const resourceContentProps =
      content.match(
        /export type PdfResourceContentProps = [\s\S]*?\n\}/,
      )?.[0] ?? "";

    expect(thumbnails).not.toContain("PdfThumbnailSidebar");
    expect(registry.items).not.toContainEqual(
      expect.objectContaining({ name: "pdf-thumbnail-sidebar" }),
    );
    expect(registry.items).not.toContainEqual(
      expect.objectContaining({
        files: expect.arrayContaining([
          expect.objectContaining({
            path: "registry/new-york-v4/ui/pdf-viewer-internal-context.tsx",
          }),
        ]),
      }),
    );
    expect(context).toContain("usePdfViewerThumbnails");
    expect(context).toContain("PdfViewerProvider");
    expect(context).not.toContain(pdfViewerHeader);
    expect(context).toContain("PdfViewerPages");
    expect(context).not.toMatch(
      new RegExp(`\\bexport function ${pdfHeaderHook}\\(`),
    );
    expect(context).not.toMatch(/\bexport function usePdfViewerPages\(/);
    expect(context).not.toContain(
      `export function ${optionalPdfHeaderControlsHook}`,
    );
    expect(context).not.toContain(pdfViewportState);
    expect(context).not.toContain(pdfViewportRegistrationProvider);
    expect(context).not.toContain(pdfViewportChangeHandler);
    expect(context).not.toContain(pdfViewportSetter);
    expect(content).toContain("usePdfDocumentResource");
    expect(content).toContain("usePdfDocumentLayout");
    expect(content).toContain("usePdfDocumentRuntime");
    expect(content).toContain("usePdfDocumentControlsState");
    expect(content).toContain("<PdfDocumentPagesLayer");
    expect(content).not.toContain("usePdfScroll(");
    expect(content).not.toContain("usePdfPageVirtualization");
    expect(content).not.toContain("usePdfPageRenderScheduler");
    expect(resource).toContain("retainPdfDocumentResource");
    expect(resource).toContain("releasePdfDocumentResource");
    expect(layout).toContain("useOptionalFileViewerRendererFrame");
    expect(layout).toContain("resolveFileViewerRendererLayoutInlineSize");
    expect(layout).toContain("rasterInlineSize");
    expect(layout).toContain("rendererFrame");
    expect(layout).toContain("useOptionalFileViewerRendererEnvironment");
    expect(layout).toContain("useMeasuredElementWidth({");
    expect(layout).toContain("enabled: !rendererEnvironment.usesShellGeometry");
    expect(layout).toContain("resolveSurfaceMotionStyle");
    expect(layout).toContain("usePdfScale");
    expect(layout).toContain("createPdfPageLayout");
    expect(controls).toContain("function usePdfDocumentControlsRegistration");
    expect(runtime).toContain("usePdfScroll");
    expect(runtime).toContain("usePdfPageVirtualization");
    expect(runtime).toContain("usePdfPageRenderScheduler");
    expect(runtime).toContain("setScrollInteractionElement");
    expect(runtime).not.toContain("querySelector");
    expect(pagesLayer).toContain("function PdfDocumentPagesLayer");
    expect(pagesLayer).toContain("getPdfRenderedPageWindow");
    expect(pagesLayer).toContain("setScrollInteractionElement");
    expect(pagesLayer).toContain("useOptionalFileViewerRendererEnvironment");
    expect(pagesLayer).toContain("setDocumentSurfaceElement");
    // Commit-then-relax: pages sit at their settled layout positions for the
    // whole shell motion; the kernel's single surface transform is the only
    // in-flight style. No per-page projection vars or motion frames.
    expect(pagesLayer).not.toContain("PDF_DOCUMENT_MOTION_SCALE_PROPERTY");
    expect(pagesLayer).not.toContain("pdf-page-motion-frame");
    expect(pagesLayer).not.toContain("calc(");
    expect(pagesLayer).toContain(
      "top: renderedWindow.beforeHeight + page.windowTop",
    );
    expect(pagesLayer).not.toContain("data-visual-scale");
    expect(pagesLayer).not.toContain("transform: documentTransform");
    expect(pagesLayer).not.toContain('willChange: "transform"');
    expect(pagesLayer).not.toContain(
      "scale(var(--file-viewer-document-visual-scale, 1))",
    );
    expect(pagesLayer).not.toContain("transitionDuration");
    expect(pagesLayer).not.toContain("transitionProperty");
    expect(pagesLayer).not.toContain("data-viewer-document-flip-layer");
    expect(content).not.toContain(pdfViewportRegistrationHook);
    expect(controls).toContain("useViewerControlsRegistration");
    expect(content).not.toContain(pdfViewportSetter);
    expect(resourceContentProps).not.toContain("ViewportControls");
    expect(context).not.toContain(pdfViewerHeaderControls);
    expect(context).not.toContain("headerControls");
    expect(context).not.toContain(headerControlsSetter);
    expect(content).not.toContain("headerControls");
    expect(content).not.toContain(headerControlsSetter);
    expect(viewer).not.toContain(pdfDocumentViewportControls);
    for (const forbiddenExport of [
      `export type ${pdfViewerHeader}State`,
      "export type PdfViewerPagesState",
      `export type ${pdfViewerHeader}ControlSetter`,
      `export type ${pdfViewerHeaderControls}`,
      `export function ${pdfHeaderHook}State`,
      "export function usePdfViewerPagesState",
      `export function ${pdfHeaderHook}ControlSetter`,
    ]) {
      expect(context).not.toContain(forbiddenExport);
      expect(viewer).not.toContain(forbiddenExport);
    }
    expect(types).not.toContain(`export type ${pdfDocumentViewportControls}`);
    expect(types).not.toContain(pdfViewerHeaderControls);
    expect(context).toContain("function usePdfViewerContext");
    expect(context).toContain("const PdfViewerContext");
    expect(context).not.toContain("export const PdfViewerContext");
    expect(context).not.toContain("export type PdfViewerContextValue");
    expect(context).not.toContain("useInternalPdfViewer");
    const viewerContextExports = namedReExports(
      viewer,
      "./pdf-viewer-context",
      {
        typeOnly: false,
      },
    );
    expect(viewerContextExports).toEqual(
      expect.arrayContaining([
        "PdfViewerPages",
        "PdfViewerProvider",
        "usePdfViewerThumbnails",
      ]),
    );
    expect(viewerContextExports).not.toContain(pdfViewerHeader);
    expect(viewerContextExports).not.toContain("usePdfViewer");
    expect(viewerContextExports).not.toContain(pdfHeaderHook);
    expect(viewerContextExports).not.toContain("usePdfViewerPages");
    expect(
      viewerContextExports.some((name) => name.startsWith("useInternal")),
    ).toBe(false);
    expect(context).not.toContain("export * from");
    expect(viewer).not.toContain("PdfViewerContext");
    expect(viewer).not.toContain("useInternalPdfViewer");
    expect(viewer).not.toContain("pdf-viewer-internal-context");
    const pdfViewerFiles =
      registry.items.find((item) => item.name === "pdf-viewer")?.files ?? [];
    expect(pdfViewerFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "registry/new-york-v4/ui/pdf-viewer-content.tsx",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/pdf-viewer-document-controls.ts",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/pdf-viewer-document-layout.ts",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/pdf-viewer-document-resource.ts",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/pdf-viewer-document-runtime.ts",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/pdf-viewer-pages-layer.tsx",
        }),
      ]),
    );
    expect(pdfViewerFiles).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: pdfViewportModulePath,
        }),
      ]),
    );
    expect(thumbnails).toContain("const thumbnails = usePdfViewerThumbnails()");
    expect(thumbnails).toContain("export interface PdfThumbnailRailProps");
    expect(thumbnails).toContain("export function PdfThumbnailRail");
    expect(thumbnails).toContain("thumbnailWidth?: number");
    expect(thumbnails).toContain("thumbnailShape?: PdfThumbnailShape");
    const viewerThumbnailsProps =
      thumbnails.match(
        /export interface PdfViewerThumbnailsProps \{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    expect(viewerThumbnailsProps).toContain("thumbnailWidth?: number");
    expect(viewerThumbnailsProps).toContain(
      "thumbnailShape?: PdfThumbnailShape",
    );
    expect(viewerThumbnailsProps).toContain("className?: string");
    expect(viewerThumbnailsProps).not.toContain("resource");
    expect(viewerThumbnailsProps).not.toContain("currentPage");
    expect(viewerThumbnailsProps).not.toContain("onSelectPage");
    expect(viewerThumbnailsProps).not.toContain("width?: number");
  });

  it("keeps file-backed PDF provider composition on one source prop", () => {
    const files = [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/blocks/pdf-thumbnails-block.tsx",
      "registry/new-york-v4/blocks/split-viewer-block.tsx",
      "registry/new-york-v4/blocks/partition-viewer-block.tsx",
      "registry/new-york-v4/blocks/sources-viewer-block.tsx",
      "content/docs/components/file-viewer/renderers/pdf.mdx",
    ];

    for (const file of files) {
      const content = fileContent(file);
      expect(
        content,
        `${file} duplicates source into PdfViewerProvider`,
      ).not.toMatch(/<PdfViewerProvider\s+source=/);
    }
  });

  it("keeps the PDF thumbnails block identical to canonical composition", () => {
    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/pdf-thumbnails-block.tsx",
      [
        "<FileViewerProvider",
        "<FileViewer",
        "<PdfViewerProvider",
        "<FileViewerHeader",
        "<FileViewerSidebarTrigger",
        "<FileViewerTitle",
        "<FileViewerControls",
        "<FileViewerContent",
        "<FileViewerSidebar",
        "<PdfViewerThumbnails",
        "<FileViewerInset",
        "<FileViewerViewport",
        "<PdfViewerPages",
      ],
    );
  });

  it("keeps file-system domain parts on narrow hooks", () => {
    const easyApi = fileContent("registry/new-york-v4/ui/file-system.tsx");
    const provider = fileContent(
      "registry/new-york-v4/ui/file-system-provider.tsx",
    );
    const parts = fileContent("registry/new-york-v4/ui/file-system-parts.tsx");
    const dialog = fileContent(
      "registry/new-york-v4/ui/file-system-open-preview-dialog.tsx",
    );
    const browserState = fileContent(
      "registry/new-york-v4/ui/file-system-browser-state.ts",
    );
    const browserController = fileContent(
      "registry/new-york-v4/ui/file-system-browser-controller.ts",
    );
    const kernel = fileContent("registry/new-york-v4/ui/file-system-kernel.ts");
    const kernelRuntime = fileContent(
      "registry/new-york-v4/ui/file-system-kernel-runtime.ts",
    );
    const kernelCommandEffects = fileContent(
      "registry/new-york-v4/ui/file-system-kernel-command-effects.ts",
    );
    const asyncTask = fileContent(
      "registry/new-york-v4/ui/file-system-async-task.ts",
    );
    const folderTask = fileContent(
      "registry/new-york-v4/ui/file-system-folder-task.ts",
    );
    const controlledProps = fileContent(
      "registry/new-york-v4/ui/file-system-controlled-props.ts",
    );
    const kernelSelectors = fileContent(
      "registry/new-york-v4/ui/file-system-kernel-selectors.ts",
    );
    const selectionSourceTask = fileContent(
      "registry/new-york-v4/ui/file-system-selection-source-task.ts",
    );
    const openSourceTask = fileContent(
      "registry/new-york-v4/ui/file-system-open-source-task.ts",
    );
    const explorerControllerName = "FileSystem" + "ExplorerController";
    const explorerControllerFile =
      "registry/new-york-v4/ui/file-system-explorer" + "-controllers.ts";
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
    ];

    expect(easyApi).toContain("./file-system-provider");
    expect(easyApi).toContain("./file-system-parts");
    expect(easyApi).toContain("./file-system-open-preview-dialog");
    expect(easyApi).not.toContain("React.useState");
    expect(easyApi).not.toContain("React.useCallback");
    expect(easyApi).not.toContain("./file-system-controls");
    expect(easyApi).not.toContain("./file-system-chrome");
    expect(provider).toContain("export function useFileSystem");
    expect(provider).not.toContain("controller:");
    expect(provider).not.toContain("openFilePreviewState");
    expect(provider).toContain("export type FileSystemCompositionState");
    expect(provider).toContain("useFileSystemKernelRuntime");
    expect(provider).toContain("selectFileSystemBrowserState");
    expect(provider).toContain("selectFileSystemSelectionState");
    expect(provider).toContain("browser,");
    expect(provider).toContain("selection,");
    expect(provider).toContain("openPreview: FileSystemOpenPreviewController");
    expect(provider).not.toContain("useFileSystem" + "StateSlices");
    expect(provider).not.toContain("query: state.query");
    expect(provider).not.toContain("view: state.view");
    expect(provider).not.toContain("source: state.source");
    expect(provider).not.toContain("index: state.index");
    expect(provider).not.toContain("loading: state.loading");
    expect(provider).not.toContain("selection: state.selection");
    expect(provider).not.toContain("navigation: state.navigation");
    expect(browserState).toContain("export type FileSystemBrowserState");
    expect(browserState).toContain("entries: FileSystemEntry[]");
    expect(browserState).toContain("canGoBack: boolean");
    expect(browserState).toContain("canGoForward: boolean");
    expect(browserState).toContain("ensureChildren: (");
    expect(browserState).toContain("folderErrors: ReadonlyMap<string, string>");
    expect(browserState).toContain("loadingFolders: ReadonlySet<string>");
    expect(browserState).toContain("navigateTo: (path: string) => void");
    expect(browserState).toContain(
      "selectEntry: (entry: FileSystemEntry | null) => void",
    );
    expect(browserState).toContain("selectedEntry: FileSystemEntry | null");
    expect(browserState).toContain("selectedPath: string | null");
    expect(browserState).not.toContain(
      "loading: FileSystemBrowserLoadingState",
    );
    expect(browserState).not.toContain(
      "navigation: FileSystemBrowserNavigationState",
    );
    expect(browserState).not.toContain(
      "selection: FileSystemBrowserSelectionState",
    );
    expect(browserState).not.toContain("commands: FileSystemBrowserCommands");
    expect(browserState).not.toContain(
      "export type FileSystemBrowserSelectionState",
    );
    expect(browserState).not.toContain(
      "export type FileSystemBrowserLoadingState",
    );
    expect(browserState).not.toContain(
      "export type FileSystemBrowserNavigationState",
    );
    expect(browserState).not.toContain("export type FileSystemBrowserCommands");
    expect(browserState).toContain("export type FileSystemHeaderState");
    expect(browserState).toContain("createFileSystemHeaderState");
    expect(browserState).toContain("entry: FileSystemEntry | null");
    expect(browserState).toContain("resolveSource: FileSystemSourceResolver");
    expect(browserState).not.toContain(
      "FileSystemHeaderState = FileSystemBrowserState",
    );
    expect(browserState).toContain("export type FileSystemSelectionState");
    expect(browserState).not.toContain("createFileSystemBrowserState");
    expect(browserState).not.toContain("createFileSystemSelectionState");
    expect(kernel).toContain("export type FileSystemKernelState");
    expect(kernel).toContain("export type FileSystemKernelEvent");
    expect(kernel).toContain("export type FileSystemKernelCommand");
    expect(kernel).toContain("reduceFileSystemKernel");
    expect(kernel).toContain("folder.loadSucceeded");
    expect(kernel).toContain("current.requestId !== event.requestId");
    expect(kernelRuntime).toContain("useFileSystemKernelRuntime");
    expect(kernelRuntime).toContain("dispatch");
    expect(kernelRuntime).toContain("consumeCommands");
    expect(kernelRuntime).not.toContain("AbortController");
    expect(kernelRuntime).not.toContain("predicted");
    expect(kernelCommandEffects).toContain("useFileSystemKernelCommandEffects");
    expect(kernelCommandEffects).toContain("callback.pathChanged");
    expect(kernelCommandEffects).toContain("file.open");
    expect(kernelCommandEffects).not.toContain("AbortController");
    expect(asyncTask).toContain("FileSystemAsyncTask");
    expect(asyncTask).toContain("FileSystemAsyncTaskWaiter");
    expect(asyncTask).toContain("AbortController");
    expect(asyncTask).toContain("task.id");
    expect(asyncTask).toContain("task.key");
    expect(asyncTask).not.toContain("@pierre/trees");
    expect(folderTask).toContain("useFileSystemFolderTask");
    expect(folderTask).toContain("FileSystemFolderTask");
    expect(folderTask).toContain("folder.loadRequested");
    expect(folderTask).toContain("folder.loadSucceeded");
    expect(folderTask).toContain("folder.loadFailed");
    expect(folderTask).not.toContain("onPathChange");
    expect(folderTask).not.toContain("onQueryChange");
    expect(folderTask).not.toContain("onSelectionChange");
    expect(folderTask).not.toContain("onViewChange");
    expect(folderTask).not.toContain("predicted");
    expect(controlledProps).toContain("useFileSystemControlledProps");
    expect(controlledProps).toContain('source: "controlled-prop"');
    expect(controlledProps).not.toContain("loadChildren");
    expect(controlledProps).not.toContain("AbortController");
    expect(kernelSelectors).toContain("selectFileSystemBrowserState");
    expect(kernelSelectors).toContain("selectFileSystemSelectionState");
    expect(kernelSelectors).not.toContain("AbortController");
    expect(kernelSelectors).not.toContain("@pierre/trees");
    expect(selectionSourceTask).toContain("useFileSystemSelectionSourceTask");
    expect(selectionSourceTask).toContain("createFileSystemAsyncTaskRuntime");
    expect(openSourceTask).toContain("useFileSystemOpenSourceTask");
    expect(openSourceTask).toContain("createFileSystemAsyncTaskRuntime");
    expect(openSourceTask).not.toContain("FileSystemOpenSourceRequest");
    expect(browserController).toContain(
      "export type FileSystemBrowserController",
    );
    expect(browserController).toContain("browser: FileSystemBrowserState");
    expect(browserController).toContain(
      "export type FileSystemFileActionController",
    );
    expect(browserController).toContain(
      "fileActions: FileSystemFileActionController",
    );
    expect(browserController).toContain(
      "openPreview: FileSystemOpenPreviewCommand",
    );
    expect(browserController).toContain(
      'resolveFileSource: FileSystemSourceController["resolveFileSource"]',
    );
    const browserControllerShape =
      browserController.match(
        /export type FileSystemBrowserController = \{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    expect(browserControllerShape).not.toContain("openPreview:");
    expect(browserControllerShape).not.toContain("resolveFileSource:");
    expect(provider).toContain("useFileSystemOpenPreviewController");
    expect(provider).toContain("export type FileSystemContextValue = {");
    expect(provider).toContain(
      "browser: ReturnType<typeof selectFileSystemBrowserState>",
    );
    expect(provider).toContain(
      "selection: ReturnType<typeof selectFileSystemSelectionState>",
    );
    expect(parts).toContain("./file-system-controls");
    expect(parts).toContain("export function useFileSystemHeader");
    expect(parts).toContain("export function useFileSystemBrowser");
    expect(parts).toContain("export function useFileSystemSelection");
    expect(parts).toContain("export function FileSystemHeader");
    expect(parts).toContain("export function FileSystemBrowser");
    expect(parts).toContain("export function FileSystemSelection");
    expect(parts).not.toContain("FileViewer");
    expect(parts).toContain("createFileSystemBrowserController");
    expect(parts).toContain("export type FileSystemBrowserPartState");
    expect(parts).toContain("const header = useFileSystemHeader()");
    expect(parts).toContain("useFileSystemBrowser()");
    expect(parts).toContain("useFileSystemSelection()");
    expect(parts).toContain("const controller = useFileSystemBrowser()");
    expect(parts).not.toContain("const { navigation, query, title, view }");
    expect(parts).not.toContain("const { renderers, selection, source }");
    expect(parts).not.toContain("explorerController");
    expect(parts).not.toContain("const { browser } = useFileSystemBrowser()");
    expect(existsSync(join(repoRoot, explorerControllerFile))).toBe(false);
    for (const file of deletedSliceFiles) {
      expect(
        existsSync(join(repoRoot, file)),
        `${file} should be deleted`,
      ).toBe(false);
    }
    expect(dialog).toContain("export function useFileSystemOpenPreview");
    expect(dialog).toContain("export function FileSystemOpenPreview");
    expect(dialog).toContain('status === "resolving"');
    expect(dialog).toContain('status === "unavailable"');
    expect(dialog).toContain('status === "failed"');
    expect(easyApi).toContain("FileSystemDefaultSelectionContent");
    expect(easyApi).toContain("<FileViewer");
    expect(easyApi).not.toContain("FileSystemSelectionSurface");
    expect(easyApi).not.toContain("./file-system-preview");
  });

  it("keeps file-system easy API on invariant browser plus preview grammar", () => {
    const content = fileContent("registry/new-york-v4/ui/file-system.tsx");
    const sidebarTag = content.match(/<ViewerSidebar[\s\S]*?>/)?.[0] ?? "";
    const surfaceTag = content.match(/<ViewerSurface[\s\S]*?>/)?.[0] ?? "";

    expect(content).not.toContain("const isGallery");
    expect(sidebarTag).toContain('aria-label="Files"');
    expect(sidebarTag).toContain("width={sidebarWidth}");
    expect(content).toContain("FILE_SYSTEM_SIDEBAR_WIDTH");
    expect(content).toContain("FILE_SYSTEM_COLUMNS_SIDEBAR_WIDTH");
    expect(sidebarTag).not.toContain('width="58%"');
    expect(content).not.toContain("{isGallery ? null : (");
    expect(surfaceTag).not.toMatch(/\bhidden\b/);
    expect(surfaceTag).not.toContain("w-[42%]");
    expect(content).not.toContain('width="58%"');
  });

  it("keeps Pierre out of the main file-system browser", () => {
    const registry = readJson<Registry>("registry.json");
    const fileSystemItem = registry.items.find(
      (item) => item.name === "file-system",
    );
    const fileSystemLightItem = registry.items.find(
      (item) => item.name === "file-system-light",
    );
    const fileSystemPaths =
      fileSystemItem?.files.map((file) => file.path) ?? [];
    const fileSystemLightPaths =
      fileSystemLightItem?.files.map((file) => file.path) ?? [];
    const listModelPath = "registry/new-york-v4/ui/file-system-list-model.ts";
    const listView = fileContent(
      "registry/new-york-v4/ui/file-system-list-view.tsx",
    );
    const light = fileContent("registry/new-york-v4/ui/file-system-light.tsx");
    const lightTree = fileContent(
      "registry/new-york-v4/ui/file-system-light-tree.tsx",
    );
    const gridView = fileContent(
      "registry/new-york-v4/ui/file-system-grid-view.tsx",
    );
    const columnsView = fileContent(
      "registry/new-york-v4/ui/file-system-columns-view.tsx",
    );
    const explorerControllerName = "FileSystem" + "ExplorerController";
    const explorerControllerImport = "file-system-explorer" + "-controllers";
    const explorerControllerFile =
      "registry/new-york-v4/ui/file-system-explorer" + "-controllers.ts";
    const pierreFiles = [
      "registry/new-york-v4/ui/file-system-pierre-adapter.ts",
      "registry/new-york-v4/ui/file-system-pierre-decoration.ts",
      "registry/new-york-v4/ui/file-system-pierre-expansion.ts",
      "registry/new-york-v4/ui/file-system-pierre-lazy-retry.ts",
      "registry/new-york-v4/ui/file-system-pierre-model.ts",
      "registry/new-york-v4/ui/file-system-pierre-reset.ts",
      "registry/new-york-v4/ui/file-system-pierre-selection.ts",
    ];
    const deletedPierrePolicyFiles = [
      "registry/new-york-v4/ui/file-system-pierre-" + "reset-identity.ts",
      "registry/new-york-v4/ui/file-system-pierre-" + "reset-plan.ts",
      "registry/new-york-v4/ui/file-system-pierre-" + "expansion-snapshot.ts",
    ];

    expect(fileSystemItem?.dependencies ?? []).not.toContain("@pierre/trees");
    expect(fileSystemPaths).toContain(
      "registry/new-york-v4/ui/file-system-list-view.tsx",
    );
    expect(fileSystemPaths).toContain(
      "registry/new-york-v4/ui/file-system-thumbnail.tsx",
    );
    expect(fileSystemPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-preview.tsx",
    );
    expect(fileSystemPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-list-continuity.ts",
    );
    expect(fileSystemPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-pierre-list-tree.tsx",
    );
    expect(fileSystemPaths).not.toContain(listModelPath);
    for (const file of pierreFiles) {
      expect(fileSystemPaths).not.toContain(file);
    }
    for (const file of deletedPierrePolicyFiles) {
      expect(fileSystemPaths).not.toContain(file);
      expect(existsSync(join(repoRoot, file))).toBe(false);
    }
    expect(fileSystemLightPaths).toContain(
      "registry/new-york-v4/ui/file-system-light-tree.tsx",
    );
    expect(fileSystemLightPaths).not.toContain(
      "registry/new-york-v4/ui/file-system-pierre-light-tree.tsx",
    );
    expect(existsSync(join(repoRoot, listModelPath))).toBe(false);
    expect(listView).toContain("useFixedRowVirtualization");
    expect(listView).toContain("FileSystemListEntryRow");
    expect(listView).toContain("FileSystemBrowserController");
    expect(listView).toContain("fileActions.openPreview");
    expect(listView).toContain("browser.ensureChildren");
    expect(listView).toContain("browser.selectedPath");
    expect(listView).not.toContain("@pierre/trees/react");
    expect(listView).not.toContain("FileSystemListTree");
    expect(listView).not.toContain("useFileSystemListModel");
    expect(listView).not.toContain("useFileSystemPierreModel");
    expect(listView).not.toContain("buildFileSystemPierreInput");
    expect(listView).not.toContain("file-system-pierre-input");
    expect(listView).not.toContain("file-system-pierre-model");
    expect(listView).not.toContain("file-system-pierre-decoration-version");
    expect(listView).not.toContain("file-system-pierre-adapter");
    expect(listView).not.toContain(explorerControllerName);
    expect(listView).not.toContain("new PierreFileTreeModel");
    expect(listView).not.toContain("SortHeader");
    expect(light).not.toContain("pierre");
    expect(light).toContain("./file-system-light-tree");
    expect(light).not.toContain("./file-system-pierre-light-tree");
    expect(lightTree).toContain("@pierre/trees/react");
    expect(existsSync(join(repoRoot, explorerControllerFile))).toBe(false);
    expect(gridView).toContain("FileSystemBrowserController");
    expect(gridView).toContain("fileActions.openPreview");
    expect(gridView).toContain("fileActions.resolveFileSource");
    expect(gridView).toContain("fileActions");
    expect(gridView).not.toContain(explorerControllerName);
    expect(gridView).not.toContain("file-system-pierre");
    expect(columnsView).toMatch(/FileSystem(ColumnsView|Browser)Controller/);
    expect(columnsView).toContain("fileActions.openPreview");
    expect(columnsView).toContain("fileActions.resolveFileSource");
    expect(columnsView).toContain("fileActions");
    expect(columnsView).not.toContain(explorerControllerName);
    expect(columnsView).not.toContain("file-system-pierre");
    for (const file of pierreFiles) {
      if (!existsSync(join(repoRoot, file))) continue;

      const content = fileContent(file);
      expect(
        content,
        `${file} imports broad explorer controller`,
      ).not.toContain(explorerControllerName);
      expect(
        content,
        `${file} imports explorer composition boundary`,
      ).not.toContain(explorerControllerImport);
      expect(
        content,
        `${file} imports file-system-${"controller"}`,
      ).not.toContain("./file-system-" + "controller");
    }
  });

  it("keeps workflow viewer named parts on narrow hooks", () => {
    const pageMarkdown = fileContent(
      "components/viewers/page-markdown/page-markdown-viewer.tsx",
    );
    const pageMarkdownPane = fileContent(
      "components/viewers/page-markdown/page-markdown-pane.tsx",
    );
    const pageMarkdownSync = fileContent(
      "components/viewers/page-markdown/page-markdown-sync.ts",
    );
    const parse = fileContent("components/viewers/parse/parse-viewer.tsx");
    const parseDocs = fileContent("content/docs/components/parse-viewer.mdx");
    const parseRegistry = fileContent("public/r/parse-viewer-block.json");
    const partition = fileContent(
      "components/viewers/partition/partition-viewer.tsx",
    );
    const partitionModel = fileContent(
      "components/viewers/partition/partition-viewer-model.ts",
    );
    const classifier = fileContent(
      "components/viewers/classify/classifier-viewer.tsx",
    );

    expect(pageMarkdown).toContain(
      "function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue",
    );
    expect(pageMarkdown).not.toContain(
      "export function usePageMarkdownViewer(",
    );
    expect(pageMarkdown).toContain("function usePageMarkdownViewerContent");
    expect(pageMarkdown).not.toContain(
      "export function usePageMarkdownViewerContent",
    );
    expect(pageMarkdown).toContain(
      "export function usePageMarkdownViewerDocument",
    );
    expect(pageMarkdown).toContain("function usePageMarkdownViewerHeader");
    expect(pageMarkdown).not.toContain(
      "export function usePageMarkdownViewerHeader",
    );
    expect(pageMarkdown).not.toContain("export type PageMarkdownViewerState");
    expect(pageMarkdown).not.toContain(
      "export type PageMarkdownViewerContentState",
    );
    expect(pageMarkdown).not.toContain(
      "export type PageMarkdownViewerHeaderState",
    );
    expect(pageMarkdown).toContain("content: PageMarkdownViewerContentState");
    expect(pageMarkdown).toContain("document: PageMarkdownDocumentState");
    expect(pageMarkdown).toContain("header: PageMarkdownViewerHeaderState");
    expect(pageMarkdown).toContain("export function PageMarkdownViewerHeader");
    expect(pageMarkdown).toContain("} = usePageMarkdownViewerHeader()");
    expect(compactWhitespace(pageMarkdown)).toContain(
      "<PageMarkdownViewerHeader /> <ViewerBody>",
    );
    expect(pageMarkdownPane).not.toContain("PageMarkdownToolbar");
    expect(pageMarkdown).not.toContain(
      "export type PageMarkdownViewerContextValue",
    );
    expect(pageMarkdown).not.toContain(
      "export function usePageMarkdownViewer(): PageMarkdownViewerContextValue",
    );
    expect(pageMarkdown).not.toContain(
      "export function PageMarkdownViewerControls",
    );
    expect(pageMarkdown).not.toContain(
      "function usePageMarkdownViewerControls",
    );
    expect(pageMarkdown).not.toContain("SegmentedDocumentProvider");
    expect(pageMarkdown).not.toContain("useSegmented");
    expect(pageMarkdown).not.toContain("segmented-document");
    expect(pageMarkdownSync).not.toContain("version:");
    expect(pageMarkdownSync).not.toContain("version: number");
    expect(parse).not.toContain("ParseViewerContextValue");
    expect(parse).not.toContain("useParseViewerContext");
    expect(parse).not.toContain("export function useParseViewer(");
    expect(parse).not.toContain("export type ParseViewerState");
    expect(parse).toContain("export function useParseViewerDocument");
    expect(parse).not.toContain("export function useParseViewerMarkdown");
    expect(parse).not.toContain("export type ParseViewerContextValue");
    expect(parse).not.toContain("SegmentedDocumentProvider");
    expect(parse).not.toContain("useSegmented");
    expect(parse).not.toContain("segmented-document");
    expect(parse).toContain("PageMarkdownViewerProvider");
    expect(parse).toContain("export function ParseViewerHeader");
    expect(compactWhitespace(parse)).toContain(
      "<ParseViewerHeader /> <ViewerBody>",
    );
    expect(parseDocs).toContain("ParseViewerHeader");
    expect(parseRegistry).not.toContain("ParseViewerContextValue");
    expect(parseRegistry).not.toContain("export function useParseViewer(");
    expect(parseRegistry).not.toContain("export type ParseViewerContextValue");
    expect(parseRegistry).toContain("PageMarkdownViewerHeader");
    expect(parseRegistry).toContain("ParseViewerHeader");
    expect(parseRegistry).not.toContain("PageMarkdownViewerControls");
    expect(parseRegistry).toContain(
      "function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue",
    );
    expect(parseRegistry).not.toContain(
      "export function usePageMarkdownViewer(",
    );
    expect(parseRegistry).not.toContain(
      "export type PageMarkdownViewerContextValue",
    );
    expect(partition).toContain(
      "function usePartitionViewerContext(): PartitionViewerContextValue",
    );
    expect(partition).not.toContain("export function usePartitionViewer(");
    expect(partition).toContain("function usePartitionViewerHeader");
    expect(partition).toContain("function usePartitionViewerRibbon");
    expect(partition).not.toContain("export function usePartitionViewerHeader");
    expect(partition).not.toContain("export function usePartitionViewerRibbon");
    expect(partition).toContain(
      "export function usePartitionViewerDocumentControls",
    );
    expect(partition).toContain("function usePartitionViewerDocument");
    expect(partition).toContain("function usePartitionViewerEmpty");
    expect(partition).not.toMatch(
      /\bexport function usePartitionViewerDocument\(/,
    );
    expect(partition).not.toContain("export function usePartitionViewerEmpty");
    expect(partition).not.toContain("export function usePartitionViewerModel");
    expect(partition).not.toContain("export type PartitionViewerState");
    expect(partition).not.toContain("export type PartitionViewerContextValue");
    expect(partition).not.toContain(
      "export function usePartitionViewer(): PartitionViewerContextValue",
    );
    expect(partition).toContain("document?: React.ReactNode");
    expect(partition).toContain(
      "<PartitionViewerDocument document={document} />",
    );
    expect(partition).toContain("createPartitionViewerModel");
    expect(partition).toContain("SegmentedDocumentProvider");
    expect(partition).toContain("useSegmentedDocumentViewport");
    expect(partition).not.toContain("SegmentedViewer");
    expect(partition).not.toContain("useDomainSegmentedViewport");
    expect(partition).not.toContain("useSegmentViewportController");
    expect(partition).toContain("viewport: SegmentViewportController");
    expect(partition).not.toContain("scrollRequest");
    expect(partition).not.toContain("requestPageScroll");
    expect(partition).not.toContain("PartitionDocumentScrollRequest");
    expect(partition).not.toContain("buildColorMap");
    expect(partition).not.toContain("segmentDisplayLabel");
    expect(partition).not.toContain("maxChunkPage");
    expect(partitionModel).toContain(
      "export function createPartitionViewerModel",
    );
    expect(partitionModel).toContain(
      "export function createPartitionLegendSegments",
    );
    expect(partitionModel).toContain(
      "export function createPartitionRibbonRows",
    );
    expect(partitionModel).toContain(
      "export function createPartitionSegmentedDocumentModel",
    );
    expect(partitionModel).toContain("export type PartitionViewerModel");
    expect(partitionModel).toContain("viewportSegments: DocumentSegment[]");
    expect(partitionModel).toContain("export type PartitionRibbonRow");
    expect(classifier).toContain(
      "function useClassifierViewerContext(): ClassifierViewerContextValue",
    );
    expect(classifier).not.toContain("export function useClassifierViewer(");
    expect(classifier).toContain("function useClassifierViewerHeader");
    expect(classifier).toContain("function useClassifierViewerEmpty");
    expect(classifier).toContain("function useClassifierViewerDocument");
    expect(classifier).not.toContain(
      "export function useClassifierViewerHeader",
    );
    expect(classifier).not.toContain(
      "export function useClassifierViewerEmpty",
    );
    expect(classifier).not.toContain(
      "export function useClassifierViewerDocument",
    );
    expect(classifier).not.toContain("export type ClassifierViewerState");
    expect(classifier).not.toContain(
      "export type ClassifierViewerContextValue",
    );
    expect(classifier).not.toContain(
      "export function useClassifierViewer(): ClassifierViewerContextValue",
    );
    expect(classifier).toContain("document?: React.ReactNode");
    expect(classifier).toContain(
      "<ClassifierViewerDocument document={document} />",
    );
    expect(classifier).toContain("export function ClassifierViewerDocument");
    expect(classifier).not.toContain(
      "export type ClassifierViewerDocumentState",
    );
    expect(classifier).not.toContain("SegmentLegend");
    expect(classifier).not.toContain("useSegmentInteraction");
    expect(classifier).not.toContain("buildColorMap");
    expect(classifier).not.toContain("requestDocumentStart");
    expect(classifier).not.toContain("onSelectDocumentStart");
  });

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
    ];
    const sizedWorkflowFiles = [
      "registry/new-york-v4/blocks/dropzone-media-transcript-queue.tsx",
      "registry/new-york-v4/blocks/dropzone-intake-router.tsx",
      "registry/new-york-v4/blocks/dropzone-required-packet-slots.tsx",
      "registry/new-york-v4/blocks/dropzone-evidence-timeline.tsx",
      "registry/new-york-v4/blocks/dropzone-comparison-pair-upload.tsx",
    ];
    const attachmentSidebar = fileContent(
      "registry/new-york-v4/ui/attachment-sidebar.tsx",
    );

    for (const file of squareTokenFiles) {
      const content = fileContent(file);
      expect(content, file).toContain('thumbnailShape="square"');
      expect(content, file).not.toContain("previewAspectRatio={1}");
    }

    for (const file of sizedWorkflowFiles) {
      expect(fileContent(file), file).toContain("thumbnailSize=");
    }

    expect(attachmentSidebar).toContain('thumbnailShape="document"');
    expect(attachmentSidebar).toContain('thumbnailSize="md"');
    expect(attachmentSidebar).not.toContain("previewAspectRatio={3 / 4}");
  });

  it("keeps workflow registry blocks on visible viewer composition", () => {
    expectJsxTagsInOrder("registry/new-york-v4/blocks/parse-viewer-block.tsx", [
      "<ParseViewerProvider",
      "<ViewerRoot",
      "<ParseViewerHeader",
      "<ViewerBody",
      "<ResizablePanelGroup",
      "<ResizablePanel",
      "<ViewerSurface",
      "<ParseSourceDocument",
      "<ResizableHandle",
      "<ResizablePanel",
      "<ViewerSurface",
      "<ParseViewerMarkdown",
    ]);
    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/partition-viewer-block.tsx",
      [
        "<PartitionViewerProvider",
        "<FileViewer",
        "<PdfViewerProvider",
        "<FileViewerHeader",
        "<FileViewerTitle",
        "<PartitionViewerHeaderMeta",
        "<FileViewerControls",
        "<FileViewerContent",
        "<FileViewerInset",
        "<PartitionViewerLegend",
        "<PartitionViewerRibbon",
        "<PartitionSourceDocument",
      ],
    );
  });

  it("keeps block FileViewer compositions on FileViewer content and surface anatomy", () => {
    const violations: string[] = [];

    for (const file of tsxFilesUnderRoots(["registry/new-york-v4/blocks"])) {
      for (const element of jsxElementsWithDescendants(file, "FileViewer")) {
        if (!element.descendantTags.includes("FileViewerContent")) {
          violations.push(`${file}:${element.line} missing FileViewerContent`);
        }
        if (!element.descendantTags.includes("FileViewerInset")) {
          violations.push(`${file}:${element.line} missing FileViewerInset`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps source demo blocks on the public FileViewer shell", () => {
    const files = [
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
      "registry/new-york-v4/blocks/docx-sources-block.tsx",
      "registry/new-york-v4/blocks/image-sources-block.tsx",
      "registry/new-york-v4/blocks/text-sources-block.tsx",
      "registry/new-york-v4/blocks/xlsx-sources-block.tsx",
    ];
    const forbiddenPatterns = [
      /\buseFileViewerResource\b/,
      /\bImageResourceContent\b/,
      /\bDocxResourceContent\b/,
      /\bXlsxResourceContent\b/,
      /\bViewerRoot\b/,
    ];

    for (const file of files) {
      const content = fileContent(file);
      expect(content, `${file} renders FileViewer`).toContain("<FileViewer");
      expect(content, `${file} renders FileViewerContent`).toContain(
        "<FileViewerContent",
      );
      expect(content, `${file} renders FileViewerInset`).toContain(
        "<FileViewerInset",
      );
      expect(content, `${file} renders FileViewerSidebar`).toContain(
        "<FileViewerSidebar",
      );
      for (const pattern of forbiddenPatterns) {
        expect(content, `${file} leaks ${pattern}`).not.toMatch(pattern);
      }
    }

    const sourcesViewerBlock = fileContent(
      "registry/new-york-v4/blocks/sources-viewer-block.tsx",
    );
    for (const tag of [
      "<FileViewerProvider",
      "<FileViewer",
      "<FileViewerHeader",
      "<FileViewerSidebarTrigger",
      "<FileViewerTitle",
      "<FileViewerControls",
      "<FileViewerContent",
      "<FileViewerInset",
      "<FileViewerViewport",
      "<FileViewerSidebar",
    ]) {
      expect(sourcesViewerBlock).toContain(tag);
    }
    expect(sourcesViewerBlock).toContain("PdfViewerProvider");
    expect(sourcesViewerBlock).toContain("ImageViewerProvider");
    expect(sourcesViewerBlock).toContain("TextViewerProvider");
    expect(sourcesViewerBlock).toContain("CsvViewerProvider");
    expect(sourcesViewerBlock).toContain("DocxViewerProvider");
    expect(sourcesViewerBlock).toContain("XlsxViewerProvider");
    expect(sourcesViewerBlock).toContain("useFileViewerResource");
    expect(sourcesViewerBlock).toContain("FileResourceImageViewer");
    expect(sourcesViewerBlock).toContain("FileResourceTextViewer");
    expect(sourcesViewerBlock).toContain("FileResourceCsvViewer");
    expect(sourcesViewerBlock).toContain("FileResourceXlsxViewer");
    expect(sourcesViewerBlock).toContain("FileResourceDocxViewer");
    expect(sourcesViewerBlock).toContain("ImageViewerFrames");
    expect(sourcesViewerBlock).toContain("TextViewerDocument");
    expect(sourcesViewerBlock).toContain("CsvViewerGrid");
    expect(sourcesViewerBlock).toContain("XlsxViewerWorkbook");
    expect(sourcesViewerBlock).toContain("DocxViewerDocument");
    expect(sourcesViewerBlock).not.toContain("file-viewer-internal");
    expect(sourcesViewerBlock).not.toContain("ImageResourceContent");
    expect(sourcesViewerBlock).not.toContain("DocxResourceContent");
    expect(sourcesViewerBlock).not.toContain("XlsxResourceContent");
    expect(sourcesViewerBlock).not.toContain("<ViewerRoot");
    expect(sourcesViewerBlock).not.toContain("<ViewerSidebar");
    expect(sourcesViewerBlock).toMatch(/<FileViewer(?:\s|>)/);
    expect(sourcesViewerBlock).toContain("<FileViewerSidebar");
    expect(sourcesViewerBlock).toContain("<FileViewerSidebarTrigger");
  });

  it("keeps public viewer docs free of removed shell and slot language", () => {
    const forbiddenPatterns = [
      /\bViewerShell\b/,
      /\bViewerSlots\b/,
      /\bPdfViewerSlots\b/,
      /\bviewer shell\b/i,
      /\bslots\.(?:left|right|top|bottom|overlay)\b/,
      /\bslots=\{/,
      /\brenderDocument\b/,
      /\bFileViewerRoute\b/,
      /\bInternalFileViewerDocument\b/,
      /\bFileViewerDocumentRenderer\b/,
      /\bfile-viewer-internal\b/,
      /\bfile-viewer-route\b/,
      /\bfile-viewer-fallback\b/,
      /\bfile-viewer-chrome\b/,
      /\bviewer-zoom\b/,
    ];

    for (const file of publicDocFiles()) {
      const content = fileContent(file);
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} contains ${pattern}`).toBe(
          false,
        );
      }
    }
  });

  it("keeps public email docs on final named anatomy", () => {
    const emailDocs = fileContent(
      "content/docs/components/file-viewer/renderers/email.mdx",
    );
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
    ];

    expect(emailDocs).toContain("EmailViewerHeader");
    expect(emailDocs).toContain("EmailViewerContent");
    expect(emailDocs).toContain("EmailViewerPartsSidebar");
    expect(emailDocs).not.toContain("EmailViewerFrame");
    expect(emailDocs).not.toContain("<EmailHeader");
    expect(emailDocs).not.toContain("<EmailContent");
    expect(emailDocs).not.toContain("<EmailPartsSidebar");

    for (const file of supersededDocs) {
      const content = fileContent(file);
      expect(
        content,
        `${file} should not teach removed email hooks`,
      ).not.toMatch(/\buseEmail(?:Viewer|Header|PartsSidebar|Content)\b/);
      expect(
        content,
        `${file} should not teach the removed frame export`,
      ).not.toContain("EmailViewerFrame");
    }
  });

  it("keeps internal selector modules out of shipped viewer APIs", () => {
    const publicEntryFiles = [
      "registry/new-york-v4/ui/pdf-viewer.tsx",
      "registry/new-york-v4/ui/pdf-viewer-context.tsx",
      "components/viewers/edit/edit-viewer.tsx",
      "components/viewers/edit/edit-viewer-provider.tsx",
    ];
    const exampleAndDocFiles = [
      ...publicDocFiles(),
      ...sourceFilesUnder(join(repoRoot, "registry/new-york-v4/blocks")),
    ];
    const registryText = fileContent("registry.json");

    expect(registryText).not.toContain("internal-context");
    expect(
      existsSync(
        join(
          repoRoot,
          "components/viewers/edit/edit-viewer-internal-context.tsx",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          repoRoot,
          "registry/new-york-v4/ui/pdf-viewer-internal-context.tsx",
        ),
      ),
    ).toBe(false);

    for (const file of publicEntryFiles) {
      expect(
        fileContent(file),
        `${file} does not export internal selectors`,
      ).not.toContain("useInternal");
      expect(
        fileContent(file),
        `${file} does not wildcard-export internal modules`,
      ).not.toContain("export * from");
    }

    const pdfViewportModulePattern = new RegExp(
      ["pdf-viewer", "-viewport"].join(""),
    );
    const pdfViewportRegistrationProvider = [
      "PdfDocument",
      "ViewportRegistrationProvider",
    ].join("");
    const pdfViewportRegistrationHook = [
      "usePdfDocument",
      "ViewportRegistration",
    ].join("");

    for (const file of exampleAndDocFiles) {
      const content = fileContent(file);
      const imports = moduleSpecifiers(content);
      expect(imports, `${file} imports an internal viewer context`).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/internal-context/)]),
      );
      expect(imports, `${file} imports the edit store directly`).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/edit-viewer-store/)]),
      );
      expect(
        imports,
        `${file} imports the PDF viewport registration module`,
      ).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(pdfViewportModulePattern),
        ]),
      );
      expect(content, `${file} teaches the edit store hook`).not.toContain(
        "useEditStore",
      );
      expect(content, `${file} teaches the edit store provider`).not.toContain(
        "EditStoreProvider",
      );
      expect(
        content,
        `${file} teaches the PDF viewport registration provider`,
      ).not.toContain(pdfViewportRegistrationProvider);
      expect(
        content,
        `${file} teaches the PDF viewport registration hook`,
      ).not.toContain(pdfViewportRegistrationHook);
    }
  });

  it("keeps public ViewerSidebar examples labeled by domain", () => {
    const unlabeledSidebars: string[] = [];

    for (const file of publicDocFiles()) {
      for (const tag of viewerSidebarTags(fileContent(file))) {
        if (/\baria-label=/.test(tag)) continue;
        unlabeledSidebars.push(`${file}: ${tag.replace(/\s+/g, " ")}`);
      }
    }

    expect(unlabeledSidebars).toEqual([]);
  });

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
    ];

    for (const { file, label } of sidebars) {
      const content = fileContent(file);
      const sidebarTag = content.includes("<FileViewerSidebar")
        ? "<FileViewerSidebar"
        : "<ViewerSidebar";
      expect(content, `${file} renders ${sidebarTag}`).toContain(sidebarTag);
      expect(content, `${file} labels ViewerSidebar`).toContain(label);
    }
  });

  it("keeps every source ViewerSidebar explicitly labeled and trigger side implicit", () => {
    const files = tsxFilesUnderRoots([
      "registry/new-york-v4",
      "components/viewers",
    ]);
    const unlabeledSidebars: string[] = [];
    const explicitTriggerSides: string[] = [];

    for (const file of files) {
      for (const element of jsxOpeningElements(file)) {
        if (element.tag === "ViewerSidebar") {
          if (file === "registry/new-york-v4/ui/file-viewer.tsx") continue;
          if (file === "registry/new-york-v4/ui/file-viewer-content.tsx")
            continue;
          if (
            !element.attributes.includes("aria-label") &&
            !element.attributes.includes("aria-labelledby")
          ) {
            unlabeledSidebars.push(`${file}:${element.line}`);
          }
        }

        if (
          element.tag === "ViewerSidebarTrigger" &&
          element.attributes.includes("side")
        ) {
          explicitTriggerSides.push(`${file}:${element.line}`);
        }
      }
    }

    expect(unlabeledSidebars).toEqual([]);
    expect(explicitTriggerSides).toEqual([]);
  });

  it("keeps viewer sidebar child panels content-only when nested inside viewer rails", () => {
    const panelFiles = [
      "registry/new-york-v4/ui/layout-blocks-panel.tsx",
      "registry/new-york-v4/ui/file-system-thumbnail.tsx",
    ];

    for (const file of panelFiles) {
      expect(
        jsxTags(file),
        `${file} must not render a local aside`,
      ).not.toContain("aside");
    }
  });

  it("documents intentional sidebar composition boundaries", () => {
    const sidebarDoc = fileContent(
      "content/docs/components/file-viewer/navigation/index.mdx",
    );
    const compactSidebarDoc = compactWhitespace(sidebarDoc);
    const segmentSidebarDoc = fileContent(
      "content/docs/components/file-viewer/navigation/file-viewer-segments.mdx",
    );
    const compactSegmentSidebarDoc = compactWhitespace(segmentSidebarDoc);
    const sidebarListDoc = fileContent(
      "content/docs/components/file-viewer/navigation/sidebar-list.mdx",
    );
    const attachmentSidebarDoc = fileContent(
      "content/docs/components/file-viewer/navigation/file-viewer-attachments.mdx",
    );
    const sidebarDesign = fileContent(
      "design/sidebar-domain-composition-design.md",
    );
    const compactSidebarDesign = compactWhitespace(sidebarDesign);
    const segmentSidebar = fileContent(
      "registry/new-york-v4/ui/segment-sidebar.tsx",
    );
    const registrySource = fileContent("registry.json");

    expect(compactSidebarDoc).toContain(
      "`FileViewerProvider` owns sidebar open state, `FileViewer` owns mode resolution",
    );
    expect(compactSidebarDoc).toContain(
      "`FileViewerSidebar` owns spatial placement, declared width, side override, collapse behavior, and the rail's accessible label.",
    );
    expect(sidebarDoc).toContain(
      "Put domain meaning in the named rail component and accessible label",
    );
    expect(sidebarDoc).toContain('data-slot="file-viewer-header"');
    expect(compactSidebarDoc).toContain(
      "`FileViewerSidebarTrigger` is disabled until a `FileViewerSidebar` registers with the nearest `FileViewer` frame.",
    );
    expect(sidebarDoc).not.toContain("semantic wrapper");
    expect(sidebarDoc).not.toContain("data-viewer-purpose");
    expect(sidebarDoc).not.toContain("data-viewer-role");
    expect(compactSidebarDoc).toContain(
      "`SidebarList*` owns providerless grouped-row grammar",
    );
    expect(sidebarDoc).not.toContain('`SegmentSidebar` is the "list" surface');
    expect(sidebarListDoc).toContain(
      "`SidebarList*` primitives provide sidebar row grammar without",
    );
    expect(attachmentSidebarDoc).toContain(
      "`AttachmentSidebar` renders selectable file attachments",
    );
    expect(compactSegmentSidebarDoc).toMatch(
      /`SegmentSidebar` owns only the segment-row model and interaction semantics/,
    );
    expect(segmentSidebarDoc).toContain(
      "`SegmentSidebar` uses providerless `SidebarList*` primitives",
    );

    expect(segmentSidebar).not.toContain("EmbeddedSidebarProvider");
    expect(segmentSidebar).toContain("<SidebarListRoot");
    expect(registrySource).not.toContain('"name": "segmented-document-viewer"');
    expect(registrySource).not.toContain("segmented-document-viewer.tsx");

    expect(compactSidebarDesign).toContain(
      "`SegmentSidebar` inside `ViewerSidebar` is therefore a nested composition",
    );
    expect(compactSidebarDesign).toContain(
      "render a complete `PdfViewer bare` inside `ViewerSurface`",
    );
    expect(sidebarDesign).toContain(
      "MIME parts are currently email-owned rail content",
    );
    expect(sidebarDesign).not.toContain(
      "Make `EmailViewer` consume `AttachmentSidebar`",
    );
    expect(sidebarDesign).not.toContain(
      "`ViewerShell` as the shared compound viewer frame",
    );
    expect(sidebarDesign).not.toContain("`FileViewer slots`");
  });

  it("documents nested ViewerRoot and bare mode boundaries", () => {
    const emailViewerDoc = fileContent(
      "content/docs/components/file-viewer/renderers/email.mdx",
    );
    const fileViewerDoc = fileContent(
      "content/docs/components/file-viewer/index.mdx",
    );
    const compactFileViewerDoc = compactWhitespace(fileViewerDoc);

    expect(emailViewerDoc).toContain(
      "Nested `ViewerRoot` is correct only for a complete nested viewer.",
    );
    expect(emailViewerDoc).toContain("`message/rfc822`");
    expect(emailViewerDoc).toContain(
      "A `ViewerSidebarTrigger` always targets the nearest `ViewerRoot`",
    );
    expect(emailViewerDoc).toContain(
      '<EmailViewer message={nestedMessage} className="h-full"',
    );
    expect(emailViewerDoc).toContain(
      "<FileViewerPreview source={attachment.source}",
    );
    expect(emailViewerDoc).toContain(
      "Do not nest `ViewerRoot` just to add another controls row or border",
    );

    expect(fileViewerDoc).toContain(
      "Use the preview shell for the common case:",
    );
    expect(fileViewerDoc).toContain(
      "Use the composed shell when the file surface needs file-scoped sidebars",
    );
    expect(fileViewerDoc).toContain(
      "Use `FileViewerPreview` for standalone nested leaf previews",
    );
    expect(fileViewerDoc).not.toContain(
      "`FileViewer bare` removes the spatial frame when children are supplied.",
    );
  });

  it("documents FileViewer public subcomponent groups", () => {
    const docs = [
      "content/docs/components/file-viewer/index.mdx",
      "content/docs/components/file-viewer/anatomy/index.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-provider.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-preview.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-header.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-content.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-sidebar.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-inset.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-viewport.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-document.mdx",
      "content/docs/components/file-viewer/anatomy/file-viewer-states.mdx",
      "content/docs/components/file-viewer/header/index.mdx",
      "content/docs/components/file-viewer/header/file-viewer-title.mdx",
      "content/docs/components/file-viewer/header/file-viewer-controls.mdx",
      "content/docs/components/file-viewer/navigation/index.mdx",
      "content/docs/components/file-viewer/navigation/file-viewer-sidebar-trigger.mdx",
      "content/docs/components/file-viewer/navigation/file-viewer-sidebar-content.mdx",
      "content/docs/components/file-viewer/navigation/file-viewer-source-list.mdx",
    ]
      .map(fileContent)
      .join("\n");
    const anatomyMeta = fileContent(
      "content/docs/components/file-viewer/anatomy/meta.json",
    );
    const headerMeta = fileContent(
      "content/docs/components/file-viewer/header/meta.json",
    );
    const navigationMeta = fileContent(
      "content/docs/components/file-viewer/navigation/meta.json",
    );

    for (const page of [
      "file-viewer-provider",
      "file-viewer-preview",
      "file-viewer-viewport",
      "file-viewer-states",
    ]) {
      expect(anatomyMeta).toContain(`"${page}"`);
    }

    for (const page of ["file-viewer-title", "file-viewer-controls"]) {
      expect(headerMeta).toContain(`"${page}"`);
    }

    for (const page of [
      "file-viewer-sidebar-content",
      "file-viewer-source-list",
    ]) {
      expect(navigationMeta).toContain(`"${page}"`);
    }

    for (const component of [
      "FileViewerProvider",
      "FileViewer",
      "FileViewerPreview",
      "FileViewerHeader",
      "FileViewerTitle",
      "FileViewerControls",
      "FileViewerContent",
      "FileViewerSidebar",
      "FileViewerSidebarContent",
      "FileViewerSidebarFooter",
      "FileViewerSidebarHeader",
      "FileViewerSidebarSection",
      "FileViewerSidebarSectionHeader",
      "FileViewerSidebarSectionTitle",
      "FileViewerSidebarSectionAction",
      "FileViewerSidebarSectionContent",
      "FileViewerSidebarSeparator",
      "FileViewerInset",
      "FileViewerViewport",
      "FileViewerDocument",
      "FileViewerLoadingState",
      "FileViewerUnavailableState",
      "FileViewerEmptyState",
      "FileViewerErrorState",
      "FileViewerUnsupportedState",
      "FileViewerSourceList",
      "FileViewerSourceItem",
      "FileViewerSourceTrigger",
      "FileViewerSourceBadge",
      "FileViewerSourceAction",
      "FileViewerFieldSource",
      "FileViewerFieldSourceLabel",
      "FileViewerFieldSourceValue",
      "FileViewerFieldSourceStatus",
      "FileViewerSidebarTrigger",
    ]) {
      expect(docs, `${component} must be documented`).toContain(component);
    }
    expect(docs).not.toContain("FileViewerToolbar");
    expect(docs).not.toContain("file-viewer-toolbar");
  });

  it("keeps evidence and document-anchor pure after removing anchored provider", () => {
    const documentAnchor = fileContent(
      "registry/new-york-v4/ui/document-anchor.ts",
    );
    const documentEvidence = fileContent(
      "registry/new-york-v4/ui/document-evidence.ts",
    );
    const registry = readJson<Registry>("registry.json");
    const itemNames = registry.items.map((item) => item.name);

    expect(itemNames).toContain("document-evidence");
    expect(itemNames).not.toContain("anchored-evidence");
    expect(itemNames).not.toContain("anchored-document-viewer");
    expect(itemNames).not.toContain("pdf-anchor-target");
    expect(documentAnchor).toContain("export type DocumentAnchor");
    expect(documentAnchor).not.toContain('"use client"');
    expect(documentAnchor).not.toContain('from "react"');
    expect(documentEvidence).toContain("./document-anchor");
    expect(documentEvidence).toContain("EvidenceItem<Payload>");
    expect(documentEvidence).not.toContain("anchored-document-viewer");
    expect(documentEvidence).not.toContain("AnchoredItem");
    expect(documentEvidence).not.toContain("evidenceToAnchoredItem");
    expect(documentEvidence).not.toContain("evidenceItemsToAnchoredItems");
  });

  it("keeps source field link vocabulary in its adapter module", () => {
    const sourceFieldLink = fileContent(
      "registry/new-york-v4/ui/source-field-link.ts",
    );

    expect(sourceFieldLink).toContain("export type SourceFieldLink");
    expect(sourceFieldLink).toContain(
      "export function useSegmentedSourceFieldLink",
    );
    expect(sourceFieldLink).toContain("useSegmentedItemLink");
    expect(sourceFieldLink).not.toContain("anchored-document-viewer");
    expect(sourceFieldLink).not.toContain("useAnchoredItemLink");
    expect(sourceFieldLink).not.toContain("useAnchoredSourceFieldLink");
  });

  it("keeps source anchor conversion pure and source evidence adapter-free", () => {
    const sourceAnchor = fileContent(
      "registry/new-york-v4/ui/source-anchor.ts",
    );
    const sourceEvidence = fileContent(
      "registry/new-york-v4/ui/source-evidence.ts",
    );
    const documentEvidence = fileContent(
      "registry/new-york-v4/ui/document-evidence.ts",
    );

    expect(sourceAnchor).not.toContain('"use client"');
    expect(sourceAnchor).not.toContain('from "react"');
    expect(sourceAnchor).toContain("./document-anchor");
    expect(sourceAnchor).not.toContain("./anchored-document-viewer");
    expect(sourceAnchor).not.toContain(".tsx");
    expect(sourceAnchor).not.toContain("pdf-anchor-target");
    expect(sourceAnchor).not.toContain("pdf-source");
    expect(sourceAnchor).not.toContain("image-source");
    expect(sourceAnchor).not.toContain("text-source");
    expect(sourceAnchor).not.toContain("csv-source");
    expect(sourceAnchor).not.toContain("xlsx-source");
    expect(sourceAnchor).not.toContain("docx-source");
    expect(sourceEvidence).toContain("./source-anchor");
    expect(sourceEvidence).toContain("./document-evidence");
    expect(sourceEvidence).toContain("SourceEvidencePayload");
    expect(sourceEvidence).toContain("payload:");
    expect(documentEvidence).toContain("EvidenceItem<Payload>");
    expect(documentEvidence).not.toContain("metadata?:");
    expect(documentEvidence).not.toContain("label:");
    expect(documentEvidence).not.toContain("confidence");
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
        `source-evidence imports ${forbidden}`,
      ).toBe(false);
    }
  });

  it("keeps Sources/OCR projection in evidence and model modules", () => {
    const segmentedProvider = fileContent(
      "registry/new-york-v4/ui/segmented-document-provider.tsx",
    );
    const segmentedModel = fileContent(
      "registry/new-york-v4/ui/segmented-document-model.ts",
    );
    const segmentedItemLink = fileContent(
      "registry/new-york-v4/ui/segmented-item-link.ts",
    );
    const sourceSegmentedModel = fileContent(
      "registry/new-york-v4/ui/source-segmented-document-model.ts",
    );
    const layoutSegmentedModel = fileContent(
      "registry/new-york-v4/ui/layout-blocks-segmented-document-model.ts",
    );
    const sourceFieldList = fileContent(
      "registry/new-york-v4/ui/source-field-list.tsx",
    );
    const layoutPanel = fileContent(
      "registry/new-york-v4/ui/layout-blocks-panel.tsx",
    );
    const layoutBlocks = fileContent(
      "registry/new-york-v4/ui/layout-blocks.tsx",
    );

    expect(segmentedProvider).not.toContain("document-source");
    expect(segmentedProvider).not.toContain("source-evidence");
    expect(segmentedProvider).not.toMatch(
      /\b(?:partitionMode|splitMode|ocrMode|sourceMode|emailMode|workflowMode)\b/,
    );
    expect(segmentedModel).not.toMatch(
      /\b(?:partitionMode|splitMode|ocrMode|sourceMode|emailMode|workflowMode)\b/,
    );
    expect(segmentedItemLink).not.toMatch(
      /\b(?:partitionMode|splitMode|ocrMode|sourceMode|emailMode|workflowMode)\b/,
    );
    expect(segmentedProvider).not.toContain(
      "export type SegmentedDocumentContextValue",
    );
    expect(segmentedProvider).not.toContain(
      "export function useSegmentedDocument(",
    );
    expect(segmentedProvider).toContain("function useSegmentedDocumentContext");
    expect(segmentedProvider).toContain(
      "export function useSegmentedDocumentViewport",
    );
    expect(segmentedProvider).toContain(
      "export function useSegmentedDocumentModel",
    );
    expect(segmentedModel).not.toContain("document-source");
    expect(segmentedModel).toContain(
      "Viewport/navigation projection used for page ownership and jumps.",
    );
    expect(segmentedModel).toContain(
      "domain vote/output semantics stay outside",
    );
    expect(segmentedItemLink).toContain("export function useSegmentedItemLink");
    expect(segmentedItemLink).toContain("useSegmentedDocumentModel");
    expect(segmentedItemLink).toContain("useSegmentedDocumentViewport");
    expect(segmentedItemLink).not.toContain("useSegmentedDocument()");
    expect(segmentedItemLink).toContain("activeAnchors");
    expect(segmentedItemLink).toContain("anchorsBySegmentId");
    expect(segmentedItemLink).toContain("scrollToAnchor(anchor, options)");
    expect(segmentedItemLink).toContain(
      "scrollToSegmentStart(segment, options)",
    );
    expect(sourceSegmentedModel).toContain("@/lib/document-source");
    expect(sourceSegmentedModel).toContain("createSegmentedDocumentModel");
    expect(sourceSegmentedModel).toContain(
      "export function createSourcesSegmentedDocumentModel",
    );
    expect(sourceSegmentedModel).not.toContain(
      "export function sourceFieldsToSegmentedDocumentModel",
    );
    expect(sourceSegmentedModel).not.toContain(
      "export function sourceMapToSegmentedDocumentModel",
    );
    expect(sourceSegmentedModel).toContain(
      "export function sourceToSegmentAnchor",
    );
    expect(layoutSegmentedModel).toContain(
      "export function createOcrSegmentedDocumentModel",
    );
    expect(layoutSegmentedModel).toContain("createSegmentedDocumentModel");
    expect(layoutSegmentedModel).toContain("layout-blocks-types");
    expect(sourceFieldList).toContain("InteractiveItemList");
    expect(sourceFieldList).toContain("sourceFieldToEvidenceItem");
    expect(sourceFieldList).toContain("item.payload");
    expect(layoutPanel).toContain("InteractiveItemList");
    expect(layoutPanel).toContain("LayoutEvidenceItem");
    expect(layoutPanel).toContain("item.payload");
    expect(layoutPanel).not.toContain("metadata");
    expect(layoutBlocks).toContain("createLayoutBlocksViewerModel");
    expect(layoutBlocks).toContain("createOcrSegmentedDocumentModel");
    expect(layoutBlocks).toContain("SegmentedDocumentProvider");
    expect(layoutBlocks).toContain("useSegmentedItemLink");
    expect(layoutBlocks).toContain("useSegmentedDocumentViewport");
    expect(layoutBlocks).toContain("setDocumentHandle(handle)");
    expect(layoutBlocks).not.toContain("useSegmentedDocumentModel");
    expect(layoutBlocks).not.toContain("anchorsBySegmentId");
    expect(layoutBlocks).toContain("onScrollProgressChange");
    expect(layoutBlocks).toContain("onVisiblePageChange");
    expect(layoutBlocks).not.toContain("AnchoredDocumentProvider");
    expect(layoutBlocks).not.toContain("useAnchoredDocument");
    expect(layoutBlocks).not.toContain("usePdfAnchoredTarget");
    expect(layoutBlocks).not.toContain("map((item) => ({");
    expect(layoutBlocks).not.toContain("anchor: {");
  });

  it("keeps bbox source blocks on segmented document mechanics", () => {
    const sourceFieldLink = fileContent(
      "registry/new-york-v4/ui/source-field-link.ts",
    );
    const jsonFormSources = fileContent(
      "registry/new-york-v4/blocks/json-form-sources-block.tsx",
    );
    const imageSources = fileContent(
      "registry/new-york-v4/blocks/image-sources-block.tsx",
    );
    const extractSources = fileContent(
      "registry/new-york-v4/blocks/extract-viewer-block.tsx",
    );
    const sourcesViewer = fileContent(
      "registry/new-york-v4/blocks/sources-viewer-block.tsx",
    );
    const sourceSegmentedOverlays = fileContent(
      "registry/new-york-v4/ui/source-segmented-document-overlays.tsx",
    );

    expect(sourceFieldLink).toContain(
      "export function useSegmentedSourceFieldLink",
    );
    expect(sourceFieldLink).toContain("useSegmentedItemLink");
    expect(sourceFieldLink).toContain("activeAnchors");
    expect(sourceFieldLink).not.toContain("anchorsBySegmentId");
    expect(sourceFieldLink).not.toContain("scrollToAnchor(anchor, options)");
    expect(sourceFieldLink).not.toContain(
      "scrollToSegmentStart(segment, options)",
    );

    for (const [file, content] of [
      ["json-form-sources-block", jsonFormSources],
      ["image-sources-block", imageSources],
      ["extract-viewer-block", extractSources],
    ] as const) {
      expect(content, `${file} uses segmented provider`).toContain(
        "SegmentedDocumentProvider",
      );
      expect(content, `${file} uses segmented field link`).toContain(
        "useSegmentedSourceFieldLink",
      );
      expect(content, `${file} uses shared source overlay helpers`).toContain(
        "source-segmented-document-overlays",
      );
      expect(content, `${file} tracks current page`).toContain(
        "onCurrentPageChange",
      );
      expect(content, `${file} tracks scroll progress`).toContain(
        "onScrollProgressChange",
      );
      expect(content, `${file} uses source segmented adapter`).toContain(
        "source-segmented-document-model",
      );
      expect(content, `${file} does not use anchored provider`).not.toContain(
        "AnchoredDocumentProvider",
      );
      expect(content, `${file} does not use anchored hook`).not.toContain(
        "useAnchoredDocument",
      );
    }

    expect(jsonFormSources).toContain("createSourcesSegmentedDocumentModel");
    expect(jsonFormSources).toContain("useSegmentedPdfSourceOverlay");
    expect(jsonFormSources).not.toContain("usePdfAnchoredTarget");
    expect(jsonFormSources).not.toContain("usePdfAnchoredOverlay");
    expect(imageSources).toContain("createSourcesSegmentedDocumentModel");
    expect(imageSources).toContain("useSegmentedImageSourceOverlay");
    expect(extractSources).toContain("createSourcesSegmentedDocumentModel");
    expect(extractSources).toContain("PdfViewerPages");
    expect(extractSources).toContain("useSegmentedPdfSourceOverlay");
    expect(sourcesViewer).toContain("createSourcesSegmentedDocumentModel");
    expect(sourcesViewer).toContain("function SourceLinkedViewer");
    expect(sourcesViewer).toContain("function SourceLinkedFileHeader");
    expect(sourcesViewer).not.toContain("Source-linked results");
    expect(sourcesViewer).toContain("SegmentedDocumentProvider");
    expect(sourcesViewer).toContain("useSegmentedSourceFieldLink");
    expect(sourcesViewer).toContain("useSegmentedPdfSourceOverlay");
    expect(sourcesViewer).toContain("useSegmentedImageSourceOverlay");
    expect(sourcesViewer).not.toContain("SegmentedSourcesShell");
    expect(sourcesViewer).not.toContain("AnchoredDocumentProvider");
    expect(sourcesViewer).not.toContain("useAnchoredDocument");
    expect(sourcesViewer).not.toContain("pdf-anchor-target");
    expect(sourceSegmentedOverlays).toContain("setDocumentHandle");
    expect(sourceSegmentedOverlays).toContain("useSegmentedPdfViewerHandle");
    expect(sourceSegmentedOverlays).toContain("useSegmentedImageViewerHandle");
    expect(sourceSegmentedOverlays).toContain("activeAnchorsForPage");
    expect(sourceSegmentedOverlays).toContain("PdfHighlight");
    expect(sourceSegmentedOverlays).toContain("scrollToFrameArea");
  });

  it("keeps source blocks from rebuilding document anchors inline", () => {
    const evidenceSourceBlocks = [
      "registry/new-york-v4/blocks/text-sources-block.tsx",
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
      "registry/new-york-v4/blocks/xlsx-sources-block.tsx",
      "registry/new-york-v4/blocks/docx-sources-block.tsx",
      "registry/new-york-v4/blocks/json-form-sources-block.tsx",
      "registry/new-york-v4/blocks/sources-viewer-block.tsx",
    ];
    const forbidden = [
      "sourceToPdfAnchor",
      "imageAnchorToTarget",
      "textAnchorToTarget",
      "csvAnchorToTarget",
      "xlsxAnchorToTarget",
      "docxAnchorToTarget",
      "sourceToDocumentAnchor",
      "sourcesToAnchoredItems",
    ];

    for (const file of evidenceSourceBlocks) {
      const content = fileContent(file);
      expect(content, `${file} uses segmented source projection`).toContain(
        "source-segmented-document-model",
      );
      expect(content, `${file} uses segmented field link`).toContain(
        "useSegmentedSourceFieldLink",
      );
      expect(content, `${file} uses segmented provider`).toContain(
        "SegmentedDocumentProvider",
      );
    }

    for (const file of [
      ...evidenceSourceBlocks,
      "registry/new-york-v4/blocks/image-sources-block.tsx",
      "registry/new-york-v4/blocks/extract-viewer-block.tsx",
    ]) {
      const content = fileContent(file);
      for (const symbol of forbidden) {
        expect(content.includes(symbol), `${file} contains ${symbol}`).toBe(
          false,
        );
      }
    }
  });

  it("registers document evidence files as installable registry artifacts", () => {
    const registry = readJson<Registry>("registry.json");
    const itemsByName = new Map(
      registry.items.map((item) => [item.name, item]),
    );

    expect(itemsByName.get("document-evidence")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/document-evidence.ts",
      }),
    ]);
    expect(itemsByName.get("interactive-item-list")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/interactive-item-list.tsx",
      }),
      expect.objectContaining({
        path: "registry/new-york-v4/ui/measured-row-virtualization.ts",
      }),
    ]);
    expect(itemsByName.get("source-evidence")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-evidence.ts",
      }),
    ]);
    expect(itemsByName.get("source-anchor")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-anchor.ts",
      }),
    ]);
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
      ]),
    );
    expect(itemsByName.get("source-segmented-document")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-segmented-document-model.ts",
      }),
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-segmented-document-overlays.tsx",
      }),
    ]);
    expect(itemsByName.get("layout-blocks-segmented-document")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/layout-blocks-segmented-document-model.ts",
      }),
    ]);
    expect(itemsByName.get("source-field-link")?.files).toEqual([
      expect.objectContaining({
        path: "registry/new-york-v4/ui/source-field-link.ts",
      }),
    ]);
    expect(itemsByName.get("source-field-link")?.registryDependencies).toEqual(
      expect.arrayContaining(["@retab/segmented-document"]),
    );
    expect(
      itemsByName.get("source-field-link")?.registryDependencies,
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"]),
    );
    expect(itemsByName.get("layout-blocks")?.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "registry/new-york-v4/ui/layout-blocks-model.ts",
        }),
        expect.objectContaining({
          path: "registry/new-york-v4/ui/layout-blocks-segmented-document-model.ts",
        }),
      ]),
    );
    expect(itemsByName.get("source-field-list")?.registryDependencies).toEqual(
      expect.arrayContaining([
        "@retab/interactive-item-list",
        "@retab/source-field-link",
        "@retab/source-evidence",
      ]),
    );
    expect(itemsByName.get("source-evidence")?.registryDependencies).toEqual(
      expect.arrayContaining([
        "@retab/document-evidence",
        "@retab/source-anchor",
      ]),
    );
    expect(
      itemsByName.get("source-segmented-document")?.registryDependencies,
    ).toEqual(
      expect.arrayContaining([
        "@retab/document-source",
        "@retab/segmented-document",
      ]),
    );
    expect(
      itemsByName.get("layout-blocks-segmented-document")?.registryDependencies,
    ).toEqual(
      expect.arrayContaining([
        "@retab/layout-blocks",
        "@retab/segmented-document",
      ]),
    );
    expect(itemsByName.get("layout-blocks")?.registryDependencies).toEqual(
      expect.arrayContaining([
        "@retab/document-evidence",
        "@retab/interactive-item-list",
        "@retab/segmented-document",
      ]),
    );
    expect(itemsByName.get("layout-blocks")?.registryDependencies).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"]),
    );
    expect(
      itemsByName.get("json-form-sources-block")?.registryDependencies,
    ).toEqual(
      expect.arrayContaining([
        "@retab/segmented-document",
        "@retab/source-segmented-document",
      ]),
    );
    expect(
      itemsByName.get("json-form-sources-block")?.registryDependencies,
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"]),
    );
    expect(
      itemsByName.get("image-sources-block")?.registryDependencies,
    ).toEqual(
      expect.arrayContaining([
        "@retab/segmented-document",
        "@retab/source-segmented-document",
      ]),
    );
    expect(
      itemsByName.get("image-sources-block")?.registryDependencies,
    ).not.toEqual(expect.arrayContaining(["anchored-document-viewer"]));
    expect(
      itemsByName.get("extract-viewer-block")?.registryDependencies,
    ).toEqual(
      expect.arrayContaining([
        "@retab/segmented-document",
        "@retab/source-segmented-document",
      ]),
    );
    expect(
      itemsByName.get("extract-viewer-block")?.registryDependencies,
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"]),
    );
    expect(
      itemsByName.get("sources-viewer-block")?.registryDependencies,
    ).toEqual(
      expect.arrayContaining([
        "@retab/segmented-document",
        "@retab/source-segmented-document",
      ]),
    );
    expect(
      itemsByName.get("sources-viewer-block")?.registryDependencies,
    ).not.toEqual(
      expect.arrayContaining(["anchored-document-viewer", "pdf-anchor-target"]),
    );
  });

  it("keeps source examples on provider, body, sidebar, surface grammar", () => {
    const examples = [
      {
        file: "registry/new-york-v4/blocks/extract-viewer-block.tsx",
        symbols: [
          "<SegmentedDocumentProvider",
          "<ExtractViewerContent",
          "<FileViewerProvider",
          "<FileViewer",
          "<FileViewerHeader",
          "<FileViewerContent",
          "<FileViewerInset",
          "<FileViewerViewport",
          "<PdfViewerProvider",
          "<PdfViewerPages",
          "<FileViewerSidebar",
          "<JsonForm",
        ],
      },
      {
        file: "registry/new-york-v4/ui/layout-blocks.tsx",
        symbols: [
          "<SegmentedDocumentProvider",
          "<OcrLayoutBlocksContent",
          "<ViewerRoot",
          "<ViewerBody",
          "<ViewerSurface",
          "<FileViewerProvider",
          "<FileViewer",
          "<PdfViewerProvider",
          "<FileViewerContent",
          "<FileViewerInset",
          "<FileViewerViewport",
          "<PdfViewerPages",
          "<ViewerSidebar",
          "<LayoutBlocksPanel",
        ],
      },
      {
        file: "components/viewers/edit/edit-viewer-anatomy.tsx",
        symbols: [
          "<ViewerRoot",
          "<EditViewerHeader",
          "<ViewerBody",
          "<ViewerSurface",
          "<EditViewerDocument",
          "<ViewerSidebar",
          "<EditViewerFields",
        ],
      },
    ];

    for (const { file, symbols } of examples) {
      expectJsxTagsInOrder(file, symbols);
    }
  });

  it("keeps edit viewer provider and parts on clean composition boundaries", () => {
    const easyApi = fileContent("components/viewers/edit/edit-viewer.tsx");
    const provider = fileContent(
      "components/viewers/edit/edit-viewer-provider.tsx",
    );
    const anatomy = fileContent(
      "components/viewers/edit/edit-viewer-anatomy.tsx",
    );
    const store = fileContent("components/viewers/edit/edit-viewer-store.tsx");
    const editRegistry = fileContent("public/r/edit-viewer-block.json");
    const editRegistryEasyApi = publicRegistryFileContent(
      "edit-viewer-block",
      "components/viewers/edit/edit-viewer.tsx",
    );
    const header = fileContent(
      "components/viewers/edit/edit-viewer-header.tsx",
    );
    const document = fileContent(
      "components/viewers/edit/edit-viewer-document.tsx",
    );
    const fields = fileContent(
      "components/viewers/edit/edit-viewer-fields.tsx",
    );
    const overlays = fileContent(
      "components/viewers/edit/edit-viewer-overlays.tsx",
    );
    const fieldPanel = fileContent(
      "components/viewers/edit/edit-viewer-field-panel.tsx",
    );
    const model = fileContent("components/viewers/edit/edit-viewer-model.ts");
    const types = fileContent("components/viewers/edit/edit-viewer-types.ts");
    const editDocsPath = "content/docs/components/edit-viewer.mdx";
    const docs = existsSync(join(repoRoot, editDocsPath))
      ? fileContent(editDocsPath)
      : null;
    const editFiles = readdirSync(join(repoRoot, "components/viewers/edit"))
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => ({
        file,
        content: fileContent(`components/viewers/edit/${file}`),
      }));

    expect(easyApi).toContain("EditViewerProvider");
    expect(easyApi).toContain("EditViewerHeader");
    expect(easyApi).toContain("EditViewerDocument");
    expect(easyApi).toContain("EditViewerFields");
    expect(
      namedReExports(easyApi, "./edit-viewer-provider", { typeOnly: false }),
    ).toEqual(["EditViewerProvider"]);
    expect(
      namedReExports(easyApi, "./edit-viewer-provider", { typeOnly: true }),
    ).toEqual(["EditViewerProviderProps"]);
    expect(easyApi).toContain('from "./edit-viewer-anatomy"');
    expect(easyApi).toContain('from "./edit-viewer-provider"');
    expect(easyApi).not.toContain("EditViewerRoot");
    expect(easyApi).not.toContain("<ViewerRoot");
    expect(easyApi).not.toContain("<ViewerSidebar");
    expect(easyApi).not.toContain("EditStore");
    expect(easyApi).not.toContain("useEditStore");
    expect(easyApi).not.toContain("useAnchoredDocument");
    expect(easyApi).not.toContain("AnchoredDocumentProvider");
    expect(easyApi).not.toContain("useEditViewerController");
    expect(easyApi).not.toContain("EditViewerContent");
    expect(easyApi).not.toContain("export function EditViewerRoot");
    expect(easyApi).not.toContain("const edit = useEditViewer()");
    expect(easyApi).not.toContain("useEditViewerLayout");
    expect(easyApi).not.toContain("useEditViewerBusy(");
    expect(easyApi).not.toContain("useEditViewerEmpty(");
    expect(easyApi).not.toContain("useInternalEditViewer");
    expect(easyApi).not.toContain("useEditViewerContext");
    expect(easyApi).not.toContain("EditViewerContext");
    expect(easyApi).not.toContain("useEditViewerFrameState");
    expect(easyApi).not.toContain("useEditViewerChromeState");
    expect(easyApi).not.toContain("useEditViewerDocument");
    expect(easyApi).not.toContain("useEditViewerFields");
    expect(easyApi).not.toContain("EditViewerDocumentState");
    expect(easyApi).not.toContain("EditViewerFieldsPartState");

    expect(provider).toContain("SegmentedDocumentProvider");
    expect(provider).toContain("useSegmentedItemLink");
    expect(provider).toContain("createEditViewerSegmentedDocumentModel");
    expect(provider).not.toContain("AnchoredDocumentProvider");
    expect(provider).not.toContain("useAnchoredDocument");
    expect(provider).not.toContain("usePdfAnchoredTarget");
    expect(provider).not.toContain("pdf-anchor-target");
    expect(provider).toContain("createEditViewerFieldProjection");
    expect(provider).toContain("resolveEditViewerDocumentTarget");
    expect(provider).toContain("useEditViewerSelectionBridge");
    expect(provider).toContain("useEditViewerPageOverlay");
    expect(provider).not.toContain("editAnchorItemToAnchoredItem");
    expect(provider).toContain("EditStoreProvider");
    expect(provider).not.toContain("useEditStore");
    expect(provider).not.toContain("const EditViewerContext");
    expect(provider).not.toContain("function useEditViewerContext");
    expect(provider).not.toContain("export const EditViewerContext");
    expect(provider).not.toContain("export function useEditViewer(");
    expect(provider).not.toContain("export type EditViewerState");
    expect(provider).not.toContain("export type EditViewerChromeState");
    expect(provider).not.toContain("export function useEditViewerFrameState");
    expect(provider).not.toContain("export function useEditViewerChromeState");
    expect(provider).not.toContain("useEditViewerFrameState");
    expect(provider).not.toContain("useEditViewerChromeState");
    expect(provider).not.toContain(
      "export function useEditViewerLayout(): EditViewerLayoutState",
    );
    expect(provider).not.toContain(
      "export function useEditViewerBusy(): EditViewerBusyState",
    );
    expect(provider).not.toContain(
      "export function useEditViewerEmpty(): EditViewerEmptyStatusState",
    );
    expect(provider).not.toContain("export function useEditViewerHeader");
    expect(provider).not.toContain("useInternalEditViewer");
    expect(provider).not.toContain("export type EditViewerContextValue");
    expect(provider).not.toContain("export function useEditViewerDocument");
    expect(provider).not.toContain("export function useEditViewerFields");
    expect(provider).not.toContain("export type EditViewerDocumentState");
    expect(provider).not.toContain("export type EditViewerFieldsPartState");
    expect(provider).not.toContain("<ViewerRoot");
    expect(provider).not.toContain("<ViewerSidebar");
    expect(provider).not.toContain("<ViewerSurface");
    expect(store).toContain("const EditStoreContext");
    expect(store).toContain("export function useEditStore");
    expect(store).not.toContain("EditViewerContext");
    expect(store).not.toContain("EditViewerContextValue");
    expect(store).not.toContain("useEditViewerContext");
    expect(anatomy).toContain("<ViewerRoot");
    expect(anatomy).toContain("<EditViewerHeader");
    expect(anatomy).toContain("<ViewerBody");
    expect(anatomy).toContain("<ViewerSurface");
    expect(anatomy).toContain("<EditViewerDocument");
    expect(anatomy).toContain("<ViewerSidebar");
    expect(anatomy).toContain("<EditViewerFields");
    expect(anatomy).toContain("useEditStore");
    expect(anatomy).toContain("EditViewerHeaderView");
    expect(anatomy).toContain("EditViewerDocumentView");
    expect(anatomy).toContain("EditViewerFieldsView");
    expect(anatomy).not.toContain("export function EditViewerRoot");
    expect(anatomy).not.toContain("export function EditViewerBusyOverlay");
    expect(anatomy).not.toContain("export function EditViewerEmptyState");
    expect(anatomy).not.toContain("useEditViewerContext");
    expect(anatomy).not.toContain("useEditViewerFrameState");
    expect(anatomy).not.toContain("useEditViewerChromeState");
    expect(editRegistry).not.toContain("edit-viewer-internal-context.tsx");
    expect(editRegistry).toContain("edit-viewer-anatomy.tsx");
    expect(editRegistry).toContain("edit-viewer-store.tsx");
    expect(editRegistry).not.toContain("useInternalEditViewer");
    expect(editRegistry).not.toContain("export function useEditViewer(");
    expect(editRegistry).not.toContain("export type EditViewerState");
    expect(editRegistry).not.toContain("export type EditViewerChromeState");
    expect(editRegistry).not.toContain(
      "export function useEditViewerFrameState",
    );
    expect(editRegistry).not.toContain(
      "export function useEditViewerChromeState",
    );
    expect(editRegistry).not.toContain("useEditViewerFrameState");
    expect(editRegistry).not.toContain("useEditViewerChromeState");
    expect(editRegistry).not.toContain(
      "export function useEditViewerLayout(): EditViewerLayoutState",
    );
    expect(editRegistry).not.toContain("export type EditViewerContextValue");
    expect(editRegistry).not.toContain("export function useEditViewerDocument");
    expect(editRegistry).not.toContain("export function useEditViewerFields");
    expect(editRegistry).not.toContain("export type EditViewerFieldsPartState");
    expect(editRegistryEasyApi).not.toContain("const edit = useEditViewer()");
    expect(editRegistryEasyApi).toContain('from "./edit-viewer-anatomy"');
    expect(editRegistryEasyApi).not.toContain("EditStore");
    expect(editRegistryEasyApi).not.toContain("useEditStore");
    expect(editRegistryEasyApi).not.toContain("useInternalEditViewer");
    expect(editRegistryEasyApi).not.toContain("useEditViewerFrameState");
    expect(editRegistryEasyApi).not.toContain("useEditViewerChromeState");
    expect(editRegistryEasyApi).not.toContain("useEditViewerDocument");
    expect(editRegistryEasyApi).not.toContain("useEditViewerFields");
    expect(editRegistryEasyApi).not.toContain("EditViewerDocumentState");
    expect(editRegistryEasyApi).not.toContain("EditViewerFieldsPartState");
    expect(provider).not.toContain("function resolveEditViewerDocumentTarget");
    expect(provider).not.toContain("function createEditViewerFieldMap");

    expect(model).toContain("createEditViewerFieldProjection");
    expect(model).toContain("createEditViewerSegmentedDocumentModel");
    expect(model).toContain("createSegmentedDocumentModel");
    expect(model).toContain("editFieldTargetFromBBox");
    expect(model).toContain("normalizeEditViewerFieldLocation");
    expect(model).toContain("getEditViewerPdfAreaAnchor");
    expect(model).toContain('targetStatus: { state: "invalid"');
    expect(model).toContain("resolveEditViewerDocumentTarget");
    expect(model).not.toContain('from "react"');
    expect(model).not.toContain("anchored-document-viewer");
    expect(types).toContain("EditViewerDocumentSource");
    expect(types).toContain("target: DocumentAnchor | null");
    expect(types).toContain("EditViewerFieldTargetStatus");
    expect(types).not.toContain("interface EditViewerDocument ");
    expect(overlays).toContain("getEditViewerPdfAreaAnchor");
    expect(overlays).not.toContain("field.bbox");
    if (docs) {
      expect(docs.indexOf("## Composition")).toBeLessThan(
        docs.indexOf("## Easy API"),
      );
      expect(docs).not.toContain("EditViewerRoot");
      expect(docs).toContain("EditViewerFields` is content-only");
    }
    expect(
      editFiles
        .filter(({ content }) => content.includes("useAnchoredDocument"))
        .map(({ file }) => file),
    ).toEqual([]);

    expect(header).toContain("ViewerHeader");
    expect(header).toContain("ViewerSidebarTrigger");
    expect(header).not.toContain("EditViewerContext");
    expect(header).not.toContain("useEditViewerContext");
    expect(header).not.toContain("useEditViewerChromeState");
    expect(document).toContain("EditViewerDocumentPane");
    expect(document).not.toContain("ViewerRoot");
    expect(document).not.toContain("ViewerSidebar");
    expect(document).not.toContain("useEditViewerDocument");
    expect(fields).toContain("EditViewerFieldPanel");
    expect(fields).not.toContain("ViewerSidebar");
    expect(fields).not.toContain("useEditViewerFields");
    expect(fieldPanel).not.toContain("ViewerSidebar");
    expect(fieldPanel).not.toContain("useEditViewer");
    expect(
      existsSync(
        join(repoRoot, "components/viewers/edit/use-edit-viewer-controller.ts"),
      ),
    ).toBe(false);
  });

  it("keeps source blocks on segmented viewer sidebar plus content-list composition", () => {
    const segmentedSourceBlocks = [
      "registry/new-york-v4/blocks/text-sources-block.tsx",
      "registry/new-york-v4/blocks/csv-sources-block.tsx",
      "registry/new-york-v4/blocks/xlsx-sources-block.tsx",
      "registry/new-york-v4/blocks/docx-sources-block.tsx",
    ];
    const sourceFieldList = fileContent(
      "registry/new-york-v4/ui/source-field-list.tsx",
    );

    expect(sourceFieldList).not.toContain("<aside");
    expect(sourceFieldList).not.toContain("<ViewerSidebar");
    expect(sourceFieldList).toContain('data-slot="source-field-list"');

    for (const file of segmentedSourceBlocks) {
      expectJsxTagsInOrder(file, [
        "<SegmentedDocumentProvider",
        "<FileViewer",
        "<FileViewerContent",
        "<FileViewerInset",
        "<FileViewerSidebar",
        "<SourceFieldList",
      ]);
      const content = fileContent(file);
      expect(content).toContain('aria-label="Source fields"');
      expect(content).toContain("useSegmentedSourceFieldLink");
      expect(content).toContain("createSourcesSegmentedDocumentModel");
      expect(content).not.toContain("AnchoredDocumentProvider");
      expect(content).not.toContain("useAnchoredDocument");
      expect(content).not.toContain("useAnchoredSourceFieldLink");
    }

    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/image-sources-block.tsx",
      [
        "<SegmentedDocumentProvider",
        "<FileViewer",
        "<FileViewerContent",
        "<FileViewerInset",
        "<FileViewerSidebar",
        "<SourceFieldList",
      ],
    );
    expect(
      fileContent("registry/new-york-v4/blocks/image-sources-block.tsx"),
    ).toContain('aria-label="Source fields"');

    expectJsxTagsInOrder(
      "registry/new-york-v4/blocks/json-form-sources-block.tsx",
      [
        "<SegmentedDocumentProvider",
        "<FileViewerProvider",
        "<FileViewer",
        "<FileViewerHeader",
        "<FileViewerContent",
        "<FileViewerInset",
        "<FileViewerViewport",
        "<PdfViewerProvider",
        "<PdfViewerPages",
        "<FileViewerSidebar",
        "<JsonForm",
      ],
    );
    expect(
      fileContent("registry/new-york-v4/blocks/json-form-sources-block.tsx"),
    ).toContain('aria-label="Source-linked fields"');
  });

  it("teaches compound viewer composition before easy APIs", () => {
    for (const {
      file,
      provider,
      root,
      easyApi,
    } of compoundViewerDocContracts) {
      const content = fileContent(file);
      const compositionIndex = content.search(/^## Viewer Composition/im);
      const usageIndex = content.search(/^## Usage/im);

      expect(
        compositionIndex,
        `${file} has a Viewer Composition section`,
      ).toBeGreaterThanOrEqual(0);
      expect(usageIndex, `${file} has a Usage section`).toBeGreaterThanOrEqual(
        0,
      );
      expect(
        compositionIndex,
        `${file} teaches composition before easy API usage`,
      ).toBeLessThan(usageIndex);

      const compositionSection = content.slice(compositionIndex, usageIndex);
      const usageSection = content.slice(usageIndex);

      expect(
        compositionSection.includes(provider),
        `${file} composition section includes ${provider}`,
      ).toBe(true);
      expect(
        compositionSection.includes(root),
        `${file} composition section includes ${root}`,
      ).toBe(true);
      expect(
        usageSection.includes(easyApi),
        `${file} usage section includes ${easyApi}`,
      ).toBe(true);
    }
  });

  it("lists every relative internal module imported by registry viewer entries", () => {
    const registry = readJson<Registry>("registry.json");
    const registryItemsByName = new Map(
      registry.items.map((item) => [item.name, item]),
    );
    const missingModules: string[] = [];

    for (const item of viewerRegistryItems(registry)) {
      const listedFiles = new Set(item.files.map((file) => file.path));
      const bareDependencies = new Set(item.registryDependencies ?? []);
      const dependencyFiles = new Set(
        (item.registryDependencies ?? []).flatMap(
          (name) =>
            registryItemsByName
              .get(registryDependencyItemName(name))
              ?.files.map((file) => file.path) ?? [],
        ),
      );

      for (const file of item.files) {
        const content = fileContent(file.path);
        for (const specifier of importSpecifiers(content)) {
          const importedFile = resolveRelativeImport(file.path, specifier);
          if (!importedFile?.startsWith("registry/new-york-v4/")) continue;
          if (listedFiles.has(importedFile)) continue;
          if (dependencyFiles.has(importedFile)) continue;
          // Imports that resolve to a migrated stock-shadcn primitive are
          // satisfied by a bare registry dependency (button, dropdown-menu, …),
          // which no longer ships its own files inside registry.json.
          if (
            migratedShadcnPrimitiveFiles.has(importedFile) &&
            bareDependencies.has(
              importedFile
                .replace(/^registry\/new-york-v4\/ui\//, "")
                .replace(/\.tsx$/, ""),
            )
          ) {
            continue;
          }
          missingModules.push(
            `${item.name}: ${file.path} imports ${importedFile}`,
          );
        }
      }
    }

    expect(missingModules).toEqual([]);
  });

  it("keeps sidebar primitive dependency topology exact", () => {
    const registry = readJson<Registry>("registry.json");
    const itemByName = new Map(registry.items.map((item) => [item.name, item]));
    const sidebar = itemByName.get("sidebar");
    const sidebarRow = itemByName.get("sidebar-row");
    const sidebarList = itemByName.get("sidebar-list");
    const segmentSidebar = itemByName.get("segment-sidebar");
    const attachmentSidebar = itemByName.get("attachment-sidebar");
    const sidebarSource = fileContent("registry/new-york-v4/ui/sidebar.tsx");
    const sidebarListSource = fileContent(
      "registry/new-york-v4/ui/sidebar-list.tsx",
    );
    const attachmentSidebarSource = fileContent(
      "registry/new-york-v4/ui/attachment-sidebar.tsx",
    );
    const segmentSidebarSource = fileContent(
      "registry/new-york-v4/ui/segment-sidebar.tsx",
    );

    expect(sidebarRow?.files.map((file) => file.path)).toEqual([
      "registry/new-york-v4/ui/sidebar-row.ts",
    ]);
    expect(sidebar?.registryDependencies ?? []).toContain("@retab/sidebar-row");
    expect(sidebar?.dependencies ?? []).toContain(
      "class-variance-authority@^0.7.1",
    );
    // The migrated stock-shadcn sidebar is self-contained: it defines its
    // menu-button variants inline rather than importing them from sidebar-row
    // (the shared row module is still consumed by sidebar-list and friends).
    expect(sidebarSource).toContain("const sidebarMenuButtonVariants = cva(");
    expect(sidebarSource).not.toContain("EmbeddedSidebarProvider");
    expect(sidebarSource).not.toContain("scope?:");
    expect(sidebarSource).not.toContain("data-sidebar-scope");

    expect(sidebarList?.registryDependencies ?? []).toContain(
      "@retab/sidebar-row",
    );
    expect(sidebarList?.registryDependencies ?? []).not.toContain("sidebar");
    expect(sidebarListSource).toContain('from "./sidebar-row"');
    expect(sidebarListSource).not.toContain('from "./sidebar"');

    expect(segmentSidebar?.registryDependencies ?? []).toContain(
      "@retab/sidebar-list",
    );
    expect(segmentSidebar?.registryDependencies ?? []).not.toContain("sidebar");
    expect(segmentSidebarSource).toContain('from "./sidebar-list"');
    expect(segmentSidebarSource).not.toContain("EmbeddedSidebarProvider");

    expect(attachmentSidebar?.registryDependencies ?? []).toContain(
      "@retab/sidebar-list",
    );
    expect(attachmentSidebar?.registryDependencies ?? []).not.toContain(
      "sidebar",
    );
    expect(attachmentSidebarSource).toContain('from "./sidebar-list"');
    expect(attachmentSidebarSource).not.toContain("providerClassName");
    expect(attachmentSidebarSource).not.toContain("EmbeddedSidebarProvider");
  });

  it("keeps public/r viewer metadata and payloads aligned with registry.json", () => {
    const registry = readJson<Registry>("registry.json");
    const publicRegistry = readJson<Registry>("public/r/registry.json");
    const publicItemsByName = new Map(
      publicRegistry.items.map((item) => [item.name, item]),
    );
    const mismatches: string[] = [];

    for (const item of viewerRegistryItems(registry)) {
      const publicItem = publicItemsByName.get(item.name);
      if (!publicItem) {
        mismatches.push(`${item.name}: missing from public/r/registry.json`);
        continue;
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
        `${item.name}: public/r/registry.json differs from registry.json`,
      ).toEqual({
        type: item.type,
        dependencies: item.dependencies ?? [],
        registryDependencies: item.registryDependencies ?? [],
        files: item.files.map(({ path, target, type }) => ({
          path,
          target,
          type,
        })),
      });

      const publicItemPayload = readJson<RegistryItem>(
        `public/r/${item.name}.json`,
      );
      expect(
        publicItemPayload.files.map(({ path, target, type }) => ({
          path,
          target,
          type,
        })),
        `${item.name}: public/r/${item.name}.json file list differs from registry.json`,
      ).toEqual(
        item.files.map(({ path, target, type }) => ({ path, target, type })),
      );

      for (const publicFile of publicItemPayload.files) {
        // Payloads ship install-safe import specifiers (scripts/
        // rewrite-registry-imports.mjs), so alignment means: payload content
        // === source content after the same rewrite.
        expect(
          publicFile.content,
          `${item.name}: ${publicFile.path} content differs in public/r`,
        ).toBe(rewriteContentImports(fileContent(publicFile.path)));
      }
    }

    expect(mismatches).toEqual([]);
  });
});
