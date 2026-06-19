import type { JSONSchema7 } from "json-schema";

import type { FixedGridColumn } from "@/components/ui/fixed-grid-columns";
import type { JsonTableCellCommitHandler } from "@/components/json-table/json-table-cell-commit";
import type {
  JsonTableActivationIntent,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session";
import type {
  JsonTablePrimitiveActiveCellStore,
  SetJsonTablePrimitiveActiveCell,
} from "@/components/json-table/json-table-primitive-active-cell-store";
import type { JsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store";
import type { ProjectedCell } from "@/components/json-table/lib/document-projection";
import type { TableDocument } from "@/components/json-table/lib/projects-types";
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata";

export interface VisibleColumn extends FixedGridColumn<FieldMetadata> {
  fieldMetadata?: FieldMetadata;
}

export interface JsonTableCellHoverInfo {
  docId: string;
  fieldPath: string;
  getRect: () => DOMRect;
}

export interface JsonTableCellProjectionProps {
  column: VisibleColumn;
  projectedCell?: ProjectedCell;
  schema: JSONSchema7;
  document: TableDocument;
  docId: string;
  isJsonEditable: boolean;
  ariaColumnIndex: number;
}

export interface JsonTablePrimitiveEditingProps {
  activeCellStore: JsonTablePrimitiveActiveCellStore;
  editStore: JsonTablePrimitiveEditStore;
  setActiveCell: SetJsonTablePrimitiveActiveCell;
}

export interface JsonTableStructuredEditingProps {
  session: JsonTableStructuredEditSession | null;
  startSession: (
    projectedCell: ProjectedCell,
    intent: JsonTableActivationIntent,
  ) => void;
  setSessionOverlayOpen: (open: boolean) => void;
  closeSession: () => void;
}

export interface JsonTableCellCommitProps {
  onCommit: JsonTableCellCommitHandler;
}

export interface JsonTableCellHoverProps {
  onStart?: (info: JsonTableCellHoverInfo) => void;
  onEnd?: () => void;
}

export interface JsonTableCellProps {
  cellProjection: JsonTableCellProjectionProps;
  primitiveEditing: JsonTablePrimitiveEditingProps;
  structuredEditing: JsonTableStructuredEditingProps;
  commit: JsonTableCellCommitProps;
  hover: JsonTableCellHoverProps;
}
