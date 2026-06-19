"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import type { ViewerSource } from "@/lib/viewer-source";

import { createFileSystemAsyncTaskRuntime } from "./file-system-async-task";
import type { FileSystemFileEntry } from "./file-system-types";

export type FileSystemSourceResolver = (
  file: FileSystemFileEntry,
  signal: AbortSignal,
) => Promise<ViewerSource | null>;

export type FileSystemSelectionSourceState =
  | { source: ViewerSource | null; status: "idle" }
  | { source: null; status: "loading" }
  | { source: ViewerSource; status: "ready" }
  | { source: null; status: "unavailable" }
  | { error: string; source: null; status: "error" };

export type FileSystemSelectionSourceTask = FileSystemSelectionSourceState & {
  retry: () => void;
};

type FileSystemSelectionSourceTaskInput = {
  file: FileSystemFileEntry;
  retryKey: number;
};

export function useFileSystemSelectionSourceTask(
  file: FileSystemFileEntry | null,
  resolveFileSource?: FileSystemSourceResolver,
): FileSystemSelectionSourceTask {
  const [retryKey, setRetryKey] = React.useState(0);
  const [state, setState] = React.useState<FileSystemSelectionSourceState>({
    source: null,
    status: "idle",
  });
  const nextTaskNumberRef = React.useRef(0);
  const taskRuntimeRef = React.useRef(
    createFileSystemAsyncTaskRuntime<
      FileSystemSelectionSourceTaskInput,
      ViewerSource | null
    >({
      createTaskId: () => `preview-source:${++nextTaskNumberRef.current}`,
      keyForInput: (input) =>
        [
          "preview-source",
          input.file.path,
          input.file.key,
          input.retryKey,
        ].join("\0"),
    }),
  );
  const retry = React.useCallback(() => setRetryKey((key) => key + 1), []);

  React.useEffect(() => {
    if (!file) {
      setState({ source: null, status: "idle" });
      return;
    }
    if (file.source) {
      setState({ source: file.source, status: "ready" });
      return;
    }
    if (!resolveFileSource) {
      setState({ source: null, status: "unavailable" });
      return;
    }

    const taskRuntime = taskRuntimeRef.current;
    const { promise, task } = taskRuntime.start({ file, retryKey });

    setState({ source: null, status: "loading" });
    void resolveFileSource(file, task.abortController.signal)
      .then((source) => taskRuntime.succeed(task, source))
      .catch((error) => taskRuntime.fail(task, error));

    void promise
      .then((source) => {
        if (task.abortController.signal.aborted) return;
        setState(
          source
            ? { source, status: "ready" }
            : { source: null, status: "unavailable" },
        );
      })
      .catch((error) => {
        if (task.abortController.signal.aborted) return;

        setState({
          error: selectionSourceErrorMessage(error),
          source: null,
          status: "error",
        });
      });

    return () => taskRuntime.abort(task.key, "preview source task superseded");
  }, [file, resolveFileSource, retryKey]);

  return { ...state, retry };
}

function selectionSourceErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Couldn't load this file.";
}
