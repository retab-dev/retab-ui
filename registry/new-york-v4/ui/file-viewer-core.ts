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

function categoryFromMime(mime: string): FileCategory | null {
  const m = mime.toLowerCase().split(";")[0].trim()
  if (m === "application/pdf") return "pdf"
  if (m.includes("wordprocessingml")) return "docx"
  if (m.includes("spreadsheet") || m.includes("ms-excel")) return "xlsx"
  if (m.includes("presentation") || m.includes("ms-powerpoint")) return "pptx"
  if (m === "text/csv" || m === "text/tab-separated-values") return "csv"
  if (m === "text/markdown") return "markdown"
  if (m === "text/html") return "html"
  if (m.startsWith("image/")) return "image"
  if (m === "application/json" || m === "application/xml") return "text"
  if (m.startsWith("text/")) return "text"
  return null
}

export function extensionOf(name: string): string | null {
  const clean = name.split(/[?#]/)[0]
  const base = clean.split("/").pop() ?? clean
  const dot = base.lastIndexOf(".")
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : null
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

export interface FileViewerProps {
  src: string
  fileName?: string
  mimeType?: string
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}

export interface FileDescriptor {
  src: string
  displayName: string
  downloadName: string
  mimeType?: string
  category: FileCategory
}

export function resolveFileDescriptor({
  src,
  fileName,
  mimeType,
  as,
}: FileViewerProps): FileDescriptor {
  const displayName = fileName ?? src
  return {
    src,
    displayName,
    downloadName: fileName ?? extractName(src),
    mimeType,
    category: as ?? detectCategory(displayName, mimeType),
  }
}

export function descriptorResetKey(descriptor: FileDescriptor): string {
  return [
    descriptor.src,
    descriptor.displayName,
    descriptor.mimeType ?? "",
    descriptor.category,
  ].join("\u0000")
}

export function extractName(src: string): string {
  const clean = src.split(/[?#]/)[0]
  return clean.split("/").pop() || "file"
}

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
    // eslint-disable-next-line no-console
    console.log(
      `[file-viewer] ${label} ${(performance.now() - t0).toFixed(1)}ms`
    )
  }
}

export function baseName(src: string): string {
  return src.split("/").pop() ?? src
}
