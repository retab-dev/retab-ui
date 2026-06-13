import { promises as fs } from "node:fs"
import path from "node:path"

import { VIEWER_BLOCKS } from "@/lib/viewer-blocks"

type RegistryFile = {
  path: string
  target?: string
}

type RegistryItem = {
  name: string
  files?: RegistryFile[]
}

export type LoadedBlockCodeFile = {
  sourcePath: string
  targetPath: string
  language: string
  content: string
  lineCount: number
}

const appRoot = process.cwd()

// Load one block's source files from registry.json so the Code view stays in
// sync with what `shadcn add` would install without bloating the /blocks page.
export async function getLoadedBlockCodeFiles(
  blockId: string
): Promise<LoadedBlockCodeFile[] | null> {
  const block = VIEWER_BLOCKS.find((item) => item.id === blockId)
  if (!block) return null

  const itemsByName = await getRegistryItemsByName()
  const files = itemsByName.get(block.registryName)?.files ?? []
  return Promise.all(orderBlockFiles(files).map(loadBlockCodeFile))
}

// Show the block wrapper first (it's the teaching artifact), then its deps.
function orderBlockFiles(files: RegistryFile[]): RegistryFile[] {
  return [...files].sort((a, b) => {
    const aBlock = a.path.includes("/blocks/") ? 0 : 1
    const bBlock = b.path.includes("/blocks/") ? 0 : 1
    return aBlock - bBlock
  })
}

async function loadBlockCodeFile(
  file: RegistryFile
): Promise<LoadedBlockCodeFile> {
  const content = await fs.readFile(resolveSourceFilePath(file.path), "utf8")
  return {
    sourcePath: file.path,
    targetPath: normalizeRegistryTarget(file),
    language: getCodeLanguage(file.path),
    content,
    lineCount: content.split("\n").length,
  }
}

async function getRegistryItemsByName() {
  const registryPath = path.join(appRoot, "registry.json")
  const registry = JSON.parse(await fs.readFile(registryPath, "utf8")) as {
    items: RegistryItem[]
  }
  return new Map(registry.items.map((item) => [item.name, item] as const))
}

function getCodeLanguage(filePath: string) {
  const extension = filePath.split(".").pop()
  if (extension === "ts" || extension === "tsx") return "tsx"
  if (extension === "js" || extension === "jsx") return "jsx"
  if (extension === "css") return "css"
  if (extension === "json") return "json"
  if (extension === "md" || extension === "mdx") return "mdx"
  return "tsx"
}

// Turn an install target (or raw path) into the path the file lands at in a
// consumer app — that's the label shown in the Code view's file list.
function normalizeRegistryTarget(file: RegistryFile) {
  const target = file.target ?? file.path
  if (target.startsWith("@components/")) {
    return target.replace("@components/", "components/")
  }
  if (target.startsWith("@ui/")) return target.replace("@ui/", "components/ui/")
  if (target.startsWith("@hooks/")) return target.replace("@hooks/", "hooks/")
  if (target.startsWith("@lib/")) return target.replace("@lib/", "lib/")
  return target
}

function resolveSourceFilePath(filePath: string) {
  // registry.json paths are relative to the app root (apps/v4).
  return path.join(appRoot, filePath)
}
