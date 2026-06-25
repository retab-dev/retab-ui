import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const forbiddenPatterns = [
  "@tanstack/react-virtual",
  "@tanstack/virtual-core",
  "useVirtualizer",
];
const scannedRoots = [
  "components",
  "content/docs",
  "package.json",
  "pnpm-lock.yaml",
  "public/r",
  "registry.json",
  "registry/new-york-v4",
];
const scannedExtensions = new Set([".json", ".md", ".mdx", ".ts", ".tsx"]);

describe("TanStack Virtual removal contract", () => {
  it("keeps package manifests free of the removed virtualizer packages", () => {
    const packageJson = readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>("package.json");
    const dependencyNames = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ]);

    expect(dependencyNames.has("@tanstack/react-virtual")).toBe(false);
    expect(dependencyNames.has("@tanstack/virtual-core")).toBe(false);
    expect(readText("pnpm-lock.yaml")).not.toContain("@tanstack/react-virtual");
    expect(readText("pnpm-lock.yaml")).not.toContain("@tanstack/virtual-core");
  });

  it("keeps source, docs, registry, and generated payloads free of TanStack Virtual APIs", () => {
    const offenders: string[] = [];

    for (const file of scannedFiles(scannedRoots)) {
      const content = readText(file);
      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          offenders.push(`${file}: ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("registers the local measured-row virtualizer wherever installable list consumers need it", () => {
    const registry = readJson<Registry>("registry.json");
    const publicRegistry = readJson<Registry>("public/r/registry.json");

    for (const itemName of [
      "extract-viewer-block",
      "sources-viewer-block",
      "json-form-sources-block",
      "interactive-item-list",
    ]) {
      expect(registryFilePaths(registry, itemName)).toContain(
        "registry/new-york-v4/ui/measured-row-virtualization.ts",
      );
      expect(registryFilePaths(publicRegistry, itemName)).toContain(
        "registry/new-york-v4/ui/measured-row-virtualization.ts",
      );
    }
  });

  it("documents CSV and XLSX windowing as local virtualizers", () => {
    const csvDoc = readText(
      "content/docs/components/file-viewer/renderers/csv.mdx",
    );
    const xlsxDoc = readText(
      "content/docs/components/file-viewer/renderers/xlsx.mdx",
    );

    expect(csvDoc).toContain("Retab's fixed-grid virtualizer");
    expect(csvDoc).not.toContain("TanStack Virtual");
    expect(xlsxDoc).toContain("Retab's local fixed-grid");
    expect(xlsxDoc).not.toContain("@tanstack/react-virtual");
  });
});

type Registry = {
  items: {
    files?: { path: string }[];
    name: string;
  }[];
};

function registryFilePaths(registry: Registry, itemName: string) {
  return registry.items
    .find((item) => item.name === itemName)
    ?.files?.map((file) => file.path);
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

function readText(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function scannedFiles(paths: readonly string[]) {
  return paths.flatMap((path) => {
    const absolutePath = join(repoRoot, path);
    if (statSync(absolutePath).isFile()) return [path];
    return filesUnder(path);
  });
}

function filesUnder(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(join(repoRoot, root))) {
    const path = join(root, entry);
    const absolutePath = join(repoRoot, path);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      files.push(...filesUnder(path));
      continue;
    }
    if (scannedExtensions.has(extension(path))) {
      files.push(path);
    }
  }

  return files;
}

function extension(path: string) {
  const dotIndex = path.lastIndexOf(".");
  return dotIndex === -1 ? "" : path.slice(dotIndex);
}
