import {
  detectCategory,
  extensionOf,
  extractName,
  resolveViewerDescriptor,
  type FileCategory,
  type ViewerDescriptor,
  type ViewerSource,
} from "@/lib/viewer-source"

export type { FileCategory, ViewerSource }

export interface FileViewerProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}

export type FileDescriptor = ViewerDescriptor

export function resolveFileDescriptor({
  source,
  as,
}: FileViewerProps): FileDescriptor {
  return resolveViewerDescriptor({
    source,
    category: as,
  })
}

export function descriptorResetKey(descriptor: FileDescriptor): string {
  return [
    descriptor.identityKey,
    descriptor.displayName,
    descriptor.mimeType ?? "",
    descriptor.category,
  ].join("\u0000")
}

const CODE_TEXT_EXTENSIONS = new Set([
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

const CODE_TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/javascript",
  "application/x-javascript",
  "application/x-ndjson",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "text/css",
  "text/javascript",
  "text/jsx",
  "text/tsx",
  "text/xml",
  "text/yaml",
  "text/x-yaml",
])

export function isProseTextDescriptor(descriptor: FileDescriptor): boolean {
  if (descriptor.category !== "text") return false

  const extension = extensionOf(descriptor.fileName)
  if (extension === "txt" || extension === "text") return true
  return !extension && descriptor.mimeType?.toLowerCase() === "text/plain"
}

export function isCodeTextDescriptor(descriptor: FileDescriptor): boolean {
  if (descriptor.category !== "text") return false

  const extension = extensionOf(descriptor.fileName)
  if (extension) return CODE_TEXT_EXTENSIONS.has(extension)

  const mimeType = descriptor.mimeType?.toLowerCase().split(";")[0].trim()
  return mimeType ? CODE_TEXT_MIME_TYPES.has(mimeType) : false
}

export { detectCategory, extensionOf, extractName }

export async function timed<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const on =
    typeof globalThis !== "undefined" &&
    (globalThis as { __FILE_VIEWER_PROFILE__?: boolean })
      .__FILE_VIEWER_PROFILE__
  if (!on) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    console.log(
      `[file-viewer] ${label} ${(performance.now() - t0).toFixed(1)}ms`
    )
  }
}

export function baseName(url: string): string {
  return url.split("/").pop() ?? url
}
