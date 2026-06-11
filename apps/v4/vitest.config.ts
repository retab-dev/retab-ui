import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Default to node; React/DOM tests opt into jsdom via a per-file
    // `// @vitest-environment jsdom` directive.
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "registry/**/*.test.ts",
    ],
  },
})
