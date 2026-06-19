"use client";

import * as React from "react";

import {
  beginSchemaRowDrag,
  leaveSchemaRowDragTarget,
  resolveSchemaRowDrop,
  updateSchemaRowDragTarget,
} from "@/components/schema-editor/primitives/schema-row-drag";

import type { ObjectPropertyRowModel } from "@/components/schema-editor/property-form/model/object-properties-view";

export function useObjectPropertiesRowDrag({
  rows,
  editable,
}: {
  rows: ObjectPropertyRowModel[];
  editable: boolean;
}) {
  const draggedRowIdRef = React.useRef<string | null>(null);
  const rowIds = rows.map((row) => row.id);

  const getRowDragProps = (row: ObjectPropertyRowModel) => {
    if (!editable) {
      return {
        draggable: false,
        onDragStart: noopDragHandler,
        onDragOver: noopDragHandler,
        onDragLeave: noopDragHandler,
        onDrop: noopDragHandler,
      };
    }

    return {
      draggable: true,
      onDragStart: (event: React.DragEvent<HTMLDivElement>) => {
        beginSchemaRowDrag({
          event,
          item: {
            id: row.id,
            label: row.name,
          },
          draggedRowIdRef,
        });
      },
      onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
        updateSchemaRowDragTarget({
          event,
          rowIds,
          targetRowId: row.id,
          draggedRowIdRef,
        });
      },
      onDragLeave: leaveSchemaRowDragTarget,
      onDrop: (event: React.DragEvent<HTMLDivElement>) => {
        const move = resolveSchemaRowDrop({
          event,
          rowIds,
          targetRowId: row.id,
          draggedRowIdRef,
        });
        if (!move) return;

        const sourceRow = rows.find(
          (candidate) => candidate.id === move.sourceRowId,
        );
        sourceRow?.reorder.move(move.targetIndex);
      },
    };
  };

  return {
    rowIds,
    getRowDragProps,
  };
}

function noopDragHandler() {}
