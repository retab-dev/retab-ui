"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

export function VirtualList({
  fields,
  estimateSize,
  renderItem,
  maxHeight = 480,
  gap = 0,
}: {
  fields: { id: string }[]
  estimateSize: number
  renderItem: (index: number) => React.ReactNode
  maxHeight?: number
  gap?: number
}) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan: 8,
  })

  return (
    <div ref={parentRef} style={{ maxHeight }} className="overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={fields[virtualRow.index].id}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
              paddingBottom: gap,
            }}
          >
            {renderItem(virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
