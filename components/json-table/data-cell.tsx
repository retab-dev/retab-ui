import * as React from "react";
import { TableCell } from "@/components/ui-retab/table";
import { Input, InputArea } from "@/components/ui-retab/input";
import { Checkbox } from "@/components/ui-retab/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-retab/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover";
import { JSONSchema7 } from "json-schema";
import {
  ACTION_COLUMN_WIDTH,
  ColumnWidth,
  getColumnWidthPx,
  getRowHeightPx,
  useSheetOptionsStore,
} from "@/components/json-table/table-options-store";
import {
  cmp,
  materialize,
  PathInfo,
  useRefCallback,
  assignObjectKey,
} from "@/components/json-table/path-utils";
import {
  buildSchemaDefaultValue,
  getSchemaPropertyType,
  unwrapSchema,
} from "@/components/json-table/header-from-schema";
import {
  ObjectEditor,
  ArrayEditor,
} from "@/components/json-table/object-editor";
import {
  compute_score_from_likelihood_and_dot_notation_path,
  get_value_from_row_array_and_dot_notation_path,
  isValidProperty,
} from "@/components/json-table/lib/json-schema-utils";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  CONSENSUS_COLORMAP,
  CONSENSUS_COLORMAP_OPACITY,
  CONSENSUS_INVERSE,
  DISTANCES_COLORMAP,
  DISTANCES_COLORMAP_OPACITY,
  DISTANCES_INVERSE,
  getColor,
  getColorFast,
  getMismatchColor,
} from "@/components/json-table/lib/colors";
import { useTabStateStore } from "@/components/json-table/tab-state-store";
import {
  dateStringToFormat,
  dateToHTMLDateTimeString,
  dateToHTMLTimeString,
  getLocalDateString,
  autoFormatDateTimeFields,
} from "@/components/json-table/lib/date-utils";
import { Calendar } from "@/components/ui-retab/calendar";
import { Button } from "@/components/ui-retab/button";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { TableDocument } from "@/components/json-table/lib/projects-types";
import type { RowLike } from "@/components/json-table/lib/column-types";
// Dataset hooks removed; validation handled via drilled props

import { parseDateStringAsLocal } from "@/components/json-table/lib/date-utils";

const safeParseISO = (
  dateString: string | null | undefined,
): Date | undefined => {
  return parseDateStringAsLocal(dateString) ?? undefined;
};

import { getTheme } from "@/components/json-table/lib/themes";
import { Textarea } from "@/components/ui-retab/textarea";
import { getFlagAtPath } from "@/components/json-table/validation-flags-utils";
import {
  HoverInfo,
  useHoverInfo,
} from "@/components/json-table/hover-info-context";
import { getPredictionLikelihoods } from "@/components/json-table/lib/consensus-metadata";
import { findMatchingHighlightedFieldPattern } from "@/components/json-table/lib/review-highlight-utils";
// Removed project/spec-based computed detection in favor of schema X-ComputedField tagging

// Cache schema property lookups by (schema object, dot path)
type PropertyInfo = {
  rawProperty: any;
  nullable: boolean;
  isValidProp: boolean;
  isObject: boolean;
  isArray: boolean;
  isText: boolean;
  isEnum: boolean;
  isNumber: boolean;
  isFloat: boolean;
  isInteger: boolean;
  isDate: boolean;
  isDateTime: boolean;
  isIsoTime: boolean;
  isBoolean: boolean;
  propertyEnumVals: any[];
};

const schemaPropertyCache = new WeakMap<object, Map<string, PropertyInfo>>();

function getPropertyInfoCached(
  schema: any,
  path: string,
): PropertyInfo | undefined {
  if (!schema || !path) return undefined;
  let cache = schemaPropertyCache.get(schema);
  if (!cache) {
    cache = new Map<string, PropertyInfo>();
    schemaPropertyCache.set(schema, cache);
  }
  const existing = cache.get(path);
  if (existing) return existing;

  // Resolve the final node once (getSchemaPropertyType internally resolves $ref for traversal
  // and returns a resolved node at the end). Avoid full unwrapSchema here.
  const node = getSchemaPropertyType(schema, path) as any;
  if (!node) return undefined;

  const isValidProp = !!(node && isValidProperty(node));

  // // Detect nullability cheaply
  // const combos = (node as any).anyOf || (node as any).oneOf || (node as any).allOf;
  // const typeArray = Array.isArray(node?.type) ? (node.type as any[]) : null;
  // const nullable = !!(
  //     (typeArray && typeArray.includes('null')) ||
  //     (Array.isArray(combos) && combos.some((o: any) => (o as any)?.type === 'null'))
  // );

  // // Choose a simple effective branch for flags without cloning
  // let effective: any = node;
  // if (typeArray) {
  //     const nonNull = typeArray.find((t) => t !== 'null');
  //     if (nonNull) {
  //         effective = { ...node, type: nonNull };
  //     }
  // } else if (Array.isArray(combos) && combos.length) {
  //     const nonNullBranch = combos.find((o: any) => (o as any)?.type && (o as any)?.type !== 'null');
  //     if (nonNullBranch) effective = nonNullBranch;
  // }
  // Resolve nullable unions and $ref targets on the final node so flags (like enum)
  // reflect the effective, non-null schema.
  const unwrapped = unwrapSchema(node as any, schema as any);
  const nullable = !!unwrapped.nullable;
  const effective: any = unwrapped.schema as any;

  const info: PropertyInfo = {
    rawProperty: node,
    nullable,
    isValidProp,
    isObject: effective?.type === "object",
    isArray: effective?.type === "array",
    isText: effective?.type === "string",
    isEnum: !!effective?.enum,
    isNumber: effective?.type === "number",
    isFloat: effective?.type === "float",
    isInteger: effective?.type === "integer",
    isDate: effective?.format === "date",
    isDateTime: effective?.format === "date-time",
    isIsoTime: effective?.format === "iso-time",
    isBoolean: effective?.type === "boolean",
    propertyEnumVals: effective?.enum ?? [],
  };
  cache.set(path, info);
  return info;
}

// TypeScript interface for hovered cell data
export interface PopoverCellData {
  mouseX: number;
  mouseY: number;
}

export function DoubleClickInput({
  className,
  disabled = false,
  isReferenceSheet: _isReferenceSheet = false,
  ...props
}: any) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Let the browser handle native caret positioning
  const handleMouseDown = (_e: React.MouseEvent) => {
    // Nothing to do — we want the default behaviour here
    // so the caret lands exactly where the user clicked.
  };

  // Handle double click to focus the input
  const handleDoubleClick = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  // Handle key down events for Enter and Escape keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      inputRef.current?.blur();
      e.preventDefault();
    }
  };

  return (
    <Input
      {...props}
      className={cn(
        "cursor-default border-0 focus:cursor-text disabled:text-inherit disabled:opacity-100",
        className,
      )}
      onKeyDown={handleKeyDown}
      onSubmit={() => inputRef.current?.blur()}
      ref={inputRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        // Prevent propagation when already focused to maintain focus
        if (document.activeElement === inputRef.current) {
          e.stopPropagation();
        }
        // Call the original onClick if provided
        props.onClick?.(e);
      }}
      onDoubleClick={handleDoubleClick}
      disabled={disabled}
    />
  );
}

export function DoubleClickTextarea({
  className,
  disabled = false,
  isReferenceSheet: _isReferenceSheet = false,
  ...props
}: any) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Let the browser handle native caret positioning
  const handleMouseDown = (_e: React.MouseEvent) => {
    // Nothing to do — we want the default behaviour here
    // so the caret lands exactly where the user clicked.
  };

  // Handle double click to focus the input
  const handleDoubleClick = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  // Handle key down events for Enter and Escape keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      inputRef.current?.blur();
      e.preventDefault();
    }
  };

  return (
    <InputArea
      {...props}
      className={cn("cursor-default focus:cursor-text", className)}
      onKeyDown={handleKeyDown}
      onSubmit={() => inputRef.current?.blur()}
      ref={inputRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        // Prevent propagation when already focused to maintain focus
        if (document.activeElement === inputRef.current) {
          e.stopPropagation();
        }
        // Call the original onClick if provided
        props.onClick?.(e);
      }}
      onDoubleClick={handleDoubleClick}
      readOnly={disabled}
    />
  );
}

function stripProperties(value: any): any {
  const {
    docId: _docId,
    filename: _filename,
    fileType: _fileType,
    lastModified: _lastModified,
    _flat_similarities,
    _full_similarities,
    _similarity,
    _aligned_flat_similarities,
    _aligned_full_similarities,
    _aligned_similarity,
    _flat_reference_elements,
    _aligned_flat_reference_elements,
    ...rest
  } = value;
  return rest;
}

function transferContext(type: JSONSchema7, context: any): JSONSchema7 {
  // Ensure we properly merge $defs from both context and type
  const contextDefs = context?.$defs || {};
  const typeDefs = (type as any)?.$defs || {};

  const result = {
    ...type,
    $defs: {
      ...contextDefs,
      ...typeDefs,
    },
  };

  return result;
}

interface PlusCellProps {
  keyValue: string;
  rowIdx: number;
  colIdxStart: number;
  colIdxEnd: number;
  pathInfo?: PathInfo;
  schema: JSONSchema7;
  row: RowLike;
  docId: string;
  columnWidth: ColumnWidth;
  actionColumnsCount: number;
  onGroundTruthDataChange: (docId: string, value: any) => void;
  currentIterationId: string;
}

export function PlusMergedCell({
  keyValue,
  rowIdx,
  colIdxStart,
  colIdxEnd,
  pathInfo,
  schema,
  row,
  docId,
  columnWidth,
  onGroundTruthDataChange,
  actionColumnsCount,
  currentIterationId,
}: PlusCellProps) {
  const width = getColumnWidthPx(columnWidth);
  const { isExtracting } = useTabStateStore();
  const theme = getTheme(currentIterationId);
  const isDisabled =
    (!currentIterationId.includes("dataset") &&
      !currentIterationId.includes("review")) ||
    isExtracting[currentIterationId];

  if (pathInfo?.plusPathIdx !== undefined) {
    let actualKey = keyValue;
    for (let i = 0; i < pathInfo.plusPathIdx!; i++) {
      actualKey = actualKey.replace("*", String(pathInfo.idx[i]));
    }
    actualKey =
      actualKey.slice(0, actualKey.indexOf("*")) +
      pathInfo.idx[pathInfo.plusPathIdx!];
    const property = getSchemaPropertyType(schema, actualKey);

    const isObject = property.type === "object";
    const isArray = property.type === "array";
    return (
      <TableCell
        key={`${keyValue}-${rowIdx}-${colIdxStart}-empty`}
        className={`group m-0 flex items-center justify-center border-r border-b p-0 last:border-b-0 ${theme.tableContainerBg} ${theme.border} ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        style={{
          width: `${width * (colIdxEnd - colIdxStart + 1 - actionColumnsCount) + ACTION_COLUMN_WIDTH * actionColumnsCount}px`,
          minWidth: `${width * (colIdxEnd - colIdxStart + 1 - actionColumnsCount) + ACTION_COLUMN_WIDTH * actionColumnsCount}px`,
        }}
        onClick={() => {
          if (isDisabled) return; // Prevent adding rows when not on reference sheet or when extracting
          const baseRoot =
            (row.original as any)?.prediction_data?.prediction ?? {};
          const createdValue = isArray
            ? []
            : isObject
              ? buildSchemaDefaultValue(property)
              : null;
          const newRoot = assignObjectKey(
            baseRoot,
            actualKey.split("."),
            createdValue,
          );
          onGroundTruthDataChange(docId, newRoot);
          // Broadcast an optimistic update for the target field
          try {
            const evt = new CustomEvent(
              "retab:optimistic-update" as any,
              {
                detail: { docId, fieldPath: actualKey, value: createdValue },
              } as any,
            );
            window.dispatchEvent(evt);
          } catch {
            /* noop */
          }
        }}
      >
        <div
          className={`${!isDisabled ? "hover:border hover:border-primary" : ""} flex h-full w-full items-center justify-center`}
        >
          {" "}
          {
            <Plus
              size={16}
              className={`${theme.plusButtonIcon} ${isDisabled ? "opacity-50" : "opacity-100"}`}
            />
          }
        </div>
      </TableCell>
    );
  }
}

interface DataCellProps {
  keyValue: string;
  rowIdx: number;
  pathInfo?: PathInfo;
  schema: JSONSchema7;
  row: RowLike;
  docId: string;
  cellColorState: "none" | "consensus" | "similarity" | "mismatch";
  columnWidth: ColumnWidth;
  setOpenPopover: (key: string | null) => void;
  openPopover: string | null;
  onGroundTruthDataChange: (docId: string, value: any) => void;
  currentIterationId: string;
  similarityType: "unaligned" | "aligned";
  rowDistanceData?: any; // Make rowDistanceData optional
  onCellHoverStart?: (info: HoverInfo) => void;
  onCellHoverEnd?: () => void;
  validationFlags?: any;
  allowEditing?: boolean; // Controls whether cell values can be edited
  fieldIndicationMap?: Map<string, string>;
  fieldReasoningMap?: Map<string, string>;
}

function calculateVariables(props: DataCellProps & {}) {
  const { row, rowDistanceData, ...rest } = props;
  const { pathInfo, similarityType, keyValue, cellColorState } = props;

  const actualKey = pathInfo?.idx
    ? materialize(keyValue, pathInfo?.idx)
    : undefined;

  let cellScore: number | undefined = undefined;

  const getAverageNumericValue = (node: unknown): number | undefined => {
    const values: number[] = [];
    const walk = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        values.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach(walk);
      }
    };
    walk(node);
    if (values.length === 0) return undefined;
    return values.reduce((sum, item) => sum + item, 0) / values.length;
  };

  const toWildcardIndexPath = (path: string): string => {
    return path
      .split(".")
      .map((segment) => (/^\d+$/.test(segment) ? "*" : segment))
      .join(".");
  };

  const resolveConsensusScore = (
    likelihoods: unknown,
    fieldPath: string,
  ): number | undefined => {
    if (!likelihoods || typeof likelihoods !== "object") return undefined;

    const wildcardPath = toWildcardIndexPath(fieldPath);
    const candidatePaths = Array.from(
      new Set([
        fieldPath,
        wildcardPath,
        fieldPath.startsWith("data.")
          ? fieldPath.slice(5)
          : `data.${fieldPath}`,
        wildcardPath.startsWith("data.")
          ? wildcardPath.slice(5)
          : `data.${wildcardPath}`,
        fieldPath.startsWith("prediction.")
          ? fieldPath.slice(11)
          : `prediction.${fieldPath}`,
        wildcardPath.startsWith("prediction.")
          ? wildcardPath.slice(11)
          : `prediction.${wildcardPath}`,
      ]),
    );

    for (const candidatePath of candidatePaths) {
      const nestedValue = get_value_from_row_array_and_dot_notation_path(
        likelihoods,
        candidatePath,
      );
      if (nestedValue !== undefined) {
        const score = compute_score_from_likelihood_and_dot_notation_path(
          likelihoods,
          candidatePath,
        );
        return Number.isFinite(score) ? score : undefined;
      }

      const flatValue = (likelihoods as Record<string, unknown>)[candidatePath];
      if (flatValue !== undefined) {
        if (typeof flatValue === "number" && Number.isFinite(flatValue)) {
          return flatValue;
        }
        const aggregated = getAverageNumericValue(flatValue);
        if (aggregated !== undefined) {
          return aggregated;
        }
      }
    }

    return undefined;
  };

  if (cellColorState === "consensus") {
    // Consensus mode: use likelihoods from prediction_metadata
    const likelihoods = getPredictionLikelihoods(
      row.original?.prediction_data?.metadata,
    );
    if (likelihoods && actualKey) {
      cellScore = resolveConsensusScore(likelihoods, actualKey);
    }
  } else if (cellColorState === "similarity" || cellColorState === "mismatch") {
    // Similarity/Mismatch mode: use distance data from rowDistanceData
    // Both modes use the same nested data structure
    if (actualKey && rowDistanceData) {
      // Use fresh distance data from React Query
      if (similarityType === "aligned") {
        cellScore = rowDistanceData.aligned_path_similarity?.[actualKey];
      } else {
        cellScore = rowDistanceData.unaligned_path_similarity?.[actualKey];
      }
    }
  }

  return {
    ...rest,
    actualKey,
    row,
    cellScore,
  };
}

const DataCellContent = (
  props: DataCellProps & {
    onCellClick?: (cellData: PopoverCellData) => void;
  },
) => {
  const { hoverInfo, setHoverInfo } = useHoverInfo();

  const {
    actualKey,
    schema,
    docId,
    cellColorState,
    setOpenPopover,
    openPopover,
    onGroundTruthDataChange,
    currentIterationId,
    cellScore,
    row,
  } = calculateVariables(props);

  // Get theme classes based on sheet type
  const theme = getTheme(currentIterationId);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC OR EARLY RETURNS
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  // Text cells render a plain <div> for display/hover and only mount the
  // <textarea> editor once the user clicks to edit. A <textarea> is a scroll
  // container, so leaving one under the pointer (as the old always-mounted
  // version did) swallows wheel events and blocks scrolling over text cells.
  const [isTextEditing, setIsTextEditing] = useState(false);

  // While a cell editor is open it overflows its cell. The virtualizer puts
  // every row in its own stacking context (via `transform`), so the editor's
  // own z-index can't lift it above *other* rows — later rows paint over it and
  // it looks transparent. Elevate the whole row's stacking context while editing
  // so the (opaque) editor overlay covers its neighbours, then reset on close.
  const cellRootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const editing = isInputFocused || isSelectOpen || isDatePopoverOpen;
    const rowEl = cellRootRef.current?.closest<HTMLElement>("[data-index]");
    if (!rowEl) return;
    rowEl.style.zIndex = editing ? "20" : "";
    return () => {
      rowEl.style.zIndex = "";
    };
  }, [isInputFocused, isSelectOpen, isDatePopoverOpen]);

  // Use the value from the PathInfo
  const value = props.pathInfo?.value;

  // Optimistic local value to reflect changes immediately in the UI
  const [optimisticValue, setOptimisticValue] = useState<any>(undefined);

  // Helpers shared with commit/cleanup comparisons
  const safeStringify = React.useCallback((v: any) => {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }, []);
  const normalize = React.useCallback(
    (v: any) => (v == null || v === "" ? null : v),
    [],
  );

  // Prefer optimistic value for rendering until server/parent state catches up
  const effectiveValue =
    optimisticValue !== undefined ? optimisticValue : value;
  const cleanStringValue =
    effectiveValue !== null && effectiveValue !== undefined
      ? String(effectiveValue)
      : "";

  // Listen for external optimistic updates (e.g., PlusMergedCell creating new paths).
  // Ref mirrors keep the mount-only listener reading the latest cell identity.
  const docIdRef = useRef(docId);
  const actualKeyRef = useRef(actualKey);
  docIdRef.current = docId;
  actualKeyRef.current = actualKey;

  useMountEffect(() => {
    const handleOptimisticUpdate = (event: Event) => {
      const detail = (event as any)?.detail as
        | { docId?: string; fieldPath?: string; value: any }
        | undefined;
      if (!detail) return;
      if (
        detail.docId === docIdRef.current &&
        detail.fieldPath === actualKeyRef.current
      ) {
        setOptimisticValue(detail.value);
      }
    };
    window.addEventListener(
      "retab:optimistic-update" as any,
      handleOptimisticUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "retab:optimistic-update" as any,
        handleOptimisticUpdate as EventListener,
      );
    };
  });

  const [stringValue, setStringValue] = useState<string>(
    () => cleanStringValue,
  );
  const liveStringValue =
    isInputFocused || isDatePopoverOpen ? stringValue : cleanStringValue;

  let cellWidth = getColumnWidthPx(props.columnWidth);
  if (props.keyValue.endsWith("__delete")) {
    cellWidth = 50;
  }

  const isHovering =
    hoverInfo?.docId === props.docId && hoverInfo?.fieldPath === actualKey;

  // --- Debounce Logic Start ---
  const commitValueChange = useRefCallback(function (validatedValue: any) {
    if (!actualKey) return;
    if (!isEditableReference) return;

    const previousRoot = row.original.prediction_data?.prediction ?? {};
    const previousValue = get_value_from_row_array_and_dot_notation_path(
      previousRoot,
      actualKey,
    );

    const prevNorm = normalize(previousValue);
    const nextNorm = normalize(validatedValue);
    const uiNorm = normalize(value as any);

    const isNoOp =
      previousValue === validatedValue ||
      safeStringify(prevNorm) === safeStringify(nextNorm) ||
      safeStringify(uiNorm) === safeStringify(nextNorm);
    if (isNoOp) return;

    const newRoot = assignObjectKey(
      previousRoot,
      actualKey.split("."),
      validatedValue,
    );
    onGroundTruthDataChange(docId, newRoot);
    // Optimistically reflect the new value in the cell UI
    setOptimisticValue(validatedValue);
  });

  const onChange = useRefCallback(function (newValue: any) {
    if (actualKey) {
      // Apply autoFormatDateTimeFields validation to the new value
      let validatedValue = newValue;
      if (property && property.format && typeof newValue === "string") {
        try {
          // Create a temporary schema object for this specific field
          const fieldSchema = {
            type: "object",
            properties: {
              [actualKey.split(".").pop()!]: property,
            },
          };

          // Apply validation to the field value
          const validatedData = autoFormatDateTimeFields(
            { [actualKey.split(".").pop()!]: newValue },
            fieldSchema,
          );
          validatedValue = validatedData[actualKey.split(".").pop()!];
        } catch (error) {
          console.warn(
            `autoFormatDateTimeFields validation failed for ${actualKey}:`,
            error,
          );
        }
      }
      commitValueChange(validatedValue);
    }
  });

  const handleCellHover = useRefCallback((e: React.MouseEvent) => {
    if (actualKey) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      props.onCellHoverStart?.({ docId, fieldPath: actualKey, rect });
    }
  });

  // Get background color based on cell color state
  const getCellBackgroundColor = () => {
    // No coloring if cellColorState is "none" or undefined, or if no score
    if (
      props.cellColorState === "none" ||
      !props.cellColorState ||
      cellScore === undefined
    ) {
      return "transparent";
    }
    if (props.cellColorState === "consensus") {
      return getColorFast(
        CONSENSUS_COLORMAP,
        cellScore,
        CONSENSUS_INVERSE,
        CONSENSUS_COLORMAP_OPACITY,
      );
    }
    if (props.cellColorState === "mismatch") {
      return getMismatchColor(cellScore);
    }
    // Default to similarity
    return getColorFast(
      DISTANCES_COLORMAP,
      cellScore,
      DISTANCES_INVERSE,
      DISTANCES_COLORMAP_OPACITY,
    );
  };

  const cellBgColor = getCellBackgroundColor();
  const cellStyle = {
    width: `${cellWidth}px`,
    minWidth: `${cellWidth}px`,
    backgroundColorHover: cellBgColor,
    backgroundColor: cellBgColor,
    userSelect: "none" as const,
  };

  // NOW WE CAN DO CONDITIONAL LOGIC AND EARLY RETURNS
  // Render an empty cell or placeholder

  // Cached schema property lookup for performance
  const propInfo = actualKey
    ? getPropertyInfoCached(schema, actualKey)
    : undefined;
  const property = propInfo?.rawProperty;
  const isComputedField = !!(property && (property as any)["X-ComputedField"]);
  const isFunctionField = !!(property && (property as any)["X-FunctionField"]);
  // Allow editing if either the allowEditing prop is true OR it's a dataset/review iteration
  // But always block editing for computed and function fields
  const isEditableReference =
    (props.allowEditing ||
      currentIterationId.includes("dataset") ||
      currentIterationId.includes("review")) &&
    !isComputedField &&
    !isFunctionField;
  const optional = !!propInfo?.nullable;
  const isValidProp = !!propInfo?.isValidProp;
  const isObject = !!propInfo?.isObject;
  const isArray = !!propInfo?.isArray;
  const isEnum = !!propInfo?.isEnum;
  const isNumber = !!propInfo?.isNumber;
  const isText = !!propInfo?.isText;
  const isFloat = !!propInfo?.isFloat;
  const isInteger = !!propInfo?.isInteger;
  const isDate = !!propInfo?.isDate;
  const isDateTime = !!propInfo?.isDateTime;
  const isIsoTime = !!propInfo?.isIsoTime;
  const isBoolean = !!propInfo?.isBoolean; // Depend on inputValue and the original onChange function
  // Update local state if the external value prop changes
  // --- Debounce Logic End ---

  // Validation flag via encapsulated hook
  //const { isValid: validationFlag } = useFieldValidationFlag(docId ?? undefined, actualKey ?? undefined);

  // Update the handlers to use actualKey
  const handleObjectFormSubmitLocal = (values: any) => {
    if (actualKey) {
      // Apply autoFormatDateTimeFields validation to object values
      let validatedValues = values;
      if (property && property.type === "object" && property.properties) {
        try {
          validatedValues = autoFormatDateTimeFields(values, property);
        } catch (error) {
          console.warn(
            `autoFormatDateTimeFields validation failed for object ${actualKey}:`,
            error,
          );
        }
      }

      commitValueChange(validatedValues);
      setOpenPopover(null);
    }
  };

  const handleArrayFormSubmitLocal = (values: any) => {
    if (actualKey) {
      // Apply autoFormatDateTimeFields validation to array values
      let validatedValues = values;
      if (property && property.type === "array" && property.items) {
        try {
          validatedValues = autoFormatDateTimeFields(values, property);
        } catch (error) {
          console.warn(
            `autoFormatDateTimeFields validation failed for array ${actualKey}:`,
            error,
          );
        }
      }

      commitValueChange(validatedValues);
      setOpenPopover(null);
    }
  };

  const scalarValueType =
    cellColorState === "similarity"
      ? "similarity"
      : cellColorState === "consensus"
        ? "consensus"
        : cellColorState === "mismatch"
          ? "mismatch"
          : "none";
  // Check if there's a reasoning field for this field

  // Mouse enter/leave handlers removed - now using click to show floating content

  const date = safeParseISO(liveStringValue);
  const showInput =
    (isHovering || isInputFocused || isSelectOpen || isDatePopoverOpen) &&
    isEditableReference;

  const validationFlag = actualKey
    ? getFlagAtPath(props.validationFlags, actualKey)
    : undefined;
  const showVerifiedStyling =
    currentIterationId.includes("dataset") && !!validationFlag;
  const showComputedStyling = isComputedField;
  const showFunctionStyling = isFunctionField;
  const reviewHighlightedPattern = React.useMemo(() => {
    if (!actualKey) return null;

    const highlightedPatterns = new Set<string>();
    props.fieldIndicationMap?.forEach((_, pattern) => {
      highlightedPatterns.add(pattern);
    });
    props.fieldReasoningMap?.forEach((_, pattern) => {
      highlightedPatterns.add(pattern);
    });

    if (highlightedPatterns.size === 0) return null;
    return findMatchingHighlightedFieldPattern(actualKey, highlightedPatterns);
  }, [actualKey, props.fieldIndicationMap, props.fieldReasoningMap]);
  const showReviewHighlightedStyling = Boolean(reviewHighlightedPattern);

  // Function field styling based on validation value
  const getFunctionFieldStyling = () => {
    if (!isFunctionField) return "";
    if (effectiveValue === true) return "border-success border bg-success/10";
    if (effectiveValue === false) return "border-destructive border bg-destructive/10";
    if (effectiveValue === null || effectiveValue === undefined)
      return "border-warning border bg-warning/10";
    return "border-success border bg-success/10"; // default to green for other truthy values
  };

  // Computed field styling - special handling for boolean computed fields
  const getComputedFieldStyling = () => {
    if (!isComputedField) return "";
    // If computed field is boolean type, apply color coding like function fields
    if (isBoolean) {
      if (effectiveValue === true) return "border-success border bg-success/10";
      if (effectiveValue === false) return "border-destructive border bg-destructive/10";
      if (effectiveValue === null || effectiveValue === undefined)
        return "border-warning border bg-warning/10";
      return "border-success border bg-success/10"; // default to green for other truthy values
    }
    // Non-boolean computed fields get the standard blue background
    return "bg-primary/10";
  };

  // Only show green verified styling in dataset view

  if (!isValidProp) {
    return (
      <TableCell
        key={actualKey}
        data-field-path={actualKey}
        className={`relative ${theme.verticalLine} cursor-not-allowed`}
        style={{
          width: `${cellWidth}px`,
          minWidth: `${cellWidth}px`,
        }}
      />
    );
  }

  return (
    <TableCell
      key={actualKey}
      data-field-path={actualKey}
      className={` ${theme.border} relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none`}
      onMouseLeave={() => {
        if (isSelectOpen || isDatePopoverOpen || isInputFocused) return;
        props.onCellHoverEnd?.();
      }}
      onMouseEnter={(e) => {
        handleCellHover(e as unknown as React.MouseEvent);
      }}
      // onMouseDown={handleMouseDown}
      // onMouseEnter={(e) => {
      //     handleCellHover(e as unknown as React.MouseEvent);
      // }}
      // onClick={handleClick}
      style={cellStyle}
    >
      <div
        ref={cellRootRef}
        //className={`focus-within:overflow-visible w-full h-full`}//
        className={cn(
          "h-full w-full focus-within:overflow-visible",
          showVerifiedStyling
            ? "border border-success bg-success/10"
            : showFunctionStyling
              ? getFunctionFieldStyling()
              : showComputedStyling
                ? getComputedFieldStyling()
                : "",
          showReviewHighlightedStyling &&
            "bg-warning/20 ring-1 ring-warning ring-inset",
          isHovering && "border border-primary",
        )}
      >
        {isObject ? (
          <Popover
            open={openPopover === actualKey}
            onOpenChange={(open) => {
              if (!open) {
                setOpenPopover(null);
              } else if (actualKey) {
                setOpenPopover(actualKey);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                className={`text-3xs h-full w-full justify-start overflow-hidden px-1 text-inherit select-none`}
              >
                {effectiveValue ? (
                  <div className="max-w-[80px] truncate text-left">
                    {JSON.stringify(stripProperties(effectiveValue))}
                  </div>
                ) : (
                  <div className="text-muted-foreground max-w-[80px] truncate text-left">
                    {`Edit ${property?.title || actualKey}`}
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="m-0 w-96 rounded-none p-4"
              align="start"
              side="top"
              sideOffset={0}
              alignOffset={-1}
            >
              {openPopover === actualKey && property && (
                <ObjectEditor
                  disabled={!isEditableReference}
                  isOpen={openPopover === actualKey}
                  property={{
                    ...transferContext(property, schema),
                    additionalProperties: true,
                  }}
                  currentValue={effectiveValue}
                  onSubmit={handleObjectFormSubmitLocal}
                  likelihoods={{}} //arrayLikelihoods}
                  scalarValueType={scalarValueType}
                  setSourcesFieldPath={(path) => {
                    if (!path) {
                      setHoverInfo(null);
                      return;
                    }
                    if (actualKey) {
                      const fullPath =
                        path === actualKey || path.startsWith(actualKey + ".")
                          ? path
                          : `${actualKey}.${path}`;
                      setHoverInfo({
                        docId: props.docId,
                        fieldPath: fullPath,
                        rect: new DOMRect(),
                      });
                    } else {
                      setHoverInfo({
                        docId: props.docId,
                        fieldPath: path,
                        rect: new DOMRect(),
                      });
                    }
                  }}
                  currentIterationId={currentIterationId}
                />
              )}
            </PopoverContent>
          </Popover>
        ) : isArray ? (
          <Popover
            open={openPopover === actualKey}
            onOpenChange={(open) => {
              if (!open) {
                setOpenPopover(null);
              } else if (actualKey) {
                setOpenPopover(actualKey);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                className={`text-3xs h-full w-full justify-start overflow-hidden px-1 text-inherit select-none`}
              >
                {effectiveValue ? (
                  <div className="max-w-[80px] truncate text-left">
                    {Array.isArray(effectiveValue)
                      ? `[${(effectiveValue as any[]).length} items]`
                      : JSON.stringify(effectiveValue)}
                  </div>
                ) : (
                  <div className="text-muted-foreground max-w-[80px] truncate text-left">
                    {`${property?.title || actualKey}`}
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="m-0 w-96 rounded-none p-4"
              align="start"
              side="top"
              sideOffset={0}
              alignOffset={-1}
            >
              {openPopover === actualKey && property && (
                <ArrayEditor
                  name={actualKey}
                  disabled={!isEditableReference}
                  property={transferContext(property, schema)}
                  currentValue={effectiveValue}
                  onSubmit={handleArrayFormSubmitLocal}
                  likelihoods={{}} //arrayLikelihoods}
                  scalarValueType={scalarValueType}
                  setSourcesFieldPath={(path) => {
                    if (!path) {
                      setHoverInfo(null);
                      return;
                    }
                    setHoverInfo({
                      docId: props.docId,
                      fieldPath: path,
                      rect: new DOMRect(),
                    });
                  }}
                  currentIterationId={currentIterationId}
                />
              )}
            </PopoverContent>
          </Popover>
        ) : isBoolean ? (
          <div className="flex h-full items-center justify-center py-1">
            <Checkbox
              checked={Boolean(effectiveValue)}
              disabled={!isEditableReference}
              onCheckedChange={(checked) => {
                if (isEditableReference) {
                  onChange(checked);
                }
              }}
              onFocus={() => {
                setFocusedField(`${docId}:${actualKey}`);
                setIsInputFocused(true);
              }}
              onBlur={() => {
                setFocusedField(null);
                setIsInputFocused(false);
              }}
              className={"rounded-[4px] disabled:opacity-100"}
            />
          </div>
        ) : isEnum ? (
          showInput ? (
            <Select
              key={`${actualKey}-${value}`}
              onOpenChange={(open) => {
                setIsSelectOpen(open);
                if (open) {
                  setFocusedField(`${docId}:${actualKey}`);
                  setIsInputFocused(true);
                } else {
                  setFocusedField(null);
                  setIsInputFocused(false);
                }
              }}
              value={
                effectiveValue === null || effectiveValue === undefined
                  ? "__null__"
                  : String(effectiveValue)
              }
              disabled={!isEditableReference}
              onValueChange={(newValue) => {
                if (newValue === "__null__" && optional) {
                  onChange(null);
                } else {
                  if (isInteger) {
                    const parsed = parseInt(newValue, 10);
                    onChange(Number.isNaN(parsed) ? null : parsed);
                  } else if (isFloat) {
                    const parsed = parseFloat(newValue);
                    onChange(Number.isNaN(parsed) ? null : parsed);
                  } else {
                    onChange(newValue);
                  }
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "text-3xs theme.headerText h-6 w-full rounded-none border-none px-2 text-inherit shadow-none",
                  "disabled:opacity-100",
                )}
                onFocus={() => {
                  setFocusedField(`${docId}:${actualKey}`);
                  setIsInputFocused(true);
                }}
                onBlur={() => {
                  if (!isSelectOpen) {
                    setFocusedField(null);
                    setIsInputFocused(false);
                  }
                }}
              >
                <SelectValue placeholder={optional ? "Select..." : undefined} />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[60]">
                {optional && (
                  <SelectItem
                    key="__null__"
                    value="__null__"
                    className="text-3xs text-muted-foreground"
                  >
                    <em>No selection</em>
                  </SelectItem>
                )}
                {(propInfo?.propertyEnumVals ?? [])
                  .filter(
                    (enumVal) =>
                      enumVal !== undefined &&
                      enumVal !== null &&
                      !(typeof enumVal === "string" && enumVal === ""),
                  )
                  .map((option: any) => (
                    <SelectItem
                      key={String(option)}
                      value={String(option)}
                      className="text-3xs"
                    >
                      {String(option)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-3xs flex h-full w-full items-start truncate px-2 py-2">
              {effectiveValue === null ||
              effectiveValue === undefined ||
              effectiveValue === "__null__"
                ? "—"
                : String(effectiveValue)}
            </div>
          )
        ) : isDate ? (
          showInput ? (
            <Popover
              open={isDatePopoverOpen}
              onOpenChange={(open) => {
                setIsDatePopoverOpen(open);
                if (open) {
                  setStringValue(cleanStringValue);
                  setFocusedField(`${docId}:${actualKey}`);
                  setIsInputFocused(true);
                } else {
                  setFocusedField(null);
                  setIsInputFocused(false);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  disabled={!isEditableReference}
                  className={cn(
                    "!text-3xs h-full w-full justify-start rounded-none border-0 px-2 py-0 text-left font-normal text-inherit shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                    !effectiveValue && "text-muted-foreground",
                    "disabled:opacity-100",
                    focusedField === `${docId}:${actualKey}`
                      ? "absolute top-0 left-0 z-10 shadow-md"
                      : "", //min-w-[200px]
                  )}
                  onClick={() => {
                    setFocusedField(`${docId}:${actualKey}`);
                    setIsInputFocused(true);
                  }}
                >
                  {date ? (
                    format(date, "PP")
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="z-50 w-auto p-0"
                align="start"
                side="bottom"
                sideOffset={0}
                avoidCollisions={false}
                updatePositionStrategy="always"
              >
                <Calendar
                  className=""
                  mode="single"
                  selected={date}
                  defaultMonth={date}
                  onSelect={(picked) => {
                    if (picked) {
                      const localDateString = getLocalDateString(picked);
                      const convertedDate = dateStringToFormat(
                        localDateString,
                        "2000-01-01",
                      );
                      setStringValue(convertedDate || "");
                      onChange(convertedDate || null);
                    } else {
                      setStringValue("");
                      onChange(null);
                    }
                  }}
                  onDayClick={(picked) => {
                    if (!picked) return;
                    const localDateString = getLocalDateString(picked);
                    const convertedDate = dateStringToFormat(
                      localDateString,
                      "2000-01-01",
                    );
                    setStringValue(convertedDate || "");
                    onChange(convertedDate || null);
                    setIsDatePopoverOpen(false);
                    setFocusedField(null);
                    setIsInputFocused(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="text-3xs flex h-full w-full items-center truncate px-2 py-2">
              {(() => {
                try {
                  const date = parseDateStringAsLocal(liveStringValue);
                  if (!date) {
                    return <span className="text-muted-foreground">Pick a date</span>;
                  }
                  return format(date, "PP");
                } catch {
                  return "Invalid date";
                }
              })()}
            </div>
          )
        ) : isIsoTime ? (
          showInput ? (
            <DoubleClickInput
              type="time"
              value={dateToHTMLTimeString(liveStringValue || "")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setStringValue(e.target.value);
              }}
              onBlur={(_e: React.ChangeEvent<HTMLInputElement>) => {
                let finalValue = stringValue;
                if (stringValue && /^\d{1,2}:\d{2}$/.test(stringValue)) {
                  finalValue = stringValue + ":00";
                  setStringValue(finalValue);
                }
                const convertedDate = dateStringToFormat(finalValue, "00:00");
                onChange(convertedDate || null);
                setStringValue(convertedDate || "");
                setFocusedField(null);
                setIsInputFocused(false);
              }}
              onFocus={() => {
                setStringValue(cleanStringValue);
                setFocusedField(`${docId}:${actualKey}`);
                setIsInputFocused(true);
              }}
              disabled={!isEditableReference}
              className={cn(
                "!text-3xs h-full rounded-none px-2 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                !effectiveValue && "text-muted-foreground",
                focusedField === `${docId}:${actualKey}`
                  ? "absolute top-0 left-0 z-10"
                  : "", //min-w-[200px]
              )}
            />
          ) : (
            <div className="text-3xs flex h-full w-full items-center truncate px-2 py-2">
              {dateToHTMLTimeString(liveStringValue || "") || "—"}
            </div>
          )
        ) : isDateTime ? (
          showInput ? (
            <DoubleClickInput
              type="datetime-local"
              value={dateToHTMLDateTimeString(liveStringValue || "")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setStringValue(e.target.value);
              }}
              onFocus={() => {
                setStringValue(cleanStringValue);
                setFocusedField(`${docId}:${actualKey}`);
                setIsInputFocused(true);
              }}
              onBlur={() => {
                const convertedDate = dateStringToFormat(
                  stringValue,
                  "2000-01-01T00:00:00",
                );
                onChange(convertedDate || null);
                setFocusedField(null);
                setIsInputFocused(false);
              }}
              disabled={!isEditableReference}
              className={`!text-3xs h-full rounded-none px-2 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${focusedField === `${docId}:${actualKey}` ? "absolute top-0 left-0 z-10 bg-background" : ""}`} //min-w-[200px]
            />
          ) : (
            <div className="text-3xs flex h-full w-full items-center truncate px-2 py-0">
              {dateToHTMLDateTimeString(liveStringValue || "") || "—"}
            </div>
          )
        ) : isNumber || isInteger ? (
          showInput ? (
            <DoubleClickInput
              type="number"
              value={liveStringValue ?? null}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const numValue = isInteger
                  ? parseInt(e.target.value)
                  : parseFloat(e.target.value);
                setStringValue(isNaN(numValue) ? "" : numValue.toString());
              }}
              onFocus={() => {
                setStringValue(cleanStringValue);
                setFocusedField(`${docId}:${actualKey}`);
                setIsInputFocused(true);
              }}
              onBlur={() => {
                const numValue = isInteger
                  ? parseInt(stringValue)
                  : parseFloat(stringValue);
                onChange(isNaN(numValue) ? null : numValue);
                setFocusedField(null);
                setIsInputFocused(false);
              }}
              disabled={!isEditableReference}
              className={`!text-3xs h-full rounded-none px-2 py-0 shadow-none focus-visible:ring-0 ${focusedField === `${docId}:${actualKey}` ? "absolute top-0 left-0 z-10" : ""}`} //min-w-[200px]
            />
          ) : (
            <div
              className={`text-3xs flex h-full w-full items-center truncate px-2 py-2`}
            >
              {liveStringValue ?? "—"}
            </div>
          )
        ) : isText ? (
          isTextEditing ? (
            <DoubleClickTextarea
              type="text"
              autoFocus
              value={liveStringValue ?? null}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setStringValue(e.target.value);
              }}
              onBlur={(_e: React.ChangeEvent<HTMLInputElement>) => {
                const newVal = stringValue || null;
                onChange(newVal);
                setFocusedField(null);
                setIsInputFocused(false);
                setIsTextEditing(false);
              }}
              onFocus={() => {
                setStringValue(cleanStringValue);
                setFocusedField(`${docId}:${actualKey}`);
                setIsInputFocused(true);
              }}
              disabled={!isEditableReference}
              className={cn(
                "!text-3xs h-full w-full rounded-none px-2 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                !effectiveValue && "text-muted-foreground",
                focusedField === `${docId}:${actualKey}`
                  ? "absolute top-[1px] left-[1px] z-10 h-64 min-w-[200px] bg-background shadow-md outline-1 outline-primary"
                  : "", //min-w-[200px]
              )}
              style={{
                resize: "none",
              }}
            />
          ) : (
            <div
              className={cn(
                "text-3xs flex h-full w-full items-start truncate px-2 py-2",
                isEditableReference && "cursor-text",
              )}
              onClick={() => {
                if (isEditableReference) setIsTextEditing(true);
              }}
            >
              {effectiveValue !== null && effectiveValue !== undefined
                ? String(effectiveValue)
                : ""}
            </div>
          )
        ) : (
          <div
            className={`text-3xs flex h-full w-full items-start truncate px-2 py-2 ${theme.verticalLine}`}
          >
            {effectiveValue !== null && effectiveValue !== undefined
              ? String(effectiveValue)
              : ""}
          </div>
        )}
      </div>
    </TableCell>
  );
};

export const DataCell = React.memo(
  (
    props: DataCellProps & {
      onCellClick?: (cellData: PopoverCellData) => void;
    },
  ) => {
    return <DataCellContent {...props} />;
  },
  (prev: DataCellProps, next: DataCellProps) => {
    let prevVars = calculateVariables(prev);
    let nextVars = calculateVariables(next);

    let res = cmp(prevVars, nextVars, { deep: ["pathInfo.idx"] });
    return res;
  },
);
DataCell.displayName = "DataCell";
