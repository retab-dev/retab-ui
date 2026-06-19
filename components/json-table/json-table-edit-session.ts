export type JsonTableCellId = `${string}:${string}`;

export type JsonTableActivationIntent =
  | {
      type: "pointer";
      clientX: number;
      clientY: number;
      detail: number;
    }
  | {
      type: "keyboard";
      key: string;
    }
  | {
      type: "programmatic";
    };

export interface JsonTablePrimitiveActiveCell {
  cellId: JsonTableCellId;
  docId: string;
  fieldPath: string;
}

export interface JsonTableStructuredEditSession {
  id: number;
  cellId: JsonTableCellId;
  docId: string;
  fieldPath: string;
  intent: JsonTableActivationIntent;
  isOverlayOpen: boolean;
}

export type JsonTableActiveCell =
  | JsonTablePrimitiveActiveCell
  | JsonTableStructuredEditSession;

export function jsonTableCellId(
  docId: string,
  fieldPath: string,
): JsonTableCellId {
  return `${docId}:${fieldPath}`;
}

export function isPointerActivationIntent(
  intent: JsonTableActivationIntent | undefined,
): intent is Extract<JsonTableActivationIntent, { type: "pointer" }> {
  return intent?.type === "pointer";
}
