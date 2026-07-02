"use client";

import * as React from "react";

export type ArrayTableActiveCellStore = {
  getSnapshot: () => string | null;
  setActivePath: (path: string | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createArrayTableActiveCellStore(): ArrayTableActiveCellStore {
  let activePath: string | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => activePath,
    setActivePath: (path) => {
      if (activePath === path) return;
      activePath = path;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useArrayTableCellActive(
  store: ArrayTableActiveCellStore,
  path: string,
): boolean {
  return React.useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot() === path,
    () => false,
  );
}
