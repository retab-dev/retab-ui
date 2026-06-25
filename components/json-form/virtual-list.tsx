"use client";

import * as React from "react";

import { useMeasuredRowVirtualization } from "@/components/ui/measured-row-virtualization";

export function VirtualList({
  fields,
  estimateSize,
  renderItem,
  maxHeight = 480,
  gap = 0,
}: {
  fields: { id: string }[];
  estimateSize: number;
  renderItem: (index: number) => React.ReactNode;
  maxHeight?: number;
  gap?: number;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const getItemKey = React.useCallback(
    (index: number) => fields[index]?.id ?? index,
    [fields],
  );
  const { measureRow, totalSize, virtualRows } = useMeasuredRowVirtualization({
    count: fields.length,
    estimateSize: estimateSize + gap,
    getItemKey,
    overscan: 8,
    scrollRef: parentRef,
  });

  return (
    <div ref={parentRef} style={{ maxHeight }} className="overflow-y-auto">
      <div style={{ height: totalSize, position: "relative" }}>
        {virtualRows.map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={(element) => measureRow(virtualRow.index, element)}
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
  );
}
