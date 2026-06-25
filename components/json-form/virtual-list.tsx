"use client";

import * as React from "react";

import { FixedGridRowWindow } from "@/components/ui/fixed-grid-row-window";
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
  const { measureRow, totalSize, viewportClientHeight, virtualRowWindow } =
    useMeasuredRowVirtualization({
      count: fields.length,
      estimateSize: estimateSize + gap,
      getItemKey,
      overscan: 8,
      scrollRef: parentRef,
    });

  return (
    <div ref={parentRef} style={{ maxHeight }} className="overflow-y-auto">
      <FixedGridRowWindow
        data-slot="json-form-virtual-list-spacer"
        totalSize={totalSize}
        virtualRowWindow={virtualRowWindow}
        viewportHeight={viewportClientHeight}
        offsetDataSlot="json-form-virtual-list-row-offset"
        windowDataSlot="json-form-virtual-list-row-window"
      >
        {virtualRowWindow.items.map((virtualRow) => (
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
      </FixedGridRowWindow>
    </div>
  );
}
