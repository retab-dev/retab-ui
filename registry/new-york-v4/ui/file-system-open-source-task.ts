"use client";

import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import type { ViewerSource } from "@/lib/viewer-source";

import { createFileSystemAsyncTaskRuntime } from "./file-system-async-task";
import type { FileSystemSourceController } from "./file-system-source-controller";
import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types";

export type FileSystemOpenSourceState =
  | { status: "idle" }
  | { file: FileSystemFileEntry; status: "resolving" }
  | { file: FileSystemFileEntry; source: ViewerSource; status: "open" }
  | { file: FileSystemFileEntry; status: "unavailable" }
  | { error: string; file: FileSystemFileEntry; status: "failed" };

export type FileSystemOpenSourceTask = {
  close: () => void;
  open: (file: FileSystemFileEntry) => void;
  state: FileSystemOpenSourceState;
};

type FileSystemOpenSourceTaskInput = {
  file: FileSystemFileEntry;
};

export function useFileSystemOpenSourceTask({
  onFileOpen,
  resolveFileSource,
}: {
  onFileOpen?: FileSystemProps["onFileOpen"];
  resolveFileSource: FileSystemSourceController["resolveFileSource"];
}): FileSystemOpenSourceTask {
  const [state, setState] = React.useState<FileSystemOpenSourceState>({
    status: "idle",
  });
  const nextTaskNumberRef = React.useRef(0);
  const taskRuntimeRef = React.useRef(
    createFileSystemAsyncTaskRuntime<
      FileSystemOpenSourceTaskInput,
      ViewerSource | null
    >({
      createTaskId: () => `open-source:${++nextTaskNumberRef.current}`,
      keyForInput: () => "open-source",
    }),
  );

  const close = React.useCallback(() => {
    taskRuntimeRef.current.abortAll("open source task closed");
    setState({ status: "idle" });
  }, []);

  const open = React.useCallback(
    (file: FileSystemFileEntry) => {
      const taskRuntime = taskRuntimeRef.current;

      taskRuntime.abortAll("open source task superseded");
      const { promise, task } = taskRuntime.start({ file });
      setState({ file, status: "resolving" });

      void resolveFileSource(file, task.abortController.signal)
        .then((source) => taskRuntime.succeed(task, source))
        .catch((error) => taskRuntime.fail(task, error));

      void promise
        .then((source) => {
          if (task.abortController.signal.aborted) return;

          onFileOpen?.(file, source);
          if (!source) {
            setState({ file, status: "unavailable" });
            return;
          }

          setState({ file, source, status: "open" });
        })
        .catch((error: unknown) => {
          if (task.abortController.signal.aborted) return;

          onFileOpen?.(file, null);
          setState({
            error: openSourceErrorMessage(error),
            file,
            status: "failed",
          });
        });
    },
    [onFileOpen, resolveFileSource],
  );

  useMountEffect(() => close);

  return React.useMemo(() => ({ close, open, state }), [close, open, state]);
}

function openSourceErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to open file.";
}
