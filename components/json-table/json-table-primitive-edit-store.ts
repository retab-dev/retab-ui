import * as React from "react";

import { getValueAtPath } from "@/components/json-table/lib/document-paths";
import type { JsonTableDocumentData } from "@/components/json-table/lib/projects-types";

export type JsonTablePrimitiveEditSnapshot =
  | {
      status: "idle";
      hasValue: false;
      value: undefined;
    }
  | {
      status: "pending" | "confirmed";
      hasValue: true;
      value: unknown;
    }
  | {
      status: "stale";
      hasValue: false;
      value: undefined;
      documentValue: unknown;
      previousValue: unknown;
    };

type PrimitiveEditEntry = {
  snapshot: JsonTablePrimitiveEditSnapshot;
  baseValue: unknown;
  supersededValues: unknown[];
  version: number;
  listeners: Set<() => void>;
};

type PrimitiveDocumentEchoSignature = {
  data: JsonTableDocumentData;
  fieldPath: string;
  value: unknown;
};

export type JsonTablePrimitiveDocumentEcho = PrimitiveDocumentEchoSignature;

export type JsonTablePrimitiveEditReconciliation = {
  isPrimitiveDocumentEcho: boolean;
  confirmedFieldPaths: string[];
  staleFieldPaths: string[];
};

const idlePrimitiveEditSnapshot: JsonTablePrimitiveEditSnapshot = {
  status: "idle",
  hasValue: false,
  value: undefined,
};

const unresolvedPrimitiveEditBaseValue = Symbol(
  "unresolvedPrimitiveEditBaseValue",
);

const maxPrimitiveDocumentEchoSignatures = 32;

export type JsonTablePrimitiveEditStore = ReturnType<
  typeof createJsonTablePrimitiveEditStore
>;

export function createJsonTablePrimitiveEditStore() {
  const entries = new Map<string, PrimitiveEditEntry>();
  let primitiveDocumentEchoes = new WeakMap<
    JsonTableDocumentData,
    PrimitiveDocumentEchoSignature[]
  >();
  let primitiveDocumentEchoSignatures: PrimitiveDocumentEchoSignature[] = [];

  function entryForPath(fieldPath: string) {
    let entry = entries.get(fieldPath);
    if (!entry) {
      entry = {
        snapshot: idlePrimitiveEditSnapshot,
        baseValue: unresolvedPrimitiveEditBaseValue,
        supersededValues: [],
        version: 0,
        listeners: new Set(),
      };
      entries.set(fieldPath, entry);
    }
    return entry;
  }

  function notify(entry: PrimitiveEditEntry) {
    entry.version += 1;
    for (const listener of entry.listeners) listener();
  }

  function clearEntry(entry: PrimitiveEditEntry) {
    entry.snapshot = idlePrimitiveEditSnapshot;
    entry.baseValue = unresolvedPrimitiveEditBaseValue;
    entry.supersededValues = [];
  }

  function hasSupersededValue(entry: PrimitiveEditEntry, value: unknown) {
    return entry.supersededValues.some((item) => Object.is(item, value));
  }

  function childValue(node: unknown, segment: string) {
    if (node === null || typeof node !== "object") return undefined;
    if (Array.isArray(node) && /^\d+$/.test(segment)) {
      return node[Number(segment)];
    }
    if (!Object.prototype.hasOwnProperty.call(node, segment)) return undefined;
    return (node as Record<string, unknown>)[segment];
  }

  function enumerableKeys(node: unknown) {
    return node !== null && typeof node === "object" ? Object.keys(node) : [];
  }

  function haveSameUneditedSiblings({
    candidateNode,
    recordedNode,
    segments,
    segmentIndex,
  }: {
    candidateNode: unknown;
    recordedNode: unknown;
    segments: string[];
    segmentIndex: number;
  }): boolean {
    if (segmentIndex >= segments.length) return true;
    if (
      recordedNode === null ||
      candidateNode === null ||
      typeof recordedNode !== "object" ||
      typeof candidateNode !== "object" ||
      Array.isArray(recordedNode) !== Array.isArray(candidateNode)
    ) {
      return false;
    }

    if (
      Array.isArray(recordedNode) &&
      Array.isArray(candidateNode) &&
      recordedNode.length !== candidateNode.length
    ) {
      return false;
    }

    const editedSegment = segments[segmentIndex];
    const recordedSiblingKeys = enumerableKeys(recordedNode).filter(
      (key) => key !== editedSegment,
    );
    const candidateSiblingKeys = enumerableKeys(candidateNode).filter(
      (key) => key !== editedSegment,
    );

    if (recordedSiblingKeys.length !== candidateSiblingKeys.length) {
      return false;
    }

    const recordedSiblingKeySet = new Set(recordedSiblingKeys);
    for (const key of candidateSiblingKeys) {
      if (!recordedSiblingKeySet.has(key)) return false;
      if (
        !Object.is(
          childValue(recordedNode, key),
          childValue(candidateNode, key),
        )
      ) {
        return false;
      }
    }

    return haveSameUneditedSiblings({
      candidateNode: childValue(candidateNode, editedSegment),
      recordedNode: childValue(recordedNode, editedSegment),
      segments,
      segmentIndex: segmentIndex + 1,
    });
  }

  function matchesPrimitiveDocumentEchoSignature(
    data: JsonTableDocumentData,
    signature: PrimitiveDocumentEchoSignature,
  ) {
    if (
      !Object.is(getValueAtPath(data, signature.fieldPath), signature.value)
    ) {
      return false;
    }

    const segments = signature.fieldPath ? signature.fieldPath.split(".") : [];
    return haveSameUneditedSiblings({
      candidateNode: data,
      recordedNode: signature.data,
      segments,
      segmentIndex: 0,
    });
  }

  function recordPrimitiveDocumentEchoSignature(
    signature: PrimitiveDocumentEchoSignature,
  ) {
    const signaturesForData = primitiveDocumentEchoes.get(signature.data) ?? [];
    signaturesForData.push(signature);
    primitiveDocumentEchoes.set(signature.data, signaturesForData);

    primitiveDocumentEchoSignatures.push(signature);
    if (
      primitiveDocumentEchoSignatures.length <=
      maxPrimitiveDocumentEchoSignatures
    ) {
      return;
    }

    primitiveDocumentEchoSignatures = primitiveDocumentEchoSignatures.slice(
      -maxPrimitiveDocumentEchoSignatures,
    );
  }

  function consumePrimitiveDocumentEcho(data: JsonTableDocumentData) {
    const identityEchoSignatures = primitiveDocumentEchoes.get(data);
    if (identityEchoSignatures) {
      primitiveDocumentEchoes.delete(data);
      primitiveDocumentEchoSignatures = primitiveDocumentEchoSignatures.filter(
        (signature) => !identityEchoSignatures.includes(signature),
      );
      return true;
    }

    const signatureIndex = primitiveDocumentEchoSignatures.findIndex(
      (signature) => matchesPrimitiveDocumentEchoSignature(data, signature),
    );
    if (signatureIndex === -1) return false;

    primitiveDocumentEchoSignatures.splice(signatureIndex, 1);
    return true;
  }

  return {
    getSnapshot(fieldPath: string | undefined): JsonTablePrimitiveEditSnapshot {
      if (!fieldPath) return idlePrimitiveEditSnapshot;
      return entries.get(fieldPath)?.snapshot ?? idlePrimitiveEditSnapshot;
    },
    getVersion(fieldPath: string | undefined) {
      if (!fieldPath) return 0;
      return entries.get(fieldPath)?.version ?? 0;
    },
    commitValue(fieldPath: string, value: unknown, baseValue?: unknown) {
      const entry = entryForPath(fieldPath);
      if (entry.snapshot.hasValue && Object.is(entry.snapshot.value, value)) {
        return;
      }

      if (entry.snapshot.status === "pending") {
        entry.supersededValues.push(entry.snapshot.value);
      } else {
        entry.baseValue = baseValue ?? unresolvedPrimitiveEditBaseValue;
        entry.supersededValues = [];
      }

      entry.snapshot = { status: "pending", hasValue: true, value };
      notify(entry);
    },
    recordDocumentEcho(signature: JsonTablePrimitiveDocumentEcho) {
      recordPrimitiveDocumentEchoSignature(signature);
    },
    reconcileDocumentData(
      data: JsonTableDocumentData,
    ): JsonTablePrimitiveEditReconciliation {
      const isRecordedPrimitiveEcho = consumePrimitiveDocumentEcho(data);

      const reconciliation: JsonTablePrimitiveEditReconciliation = {
        isPrimitiveDocumentEcho: isRecordedPrimitiveEcho,
        confirmedFieldPaths: [],
        staleFieldPaths: [],
      };

      for (const [fieldPath, entry] of entries) {
        if (entry.snapshot.status !== "pending") continue;

        const documentValue = getValueAtPath(data, fieldPath);
        if (Object.is(documentValue, entry.snapshot.value)) {
          entry.snapshot = {
            status: "confirmed",
            hasValue: true,
            value: entry.snapshot.value,
          };
          entry.supersededValues = [];
          reconciliation.confirmedFieldPaths.push(fieldPath);
          notify(entry);
          continue;
        }

        if (hasSupersededValue(entry, documentValue)) {
          entry.supersededValues = entry.supersededValues.filter(
            (item) => !Object.is(item, documentValue),
          );
          continue;
        }

        const hasAuthoritativeChange =
          entry.baseValue !== unresolvedPrimitiveEditBaseValue &&
          !Object.is(documentValue, entry.baseValue);
        if (!hasAuthoritativeChange) continue;

        const previousValue = entry.snapshot.value;
        entry.snapshot = {
          status: "stale",
          hasValue: false,
          value: undefined,
          documentValue,
          previousValue,
        };
        entry.baseValue = unresolvedPrimitiveEditBaseValue;
        entry.supersededValues = [];
        reconciliation.staleFieldPaths.push(fieldPath);
        notify(entry);
      }

      return reconciliation;
    },
    reconcileProjectedValue(fieldPath: string | undefined, value: unknown) {
      if (!fieldPath) return;
      const entry = entries.get(fieldPath);
      if (!entry) return;

      const shouldClear =
        (entry.snapshot.status === "confirmed" &&
          Object.is(entry.snapshot.value, value)) ||
        entry.snapshot.status === "stale";
      if (!shouldClear) return;

      clearEntry(entry);
      notify(entry);
    },
    reset() {
      primitiveDocumentEchoes = new WeakMap();
      primitiveDocumentEchoSignatures = [];
      for (const entry of entries.values()) {
        clearEntry(entry);
        notify(entry);
      }
    },
    subscribe(fieldPath: string | undefined, listener: () => void) {
      if (!fieldPath) return () => {};
      const entry = entryForPath(fieldPath);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
  };
}

export function useJsonTablePrimitiveEditSnapshot({
  fieldPath,
  store,
}: {
  fieldPath: string | undefined;
  store: JsonTablePrimitiveEditStore;
}) {
  React.useSyncExternalStore(
    React.useCallback(
      (listener) => store.subscribe(fieldPath, listener),
      [fieldPath, store],
    ),
    React.useCallback(() => store.getVersion(fieldPath), [fieldPath, store]),
    () => 0,
  );

  return store.getSnapshot(fieldPath);
}
