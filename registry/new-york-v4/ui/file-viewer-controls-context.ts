"use client";

import * as React from "react";

import type { ViewerControlsState } from "./viewer-controls";

export type FileViewerControlsState = ViewerControlsState;

type FileViewerControlsRegistration = {
  descriptorKey: string;
  state: FileViewerControlsState | null;
};

type FileViewerControlsValue = {
  controlsState: FileViewerControlsState | null;
};

const FileViewerControlsContext =
  React.createContext<FileViewerControlsValue | null>(null);

export function useFileViewerControlsController(descriptorKey: string): {
  controlsValue: FileViewerControlsValue;
  handleControlsChange: (state: FileViewerControlsState | null) => void;
} {
  const [controlsRegistration, setControlsRegistration] =
    React.useState<FileViewerControlsRegistration>(() => ({
      descriptorKey,
      state: null,
    }));
  const controlsState =
    controlsRegistration.descriptorKey === descriptorKey
      ? controlsRegistration.state
      : null;
  const handleControlsChange = React.useCallback(
    (state: FileViewerControlsState | null) => {
      setControlsRegistration({ descriptorKey, state });
    },
    [descriptorKey],
  );
  const controlsValue = React.useMemo<FileViewerControlsValue>(
    () => ({
      controlsState,
    }),
    [controlsState],
  );

  return {
    controlsValue,
    handleControlsChange,
  };
}

export function FileViewerControlsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: FileViewerControlsValue;
}) {
  return React.createElement(
    FileViewerControlsContext.Provider,
    { value },
    children,
  );
}

export function useFileViewerControlsState() {
  const context = React.useContext(FileViewerControlsContext);
  if (!context) {
    throw new Error("File viewer controls must be used within FileViewer.");
  }
  return context.controlsState;
}
