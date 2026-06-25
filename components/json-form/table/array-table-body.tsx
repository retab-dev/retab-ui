"use client";

import * as React from "react";

import { FixedGridRowWindow } from "@/components/ui/fixed-grid-row-window";
import { useFixedRowVirtualization } from "@/components/ui/fixed-grid-virtualization";
import { joinJsonFormPath } from "@/components/json-form/path-codec";
import {
  TABLE_JUMP_ROW_OVERSCAN,
  TABLE_MAX_HEIGHT,
  TABLE_ROW_HEIGHT,
  TABLE_ROW_OVERSCAN,
} from "@/components/json-form/table/array-table-config";
import {
  useArrayTableScrollActivity,
  type ArrayTableScrollHandlers,
} from "@/components/json-form/table/array-table-scroll";

type ArrayTableField = { id: string };

export function StaticArrayTableBody({
  fields,
  scrollHandlers,
  renderItem,
}: {
  fields: ArrayTableField[];
  scrollHandlers: ArrayTableScrollHandlers;
  renderItem: (index: number) => React.ReactNode;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  useArrayTableScrollActivity(scrollRef, scrollHandlers);

  return (
    <div
      ref={scrollRef}
      data-slot="json-form-table-scroll"
      className="overflow-y-auto"
      style={{ maxHeight: TABLE_MAX_HEIGHT }}
    >
      <div className="[contain:layout_paint_style]">
        {fields.map((entry, index) => (
          <React.Fragment key={entry.id}>{renderItem(index)}</React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function FixedArrayTableBody({
  name,
  fields,
  activeEditorPath,
  scrollHandlers,
  renderItem,
}: {
  name: string;
  fields: ArrayTableField[];
  activeEditorPath: string | null;
  scrollHandlers: ArrayTableScrollHandlers;
  renderItem: (index: number, rowTopPx: number) => React.ReactNode;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { virtualRowWindow, totalRowSize, viewportClientHeight } =
    useFixedRowVirtualization({
      rowCount: fields.length,
      rowSize: TABLE_ROW_HEIGHT,
      rowOverscan: TABLE_ROW_OVERSCAN,
      jumpRowOverscan: TABLE_JUMP_ROW_OVERSCAN,
      scrollRef,
    });
  useArrayTableScrollActivity(scrollRef, scrollHandlers);

  return (
    <div
      ref={scrollRef}
      data-slot="json-form-table-scroll"
      className="overflow-y-auto"
      style={{ maxHeight: TABLE_MAX_HEIGHT }}
    >
      <FixedGridRowWindow
        totalSize={totalRowSize}
        minWidth="100%"
        rowMinWidth="100%"
        virtualRowWindow={virtualRowWindow}
        viewportHeight={viewportClientHeight}
        offsetDataSlot="json-form-table-row-offset"
        windowDataSlot="json-form-table-row-window"
        className="[contain:layout_paint_style]"
      >
        {virtualRowWindow.items.map((virtualRow, slotIndex) => {
          const isEditingRow = activeEditorPath?.startsWith(
            `${joinJsonFormPath(name, virtualRow.index)}.`,
          );
          return (
            <React.Fragment
              key={
                isEditingRow ? fields[virtualRow.index].id : `slot-${slotIndex}`
              }
            >
              {renderItem(virtualRow.index, virtualRow.start)}
            </React.Fragment>
          );
        })}
      </FixedGridRowWindow>
    </div>
  );
}
