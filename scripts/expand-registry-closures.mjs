// Expand each registry item's files[] and dependencies to the full import
// closure, so a consumer `shadcn add` gets every file/dependency it needs.
//
// The shadcn build does NOT follow imports — files[] and dependencies are
// authored by hand, so an item can ship an entry file while omitting the
// modules it imports (and the npm packages they need). The repo itself stays
// green because it resolves via `@/` path aliases, but a fresh consumer
// install copies only the listed files and fails to compile.
//
// This script derives, for every item, the transitive closure of its imports:
//   - local files it must ship (added to files[])
//   - sibling @retab items it should depend on (when the closure reaches that
//     item's namesake file) and stock shadcn primitives it uses
//   - npm packages it imports (added to dependencies, pinned to this repo's
//     versions; @types/* for known untyped libs go to devDependencies)
//
// It is idempotent: re-running adds nothing once closures are complete.
//
// Usage:
//   node scripts/expand-registry-closures.mjs           # rewrite registry.json
//   node scripts/expand-registry-closures.mjs --check   # exit 1 if drift, no write

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join, normalize } from "node:path"

const ROOT = process.cwd()
const CHECK = process.argv.includes("--check")
const REGISTRY_PATH = join(ROOT, "registry.json")

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"))
const items = new Map(registry.items.map((it) => [it.name, it]))

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
const versions = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
const TYPES_FOR = { utif: "@types/utif", prismjs: "@types/prismjs" }
const NPM_IGNORE = new Set(["react", "react-dom", "next", "node"])

const bare = (dep) => (dep.startsWith("@retab/") ? dep.slice("@retab/".length) : dep)

// Stock shadcn primitives = bare deps referenced anywhere that are not @retab
// items (the migration replaced these with upstream shadcn), plus sheet/tooltip.
const stock = new Set(["sheet", "tooltip"])
for (const it of registry.items) {
  for (const dep of it.registryDependencies ?? []) {
    if (!dep.startsWith("@retab/") && !items.has(dep)) stock.add(dep)
  }
}

const EXTS = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]
function resolveFile(base) {
  for (const e of EXTS) {
    const cand = base + e
    if (existsSync(join(ROOT, cand))) return normalize(cand)
  }
  return null
}

// Resolve an import specifier (from `importer`, a repo-relative path) to the
// repo source file it points at, a ["STOCK", name] marker, or null (npm/builtin).
function resolveImport(importer, spec) {
  if (spec.startsWith("@/")) {
    const p = spec.slice(2)
    const aliases = [
      ["components/ui/", "registry/new-york-v4/ui/"],
      ["lib/", "registry/new-york-v4/lib/"],
      ["hooks/", "registry/new-york-v4/hooks/"],
    ]
    for (const [prefix, real] of aliases) {
      if (p.startsWith(prefix)) {
        const name = p.slice(prefix.length)
        if (prefix === "components/ui/" && stock.has(name.split("/")[0])) {
          return ["STOCK", name.split("/")[0]]
        }
        return resolveFile(real + name) ?? resolveFile(prefix + name)
      }
    }
    return resolveFile(p)
  }
  if (spec.startsWith(".")) {
    return resolveFile(normalize(join(dirname(importer), spec)))
  }
  return null
}

const IMPORT_RE =
  /(?:from|import)\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g
const importCache = new Map()
function importsOf(path) {
  if (importCache.has(path)) return importCache.get(path)
  const full = join(ROOT, path)
  const out = []
  if (existsSync(full)) {
    const txt = readFileSync(full, "utf8")
    let m
    while ((m = IMPORT_RE.exec(txt))) out.push(m[1] || m[2] || m[3])
  }
  importCache.set(path, out)
  return out
}

const entries = (name) => (items.get(name)?.files ?? []).map((f) => normalize(f.path))

// All repo files reachable from an item's entries via local imports (stops at
// stock primitives / npm). Used both as an item's own reach and as the set a
// dependency provides.
const rawClosureCache = new Map()
function rawClosure(name) {
  if (rawClosureCache.has(name)) return rawClosureCache.get(name)
  const seen = new Set()
  const queue = [...entries(name)]
  while (queue.length) {
    const f = normalize(queue.pop())
    if (seen.has(f)) continue
    seen.add(f)
    for (const spec of importsOf(f)) {
      const t = resolveImport(f, spec)
      if (t && !Array.isArray(t)) queue.push(normalize(t))
    }
  }
  rawClosureCache.set(name, seen)
  return seen
}

function transitiveDeps(name, seen = new Set()) {
  for (const dep of items.get(name)?.registryDependencies ?? []) {
    const b = bare(dep)
    if (items.has(b) && !seen.has(b)) {
      seen.add(b)
      transitiveDeps(b, seen)
    }
  }
  return seen
}

// file path -> set of items that ship it (by their authored entries)
const fileOwners = new Map()
for (const name of items.keys()) {
  const it = items.get(name)
  if (!["registry:ui", "registry:lib", "registry:hook"].includes(it.type)) continue
  for (const f of entries(name)) {
    if (!fileOwners.has(f)) fileOwners.set(f, new Set())
    fileOwners.get(f).add(name)
  }
}
const stem = (p) => p.split("/").pop().replace(/\.[^.]+$/, "")
// Cross into another item as a dependency only when the closure reaches that
// item's namesake file (its primary export), not a shared leaf util.
function namesakeOwner(file, exclude) {
  const owners = [...(fileOwners.get(file) ?? [])].filter(
    (m) => m !== exclude && stem(file) === m
  )
  if (!owners.length) return null
  return owners.sort((a, b) => rawClosure(a).size - rawClosure(b).size || (a < b ? -1 : 1))[0]
}

function targetFor(p) {
  if (p.startsWith("registry/new-york-v4/ui/")) return "@ui/" + p.slice("registry/new-york-v4/ui/".length)
  if (p.startsWith("registry/new-york-v4/lib/")) return "@lib/" + p.slice("registry/new-york-v4/lib/".length)
  if (p.startsWith("registry/new-york-v4/hooks/")) return "@hooks/" + p.slice("registry/new-york-v4/hooks/".length)
  if (p.startsWith("components/")) return "@components/" + p.slice("components/".length)
  if (p.startsWith("lib/")) return "@lib/" + p.slice("lib/".length)
  if (p.startsWith("hooks/")) return "@hooks/" + p.slice("hooks/".length)
  return p
}
function typeFor(p) {
  if (p.startsWith("registry/new-york-v4/ui/")) return "registry:ui"
  if (p.startsWith("registry/new-york-v4/lib/")) return "registry:lib"
  if (p.startsWith("registry/new-york-v4/hooks/")) return "registry:hook"
  if (p.startsWith("components/")) return "registry:component"
  if (p.startsWith("lib/")) return "registry:lib"
  if (p.startsWith("hooks/")) return "registry:hook"
  return "registry:file"
}
const pkgName = (spec) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0])

let changedItems = 0
const drift = []
for (const [name, it] of items) {
  if (!it.files?.length) continue

  // --- files + sibling/stock registry deps (owner-aware closure) ---
  const provided = new Set()
  for (const d of transitiveDeps(name)) for (const f of rawClosure(d)) provided.add(f)
  const curFiles = new Set(it.files.map((f) => normalize(f.path)))
  const curDeps = new Set((it.registryDependencies ?? []).map(bare))

  const discoveredDeps = new Set()
  const stockNeeded = new Set()
  const own = new Set()
  const seen = new Set()
  const queue = [...entries(name)]
  while (queue.length) {
    const f = normalize(queue.pop())
    if (seen.has(f)) continue
    seen.add(f)
    if (provided.has(f)) continue
    const owner = namesakeOwner(f, name)
    if (owner && !curFiles.has(f)) {
      discoveredDeps.add(owner)
      for (const x of rawClosure(owner)) provided.add(x)
      for (const dd of transitiveDeps(owner)) for (const x of rawClosure(dd)) provided.add(x)
      continue
    }
    own.add(f)
    for (const spec of importsOf(f)) {
      const t = resolveImport(f, spec)
      if (t == null) continue
      if (Array.isArray(t)) stockNeeded.add(t[1])
      else queue.push(normalize(t))
    }
  }
  const addFiles = [...own].filter((f) => !curFiles.has(f)).sort()
  const addRetabDeps = [...discoveredDeps].filter((d) => !curDeps.has(d)).sort()

  const allDeps = new Set([...curDeps, ...discoveredDeps])
  const declaredStock = new Set([...curDeps].filter((d) => stock.has(d)))
  for (const d of allDeps) {
    if (!items.has(d)) continue
    for (const x of items.get(d).registryDependencies ?? []) {
      if (!x.startsWith("@retab/")) declaredStock.add(x)
    }
  }
  const addStockDeps = [...stockNeeded].filter((s) => !curDeps.has(s) && !declaredStock.has(s)).sort()

  // --- npm dependencies (bare imports across the full set this item ships,
  // including files just added above so a single pass is complete) ---
  const npmDeps = new Set()
  const npmDev = new Set()
  const shipped = new Set([...own, ...it.files.map((x) => normalize(x.path))])
  for (const f of shipped) {
    for (const spec of importsOf(f)) {
      if (spec.startsWith("@/") || spec.startsWith(".") || spec.startsWith("node:")) continue
      const p = pkgName(spec)
      if (NPM_IGNORE.has(p)) continue
      if (versions[p]) npmDeps.add(p)
      if (TYPES_FOR[p] && versions[TYPES_FOR[p]]) npmDev.add(TYPES_FOR[p])
    }
  }
  const curNpm = new Set((it.dependencies ?? []).map((d) => (d.startsWith("@") ? "@" + d.slice(1).split("@")[0] : d.split("@")[0])))
  const addNpm = [...npmDeps].filter((p) => !curNpm.has(p)).sort().map((p) => `${p}@${versions[p]}`)
  const curDev = new Set((it.devDependencies ?? []).map((d) => (d.startsWith("@") ? "@" + d.slice(1).split("@")[0] : d.split("@")[0])))
  const addDev = [...npmDev].filter((p) => !curDev.has(p)).sort().map((p) => `${p}@${versions[p]}`)

  if (!addFiles.length && !addRetabDeps.length && !addStockDeps.length && !addNpm.length && !addDev.length) continue

  changedItems++
  drift.push({ name, files: addFiles.length, deps: addRetabDeps.length + addStockDeps.length, npm: addNpm.length + addDev.length })

  if (!CHECK) {
    for (const p of addFiles) it.files.push({ path: p, type: typeFor(p), target: targetFor(p) })
    if (addRetabDeps.length || addStockDeps.length) {
      it.registryDependencies = it.registryDependencies ?? []
      for (const d of addRetabDeps) it.registryDependencies.push(`@retab/${d}`)
      for (const s of addStockDeps) it.registryDependencies.push(s)
    }
    if (addNpm.length) it.dependencies = [...(it.dependencies ?? []), ...addNpm]
    if (addDev.length) it.devDependencies = [...(it.devDependencies ?? []), ...addDev]
  }
}

if (CHECK) {
  if (drift.length) {
    console.error(`Registry closures are stale in ${drift.length} item(s) — run \`node scripts/expand-registry-closures.mjs\`:`)
    for (const d of drift) console.error(`  ${d.name}: +${d.files} files, +${d.deps} deps, +${d.npm} npm`)
    process.exit(1)
  }
  console.log("Registry closures are complete.")
} else if (changedItems) {
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`)
  console.log(`Expanded closures for ${changedItems} item(s).`)
} else {
  console.log("Registry closures already complete; no changes.")
}
