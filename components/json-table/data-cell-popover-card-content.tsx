import * as React from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import { getConsensusData } from "@/components/json-table/lib/json-schema-utils";
import { get_value_from_row_array_and_dot_notation_path } from "@/components/json-table/lib/json-schema-utils";
import {
  Blocks,
  Delete,
  Atom,
  Blend,
  Ruler,
  AppWindowIcon,
  PieChart,
  TrendingUp,
  Pencil,
  Database,
  SquareMousePointer,
  MousePointerClick,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import DidacticColorBar from "./didactic-color-bar";
import { assignObjectKey } from "./path-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-retab/card";
import {
  DatasetDocument,
  TableDocument,
} from "@/components/json-table/lib/projects-types";
import { useTabStateStore } from "@/components/json-table/tab-state-store";
import {
  getPredictionConsensusDetails,
  getPredictionLikelihoods,
} from "@/components/json-table/lib/consensus-metadata";
import { getFlagAtPath, toggleValidity } from "./validation-flags-utils";
import { JSONSchema7 } from "json-schema";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui-retab/checkbox";
import { Input } from "@/components/ui-retab/input";
import { Textarea } from "@/components/ui-retab/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-retab/select";
import { unwrapSchema } from "./header-from-schema";
import {
  dateStringToFormat,
  dateToHTMLDateString,
  dateToHTMLDateTimeString,
  dateToHTMLTimeString,
  getLocalDateString,
  autoFormatDateTimeFields,
  parseDateStringAsLocal,
} from "@/components/json-table/lib/date-utils";
import { Calendar } from "@/components/ui-retab/calendar";
import { Button } from "@/components/ui-retab/button";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover";
import { useHoverCardPortalControl } from "@/components/json-table/hover-card-context";

const FLOATING_CARD_VALUE_TOOLTIP_CLASS = "z-[10000] max-w-xs break-words";

// Normalize a concrete field path (array indices) to a wildcard path, e.g.
// `items.0.name` / `items[0].name` -> `items.*.name`. Used to match review
// indication/reasoning maps that are keyed by wildcard paths.
function normalizeFieldPath(path: string): string {
  return path.replace(/\[(\d+)\]/g, ".*").replace(/\.(\d+)(?=\.|$)/g, ".*");
}

export interface TypeAdaptedInputProps {
  schema: JSONSchema7 | undefined | null;
  rootSchema?: JSONSchema7; // for unwrap context if needed
  value: any;
  onChange: (next: any) => void;
  disabled?: boolean;
  className?: string;
}

// Helper to detect final schema and nullability
function getEffectiveSchema(
  schema: JSONSchema7 | undefined | null,
  root?: JSONSchema7,
): { s: JSONSchema7 | undefined; nullable: boolean } {
  if (!schema) return { s: undefined, nullable: false };
  try {
    if (root) {
      const { schema: unwrapped, nullable } = unwrapSchema(schema, root);
      return { s: unwrapped, nullable };
    }
  } catch {}
  // Fallback: best-effort without unwrap
  const nullable =
    Array.isArray((schema as any).type) &&
    ((schema as any).type as any[]).includes("null");
  return { s: schema, nullable };
}

export const TypeAdaptedInput: React.FC<TypeAdaptedInputProps> = ({
  schema,
  rootSchema,
  value,
  onChange,
  disabled,
  className,
}) => {
  const { s: eff, nullable } = getEffectiveSchema(
    schema || undefined,
    rootSchema,
  );
  const hoverCard = useHoverCardPortalControl();
  const [open, setOpen] = React.useState(false);

  // If schema missing, fallback to textarea JSON editor
  const _type = eff?.type as string | string | undefined;
  const format = (eff as any)?.format as string | undefined;
  const hasEnum =
    Array.isArray((eff as any)?.enum) &&
    ((eff as any)?.enum as any[]).length > 0;

  // BOOLEAN
  if (eff?.type === "boolean") {
    return (
      <div className="flex h-full items-center">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
          className={cn("disabled:opacity-100", className)}
          disabled={disabled}
        />
      </div>
    );
  }

  // ENUM (strings only are common)
  if (hasEnum) {
    const options = ((eff as any).enum as any[]).filter((e) => e !== "");
    const current =
      value === null || value === undefined ? "__null__" : String(value);
    return (
      <Select
        value={current}
        onValueChange={(v) => {
          if (v === "__null__" && nullable) onChange(null);
          else onChange(v);
        }}
        disabled={disabled}
        onOpenChange={(open) => {
          hoverCard?.setPortalOpen(open);
        }}
      >
        <SelectTrigger
          className={cn(
            "h-8 w-full rounded-none border px-2 text-xs shadow-none",
            className,
          )}
        >
          <SelectValue placeholder={nullable ? "Select..." : undefined} />
        </SelectTrigger>
        <SelectContent>
          {nullable && (
            <SelectItem
              key="__null__"
              value="__null__"
              className="text-muted-foreground text-xs"
            >
              <em>No selection</em>
            </SelectItem>
          )}
          {options.map((opt) => (
            <SelectItem
              key={String(opt)}
              value={String(opt)}
              className="text-xs"
            >
              {String(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // DATE
  if (eff?.type === "string" && format === "date") {
    const safeString = typeof value === "string" ? value : "";
    return (
      <div className={cn("w-full", className)}>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            hoverCard?.setPortalOpen(next);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              data-empty={!safeString}
              className={cn(
                "data-[empty=true]:text-muted-foreground w-full justify-start rounded-none px-2 py-1 text-left !text-xs font-normal shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {(() => {
                try {
                  const date = parseDateStringAsLocal(safeString);
                  if (!date) return <span>Pick a date</span>;
                  return date.toLocaleDateString();
                } catch {
                  return <span>Pick a date</span>;
                }
              })()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              defaultMonth={(() => {
                try {
                  return parseDateStringAsLocal(safeString) ?? undefined;
                } catch {
                  return undefined;
                }
              })()}
              selected={(() => {
                try {
                  return parseDateStringAsLocal(safeString) ?? undefined;
                } catch {
                  return undefined;
                }
              })()}
              onSelect={(date) => {
                if (date) {
                  const localDateString = getLocalDateString(date);
                  const converted = dateStringToFormat(
                    localDateString,
                    "2000-01-01",
                  );
                  onChange(converted || null);
                } else {
                  onChange(null);
                }
                setOpen(false);
                hoverCard?.setPortalOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // ISO TIME
  if (eff?.type === "string" && format === "iso-time") {
    const safeString = typeof value === "string" ? value : "";
    return (
      <Input
        type="time"
        value={dateToHTMLTimeString(safeString || "")}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          let v = e.target.value;
          if (v && /^\d{1,2}:\d{2}$/.test(v)) {
            v = v + ":00";
          }
          const converted = dateStringToFormat(v, "00:00");
          onChange(converted || null);
        }}
        disabled={disabled}
        className={cn(
          "w-full rounded-none px-2 py-1 !text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
      />
    );
  }

  // DATE-TIME
  if (eff?.type === "string" && format === "date-time") {
    const safeString = typeof value === "string" ? value : "";
    return (
      <Input
        type="datetime-local"
        value={dateToHTMLDateTimeString(safeString || "")}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const converted = dateStringToFormat(
            e.target.value,
            "2000-01-01T00:00:00",
          );
          onChange(converted || null);
        }}
        disabled={disabled}
        className={cn(
          "w-full rounded-none px-2 py-1 !text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
      />
    );
  }

  // NUMBER / INTEGER
  if (eff?.type === "number" || eff?.type === "integer") {
    const isInteger = eff?.type === "integer";
    const str = value === null || value === undefined ? "" : String(value);
    return (
      <Input
        type="number"
        value={str}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const next = isInteger
            ? parseInt(e.target.value)
            : parseFloat(e.target.value);
          onChange(isNaN(next as any) ? null : next);
        }}
        disabled={disabled}
        className={cn(
          "w-full rounded-none px-2 py-1 !text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
      />
    );
  }

  // OBJECT or ARRAY -> JSON editor
  if (eff?.type === "object" || eff?.type === "array") {
    const pretty = (() => {
      try {
        return typeof value === "string"
          ? value
          : JSON.stringify(value ?? null, null, 2);
      } catch {
        return String(value ?? "");
      }
    })();
    return (
      <Textarea
        className={cn(
          "h-40 w-full resize-none rounded-md border bg-muted p-2 !text-xs",
          className,
        )}
        value={pretty}
        onChange={(e) => {
          const raw = e.target.value;
          try {
            const parsed = JSON.parse(raw);
            const formatted = autoFormatDateTimeFields(
              parsed,
              eff as JSONSchema7,
            );
            onChange(formatted);
          } catch {
            onChange(raw);
          }
        }}
        disabled={disabled}
      />
    );
  }

  // STRING default
  return (
    <Textarea
      className={cn(
        "h-24 w-full resize-none rounded-md border bg-muted p-2 !text-xs",
        className,
      )}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
};

TypeAdaptedInput.displayName = "TypeAdaptedInput";

export interface DatasetContext {
  datasetDocuments: TableDocument[];
  updateDatasetDocument: (documentId: string, patch: any) => Promise<any>;
  invalidateDistances?: (iterationDocumentId: string) => void;
}

export interface DataCellPopoverCardContentProps {
  similarityType: "unaligned" | "aligned";
  document: TableDocument;
  selectedFieldPath: string;
  currentIterationId: string;
  updateDocument: (
    docId: string,
    updates: any,
    previousValues?: any,
  ) => Promise<void>;
  jsonSchema: any;
  rowDistanceData?: any;
  datasetContext?: DatasetContext;
  /** Direct callback for ground truth changes (alternative to datasetContext) */
  onGroundTruthChange?: (fieldPath: string, newValue: any) => void;
  /** Map from field paths to indication texts (for review) */
  fieldIndicationMap?: Map<string, string>;
  /** Map from field paths to reasoning texts extracted from data (for review) */
  fieldReasoningMap?: Map<string, string>;
}

// Import getFieldSchema function from uiform
function resolveRef(schema: any, ref: string): any {
  // Support both $defs (draft 2019-09+) and definitions (draft-07)
  if (ref.startsWith("#/$defs/")) {
    return schema.$defs?.[ref.replace("#/$defs/", "")];
  } else if (ref.startsWith("#/definitions/")) {
    return schema.definitions?.[ref.replace("#/definitions/", "")];
  }
  return undefined;
}

function getFieldSchema(
  schema: any,
  path: string,
  currentSchema: any = schema,
): any {
  const pathSegments = path.split(".");
  for (let i = 0; i < pathSegments.length; ) {
    const segment = pathSegments[i];

    // Resolve any $ref at the current level
    if (currentSchema.$ref) {
      currentSchema = resolveRef(schema, currentSchema.$ref);
      if (!currentSchema) return null;
    }

    // Handle "anyOf" by finding the option that contains the remaining path
    if ("anyOf" in currentSchema) {
      for (const option of currentSchema.anyOf) {
        const fieldSchema = getFieldSchema(
          schema,
          pathSegments.slice(i).join("."),
          option,
        );
        if (fieldSchema) {
          return fieldSchema;
        }
      }
      return null; // No option contains the field
    }

    // Handle arrays: move to items and skip index if present
    if (currentSchema.type === "array") {
      currentSchema = currentSchema.items;
      // Check if the next segment is an index and skip it
      if (
        i + 1 < pathSegments.length &&
        (pathSegments[i + 1] === "*" || !isNaN(parseInt(pathSegments[i + 1])))
      ) {
        i += 1; // Skip the index segment
      }
    }
    // Handle objects: dive into properties
    else if (
      currentSchema.type === "object" &&
      segment in currentSchema.properties
    ) {
      currentSchema = currentSchema.properties[segment];
      i += 1;
    }
    // Skip standalone numeric or "*" segments if not in array context
    else if (segment === "*" || !isNaN(parseInt(segment))) {
      i += 1; // Skip index not preceded by array
    } else {
      console.log("ERROR", { schema, path, currentSchema, segment });
      return null; // Field not found
    }
  }

  // Resolve any final $ref
  if (currentSchema.$ref) {
    currentSchema = resolveRef(schema, currentSchema.$ref);
  }

  return currentSchema;
}

const DataCellPopoverCardContentInner = ({
  similarityType,
  // From tab state
  document,
  selectedFieldPath,
  // From document/project context
  currentIterationId,
  updateDocument,
  // From JSON schema context
  jsonSchema,
  // From computation spec
  // Row distance data (if available)
  rowDistanceData,
  // (optional, only needed for iterations Dataset context (for Cmd+E in iteration views)
  datasetContext,
  // Direct callback for ground truth changes (alternative to datasetContext)
  onGroundTruthChange,
  // Indication text map for review
  fieldIndicationMap,
  // Reasoning text map for review
  fieldReasoningMap,
}: DataCellPopoverCardContentProps) => {
  const { setActiveView, setMetricsSelection } = useTabStateStore();

  // Handler to update the dataset value from iteration view
  const onDatasetValueChange = React.useCallback(
    async (newValue: any) => {
      // If direct onGroundTruthChange callback is provided, use it
      if (onGroundTruthChange) {
        onGroundTruthChange(selectedFieldPath, newValue);
        return;
      }

      if (!datasetContext) {
        console.error("Dataset context not available");
        toast.error("Dataset context not available");
        return;
      }

      if (
        !datasetContext.updateDatasetDocument ||
        !datasetContext.datasetDocuments
      ) {
        console.error("Dataset context not available");
        toast.error("Dataset context not available");
        return;
      }

      try {
        // Map iteration (dict2) path to dataset (dict1) path via key mappings when available
        const mappedDatasetPath = (rowDistanceData
          ?.candidate_to_reference_paths?.[selectedFieldPath] ??
          selectedFieldPath) as string;

        console.log("mappedDatasetPath", mappedDatasetPath);

        // For iteration documents, find and update the corresponding dataset document
        const iterationDoc = document as any;
        const datasetDocId = iterationDoc.dataset_document_id;

        if (!datasetDocId) {
          console.error("No dataset_document_id found on iteration document");
          toast.error("Cannot update dataset value");
          return;
        }

        // Find the dataset document in the dataset documents array
        const datasetDoc = datasetContext.datasetDocuments.find(
          (doc: any) => doc.id === datasetDocId,
        );
        if (!datasetDoc) {
          console.error("Dataset document not found");
          toast.error("Dataset document not found");
          return;
        }

        // Update the dataset document with the new value
        const currentAnnotation =
          (datasetDoc as any).prediction_data?.prediction || {};
        const updatedAnnotation = assignObjectKey(
          currentAnnotation,
          mappedDatasetPath.split("."),
          newValue,
        );

        console.log("currentAnnotation", currentAnnotation);
        console.log("updatedAnnotation", updatedAnnotation);

        await datasetContext.updateDatasetDocument(datasetDocId, {
          prediction_data: {
            prediction: updatedAnnotation,
            metadata: datasetDoc.prediction_data?.metadata || {},
          },
        });

        // Invalidate distance data for this specific iteration document since its reference dataset value changed
        if (datasetContext.invalidateDistances && document?.id) {
          datasetContext.invalidateDistances(document?.id);
        }

        toast.success("Dataset value updated");
      } catch (error) {
        console.error("Failed to update dataset value:", error);
        toast.error("Failed to update dataset value");
      }
    },
    [
      selectedFieldPath,
      document,
      datasetContext,
      onGroundTruthChange,
      rowDistanceData?.candidate_to_reference_paths,
    ],
  );

  // Inline editing state for dataset value
  const [isEditingDatasetValue, setIsEditingDatasetValue] =
    React.useState(false);
  const [_editingDatasetValue, setEditingDatasetValue] = React.useState("");
  const [isSavingDatasetValue, setIsSavingDatasetValue] = React.useState(false);
  const [editingDatasetValueAny, setEditingDatasetValueAny] =
    React.useState<any>(null);

  const { showInfoPanel, setShowInfoPanel } = useTabStateStore();

  // Helper: immutably remove the element at the deepest numeric segment in the selected path
  const deleteAtDeepestIndex = (root: any, path: string) => {
    const segments = path.split(".");
    let lastIndexPos = -1;
    for (let i = 0; i < segments.length; i++) {
      if (!isNaN(parseInt(segments[i] as string))) lastIndexPos = i;
    }
    if (lastIndexPos === -1) return root;

    const arrayPath = segments.slice(0, lastIndexPos);
    const indexToDelete = parseInt(segments[lastIndexPos] as string);

    const recur = (node: any, segs: string[], targetIdx: number): any => {
      if (segs.length === 0) {
        if (!Array.isArray(node)) return node;
        if (targetIdx < 0 || targetIdx >= node.length) return node;
        const copy = node.slice();
        copy.splice(targetIdx, 1);
        return copy;
      }
      const [head, ...tail] = segs;
      const isIndex = !isNaN(parseInt(head as string));
      if (isIndex) {
        const idx = Number(head);
        const base = Array.isArray(node) ? node : [];
        const copy = base.slice();
        copy[idx] = recur(base[idx], tail, targetIdx);
        return copy;
      }
      const baseObj =
        node && typeof node === "object" && !Array.isArray(node)
          ? (node as Record<string, any>)
          : {};
      return { ...baseObj, [head]: recur(baseObj[head], tail, targetIdx) };
    };

    return recur(root, arrayPath, indexToDelete);
  };

  // Delete handler
  const onDeleteRow = React.useCallback(() => {
    if (!document) return;
    const currentAnnotation =
      (document as any).prediction_data?.prediction || {};
    const updatedAnnotation = deleteAtDeepestIndex(
      currentAnnotation,
      selectedFieldPath,
    );
    const targetDocId = (document as any).id ?? document.id;
    updateDocument(
      targetDocId,
      { annotation: updatedAnnotation },
      { annotation: currentAnnotation },
    )
      .then(() => {
        toast.success("Row deleted");
      })
      .catch((err) => {
        console.error("Failed to delete row:", err);
        toast.error("Failed to delete row");
      });
  }, [selectedFieldPath, document, updateDocument]);

  // Determine if we're on reference sheet or iteration sheet
  const isReferenceSheet = currentIterationId.includes("dataset");

  // Determine if we're in reconciliation/read-only comparison mode (no dataset context available)
  const isReconciliationMode = currentIterationId.includes("single-file");

  // Compute deletable safely (works even if no selection)
  const deletable =
    !!selectedFieldPath &&
    selectedFieldPath
      .split(".")
      .some((segment) => segment === "*" || !isNaN(parseInt(segment)));

  const selectedFieldPathRef = React.useRef(selectedFieldPath);
  selectedFieldPathRef.current = selectedFieldPath;
  const documentRef = React.useRef(document);
  documentRef.current = document;
  const currentIterationIdRef = React.useRef(currentIterationId);
  currentIterationIdRef.current = currentIterationId;
  const updateDocumentRef = React.useRef(updateDocument);
  updateDocumentRef.current = updateDocument;
  const datasetContextRef = React.useRef(datasetContext);
  datasetContextRef.current = datasetContext;
  const onDeleteRowRef = React.useRef(onDeleteRow);
  onDeleteRowRef.current = onDeleteRow;
  const deletableRef = React.useRef(deletable);
  deletableRef.current = deletable;
  const rowDistanceDataRef = React.useRef(rowDistanceData);
  rowDistanceDataRef.current = rowDistanceData;

  // Compute source and metadata safely without depending on early returns
  const likelihoodsConsensus = getPredictionLikelihoods(
    document?.prediction_data?.metadata,
  );
  const value: any = selectedFieldPath
    ? get_value_from_row_array_and_dot_notation_path(
        document?.prediction_data.prediction,
        selectedFieldPath,
      )
    : undefined;
  const valueString: string = JSON.stringify(value);

  // Calculate consensus and similarity/likelihood details
  const consensusScore: any =
    typeof selectedFieldPath === "string"
      ? get_value_from_row_array_and_dot_notation_path(
          likelihoodsConsensus,
          selectedFieldPath,
        )
      : undefined;

  let hasLikelihood = false;
  let _hasReference = false;
  let likelihoodScore: number = 0.0;
  let referenceValue: any;

  // Get current document and its validation flags
  const validationFlags =
    ((document as DatasetDocument | undefined)?.validation_flags as any) || {};
  const currentValidity = selectedFieldPath
    ? getFlagAtPath(validationFlags, selectedFieldPath)
    : undefined;

  useMountEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const currentSelectedFieldPath = selectedFieldPathRef.current;
      const currentDocument = documentRef.current;
      const currentIterationId = currentIterationIdRef.current;
      const currentDatasetContext = datasetContextRef.current;
      const currentRowDistanceData = rowDistanceDataRef.current;

      const isMac =
        typeof navigator !== "undefined" &&
        (navigator as any).platform?.toLowerCase?.().includes("mac");
      const key = (event.key || "").toLowerCase();
      const isCmdE = isMac
        ? event.metaKey && key === "e"
        : event.ctrlKey && key === "e";
      const isCmdDel =
        (isMac ? event.metaKey : event.ctrlKey) &&
        (key === "delete" || key === "del" || key === "backspace");

      if (!currentSelectedFieldPath) return;
      if (!currentDocument) return;

      // Handle Cmd+Del / Ctrl+Del for deletion on dataset sheet
      if (isCmdDel) {
        if (!currentIterationId.includes("dataset")) return;
        if (!deletableRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        onDeleteRowRef.current();
        return;
      }

      // Handle Cmd+E / Ctrl+E
      if (!isCmdE) return;
      event.preventDefault();
      event.stopPropagation();

      if (currentIterationId.includes("dataset")) {
        // Toggle validity on dataset sheet
        toggleValidity(
          currentDocument as DatasetDocument,
          currentSelectedFieldPath,
          updateDocumentRef.current,
        );
      } else if (currentIterationId.includes("iteration")) {
        if (!currentDatasetContext) {
          console.error("Dataset context not available");
          toast.error("Dataset context not available");
          return;
        }

        // Replace dataset value with extracted value on iteration sheets
        if (
          !currentDatasetContext.updateDatasetDocument ||
          !currentDatasetContext.datasetDocuments
        ) {
          console.error("Dataset context not available");
          toast.error("Dataset context not available");
          return;
        }

        try {
          // Get the extracted value from the current iteration document
          const extractedValue = currentSelectedFieldPath
            ? get_value_from_row_array_and_dot_notation_path(
                currentDocument?.prediction_data.prediction,
                currentSelectedFieldPath,
              )
            : undefined;

          // For iteration documents, we need to find and update the corresponding dataset document
          // The iteration document has a dataset_document_id that references the dataset document
          const iterationDoc = currentDocument as any;
          const datasetDocId = iterationDoc.dataset_document_id;

          if (!datasetDocId) {
            console.error("No dataset_document_id found on iteration document");
            toast.error("Cannot update dataset value");
            return;
          }

          // Find the dataset document in the dataset documents array
          const datasetDoc = currentDatasetContext.datasetDocuments.find(
            (doc: any) => doc.id === datasetDocId,
          );
          if (!datasetDoc) {
            console.error("Dataset document not found");
            toast.error("Dataset document not found");
            return;
          }

          // Update the dataset document with the extracted value
          const currentAnnotation =
            (datasetDoc as any).prediction_data?.prediction || {};
          // Map iteration (dict2) path to dataset (dict1) path via key mappings when available
          const mappedDatasetPath = (currentRowDistanceData
            ?.candidate_to_reference_paths?.[currentSelectedFieldPath] ??
            currentSelectedFieldPath) as string;
          const updatedAnnotation = assignObjectKey(
            currentAnnotation,
            mappedDatasetPath.split("."),
            extractedValue,
          );

          console.log(
            "Reference value before",
            currentRowDistanceData?.aligned_reference_values?.[
              currentSelectedFieldPath
            ],
          );

          await currentDatasetContext.updateDatasetDocument(datasetDocId, {
            prediction_data: {
              prediction: updatedAnnotation,
              metadata: datasetDoc.prediction_data?.metadata || {},
            },
          });

          // Invalidate distance data for this specific iteration document since its reference dataset value changed
          if (currentDatasetContext.invalidateDistances && currentDocument.id) {
            currentDatasetContext.invalidateDistances(currentDocument.id);
          }

          console.log("mappedDatasetPath for {selectedFieldPath}", {
            selectedFieldPath: currentSelectedFieldPath,
            mappedDatasetPath,
          });

          console.log(
            "Current annotation value",
            get_value_from_row_array_and_dot_notation_path(
              currentAnnotation,
              mappedDatasetPath,
            ),
          );
          console.log(
            "Updated annotation value",
            get_value_from_row_array_and_dot_notation_path(
              updatedAnnotation,
              mappedDatasetPath,
            ),
          );
          console.log(
            "Reference value after",
            currentRowDistanceData?.aligned_reference_values?.[
              currentSelectedFieldPath
            ],
          );

          toast.success("Replaced with extracted value");
        } catch (err) {
          console.error("Failed to replace dataset value", err);
          toast.error("Failed to replace dataset value");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  });

  if (
    typeof selectedFieldPath === "string" &&
    currentIterationId.includes("iteration") &&
    rowDistanceData
  ) {
    if (similarityType === "aligned") {
      //throw new Error("Aligned similarity is disabled for now");
      likelihoodScore = rowDistanceData?.aligned_path_similarity?.[
        selectedFieldPath
      ] as number;
      referenceValue =
        rowDistanceData?.aligned_reference_values?.[selectedFieldPath];
    } else {
      likelihoodScore = rowDistanceData?.unaligned_path_similarity?.[
        selectedFieldPath
      ] as number;
      referenceValue =
        rowDistanceData?.unaligned_reference_values?.[selectedFieldPath];
    }

    hasLikelihood = !isNaN(likelihoodScore) && likelihoodScore !== undefined;
    _hasReference = referenceValue !== undefined && referenceValue !== null;
  }
  const referenceValueString = JSON.stringify(referenceValue);

  const consensusDetails = getPredictionConsensusDetails(
    document?.prediction_data?.metadata,
  );
  const reasoningPath =
    typeof selectedFieldPath === "string" && selectedFieldPath.includes(".")
      ? selectedFieldPath.replace(/\.([^.]+)$/, ".reasoning___$1")
      : typeof selectedFieldPath === "string"
        ? `reasoning___${selectedFieldPath}`
        : undefined;

  const reasoningValue: any =
    typeof reasoningPath === "string"
      ? get_value_from_row_array_and_dot_notation_path(
          document?.prediction_data.prediction,
          reasoningPath,
        )
      : undefined;

  const reasoning =
    typeof reasoningValue === "string" ? reasoningValue : undefined;

  const consensusData =
    typeof selectedFieldPath === "string"
      ? (getConsensusData(consensusDetails, selectedFieldPath) || []).filter(
          (item) => item.data !== undefined,
        )
      : [];
  const hasConsensus = consensusData.length > 0;

  // Get the property schema for the field using getFieldSchema (must be before early returns)
  const property =
    typeof selectedFieldPath === "string" && jsonSchema
      ? getFieldSchema(
          jsonSchema,
          // Use mapped dataset path for schema resolution to ensure correct editor typing
          (rowDistanceData?.candidate_to_reference_paths?.[selectedFieldPath] ??
            selectedFieldPath) as string,
        )
      : null;

  // Determine if the property is optional (nullable)
  const isPropertyOptional = (() => {
    if (!property) return false;
    const typeArray = Array.isArray((property as any)?.type)
      ? ((property as any).type as any[])
      : null;
    const combos =
      (property as any)?.anyOf ||
      (property as any)?.oneOf ||
      (property as any)?.allOf;
    const hasNullInType = !!(typeArray && typeArray.includes("null"));
    const hasNullInCombos =
      Array.isArray(combos) &&
      combos.some((option: any) => (option as any)?.type === "null");
    return hasNullInType || hasNullInCombos;
  })();

  // Determine if this is a computed field (from schema tag). The computed-field
  // DSL has been removed, so `X-ComputedField` is never set and this is always
  // false at runtime; the guards below collapse to the non-computed branches.
  const isComputedField = !!(
    property && (property as any)["X-ComputedField"] === true
  );

  // Extract consensus reasoning for the current field
  const consensusReasonings: string[] = [];
  if (
    typeof selectedFieldPath === "string" &&
    consensusDetails &&
    consensusDetails.length > 0
  ) {
    consensusDetails.forEach((item: any) => {
      if (item.data && typeof item.data === "object") {
        // Construct the reasoning path in dot notation
        const keyParts = selectedFieldPath.split(".");
        let reasoningPath: string;

        if (keyParts.length === 1) {
          // Flat field like "nationality" -> look for "reasoning___nationality"
          reasoningPath = `reasoning___${selectedFieldPath}`;
        } else {
          // Nested field like "mrz.line1" -> look for "mrz.reasoning___line1"
          const objectPath = keyParts.slice(0, -1).join(".");
          const fieldName = keyParts[keyParts.length - 1];
          reasoningPath = `${objectPath}.reasoning___${fieldName}`;
        }

        // Use the existing utility function to get the nested value
        const reasoning = get_value_from_row_array_and_dot_notation_path(
          item.data,
          reasoningPath as string,
        );
        if (reasoning && typeof reasoning === "string") {
          consensusReasonings.push(reasoning);
        }
      }
    });
  }

  const hasConsensusReasoning = hasConsensus && consensusReasonings.length > 0;

  // Check for indication text from review highlighting.
  // The fieldIndicationMap uses normalized paths with `.*` wildcard segments.
  const indicationText = React.useMemo(() => {
    if (!fieldIndicationMap || !selectedFieldPath) return null;

    // First try direct match
    if (fieldIndicationMap.has(selectedFieldPath)) {
      return fieldIndicationMap.get(selectedFieldPath);
    }

    // Try normalized path (convert array indices to `.*`).
    const normalizedPath = normalizeFieldPath(selectedFieldPath);
    if (fieldIndicationMap.has(normalizedPath)) {
      return fieldIndicationMap.get(normalizedPath);
    }

    // Try matching by converting the map keys patterns to regex
    for (const [pattern, text] of fieldIndicationMap.entries()) {
      const regexPattern = pattern
        .replace(/\.\*/g, ".__WILDCARD__")
        .replace(/\./g, "\\.")
        .replace(/__WILDCARD__/g, "\\.\\d+");
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(selectedFieldPath)) {
        return text;
      }
    }

    return null;
  }, [fieldIndicationMap, selectedFieldPath]);

  // Check for reasoning text from review highlighting
  const reasoningText = React.useMemo(() => {
    if (!fieldReasoningMap || !selectedFieldPath) return null;

    // First try direct match
    if (fieldReasoningMap.has(selectedFieldPath)) {
      return fieldReasoningMap.get(selectedFieldPath);
    }

    // Try normalized path (convert array indices to `.*`).
    const normalizedPath = normalizeFieldPath(selectedFieldPath);
    if (fieldReasoningMap.has(normalizedPath)) {
      return fieldReasoningMap.get(normalizedPath);
    }

    // Try matching by converting the map keys patterns to regex
    for (const [pattern, text] of fieldReasoningMap.entries()) {
      const regexPattern = pattern
        .replace(/\.\*/g, ".__WILDCARD__")
        .replace(/\./g, "\\.")
        .replace(/__WILDCARD__/g, "\\.\\d+");
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(selectedFieldPath)) {
        return text;
      }
    }

    return null;
  }, [fieldReasoningMap, selectedFieldPath]);

  // Determine grid layout and content size based on available data
  const getColumnCount = () => {
    return (
      [hasConsensus, hasLikelihood && !isReferenceSheet, reasoning].filter(
        Boolean,
      ).length + (isReferenceSheet ? 1 : 0)
    );
  };

  const columnCount = getColumnCount();

  // Show popover if there's indication text or reasoning text, even if other columns are empty
  if (
    !showInfoPanel ||
    (!isComputedField && columnCount === 0 && !indicationText && !reasoningText)
  ) {
    return null;
  }

  return (
    <div className="w-[240px]">
      <div className="w-full border-b border-border bg-muted p-2">
        <div className="min-w-0 flex-1">
          <div className="group flex w-full flex-col items-start justify-between gap-2">
            {/* <h2 className="text-xs font-medium text-foreground truncate flex items-center gap-1">
               <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-muted-foreground shrink-0 rounded-full w-3 h-3 flex items-center justify-center group" onClick={() => setShowInfoPanel(!showInfoPanel)}>
                    <div className="h-[2px] w-[6px] group-hover:bg-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs break-words">
                  <p className="text-xs">
                    Hide info panel. Reopen with {typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(((navigator as any).userAgentData?.platform || navigator.userAgent || "")) ? "⌘ I" : "Ctrl+I"} or click the <AppWindowIcon className="inline-block h-3 w-3 -translate-y-[1px]" /> icon in the top right corner.
                  </p>
                </TooltipContent>
              </Tooltip> 
              {selectedFieldPath || 'Field'} */}
            <div className="flex w-full items-start justify-between gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h2 className="max-w-full min-w-0 truncate text-xs font-medium text-foreground">
                    {selectedFieldPath || "Field"}
                  </h2>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs break-words">
                  <p className="text-xs">{selectedFieldPath}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="group flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    onClick={() => setShowInfoPanel(!showInfoPanel)}
                  >
                    <div className="h-[2px] w-[6px] group-hover:bg-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs break-words">
                  <p className="text-xs">
                    Hide info panel. Reopen with{" "}
                    {typeof navigator !== "undefined" &&
                    /mac|iphone|ipad|ipod/i.test(
                      (navigator as any).userAgentData?.platform ||
                        navigator.userAgent ||
                        "",
                    )
                      ? "⌘ I"
                      : "Ctrl+I"}{" "}
                    or click the{" "}
                    <AppWindowIcon className="inline-block h-3 w-3 -translate-y-[1px]" />{" "}
                    icon in the top right corner.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
      {/* Indication text and reasoning banner for review */}
      {(indicationText || reasoningText) && (
        <div className="border-b border-warning bg-warning/10 px-2 py-2">
          <div className="flex flex-col gap-1.5">
            {indicationText && (
              <div className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-xs text-warning-foreground">{indicationText}</p>
              </div>
            )}
            {reasoningText && (
              <div className="flex items-start gap-2">
                <Atom className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-foreground" />
                <p className="text-xs text-warning-foreground italic">
                  Reasoning: {reasoningText}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {(isComputedField || columnCount > 0) && (
        <div
          className={`flex max-h-[317px] flex-col gap-4 overflow-y-auto px-2 pt-2 pb-3`}
        >
          {!isComputedField && !hasConsensus && !hasLikelihood && reasoning && (
            <Card className="gap-0 border-none p-0 shadow-none">
              <CardHeader className="p-0">
                <CardTitle>
                  <div className="flex items-center gap-2 text-foreground">
                    <div className="text-xs font-medium tracking-wide uppercase">
                      Reasoning
                    </div>
                    <Atom className="h-4 w-4" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="cursor-pointer rounded border bg-muted p-1 text-xs">
                  <textarea
                    className="flex min-h-32 w-full resize-none font-medium text-foreground"
                    value={reasoning}
                    readOnly
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Likelihood + Reference column */}
          {!isComputedField && !isReferenceSheet && hasLikelihood && (
            <>
              <Card className="gap-0 border-none p-0 shadow-none">
                <CardHeader className="p-0">
                  <CardTitle>
                    <div>
                      <div className="flex items-center justify-between text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="flex text-xs font-medium tracking-wide uppercase">
                            {"Ground Truth"}
                          </div>
                        </div>
                        {isEditingDatasetValue &&
                          value !== undefined &&
                          JSON.stringify(value) !==
                            JSON.stringify(editingDatasetValueAny) && (
                            <button
                              type="button"
                              disabled={isSavingDatasetValue}
                              className="rounded-md border px-2 py-1 text-[10px] hover:bg-muted"
                              onClick={() => {
                                setEditingDatasetValueAny(value);
                              }}
                            >
                              Replace by prediction
                            </button>
                          )}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isEditingDatasetValue ? (
                    <div
                      className="space-y-2"
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <TypeAdaptedInput
                        schema={property as any}
                        rootSchema={jsonSchema as any}
                        value={editingDatasetValueAny}
                        onChange={setEditingDatasetValueAny}
                        disabled={isSavingDatasetValue}
                      />
                      <div className="mb-1 flex items-center justify-between">
                        {isPropertyOptional && (
                          <button
                            type="button"
                            disabled={isSavingDatasetValue}
                            className="rounded-md border px-2 py-1 text-xs"
                            onClick={() => {
                              setEditingDatasetValueAny(null);
                            }}
                          >
                            Clear
                          </button>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            disabled={isSavingDatasetValue}
                            className="rounded-md bg-muted px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                            onClick={async () => {
                              setIsSavingDatasetValue(true);
                              try {
                                await onDatasetValueChange(
                                  editingDatasetValueAny,
                                );
                                setIsEditingDatasetValue(false);
                              } catch (err) {
                                console.error(
                                  "Failed to update dataset value",
                                  err,
                                );
                              } finally {
                                setIsSavingDatasetValue(false);
                              }
                            }}
                          >
                            Save
                          </button>
                          <button
                            disabled={isSavingDatasetValue}
                            className="rounded-md border px-2 py-1 text-xs"
                            onClick={() => {
                              setIsEditingDatasetValue(false);
                              setEditingDatasetValue("");
                              setEditingDatasetValueAny(referenceValue);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={
                              "flex cursor-pointer flex-col rounded border bg-muted p-1 text-xs transition-colors hover:bg-muted"
                            }
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsEditingDatasetValue(true);
                              setEditingDatasetValueAny(referenceValue);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setIsEditingDatasetValue(true);
                                try {
                                  const pretty =
                                    typeof referenceValue === "string"
                                      ? referenceValue
                                      : JSON.stringify(referenceValue, null, 2);
                                  setEditingDatasetValue(pretty || "");
                                } catch {
                                  setEditingDatasetValue(referenceValueString);
                                }
                              }
                            }}
                          >
                            <div className="flex max-w-32 items-center gap-1 truncate pb-4 font-medium text-foreground">
                              <span className="truncate">
                                {referenceValueString}
                              </span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Click to edit ground truth value</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {!isReconciliationMode && (
                    <div className="mt-auto ml-auto flex items-center justify-end gap-1 pt-1 text-xs text-[10px] !text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                          {typeof navigator !== "undefined" &&
                          /mac|iphone|ipad|ipod/i.test(
                            (navigator as any).userAgentData?.platform ||
                              navigator.userAgent ||
                              "",
                          )
                            ? "⌘"
                            : "CTRL"}
                        </span>
                        <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                          {"E"}
                        </span>
                      </span>
                      {"Replace with extracted value"}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="gap-0 border-none p-0 shadow-none">
                <CardHeader className="-mb-2 p-0">
                  <CardTitle>
                    <div>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="">
                                <div
                                  className={cn(
                                    "flex items-center gap-2 pt-1 text-foreground",
                                    !isReconciliationMode && "cursor-pointer",
                                  )}
                                >
                                  <div
                                    className="text-xs font-medium tracking-wide uppercase"
                                    onClick={() => {
                                      if (isReconciliationMode) return;
                                      if (selectedFieldPath) {
                                        setMetricsSelection(
                                          normalizeFieldPath(selectedFieldPath),
                                        );
                                      }
                                      setActiveView("metrics");
                                    }}
                                  >
                                    Similarity
                                  </div>
                                  <Ruler className="h-4 w-4" />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {
                                  "The ground truth value and the prediction are compared to compute the similarity score."
                                }
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <DidacticColorBar
                    colorState="similarity"
                    size="sm"
                    value={likelihoodScore}
                    className="justify-center"
                  />
                  {!isReconciliationMode && (
                    <div className="mt-2 flex items-center justify-end gap-1 text-xs text-[10px] !text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                          {typeof navigator !== "undefined" &&
                          /mac|iphone|ipad|ipod/i.test(
                            (navigator as any).userAgentData?.platform ||
                              navigator.userAgent ||
                              "",
                          )
                            ? "⌘"
                            : "CTRL"}
                        </span>
                        <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                          {"G"}
                        </span>
                      </span>
                      {"Open metrics"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!isComputedField && hasConsensus && (
            <>
              <Card className="gap-0 border-none p-0 shadow-none">
                <CardHeader className="p-0">
                  <CardTitle>
                    <div className="flex items-center gap-2 text-foreground">
                      <div className="flex text-xs font-medium tracking-wide uppercase">
                        Consensus
                      </div>
                      <Blend className="h-4 w-4" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="mb-3">
                    <DidacticColorBar
                      colorState="consensus"
                      size="sm"
                      value={consensusScore}
                      className="justify-center"
                    />
                  </div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium">
                    Consensus value:
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-pointer rounded border bg-muted p-1 text-xs">
                        <div className="max-w-32 truncate font-medium text-foreground">
                          {valueString}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      className={FLOATING_CARD_VALUE_TOOLTIP_CLASS}
                    >
                      <p className="text-xs"> {valueString} </p>
                    </TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>

              <Card className="gap-0 border-none p-0 shadow-none">
                <CardHeader className="p-0">
                  <CardTitle>
                    <div className="text-muted-foreground text-xs font-normal tracking-wide uppercase">
                      Candidates
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <TooltipProvider>
                    <div className="space-y-1">
                      {consensusData.map((item, index) => {
                        const displayValue = JSON.stringify(item.data);
                        return (
                          <div
                            className="flex items-center justify-between gap-2"
                            key={index}
                          >
                            <Tooltip key={index}>
                              <TooltipTrigger asChild>
                                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                  {`${index + 1}.`}
                                  <div className="cursor-pointer rounded border bg-muted p-1 text-xs">
                                    <div className="max-w-24 grow truncate font-medium text-foreground">
                                      {displayValue}
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="left"
                                className={FLOATING_CARD_VALUE_TOOLTIP_CLASS}
                              >
                                <p className="text-xs"> {displayValue} </p>
                              </TooltipContent>
                            </Tooltip>

                            {hasConsensusReasoning && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Atom className="text-muted-foreground h-3 w-3 cursor-pointer" />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    className={
                                      FLOATING_CARD_VALUE_TOOLTIP_CLASS
                                    }
                                  >
                                    <p className="text-xs">
                                      {" "}
                                      {consensusReasonings[index]}{" "}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            </>
          )}

          {!isComputedField && isReferenceSheet && (
            <Card className="gap-0 border-none p-0 shadow-none">
              <CardHeader className="p-0">
                <CardTitle>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <div className="text-xs font-normal tracking-wide uppercase">
                      Actions
                    </div>
                    <MousePointerClick className="h-4 w-4" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-1 p-0">
                {deletable && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-xs font-normal"
                    onClick={() => {
                      onDeleteRow();
                    }}
                  >
                    Delete row
                    <div className="mt-auto ml-auto flex items-center justify-end gap-1 text-xs text-[10px] !text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                          {typeof navigator !== "undefined" &&
                          /mac|iphone|ipad|ipod/i.test(
                            (navigator as any).userAgentData?.platform ||
                              navigator.userAgent ||
                              "",
                          )
                            ? "⌘"
                            : "CTRL"}
                        </span>
                        <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                          Del
                        </span>
                      </span>
                    </div>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs font-normal"
                >
                  Edit cell
                  <div className="ml-auto flex items-center gap-1 text-xs text-[10px] font-light !text-muted-foreground">
                    {/*<SquareMousePointer className="size-[12px] shrink-0 text-muted-foreground" />*/}
                    <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                      Click
                    </span>
                  </div>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs font-normal"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleValidity(
                      document as DatasetDocument,
                      selectedFieldPath,
                      updateDocument,
                    );
                  }}
                >
                  {currentValidity ? "Mark as unverified" : "Mark as verified"}
                  <div className="mt-auto ml-auto flex items-center justify-end gap-1 text-xs text-[10px] !text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                        {typeof navigator !== "undefined" &&
                        /mac|iphone|ipad|ipod/i.test(
                          (navigator as any).userAgentData?.platform ||
                            navigator.userAgent ||
                            "",
                        )
                          ? "⌘"
                          : "CTRL"}
                      </span>
                      <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                        E
                      </span>
                    </span>
                  </div>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs font-normal"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowInfoPanel(false);
                  }}
                >
                  {"Hide Info Panel"}
                  <div className="mt-auto ml-auto flex items-center justify-end gap-1 text-xs text-[10px] !text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                        {typeof navigator !== "undefined" &&
                        /mac|iphone|ipad|ipod/i.test(
                          (navigator as any).userAgentData?.platform ||
                            navigator.userAgent ||
                            "",
                        )
                          ? "⌘"
                          : "CTRL"}
                      </span>
                      <span className="rounded-sm border border-border px-1 py-0.5 font-light opacity-100">
                        I
                      </span>
                    </span>
                  </div>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
DataCellPopoverCardContentInner.displayName = "DataCellPopoverCardContentInner";

export function getDataCellPopoverSelectionKey(
  documentId: string | undefined,
  selectedFieldPath: string | undefined,
) {
  return `${documentId ?? "__no-document__"}:${selectedFieldPath ?? "__no-field__"}`;
}

export const DataCellPopoverCardContent = (
  props: DataCellPopoverCardContentProps,
) => {
  const renderKey = getDataCellPopoverSelectionKey(
    props.document?.id,
    props.selectedFieldPath,
  );

  return <DataCellPopoverCardContentInner key={renderKey} {...props} />;
};
DataCellPopoverCardContent.displayName = "DataCellPopoverCardContent";

// Wrapper component for projects context (backward compatibility)
export const DataCellPopoverCardContentWithHooks = ({
  similarityType: _similarityType,
  docIdOverride: _docIdOverride,
  fieldPathOverride: _fieldPathOverride,
}: {
  similarityType: "unaligned" | "aligned";
  docIdOverride?: string;
  fieldPathOverride?: string;
}) => {
  // This wrapper would be used in the projects context
  // It calls all the hooks and passes them as props to the base component
  throw new Error(
    "Not implemented - use DataCellPopoverCardContent with props instead",
  );
};
