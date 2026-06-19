import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types";
import { cmp } from "@/components/json-table/path-utils";

function editableJsonTableCellMemoVariables(props: JsonTableCellProps) {
  const { cellProjection, commit, hover, primitiveEditing, structuredEditing } =
    props;
  const materializedFieldPath =
    cellProjection.projectedCell?.materializedFieldPath;
  const isStructuredSessionCell =
    Boolean(materializedFieldPath) &&
    structuredEditing.session?.fieldPath === materializedFieldPath;
  const structuredEditSessionId = isStructuredSessionCell
    ? (structuredEditing.session?.id ?? null)
    : null;
  const structuredEditSessionOverlayOpen = isStructuredSessionCell
    ? (structuredEditing.session?.isOverlayOpen ?? false)
    : false;

  return {
    ariaColumnIndex: cellProjection.ariaColumnIndex,
    column: cellProjection.column,
    commit,
    docId: cellProjection.docId,
    hover,
    isJsonEditable: cellProjection.isJsonEditable,
    materializedFieldPath,
    primitiveEditStore: primitiveEditing.editStore,
    projectedCell: cellProjection.projectedCell,
    schema: cellProjection.schema,
    setPrimitiveActiveCell: primitiveEditing.setActiveCell,
    startStructuredEditSession: structuredEditing.startSession,
    closeStructuredEditSession: structuredEditing.closeSession,
    setStructuredEditSessionOverlayOpen:
      structuredEditing.setSessionOverlayOpen,
    structuredEditSessionId,
    structuredEditSessionOverlayOpen,
  };
}

export function areEditableJsonTableCellPropsEqual(
  previousProps: JsonTableCellProps,
  nextProps: JsonTableCellProps,
) {
  return cmp(
    editableJsonTableCellMemoVariables(previousProps),
    editableJsonTableCellMemoVariables(nextProps),
    { deep: ["projectedCell.arrayIndexes"] },
  );
}
