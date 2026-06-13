import {
  extensionOf,
  resolveViewerDescriptor,
  type FileCategory,
  type ViewerDescriptor,
  type ViewerSource,
} from "@/lib/viewer-source"

export function resolveThumbnailDescriptor({
  source,
  as,
}: {
  source: ViewerSource
  as?: FileCategory
}): ViewerDescriptor {
  return resolveViewerDescriptor({ source, category: as })
}

export function isTiffDescriptor(descriptor: ViewerDescriptor): boolean {
  const mime = descriptor.mimeType?.toLowerCase().split(";")[0].trim()
  if (mime === "image/tiff" || mime === "image/tif") return true
  const extension = extensionOf(descriptor.displayName)
  return extension === "tif" || extension === "tiff"
}

const CODE_THUMBNAIL_EXTENSIONS = new Set([
  "bash",
  "c",
  "cc",
  "cjs",
  "cpp",
  "cs",
  "css",
  "env",
  "go",
  "graphql",
  "h",
  "ini",
  "java",
  "js",
  "json",
  "json5",
  "jsonl",
  "jsx",
  "kt",
  "less",
  "log",
  "lua",
  "mjs",
  "ndjson",
  "php",
  "pl",
  "proto",
  "py",
  "r",
  "rb",
  "rs",
  "scala",
  "scss",
  "sh",
  "sql",
  "svelte",
  "swift",
  "toml",
  "ts",
  "tsx",
  "vue",
  "xml",
  "yaml",
  "yml",
  "zsh",
])

export function isCodeThumbnailDescriptor(
  descriptor: ViewerDescriptor
): boolean {
  const extension = extensionOf(descriptor.displayName)
  if (extension && CODE_THUMBNAIL_EXTENSIONS.has(extension)) return true

  const mime = descriptor.mimeType?.toLowerCase().split(";")[0].trim()
  return (
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "text/javascript" ||
    mime === "application/javascript" ||
    Boolean(mime?.endsWith("+json") || mime?.endsWith("+xml"))
  )
}
