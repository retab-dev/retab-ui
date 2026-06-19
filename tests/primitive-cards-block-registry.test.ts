import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

// The primitive-cards block grew from two cards to five, and its registry
// manifest silently fell behind — `shadcn add primitive-cards-block` shipped a
// component missing page-ribbon, segment-legend, react-markdown, and its sample
// data. This guards against that class of drift across the primitive-cards
// items: every module a component imports must be declared (directly or
// transitively) by its registry item.

const repoRoot = process.cwd()

// Registry item → its source component file. Add a row here when a new
// primitive-cards item ships so its manifest is guarded too.
const TARGETS = [
  {
    name: "primitive-cards-block",
    componentPath: "registry/new-york-v4/blocks/primitive-cards-block.tsx",
  },
  {
    name: "primitive-run-cards",
    componentPath: "registry/new-york-v4/ui/primitive-run-cards.tsx",
  },
]

// npm packages assumed present as peers, never declared per-item.
const PEER_PACKAGES = new Set(["react", "react-dom"])

type RegistryItem = {
  name: string
  dependencies?: string[]
  registryDependencies?: string[]
  files?: { path: string }[]
}

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8")
}

/**
 * Registry dependencies are written as `@retab/<name>` for Retab-owned items
 * and as a bare `<name>` for the migrated stock-shadcn primitives. Items are
 * keyed by their bare name, so strip the registry namespace before resolving.
 */
function registryDependencyItemName(dependencyName: string) {
  return dependencyName.replace(/^@retab\//, "")
}

/** Strip the version range a dependency may be pinned to (`pkg@^1.2` → `pkg`). */
function npmPackageName(dependency: string) {
  const at = dependency.lastIndexOf("@")
  return at > 0 ? dependency.slice(0, at) : dependency
}

function registryItems(): Map<string, RegistryItem> {
  const registry = JSON.parse(read("registry.json")) as { items: RegistryItem[] }
  return new Map(registry.items.map((item) => [item.name, item]))
}

/** Every module specifier the component imports from. */
function importSpecifiers(source: string): string[] {
  return Array.from(source.matchAll(/from\s+"([^"]+)"/g)).map((m) => m[1]!)
}

/**
 * The transitive closure of an item's registry dependencies — the set of item
 * names it pulls in, and the union of npm packages and file paths they provide.
 */
function resolveClosure(root: RegistryItem, items: Map<string, RegistryItem>) {
  const names = new Set<string>()
  const npmDeps = new Set<string>()
  const filePaths = new Set<string>()

  const visit = (item: RegistryItem) => {
    for (const dep of item.dependencies ?? []) npmDeps.add(npmPackageName(dep))
    for (const file of item.files ?? []) filePaths.add(file.path)
    for (const dep of item.registryDependencies ?? []) {
      const name = registryDependencyItemName(dep)
      if (names.has(name)) continue
      names.add(name)
      const next = items.get(name)
      if (next) visit(next)
    }
  }

  visit(root)
  return { names, npmDeps, filePaths }
}

/** Modules the manifest fails to cover for `target`. */
function uncoveredImports(
  target: { name: string; componentPath: string },
  items: Map<string, RegistryItem>
): string[] {
  const item = items.get(target.name)
  if (!item) return [`registry item "${target.name}" is not declared`]

  const closure = resolveClosure(item, items)
  const missing: string[] = []

  for (const specifier of importSpecifiers(read(target.componentPath))) {
    if (specifier.startsWith(".")) continue // relative — same package

    if (!specifier.startsWith("@/")) {
      // Bare npm package: must be a declared dependency in the closure.
      const pkg = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0]!
      if (!PEER_PACKAGES.has(pkg) && !closure.npmDeps.has(pkg)) {
        missing.push(`npm dependency "${pkg}" (from ${specifier})`)
      }
      continue
    }

    // Internal "@/..." import. Registry ui/lib items are named by basename
    // (run-card, segments, …); everything else (viewer libs, sample data) is
    // inlined as a file at its repo-relative path.
    const repoPath = specifier.replace(/^@\//, "")
    const isComponentOrLib = /^(components\/ui|lib)\//.test(repoPath)
    if (isComponentOrLib) {
      const itemName = repoPath.split("/").pop()!
      if (!closure.names.has(itemName)) {
        missing.push(`registry dependency "${itemName}" (from ${specifier})`)
      }
      continue
    }

    const provided = [".ts", ".tsx", ".json", ""].some((ext) =>
      closure.filePaths.has(`${repoPath}${ext}`)
    )
    if (!provided) {
      missing.push(`bundled file "${repoPath}" (from ${specifier})`)
    }
  }

  return missing
}

describe("primitive-cards registry manifests", () => {
  const items = registryItems()

  for (const target of TARGETS) {
    it(`declares "${target.name}" as a registry item`, () => {
      expect(items.get(target.name)).toBeDefined()
    })

    it(`covers every module "${target.name}" imports`, () => {
      expect(uncoveredImports(target, items)).toEqual([])
    })
  }
})
