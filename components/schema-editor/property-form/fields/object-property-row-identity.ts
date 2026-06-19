"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

export interface ObjectPropertyRowIdentity {
  addRowId: (propertyName: string) => void;
  getRowId: (propertyName: string) => string;
  preserveAddRowForLocalPropertyNames: (propertyNames: string[]) => void;
  removeRowId: (propertyName: string) => void;
  renameRowId: (oldName: string, name: string) => void;
}

export function useObjectPropertyRowIdentity({
  onExternalPropertyNamesChange,
  propertyNames,
  resetKey,
}: {
  onExternalPropertyNamesChange: () => void;
  propertyNames: string[];
  resetKey: string;
}): ObjectPropertyRowIdentity {
  const propertyNamesKey = getPropertyNamesKey(propertyNames);
  const localPropertyNamesKeyRef = React.useRef<string | null>(null);
  const [rowIdsByName, setRowIdsByName] = React.useState(() =>
    createRowIdsByName(propertyNames),
  );
  const nextRowIdRef = React.useRef(propertyNames.length);

  React.useEffect(() => {
    if (localPropertyNamesKeyRef.current === propertyNamesKey) {
      localPropertyNamesKeyRef.current = null;
      return;
    }
    onExternalPropertyNamesChange();
  }, [onExternalPropertyNamesChange, propertyNamesKey, resetKey]);

  const createRowId = React.useCallback(() => {
    const rowId = `draft-property-${nextRowIdRef.current}`;
    nextRowIdRef.current += 1;
    return rowId;
  }, []);

  return {
    addRowId: (propertyName) => {
      setRowIdsByName((current) => {
        const next = { ...current };
        setRecordValue(next, propertyName, createRowId());
        return next;
      });
    },
    getRowId: (propertyName) =>
      rowIdsByName[propertyName] ?? `external-property-${propertyName}`,
    preserveAddRowForLocalPropertyNames: (nextPropertyNames) => {
      localPropertyNamesKeyRef.current = getPropertyNamesKey(nextPropertyNames);
    },
    removeRowId: (propertyName) => {
      setRowIdsByName((current) => {
        const next = { ...current };
        delete next[propertyName];
        return next;
      });
    },
    renameRowId: (oldName, name) => {
      setRowIdsByName((current) => {
        const rowId = current[oldName] ?? createRowId();
        const next = { ...current };
        delete next[oldName];
        setRecordValue(next, name, rowId);
        return next;
      });
    },
  };
}

function getPropertyNamesKey(propertyNames: string[]) {
  return propertyNames.join("\0");
}

function createRowIdsByName(propertyNames: string[]) {
  const rowIdsByName: Record<string, string> = {};
  propertyNames.forEach((propertyName, index) => {
    setRecordValue(rowIdsByName, propertyName, `draft-property-${index}`);
  });
  return rowIdsByName;
}

function setRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}
