import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

// The primitive-cards block grew from two cards to five, and its registry
// manifest silently fell behind — `shadcn add primitive-cards-block` shipped a
// component missing page-ribbon, segment-legend, react-markdown, and its sample
// data. This guards against that class of drift: every module the component
// imports must be declared (directly or transitively) by its registry item.

const repoRoot = process.cwd()
const BLOCK_NAME = "primitive-cards-block"
const COMPONENT_PATH =
  "registry/new-york-v4/blocks/primitive-cards-block.tsx"

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

function registryItems(): Map<string, RegistryItem> {
  const registry = JSON.parse(read("registry.json")) as { items: RegistryItem[] }
  return new Map(registry.items.map((item) => [item.name, item]))
}

/** Every module specifier the component imports from. */
function importSpecifiers(source: string): string[] {
  return Array.from(source.matchAll(/from\s+"([^"]+)"/g)).map((m) => m[1]!)
}

/**
 * The transitive closure of a block's registry dependencies — the set of item
 * names it pulls in, and the union of npm packages and file paths they provide.
 */
function resolveClosure(
  root: RegistryItem,
  items: Map<string, RegistryItem>
) {
  const names = new Set<string>()
  const npmDeps = new Set<string>()
  const filePaths = new Set<string>()

  const visit = (item: RegistryItem) => {
    for (const dep of item.dependencies ?? []) npmDeps.add(dep)
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

describe("primitive-cards-block registry manifest", () => {
  const items = registryItems()
  const block = items.get(BLOCK_NAME)
  const source = read(COMPONENT_PATH)
  const closure = block ? resolveClosure(block, items) : null

  it("declares the block as a registry item", () => {
    expect(block).toBeDefined()
  })

  it("covers every module the component imports", () => {
    expect(closure).not.toBeNull()
    const missing: string[] = []

    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith(".")) continue // relative — same package

      if (!specifier.startsWith("@/")) {
        // Bare npm package: must be a declared dependency in the closure.
        const pkg = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0]!
        if (!PEER_PACKAGES.has(pkg) && !closure!.npmDeps.has(pkg)) {
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
        if (!closure!.names.has(itemName)) {
          missing.push(`registry dependency "${itemName}" (from ${specifier})`)
        }
        continue
      }

      const provided = [".ts", ".tsx", ".json", ""].some((ext) =>
        closure!.filePaths.has(`${repoPath}${ext}`)
      )
      if (!provided) {
        missing.push(`bundled file "${repoPath}" (from ${specifier})`)
      }
    }

    expect(missing).toEqual([])
  })
})
