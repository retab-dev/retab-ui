"use client";

import type { ViewerControlsState } from "./viewer-controls";

export type FileViewerControlsState = ViewerControlsState;

export type FileViewerControlsRegistration = {
  descriptorKey: string;
  state: FileViewerControlsState | null;
};

export function createFileViewerControlsRegistration(
  descriptorKey: string,
  state: FileViewerControlsState | null = null,
): FileViewerControlsRegistration {
  return { descriptorKey, state };
}

export function resolveFileViewerControlsState({
  descriptorKey,
  registration,
}: {
  descriptorKey: string;
  registration: FileViewerControlsRegistration;
}): FileViewerControlsState | null {
  if (registration.descriptorKey !== descriptorKey) return null;
  return registration.state;
}
