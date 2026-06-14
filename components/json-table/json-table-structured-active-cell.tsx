import * as React from "react"

import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import {
  markJsonTableProfile,
  recordJsonTableRender,
} from "@/components/json-table/json-table-profiler"
import { JsonTableStructuredCell } from "@/components/json-table/json-table-structured-cell"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { useRefCallback } from "@/components/json-table/path-utils"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"
import { useJsonTableStructuredCellController } from "@/components/json-table/use-json-table-structured-cell-controller"

export function JsonTableStructuredActiveCell({
  fieldMetadata,
  materializedFieldPath,
  schema,
  structuredEditSession,
  value,
  closeStructuredEditSession,
  onCellCommit,
  setStructuredEditSessionOverlayOpen,
}: {
  fieldMetadata: FieldMetadata
  materializedFieldPath: string
  schema: JsonTableCellProps["schema"]
  structuredEditSession: NonNullable<
    JsonTableCellProps["structuredEditSession"]
  >
  value: unknown
  closeStructuredEditSession: JsonTableCellProps["closeStructuredEditSession"]
  onCellCommit: JsonTableCellProps["onCellCommit"]
  setStructuredEditSessionOverlayOpen: JsonTableCellProps["setStructuredEditSessionOverlayOpen"]
}) {
  recordJsonTableRender(
    "JsonTableStructuredActiveCell",
    materializedFieldPath,
    {
      structuredEditSessionId: structuredEditSession.id,
      fieldKind: fieldMetadata.kind,
      isOverlayOpen: structuredEditSession.isOverlayOpen,
      valueType: value === null ? "null" : typeof value,
    }
  )

  const { effectiveValue, commitStructuredValueChange } =
    useJsonTableStructuredCellController({
      materializedFieldPath,
      value,
      isEditable: true,
      onCellCommit,
    })

  const cellRootRef = React.useRef<HTMLDivElement>(null)
  recordJsonTableRender(
    "JsonTableStructuredActiveControl",
    materializedFieldPath,
    {
      structuredEditSessionId: structuredEditSession.id,
      fieldKind: fieldMetadata.kind,
      isEditable: true,
      isOverlayOpen: structuredEditSession.isOverlayOpen,
    }
  )

  useElevatedVirtualRow({
    cellRootRef,
    isElevated: true,
  })

  React.useEffect(() => {
    markJsonTableProfile("active-control-mounted", {
      fieldPath: materializedFieldPath,
      fieldKind: fieldMetadata.kind,
    })
  }, [fieldMetadata.kind, materializedFieldPath])

  const commitValue = useRefCallback((newValue: unknown) => {
    commitStructuredValueChange(
      formatValueForCommit(newValue, fieldMetadata.rawSchema)
    )
  })

  return (
    <div
      ref={cellRootRef}
      className="h-full w-full focus-within:overflow-visible"
    >
      <JsonTableStructuredCell
        fieldPath={materializedFieldPath}
        fieldMetadata={fieldMetadata}
        schema={schema}
        effectiveValue={effectiveValue}
        isEditable={true}
        structuredEditSession={structuredEditSession}
        setStructuredEditSessionOverlayOpen={
          setStructuredEditSessionOverlayOpen
        }
        closeStructuredEditSession={closeStructuredEditSession}
        commitValue={commitValue}
      />
    </div>
  )
}
