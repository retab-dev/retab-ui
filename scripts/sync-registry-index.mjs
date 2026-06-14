import { copyFile } from "node:fs/promises"

await copyFile("registry.json", "public/r/registry.json")

