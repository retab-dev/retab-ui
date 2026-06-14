import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const artifactPath = "public/r/data-cell.json"

function buildDataCellRegistryItem() {
  execFileSync("node", ["scripts/build-registry-items.mjs", "data-cell"], {
    stdio: "inherit",
  })
}

buildDataCellRegistryItem()
const first = readFileSync(artifactPath, "utf8")
buildDataCellRegistryItem()
const second = readFileSync(artifactPath, "utf8")

if (first !== second) {
  throw new Error(`${artifactPath} changed on the second scoped registry build`)
}

console.log(`${artifactPath} is deterministic across scoped builds`)
