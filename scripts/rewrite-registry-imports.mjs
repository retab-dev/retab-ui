// Rewrites repo-internal `@/registry/new-york-v4/*` import specifiers inside
// built registry payloads (`files[].content`) into their install-time aliases.
//
// Registry sources may import shared modules through the repo's registry
// alias (e.g. `@/registry/new-york-v4/ui/pdf-viewer-canvas`), but consumers
// install those files to `components/ui/`, `lib/`, etc. Payloads must ship
// the consumer-facing specifiers so a fresh install compiles without relying
// on CLI-specific import transforms (see
// tests/thumbnail-regressions.test.tsx "generates install-safe imports").
//
// Usage: node scripts/rewrite-registry-imports.mjs <file-or-dir.json ...>
import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { pathToFileURL } from "node:url"

// Keep in sync with the file targets used in registry.json:
//   registry/new-york-v4/ui/*     -> @ui/*         (components/ui/*)
//   registry/new-york-v4/blocks/* -> @components/blocks/*
//   registry/new-york-v4/lib/*    -> @lib/*        (lib/*)
//   registry/new-york-v4/hooks/*  -> @hooks/*      (hooks/*)
const IMPORT_REWRITES = [
  [/@\/registry\/new-york-v4\/ui\//g, "@/components/ui/"],
  [/@\/registry\/new-york-v4\/blocks\//g, "@/components/blocks/"],
  [/@\/registry\/new-york-v4\/lib\//g, "@/lib/"],
  [/@\/registry\/new-york-v4\/hooks\//g, "@/hooks/"],
]

export function rewriteRegistryItemImports(item) {
  if (!item || !Array.isArray(item.files)) return false

  let changed = false
  for (const file of item.files) {
    if (typeof file?.content !== "string") continue
    const rewritten = rewriteContentImports(file.content)
    if (rewritten !== file.content) {
      file.content = rewritten
      changed = true
    }
  }
  return changed
}

export function rewriteContentImports(content) {
  let next = content
  for (const [pattern, replacement] of IMPORT_REWRITES) {
    next = next.replace(pattern, replacement)
  }
  return next
}

export async function rewriteRegistryPayloadFile(filePath) {
  const raw = await readFile(filePath, "utf8")
  const payload = JSON.parse(raw)
  if (!rewriteRegistryItemImports(payload)) return false

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`)
  return true
}

async function collectPayloadFiles(target) {
  const stats = await stat(target)
  if (stats.isFile()) return [target]

  const entries = await readdir(target)
  return entries
    .filter((entry) => extname(entry) === ".json")
    .map((entry) => join(target, entry))
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const targets = process.argv.slice(2)
  if (targets.length === 0) {
    console.error(
      "Usage: node scripts/rewrite-registry-imports.mjs <file-or-dir.json ...>"
    )
    process.exitCode = 1
  } else {
    let rewritten = 0
    for (const target of targets) {
      for (const filePath of await collectPayloadFiles(target)) {
        if (await rewriteRegistryPayloadFile(filePath)) {
          rewritten += 1
          console.log(`rewrote registry imports: ${filePath}`)
        }
      }
    }
    console.log(`rewrite-registry-imports: ${rewritten} payload(s) updated`)
  }
}
