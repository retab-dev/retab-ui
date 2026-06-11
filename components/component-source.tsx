import fs from "node:fs"
import path from "node:path"

import { DocsSourceCodeBlock } from "@/components/docs-code-block"

/**
 * Reads a source file from the repo at build time and renders it in the
 * collapsible "Expand / Copy" code panel. Server component — the docs page is
 * statically generated, so the file is read from disk during the build.
 *
 * `src` is relative to the app root (e.g. `components/foo-demo.tsx`).
 */
export function ComponentSource({
  src,
  title,
  language = "tsx",
  className,
}: {
  src: string
  title?: string
  language?: string
  className?: string
}) {
  const code = fs.readFileSync(path.join(process.cwd(), src), "utf-8").trimEnd()

  return (
    <DocsSourceCodeBlock
      code={code}
      className={className}
      fileName={title ?? src.split("/").pop()}
      language={language}
    />
  )
}
