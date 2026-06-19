"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import { normalizeFolderPath } from "./file-system-index";
import type {
  FileSystemKernelCommand,
  FileSystemKernelState,
} from "./file-system-kernel";
import {
  selectFileSystemKernel,
  type FileSystemDispatch,
  type FileSystemEnsureChildren,
} from "./file-system-kernel-selectors";
import type {
  FileSystemEntry,
  FileSystemItem,
  FileSystemProps,
} from "./file-system-types";

export type FileSystemFolderTask = {
  abortAll: () => void;
  ensureChildren: FileSystemEnsureChildren;
  runFolderCommand: (
    command: Extract<FileSystemKernelCommand, { type: "folder.ensure" }>,
  ) => void;
};

type FolderLoadRequest = {
  abortController: AbortController;
  path: string;
  requestId: string;
  status: "queued" | "loading";
};

type FolderLoadWaiter = {
  reject: (error: unknown) => void;
  resolve: (children: FileSystemEntry[]) => void;
};

export function useFileSystemFolderTask({
  dispatch,
  getState,
  loadChildren,
}: {
  dispatch: FileSystemDispatch;
  getState: () => FileSystemKernelState;
  loadChildren: FileSystemProps["loadChildren"];
}): FileSystemFolderTask {
  const nextRequestNumberRef = React.useRef(0);
  const requestsByPathRef = React.useRef(new Map<string, FolderLoadRequest>());
  const waitersByRequestIdRef = React.useRef(
    new Map<string, FolderLoadWaiter[]>(),
  );
  const selectVisibleChildren = React.useCallback(
    (path: string) =>
      selectFileSystemKernel({ state: getState() }).index.children.get(path) ??
      [],
    [getState],
  );

  const joinRequest = React.useCallback((request: FolderLoadRequest) => {
    const promise = new Promise<FileSystemEntry[]>((resolve, reject) => {
      if (!isCurrentFolderRequest(requestsByPathRef.current, request)) {
        reject(createStaleFolderRequestError(request));
        return;
      }

      const waiters =
        waitersByRequestIdRef.current.get(request.requestId) ?? [];
      waiters.push({ reject, resolve });
      waitersByRequestIdRef.current.set(request.requestId, waiters);
    });

    void promise.catch(() => {});
    return promise;
  }, []);

  const createRequest = React.useCallback((path: string) => {
    const request: FolderLoadRequest = {
      abortController: new AbortController(),
      path,
      requestId: `folder:${++nextRequestNumberRef.current}`,
      status: "queued",
    };

    requestsByPathRef.current.set(path, request);
    return request;
  }, []);

  const settleRequest = React.useCallback(
    (
      request: FolderLoadRequest,
      settleWaiter: (waiter: FolderLoadWaiter) => void,
    ) => {
      if (!isCurrentFolderRequest(requestsByPathRef.current, request)) {
        return false;
      }

      const waiters =
        waitersByRequestIdRef.current.get(request.requestId) ?? [];
      requestsByPathRef.current.delete(request.path);
      waitersByRequestIdRef.current.delete(request.requestId);

      for (const waiter of waiters) settleWaiter(waiter);
      return true;
    },
    [],
  );

  const failRequest = React.useCallback(
    (request: FolderLoadRequest, error: unknown) => {
      settleRequest(request, (waiter) => waiter.reject(error));
    },
    [settleRequest],
  );

  const settleRequestFromCommittedChildren = React.useCallback(
    (request: FolderLoadRequest) => {
      const children = selectVisibleChildren(request.path);

      settleRequest(request, (waiter) => waiter.resolve(children));
    },
    [selectVisibleChildren, settleRequest],
  );

  const abortRequest = React.useCallback(
    (path: string, reason: string) => {
      const request = requestsByPathRef.current.get(path);

      if (!request) return;

      request.abortController.abort();
      failRequest(request, createAbortFolderRequestError(request, reason));
    },
    [failRequest],
  );

  const ensureChildren = React.useCallback<FileSystemEnsureChildren>(
    (path, options = {}) => {
      const folderPath = normalizeFolderPath(path);
      const selectors = selectFileSystemKernel({ state: getState() });
      const folder = selectors.rawIndex.folders.get(folderPath);
      const rawChildren = selectors.rawIndex.children.get(folderPath) ?? [];
      const visibleChildren = selectors.index.children.get(folderPath) ?? [];

      if (!loadChildren || !folder?.hasChildren) {
        return Promise.resolve(visibleChildren);
      }
      if (!options.retry && rawChildren.length > 0) {
        return Promise.resolve(visibleChildren);
      }
      if (options.retry) {
        abortRequest(folderPath, "retry");
      }

      let request = requestsByPathRef.current.get(folderPath);
      const started = !request;

      if (!request) {
        request = createRequest(folderPath);
      }

      const promise = joinRequest(request);

      if (started) {
        dispatch({
          path: folderPath,
          reason: options.retry ? "retry" : "expand",
          requestId: request.requestId,
          type: "folder.loadRequested",
        });
      }

      return promise.catch(() => selectVisibleChildren(folderPath));
    },
    [
      abortRequest,
      createRequest,
      dispatch,
      getState,
      joinRequest,
      loadChildren,
      selectVisibleChildren,
    ],
  );

  const runFolderCommand = React.useCallback<
    FileSystemFolderTask["runFolderCommand"]
  >(
    (command) => {
      const path = normalizeFolderPath(command.path);
      const request = requestsByPathRef.current.get(path);

      if (
        !request ||
        request.requestId !== command.requestId ||
        request.status === "loading"
      ) {
        return;
      }

      if (!loadChildren) {
        settleRequestFromCommittedChildren(request);
        return;
      }

      request.status = "loading";

      void (async () => {
        try {
          let cursor: string | null = null;
          const items: FileSystemItem[] = [];

          do {
            const result = await loadChildren({
              cursor,
              path: request.path,
              signal: request.abortController.signal,
            });

            items.push(...result.items);
            cursor = result.nextCursor ?? null;
          } while (cursor && !request.abortController.signal.aborted);

          if (request.abortController.signal.aborted) {
            failRequest(request, new Error("Folder request aborted."));
            return;
          }

          dispatch({
            items,
            path: request.path,
            requestId: request.requestId,
            type: "folder.loadSucceeded",
          });
          settleRequestFromCommittedChildren(request);
        } catch (error) {
          if (!request.abortController.signal.aborted) {
            dispatch({
              error: errorMessage(error),
              path: request.path,
              requestId: request.requestId,
              type: "folder.loadFailed",
            });
          }
          failRequest(request, error);
        }
      })();
    },
    [dispatch, failRequest, loadChildren, settleRequestFromCommittedChildren],
  );

  const abortAll = React.useCallback(() => {
    for (const path of [...requestsByPathRef.current.keys()]) {
      abortRequest(path, "file-system folder task unmounted");
    }
  }, [abortRequest]);

  React.useEffect(() => abortAll, [abortAll]);

  return React.useMemo(
    () => ({ abortAll, ensureChildren, runFolderCommand }),
    [abortAll, ensureChildren, runFolderCommand],
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to load this folder.";
}

function isCurrentFolderRequest(
  requestsByPath: Map<string, FolderLoadRequest>,
  request: FolderLoadRequest,
) {
  return requestsByPath.get(request.path)?.requestId === request.requestId;
}

function createStaleFolderRequestError(request: FolderLoadRequest) {
  return new Error(`Stale folder request: ${request.requestId}`);
}

function createAbortFolderRequestError(
  request: FolderLoadRequest,
  reason: string,
) {
  return new Error(`Aborted folder request ${request.requestId}: ${reason}`);
}
