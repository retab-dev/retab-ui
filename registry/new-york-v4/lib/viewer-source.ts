export type FileCategory =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "csv"
  | "image"
  | "markdown"
  | "html"
  | "text"
  | "unsupported"

export type ViewerSource =
  | UrlViewerSource
  | TextViewerSource
  | BytesViewerSource

export interface UrlViewerSource {
  kind: "url"
  url: string
  fileName?: string
  mimeType?: string
  downloadUrl?: string
  identityKey?: string
}

export interface TextViewerSource {
  kind: "text"
  text: string
  fileName?: string
  mimeType?: string
  identityKey?: string
}

export interface BytesViewerSource {
  kind: "bytes"
  bytes: ArrayBuffer | Uint8Array | Blob
  fileName?: string
  mimeType?: string
  downloadUrl?: string
  identityKey?: string
}

export interface ViewerDescriptor {
  source: ViewerSource
  category: FileCategory
  identityKey: string
  displayName: string
  downloadFileName: string
  downloadHref?: string
  loadUrl?: string
  mimeType?: string
}

const EXTENSION_CATEGORY: Record<string, FileCategory> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  xls: "xlsx",
  xlsm: "xlsx",
  pptx: "pptx",
  csv: "csv",
  tsv: "csv",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
  ico: "image",
  tif: "image",
  tiff: "image",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  html: "html",
  htm: "html",
  txt: "text",
  text: "text",
  log: "text",
  json: "text",
  jsonl: "text",
  json5: "text",
  ndjson: "text",
  xml: "text",
  yaml: "text",
  yml: "text",
  toml: "text",
  ini: "text",
  env: "text",
  js: "text",
  mjs: "text",
  cjs: "text",
  jsx: "text",
  ts: "text",
  tsx: "text",
  css: "text",
  scss: "text",
  less: "text",
  py: "text",
  rb: "text",
  go: "text",
  rs: "text",
  java: "text",
  kt: "text",
  c: "text",
  h: "text",
  cpp: "text",
  cc: "text",
  cs: "text",
  php: "text",
  sh: "text",
  bash: "text",
  zsh: "text",
  sql: "text",
  graphql: "text",
  proto: "text",
  lua: "text",
  r: "text",
  swift: "text",
  scala: "text",
  pl: "text",
  vue: "text",
  svelte: "text",
}

export function extensionOf(name: string): string | null {
  const clean = name.split(/[?#]/)[0]
  const base = clean.split("/").pop() ?? clean
  const dot = base.lastIndexOf(".")
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : null
}

export function extractName(url: string): string {
  const clean = url.split(/[?#]/)[0]
  return clean.split("/").pop() || "file"
}

export function detectCategory(
  fileName: string,
  mimeType?: string
): FileCategory {
  const ext = extensionOf(fileName)
  if (ext && EXTENSION_CATEGORY[ext]) return EXTENSION_CATEGORY[ext]
  if (mimeType) {
    const fromMime = categoryFromMime(mimeType)
    if (fromMime) return fromMime
  }
  return "unsupported"
}

export function resolveViewerDescriptor({
  source,
  fileName,
  mimeType,
  category,
}: {
  source: ViewerSource
  fileName?: string
  mimeType?: string
  category?: FileCategory
}): ViewerDescriptor {
  const resolvedMimeType = mimeType ?? source.mimeType
  const displayName = fileName ?? source.fileName ?? defaultDisplayName(source)
  const downloadFileName =
    fileName ?? source.fileName ?? defaultDownloadFileName(source)
  const resolvedCategory =
    category ?? detectCategory(displayName, resolvedMimeType)

  return {
    source,
    category: resolvedCategory,
    identityKey: source.identityKey ?? defaultIdentityKey(source),
    displayName,
    downloadFileName,
    downloadHref: downloadHrefOf(source),
    loadUrl: source.kind === "url" ? source.url : undefined,
    mimeType: resolvedMimeType,
  }
}

function categoryFromMime(mimeType: string): FileCategory | null {
  const mime = mimeType.toLowerCase().split(";")[0].trim()
  if (mime === "application/pdf") return "pdf"
  if (mime.includes("wordprocessingml")) return "docx"
  if (mime.includes("spreadsheet") || mime.includes("ms-excel")) return "xlsx"
  if (mime.includes("presentation") || mime.includes("ms-powerpoint")) {
    return "pptx"
  }
  if (mime === "text/csv" || mime === "text/tab-separated-values") return "csv"
  if (mime === "text/markdown") return "markdown"
  if (mime === "text/html") return "html"
  if (mime.startsWith("image/")) return "image"
  if (mime === "application/json" || mime === "application/xml") return "text"
  if (mime.startsWith("text/")) return "text"
  return null
}

function defaultDisplayName(source: ViewerSource) {
  if (source.kind === "url") return source.url
  if (source.kind === "text") return "text.txt"
  return "file"
}

function defaultDownloadFileName(source: ViewerSource) {
  if (source.kind === "url") return extractName(source.url)
  if (source.kind === "text") return "text.txt"
  return "file"
}

function defaultIdentityKey(source: ViewerSource) {
  if (source.kind === "url") return `url:${source.url}`
  if (source.kind === "text") return `text:${source.text}`
  return `bytes:${byteLengthOf(source.bytes)}:${source.fileName ?? ""}:${
    source.mimeType ?? ""
  }`
}

function downloadHrefOf(source: ViewerSource) {
  if (source.kind === "url") return source.downloadUrl ?? source.url
  if (source.kind === "bytes") return source.downloadUrl
  return undefined
}

function byteLengthOf(bytes: BytesViewerSource["bytes"]) {
  if (bytes instanceof ArrayBuffer) return bytes.byteLength
  if ("byteLength" in bytes) return bytes.byteLength
  return bytes.size
}
