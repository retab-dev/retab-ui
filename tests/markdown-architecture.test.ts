import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, posix as pathPosix } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

// The single source of truth for the install-safe import rewrite applied to
// built registry payloads.
import { rewriteContentImports } from "../scripts/rewrite-registry-imports.mjs";

type RegistryFile = {
  content?: string;
  path: string;
  target?: string;
  type?: string;
};

type InstalledRegistryFile = RegistryFile & {
  itemName: string;
};

type RegistryItem = {
  dependencies?: string[];
  files: RegistryFile[];
  name: string;
  registryDependencies?: string[];
};

type Registry = {
  items: RegistryItem[];
};

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

// The 14 primitives migrated to stock shadcn. They are bare registry
// dependencies that resolve to upstream shadcn files, so they no longer ship
// their own files (and thus install targets) inside the Retab registry. An
// import that resolves to one of these is satisfied by the bare dependency.
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

function migratedPrimitiveForSpecifier(specifier: string) {
  const withoutQuery = specifier.split("?")[0]!;
  const basename = withoutQuery.split("/").pop() ?? "";
  return migratedShadcnPrimitives.has(basename) ? basename : null;
}

const markdownFiles = [
  "registry/new-york-v4/ui/markdown-viewer.tsx",
  "registry/new-york-v4/ui/markdown-greenfield-code-highlight.tsx",
  "registry/new-york-v4/ui/markdown-greenfield-code-highlight-html.ts",
  "registry/new-york-v4/ui/markdown-greenfield-code-highlight-protocol.ts",
  "registry/new-york-v4/ui/markdown-greenfield-code-highlight.worker.ts",
  "registry/new-york-v4/ui/markdown-greenfield-content.tsx",
  "registry/new-york-v4/ui/markdown-greenfield-diagram.tsx",
  "registry/new-york-v4/ui/markdown-greenfield-document.ts",
  "registry/new-york-v4/ui/markdown-greenfield-document-store.ts",
  "registry/new-york-v4/ui/markdown-greenfield-document.worker.ts",
  "registry/new-york-v4/ui/markdown-greenfield-layout.ts",
  "registry/new-york-v4/ui/markdown-greenfield-renderer-frame.ts",
  "registry/new-york-v4/ui/markdown-greenfield-renderer.tsx",
  "registry/new-york-v4/ui/markdown-greenfield-virtualizer.ts",
  "registry/new-york-v4/ui/markdown-hast-types.ts",
  "registry/new-york-v4/ui/markdown-source-map.ts",
  "registry/new-york-v4/ui/markdown-unified-pipeline.ts",
  "registry/new-york-v4/ui/markdown-url-policy.ts",
];
const markdownViewerSupportFiles = [
  "registry/new-york-v4/ui/file-viewer-context.tsx",
  "registry/new-york-v4/ui/file-viewer-elements.ts",
  "registry/new-york-v4/ui/file-viewer-motion-kernel.ts",
  "registry/new-york-v4/ui/file-viewer-renderer-contract.ts",
  "registry/new-york-v4/ui/file-viewer-renderer-frame.tsx",
  "registry/new-york-v4/ui/file-viewer-motion-plan.ts",
  "registry/new-york-v4/ui/mermaid-renderer.ts",
  "registry/new-york-v4/ui/plain-text-viewer-frame.tsx",
  "registry/new-york-v4/ui/text-viewer-chrome.tsx",
  "registry/new-york-v4/ui/text-code-viewer-chrome.tsx",
  "registry/new-york-v4/ui/viewer-download.tsx",
  "registry/new-york-v4/ui/viewer-error.tsx",
  "registry/new-york-v4/ui/text-viewer-layout.ts",
  "registry/new-york-v4/ui/text-viewer-ranges.ts",
  "registry/new-york-v4/ui/text-viewer-scroll-interactions.ts",
  "registry/new-york-v4/ui/line-ranges.ts",
  "registry/new-york-v4/ui/text-viewer-resource.ts",
  "registry/new-york-v4/ui/plain-text-resource.ts",
  "registry/new-york-v4/ui/text-viewer-scale.ts",
  "registry/new-york-v4/ui/text-viewer-types.ts",
  "registry/new-york-v4/ui/text-viewer-virtualization.ts",
  "registry/new-york-v4/ui/code-viewer-prism-components.d.ts",
  "registry/new-york-v4/ui/code-viewer-syntax-prism.ts",
  "registry/new-york-v4/ui/code-viewer-syntax-protocol.ts",
  "registry/new-york-v4/lib/viewer-source.ts",
  "registry/new-york-v4/lib/viewer-resource.ts",
  "registry/new-york-v4/lib/viewer-download-actions.ts",
  "registry/new-york-v4/lib/viewer-errors.ts",
  "registry/new-york-v4/ui/use-is-client.ts",
  "registry/new-york-v4/ui/viewer-measurement.ts",
  "registry/new-york-v4/ui/viewer-types.ts",
];
const markdownViewerRegistryFiles = [
  ...markdownFiles,
  ...markdownViewerSupportFiles,
];
const removedLegacyMarkdownFiles = [
  "registry/new-york-v4/ui/markdown-components.ts",
  "registry/new-york-v4/ui/markdown-controls.tsx",
  "registry/new-york-v4/ui/markdown-document-model.ts",
  "registry/new-york-v4/ui/markdown-layout.ts",
  "registry/new-york-v4/ui/markdown-mermaid.tsx",
  "registry/new-york-v4/ui/markdown-parser.ts",
  "registry/new-york-v4/ui/markdown-policy.ts",
  "registry/new-york-v4/ui/markdown-renderer.tsx",
  "registry/new-york-v4/ui/markdown-sanitize.ts",
  "registry/new-york-v4/ui/markdown-table-accessibility.ts",
  "registry/new-york-v4/ui/markdown-viewer-content.tsx",
  "registry/new-york-v4/ui/markdown-virtualizer.ts",
];
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
];
const markdownDocsPath =
  "content/docs/components/file-viewer/renderers/markdown.mdx";
const viewerDocsPaths = [
  "content/docs/components/index.mdx",
  "content/docs/components/file-viewer/index.mdx",
  "content/docs/components/file-viewer/renderers/text.mdx",
  "content/docs/components/file-viewer/renderers/markdown.mdx",
  markdownDocsPath,
];

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readRegistry() {
  return JSON.parse(read("registry.json")) as Registry;
}

async function readJson(path: string) {
  return JSON.parse(await readFile(join(repoRoot, path), "utf8"));
}

function readMarkdownRegistryArtifact() {
  return JSON.parse(read("public/r/markdown-viewer.json")) as RegistryItem & {
    type: string;
  };
}

function readGeneratedRegistryIndex() {
  return JSON.parse(read("public/r/registry.json")) as Registry;
}

function importSpecifiers(source: string) {
  return Array.from(
    source.matchAll(/\bimport(?:\s+type)?[\s\S]*?\bfrom\s+["']([^"']+)["']/g),
  ).map((match) => match[1]!);
}

function relativeImportSpecifiers(source: string) {
  const imports: string[] = [];
  const importExportPattern =
    /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g;
  const dynamicImportPattern = /\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

  for (const match of source.matchAll(importExportPattern)) {
    imports.push(match[1]!);
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    imports.push(match[1]!);
  }

  return imports;
}

function moduleImportSpecifiers(source: string) {
  const imports: string[] = [];
  const importExportPattern =
    /(?:^|\n)\s*(?:import|export)(?:\s+type)?\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImportPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of source.matchAll(importExportPattern)) {
    imports.push(match[1]!);
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    imports.push(match[1]!);
  }

  return imports;
}

function registryInstallFilesFor(
  item: RegistryItem,
  itemsByName: Map<string, RegistryItem>,
  visited = new Set<string>(),
): InstalledRegistryFile[] {
  if (visited.has(item.name)) return [];
  visited.add(item.name);

  return [
    ...item.files.map((file) => ({ ...file, itemName: item.name })),
    ...(item.registryDependencies ?? []).flatMap((dependencyName) => {
      const dependency = itemsByName.get(
        registryDependencyItemName(dependencyName),
      );
      return dependency
        ? registryInstallFilesFor(dependency, itemsByName, visited)
        : [];
    }),
  ];
}

function retabCliInstallFilesFor(
  item: RegistryItem,
  itemsByName: Map<string, RegistryItem>,
  visited = new Set<string>(),
): InstalledRegistryFile[] {
  if (visited.has(item.name)) return [];
  visited.add(item.name);

  return [
    ...item.files.map((file) => ({ ...file, itemName: item.name })),
    ...(item.registryDependencies ?? []).flatMap((dependencyName) => {
      if (!dependencyName.startsWith("@retab/")) return [];
      const dependency = itemsByName.get(
        registryDependencyItemName(dependencyName),
      );
      return dependency
        ? retabCliInstallFilesFor(dependency, itemsByName, visited)
        : [];
    }),
  ];
}

function registryInstallTargetsFor(
  item: RegistryItem,
  itemsByName: Map<string, RegistryItem>,
): string[] {
  return registryInstallFilesFor(item, itemsByName).map(
    (file) => file.target ?? file.path,
  );
}

function registryInstallDependenciesFor(
  item: RegistryItem,
  itemsByName: Map<string, RegistryItem>,
  visited = new Set<string>(),
): string[] {
  if (visited.has(item.name)) return [];
  visited.add(item.name);

  return [
    ...(item.dependencies ?? []),
    ...(item.registryDependencies ?? []).flatMap((dependencyName) => {
      const dependency = itemsByName.get(
        registryDependencyItemName(dependencyName),
      );
      return dependency
        ? registryInstallDependenciesFor(dependency, itemsByName, visited)
        : [];
    }),
  ];
}

function registryDependencyItemName(dependencyName: string) {
  if (!dependencyName.startsWith("@")) return dependencyName;
  return dependencyName.split("/").slice(1).join("/");
}

function resolveInstalledRegistryImport({
  importerTarget,
  installedTargets,
  specifier,
}: {
  importerTarget: string;
  installedTargets: Set<string>;
  specifier: string;
}) {
  const basePath = pathPosix.normalize(
    pathPosix.join(pathPosix.dirname(importerTarget), specifier.split("?")[0]!),
  );
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
  ];

  return (
    candidates.find((candidate) => installedTargets.has(candidate)) ?? null
  );
}

function resolveInstalledRegistryAliasImport({
  installedTargets,
  specifier,
}: {
  installedTargets: Set<string>;
  specifier: string;
}) {
  const basePath = installedTargetForAliasSpecifier(specifier);
  if (!basePath) return null;
  return resolveInstalledRegistryTarget({ basePath, installedTargets });
}

function resolveInstalledRegistryTarget({
  basePath,
  installedTargets,
}: {
  basePath: string;
  installedTargets: Set<string>;
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
  ];

  return (
    candidates.find((candidate) => installedTargets.has(candidate)) ?? null
  );
}

function installedTargetForAliasSpecifier(specifier: string) {
  const withoutQuery = specifier.split("?")[0]!;
  if (withoutQuery.startsWith("@/components/ui/")) {
    return `@ui/${withoutQuery.slice("@/components/ui/".length)}`;
  }
  if (withoutQuery.startsWith("@/registry/new-york-v4/ui/")) {
    return `@ui/${withoutQuery.slice("@/registry/new-york-v4/ui/".length)}`;
  }
  if (withoutQuery.startsWith("@/hooks/")) {
    return `@hooks/${withoutQuery.slice("@/hooks/".length)}`;
  }
  if (withoutQuery.startsWith("@/registry/new-york-v4/hooks/")) {
    return `@hooks/${withoutQuery.slice("@/registry/new-york-v4/hooks/".length)}`;
  }
  if (withoutQuery.startsWith("@/lib/")) {
    return `@lib/${withoutQuery.slice("@/lib/".length)}`;
  }
  if (withoutQuery.startsWith("@/registry/new-york-v4/lib/")) {
    return `@lib/${withoutQuery.slice("@/registry/new-york-v4/lib/".length)}`;
  }
  return null;
}

function packageNameForSpecifier(specifier: string) {
  if (specifier.startsWith(".") || specifier.startsWith("@/")) return null;
  if (specifier.startsWith("node:")) return null;
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }
  return specifier.split("/")[0] ?? null;
}

function packageNameForDependency(dependency: string) {
  if (dependency.startsWith("@")) {
    const match = dependency.match(/^(@[^/]+\/[^@]+)(?:@.+)?$/);
    return match?.[1] ?? dependency;
  }
  return dependency.replace(/@.+$/, "");
}

function installedPathForRegistryTarget(target: string) {
  if (target.startsWith("@ui/")) {
    return `components/ui/${target.slice("@ui/".length)}`;
  }
  if (target.startsWith("@lib/")) {
    return `lib/${target.slice("@lib/".length)}`;
  }
  if (target.startsWith("@hooks/")) {
    return `hooks/${target.slice("@hooks/".length)}`;
  }
  return target;
}

function packageJsonDependencyEntry(dependency: string) {
  const packageName = packageNameForDependency(dependency);
  if (!packageName) return null;
  if (dependency === packageName) return [packageName, "*"] as const;
  return [packageName, dependency.slice(packageName.length + 1)] as const;
}

async function createShadcnSmokeProject({
  registryUrl,
}: {
  registryUrl: string;
}) {
  const projectDir = await mkdtemp(join(tmpdir(), "pretext-shadcn-smoke-"));
  const registry = readRegistry();
  const itemsByName = new Map(
    registry.items.map((registryItem) => [registryItem.name, registryItem]),
  );
  const artifact = readMarkdownRegistryArtifact();
  const dependencies = new Map([
    ["react", "19.2.3"],
    ["react-dom", "19.2.3"],
  ]);

  for (const dependency of registryInstallDependenciesFor(
    artifact,
    itemsByName,
  )) {
    const entry = packageJsonDependencyEntry(dependency);
    if (!entry) continue;
    dependencies.set(entry[0], entry[1]);
  }

  await mkdir(join(projectDir, "app"), { recursive: true });
  await writeFile(
    join(projectDir, "package.json"),
    `${JSON.stringify(
      {
        type: "module",
        packageManager: "pnpm@11.7.0",
        dependencies: Object.fromEntries(
          Array.from(dependencies).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
        devDependencies: {},
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(projectDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["./*"],
          },
          jsx: "preserve",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(projectDir, "app/globals.css"),
    '@import "tailwindcss";\n',
  );
  await writeFile(
    join(projectDir, "components.json"),
    `${JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema.json",
        style: "new-york",
        rsc: true,
        tsx: true,
        tailwind: {
          config: "",
          css: "app/globals.css",
          baseColor: "neutral",
          cssVariables: true,
          prefix: "",
        },
        iconLibrary: "lucide",
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/components/ui",
          lib: "@/lib",
          hooks: "@/hooks",
        },
        registries: {
          "@retab": registryUrl,
        },
      },
      null,
      2,
    )}\n`,
  );

  return projectDir;
}

async function withLocalRegistryServer<T>(
  callback: (registryUrl: string) => Promise<T>,
) {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = requestUrl.pathname.match(/^\/r\/([a-z0-9-]+)\.json$/);
    if (!match) {
      response.writeHead(404).end();
      return;
    }

    try {
      const content = await readFile(
        join(repoRoot, "public/r", `${match[1]}.json`),
      );
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(content);
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Failed to start local registry smoke server");
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}/r/{name}.json`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Markdown architecture", () => {
  it("keeps the old chunk-local Markdown stack deleted", () => {
    for (const file of removedLegacyMarkdownFiles) {
      expect(existsSync(join(repoRoot, file)), `${file} still exists`).toBe(
        false,
      );
    }
  });

  it("keeps the implementation independent from old Markdown Document modules", () => {
    for (const file of markdownFiles) {
      const source = read(file);
      for (const specifier of importSpecifiers(source)) {
        expect(
          isOldMarkdownDocumentImport(specifier),
          `${file} imports old Markdown module ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("keeps the registry item separate from markdown-document-viewer", () => {
    const registry = readRegistry();
    const item = registry.items.find(
      (registryItem) => registryItem.name === "markdown-viewer",
    );

    expect(item).toBeTruthy();
    expect(item?.registryDependencies ?? []).not.toContain(
      "markdown-document-viewer",
    );
    expect(item?.dependencies ?? []).not.toContain("markdown-document-viewer");
    expect(item?.files.map((file) => file.path).sort()).toEqual(
      [...markdownViewerRegistryFiles].sort(),
    );
  });

  it("keeps the generated registry index on the greenfield Pretext item", () => {
    const registryItem = readRegistry().items.find(
      (item) => item.name === "markdown-viewer",
    );
    const generatedItem = readGeneratedRegistryIndex().items.find(
      (item) => item.name === "markdown-viewer",
    );

    expect(generatedItem).toEqual(registryItem);
    expect(generatedItem?.files.map((file) => file.path).sort()).toEqual(
      [...markdownViewerRegistryFiles].sort(),
    );
    expect(generatedItem?.dependencies ?? []).not.toContain("react-markdown");
    expect(generatedItem?.dependencies ?? []).not.toContain(
      "rehype-pretty-code",
    );
  });

  it("ships a synchronized registry artifact for installation", () => {
    const artifact = readMarkdownRegistryArtifact();

    expect(artifact.name).toBe("markdown-viewer");
    expect(artifact.type).toBe("registry:ui");
    expect(artifact.registryDependencies ?? []).toEqual([
      "button",
      "dropdown-menu",
      "@retab/scroll-area",
      "@retab/skeleton",
      "@retab/spinner",
      "@retab/utils",
      "@retab/viewer-controls",
      "@retab/use-keyed-layout-effect",
      "@retab/use-mount-effect",
    ]);
    expect(artifact.dependencies ?? []).toEqual([
      "@chenglou/pretext",
      "hast-util-to-jsx-runtime",
      "katex",
      "lucide-react",
      "marked@18.0.5",
      "mermaid",
      "rehype-katex",
      "rehype-raw",
      "rehype-sanitize",
      "rehype-slug",
      "remark-breaks",
      "remark-directive",
      "remark-gemoji",
      "remark-gfm",
      "remark-math",
      "remark-parse",
      "remark-rehype",
      "remark-smartypants",
      "prismjs@^1.30.0",
      "unified",
      "vfile",
    ]);
    expect(artifact.files.map((file) => file.path).sort()).toEqual(
      [...markdownViewerRegistryFiles].sort(),
    );

    const expectedFiles = new Map(
      readRegistry()
        .items.find((item) => item.name === "markdown-viewer")
        ?.files.map((file) => [file.path, file]) ?? [],
    );
    for (const file of artifact.files) {
      const expectedFile = expectedFiles.get(file.path);
      expect(file.type, `${file.path} registry type`).toBe(expectedFile?.type);
      expect(file.target, `${file.path} registry target`).toBe(
        expectedFile?.target,
      );
      // Payloads ship install-safe import specifiers (scripts/
      // rewrite-registry-imports.mjs), so the synchronized-artifact contract
      // is: payload content === source content after the same rewrite.
      expect(file.content, `${file.path} registry content`).toBe(
        rewriteContentImports(read(file.path)),
      );
    }
  });

  it("ships an installable registry artifact with a complete import closure", () => {
    const registry = readRegistry();
    const itemsByName = new Map(
      registry.items.map((registryItem) => [registryItem.name, registryItem]),
    );
    const artifact = readMarkdownRegistryArtifact();
    const installedFiles = registryInstallFilesFor(artifact, itemsByName);
    const installedTargets = new Set(
      installedFiles.map((file) => file.target ?? file.path),
    );
    const installedPackages = new Set(
      registryInstallDependenciesFor(artifact, itemsByName).map(
        packageNameForDependency,
      ),
    );
    const installedBarePrimitives = new Set(
      installedFiles.flatMap((file) =>
        (itemsByName.get(file.itemName)?.registryDependencies ?? [])
          .filter((name) => !name.startsWith("@retab/"))
          .map(registryDependencyItemName),
      ),
    );
    const missingImports: string[] = [];
    const missingPackages: string[] = [];

    for (const file of installedFiles) {
      expect(file.target, `${file.path} registry target`).toBeTruthy();
      const content = file.content ?? read(file.path);
      expect(content, `${file.path} registry content`).toBeTruthy();

      for (const specifier of relativeImportSpecifiers(content)) {
        const resolved = resolveInstalledRegistryImport({
          importerTarget: file.target!,
          installedTargets,
          specifier,
        });
        if (resolved) continue;
        const migratedPrimitive = migratedPrimitiveForSpecifier(specifier);
        if (
          migratedPrimitive &&
          installedBarePrimitives.has(migratedPrimitive)
        ) {
          continue;
        }
        missingImports.push(
          `${file.target} imports ${specifier}, but no installed registry file resolves it`,
        );
      }

      for (const specifier of moduleImportSpecifiers(content)) {
        if (specifier.startsWith(".")) continue;

        if (specifier.startsWith("@/")) {
          const resolved = resolveInstalledRegistryAliasImport({
            installedTargets,
            specifier,
          });
          if (resolved) continue;
          const migratedPrimitive = migratedPrimitiveForSpecifier(specifier);
          if (
            migratedPrimitive &&
            installedBarePrimitives.has(migratedPrimitive)
          ) {
            continue;
          }
          missingImports.push(
            `${file.target} imports ${specifier}, but no installed registry file resolves it`,
          );
          continue;
        }

        const packageName = packageNameForSpecifier(specifier);
        if (
          !packageName ||
          packageName === "react" ||
          packageName === "react-dom"
        ) {
          continue;
        }
        if (installedPackages.has(packageName)) continue;
        if (installedPackages.has(`@types/${packageName}`)) continue;
        missingPackages.push(
          `${file.target} imports ${specifier}, but ${packageName} is not declared by the installed registry tree`,
        );
      }
    }

    expect(missingImports).toEqual([]);
    expect(missingPackages).toEqual([]);
  });

  it("installs through the shadcn CLI from the Retab registry namespace", async () => {
    const registry = readRegistry();
    const itemsByName = new Map(
      registry.items.map((registryItem) => [registryItem.name, registryItem]),
    );
    const artifact = readMarkdownRegistryArtifact();
    const expectedRetabFiles = retabCliInstallFilesFor(artifact, itemsByName)
      .map((file) => installedPathForRegistryTarget(file.target ?? file.path))
      .sort();

    expect(expectedRetabFiles).toContain("components/ui/markdown-viewer.tsx");
    expect(expectedRetabFiles).toContain(
      "components/ui/plain-text-viewer-frame.tsx",
    );
    expect(expectedRetabFiles).toContain(
      "components/ui/text-viewer-chrome.tsx",
    );
    expect(expectedRetabFiles).toContain("lib/viewer-download-actions.ts");

    await withLocalRegistryServer(async (registryUrl) => {
      const projectDir = await createShadcnSmokeProject({ registryUrl });
      try {
        try {
          await execFileAsync(
            "pnpm",
            [
              "exec",
              "shadcn",
              "add",
              "@retab/markdown-viewer",
              "--cwd",
              projectDir,
              "-y",
              "--overwrite",
            ],
            {
              cwd: repoRoot,
              timeout: 120_000,
              maxBuffer: 1024 * 1024 * 8,
            },
          );
        } catch (error) {
          const failed = error as {
            message?: string;
            stderr?: string;
            stdout?: string;
          };
          throw new Error(
            [
              failed.message,
              failed.stdout ? `stdout:\n${failed.stdout}` : "",
              failed.stderr ? `stderr:\n${failed.stderr}` : "",
            ]
              .filter(Boolean)
              .join("\n\n"),
          );
        }

        const missingFiles = expectedRetabFiles.filter(
          (path) => !existsSync(join(projectDir, path)),
        );
        expect(missingFiles).toEqual([]);
        expect(existsSync(join(projectDir, "components/ui/button.tsx"))).toBe(
          true,
        );
        expect(
          existsSync(join(projectDir, "components/ui/dropdown-menu.tsx")),
        ).toBe(true);

        const installedViewer = await readFile(
          join(projectDir, "components/ui/markdown-viewer.tsx"),
          "utf8",
        );
        expect(installedViewer).toContain("./markdown-greenfield-content");
        expect(installedViewer).not.toContain("markdown-document-viewer");
        expect(await readJson("public/r/markdown-viewer.json")).toMatchObject({
          registryDependencies: [
            "button",
            "dropdown-menu",
            "@retab/scroll-area",
            "@retab/skeleton",
            "@retab/spinner",
            "@retab/utils",
            "@retab/viewer-controls",
            "@retab/use-keyed-layout-effect",
            "@retab/use-mount-effect",
          ],
        });
      } finally {
        await rm(projectDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      }
    });
  }, 150_000);

  it("keeps virtual chunks from becoming visible page chrome", () => {
    const forbiddenPageChrome = [
      "data-markdown-page",
      'data-slot="markdown-document-page"',
      "data-slot='markdown-document-page'",
      "Page 1 of",
      "Page {",
      "Page ${",
    ];

    for (const file of markdownFiles) {
      const source = read(file);
      for (const token of forbiddenPageChrome) {
        expect(
          source.includes(token),
          `${file} contains visible page chrome token ${token}`,
        ).toBe(false);
      }
    }
  });

  it("keeps the viewer content on the private greenfield layout and virtualizer", () => {
    const imports = importSpecifiers(
      read("registry/new-york-v4/ui/markdown-greenfield-content.tsx"),
    );

    expect(imports).toContain("./markdown-greenfield-layout");
    expect(imports).toContain("./markdown-greenfield-virtualizer");
    expect(imports).not.toContain("./markdown-document-layout");
    expect(imports).not.toContain("./markdown-document-virtualizer");
    expect(imports).not.toContain("./text-viewer-layout");
  });

  it("keeps Markdown parsing inside the unified pipeline", () => {
    const pipelineImports = importSpecifiers(
      read("registry/new-york-v4/ui/markdown-unified-pipeline.ts"),
    );
    expect(pipelineImports).toContain("remark-parse");
    expect(pipelineImports).toContain("remark-rehype");

    for (const file of markdownFiles) {
      if (file.endsWith("markdown-unified-pipeline.ts")) continue;
      const imports = importSpecifiers(read(file));
      expect(imports, `${file} imports marked directly`).not.toContain(
        "marked",
      );
      expect(imports, `${file} imports remark-parse directly`).not.toContain(
        "remark-parse",
      );
    }
  });

  it("derives heading IDs from the full-document HAST model", () => {
    const pipelineSource = read(
      "registry/new-york-v4/ui/markdown-unified-pipeline.ts",
    );
    const modelSource = read(
      "registry/new-york-v4/ui/markdown-greenfield-document.ts",
    );

    expect(pipelineSource).toContain("rehypeSlug");
    expect(modelSource).toContain("createMarkdownGreenfieldHeadings");
  });

  it("keeps TextViewer internals from importing the Markdown fork", () => {
    for (const file of textViewerFiles) {
      if (file === "registry/new-york-v4/ui/text-viewer.tsx") continue;
      const imports = importSpecifiers(read(file));
      for (const specifier of imports) {
        expect(
          specifier.includes("markdown"),
          `${file} imports Markdown module ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("documents the Markdown renderer contract", () => {
    const docs = read(markdownDocsPath);

    expect(docs).toContain("## Contract");
    expect(docs).toContain("## Capabilities");
    expect(docs).toContain("## Feature Matrix");
    expect(docs).toContain("## Unsupported Syntax");
    expect(docs).toContain("## API Reference");
    // The matrix compares the Markdown Viewer against the Text Viewer's
    // Markdown mode (the old paged renderer is gone, so no third column).
    expect(docs).toMatch(
      /\|\s*Capability\s*\|\s*Markdown Viewer\s*\|\s*Text Viewer Markdown mode\s*\|/,
    );
    expect(docs).toContain(
      "no page count, page frame, or page delimiter should be part of the Markdown user experience",
    );
    expect(docs).toContain(
      "routes Markdown URL sources, Blob sources, inline text sources, and MIME-only Markdown sources through `MarkdownViewer`",
    );
  });

  it("keeps public viewer docs aligned with Markdown routing", () => {
    const docs = Object.fromEntries(
      viewerDocsPaths.map((path) => [path, read(path)]),
    );

    expect(docs["content/docs/components/file-viewer/index.mdx"]).toContain(
      "[Markdown Viewer](/docs/components/file-viewer/renderers/markdown)",
    );
    expect(docs["content/docs/components/file-viewer/index.mdx"]).toContain(
      "| Markdown     | `md`, `markdown`, `text/markdown`",
    );
    expect(docs["content/docs/components/file-viewer/index.mdx"]).toContain(
      "Markdown Viewer",
    );
    expect(docs["content/docs/components/file-viewer/index.mdx"]).toContain(
      "Markdown URL, Blob,\n  inline text, and MIME-only sources route to `MarkdownViewer`",
    );
    expect(
      docs["content/docs/components/file-viewer/renderers/text.mdx"],
    ).toContain(
      "Markdown files and inline Markdown sources use\n[`MarkdownViewer`]",
    );

    for (const [path, content] of Object.entries(docs)) {
      expect(
        content.includes("routes Markdown documents to `TextViewer`"),
        `${path} still claims Markdown routes to TextViewer`,
      ).toBe(false);
      expect(
        content.includes('mode="markdown"'),
        `${path} still documents TextViewer mode="markdown" routing`,
      ).toBe(false);
      expect(
        /\|\s*Markdown\s*\|[^\n|]*\|[^\n|]*\|\s*Pretext Text Viewer\s*\|/.test(
          content,
        ),
        `${path} still lists Markdown as Pretext Text Viewer`,
      ).toBe(false);
    }
  });
});

function isOldMarkdownDocumentImport(specifier: string) {
  if (specifier.includes("markdown-")) return false;
  return (
    specifier.includes("markdown-document-") ||
    specifier.includes("markdown-document-viewer") ||
    specifier.includes("MarkdownDocument")
  );
}
