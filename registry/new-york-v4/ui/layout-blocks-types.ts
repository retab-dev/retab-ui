export type LayoutLevel = "block" | "paragraph" | "line" | "word"

export type LayoutKind =
  | "title"
  | "heading"
  | "paragraph"
  | "list"
  | "table"
  | "figure"
  | "header"
  | "footer"
  | "pageNumber"
  | "other"

export type LayoutPoint = {
  x: number
  y: number
}

export type LayoutRect = {
  left: number
  top: number
  width: number
  height: number
}

export type LayoutQuad = [
  LayoutPoint,
  LayoutPoint,
  LayoutPoint,
  LayoutPoint,
]

export type LayoutTextSpan = {
  start: number
  end: number
}

export type LayoutItem = {
  id: string
  pageNumber: number
  level: LayoutLevel
  kind: LayoutKind
  text: string
  confidence?: number
  rect?: LayoutRect
  quad?: LayoutQuad
  parentId?: string
  span?: LayoutTextSpan
}

export type LayoutPage = {
  pageNumber: number
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
}

export type LayoutDocument = {
  text: string
  pages: LayoutPage[]
  items: LayoutItem[]
}

export type LayoutBlockSelection = {
  activeItemId: string | null
  selectedItemId: string | null
  effectiveItemId: string | null
  setActiveItemId: (itemId: string | null) => void
  selectItemId: (itemId: string | null) => void
  clearActiveItemId: () => void
  clearSelectedItemId: () => void
  clear: () => void
}
