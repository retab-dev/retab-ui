"use client"

import * as React from "react"

export type PdfAreaAnchor = {
  kind: "pdf-area"
  pageNumber: number
  left: number
  top: number
  width: number
  height: number
}

export type ImageAreaAnchor = {
  kind: "image-area"
  frameNumber?: number
  left: number
  top: number
  width: number
  height: number
}

export type TextRangeAnchor = {
  kind: "text-range"
  startLine: number
  endLine: number
}

export type CsvCellAnchor = {
  kind: "csv-cell"
  rowIndex: number
  columnIndex: number
}

export type XlsxCellAnchor = {
  kind: "xlsx-cell"
  sheetIndex: number
  rowIndex: number
  columnIndex: number
}

export type DocxTargetAnchor = {
  kind: "docx-target"
  target:
    | {
        kind: "text"
        text: string
      }
    | {
        kind: "cell"
        table: number
        row: number
        column: number
      }
}

export type DocumentAnchor =
  | PdfAreaAnchor
  | ImageAreaAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxTargetAnchor

export type AnchoredItemId = string

export type AnchoredItem = {
  id: AnchoredItemId
  anchor: DocumentAnchor | null
  disabled?: boolean
}

export type AnchoredDocumentTarget = {
  scrollToAnchor: (
    anchor: DocumentAnchor,
    options: { behavior: ScrollBehavior }
  ) => void
}

export type FieldAnchorLink = {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField?: (path: string) => void
}

type AnchoredDocumentContextValue = {
  activeAnchor: DocumentAnchor | null
  activeItem: AnchoredItem | null
  activeItemId: AnchoredItemId | null
  activateItem: (
    itemId: AnchoredItemId,
    options?: { behavior?: ScrollBehavior }
  ) => void
  clear: () => void
  clearPreview: () => void
  clearSelection: () => void
  items: readonly AnchoredItem[]
  previewItem: (itemId: AnchoredItemId | null) => void
  selectItem: (itemId: AnchoredItemId | null) => void
  selectedItem: AnchoredItem | null
  selectedItemId: AnchoredItemId | null
}

const AnchoredDocumentContext =
  React.createContext<AnchoredDocumentContextValue | null>(null)

export function AnchoredDocumentProvider({
  children,
  initialItemId = null,
  items,
  target,
}: {
  children: React.ReactNode
  initialItemId?: AnchoredItemId | null
  items: readonly AnchoredItem[]
  target?: AnchoredDocumentTarget
}) {
  const [previewItemId, setPreviewItemId] =
    React.useState<AnchoredItemId | null>(null)
  const [selectedItemId, setSelectedItemId] =
    React.useState<AnchoredItemId | null>(initialItemId)
  const itemsById = React.useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )
  const getEnabledItem = React.useCallback(
    (itemId: AnchoredItemId | null) => {
      if (!itemId) return null
      const item = itemsById.get(itemId) ?? null
      return item && !item.disabled ? item : null
    },
    [itemsById]
  )
  const selectedItem = selectedItemId
    ? getEnabledItem(selectedItemId)
    : null
  const previewItem = previewItemId
    ? getEnabledItem(previewItemId)
    : null
  const activeItem = previewItem ?? selectedItem ?? null
  const activeItemId = activeItem?.id ?? null
  const activeAnchor = activeItem?.anchor ?? null

  React.useEffect(() => {
    if (
      selectedItemId &&
      (!itemsById.has(selectedItemId) || itemsById.get(selectedItemId)?.disabled)
    ) {
      setSelectedItemId(null)
    }
    if (
      previewItemId &&
      (!itemsById.has(previewItemId) || itemsById.get(previewItemId)?.disabled)
    ) {
      setPreviewItemId(null)
    }
  }, [itemsById, previewItemId, selectedItemId])

  const scrollItem = React.useCallback(
    (item: AnchoredItem | null, behavior: ScrollBehavior) => {
      if (!item?.anchor || item.disabled) return
      target?.scrollToAnchor(item.anchor, { behavior })
    },
    [target]
  )

  const previewItemById = React.useCallback(
    (itemId: AnchoredItemId | null) => {
      const item = getEnabledItem(itemId)
      if (itemId && !item) return
      setPreviewItemId(item?.id ?? null)
      if (itemId) {
        scrollItem(item, "auto")
      }
    },
    [getEnabledItem, scrollItem]
  )

  const selectItem = React.useCallback(
    (itemId: AnchoredItemId | null) => {
      const item = getEnabledItem(itemId)
      if (itemId && !item) return
      setPreviewItemId(null)
      setSelectedItemId(item?.id ?? null)
    },
    [getEnabledItem]
  )

  const activateItem = React.useCallback(
    (
      itemId: AnchoredItemId,
      options: { behavior?: ScrollBehavior } = {}
    ) => {
      const item = getEnabledItem(itemId)
      if (!item) return
      setPreviewItemId(null)
      setSelectedItemId(item.id)
      scrollItem(item, options.behavior ?? "smooth")
    },
    [getEnabledItem, scrollItem]
  )

  const clearPreview = React.useCallback(() => {
    setPreviewItemId(null)
  }, [])

  const clearSelection = React.useCallback(() => {
    setSelectedItemId(null)
  }, [])

  const clear = React.useCallback(() => {
    setPreviewItemId(null)
    setSelectedItemId(null)
  }, [])

  const previewItemAction = React.useCallback(
    (itemId: AnchoredItemId | null) => {
      if (itemId == null) {
        clearPreview()
        return
      }
      previewItemById(itemId)
    },
    [clearPreview, previewItemById]
  )

  const value = React.useMemo<AnchoredDocumentContextValue>(
    () => ({
      activeAnchor,
      activeItem,
      activeItemId,
      activateItem,
      clear,
      clearPreview,
      clearSelection,
      items,
      previewItem: previewItemAction,
      selectItem,
      selectedItem: selectedItem ?? null,
      selectedItemId: selectedItem?.id ?? null,
    }),
    [
      activeAnchor,
      activeItem,
      activeItemId,
      activateItem,
      clear,
      clearPreview,
      clearSelection,
      items,
      previewItemAction,
      selectItem,
      selectedItem,
    ]
  )

  return (
    <AnchoredDocumentContext.Provider value={value}>
      {children}
    </AnchoredDocumentContext.Provider>
  )
}

export function useAnchoredDocument() {
  const context = React.useContext(AnchoredDocumentContext)
  if (!context) {
    throw new Error(
      "useAnchoredDocument must be used within AnchoredDocumentProvider."
    )
  }
  return context
}

export function useAnchoredFieldLink(): FieldAnchorLink {
  const { activateItem, activeItemId, previewItem } = useAnchoredDocument()
  return React.useMemo(
    () => ({
      activePath: activeItemId,
      onFieldHover: previewItem,
      selectField: (path: string) => {
        activateItem(path)
      },
    }),
    [activateItem, activeItemId, previewItem]
  )
}
