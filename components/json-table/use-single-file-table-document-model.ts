import * as React from "react";

import type {
  JsonTableCellCommit,
  JsonTableCellCommitHandler,
} from "@/components/json-table/json-table-cell-commit";
import {
  createJsonTablePrimitiveEditStore,
  type JsonTablePrimitiveEditStore,
} from "@/components/json-table/json-table-primitive-edit-store";
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler";
import { setValueAtMaterializedPath } from "@/components/json-table/lib/document-patches";
import type {
  JsonTableDocumentData,
  TableDocument,
} from "@/components/json-table/lib/projects-types";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type SingleFileTableDocumentPatch = { data: JsonTableDocumentData };

export type SingleFileTableDocumentModel = {
  projectionDocument: TableDocument;
  canCommitDocument: boolean;
  onCellCommit: JsonTableCellCommitHandler;
  primitiveEditStore: JsonTablePrimitiveEditStore;
};

type SingleFileTableDocumentState = {
  sourceDocumentId: string;
  reconciledSourceDocument: TableDocument;
  confirmedDocumentData: JsonTableDocumentData;
};

type SingleFileTableSourceReconciliation = {
  nextDocumentState: SingleFileTableDocumentState;
  shouldReplaceProjectionDocument: boolean;
};

function ignoreCellCommit() {}

function createDocumentState(
  sourceDocument: TableDocument,
): SingleFileTableDocumentState {
  return {
    sourceDocumentId: sourceDocument.id,
    reconciledSourceDocument: sourceDocument,
    confirmedDocumentData: sourceDocument.data,
  };
}

function isNewSourceDocument(
  documentState: SingleFileTableDocumentState,
  sourceDocument: TableDocument,
) {
  return documentState.sourceDocumentId !== sourceDocument.id;
}

function reconcileDocumentStateForSourceDocument({
  documentState,
  isPrimitiveDocumentEcho,
  sourceDocument,
}: {
  documentState: SingleFileTableDocumentState;
  isPrimitiveDocumentEcho: boolean;
  sourceDocument: TableDocument;
}): SingleFileTableSourceReconciliation {
  return {
    nextDocumentState: {
      ...documentState,
      reconciledSourceDocument: sourceDocument,
      confirmedDocumentData: sourceDocument.data,
    },
    shouldReplaceProjectionDocument: !isPrimitiveDocumentEcho,
  };
}

function commitCellValueToDocumentState({
  documentState,
  fieldPath,
  value,
}: {
  documentState: SingleFileTableDocumentState;
  fieldPath: string;
  value: unknown;
}): {
  nextDocumentState: SingleFileTableDocumentState;
  nextData: JsonTableDocumentData;
} {
  const nextData = setValueAtMaterializedPath(
    documentState.confirmedDocumentData,
    fieldPath,
    value,
  );

  return {
    nextDocumentState: {
      ...documentState,
      confirmedDocumentData: nextData,
    },
    nextData,
  };
}

function projectionDocumentForRender({
  documentState,
  projectionDocument,
  sourceDocument,
}: {
  documentState: SingleFileTableDocumentState;
  projectionDocument: TableDocument;
  sourceDocument: TableDocument;
}) {
  return isNewSourceDocument(documentState, sourceDocument)
    ? sourceDocument
    : projectionDocument;
}

function emitOptimisticDocumentPatch({
  data,
  updateDocument,
}: {
  data: JsonTableDocumentData;
  updateDocument: (patch: SingleFileTableDocumentPatch) => Promise<void>;
}) {
  void updateDocument({ data }).catch(() => {
    // Persistence errors belong to the onUpdateDocument owner. This model keeps
    // local optimistic state until a later source document confirms or replaces it.
  });
}

export function useSingleFileTableDocumentModel({
  onUpdateDocument,
  sourceDocument,
}: {
  onUpdateDocument?: (patch: SingleFileTableDocumentPatch) => Promise<void>;
  sourceDocument: TableDocument;
}): SingleFileTableDocumentModel {
  const primitiveEditStoreRef = React.useRef(
    createJsonTablePrimitiveEditStore(),
  );
  // Projection is reactive because row projection must rerender when the visible
  // document identity changes. Confirmed data stays in a ref because commits
  // need the latest patch base without making every parent echo rerender first.
  const [projectionDocument, setProjectionDocument] =
    React.useState(sourceDocument);
  const documentStateRef = React.useRef(createDocumentState(sourceDocument));
  const onUpdateDocumentRef = React.useRef(onUpdateDocument);

  // Transition table:
  // - new source id: reset projection, confirmed data, and primitive edits
  // - same-id primitive echo: update confirmed data without replacing projection
  // - same-id external data: update confirmed data and replace projection
  // - primitive commit: patch from confirmed data and record a primitive echo
  // - structured commit: patch from confirmed data; structured local state owns render state
  // - missing updater: expose a no-op commit handler
  useKeyedLayoutEffect(joinEffectKey([onUpdateDocument]), () => {
    onUpdateDocumentRef.current = onUpdateDocument;
  });

  const resetForSourceDocument = React.useCallback(
    (nextSourceDocument: TableDocument) => {
      documentStateRef.current = createDocumentState(nextSourceDocument);
      primitiveEditStoreRef.current.reset();
      setProjectionDocument(nextSourceDocument);
    },
    [],
  );

  const reconcileSourceDocument = React.useCallback(
    (nextSourceDocument: TableDocument) => {
      const documentState = documentStateRef.current;
      if (documentState.reconciledSourceDocument === nextSourceDocument) return;

      const reconciliation =
        primitiveEditStoreRef.current.reconcileDocumentData(
          nextSourceDocument.data,
        );
      const { nextDocumentState, shouldReplaceProjectionDocument } =
        reconcileDocumentStateForSourceDocument({
          documentState,
          isPrimitiveDocumentEcho: reconciliation.isPrimitiveDocumentEcho,
          sourceDocument: nextSourceDocument,
        });

      documentStateRef.current = nextDocumentState;
      if (shouldReplaceProjectionDocument) {
        setProjectionDocument(nextSourceDocument);
      }
    },
    [],
  );

  const commitCellValue = React.useCallback(
    ({ fieldPath, value, visibleThrough }: JsonTableCellCommit) => {
      const updateDocument = onUpdateDocumentRef.current;
      if (!updateDocument) return;

      markJsonTableProfile("document-patch-start", { fieldPath });
      const { nextDocumentState, nextData } = commitCellValueToDocumentState({
        documentState: documentStateRef.current,
        fieldPath,
        value,
      });
      documentStateRef.current = nextDocumentState;
      if (visibleThrough === "primitivePendingValue") {
        primitiveEditStoreRef.current.recordDocumentEcho({
          data: nextData,
          fieldPath,
          value,
        });
      }
      emitOptimisticDocumentPatch({ data: nextData, updateDocument });
      markJsonTableProfile("document-patch-end", { fieldPath });
    },
    [],
  );

  useKeyedLayoutEffect(
    joinEffectKey([
      reconcileSourceDocument,
      resetForSourceDocument,
      sourceDocument,
    ]),
    () => {
      if (isNewSourceDocument(documentStateRef.current, sourceDocument)) {
        resetForSourceDocument(sourceDocument);
        return;
      }

      reconcileSourceDocument(sourceDocument);
    },
  );

  const currentProjectionDocument = projectionDocumentForRender({
    documentState: documentStateRef.current,
    projectionDocument,
    sourceDocument,
  });
  const canCommitDocument = Boolean(onUpdateDocument);
  const onCellCommit = commitCellValue;

  return React.useMemo(
    () => ({
      projectionDocument: currentProjectionDocument,
      canCommitDocument,
      onCellCommit: canCommitDocument ? onCellCommit : ignoreCellCommit,
      primitiveEditStore: primitiveEditStoreRef.current,
    }),
    [canCommitDocument, currentProjectionDocument, onCellCommit],
  );
}
