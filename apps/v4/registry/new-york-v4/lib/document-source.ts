// Viewer-agnostic model for "sources" — the provenance of an extracted value:
// where in a source document a field came from. A source is a polygon on a page
// in the document's own pixel coordinates; viewers consume a normalized
// percentage box so an overlay is resolution-, zoom-, and scale-independent.
//
// This module is intentionally free of any viewer/React imports so every viewer
// (PDF today; xlsx/docx/image later) can share one source model + geometry.

/** A point in a page's own coordinate system (PDF/source pixels). */
export interface SourcePoint {
  x: number
  y: number
}

/**
 * A raw citation: a polygon on one page, in the page's own pixel coordinates.
 * `pageWidth`/`pageHeight` travel with it so the geometry is self-describing —
 * a consumer can normalize without knowing how the page will be rendered.
 */
export interface SourceCitation {
  /** 1-based page number. */
  page: number
  /** Bounding polygon (any number of points); reduced to its bbox on normalize. */
  polygon?: SourcePoint[]
  /** Page width in the same units as the polygon points. */
  pageWidth: number
  /** Page height in the same units as the polygon points. */
  pageHeight: number
}

/** A normalized box, each field a percentage [0, 100] of the page. */
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
 * Reduce a citation's polygon to its axis-aligned bounding box and express it as
 * percentages of the page. Returns `undefined` when there's nothing to place
 * (empty polygon or unknown page size) so callers can skip rendering.
 */
export function citationToLocation(
  citation: SourceCitation
): SourceLocation | undefined {
  const polygon = citation.polygon
  if (!polygon?.length || !citation.pageWidth || !citation.pageHeight) {
    return undefined
  }

  const xs = polygon.map((point) => point.x)
  const ys = polygon.map((point) => point.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)

  return {
    page: citation.page,
    area: {
      left: (left / citation.pageWidth) * 100,
      top: (top / citation.pageHeight) * 100,
      width: ((right - left) / citation.pageWidth) * 100,
      height: ((bottom - top) / citation.pageHeight) * 100,
    },
  }
}

/**
 * A stable string key for a location — useful to dedupe repeated hover/select
 * events that resolve to the same box (e.g. before an imperative scroll).
 */
export function sourceLocationKey(location: SourceLocation | undefined) {
  if (!location) return null
  const { area } = location
  return [location.page, area.left, area.top, area.width, area.height].join(":")
}
