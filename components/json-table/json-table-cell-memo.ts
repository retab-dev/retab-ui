import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { cmp } from "@/components/json-table/path-utils"

function editableJsonTableCellMemoVariables(props: JsonTableCellProps) {
  const {
    document: _document,
    primitiveActiveCellStore: _primitiveActiveCellStore,
    structuredEditSession: _structuredEditSession,
    ...rest
  } = props
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const isStructuredSessionCell =
    Boolean(materializedFieldPath) &&
    props.structuredEditSession?.fieldPath === materializedFieldPath
  const structuredEditSessionId = isStructuredSessionCell
    ? (props.structuredEditSession?.id ?? null)
    : null
  const structuredEditSessionOverlayOpen = isStructuredSessionCell
    ? (props.structuredEditSession?.isOverlayOpen ?? false)
    : false

  return {
    ...rest,
    structuredEditSessionId,
    structuredEditSessionOverlayOpen,
    materializedFieldPath,
  }
}

export function areEditableJsonTableCellPropsEqual(
  previousProps: JsonTableCellProps,
  nextProps: JsonTableCellProps
) {
  return cmp(
    editableJsonTableCellMemoVariables(previousProps),
    editableJsonTableCellMemoVariables(nextProps),
    { deep: ["projectedCell.arrayIndexes"] }
  )
}
