import * as React from "react"
import { useRef, useState } from "react"
import { format } from "date-fns"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DoubleClickInput,
  DoubleClickTextarea,
} from "@/components/json-table/cell-editors/primitive-editor"
import {
  dateStringToFormat,
  dateToHTMLDateTimeString,
  dateToHTMLTimeString,
  formatValueForCommit,
  getLocalDateString,
  parseDateStringAsLocal,
} from "@/components/json-table/lib/date-utils"
import type { ProjectedCell } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-inspection"
import {
  ArrayEditor,
  ObjectEditor,
} from "@/components/json-table/object-editor"
import { cmp, useRefCallback } from "@/components/json-table/path-utils"
import { getColumnWidthPx } from "@/components/json-table/table-options-store"
import type { ColumnWidth } from "@/components/json-table/table-options-store"
import { useCellController } from "@/components/json-table/use-cell-controller"
import { Button } from "@/components/ui-retab/button"
import { Calendar } from "@/components/ui-retab/calendar"
import { Checkbox } from "@/components/ui-retab/checkbox"
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
  projectedCell?: ProjectedCell
  schema: JSONSchema7
  document: TableDocument
  docId: string
  columnWidth: ColumnWidth
  setOpenPopover: (key: string | null) => void
  openPopover: string | null
  onDocumentDataChange: (docId: string, value: unknown) => void
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  onCellHoverEnd?: () => void
  allowEditing?: boolean // Controls whether cell values can be edited
}

function calculateVariables(props: DataCellProps) {
  const { document, ...rest } = props
  const { projectedCell } = props
  const actualKey = projectedCell?.materializedPath

  return {
    ...rest,
    actualKey,
    document,
  }
}

const DataCellContent = (props: DataCellProps) => {
  const {
    actualKey,
    schema,
    docId,
    setOpenPopover,
    openPopover,
    onDocumentDataChange,
    document,
  } = calculateVariables(props)

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC OR EARLY RETURNS
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)
  const [isPointerOver, setIsPointerOver] = useState(false)
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

  // Use the value from the projected document cell.
  const value = props.projectedCell?.value

  const { effectiveValue, cleanStringValue, commitValueChange } =
    useCellController({
      document,
      docId,
      fieldPath: actualKey,
      value,
      isEditable: props.allowEditing,
      onDocumentDataChange,
    })

  const [stringValue, setStringValue] = useState<string>(() => cleanStringValue)
  const liveStringValue =
    isInputFocused || isDatePopoverOpen ? stringValue : cleanStringValue

  let cellWidth = getColumnWidthPx(props.columnWidth)
  if (props.keyValue.endsWith("__delete")) {
    cellWidth = 50
  }

  const fieldMetadata = actualKey
    ? getFieldMetadata(schema, actualKey)
    : undefined
  const property = fieldMetadata?.rawSchema
  // Cells are editable when the parent opts in via `allowEditing`.
  const isEditableReference = props.allowEditing
  const optional = !!fieldMetadata?.isNullable
  const isValidProp = !!fieldMetadata
  const isObject = fieldMetadata?.kind === "object"
  const isArray = fieldMetadata?.kind === "array"
  const isEnum = fieldMetadata?.kind === "enum"
  const isNumber = fieldMetadata?.kind === "number"
  const isText = fieldMetadata?.kind === "string"
  const isFloat = isNumber
  const isInteger = fieldMetadata?.kind === "integer"
  const isDate = fieldMetadata?.kind === "date"
  const isDateTime = fieldMetadata?.kind === "date-time"
  const isIsoTime = fieldMetadata?.kind === "iso-time"
  const isBoolean = fieldMetadata?.kind === "boolean"

  const onChange = useRefCallback(function (newValue: unknown) {
    if (actualKey) {
      const validatedValue = formatValueForCommit(newValue, property)
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
      const validatedValues = formatValueForCommit(values, property)
      commitValueChange(validatedValues)
      setOpenPopover(null)
    }
  }

  const handleArrayFormSubmitLocal = (values: unknown) => {
    if (actualKey) {
      const validatedValues = formatValueForCommit(values, property)
      commitValueChange(validatedValues)
      setOpenPopover(null)
    }
  }

  // Mouse enter/leave handlers removed - now using click to show floating content

  const date = safeParseISO(liveStringValue)
  const showInput =
    (isPointerOver || isInputFocused || isSelectOpen || isDatePopoverOpen) &&
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
        setIsPointerOver(false)
        if (isSelectOpen || isDatePopoverOpen || isInputFocused) return
        props.onCellHoverEnd?.()
      }}
      onMouseEnter={(e) => {
        setIsPointerOver(true)
        handleCellHover(e as unknown as React.MouseEvent)
      }}
      style={cellStyle}
    >
      <div
        ref={cellRootRef}
        className={cn(
          "h-full w-full focus-within:overflow-visible",
          isPointerOver && "border border-primary"
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
                  property={{
                    ...transferContext(property, schema),
                    additionalProperties: true,
                  }}
                  currentValue={effectiveValue}
                  onSubmit={handleObjectFormSubmitLocal}
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
                {(fieldMetadata?.enumValues ?? [])
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

    const res = cmp(prevVars, nextVars, {
      deep: ["projectedCell.arrayIndexes"],
    })
    return res
  }
)
DataCell.displayName = "DataCell"
