#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import { relative, resolve } from "node:path"

// Bare shadcn primitives that retab no longer publishes locally; consumers pull
// these from the default shadcn registry (shadcn.com), so a bare name here is an
// external dependency, not a missing local item.
const EXTERNAL_STOCK_PRIMITIVES = new Set([
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
])

const registryPaths = process.argv.slice(2)
const selectedRegistryPaths =
  registryPaths.length > 0 ? registryPaths : ["registry.json"]
const cwd = process.cwd()
const repoRoot = findRepoRoot() ?? cwd
const gitKnownPaths = readGitPaths(["ls-files", "--cached", "--deduplicate"])
const untrackedPaths = readGitPaths([
  "ls-files",
  "--others",
  "--exclude-standard",
])
const errors = []
let checkedFileCount = 0
let checkedDependencyCount = 0

for (const registryPath of selectedRegistryPaths) {
  const absoluteRegistryPath = resolve(cwd, registryPath)

  if (!existsSync(absoluteRegistryPath)) {
    errors.push(`${registryPath}: registry file does not exist.`)
    continue
  }

  let registry
  try {
    registry = JSON.parse(readFileSync(absoluteRegistryPath, "utf8"))
  } catch (error) {
    errors.push(`${registryPath}: ${formatParseError(error)}`)
    continue
  }

  if (!Array.isArray(registry.items)) {
    errors.push(`${registryPath}: expected "items" to be an array.`)
    continue
  }

  const itemNames = new Set()
  for (const item of registry.items) {
    if (typeof item?.name === "string" && item.name.trim() !== "") {
      itemNames.add(item.name)
    }
  }

  for (const item of registry.items) {
    validateRegistryDependencies(registryPath, item, itemNames)

    if (!Array.isArray(item.files)) continue

    for (const file of item.files) {
      checkedFileCount += 1
      const sourcePath = file?.path
      const label = `${registryPath}: item ${formatItemName(item)}`

      if (typeof sourcePath !== "string" || sourcePath.trim() === "") {
        errors.push(`${label} has a file entry without a string "path".`)
        continue
      }

      validateRegistryFilePath(label, sourcePath)
    }
  }
}

if (errors.length > 0) {
  console.error("Registry file path preflight failed.")
  console.error(
    `Checked ${checkedFileCount} file references across ${
      selectedRegistryPaths.length
    } registry file${selectedRegistryPaths.length === 1 ? "" : "s"} and ${checkedDependencyCount} registry dependencies.`
  )
  console.error("")
  console.error(errors.join("\n\n"))
  process.exit(1)
}

console.log(
  `Registry preflight passed: ${checkedFileCount} file references and ${checkedDependencyCount} registry dependencies across ${
    selectedRegistryPaths.length
  } registry file${selectedRegistryPaths.length === 1 ? "" : "s"}.`
)

function validateRegistryDependencies(registryPath, item, itemNames) {
  if (!Array.isArray(item.registryDependencies)) return

  const label = `${registryPath}: item ${formatItemName(item)}`

  for (const dependency of item.registryDependencies) {
    checkedDependencyCount += 1

    if (typeof dependency !== "string" || dependency.trim() === "") {
      errors.push(`${label} has a registry dependency without a string name.`)
      continue
    }

    if (isExternalRegistryDependency(dependency)) continue

    if (!itemNames.has(dependency)) {
      errors.push(
        `${label} references an unknown registry dependency: ${dependency}`
      )
    }
  }
}

function validateRegistryFilePath(label, sourcePath) {
  const absoluteSourcePath = resolve(repoRoot, sourcePath)
  const repositoryPath = toRepositoryPath(absoluteSourcePath)

  if (!repositoryPath || repositoryPath.startsWith("../")) {
    errors.push(
      `${label} references a path outside the repository: ${sourcePath}`
    )
    return
  }

  if (!existsSync(absoluteSourcePath)) {
    errors.push(`${label} references a missing file: ${sourcePath}`)
    return
  }

  if (!statSync(absoluteSourcePath).isFile()) {
    errors.push(`${label} references a non-file path: ${sourcePath}`)
    return
  }

  if (!gitKnownPaths || gitKnownPaths.has(repositoryPath)) return

  if (untrackedPaths?.has(repositoryPath)) {
    errors.push(
      [
        `${label} references an untracked file: ${sourcePath}`,
        "shadcn registry build resolves registry file paths from git-known files.",
        `Make the file git-known before building, for example: git add -N ${shellQuote(
          repositoryPath
        )}`,
      ].join("\n")
    )
    return
  }

  errors.push(
    [
      `${label} references a file that is not git-known: ${sourcePath}`,
      "shadcn registry build may not resolve it until it is tracked, staged, or marked intent-to-add.",
    ].join("\n")
  )
}

function isExternalRegistryDependency(dependency) {
  return (
    dependency.startsWith("@") ||
    /^https?:\/\//.test(dependency) ||
    EXTERNAL_STOCK_PRIMITIVES.has(dependency)
  )
}

function findRepoRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

function readGitPaths(args) {
  if (!repoRoot) return null

  try {
    const output = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return new Set(output.split("\n").filter(Boolean))
  } catch {
    return null
  }
}

function toRepositoryPath(absolutePath) {
  return relative(repoRoot, absolutePath).split("\\").join("/")
}

function formatItemName(item) {
  return typeof item?.name === "string"
    ? JSON.stringify(item.name)
    : "<unknown>"
}

function formatParseError(error) {
  return error instanceof Error
    ? `could not parse JSON: ${error.message}`
    : "could not parse JSON."
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value

  return `'${value.replaceAll("'", "'\\''")}'`
}
