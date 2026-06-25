"use client";

import * as React from "react";

import {
  createFileViewerControlsRegistration,
  resolveFileViewerControlsState,
  type FileViewerControlsRegistration,
} from "./file-viewer-controls-store";

type FileViewerControlsValue = {
  controlsState: ReturnType<typeof resolveFileViewerControlsState>;
};

const FileViewerControlsContext =
  React.createContext<FileViewerControlsValue | null>(null);

export function useFileViewerControlsController(descriptorKey: string): {
  controlsValue: {
    controlsState: ReturnType<typeof resolveFileViewerControlsState>;
  };
  handleControlsChange: (
    state: FileViewerControlsRegistration["state"],
  ) => void;
} {
  const [controlsRegistration, setControlsRegistration] =
    React.useState<FileViewerControlsRegistration>(() =>
      createFileViewerControlsRegistration(descriptorKey),
    );
  const controlsState = resolveFileViewerControlsState({
    descriptorKey,
    registration: controlsRegistration,
  });
  const handleControlsChange = React.useCallback(
    (state: FileViewerControlsRegistration["state"]) => {
      setControlsRegistration(
        createFileViewerControlsRegistration(descriptorKey, state),
      );
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
  value: {
    controlsState: ReturnType<typeof resolveFileViewerControlsState>;
  };
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
