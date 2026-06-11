import * as React from "react"
import { useRef, useState } from "react"
import { format } from "date-fns"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useMountEffect } from "@/hooks/useMountEffect"
import {
  getSchemaPropertyType,
  unwrapSchema,
} from "@/components/json-table/header-from-schema"
import type { HoverInfo } from "@/components/json-table/hover-info-context"
import { useHoverInfo } from "@/components/json-table/hover-info-context"
import {
  autoFormatDateTimeFields,
  dateStringToFormat,
  dateToHTMLDateTimeString,
  dateToHTMLTimeString,
  getLocalDateString,
  parseDateStringAsLocal,
} from "@/components/json-table/lib/date-utils"
import {
  get_value_from_row_array_and_dot_notation_path,
  isValidProperty,
} from "@/components/json-table/lib/json-schema-utils"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  ArrayEditor,
  ObjectEditor,
} from "@/components/json-table/object-editor"
import {
  assignObjectKey,
  cmp,
  materialize,
  useRefCallback,
} from "@/components/json-table/path-utils"
import type { PathInfo } from "@/components/json-table/path-utils"
import { getColumnWidthPx } from "@/components/json-table/table-options-store"
import type { ColumnWidth } from "@/components/json-table/table-options-store"
import { Button } from "@/components/ui-retab/button"
import { Calendar } from "@/components/ui-retab/calendar"
import { Checkbox } from "@/components/ui-retab/checkbox"
import { Input, InputArea } from "@/components/ui-retab/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-retab/select"
import { TableCell } from "@/components/ui-retab/table"

const safeParseISO = (
  dateString: string | null | undefined
): Date | undefined => {
  return parseDateStringAsLocal(dateString) ?? undefined
}

// Removed project/spec-based computed detection in favor of schema X-ComputedField tagging

const cellDisplayClass = "flex h-full w-full truncate px-2 text-xs leading-none"
const cellEditorClass =
  "!text-xs h-full rounded-none px-2 py-0 leading-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
const objectCellButtonClass =
  "h-full w-full justify-start overflow-hidden px-1 text-xs leading-none text-inherit select-none hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"

type SchemaWithDefs = JSONSchema7 & {
  $defs?: Record<string, JSONSchema7Definition>
}

type OptimisticUpdateDetail = {
  docId?: string
  fieldPath?: string
  value: unknown
}

// Cache schema property lookups by (schema object, dot path)
type PropertyInfo = {
  rawProperty: JSONSchema7
  nullable: boolean
  isValidProp: boolean
  isObject: boolean
  isArray: boolean
  isText: boolean
  isEnum: boolean
  isNumber: boolean
  isFloat: boolean
  isInteger: boolean
  isDate: boolean
  isDateTime: boolean
  isIsoTime: boolean
  isBoolean: boolean
  propertyEnumVals: unknown[]
}

const schemaPropertyCache = new WeakMap<object, Map<string, PropertyInfo>>()

function getPropertyInfoCached(
  schema: JSONSchema7,
  path: string
): PropertyInfo | undefined {
  if (!schema || !path) return undefined
  let cache = schemaPropertyCache.get(schema)
  if (!cache) {
    cache = new Map<string, PropertyInfo>()
    schemaPropertyCache.set(schema, cache)
  }
  const existing = cache.get(path)
  if (existing) return existing

  // Resolve the final node once (getSchemaPropertyType internally resolves $ref for traversal
  // and returns a resolved node at the end). Avoid full unwrapSchema here.
  const node = getSchemaPropertyType(schema, path)
  if (!node) return undefined

  const isValidProp = !!(node && isValidProperty(node))

  // Resolve nullable unions and $ref targets on the final node so flags (like enum)
  // reflect the effective, non-null schema.
  const unwrapped = unwrapSchema(node, schema)
  const nullable = !!unwrapped.nullable
  const effective = unwrapped.schema
  const effectiveType = effective.type as string | string[] | undefined

  const info: PropertyInfo = {
    rawProperty: node,
    nullable,
    isValidProp,
    isObject: effectiveType === "object",
    isArray: effectiveType === "array",
    isText: effectiveType === "string",
    isEnum: !!effective?.enum,
    isNumber: effectiveType === "number",
    isFloat: effectiveType === "float",
    isInteger: effectiveType === "integer",
    isDate: effective?.format === "date",
    isDateTime: effective?.format === "date-time",
    isIsoTime: effective?.format === "iso-time",
    isBoolean: effective?.type === "boolean",
    propertyEnumVals: effective?.enum ?? [],
  }
  cache.set(path, info)
  return info
}

export function DoubleClickInput({
  className,
  disabled = false,
  isReferenceSheet: _isReferenceSheet = false,
  ...props
}: React.ComponentProps<typeof Input> & { isReferenceSheet?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Let the browser handle native caret positioning
  const handleMouseDown = (_e: React.MouseEvent) => {
    // Nothing to do — we want the default behaviour here
    // so the caret lands exactly where the user clicked.
  }

  // Handle double click to focus the input
  const handleDoubleClick = () => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }

  // Handle key down events for Enter and Escape keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      inputRef.current?.blur()
      e.preventDefault()
    }
  }

  return (
    <Input
      {...props}
      className={cn(
        "cursor-default border-0 focus:cursor-text disabled:text-inherit disabled:opacity-100",
        className
      )}
      onKeyDown={handleKeyDown}
      onSubmit={() => inputRef.current?.blur()}
      ref={inputRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        // Prevent propagation when already focused to maintain focus
        if (document.activeElement === inputRef.current) {
          e.stopPropagation()
        }
        // Call the original onClick if provided
        props.onClick?.(e)
      }}
      onDoubleClick={handleDoubleClick}
      disabled={disabled}
    />
  )
}

export function DoubleClickTextarea({
  className,
  disabled = false,
  isReferenceSheet: _isReferenceSheet = false,
  ...props
}: React.ComponentProps<typeof InputArea> & { isReferenceSheet?: boolean }) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Let the browser handle native caret positioning
  const handleMouseDown = (_e: React.MouseEvent) => {
    // Nothing to do — we want the default behaviour here
    // so the caret lands exactly where the user clicked.
  }

  // Handle double click to focus the input
  const handleDoubleClick = () => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }

  // Handle key down events for Enter and Escape keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      inputRef.current?.blur()
      e.preventDefault()
    }
  }

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
          e.stopPropagation()
        }
        // Call the original onClick if provided
        props.onClick?.(e)
      }}
      onDoubleClick={handleDoubleClick}
      readOnly={disabled}
    />
  )
}

function stripProperties(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value
  }
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
  } = value as Record<string, unknown>
  return rest
}

function transferContext(type: JSONSchema7, context: JSONSchema7): JSONSchema7 {
  // Ensure we properly merge $defs from both context and type
  const contextDefs = (context as SchemaWithDefs).$defs || {}
  const typeDefs = (type as SchemaWithDefs).$defs || {}

  const result = {
    ...type,
    $defs: {
      ...contextDefs,
      ...typeDefs,
    },
  }

  return result
}

interface DataCellProps {
  keyValue: string
  rowIdx: number
  pathInfo?: PathInfo
  schema: JSONSchema7
  document: TableDocument
  docId: string
  columnWidth: ColumnWidth
  setOpenPopover: (key: string | null) => void
  openPopover: string | null
  onGroundTruthDataChange: (docId: string, value: unknown) => void
  onCellHoverStart?: (info: HoverInfo) => void
  onCellHoverEnd?: () => void
  allowEditing?: boolean // Controls whether cell values can be edited
}

function calculateVariables(props: DataCellProps) {
  const { document, ...rest } = props
  const { pathInfo, keyValue } = props

  const actualKey = pathInfo?.idx
    ? materialize(keyValue, pathInfo?.idx)
    : undefined

  return {
    ...rest,
    actualKey,
    document,
  }
}

const DataCellContent = (props: DataCellProps) => {
  const { hoverInfo, setHoverInfo } = useHoverInfo()

  const {
    actualKey,
    schema,
    docId,
    setOpenPopover,
    openPopover,
    onGroundTruthDataChange,
    document,
  } = calculateVariables(props)

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC OR EARLY RETURNS
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)
  // Text cells render a plain <div> for display/hover and only mount the
  // <textarea> editor once the user clicks to edit. A <textarea> is a scroll
  // container, so leaving one under the pointer (as the old always-mounted
  // version did) swallows wheel events and blocks scrolling over text cells.
  const [isTextEditing, setIsTextEditing] = useState(false)

  // While a cell editor is open it overflows its cell. The virtualizer puts
  // every row in its own stacking context (via `transform`), so the editor's
  // own z-index can't lift it above *other* rows — later rows paint over it and
  // it looks transparent. Elevate the whole row's stacking context while editing
  // so the (opaque) editor overlay covers its neighbours, then reset on close.
  const cellRootRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const editing = isInputFocused || isSelectOpen || isDatePopoverOpen
    const rowEl = cellRootRef.current?.closest<HTMLElement>("[data-index]")
    if (!rowEl) return
    rowEl.style.zIndex = editing ? "20" : ""
    return () => {
      rowEl.style.zIndex = ""
    }
  }, [isInputFocused, isSelectOpen, isDatePopoverOpen])

  // Use the value from the PathInfo
  const value = props.pathInfo?.value

  // Optimistic local value to reflect changes immediately in the UI
  const [optimisticValue, setOptimisticValue] = useState<unknown>(undefined)

  // Helpers shared with commit/cleanup comparisons
  const safeStringify = React.useCallback((v: unknown) => {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }, [])
  const normalize = React.useCallback(
    (v: unknown) => (v == null || v === "" ? null : v),
    []
  )

  // Prefer optimistic value for rendering until server/parent state catches up
  const effectiveValue = optimisticValue !== undefined ? optimisticValue : value
  const cleanStringValue =
    effectiveValue !== null && effectiveValue !== undefined
      ? String(effectiveValue)
      : ""

  // Listen for external optimistic updates.
  // Ref mirrors keep the mount-only listener reading the latest cell identity.
  const docIdRef = useRef(docId)
  const actualKeyRef = useRef(actualKey)

  React.useEffect(() => {
    docIdRef.current = docId
    actualKeyRef.current = actualKey
  }, [docId, actualKey])

  useMountEffect(() => {
    const handleOptimisticUpdate = (event: Event) => {
      const detail = (event as CustomEvent<OptimisticUpdateDetail>).detail
      if (!detail) return
      if (
        detail.docId === docIdRef.current &&
        detail.fieldPath === actualKeyRef.current
      ) {
        setOptimisticValue(detail.value)
      }
    }
    window.addEventListener(
      "retab:optimistic-update",
      handleOptimisticUpdate as EventListener
    )
    return () => {
      window.removeEventListener(
        "retab:optimistic-update",
        handleOptimisticUpdate as EventListener
      )
    }
  })

  const [stringValue, setStringValue] = useState<string>(() => cleanStringValue)
  const liveStringValue =
    isInputFocused || isDatePopoverOpen ? stringValue : cleanStringValue

  let cellWidth = getColumnWidthPx(props.columnWidth)
  if (props.keyValue.endsWith("__delete")) {
    cellWidth = 50
  }

  const isHovering =
    hoverInfo?.docId === props.docId && hoverInfo?.fieldPath === actualKey

  // Cached schema property lookup for performance
  const propInfo = actualKey
    ? getPropertyInfoCached(schema, actualKey)
    : undefined
  const property = propInfo?.rawProperty
  // Cells are editable when the parent opts in via `allowEditing`.
  const isEditableReference = props.allowEditing
  const optional = !!propInfo?.nullable
  const isValidProp = !!propInfo?.isValidProp
  const isObject = !!propInfo?.isObject
  const isArray = !!propInfo?.isArray
  const isEnum = !!propInfo?.isEnum
  const isNumber = !!propInfo?.isNumber
  const isText = !!propInfo?.isText
  const isFloat = !!propInfo?.isFloat
  const isInteger = !!propInfo?.isInteger
  const isDate = !!propInfo?.isDate
  const isDateTime = !!propInfo?.isDateTime
  const isIsoTime = !!propInfo?.isIsoTime
  const isBoolean = !!propInfo?.isBoolean

  // --- Debounce Logic Start ---
  const commitValueChange = useRefCallback(function (validatedValue: unknown) {
    if (!actualKey) return
    if (!isEditableReference) return

    const previousRoot = document.prediction_data?.prediction ?? {}
    const previousValue = get_value_from_row_array_and_dot_notation_path(
      previousRoot,
      actualKey
    )

    const prevNorm = normalize(previousValue)
    const nextNorm = normalize(validatedValue)
    const uiNorm = normalize(value)

    const isNoOp =
      previousValue === validatedValue ||
      safeStringify(prevNorm) === safeStringify(nextNorm) ||
      safeStringify(uiNorm) === safeStringify(nextNorm)
    if (isNoOp) return

    const newRoot = assignObjectKey(
      previousRoot,
      actualKey.split("."),
      validatedValue
    )
    onGroundTruthDataChange(docId, newRoot)
    // Optimistically reflect the new value in the cell UI
    setOptimisticValue(validatedValue)
  })

  const onChange = useRefCallback(function (newValue: unknown) {
    if (actualKey) {
      // Apply autoFormatDateTimeFields validation to the new value
      let validatedValue = newValue
      if (property && property.format && typeof newValue === "string") {
        try {
          // Create a temporary schema object for this specific field
          const fieldSchema: JSONSchema7 = {
            type: "object",
            properties: {
              [actualKey.split(".").pop()!]: property,
            },
          }

          // Apply validation to the field value
          const validatedData = autoFormatDateTimeFields(
            { [actualKey.split(".").pop()!]: newValue },
            fieldSchema
          )
          validatedValue = validatedData[actualKey.split(".").pop()!]
        } catch (error) {
          console.warn(
            `autoFormatDateTimeFields validation failed for ${actualKey}:`,
            error
          )
        }
      }
      commitValueChange(validatedValue)
    }
  })

  const handleCellHover = useRefCallback((e: React.MouseEvent) => {
    if (actualKey) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      props.onCellHoverStart?.({ docId, fieldPath: actualKey, rect })
    }
  })

  const cellStyle = {
    width: `${cellWidth}px`,
    minWidth: `${cellWidth}px`,
    userSelect: "none" as const,
  }

  // NOW WE CAN DO CONDITIONAL LOGIC AND EARLY RETURNS
  // Render an empty cell or placeholder

  // --- Debounce Logic End ---

  // Validation flag via encapsulated hook
  //const { isValid: validationFlag } = useFieldValidationFlag(docId ?? undefined, actualKey ?? undefined);

  // Update the handlers to use actualKey
  const handleObjectFormSubmitLocal = (values: unknown) => {
    if (actualKey) {
      // Apply autoFormatDateTimeFields validation to object values
      let validatedValues = values
      if (property && property.type === "object" && property.properties) {
        try {
          validatedValues = autoFormatDateTimeFields(values, property)
        } catch (error) {
          console.warn(
            `autoFormatDateTimeFields validation failed for object ${actualKey}:`,
            error
          )
        }
      }

      commitValueChange(validatedValues)
      setOpenPopover(null)
    }
  }

  const handleArrayFormSubmitLocal = (values: unknown) => {
    if (actualKey) {
      // Apply autoFormatDateTimeFields validation to array values
      let validatedValues = values
      if (property && property.type === "array" && property.items) {
        try {
          validatedValues = autoFormatDateTimeFields(values, property)
        } catch (error) {
          console.warn(
            `autoFormatDateTimeFields validation failed for array ${actualKey}:`,
            error
          )
        }
      }

      commitValueChange(validatedValues)
      setOpenPopover(null)
    }
  }

  // Mouse enter/leave handlers removed - now using click to show floating content

  const date = safeParseISO(liveStringValue)
  const showInput =
    (isHovering || isInputFocused || isSelectOpen || isDatePopoverOpen) &&
    isEditableReference

  if (!isValidProp) {
    return (
      <TableCell
        key={actualKey}
        data-field-path={actualKey}
        className="relative cursor-not-allowed bg-muted/60"
        style={{
          width: `${cellWidth}px`,
          minWidth: `${cellWidth}px`,
        }}
      />
    )
  }

  return (
    <TableCell
      key={actualKey}
      data-field-path={actualKey}
      className="relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none"
      onMouseLeave={() => {
        if (isSelectOpen || isDatePopoverOpen || isInputFocused) return
        props.onCellHoverEnd?.()
      }}
      onMouseEnter={(e) => {
        handleCellHover(e as unknown as React.MouseEvent)
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
        //className="focus-within:overflow-visible w-full h-full"//
        className={cn(
          "h-full w-full focus-within:overflow-visible",
          isHovering && "border border-primary"
        )}
      >
        {isObject ? (
          <Popover
            open={openPopover === actualKey}
            onOpenChange={(open) => {
              if (!open) {
                setOpenPopover(null)
              } else if (actualKey) {
                setOpenPopover(actualKey)
              }
            }}
          >
            <PopoverTrigger asChild>
              <button className={objectCellButtonClass}>
                {effectiveValue ? (
                  <div className="max-w-[80px] truncate text-left">
                    {JSON.stringify(stripProperties(effectiveValue))}
                  </div>
                ) : (
                  <div className="max-w-[80px] truncate text-left text-muted-foreground">
                    {`Edit ${property?.title || actualKey}`}
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="m-0 w-96 p-4"
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
                  setSourcesFieldPath={(path) => {
                    if (!path) {
                      setHoverInfo(null)
                      return
                    }
                    if (actualKey) {
                      const fullPath =
                        path === actualKey || path.startsWith(actualKey + ".")
                          ? path
                          : `${actualKey}.${path}`
                      setHoverInfo({
                        docId: props.docId,
                        fieldPath: fullPath,
                        rect: new DOMRect(),
                      })
                    } else {
                      setHoverInfo({
                        docId: props.docId,
                        fieldPath: path,
                        rect: new DOMRect(),
                      })
                    }
                  }}
                />
              )}
            </PopoverContent>
          </Popover>
        ) : isArray ? (
          <Popover
            open={openPopover === actualKey}
            onOpenChange={(open) => {
              if (!open) {
                setOpenPopover(null)
              } else if (actualKey) {
                setOpenPopover(actualKey)
              }
            }}
          >
            <PopoverTrigger asChild>
              <button className={objectCellButtonClass}>
                {effectiveValue ? (
                  <div className="max-w-[80px] truncate text-left">
                    {Array.isArray(effectiveValue)
                      ? `[${effectiveValue.length} items]`
                      : JSON.stringify(effectiveValue)}
                  </div>
                ) : (
                  <div className="max-w-[80px] truncate text-left text-muted-foreground">
                    {`${property?.title || actualKey}`}
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="m-0 w-96 p-4"
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
                  setSourcesFieldPath={(path) => {
                    if (!path) {
                      setHoverInfo(null)
                      return
                    }
                    setHoverInfo({
                      docId: props.docId,
                      fieldPath: path,
                      rect: new DOMRect(),
                    })
                  }}
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
                  onChange(checked)
                }
              }}
              onFocus={() => {
                setFocusedField(`${docId}:${actualKey}`)
                setIsInputFocused(true)
              }}
              onBlur={() => {
                setFocusedField(null)
                setIsInputFocused(false)
              }}
              className="rounded-sm disabled:opacity-100"
            />
          </div>
        ) : isEnum ? (
          showInput ? (
            <Select
              key={`${actualKey}-${value}`}
              onOpenChange={(open) => {
                setIsSelectOpen(open)
                if (open) {
                  setFocusedField(`${docId}:${actualKey}`)
                  setIsInputFocused(true)
                } else {
                  setFocusedField(null)
                  setIsInputFocused(false)
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
                  onChange(null)
                } else {
                  if (isInteger) {
                    const parsed = parseInt(newValue, 10)
                    onChange(Number.isNaN(parsed) ? null : parsed)
                  } else if (isFloat) {
                    const parsed = parseFloat(newValue)
                    onChange(Number.isNaN(parsed) ? null : parsed)
                  } else {
                    onChange(newValue)
                  }
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-6 w-full rounded-none border-none px-2 text-xs leading-none text-inherit shadow-none",
                  "disabled:opacity-100"
                )}
                onFocus={() => {
                  setFocusedField(`${docId}:${actualKey}`)
                  setIsInputFocused(true)
                }}
                onBlur={() => {
                  if (!isSelectOpen) {
                    setFocusedField(null)
                    setIsInputFocused(false)
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
                    className="text-xs text-muted-foreground"
                  >
                    <em>No selection</em>
                  </SelectItem>
                )}
                {(propInfo?.propertyEnumVals ?? [])
                  .filter(
                    (enumVal) =>
                      enumVal !== undefined &&
                      enumVal !== null &&
                      !(typeof enumVal === "string" && enumVal === "")
                  )
                  .map((option) => (
                    <SelectItem
                      key={String(option)}
                      value={String(option)}
                      className="text-xs"
                    >
                      {String(option)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div className={cn(cellDisplayClass, "items-start py-2")}>
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
                setIsDatePopoverOpen(open)
                if (open) {
                  setStringValue(cleanStringValue)
                  setFocusedField(`${docId}:${actualKey}`)
                  setIsInputFocused(true)
                } else {
                  setFocusedField(null)
                  setIsInputFocused(false)
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  disabled={!isEditableReference}
                  className={cn(
                    "h-full w-full justify-start rounded-none border-0 px-2 py-0 text-left text-xs leading-none font-normal text-inherit shadow-none hover:bg-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0",
                    !effectiveValue && "text-muted-foreground",
                    "disabled:opacity-100",
                    focusedField === `${docId}:${actualKey}`
                      ? "absolute top-0 left-0 z-10 shadow-md"
                      : "" //min-w-[200px]
                  )}
                  onClick={() => {
                    setFocusedField(`${docId}:${actualKey}`)
                    setIsInputFocused(true)
                  }}
                >
                  {date ? (
                    format(date, "PP")
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                  <CalendarIcon className="ml-auto size-4 opacity-50" />
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
                      const localDateString = getLocalDateString(picked)
                      const convertedDate = dateStringToFormat(
                        localDateString,
                        "2000-01-01"
                      )
                      setStringValue(convertedDate || "")
                      onChange(convertedDate || null)
                    } else {
                      setStringValue("")
                      onChange(null)
                    }
                  }}
                  onDayClick={(picked) => {
                    if (!picked) return
                    const localDateString = getLocalDateString(picked)
                    const convertedDate = dateStringToFormat(
                      localDateString,
                      "2000-01-01"
                    )
                    setStringValue(convertedDate || "")
                    onChange(convertedDate || null)
                    setIsDatePopoverOpen(false)
                    setFocusedField(null)
                    setIsInputFocused(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className={cn(cellDisplayClass, "items-center py-2")}>
              {(() => {
                try {
                  const date = parseDateStringAsLocal(liveStringValue)
                  if (!date) {
                    return (
                      <span className="text-muted-foreground">Pick a date</span>
                    )
                  }
                  return format(date, "PP")
                } catch {
                  return "Invalid date"
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
                setStringValue(e.target.value)
              }}
              onBlur={(_e: React.ChangeEvent<HTMLInputElement>) => {
                let finalValue = stringValue
                if (stringValue && /^\d{1,2}:\d{2}$/.test(stringValue)) {
                  finalValue = stringValue + ":00"
                  setStringValue(finalValue)
                }
                const convertedDate = dateStringToFormat(finalValue, "00:00")
                onChange(convertedDate || null)
                setStringValue(convertedDate || "")
                setFocusedField(null)
                setIsInputFocused(false)
              }}
              onFocus={() => {
                setStringValue(cleanStringValue)
                setFocusedField(`${docId}:${actualKey}`)
                setIsInputFocused(true)
              }}
              disabled={!isEditableReference}
              className={cn(
                cellEditorClass,
                !effectiveValue && "text-muted-foreground",
                focusedField === `${docId}:${actualKey}`
                  ? "absolute top-0 left-0 z-10"
                  : "" //min-w-[200px]
              )}
            />
          ) : (
            <div className={cn(cellDisplayClass, "items-center py-2")}>
              {dateToHTMLTimeString(liveStringValue || "") || "—"}
            </div>
          )
        ) : isDateTime ? (
          showInput ? (
            <DoubleClickInput
              type="datetime-local"
              value={dateToHTMLDateTimeString(liveStringValue || "")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setStringValue(e.target.value)
              }}
              onFocus={() => {
                setStringValue(cleanStringValue)
                setFocusedField(`${docId}:${actualKey}`)
                setIsInputFocused(true)
              }}
              onBlur={() => {
                const convertedDate = dateStringToFormat(
                  stringValue,
                  "2000-01-01T00:00:00"
                )
                onChange(convertedDate || null)
                setFocusedField(null)
                setIsInputFocused(false)
              }}
              disabled={!isEditableReference}
              className={cn(
                cellEditorClass,
                focusedField === `${docId}:${actualKey}` &&
                  "absolute top-0 left-0 z-10 bg-background"
              )}
            />
          ) : (
            <div className={cn(cellDisplayClass, "items-center py-0")}>
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
                  : parseFloat(e.target.value)
                setStringValue(isNaN(numValue) ? "" : numValue.toString())
              }}
              onFocus={() => {
                setStringValue(cleanStringValue)
                setFocusedField(`${docId}:${actualKey}`)
                setIsInputFocused(true)
              }}
              onBlur={() => {
                const numValue = isInteger
                  ? parseInt(stringValue)
                  : parseFloat(stringValue)
                onChange(isNaN(numValue) ? null : numValue)
                setFocusedField(null)
                setIsInputFocused(false)
              }}
              disabled={!isEditableReference}
              className={cn(
                cellEditorClass,
                focusedField === `${docId}:${actualKey}` &&
                  "absolute top-0 left-0 z-10"
              )}
            />
          ) : (
            <div className={cn(cellDisplayClass, "items-center py-2")}>
              {liveStringValue ?? "—"}
            </div>
          )
        ) : isText ? (
          isTextEditing ? (
            <DoubleClickTextarea
              autoFocus
              value={liveStringValue ?? null}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setStringValue(e.target.value)
              }}
              onBlur={(_e: React.FocusEvent<HTMLTextAreaElement>) => {
                const newVal = stringValue || null
                onChange(newVal)
                setFocusedField(null)
                setIsInputFocused(false)
                setIsTextEditing(false)
              }}
              onFocus={() => {
                setStringValue(cleanStringValue)
                setFocusedField(`${docId}:${actualKey}`)
                setIsInputFocused(true)
              }}
              disabled={!isEditableReference}
              className={cn(
                "h-full w-full rounded-none px-2 py-2 text-xs leading-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                !effectiveValue && "text-muted-foreground",
                focusedField === `${docId}:${actualKey}`
                  ? "absolute top-[1px] left-[1px] z-10 h-64 min-w-[200px] bg-background shadow-md outline-1 outline-primary"
                  : "" //min-w-[200px]
              )}
              style={{
                resize: "none",
              }}
            />
          ) : (
            <div
              className={cn(
                cellDisplayClass,
                "items-start py-2",
                isEditableReference && "cursor-text"
              )}
              onClick={() => {
                if (isEditableReference) setIsTextEditing(true)
              }}
            >
              {effectiveValue !== null && effectiveValue !== undefined
                ? String(effectiveValue)
                : ""}
            </div>
          )
        ) : (
          <div className={cn(cellDisplayClass, "items-start bg-muted/60 py-2")}>
            {effectiveValue !== null && effectiveValue !== undefined
              ? String(effectiveValue)
              : ""}
          </div>
        )}
      </div>
    </TableCell>
  )
}

export const DataCell = React.memo(
  (props: DataCellProps) => {
    return <DataCellContent {...props} />
  },
  (prev: DataCellProps, next: DataCellProps) => {
    const prevVars = calculateVariables(prev)
    const nextVars = calculateVariables(next)

    const res = cmp(prevVars, nextVars, { deep: ["pathInfo.idx"] })
    return res
  }
)
DataCell.displayName = "DataCell"
