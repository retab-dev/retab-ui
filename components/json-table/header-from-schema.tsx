import React, { useContext, useState } from "react";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { Button } from "@/components/ui-retab/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover";
import type {
  HeaderColumnApi,
  TableColumn,
} from "@/components/json-table/lib/column-types";
import {
  ChevronDown,
  ChevronUp,
  List,
  Type,
  CheckSquare,
  Hash,
  Calendar,
  Clock,
  CalendarClock,
  Box,
  Table,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Separator } from "@/components/ui-retab/separator";
import { ExtendedJSONSchema7 } from "@/components/json-table/lib/json-schema-types";
import { getEffectiveType } from "@/components/schema-editor/json-schema-builder";
import { PropertyEditor } from "@/components/schema-editor/property-dialog";
import {
  isObjectProperty,
  isValidProperty,
} from "@/components/json-table/lib/json-schema-utils";
import {
  ColumnWidth,
  getColumnWidthPx,
} from "@/components/json-table/table-options-store";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui-retab/dialog";
import { getTheme } from "@/components/json-table/lib/themes";
import { useMountEffect } from "@/hooks/useMountEffect";

const PopoverDialogContext = React.createContext<boolean>(false);
const PopoverDialog = ({
  isDialog,
  ...props
}: {
  isDialog?: boolean;
} & React.ComponentProps<typeof Popover>) => {
  // Always start `false` (the server value) to avoid an SSR/client hydration
  // mismatch; the mount effect below re-measures immediately after hydration.
  const [isBigEnough, setIsBigEnough] = useState<boolean>(false);

  useMountEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;

    const measureAndUpdate = () => {
      const next = window.innerHeight >= 900;
      setIsBigEnough((prev) => (prev !== next ? next : prev));
    };

    const handleResize = () => {
      const now = Date.now();
      const remaining = 1000 - (now - lastRun);
      if (remaining <= 0) {
        lastRun = now;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        measureAndUpdate();
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastRun = Date.now();
          measureAndUpdate();
          timeoutId = null;
        }, remaining);
      }
    };

    // Initial measure
    measureAndUpdate();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  const actualIsDialog = isDialog === undefined ? !isBigEnough : isDialog;

  return (
    <PopoverDialogContext.Provider value={actualIsDialog}>
      {actualIsDialog ? (
        <Dialog {...props} />
      ) : (
        <Popover {...props} modal={true} />
      )}
    </PopoverDialogContext.Provider>
  );
};
const PopoverDialogTrigger = ({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) => {
  const context = useContext(PopoverDialogContext);
  return context ? <DialogTrigger {...props} /> : <PopoverTrigger {...props} />;
};

const PopoverDialogContent = ({
  ...props
}: React.ComponentProps<typeof PopoverContent>) => {
  const context = useContext(PopoverDialogContext);
  return context ? (
    <DialogContent showCloseButton={false} {...props} />
  ) : (
    <PopoverContent {...props} />
  );
};

// Conditional title component that uses DialogTitle when in dialog context
const PopoverDialogTitle = ({
  className,
  children,
  ...props
}: React.ComponentProps<"h4">) => {
  const context = useContext(PopoverDialogContext);

  if (context) {
    return (
      <DialogTitle className={className} {...props}>
        {children}
      </DialogTitle>
    );
  }

  return (
    <h4 className={className} {...props}>
      {children}
    </h4>
  );
};

// Date utility functions for proper date display
const parseDisplayDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  // Handle various date formats commonly found in documents
  // Pattern: dd mm yyyy (with spaces)
  const ddmmyyyySpaceMatch = dateString.match(
    /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/,
  );
  if (ddmmyyyySpaceMatch) {
    const [, day, month, year] = ddmmyyyySpaceMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Pattern: dd/mm/yyyy
  const ddmmyyyySlashMatch = dateString.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  );
  if (ddmmyyyySlashMatch) {
    const [, day, month, year] = ddmmyyyySlashMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Pattern: dd-mm-yyyy
  const ddmmyyyyDashMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyyDashMatch) {
    const [, day, month, year] = ddmmyyyyDashMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Pattern: dd.mm.yyyy
  const ddmmyyyyDotMatch = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyyDotMatch) {
    const [, day, month, year] = ddmmyyyyDotMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // If already in yyyy-mm-dd format, parse as local time (not UTC)
  const isoMatch = dateString.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) {
    return new Date(dateString + "T00:00:00");
  }

  // Fallback to standard Date parsing
  const fallbackDate = new Date(dateString);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

const getIconFromEffectiveType = (
  type: string,
): React.ComponentType<{ className?: string }> => {
  switch (type) {
    case "string":
      return Type;
    case "boolean":
      return CheckSquare;
    case "number":
    case "integer":
      return Hash;
    case "object":
      return Box;
    case "array":
      return Table;
    case "date":
      return Calendar;
    case "time":
      return Clock;
    case "datetime":
      return CalendarClock;
    case "enum":
      return List;
    case "$ref":
      return Box;
    default:
      return Type;
  }
};

// Function to detect if a field has reasoning capabilities
export const hasReasoningField = (schema: ExtendedJSONSchema7): boolean => {
  if (!schema || typeof schema !== "object") return false;

  // Check for X-ReasoningPrompt
  if (
    schema["X-ReasoningPrompt"] &&
    schema["X-ReasoningPrompt"] !== "" &&
    schema["X-ReasoningPrompt"] !== null &&
    schema["X-ReasoningPrompt"] !== undefined
  ) {
    return true;
  }

  // Check for other reasoning-related fields
  for (const key in schema) {
    if (
      (key === "X-Reasoning" ||
        key === "X-ReasoningSteps" ||
        key.startsWith("X-Reasoning")) &&
      (schema as any)[key] !== "" &&
      (schema as any)[key] !== null &&
      (schema as any)[key] !== undefined
    ) {
      return true;
    }
  }

  return false;
};

// Function to check if a field name indicates it's a reasoning field
export const isReasoningFieldName = (fieldName: string): boolean => {
  return (
    fieldName.includes("reasoning___") || fieldName.includes("reasoning__")
  );
};

// Function to detect if a field is a computed field
export const isComputedField = (schema: ExtendedJSONSchema7): boolean => {
  if (!schema || typeof schema !== "object") return false;

  // Check for X-ComputedField tag
  if ((schema as any)["X-ComputedField"] === true) {
    return true;
  }

  return false;
};

// Function to detect if a field is a function field
export const isFunctionField = (schema: ExtendedJSONSchema7): boolean => {
  if (!schema || typeof schema !== "object") return false;
  if ((schema as any)["X-FunctionField"] === true) {
    return true;
  }
  return false;
};

// Function to detect if a field is a review-based criterion
export const isReviewCriterion = (schema: ExtendedJSONSchema7): boolean => {
  if (!schema || typeof schema !== "object") return false;

  const legacyReviewCriterionKey = "X-Human" + "InTheLoopCriterion";
  if (
    (schema as any)["X-ReviewCriterion"] === true ||
    (schema as any)[legacyReviewCriterionKey] === true
  ) {
    return true;
  }

  return false;
};

function resolveSchema(
  schemaDef: JSONSchema7Definition | null | undefined,
  context: any,
): JSONSchema7 {
  if (schemaDef == null || typeof schemaDef !== "object") {
    return context as JSONSchema7;
  }
  let current = schemaDef as JSONSchema7;
  while (current.$ref && typeof current.$ref === "string") {
    const refPath = current.$ref;
    const segments = refPath.split("/");
    if (segments[0] !== "#") {
      throw new Error("Only internal references are supported");
    }
    let next: any = context;
    for (let i = 1; i < segments.length; i++) {
      if (next == null || typeof next !== "object") {
        console.warn(
          `[resolveSchema] Could not resolve $ref "${refPath}": path segment "${segments[i]}" not found at index ${i}`,
        );
        return { type: "object" };
      }
      next = next[segments[i]];
    }
    if (next == null || typeof next !== "object") {
      console.warn(
        `[resolveSchema] Could not resolve $ref "${refPath}": target is null or not an object`,
      );
      return { type: "object" };
    }
    current = next as JSONSchema7;
  }
  return current;
}

// --- NEW: unwrap nullable unions / $ref to a concrete, non-null schema ---
export function unwrapSchema(
  schemaDef: JSONSchema7Definition | undefined,
  root: JSONSchema7,
): { schema: JSONSchema7; nullable: boolean } {
  // First resolve $ref
  let s = resolveSchema(schemaDef as any, root) as JSONSchema7;
  let nullable = false;

  // type: ['object','null'] / ['array','null'] / etc.
  if (Array.isArray(s?.type)) {
    if (s.type.includes("null")) {
      nullable = true;
      s = { ...s, type: s.type.find((t) => t !== "null") as any };
    }
  }

  // anyOf / oneOf / allOf that include null
  const combos = (s as any).anyOf || (s as any).oneOf || (s as any).allOf;
  if (Array.isArray(combos) && combos.length) {
    if (combos.some((o: any) => (o as any)?.type === "null")) {
      nullable = true;
    }
    // Pick the "effective" non-null branch (object/array/enum/etc.)
    const nonNull = combos.find((o: any) => {
      const r = resolveSchema(o, root) as JSONSchema7;
      const t = Array.isArray(r?.type)
        ? r.type.find((t) => t !== "null")
        : r?.type;
      return t !== "null" && (t || r.properties || r.items || r.enum);
    });
    if (nonNull) {
      const resolved = resolveSchema(nonNull, root) as JSONSchema7;
      // Drop combination keywords; we selected a branch already
      const {
        anyOf: _anyOf,
        oneOf: _oneOf,
        allOf: _allOf,
        ...rest
      } = resolved as any;
      s = rest as JSONSchema7;
    }
  }

  return { schema: s, nullable };
}

export function getSchemaFlatProperties(
  schema: JSONSchema7Definition,
  path: string[],
  context: any,
  opts?: {
    seen?: WeakSet<object>;
    depth?: number;
    maxDepth?: number;
  },
): { key: string; type: JSONSchema7 }[] {
  const seen = opts?.seen ?? new WeakSet<object>();
  const depth = opts?.depth ?? 0;
  const maxDepth = opts?.maxDepth ?? 64; // hard guard to avoid runaway recursion even without cycles

  let s = resolveSchema(schema, context) as JSONSchema7;
  // NEW: unwrap nullable/unioned schemas
  s = unwrapSchema(s as JSONSchema7, context as JSONSchema7)
    .schema as JSONSchema7;

  // Depth guard
  if (depth > maxDepth) {
    console.warn(
      "[getSchemaFlatProperties] Max depth reached while flattening schema at path:",
      path.join("."),
    );
    return [{ key: path.join("."), type: s as JSONSchema7 }];
  }

  // Cycle guard - uses stack-based tracking to detect true cycles
  // We add the object before recursing and remove it after, so that
  // the same $defs object can be correctly expanded when accessed from different paths
  let addedToSeen = false;
  if (s && typeof s === "object") {
    if (seen.has(s as object)) {
      console.warn(
        "[getSchemaFlatProperties] Circular schema reference detected at path:",
        path.join("."),
      );
      // Return a terminal node to avoid infinite recursion; mark as object leaf
      return [
        {
          key: path.join("."),
          type: {
            ...(s || {}),
            type: (s as any).type ?? "object",
            title: ((s as any).title as string) || "(circular)",
          } as JSONSchema7,
        },
      ];
    }
    seen.add(s as object);
    addedToSeen = true;
  }

  let result: { key: string; type: JSONSchema7 }[];

  if (s.type === "array") {
    if (s.items) {
      if (Array.isArray(s.items)) {
        result = s.items.flatMap((item, i) =>
          getSchemaFlatProperties(item, [...path, String(i)], context, {
            seen,
            depth: depth + 1,
            maxDepth,
          }),
        );
      } else if (typeof s.items === "object") {
        // NEW: unwrap items, too
        const itemUnwrapped = unwrapSchema(s.items, context as JSONSchema7)
          .schema as JSONSchema7;
        result = getSchemaFlatProperties(
          itemUnwrapped,
          [...path, "*"],
          context,
          {
            seen,
            depth: depth + 1,
            maxDepth,
          },
        );
      } else {
        result = [{ key: path.join("."), type: s as JSONSchema7 }];
      }
    } else {
      result = [{ key: path.join("."), type: s as JSONSchema7 }];
    }
  } else if (s.type === "object") {
    if (s.properties) {
      result = Object.entries(s.properties).flatMap(([key, value]) =>
        getSchemaFlatProperties(value, [...path, key], context, {
          seen,
          depth: depth + 1,
          maxDepth,
        }),
      );
    } else {
      result = [{ key: path.join("."), type: s as JSONSchema7 }];
    }
  } else {
    result = [{ key: path.join("."), type: s as JSONSchema7 }];
  }

  // Remove from seen after processing to allow the same $defs object
  // to be correctly expanded when accessed from different paths
  if (addedToSeen && s && typeof s === "object") {
    seen.delete(s as object);
  }

  return result;
}

export function getSchemaPropertyType(
  schema: JSONSchema7,
  key: string,
): JSONSchema7 {
  const topSchema = schema;
  if (key === "") return schema;
  const path = key.split(".");
  for (let i = 0; i < path.length; i++) {
    // Resolve $ref first, then unwrap ONLY for traversal decisions so optional objects work
    const resolvedForTraversal = resolveSchema(schema, topSchema);
    const traversal = unwrapSchema(
      resolvedForTraversal as JSONSchema7,
      topSchema,
    ).schema as JSONSchema7;

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[path[i]] as JSONSchema7;
    } else if (traversal.type === "array") {
      if (traversal.items) {
        if (Array.isArray(traversal.items)) {
          schema = traversal.items[parseInt(path[i])] as JSONSchema7;
        } else if (typeof traversal.items === "object") {
          if (path[i] === "*" || !isNaN(parseInt(path[i]))) {
            schema = traversal.items as JSONSchema7;
          }
        }
      }
    }
  }
  schema = resolveSchema(schema, topSchema);

  return schema;
}

// Returns the schema at path without resolving the final node, preserving $ref when present.
export function getSchemaPropertyTypeRaw(
  schema: JSONSchema7,
  key: string,
): JSONSchema7Definition {
  const topSchema = schema;
  if (key === "") return schema;
  const path = key.split(".");
  for (let i = 0; i < path.length; i++) {
    const resolvedForTraversal = resolveSchema(schema, topSchema);
    const traversal = unwrapSchema(
      resolvedForTraversal as JSONSchema7,
      topSchema,
    ).schema as JSONSchema7;

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[path[i]] as JSONSchema7;
    } else if (traversal.type === "array") {
      if (traversal.items) {
        if (Array.isArray(traversal.items)) {
          schema = traversal.items[parseInt(path[i])] as JSONSchema7;
        } else if (typeof traversal.items === "object") {
          if (path[i] === "*" || !isNaN(parseInt(path[i]))) {
            schema = traversal.items as JSONSchema7;
          }
        }
      }
    }
  }
  // Do NOT resolve here; preserve $ref on the final node
  return schema as JSONSchema7Definition;
}

export function buildSchemaDefaultValue(schemaDef: JSONSchema7Definition): any {
  // Handle boolean schema definitions
  if (typeof schemaDef === "boolean") {
    return null;
  }

  const schema = schemaDef as JSONSchema7;

  // Handle array type
  if (schema.type === "array") {
    return [];
  }
  // Handle non-object types
  else if (schema.type !== "object") {
    return null;
  }
  // Handle object type
  else {
    if (schema.properties) {
      const entries = Object.entries(schema.properties);
      const defaultValues = entries.map(([key, value]) => [
        key,
        buildSchemaDefaultValue(value),
      ]);
      return Object.fromEntries(defaultValues);
    } else {
      return {};
    }
  }
}

export const FormatHeaderName = (name: string) => {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function flattenColumns(
  columns: TableColumn[],
): TableColumn[] {
  return columns.reduce((acc, col) => {
    if ("columns" in col && Array.isArray(col.columns)) {
      return acc.concat(
        flattenColumns(col.columns as TableColumn[]),
      );
    }
    return acc.concat([col]);
  }, [] as TableColumn[]);
}

function getTopProperties(
  depth: number,
  properties: { key: string }[],
): string[] {
  const topProperties = properties.reduce((acc: string[], { key }) => {
    const firstProp = key.split(".")[depth];
    if (firstProp && !acc.includes(firstProp)) {
      acc.push(firstProp);
    }
    return acc;
  }, []);
  if (topProperties.includes("*") && topProperties.length !== 1) {
    throw new Error("Invalid schema for array");
  }
  return topProperties;
}

function reorderPropertiesInSchema(
  currentSchema: ExtendedJSONSchema7,
  parentObjectPath: string, // Path to the parent object. Empty for root.
  sourcePropName: string,
  targetPropName: string,
  setSchemaCallback: (schema: ExtendedJSONSchema7) => void,
): void {
  const schemaCopy = JSON.parse(
    JSON.stringify(currentSchema),
  ) as ExtendedJSONSchema7;

  let parentNode: ExtendedJSONSchema7 | undefined;
  let targetPropertiesObject: Record<string, JSONSchema7Definition> | undefined;

  if (!parentObjectPath) {
    // Root properties
    parentNode = schemaCopy;
    if (parentNode.type === "object" && parentNode.properties) {
      targetPropertiesObject = parentNode.properties;
    }
  } else {
    const segments = parentObjectPath.split(".");
    let currentNode: any = schemaCopy; // Start with the root of the schema copy
    for (const segment of segments) {
      // Resolve $refs using the schemaCopy as the context
      const resolvedCurrentNode = resolveSchema(currentNode, schemaCopy);
      if (!resolvedCurrentNode || typeof resolvedCurrentNode !== "object") {
        console.error(
          `Could not resolve current node at segment: ${segment} in ${parentObjectPath}`,
        );
        return;
      }
      currentNode = resolvedCurrentNode;

      if (segment === "$defs" && currentNode.$defs) {
        // Handle $defs segment
        // This case should ideally not be hit if parentObjectPath is for data properties
        console.warn("Navigating through $defs, ensure path is correct.");
        currentNode = currentNode.$defs; // Move into $defs
        continue; // Continue to next segment which would be the def name
      }

      if (
        currentNode.type === "object" &&
        currentNode.properties &&
        currentNode.properties[segment]
      ) {
        currentNode = currentNode.properties[segment];
      } else if (
        currentNode.type === "array" &&
        segment === "*" &&
        currentNode.items &&
        typeof currentNode.items === "object"
      ) {
        // This case is for when parentObjectPath points to an object schema within an array's items
        currentNode = currentNode.items;
      } else if (
        currentNode[segment] &&
        typeof currentNode[segment] === "object"
      ) {
        // General case for $defs
        currentNode = currentNode[segment];
      } else {
        console.error(
          `Could not find path: ${parentObjectPath} in schema. Segment: ${segment}, Current Node:`,
          JSON.parse(JSON.stringify(currentNode)),
        );
        return;
      }
    }
    // After iterating, currentNode should be the parent object definition
    // If currentNode is a $ref, we need to navigate to the actual definition
    let actualNode = currentNode;
    if (
      currentNode &&
      typeof currentNode === "object" &&
      (currentNode as any).$ref
    ) {
      // Navigate to the $ref target in schemaCopy
      const refPath = (currentNode as any).$ref as string;
      const refSegments = refPath.split("/");
      if (refSegments[0] === "#") {
        let refTarget: any = schemaCopy;
        for (let i = 1; i < refSegments.length; i++) {
          refTarget = refTarget?.[refSegments[i]];
        }
        if (refTarget && typeof refTarget === "object") {
          actualNode = refTarget;
        }
      }
    }

    parentNode = actualNode as ExtendedJSONSchema7;

    // Validate it's an object with properties
    if (parentNode && parentNode.type === "object") {
      // Use the ACTUAL node's properties (or create if doesn't exist yet)
      if (!parentNode.properties) {
        parentNode.properties = {};
      }
      targetPropertiesObject = parentNode.properties;
    }
  }

  if (!parentNode || !targetPropertiesObject) {
    console.error(
      "Node for reordering is not an object with properties or path is invalid. Path:",
      parentObjectPath,
      "Parent Node:",
      parentNode,
    );
    return;
  }

  const currentProperties = targetPropertiesObject;
  const keys = Object.keys(currentProperties);

  const sourceIndex = keys.indexOf(sourcePropName);
  const targetIndex = keys.indexOf(targetPropName);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    console.warn("Reorder failed: Invalid property names or indices.", {
      sourcePropName,
      targetPropName,
      keys,
    });
    return;
  }

  const reorderedKeys = Array.from(keys);
  const [movedItemKey] = reorderedKeys.splice(sourceIndex, 1);
  reorderedKeys.splice(targetIndex, 0, movedItemKey);


  const newProperties: Record<string, JSONSchema7Definition> = {};
  reorderedKeys.forEach((key) => {
    newProperties[key] = currentProperties[key];
  });

  parentNode.properties = newProperties;


  setSchemaCallback(schemaCopy);
}

// Delete a property anywhere in the schema using a dotted path (supports '*' for array items)
function deletePropertyInSchema(
  currentSchema: ExtendedJSONSchema7,
  fullPropPath: string,
): ExtendedJSONSchema7 {
  const schemaCopy = JSON.parse(
    JSON.stringify(currentSchema),
  ) as ExtendedJSONSchema7;
  if (!fullPropPath) return schemaCopy;

  const pathSegments = fullPropPath.split(".");
  const propertyName = pathSegments.pop() as string;
  const parentPathSegments = pathSegments;

  let currentNode: any = schemaCopy;
  if (parentPathSegments.length > 0) {
    for (const segment of parentPathSegments) {
      const resolvedCurrentNode = resolveSchema(
        currentNode,
        schemaCopy,
      ) as JSONSchema7;

      if (
        resolvedCurrentNode &&
        typeof resolvedCurrentNode === "object" &&
        resolvedCurrentNode.type === "object" &&
        resolvedCurrentNode.properties &&
        (resolvedCurrentNode.properties as any)[segment]
      ) {
        // Prefer moving via the actual node if possible, otherwise fallback to resolved
        if (currentNode && (currentNode as any).properties) {
          currentNode = (currentNode as any).properties[segment];
        } else {
          currentNode = (resolvedCurrentNode as any).properties[segment];
        }
      } else if (
        resolvedCurrentNode &&
        typeof resolvedCurrentNode === "object" &&
        resolvedCurrentNode.type === "array" &&
        (segment === "*" || !isNaN(parseInt(segment))) &&
        resolvedCurrentNode.items &&
        typeof resolvedCurrentNode.items === "object"
      ) {
        if (currentNode && (currentNode as any).items) {
          currentNode = (currentNode as any).items;
        } else {
          currentNode = resolvedCurrentNode.items as any;
        }
      } else if (
        (currentNode as any)[segment] &&
        typeof (currentNode as any)[segment] === "object"
      ) {
        // Generic object navigation (e.g., $defs)
        currentNode = (currentNode as any)[segment];
      } else {
        // Path invalid; return original copy
        return schemaCopy;
      }
    }
  }

  const parentNode = resolveSchema(
    currentNode,
    schemaCopy,
  ) as ExtendedJSONSchema7;

  if (!parentNode || parentNode.type !== "object" || !parentNode.properties) {
    return schemaCopy;
  }

  // Delete the property
  if ((parentNode.properties as any)[propertyName] !== undefined) {
    delete (parentNode.properties as any)[propertyName];
  }

  // Update the required array on the same parent node
  if (Array.isArray(parentNode.required)) {
    parentNode.required = parentNode.required.filter(
      (req: string) => req !== propertyName,
    );
    if (parentNode.required.length === 0) {
      delete (parentNode as any).required;
    }
  }

  return schemaCopy;
}

export function ColumnsFromSchema(
  schema: ExtendedJSONSchema7,
  //onViewFile: (fileId: string) => void,
  setSchema: (schema: ExtendedJSONSchema7) => void,
  stopAt: string[],
  setStopAt: (stopAt: string[]) => void,
  columnWidth: ColumnWidth,
  is_published: boolean,
  draggedItemKeyRef: React.RefObject<string | null>,
  draggedItemParentPathRef: React.RefObject<string | null>,
  currentIterationId: string,
  editMode: "promptOnly" | "editable" | "readOnly",
  disableHeaderInteractions: boolean = false,
): [TableColumn[], number] {

  var maxDepth = 0;
  if (!schema.properties || Object.keys(schema.properties).length === 0)
    return [[], 0];

  const theme = getTheme(currentIterationId);
  function buildColumns(
    properties: { key: string }[],
    depth: number,
  ): TableColumn[] {
    function keyStartsWith(key: string, prop: string) {
      return key.split(".")[depth] === prop;
    }

    if (properties.length === 0) return [];
    const topProperties = getTopProperties(depth, properties);
    // Skip the * property - it represents array items and should be merged with its parent
    if (topProperties.length === 1 && topProperties[0] === "*") {
      const nextDepth = depth + 1;
      maxDepth = Math.max(maxDepth, nextDepth);
      const childProps = properties.map((p) => ({ key: p.key }));
      const levelTwoProperties = getTopProperties(nextDepth, childProps);
      if (!(levelTwoProperties.length === 1 && levelTwoProperties[0] === "*")) {
        return buildColumns(childProps, nextDepth);
      }
    }
    const handleDragStart = (
      event: React.DragEvent<HTMLDivElement>,
      propName: string,
      parentPath: string,
    ) => {
      const parentSchema = parentPath
        ? getSchemaPropertyType(schema, parentPath)
        : schema;

      if (parentSchema.type === "object") {
        event.dataTransfer.setData("text/plain", propName);
        event.dataTransfer.effectAllowed = "move";
        draggedItemKeyRef.current = propName;
        draggedItemParentPathRef.current = parentPath;

        // Create custom drag image
        const dragImage = document.createElement("div");
        dragImage.textContent = FormatHeaderName(propName); // Use your formatting function
        dragImage.style.position = "absolute";
        dragImage.style.top = "-1000px"; // Position off-screen
        dragImage.style.left = "-1000px";
        dragImage.style.padding = "4px 8px";
        dragImage.style.backgroundColor = "rgba(200, 200, 200, 0.7)"; // Light background
        dragImage.style.border = "1px solid var(--color-border)";
        dragImage.style.borderRadius = "4px";
        dragImage.style.fontSize = "12px"; // Match header font size if desired
        dragImage.style.fontFamily = "sans-serif"; // Or your app's font
        document.body.appendChild(dragImage);

        // Set the custom drag image. Adjust offsets as needed.
        // (0,0) aligns top-left of image with cursor.
        // For centering: (dragImage.offsetWidth / 2, dragImage.offsetHeight / 2)
        // However, offsetWidth/Height might be 0 if not fully rendered.
        // It's often better to use fixed offsets or calculate based on expected size.
        event.dataTransfer.setDragImage(dragImage, 10, 10); // e.g., 10px offset from cursor

        // Style the original element being dragged

        // Clean up the appended drag image element after the browser has had a chance to capture it
        setTimeout(() => {
          document.body.removeChild(dragImage);
        }, 0);
      } else {
        event.preventDefault(); // Prevent dragging for non-object properties
      }
    };

    const handleDragOver = (
      event: React.DragEvent<HTMLDivElement>,
      targetPropName: string,
      targetParentPath: string,
    ) => {
      event.preventDefault();
      const sourcePropName = draggedItemKeyRef.current;

      if (
        draggedItemParentPathRef.current === targetParentPath &&
        sourcePropName &&
        sourcePropName !== targetPropName
      ) {
        event.dataTransfer.dropEffect = "move";

        // Clear any previous border indicators from the current target
        event.currentTarget.classList.remove("border-l-2", "border-r-2");

        // Determine parent schema to get property order
        let parentNode: JSONSchema7 | undefined;
        if (targetParentPath === "") {
          // Root properties
          parentNode = resolveSchema(schema, schema);
        } else {
          parentNode = resolveSchema(
            getSchemaPropertyType(schema, targetParentPath),
            schema,
          );
        }

        if (
          parentNode &&
          parentNode.type === "object" &&
          parentNode.properties
        ) {
          const propKeys = Object.keys(parentNode.properties);
          const sourceIndex = propKeys.indexOf(sourcePropName);
          const targetIndex = propKeys.indexOf(targetPropName);

          if (sourceIndex !== -1 && targetIndex !== -1) {
            // If source is to the left of target, indicate drag from left
            if (sourceIndex < targetIndex) {
              event.currentTarget.classList.add("border-r-2", "border-r-black");
            } else {
              // Source is to the right of target, indicate drag from right
              event.currentTarget.classList.add("border-l-2", "border-l-black");
            }
          }
        }
      }
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
      event.currentTarget.classList.remove(
        "border-l-2",
        "border-r-2",
        "border-r-black",
        "border-l-black",
      );
    };

    const handleDrop = (
      event: React.DragEvent<HTMLDivElement>,
      targetPropName: string,
      targetParentPath: string,
    ) => {
      event.preventDefault();
      event.currentTarget.classList.remove(
        "border-l-2",
        "border-r-2",
        "border-r-black",
        "border-l-black",
      );

      const sourcePropName = draggedItemKeyRef.current;
      const sourceParentPath = draggedItemParentPathRef.current;

      if (
        sourcePropName &&
        sourceParentPath === targetParentPath &&
        sourcePropName !== targetPropName
      ) {
        reorderPropertiesInSchema(
          schema,
          targetParentPath,
          sourcePropName,
          targetPropName,
          setSchema,
        );
      }
      draggedItemKeyRef.current = null;
      draggedItemParentPathRef.current = null;
    };

    //Old purple color: bg-[#EEDFFF]

    const handleDragEnd = (_event: React.DragEvent<HTMLDivElement>) => {
      // Reset refs just in case drop didn't fire properly
      draggedItemKeyRef.current = null;
      draggedItemParentPathRef.current = null;
    };

    return topProperties.flatMap((topProp) => {
      const newProps = properties.filter(({ key }) =>
        keyStartsWith(key, topProp),
      );
      const key = newProps[0].key
        .split(".")
        .slice(0, depth + 1)
        .join(".");

      // --- START FIX ---
      // Get the raw schema definition, which may include nullable types.
      const rawType = getSchemaPropertyTypeRaw(schema, key);
      // Now, unwrap it here to correctly get both the clean type and its nullability.
      const { schema: type, nullable: _isOptional } = unwrapSchema(
        rawType,
        schema,
      );
      // --- END FIX ---

      const effectiveType = getEffectiveType(type as ExtendedJSONSchema7);
      const isObject = isObjectProperty(type as JSONSchema7Definition, schema);
      const IconComponent = getIconFromEffectiveType(effectiveType.type);

      // Get children columns
      const children = buildColumns(newProps, depth + 1);

      // Handle arrays: Create a header like objects, allowing folding of children
      if (effectiveType.type === "array") {
        const shouldShowChildren = !stopAt.some((s) => key.startsWith(s));
        const nextColumns = shouldShowChildren
          ? children.length > 0
            ? [...children]
            : [
                {
                  accessorKey: key + ".*",
                  header: ({
                    column: _column,
                  }: {
                    column: HeaderColumnApi;
                  }) => {
                    const headerWidth = getColumnWidthPx(columnWidth) - 20;
                    // Determine the array item type to show its icon in the placeholder header
                    let ItemIconComponent = Type as React.ComponentType<{
                      className?: string;
                    }>;
                    try {
                      if (type && (type as JSONSchema7).type === "array") {
                        const itemsSchema = (type as JSONSchema7).items as any;
                        if (itemsSchema) {
                          const unwrappedItems = unwrapSchema(
                            itemsSchema,
                            schema,
                          ).schema as JSONSchema7;
                          const itemEffectiveType = getEffectiveType(
                            unwrappedItems as unknown as ExtendedJSONSchema7,
                          );
                          ItemIconComponent = getIconFromEffectiveType(
                            itemEffectiveType.type,
                          );
                        }
                      }
                    } catch {
                      // Fallback to default icon if anything goes wrong
                      ItemIconComponent = Type as React.ComponentType<{
                        className?: string;
                      }>;
                    }
                    return (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="grow justify-start rounded-none px-1"
                      >
                        <div
                          className="text-3xs flex flex-row items-center gap-2 truncate overflow-hidden"
                          style={{
                            maxWidth: `${headerWidth}px`,
                            minWidth: `${headerWidth}px`,
                          }}
                        >
                          <ItemIconComponent className="h-3! w-3!" />
                          Value
                        </div>
                      </Button>
                    );
                  },
                },
              ]
          : [];
        // Show fold/unfold if there are children columns derived from array items
        const showFoldUnfoldButton = children.length > 0;

        return {
          accessorKey: key,
          foldable: showFoldUnfoldButton,
          ...(nextColumns.length > 0 ? { columns: nextColumns } : {}),
          header: ({ column }: { column: HeaderColumnApi }) => {
            const HeaderContent = () => {
              const [dropdownOpen, setDropdownOpen] = useState(false);
              const lastKeySegment =
                key.toString().split(".")?.pop() || key.toString();
              const currentPropName = lastKeySegment;
              const pathSegments = key.toString().split(".");
              pathSegments.pop(); // Remove the current property name
              const currentParentPath = pathSegments.join(".");
              const displayName = FormatHeaderName(lastKeySegment);
              const leafCount = column.getLeafColumns().length || 1;
              // Calculate width based on children shown, adjust for fold button
              const headerWidth =
                getColumnWidthPx(columnWidth) *
                  (shouldShowChildren ? leafCount : 1) -
                (showFoldUnfoldButton ? 44 : 20);
              const parentSchema = currentParentPath
                ? getSchemaPropertyType(schema, currentParentPath)
                : schema;
              const isDraggable =
                !disableHeaderInteractions &&
                parentSchema &&
                parentSchema.type === "object";

              // Check if this field has reasoning
              const hasReasoning =
                hasReasoningField(rawType as ExtendedJSONSchema7) ||
                hasReasoningField(type as ExtendedJSONSchema7) ||
                isReasoningFieldName(key);

              // Check if this field is computed
              const isComputed =
                isComputedField(rawType as ExtendedJSONSchema7) ||
                isComputedField(type as ExtendedJSONSchema7);

              // Check if this field is a function field
              const isFunction =
                isFunctionField(rawType as ExtendedJSONSchema7) ||
                isFunctionField(type as ExtendedJSONSchema7);

              // Check if this field is a review-based criterion
              const isReviewBasedCriterion =
                isReviewCriterion(rawType as ExtendedJSONSchema7) ||
                isReviewCriterion(type as ExtendedJSONSchema7);

              return (
                <div
                  className="group flex h-full w-full"
                  draggable={isDraggable} // Make draggable only if its parent is an object
                  onDragStart={(e) =>
                    isDraggable &&
                    handleDragStart(e, currentPropName, currentParentPath)
                  }
                  onDragOver={(e) =>
                    isDraggable &&
                    handleDragOver(e, currentPropName, currentParentPath)
                  }
                  onDragLeave={(e) => isDraggable && handleDragLeave(e)}
                  onDrop={(e) =>
                    isDraggable &&
                    handleDrop(e, currentPropName, currentParentPath)
                  }
                  onDragEnd={(e) => isDraggable && handleDragEnd(e)}
                >
                  {disableHeaderInteractions ? (
                    <div
                      className={`flex h-full grow items-center justify-start rounded-none px-1 ${
                        isReviewBasedCriterion
                          ? "bg-success/10 text-success-foreground"
                          : isComputed
                            ? "bg-primary/10 text-primary"
                            : hasReasoning
                              ? "bg-primary/10 text-primary"
                              : `${theme.headerText} ${theme.headerBg}`
                      }`}
                    >
                      <div
                        className="text-3xs flex flex-row items-center gap-2 truncate overflow-hidden"
                        style={{
                          maxWidth: `${headerWidth}px`,
                          minWidth: `${headerWidth}px`,
                        }}
                      >
                        <IconComponent className="h-3! w-3!" /> {displayName}
                      </div>
                    </div>
                  ) : (
                    <PopoverDialog
                      open={dropdownOpen}
                      onOpenChange={setDropdownOpen}
                    >
                      <PopoverDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-full grow justify-start rounded-none px-1 ${
                            isReviewBasedCriterion
                              ? "bg-success/10 text-success-foreground hover:bg-success/20 hover:text-success-foreground"
                              : isComputed
                                ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                : hasReasoning
                                  ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                  : `${theme.headerText} ${theme.headerBg}`
                          }`}
                        >
                          <div
                            className="text-3xs flex flex-row items-center gap-2 truncate overflow-hidden"
                            style={{
                              maxWidth: `${headerWidth}px`,
                              minWidth: `${headerWidth}px`,
                            }}
                          >
                            <IconComponent className="h-3! w-3!" />{" "}
                            {/* Array Icon */}
                            {displayName}
                          </div>
                        </Button>
                      </PopoverDialogTrigger>
                      <PopoverDialogContent
                        className="flex max-h-[80vh] w-[400px] flex-col overflow-y-auto p-0"
                        align="start"
                      >
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-1">
                            <PopoverDialogTitle className="leading-none font-medium">
                              {displayName}
                              {/* Optional check - depends if array itself can be required */}
                              {/* {!isOptional && <span className="text-destructive ml-1">*</span>} */}
                            </PopoverDialogTitle>
                          </div>
                          {!is_published && editMode !== "readOnly" && (
                            <Button
                              tabIndex={-1}
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to delete the property "${key}"? This action cannot be undone.`,
                                  )
                                ) {
                                  const updatedSchema = deletePropertyInSchema(
                                    schema,
                                    key,
                                  );
                                  setSchema(updatedSchema);
                                  setDropdownOpen(false);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive hover:text-destructive" />
                            </Button>
                          )}
                        </div>

                        <Separator className="my-0" />

                        {/* Property editor for the array itself */}
                        <PropertyEditor
                          property={rawType}
                          propertyKey={key}
                          setDropdownOpen={setDropdownOpen}
                          jsonSchema={schema}
                          setJsonSchema={setSchema}
                          editMode={
                            isReviewBasedCriterion || isFunction
                              ? "readOnly"
                              : editMode
                          }
                          // Use full dotted path for AI so fields inside $defs via $ref are addressable
                        />
                      </PopoverDialogContent>
                    </PopoverDialog>
                  )}
                  {/* Fold/Unfold button for children */}
                  {showFoldUnfoldButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`flex h-full w-9 items-center justify-center rounded-none ${
                        isReviewBasedCriterion
                          ? "bg-success/10 text-success-foreground hover:bg-success/20 hover:text-success-foreground"
                          : isComputed
                            ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                            : isFunction
                              ? "bg-success/10 text-success-foreground hover:bg-success/20 hover:text-success-foreground"
                              : hasReasoning
                                ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                : `${theme.headerText} ${theme.headerBg}`
                      }`}
                      onClick={() => {
                        if (stopAt.includes(key)) {
                          setStopAt(stopAt.filter((s) => s !== key));
                        } else {
                          setStopAt([...stopAt, key]);
                        }
                      }}
                    >
                      {stopAt.includes(key) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronUp className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              );
            };
            return <HeaderContent />;
          },
        };
      }

      // For objects, we create a header with fold/unfold capability
      const shouldShowChildren = !stopAt.some((s) => key.startsWith(s));
      const nextColumns = shouldShowChildren ? children : [];
      const showFoldUnfold = isObject && children.length > 0;

      return {
        accessorKey: key,
        foldable: showFoldUnfold,
        ...(nextColumns.length > 0 ? { columns: nextColumns } : undefined),
        header: ({ column }: { column: HeaderColumnApi }) => {
          const HeaderContent = () => {
            const [dropdownOpen, setDropdownOpen] = useState(false);
            const lastKeySegment =
              key.toString().split(".")?.pop() || key.toString();
            const currentPropName = lastKeySegment;
            const pathSegments = key.toString().split(".");
            pathSegments.pop(); // Remove the current property name
            const currentParentPath = pathSegments.join(".");
            const displayName = FormatHeaderName(lastKeySegment);
            const leafCount = column.getLeafColumns().length || 1;
            const headerWidth =
              getColumnWidthPx(columnWidth) *
                (shouldShowChildren ? leafCount : 1) -
              (showFoldUnfold ? 44 : 20);
            const parentSchema = currentParentPath
              ? getSchemaPropertyType(schema, currentParentPath)
              : schema;
            const isDraggable =
              !disableHeaderInteractions &&
              parentSchema &&
              parentSchema.type === "object";

            // Check if this field has reasoning
            const hasReasoning =
              hasReasoningField(rawType as ExtendedJSONSchema7) ||
              hasReasoningField(type as ExtendedJSONSchema7) ||
              isReasoningFieldName(key);

            // Check if this field is computed
            const isComputed =
              isComputedField(rawType as ExtendedJSONSchema7) ||
              isComputedField(type as ExtendedJSONSchema7);

            // Check if this field is a function field
            const isFunction =
              isFunctionField(rawType as ExtendedJSONSchema7) ||
              isFunctionField(type as ExtendedJSONSchema7);

            // Check if this field is a review-based criterion
            const isReviewBasedCriterion =
              isReviewCriterion(rawType as ExtendedJSONSchema7) ||
              isReviewCriterion(type as ExtendedJSONSchema7);

            return (
              <div
                className="group flex h-full w-full"
                draggable={isDraggable} // Make draggable only if its parent is an object
                onDragStart={(e) =>
                  isDraggable &&
                  handleDragStart(e, currentPropName, currentParentPath)
                }
                onDragOver={(e) =>
                  isDraggable &&
                  handleDragOver(e, currentPropName, currentParentPath)
                }
                onDragLeave={(e) => isDraggable && handleDragLeave(e)}
                onDrop={(e) =>
                  isDraggable &&
                  handleDrop(e, currentPropName, currentParentPath)
                }
                onDragEnd={(e) => isDraggable && handleDragEnd(e)}
              >
                {disableHeaderInteractions ? (
                  <div
                    className={`flex h-full grow items-center justify-start rounded-none px-1 ${
                      isReviewBasedCriterion
                        ? "bg-success/10 text-success-foreground"
                        : isComputed
                          ? "bg-primary/10 text-primary"
                          : hasReasoning
                            ? "bg-primary/10 text-primary"
                            : isFunction
                              ? "bg-success/10 text-success-foreground"
                              : `${theme.headerText} ${theme.headerBg}`
                    }`}
                  >
                    <div
                      className="text-3xs flex flex-row items-center gap-2 truncate overflow-hidden"
                      style={{
                        maxWidth: `${headerWidth}px`,
                        minWidth: `${headerWidth}px`,
                      }}
                    >
                      <IconComponent className="h-3! w-3!" />
                      {displayName}
                    </div>
                  </div>
                ) : (
                  <PopoverDialog
                    open={dropdownOpen}
                    onOpenChange={setDropdownOpen}
                  >
                    <PopoverDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-full grow justify-start rounded-none px-1 ${
                          isReviewBasedCriterion
                            ? "bg-success/10 text-success-foreground hover:bg-success/20 hover:text-success-foreground"
                            : isComputed
                              ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                              : hasReasoning
                                ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                : isFunction
                                  ? "bg-success/10 text-success-foreground hover:bg-success/20 hover:text-success-foreground"
                                  : `${theme.headerText} ${theme.headerBg}`
                        }`}
                      >
                        <div
                          className="text-3xs flex flex-row items-center gap-2 truncate overflow-hidden"
                          style={{
                            maxWidth: `${headerWidth}px`,
                            minWidth: `${headerWidth}px`,
                          }}
                        >
                          <IconComponent className="h-3! w-3!" />
                          {displayName}
                        </div>
                      </Button>
                    </PopoverDialogTrigger>
                    <PopoverDialogContent
                      className="flex max-h-[80vh] w-[400px] flex-col gap-0 overflow-y-auto p-0"
                      align="start"
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center">
                          <PopoverDialogTitle className="flex items-center justify-center leading-none font-medium">
                            {displayName}
                          </PopoverDialogTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {!is_published && editMode !== "readOnly" && (
                            <Button
                              tabIndex={-1}
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                // First, show a confirmation dialog
                                if (
                                  confirm(
                                    `Are you sure you want to delete the property "${key}"? This action cannot be undone.`,
                                  )
                                ) {
                                  const updatedSchema = deletePropertyInSchema(
                                    schema,
                                    key,
                                  );
                                  setSchema(updatedSchema);

                                  // Close the dropdown
                                  setDropdownOpen(false);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Property editor */}
                      <PropertyEditor
                        property={rawType}
                        propertyKey={key}
                        setDropdownOpen={setDropdownOpen}
                        jsonSchema={schema}
                        setJsonSchema={setSchema}
                        editMode={
                          isReviewBasedCriterion || isFunction
                            ? "readOnly"
                            : editMode
                        }
                      />
                    </PopoverDialogContent>
                  </PopoverDialog>
                )}
                {showFoldUnfold && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-full w-6 rounded-none ${
                      isReviewBasedCriterion
                        ? "bg-success/10 text-success-foreground hover:bg-success/20 hover:text-success-foreground"
                        : isComputed
                          ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                          : isFunction
                            ? "bg-success/10 text-success-foreground hover:bg-success/20 hover:text-success-foreground"
                            : hasReasoning
                              ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                              : `${theme.headerText} ${theme.headerBg}`
                    }`}
                    onClick={() => {
                      if (stopAt.includes(key)) {
                        setStopAt(stopAt.filter((s) => s !== key));
                      } else {
                        setStopAt([...stopAt, key]);
                      }
                    }}
                  >
                    {stopAt.includes(key) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronUp className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            );
          };

          return <HeaderContent />;
        },
      };
    });
  }

  return [
    (() => {
      try {
        const flat = getSchemaFlatProperties(schema, [], schema);
        return buildColumns(flat, 0);
      } catch (e) {
        console.error("[ColumnsFromSchema] Failed to flatten schema:", e);
        // Fallback: no columns rather than crashing the view
        return [] as TableColumn[];
      }
    })(),
    maxDepth,
  ];
}
