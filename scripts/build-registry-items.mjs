import { spawn } from "node:child_process"
import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { rewriteRegistryPayloadFile } from "./rewrite-registry-imports.mjs"

const itemNames = process.argv.slice(2)

if (itemNames.length === 0) {
  console.error("Usage: node scripts/build-registry-items.mjs <item...>")
  process.exitCode = 1
  process.exit()
}

const registry = JSON.parse(await readFile("registry.json", "utf8"))
const itemsByName = new Map(registry.items.map((item) => [item.name, item]))
const selectedItems = itemNames.map((name) => {
  const item = itemsByName.get(name)
  if (!item) throw new Error(`Unknown registry item: ${name}`)
  return item
})

const tempDir = await mkdtemp(join(tmpdir(), "retab-registry-items-"))
const tempRegistryPath = join(tempDir, "registry.json")
const tempOutputDir = join(tempDir, "public-r")

try {
  await writeFile(
    tempRegistryPath,
    `${JSON.stringify(
      {
        ...registry,
        items: selectedItems,
      },
      null,
      2
    )}\n`
  )

  await run(localBin("shadcn"), [
    "build",
    tempRegistryPath,
    "--output",
    tempOutputDir,
  ])

  for (const name of itemNames) {
    const builtPath = join(tempOutputDir, `${name}.json`)
    await rewriteRegistryPayloadFile(builtPath)
    await copyFile(builtPath, join("public/r", `${name}.json`))
  }
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`))
    })
  })
}

function localBin(command) {
  return join(
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${command}.cmd` : command
  )
}
