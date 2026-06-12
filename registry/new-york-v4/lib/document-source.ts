// Viewer-agnostic model for "sources" — the provenance of an extracted value:
// where in a source document a field came from. Mirrors the Retab
// `GET /v1/extractions/{id}/sources` response (`GetSourcesResponse`): a value
// tree plus a parallel `sources` tree whose leaves locate each value with a
// format-specific anchor.
//
// This module has no viewer/React imports so every viewer (PDF today; image,
// xlsx, csv, docx, text later) shares one source model. Each viewer's adapter
// turns an `anchor` into something it can render (see e.g. the PDF adapter).

// ── Anchors — discriminated union on `kind`, one per document format ──────────

/** A region on one PDF page, normalized to the page box (each value in [0, 1]). */
export interface PdfBboxAnchor {
  kind: "pdf_bbox"
  /** 1-based page number. */
  page: number
  left: number
  top: number
  width: number
  height: number
}

/** A region on an image, normalized to the image box (each value in [0, 1]). */
export interface ImageBboxAnchor {
  kind: "image_bbox"
  /**
   * 1-based frame index for multi-page rasters — a multi-frame TIFF page, or a
   * rasterized slide in a deck. Omitted (or 1) for a single-frame image.
   */
  page?: number
  left: number
  top: number
  width: number
  height: number
}

/** A cell in a CSV. */
export interface CsvCellAnchor {
  kind: "csv_cell"
  /** 1-based row number. */
  row: number
  /** Column letter (A, B, … AA). */
  column: string
  /** Cell coordinate (e.g. A12). */
  coordinate?: string
}

/** A cell in a spreadsheet (xlsx), on a given sheet. */
export interface SpreadsheetCellAnchor {
  kind: "spreadsheet_cell"
  /** 1-based row number. */
  row: number
  /** Column letter (A, B, … AA). */
  column: string
  coordinate?: string
  /** 0-based sheet index. */
  sheet_index: number
  sheet_name?: string
}

/** A character span within a docx paragraph. */
export interface DocxTextSpanAnchor {
  kind: "docx_text_span"
  /** 0-based paragraph index. */
  paragraph: number
  char_start?: number
  char_end?: number
  /** Raw OOXML of the matched paragraph. */
  xml?: string
}

/** A character span within a docx table cell. */
export interface DocxTableCellAnchor {
  kind: "docx_table_cell"
  /** 0-based table index. */
  table: number
  /** 0-based row index. */
  row: number
  /** 0-based column index. */
  column: number
  char_start?: number
  char_end?: number
  xml?: string
}

/** A line/character span within plain text. */
export interface TextSpanAnchor {
  kind: "text_span"
  /** 1-based start line. */
  line_start: number
  /** 1-based end line. */
  line_end: number
  char_start?: number
  char_end?: number
}

export type SourceAnchor =
  | PdfBboxAnchor
  | ImageBboxAnchor
  | CsvCellAnchor
  | SpreadsheetCellAnchor
  | DocxTextSpanAnchor
  | DocxTableCellAnchor
  | TextSpanAnchor

/** Where one extracted value came from: its quoted text + a format-specific anchor. */
export interface Source {
  /** Minimal source text corresponding to the extracted value. */
  content: string
  anchor: SourceAnchor
}

// ── The `GET /v1/extractions/{id}/sources` response ───────────────────────────

export type DocumentType = "pdf" | "image" | "csv" | "xlsx" | "docx" | "txt"

export interface SourceFileRef {
  id: string
  filename?: string
  mime_type?: string
}

/** A leaf of the `sources` tree: the value plus the source backing it (or null). */
export interface SourcedLeaf {
  value: unknown
  source: Source | null
}

/** Response of `GET /v1/extractions/{id}/sources`. */
export interface ExtractionSourcesResponse {
  object: "extraction.sources"
  extraction_id: string
  document_type: DocumentType
  file: SourceFileRef
  /** Original extraction output (the value tree). */
  extraction: Record<string, unknown>
  /** Same shape as `extraction`, but every leaf is a `{ value, source }`. */
  sources: Record<string, unknown>
}

// ── SourceMap — the flat join structure ──────────────────────────────────────

/**
 * The join key between a field-rendering component and its source. Dotted path,
 * matching both Retab's field-location keys and react-hook-form's field names
 * (`owner.name`, `properties.0.gas_volume`) — so json-form's `setSourcesFieldPath`
 * plugs straight in with no conversion.
 */
export type SourcePath = string

/** Flat lookup from field path to its source. */
export type SourceMap = Record<SourcePath, Source>

const SOURCE_ANCHOR_KINDS = new Set<string>([
  "pdf_bbox",
  "image_bbox",
  "csv_cell",
  "spreadsheet_cell",
  "docx_text_span",
  "docx_table_cell",
  "text_span",
])

function isSourcedLeaf(node: unknown): node is SourcedLeaf {
  if (typeof node !== "object" || node === null) return false
  if (!("value" in node) || !("source" in node)) return false
  const sourceSlot = (node as Record<string, unknown>).source

  // A schema may legitimately have sibling fields named `value` and `source`.
  // In the source tree those field values are sourced leaves themselves, while
  // a wrapper's `source` slot is either null or a source-shaped payload.
  return !isSourcedLeaf(sourceSlot)
}

function isSource(source: unknown): source is Source {
  if (typeof source !== "object" || source === null) return false
  const record = source as Record<string, unknown>
  const anchor = record.anchor
  if (typeof record.content !== "string") return false
  if (typeof anchor !== "object" || anchor === null) return false
  return isSourceAnchor(anchor)
}

function isSourceAnchor(anchor: object): boolean {
  const record = anchor as Record<string, unknown>
  const kind = record.kind
  if (typeof kind !== "string" || !SOURCE_ANCHOR_KINDS.has(kind)) return false

  if (kind === "pdf_bbox") {
    return isPositiveInteger(record.page) && isValidNormalizedBox(record)
  }
  if (kind === "image_bbox") {
    return (
      (record.page == null || isPositiveInteger(record.page)) &&
      isValidNormalizedBox(record)
    )
  }
  if (kind === "csv_cell") {
    return isPositiveInteger(record.row) && isColumnLetters(record.column)
  }
  if (kind === "spreadsheet_cell") {
    return (
      isNonNegativeInteger(record.sheet_index) &&
      isPositiveInteger(record.row) &&
      isColumnLetters(record.column)
    )
  }
  if (kind === "docx_text_span") {
    return (
      isNonNegativeInteger(record.paragraph) &&
      isValidOptionalRange(record.char_start, record.char_end)
    )
  }
  if (kind === "docx_table_cell") {
    return (
      isNonNegativeInteger(record.table) &&
      isNonNegativeInteger(record.row) &&
      isNonNegativeInteger(record.column) &&
      isValidOptionalRange(record.char_start, record.char_end)
    )
  }
  if (kind === "text_span") {
    return (
      isPositiveInteger(record.line_start) &&
      isPositiveInteger(record.line_end) &&
      record.line_end >= record.line_start &&
      isValidOptionalRange(record.char_start, record.char_end)
    )
  }
  return false
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isColumnLetters(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z]+$/.test(value)) return false
  let index = 0
  for (const character of value.toUpperCase()) {
    index = index * 26 + (character.charCodeAt(0) - 64)
    if (!Number.isSafeInteger(index)) return false
  }
  return true
}

function isValidOptionalRange(start: unknown, end: unknown) {
  if (start == null && end == null) return true
  if (start == null || end == null) return false
  return (
    isNonNegativeInteger(start) && isNonNegativeInteger(end) && end >= start
  )
}

function isValidNormalizedBox(record: Record<string, unknown>) {
  if (
    !isFiniteNumber(record.left) ||
    !isFiniteNumber(record.top) ||
    !isFiniteNumber(record.width) ||
    !isFiniteNumber(record.height)
  ) {
    return false
  }
  return (
    record.left >= 0 &&
    record.top >= 0 &&
    record.width > 0 &&
    record.height > 0 &&
    record.left + record.width <= 1 &&
    record.top + record.height <= 1
  )
}

/**
 * Flatten the nested `sources` tree (from `ExtractionSourcesResponse.sources`)
 * into a flat `SourceMap` keyed by dotted path. Leaves without a source are
 * skipped. Arrays use numeric path segments (`items.0.amount`).
 */
export function extractionSourcesToSourceMap(sources: unknown): SourceMap {
  const map: SourceMap = {}

  const walk = (node: unknown, prefix: string) => {
    if (isSourcedLeaf(node)) {
      if (isSource(node.source)) map[prefix] = node.source
      if (node.value != null && typeof node.value === "object") {
        walk(node.value, prefix)
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, prefix ? `${prefix}.${i}` : `${i}`))
      return
    }
    if (typeof node === "object" && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        walk(value, prefix ? `${prefix}.${key}` : key)
      }
    }
  }

  walk(sources, "")
  return map
}

// ── Viewer-ready geometry — a normalized 2D region on a page ──────────────────

/** A box on a page, each field a percentage [0, 100] of the page. */
export interface SourceArea {
  left: number
  top: number
  width: number
  height: number
}

/** A normalized, viewer-ready location: which page, and where on it (in %). */
export interface SourceLocation {
  page: number
  area: SourceArea
}

/**
 * A stable string key for a location — used to dedupe repeated hover/select
 * events that resolve to the same box before an imperative scroll.
 */
export function sourceLocationKey(location: SourceLocation | undefined) {
  if (!location) return null
  const { area } = location
  return [location.page, area.left, area.top, area.width, area.height].join(":")
}
