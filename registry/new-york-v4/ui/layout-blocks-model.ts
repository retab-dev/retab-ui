import {
  missingEvidenceAnchor,
  resolvedEvidenceAnchor,
  type EvidenceItem,
} from "./document-evidence"
import { getScrollTarget } from "./layout-blocks-geometry"
import {
  createLayoutItemIndex as createLayoutItemIndexForItems,
  type LayoutItemIndex,
} from "./layout-blocks-index"
import type {
  LayoutDocument,
  LayoutItem,
  LayoutLevel,
} from "./layout-blocks-types"

export type LayoutEvidencePayload = {
  item: LayoutItem
  level: LayoutLevel
  kind: string
  text: string
  confidence?: number
  pageNumber: number
}

export type LayoutEvidenceItem = EvidenceItem<LayoutEvidencePayload>

export type LayoutBlocksFilter = {
  levels: readonly LayoutLevel[]
  lowConfidenceOnly?: boolean
  threshold: number
}

export type LayoutBlocksViewerModel = {
  evidenceItems: LayoutEvidenceItem[]
  index: LayoutItemIndex
  visibleItems: LayoutItem[]
}

export function createLayoutBlocksViewerModel({
  document,
  levels,
  lowConfidenceOnly = false,
  threshold,
}: {
  document: LayoutDocument
  levels: readonly LayoutLevel[]
  lowConfidenceOnly?: boolean
  threshold: number
}): LayoutBlocksViewerModel {
  const index = createLayoutItemIndex(document)
  const visibleItems = filterLayoutItems(document.items, {
    levels,
    lowConfidenceOnly,
    threshold,
  })

  return {
    ...layoutItemsToEvidenceModel(visibleItems, index),
    index,
    visibleItems,
  }
}

export function createLayoutItemIndex(
  document: LayoutDocument
): LayoutItemIndex {
  return createLayoutItemIndexForItems({
    items: document.items,
    pages: document.pages,
  })
}

export function filterLayoutItems(
  items: readonly LayoutItem[],
  { levels, lowConfidenceOnly = false, threshold }: LayoutBlocksFilter
): LayoutItem[] {
  const levelSet = new Set(levels)
  return items.filter((item) => {
    if (!levelSet.has(item.level)) return false
    if (!lowConfidenceOnly) return true
    return item.confidence != null && item.confidence < threshold
  })
}

export function layoutItemsToEvidenceModel(
  items: readonly LayoutItem[],
  index: LayoutItemIndex
) {
  const evidenceItems = items.map((item) =>
    layoutItemToEvidenceItem(item, index)
  )
  return {
    evidenceItems,
  }
}

export function layoutItemToEvidenceItem(
  item: LayoutItem,
  index: LayoutItemIndex
): LayoutEvidenceItem {
  const page = index.pagesByNumber.get(item.pageNumber)
  const target = page ? getScrollTarget(item, page) : null

  return {
    id: item.id,
    anchor: target
      ? resolvedEvidenceAnchor({
          kind: "pdf-area",
          pageNumber: target.pageNumber,
          left: target.left,
          top: target.top,
          width: target.width,
          height: target.height,
        })
      : missingEvidenceAnchor(),
    payload: {
      item,
      level: item.level,
      kind: item.kind,
      text: item.text,
      confidence: item.confidence,
      pageNumber: item.pageNumber,
    },
  }
}

export function layoutLevelLabel(level: LayoutLevel) {
  if (level === "block") return "Block"
  if (level === "paragraph") return "Paragraph"
  if (level === "line") return "Line"
  return "Word"
}
