import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { JSONSchema7 } from "json-schema";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeaderLabel } from "@/components/json-table/header-label";
import type { JsonTableSchemaEditMode } from "@/components/json-table/json-table-edit-modes";
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes";
import { useHeaderController } from "@/components/json-table/use-header-controller";

const EditableHeaderSchemaMenu = dynamic(
  () =>
    import("@/components/json-table/header-schema-menu").then((module) => ({
      default: module.HeaderSchemaMenu,
    })),
  { ssr: false },
);

interface JsonTableHeaderCellProps {
  node: JsonTableHeaderNode;
  leafCount: number;
  schema: JSONSchema7;
  setSchema: (schema: JSONSchema7) => void;
  stopAt: string[];
  setStopAt: (stopAt: string[]) => void;
  cellWidthPx: number;
  isPublished: boolean;
  draggedItemKeyRef: React.RefObject<string | null>;
  draggedItemParentPathRef: React.RefObject<string | null>;
  schemaEditMode: JsonTableSchemaEditMode;
  disableHeaderInteractions?: boolean;
}

export function JsonTableHeaderCell({
  node,
  leafCount,
  schema,
  setSchema,
  stopAt,
  setStopAt,
  cellWidthPx,
  isPublished,
  draggedItemKeyRef,
  draggedItemParentPathRef,
  schemaEditMode,
  disableHeaderInteractions = false,
}: JsonTableHeaderCellProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const disableSchemaMutationInteractions =
    disableHeaderInteractions || schemaEditMode !== "editable";
  const {
    isDraggable,
    clearDragClasses,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    toggleExpanded,
  } = useHeaderController({
    node,
    schema,
    setSchema,
    stopAt,
    setStopAt,
    draggedItemKeyRef,
    draggedItemParentPathRef,
    disableHeaderInteractions: disableSchemaMutationInteractions,
  });

  if (node.isArrayValuePlaceholder) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="text-foreground hover:bg-muted/40 grow justify-start rounded-none bg-transparent px-1"
      >
        <HeaderLabel
          effectiveType={node.itemEffectiveType ?? node.effectiveType}
          label={node.label}
          width={cellWidthPx - 20}
        />
      </Button>
    );
  }

  const label = (
    <HeaderLabel
      effectiveType={node.effectiveType}
      label={node.label}
      width={cellWidthPx - (node.canFold ? 44 : 20)}
    />
  );
  const canOpenSchemaMenu =
    !disableHeaderInteractions && schemaEditMode !== "readOnly";

  return (
    <div
      className="group flex h-full w-full"
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={isDraggable ? handleDragOver : undefined}
      onDragLeave={(event) => clearDragClasses(event.currentTarget)}
      onDrop={isDraggable ? handleDrop : undefined}
      onDragEnd={handleDragEnd}
    >
      {!canOpenSchemaMenu ? (
        <div className="text-foreground flex h-full grow items-center justify-start rounded-none bg-transparent px-1">
          {label}
        </div>
      ) : (
        <EditableHeaderSchemaMenu
          node={node}
          schema={schema}
          setSchema={setSchema}
          isPublished={isPublished}
          schemaEditMode={schemaEditMode}
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground hover:bg-muted/40 h-full grow justify-start rounded-none border-0 bg-transparent px-1 sm:h-full"
          >
            {label}
          </Button>
        </EditableHeaderSchemaMenu>
      )}

      {node.canFold && (
        <Button
          variant="ghost"
          size="icon"
          className={`h-full sm:h-full ${node.isArray ? "w-9 sm:w-9" : "w-6 sm:w-6"} text-foreground hover:bg-muted/40 rounded-none bg-transparent`}
          onClick={toggleExpanded}
        >
          {stopAt.includes(node.key) ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </Button>
      )}
    </div>
  );
}
