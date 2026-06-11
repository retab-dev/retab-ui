import React, { useContext, useState } from "react"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"
import {
  Box,
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Hash,
  List,
  Table,
  Trash2,
  Type,
} from "lucide-react"

import { useMountEffect } from "@/hooks/useMountEffect"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { ExtendedJSONSchema7 } from "@/components/json-table/lib/json-schema-types"
import { isObjectProperty } from "@/components/json-table/lib/json-schema-utils"
import { getColumnWidthPx } from "@/components/json-table/table-options-store"
import type { ColumnWidth } from "@/components/json-table/table-options-store"
import { JsonSchemaEditorProvider } from "@/components/schema-editor/contexts/json-schema"
import { getEffectiveType } from "@/components/schema-editor/json-schema-builder"
import { PropertyEditor } from "@/components/schema-editor/property-dialog"
import { Button } from "@/components/ui-retab/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-retab/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover"
import { Separator } from "@/components/ui-retab/separator"

const PopoverDialogContext = React.createContext<boolean>(false)
const PopoverDialog = ({
  isDialog,
  ...props
}: {
  isDialog?: boolean
} & React.ComponentProps<typeof Popover>) => {
  // Always start `false` (the server value) to avoid an SSR/client hydration
  // mismatch; the mount effect below re-measures immediately after hydration.
  const [isBigEnough, setIsBigEnough] = useState<boolean>(false)

  useMountEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let lastRun = 0

    const measureAndUpdate = () => {
      const next = window.innerHeight >= 900
      setIsBigEnough((prev) => (prev !== next ? next : prev))
    }

    const handleResize = () => {
      const now = Date.now()
      const remaining = 1000 - (now - lastRun)
      if (remaining <= 0) {
        lastRun = now
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        measureAndUpdate()
      } else {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          lastRun = Date.now()
          measureAndUpdate()
          timeoutId = null
        }, remaining)
      }
    }

    // Initial measure
    measureAndUpdate()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      if (timeoutId) clearTimeout(timeoutId)
    }
  })

  const actualIsDialog = isDialog === undefined ? !isBigEnough : isDialog

  return (
    <PopoverDialogContext.Provider value={actualIsDialog}>
      {actualIsDialog ? (
        <Dialog {...props} />
      ) : (
        <Popover {...props} modal={true} />
      )}
    </PopoverDialogContext.Provider>
  )
}
const PopoverDialogTrigger = ({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) => {
  const context = useContext(PopoverDialogContext)
  return context ? <DialogTrigger {...props} /> : <PopoverTrigger {...props} />
}

const PopoverDialogContent = ({
  ...props
}: React.ComponentProps<typeof PopoverContent>) => {
  const context = useContext(PopoverDialogContext)
  return context ? (
    <DialogContent showCloseButton={false} {...props} />
  ) : (
    <PopoverContent {...props} />
  )
}

// Conditional title component that uses DialogTitle when in dialog context
const PopoverDialogTitle = ({
  className,
  children,
  ...props
}: React.ComponentProps<"h4">) => {
  const context = useContext(PopoverDialogContext)

  if (context) {
    return (
      <DialogTitle className={className} {...props}>
        {children}
      </DialogTitle>
    )
  }

  return (
    <h4 className={className} {...props}>
      {children}
    </h4>
  )
}

const headerLabelClass =
  "flex min-w-0 flex-row items-center gap-2 overflow-hidden truncate text-xs leading-none"

type SchemaRecord = JSONSchema7 & {
  [key: string]: unknown
  $defs?: Record<string, JSONSchema7Definition>
}

type SchemaWithCombinations = JSONSchema7 & {
  anyOf?: JSONSchema7Definition[]
  oneOf?: JSONSchema7Definition[]
  allOf?: JSONSchema7Definition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

const getIconFromEffectiveType = (
  type: string
): React.ComponentType<{ className?: string }> => {
  switch (type) {
    case "string":
      return Type
    case "boolean":
      return CheckSquare
    case "number":
    case "integer":
      return Hash
    case "object":
      return Box
    case "array":
      return Table
    case "date":
      return Calendar
    case "time":
      return Clock
    case "datetime":
      return CalendarClock
    case "enum":
      return List
    case "$ref":
      return Box
    default:
      return Type
  }
}

function renderIconFromEffectiveType(type: string) {
  const Icon = getIconFromEffectiveType(type)
  return <Icon className="size-3" />
}

function resolveSchema(
  schemaDef: JSONSchema7Definition | null | undefined,
  context: JSONSchema7
): JSONSchema7 {
  if (schemaDef == null || typeof schemaDef !== "object") {
    return context as JSONSchema7
  }
  let current = schemaDef as JSONSchema7
  while (current.$ref && typeof current.$ref === "string") {
    const refPath = current.$ref
    const segments = refPath.split("/")
    if (segments[0] !== "#") {
      throw new Error("Only internal references are supported")
    }
    let next: unknown = context
    for (let i = 1; i < segments.length; i++) {
      if (!isRecord(next)) {
        console.warn(
          `[resolveSchema] Could not resolve $ref "${refPath}": path segment "${segments[i]}" not found at index ${i}`
        )
        return { type: "object" }
      }
      next = next[segments[i]]
    }
    if (!isRecord(next)) {
      console.warn(
        `[resolveSchema] Could not resolve $ref "${refPath}": target is null or not an object`
      )
      return { type: "object" }
    }
    current = next as JSONSchema7
  }
  return current
}

export function unwrapSchema(
  schemaDef: JSONSchema7Definition | undefined,
  root: JSONSchema7
): { schema: JSONSchema7; nullable: boolean } {
  // First resolve $ref
  let s = resolveSchema(schemaDef, root)
  let nullable = false

  // type: ['object','null'] / ['array','null'] / etc.
  if (Array.isArray(s?.type)) {
    if (s.type.includes("null")) {
      nullable = true
      s = { ...s, type: s.type.find((t) => t !== "null") }
    }
  }

  // anyOf / oneOf / allOf that include null
  const schemaWithCombinations = s as SchemaWithCombinations
  const combos =
    schemaWithCombinations.anyOf ||
    schemaWithCombinations.oneOf ||
    schemaWithCombinations.allOf
  if (Array.isArray(combos) && combos.length) {
    if (
      combos.some(
        (option) =>
          typeof option === "object" &&
          option !== null &&
          (option as JSONSchema7).type === "null"
      )
    ) {
      nullable = true
    }
    // Pick the "effective" non-null branch (object/array/enum/etc.)
    const nonNull = combos.find((option) => {
      const r = resolveSchema(option, root)
      const t = Array.isArray(r?.type)
        ? r.type.find((t) => t !== "null")
        : r?.type
      return t !== "null" && (t || r.properties || r.items || r.enum)
    })
    if (nonNull) {
      const resolved = resolveSchema(nonNull, root) as JSONSchema7
      // Drop combination keywords; we selected a branch already
      const {
        anyOf: _anyOf,
        oneOf: _oneOf,
        allOf: _allOf,
        ...rest
      } = resolved as SchemaWithCombinations
      s = rest as JSONSchema7
    }
  }

  return { schema: s, nullable }
}

export function getSchemaFlatProperties(
  schema: JSONSchema7Definition,
  path: string[],
  context: JSONSchema7,
  opts?: {
    seen?: WeakSet<object>
    depth?: number
    maxDepth?: number
  }
): { key: string; type: JSONSchema7 }[] {
  const seen = opts?.seen ?? new WeakSet<object>()
  const depth = opts?.depth ?? 0
  const maxDepth = opts?.maxDepth ?? 64 // hard guard to avoid runaway recursion even without cycles

  let s = resolveSchema(schema, context) as JSONSchema7
  s = unwrapSchema(s as JSONSchema7, context as JSONSchema7)
    .schema as JSONSchema7

  // Depth guard
  if (depth > maxDepth) {
    console.warn(
      "[getSchemaFlatProperties] Max depth reached while flattening schema at path:",
      path.join(".")
    )
    return [{ key: path.join("."), type: s as JSONSchema7 }]
  }

  // Cycle guard - uses stack-based tracking to detect true cycles
  // We add the object before recursing and remove it after, so that
  // the same $defs object can be correctly expanded when accessed from different paths
  let addedToSeen = false
  if (s && typeof s === "object") {
    if (seen.has(s as object)) {
      console.warn(
        "[getSchemaFlatProperties] Circular schema reference detected at path:",
        path.join(".")
      )
      // Return a terminal node to avoid infinite recursion; mark as object leaf
      return [
        {
          key: path.join("."),
          type: {
            ...(s || {}),
            type: s.type ?? "object",
            title: s.title || "(circular)",
          } as JSONSchema7,
        },
      ]
    }
    seen.add(s as object)
    addedToSeen = true
  }

  let result: { key: string; type: JSONSchema7 }[]

  if (s.type === "array") {
    if (s.items) {
      if (Array.isArray(s.items)) {
        result = s.items.flatMap((item, i) =>
          getSchemaFlatProperties(item, [...path, String(i)], context, {
            seen,
            depth: depth + 1,
            maxDepth,
          })
        )
      } else if (typeof s.items === "object") {
        const itemUnwrapped = unwrapSchema(s.items, context as JSONSchema7)
          .schema as JSONSchema7
        result = getSchemaFlatProperties(
          itemUnwrapped,
          [...path, "*"],
          context,
          {
            seen,
            depth: depth + 1,
            maxDepth,
          }
        )
      } else {
        result = [{ key: path.join("."), type: s as JSONSchema7 }]
      }
    } else {
      result = [{ key: path.join("."), type: s as JSONSchema7 }]
    }
  } else if (s.type === "object") {
    if (s.properties) {
      result = Object.entries(s.properties).flatMap(([key, value]) =>
        getSchemaFlatProperties(value, [...path, key], context, {
          seen,
          depth: depth + 1,
          maxDepth,
        })
      )
    } else {
      result = [{ key: path.join("."), type: s as JSONSchema7 }]
    }
  } else {
    result = [{ key: path.join("."), type: s as JSONSchema7 }]
  }

  // Remove from seen after processing to allow the same $defs object
  // to be correctly expanded when accessed from different paths
  if (addedToSeen && s && typeof s === "object") {
    seen.delete(s as object)
  }

  return result
}

export function getSchemaPropertyType(
  schema: JSONSchema7,
  key: string
): JSONSchema7 {
  const topSchema = schema
  if (key === "") return schema
  const path = key.split(".")
  for (let i = 0; i < path.length; i++) {
    // Resolve $ref first, then unwrap ONLY for traversal decisions so optional objects work
    const resolvedForTraversal = resolveSchema(schema, topSchema)
    const traversal = unwrapSchema(
      resolvedForTraversal as JSONSchema7,
      topSchema
    ).schema as JSONSchema7

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[path[i]] as JSONSchema7
    } else if (traversal.type === "array") {
      if (traversal.items) {
        if (Array.isArray(traversal.items)) {
          schema = traversal.items[parseInt(path[i])] as JSONSchema7
        } else if (typeof traversal.items === "object") {
          if (path[i] === "*" || !isNaN(parseInt(path[i]))) {
            schema = traversal.items as JSONSchema7
          }
        }
      }
    }
  }
  schema = resolveSchema(schema, topSchema)

  return schema
}

// Returns the schema at path without resolving the final node, preserving $ref when present.
export function getSchemaPropertyTypeRaw(
  schema: JSONSchema7,
  key: string
): JSONSchema7Definition {
  const topSchema = schema
  if (key === "") return schema
  const path = key.split(".")
  for (let i = 0; i < path.length; i++) {
    const resolvedForTraversal = resolveSchema(schema, topSchema)
    const traversal = unwrapSchema(
      resolvedForTraversal as JSONSchema7,
      topSchema
    ).schema as JSONSchema7

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[path[i]] as JSONSchema7
    } else if (traversal.type === "array") {
      if (traversal.items) {
        if (Array.isArray(traversal.items)) {
          schema = traversal.items[parseInt(path[i])] as JSONSchema7
        } else if (typeof traversal.items === "object") {
          if (path[i] === "*" || !isNaN(parseInt(path[i]))) {
            schema = traversal.items as JSONSchema7
          }
        }
      }
    }
  }
  // Do NOT resolve here; preserve $ref on the final node
  return schema as JSONSchema7Definition
}

export const FormatHeaderName = (name: string) => {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function getTopProperties(
  depth: number,
  properties: { key: string }[]
): string[] {
  const topProperties = properties.reduce((acc: string[], { key }) => {
    const firstProp = key.split(".")[depth]
    if (firstProp && !acc.includes(firstProp)) {
      acc.push(firstProp)
    }
    return acc
  }, [])
  if (topProperties.includes("*") && topProperties.length !== 1) {
    throw new Error("Invalid schema for array")
  }
  return topProperties
}

function reorderPropertiesInSchema(
  currentSchema: ExtendedJSONSchema7,
  parentObjectPath: string, // Path to the parent object. Empty for root.
  sourcePropName: string,
  targetPropName: string,
  setSchemaCallback: (schema: ExtendedJSONSchema7) => void
): void {
  const schemaCopy = JSON.parse(
    JSON.stringify(currentSchema)
  ) as ExtendedJSONSchema7

  let parentNode: ExtendedJSONSchema7 | undefined
  let targetPropertiesObject: Record<string, JSONSchema7Definition> | undefined

  if (!parentObjectPath) {
    // Root properties
    parentNode = schemaCopy
    if (parentNode.type === "object" && parentNode.properties) {
      targetPropertiesObject = parentNode.properties
    }
  } else {
    const segments = parentObjectPath.split(".")
    let currentNode: JSONSchema7Definition | Record<string, unknown> =
      schemaCopy
    for (const segment of segments) {
      // Resolve $refs using the schemaCopy as the context
      const resolvedCurrentNode = resolveSchema(
        currentNode as JSONSchema7Definition,
        schemaCopy
      )
      if (!resolvedCurrentNode || typeof resolvedCurrentNode !== "object") {
        console.error(
          `Could not resolve current node at segment: ${segment} in ${parentObjectPath}`
        )
        return
      }
      currentNode = resolvedCurrentNode
      const currentSchemaRecord = currentNode as SchemaRecord

      if (segment === "$defs" && currentSchemaRecord.$defs) {
        // Handle $defs segment
        // This case should ideally not be hit if parentObjectPath is for data properties
        console.warn("Navigating through $defs, ensure path is correct.")
        currentNode = currentSchemaRecord.$defs // Move into $defs
        continue // Continue to next segment which would be the def name
      }

      if (
        currentSchemaRecord.type === "object" &&
        currentSchemaRecord.properties &&
        currentSchemaRecord.properties[segment]
      ) {
        currentNode = currentSchemaRecord.properties[segment]
      } else if (
        currentSchemaRecord.type === "array" &&
        segment === "*" &&
        currentSchemaRecord.items &&
        typeof currentSchemaRecord.items === "object" &&
        !Array.isArray(currentSchemaRecord.items)
      ) {
        // This case is for when parentObjectPath points to an object schema within an array's items
        currentNode = currentSchemaRecord.items
      } else if (isRecord(currentNode) && isRecord(currentNode[segment])) {
        // General case for $defs
        currentNode = currentNode[segment]
      } else {
        console.error(
          `Could not find path: ${parentObjectPath} in schema. Segment: ${segment}, Current Node:`,
          JSON.parse(JSON.stringify(currentNode))
        )
        return
      }
    }
    // After iterating, currentNode should be the parent object definition
    // If currentNode is a $ref, we need to navigate to the actual definition
    let actualNode = currentNode
    if (isRecord(currentNode) && typeof currentNode.$ref === "string") {
      // Navigate to the $ref target in schemaCopy
      const refPath = currentNode.$ref
      const refSegments = refPath.split("/")
      if (refSegments[0] === "#") {
        let refTarget: unknown = schemaCopy
        for (let i = 1; i < refSegments.length; i++) {
          refTarget = isRecord(refTarget)
            ? refTarget[refSegments[i]]
            : undefined
        }
        if (isRecord(refTarget)) {
          actualNode = refTarget as JSONSchema7
        }
      }
    }

    parentNode = actualNode as ExtendedJSONSchema7

    // Validate it's an object with properties
    if (parentNode && parentNode.type === "object") {
      // Use the ACTUAL node's properties (or create if doesn't exist yet)
      if (!parentNode.properties) {
        parentNode.properties = {}
      }
      targetPropertiesObject = parentNode.properties
    }
  }

  if (!parentNode || !targetPropertiesObject) {
    console.error(
      "Node for reordering is not an object with properties or path is invalid. Path:",
      parentObjectPath,
      "Parent Node:",
      parentNode
    )
    return
  }

  const currentProperties = targetPropertiesObject
  const keys = Object.keys(currentProperties)

  const sourceIndex = keys.indexOf(sourcePropName)
  const targetIndex = keys.indexOf(targetPropName)

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    console.warn("Reorder failed: Invalid property names or indices.", {
      sourcePropName,
      targetPropName,
      keys,
    })
    return
  }

  const reorderedKeys = Array.from(keys)
  const [movedItemKey] = reorderedKeys.splice(sourceIndex, 1)
  reorderedKeys.splice(targetIndex, 0, movedItemKey)

  const newProperties: Record<string, JSONSchema7Definition> = {}
  reorderedKeys.forEach((key) => {
    newProperties[key] = currentProperties[key]
  })

  parentNode.properties = newProperties

  setSchemaCallback(schemaCopy)
}

// Delete a property anywhere in the schema using a dotted path (supports '*' for array items)
function deletePropertyInSchema(
  currentSchema: ExtendedJSONSchema7,
  fullPropPath: string
): ExtendedJSONSchema7 {
  const schemaCopy = JSON.parse(
    JSON.stringify(currentSchema)
  ) as ExtendedJSONSchema7
  if (!fullPropPath) return schemaCopy

  const pathSegments = fullPropPath.split(".")
  const propertyName = pathSegments.pop() as string
  const parentPathSegments = pathSegments

  let currentNode: JSONSchema7Definition | Record<string, unknown> = schemaCopy
  if (parentPathSegments.length > 0) {
    for (const segment of parentPathSegments) {
      const resolvedCurrentNode = resolveSchema(
        currentNode as JSONSchema7Definition,
        schemaCopy
      )
      const currentSchemaRecord = currentNode as SchemaRecord

      if (
        resolvedCurrentNode &&
        typeof resolvedCurrentNode === "object" &&
        resolvedCurrentNode.type === "object" &&
        resolvedCurrentNode.properties &&
        resolvedCurrentNode.properties[segment]
      ) {
        // Prefer moving via the actual node if possible, otherwise fallback to resolved
        if (currentSchemaRecord.properties) {
          currentNode = currentSchemaRecord.properties[segment]
        } else {
          currentNode = resolvedCurrentNode.properties[segment]
        }
      } else if (
        resolvedCurrentNode &&
        typeof resolvedCurrentNode === "object" &&
        resolvedCurrentNode.type === "array" &&
        (segment === "*" || !isNaN(parseInt(segment))) &&
        resolvedCurrentNode.items &&
        typeof resolvedCurrentNode.items === "object"
      ) {
        if (currentSchemaRecord.items) {
          currentNode = currentSchemaRecord.items as JSONSchema7Definition
        } else {
          currentNode = resolvedCurrentNode.items as JSONSchema7Definition
        }
      } else if (isRecord(currentNode) && isRecord(currentNode[segment])) {
        // Generic object navigation (e.g., $defs)
        currentNode = currentNode[segment]
      } else {
        // Path invalid; return original copy
        return schemaCopy
      }
    }
  }

  const parentNode = resolveSchema(
    currentNode as JSONSchema7Definition,
    schemaCopy
  ) as ExtendedJSONSchema7

  if (!parentNode || parentNode.type !== "object" || !parentNode.properties) {
    return schemaCopy
  }

  // Delete the property
  if (parentNode.properties[propertyName] !== undefined) {
    delete parentNode.properties[propertyName]
  }

  // Update the required array on the same parent node
  if (Array.isArray(parentNode.required)) {
    parentNode.required = parentNode.required.filter(
      (req: string) => req !== propertyName
    )
    if (parentNode.required.length === 0) {
      delete parentNode.required
    }
  }

  return schemaCopy
}

export function buildHeaderNodesFromSchema(
  schema: JSONSchema7,
  stopAt: string[]
): [JsonTableHeaderNode[], number] {
  let maxDepth = 0
  if (!schema.properties || Object.keys(schema.properties).length === 0)
    return [[], 0]

  function buildNodes(
    properties: { key: string }[],
    depth: number
  ): JsonTableHeaderNode[] {
    function keyStartsWith(key: string, prop: string) {
      return key.split(".")[depth] === prop
    }

    if (properties.length === 0) return []
    const topProperties = getTopProperties(depth, properties)
    // Skip the * property - it represents array items and should be merged with its parent
    if (topProperties.length === 1 && topProperties[0] === "*") {
      const nextDepth = depth + 1
      maxDepth = Math.max(maxDepth, nextDepth)
      const childProps = properties.map((p) => ({ key: p.key }))
      const levelTwoProperties = getTopProperties(nextDepth, childProps)
      if (!(levelTwoProperties.length === 1 && levelTwoProperties[0] === "*")) {
        return buildNodes(childProps, nextDepth)
      }
    }

    return topProperties.flatMap((topProp) => {
      const newProps = properties.filter(({ key }) =>
        keyStartsWith(key, topProp)
      )
      const key = newProps[0].key
        .split(".")
        .slice(0, depth + 1)
        .join(".")
      const propName = key.toString().split(".")?.pop() || key.toString()
      const parentPath = key.toString().split(".").slice(0, -1).join(".")

      const rawType = getSchemaPropertyTypeRaw(schema, key)
      const { schema: type } = unwrapSchema(rawType, schema)

      const effectiveType = getEffectiveType(type as ExtendedJSONSchema7)
      const isObject = isObjectProperty(type as JSONSchema7Definition, schema)
      const children = buildNodes(newProps, depth + 1)

      if (effectiveType.type === "array") {
        const shouldShowChildren = !stopAt.some((s) => key.startsWith(s))
        let itemSchemaDef = rawType
        let itemSchema = type
        let itemEffectiveType = "string"
        if ((type as JSONSchema7).type === "array") {
          const itemsSchema = (type as JSONSchema7).items as
            | JSONSchema7Definition
            | undefined
          if (itemsSchema) {
            itemSchemaDef = itemsSchema
            itemSchema = unwrapSchema(itemsSchema, schema).schema as JSONSchema7
            itemEffectiveType = getEffectiveType(
              itemSchema as ExtendedJSONSchema7
            ).type
          }
        }

        const nextChildren =
          shouldShowChildren && children.length > 0
            ? children
            : shouldShowChildren
              ? [
                  {
                    key: key + ".*",
                    label: "Value",
                    propName: "*",
                    parentPath: key,
                    rawSchema: itemSchemaDef,
                    schema: itemSchema,
                    effectiveType: itemEffectiveType,
                    itemEffectiveType,
                    isObject: false,
                    isArray: false,
                    canFold: false,
                    isExpanded: false,
                    isArrayValuePlaceholder: true,
                  },
                ]
              : []

        return {
          key,
          label: FormatHeaderName(propName),
          propName,
          parentPath,
          rawSchema: rawType,
          schema: type,
          effectiveType: effectiveType.type,
          itemEffectiveType,
          isObject,
          isArray: true,
          canFold: children.length > 0,
          isExpanded: shouldShowChildren,
          ...(nextChildren.length > 0 ? { children: nextChildren } : {}),
        }
      }

      const shouldShowChildren = !stopAt.some((s) => key.startsWith(s))

      return {
        key,
        label: FormatHeaderName(propName),
        propName,
        parentPath,
        rawSchema: rawType,
        schema: type,
        effectiveType: effectiveType.type,
        isObject,
        isArray: false,
        canFold: isObject && children.length > 0,
        isExpanded: shouldShowChildren,
        ...(shouldShowChildren && children.length > 0
          ? { children }
          : undefined),
      }
    })
  }

  return [
    (() => {
      try {
        const flat = getSchemaFlatProperties(schema, [], schema)
        return buildNodes(flat, 0)
      } catch (e) {
        console.error(
          "[buildHeaderNodesFromSchema] Failed to flatten schema:",
          e
        )
        return [] as JsonTableHeaderNode[]
      }
    })(),
    maxDepth,
  ]
}

interface JsonTableHeaderCellProps {
  node: JsonTableHeaderNode
  leafCount: number
  schema: ExtendedJSONSchema7
  setSchema: (schema: ExtendedJSONSchema7) => void
  stopAt: string[]
  setStopAt: (stopAt: string[]) => void
  columnWidth: ColumnWidth
  isPublished: boolean
  draggedItemKeyRef: React.RefObject<string | null>
  draggedItemParentPathRef: React.RefObject<string | null>
  editMode: "descriptionOnly" | "editable" | "readOnly"
  disableHeaderInteractions?: boolean
}

export function JsonTableHeaderCell({
  node,
  leafCount,
  schema,
  setSchema,
  stopAt,
  setStopAt,
  columnWidth,
  isPublished,
  draggedItemKeyRef,
  draggedItemParentPathRef,
  editMode,
  disableHeaderInteractions = false,
}: JsonTableHeaderCellProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (node.isArrayValuePlaceholder) {
    const headerWidth = getColumnWidthPx(columnWidth) - 20

    return (
      <Button
        variant="ghost"
        size="icon"
        className="grow justify-start rounded-none bg-transparent px-1 text-foreground hover:bg-muted/40"
      >
        <div
          className={headerLabelClass}
          style={{
            maxWidth: `${headerWidth}px`,
            minWidth: `${headerWidth}px`,
          }}
        >
          {renderIconFromEffectiveType(
            node.itemEffectiveType ?? node.effectiveType
          )}
          {node.label}
        </div>
      </Button>
    )
  }

  const headerWidth =
    getColumnWidthPx(columnWidth) * (node.isExpanded ? leafCount : 1) -
    (node.canFold ? 44 : 20)
  const parentSchema = node.parentPath
    ? getSchemaPropertyType(schema, node.parentPath)
    : schema
  const isDraggable =
    !disableHeaderInteractions && parentSchema && parentSchema.type === "object"

  const clearDragClasses = (element: HTMLElement) => {
    element.classList.remove(
      "border-l-2",
      "border-r-2",
      "border-r-primary",
      "border-l-primary"
    )
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggable) {
      event.preventDefault()
      return
    }

    event.dataTransfer.setData("text/plain", node.propName)
    event.dataTransfer.effectAllowed = "move"
    draggedItemKeyRef.current = node.propName
    draggedItemParentPathRef.current = node.parentPath

    const dragImage = document.createElement("div")
    dragImage.textContent = node.label
    dragImage.style.position = "absolute"
    dragImage.style.top = "-1000px"
    dragImage.style.left = "-1000px"
    dragImage.style.padding = "4px 8px"
    dragImage.style.backgroundColor = "var(--popover)"
    dragImage.style.color = "var(--popover-foreground)"
    dragImage.style.border = "1px solid var(--border)"
    dragImage.style.borderRadius = "var(--radius-sm)"
    dragImage.style.fontSize = "var(--text-xs)"
    dragImage.style.fontFamily = "var(--font-sans)"
    document.body.appendChild(dragImage)
    event.dataTransfer.setDragImage(dragImage, 10, 10)
    setTimeout(() => {
      document.body.removeChild(dragImage)
    }, 0)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const sourcePropName = draggedItemKeyRef.current

    if (
      draggedItemParentPathRef.current !== node.parentPath ||
      !sourcePropName ||
      sourcePropName === node.propName
    ) {
      return
    }

    event.dataTransfer.dropEffect = "move"
    clearDragClasses(event.currentTarget)

    const parentNode = node.parentPath
      ? resolveSchema(getSchemaPropertyType(schema, node.parentPath), schema)
      : resolveSchema(schema, schema)

    if (!parentNode || parentNode.type !== "object" || !parentNode.properties) {
      return
    }

    const propKeys = Object.keys(parentNode.properties)
    const sourceIndex = propKeys.indexOf(sourcePropName)
    const targetIndex = propKeys.indexOf(node.propName)

    if (sourceIndex === -1 || targetIndex === -1) return

    if (sourceIndex < targetIndex) {
      event.currentTarget.classList.add("border-r-2", "border-r-primary")
    } else {
      event.currentTarget.classList.add("border-l-2", "border-l-primary")
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    clearDragClasses(event.currentTarget)

    const sourcePropName = draggedItemKeyRef.current
    const sourceParentPath = draggedItemParentPathRef.current

    if (
      sourcePropName &&
      sourceParentPath === node.parentPath &&
      sourcePropName !== node.propName
    ) {
      reorderPropertiesInSchema(
        schema,
        node.parentPath,
        sourcePropName,
        node.propName,
        setSchema
      )
    }

    draggedItemKeyRef.current = null
    draggedItemParentPathRef.current = null
  }

  const handleDragEnd = () => {
    draggedItemKeyRef.current = null
    draggedItemParentPathRef.current = null
  }

  const headerLabel = (
    <div
      className={headerLabelClass}
      style={{
        maxWidth: `${headerWidth}px`,
        minWidth: `${headerWidth}px`,
      }}
    >
      {renderIconFromEffectiveType(node.effectiveType)}
      {node.label}
    </div>
  )

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
      {disableHeaderInteractions ? (
        <div className="flex h-full grow items-center justify-start rounded-none bg-transparent px-1 text-foreground">
          {headerLabel}
        </div>
      ) : (
        <PopoverDialog open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-full grow justify-start rounded-none bg-transparent px-1 text-foreground hover:bg-muted/40"
            >
              {headerLabel}
            </Button>
          </PopoverDialogTrigger>
          <PopoverDialogContent
            className="flex max-h-[80vh] w-[400px] flex-col gap-0 overflow-y-auto p-0"
            align="start"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <PopoverDialogTitle className="leading-none font-medium">
                {node.label}
              </PopoverDialogTitle>
              {!isPublished && editMode !== "readOnly" && (
                <Button
                  tabIndex={-1}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (
                      confirm(
                        `Are you sure you want to delete the property "${node.key}"? This action cannot be undone.`
                      )
                    ) {
                      const updatedSchema = deletePropertyInSchema(
                        schema,
                        node.key
                      )
                      setSchema(updatedSchema)
                      setDropdownOpen(false)
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive hover:text-destructive" />
                </Button>
              )}
            </div>

            <Separator />

            {node.isArray ? (
              <PropertyEditor
                property={node.rawSchema}
                propertyKey={node.key}
                setDropdownOpen={setDropdownOpen}
                jsonSchema={schema}
                setJsonSchema={setSchema}
                editMode={editMode}
              />
            ) : (
              <JsonSchemaEditorProvider
                jsonSchema={schema}
                setJsonSchema={(action) =>
                  setSchema(
                    typeof action === "function" ? action(schema) : action
                  )
                }
              >
                <PropertyEditor
                  property={node.rawSchema}
                  propertyKey={node.key}
                  setDropdownOpen={setDropdownOpen}
                  jsonSchema={schema}
                  setJsonSchema={setSchema}
                  editMode={editMode}
                />
              </JsonSchemaEditorProvider>
            )}
          </PopoverDialogContent>
        </PopoverDialog>
      )}
      {node.canFold && (
        <Button
          variant="ghost"
          size="icon"
          className={`h-full ${node.isArray ? "w-9" : "w-6"} rounded-none bg-transparent text-foreground hover:bg-muted/40`}
          onClick={() => {
            if (stopAt.includes(node.key)) {
              setStopAt(stopAt.filter((s) => s !== node.key))
            } else {
              setStopAt([...stopAt, node.key])
            }
          }}
        >
          {stopAt.includes(node.key) ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </Button>
      )}
    </div>
  )
}
