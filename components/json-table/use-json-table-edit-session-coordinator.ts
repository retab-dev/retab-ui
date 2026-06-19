import * as React from "react";

import type {
  JsonTableActivationIntent,
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session";
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session";
import {
  createJsonTablePrimitiveActiveCellStore,
  type JsonTablePrimitiveActiveCellStore,
  type SetJsonTablePrimitiveActiveCell,
} from "@/components/json-table/json-table-primitive-active-cell-store";
import type { ProjectedCell } from "@/components/json-table/lib/document-projection";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type JsonTableEditSessionCoordinator = {
  primitiveActiveCellStore: JsonTablePrimitiveActiveCellStore;
  structuredEditSession: JsonTableStructuredEditSession | null;
  setPrimitiveActiveCell: SetJsonTablePrimitiveActiveCell;
  startStructuredEditSession: (
    projectedCell: ProjectedCell | undefined,
    intent: JsonTableActivationIntent,
  ) => void;
  setStructuredEditSessionOverlayOpen: (open: boolean) => void;
  closeStructuredEditSession: () => void;
};

export function useJsonTableEditSessionCoordinator({
  documentId,
}: {
  documentId: string;
}): JsonTableEditSessionCoordinator {
  const primitiveActiveCellStoreRef = React.useRef(
    createJsonTablePrimitiveActiveCellStore(),
  );
  const [structuredEditSession, setStructuredEditSession] =
    React.useState<JsonTableStructuredEditSession | null>(null);
  const structuredEditSessionIdRef = React.useRef(0);
  const documentIdRef = React.useRef(documentId);

  useKeyedLayoutEffect(joinEffectKey([documentId]), () => {
    if (documentIdRef.current === documentId) return;

    documentIdRef.current = documentId;
    structuredEditSessionIdRef.current = 0;
    primitiveActiveCellStoreRef.current.setSnapshot(null);
    setStructuredEditSession(null);
  });

  const setPrimitiveActiveCell = React.useCallback(
    (activeCell: JsonTablePrimitiveActiveCell | null) => {
      primitiveActiveCellStoreRef.current.setSnapshot(activeCell);
      if (activeCell) setStructuredEditSession(null);
    },
    [],
  );

  const startStructuredEditSession = React.useCallback(
    (
      projectedCell: ProjectedCell | undefined,
      intent: JsonTableActivationIntent,
    ) => {
      if (!projectedCell?.materializedFieldPath) return;

      const nextSessionId = structuredEditSessionIdRef.current + 1;
      structuredEditSessionIdRef.current = nextSessionId;
      primitiveActiveCellStoreRef.current.setSnapshot(null);
      setStructuredEditSession({
        id: nextSessionId,
        cellId: jsonTableCellId(
          documentId,
          projectedCell.materializedFieldPath,
        ),
        docId: documentId,
        fieldPath: projectedCell.materializedFieldPath,
        intent,
        isOverlayOpen: true,
      });
    },
    [documentId],
  );

  const setStructuredEditSessionOverlayOpen = React.useCallback(
    (open: boolean) => {
      setStructuredEditSession((currentSession) =>
        currentSession && currentSession.isOverlayOpen !== open
          ? { ...currentSession, isOverlayOpen: open }
          : currentSession,
      );
    },
    [],
  );

  const closeStructuredEditSession = React.useCallback(() => {
    setStructuredEditSession(null);
  }, []);

  return {
    primitiveActiveCellStore: primitiveActiveCellStoreRef.current,
    structuredEditSession,
    setPrimitiveActiveCell,
    startStructuredEditSession,
    setStructuredEditSessionOverlayOpen,
    closeStructuredEditSession,
  };
}
