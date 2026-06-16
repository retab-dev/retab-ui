import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8")
}

function viewerBlockIds() {
  const source = read("lib/viewer-blocks.ts")
  return Array.from(source.matchAll(/^\s+id: "([^"]+)"/gm))
    .map((match) => match[1]!)
    .sort()
}

function viewerBlockComponentIds() {
  const source = read("components/viewer-block-component-registry.tsx")
  const componentsObject = source.match(
    /export const VIEWER_BLOCK_COMPONENTS = \{([\s\S]*?)\n\} satisfies/
  )?.[1]

  expect(componentsObject).toBeDefined()

  return Array.from(
    componentsObject!.matchAll(/^\s+(?:"([^"]+)"|([A-Za-z0-9_-]+)):/gm)
  )
    .map((match) => match[1] ?? match[2]!)
    .sort()
}

describe("viewer block component registry", () => {
  it("maps every /blocks metadata id through the shared component abstraction", () => {
    expect(viewerBlockComponentIds()).toEqual(viewerBlockIds())
  })

  it("keeps /blocks consumers from owning duplicate component maps", () => {
    for (const path of [
      "components/viewer-blocks.tsx",
      "components/viewer-block-fullscreen.tsx",
    ]) {
      const source = read(path)

      expect(source).not.toContain("const blockComponents")
      expect(source).not.toContain("@/registry/new-york-v4/blocks/")
      expect(source).toContain("@/components/viewer-block-component-registry")
    }
  })
})
