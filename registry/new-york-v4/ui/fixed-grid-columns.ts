export interface FixedGridColumn<Metadata = unknown> {
  key: string
  widthPx: number
  metadata?: Metadata
}

export function buildFixedGridColumns<Item, Metadata = unknown>({
  items,
  getKey,
  getWidthPx,
  getMetadata,
}: {
  items: readonly Item[]
  getKey: (item: Item, index: number) => string
  getWidthPx: (item: Item, index: number) => number
  getMetadata?: (item: Item, index: number) => Metadata | undefined
}): FixedGridColumn<Metadata>[] {
  return items.map((item, index) => {
    const metadata = getMetadata?.(item, index)
    return metadata === undefined
      ? {
          key: getKey(item, index),
          widthPx: getWidthPx(item, index),
        }
      : {
          key: getKey(item, index),
          widthPx: getWidthPx(item, index),
          metadata,
        }
  })
}

export function fixedGridColumnWidths(
  columns: readonly Pick<FixedGridColumn, "widthPx">[]
) {
  return columns.map((column) => column.widthPx)
}
