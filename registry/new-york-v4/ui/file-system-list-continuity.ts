"use client";

import * as React from "react";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type FileSystemListContinuityPhase =
  | "applying"
  | "capturing"
  | "revealing"
  | "stable";

export type FileSystemListContinuityState<TRuntimeInput = unknown> = {
  identity: FileSystemListContinuityIdentity<TRuntimeInput> | null;
  modelRevision: string;
  pendingRevealPath: string | null;
  phase: FileSystemListContinuityPhase;
  snapshotsByCurrentPath: Map<string, FileSystemListExpansionSnapshot>;
  transition: Exclude<
    FileSystemListContinuityTransition<TRuntimeInput>,
    { kind: "same" }
  > | null;
};

export type FileSystemListContinuityInput<TRuntimeInput = unknown> = {
  itemPaths: readonly string[];
  runtimeInput: TRuntimeInput;
};

export type FileSystemListContinuityIdentity<TRuntimeInput = unknown> = {
  currentPath: string;
  decorationVersion: string;
  hasSemanticQuery: boolean;
  input: FileSystemListContinuityInput<TRuntimeInput>;
};

export type FileSystemListContinuityDiff = {
  didChangeCurrentPath: boolean;
  didChangeDecoration: boolean;
  didChangeInput: boolean;
  didChangeSemanticQuery: boolean;
};

export type FileSystemListContinuityTransition<TRuntimeInput = unknown> =
  | {
      identity: FileSystemListContinuityIdentity<TRuntimeInput>;
      kind: "same";
    }
  | {
      kind:
        | "decoration"
        | "input"
        | "path"
        | "query-enter"
        | "query-exit"
        | "query-update";
      next: FileSystemListContinuityIdentity<TRuntimeInput>;
      previous: FileSystemListContinuityIdentity<TRuntimeInput>;
    };

export type FileSystemListExpansionSnapshot = {
  expandedItemPaths: Set<string>;
  mode: "normal" | "query";
};

export type FileSystemListContinuityPlan<TRuntimeInput = unknown> =
  | {
      kind: "none";
    }
  | {
      expandedPaths: string[];
      kind: "apply";
      nextItemPaths: string[];
      revealPath: string | null;
      transition: Exclude<
        FileSystemListContinuityTransition<TRuntimeInput>,
        { kind: "same" }
      >;
    };

export type FileSystemListContinuityCommand<TRuntimeInput = unknown> =
  | {
      identity: FileSystemListContinuityIdentity<TRuntimeInput>;
      type: "snapshot.capture";
    }
  | {
      expandedPaths: string[];
      identity: FileSystemListContinuityIdentity<TRuntimeInput>;
      nextItemPaths: string[];
      revealPath: string | null;
      type: "model.apply";
    }
  | { path: string; type: "selection.reveal" };

export type FileSystemListContinuityEvent<TRuntimeInput = unknown> =
  | { path: string; type: "domain.pathChanged" }
  | { search: string; type: "domain.queryChanged" }
  | { path: string | null; type: "domain.selectionChanged" }
  | { path: string; type: "domain.folderLoadSucceeded" }
  | {
      identity: FileSystemListContinuityIdentity<TRuntimeInput>;
      type: "identity.requested";
    }
  | {
      expandedPaths: Iterable<string>;
      identity: FileSystemListContinuityIdentity<TRuntimeInput>;
      type: "snapshot.captured";
    }
  | {
      expandedPaths: Iterable<string>;
      identity: FileSystemListContinuityIdentity<TRuntimeInput>;
      type: "model.applied";
    }
  | { type: "selection.revealed" };

export type FileSystemListContinuityResult<TRuntimeInput = unknown> = {
  commands: FileSystemListContinuityCommand<TRuntimeInput>[];
  state: FileSystemListContinuityState<TRuntimeInput>;
};

export type FileSystemListContinuity<TRuntimeInput = unknown> = {
  dispatch: (
    event: FileSystemListContinuityEvent<TRuntimeInput>,
  ) => FileSystemListContinuityCommand<TRuntimeInput>[];
  state: FileSystemListContinuityState<TRuntimeInput>;
};

export function createFileSystemListContinuityState<
  TRuntimeInput = unknown,
>(): FileSystemListContinuityState<TRuntimeInput> {
  return {
    identity: null,
    modelRevision: "initial",
    pendingRevealPath: null,
    phase: "stable",
    snapshotsByCurrentPath: new Map(),
    transition: null,
  };
}

export function createFileSystemListContinuityIdentity<TRuntimeInput>({
  currentPath,
  decorationVersion,
  hasSemanticQuery,
  input,
}: {
  currentPath: string;
  decorationVersion: string;
  hasSemanticQuery: boolean;
  input: FileSystemListContinuityInput<TRuntimeInput>;
}): FileSystemListContinuityIdentity<TRuntimeInput> {
  return {
    currentPath,
    decorationVersion,
    hasSemanticQuery,
    input,
  };
}

export function diffFileSystemListContinuityIdentity<TRuntimeInput>(
  previous: FileSystemListContinuityIdentity<TRuntimeInput>,
  next: FileSystemListContinuityIdentity<TRuntimeInput>,
): FileSystemListContinuityDiff {
  return {
    didChangeCurrentPath: previous.currentPath !== next.currentPath,
    didChangeDecoration: previous.decorationVersion !== next.decorationVersion,
    didChangeInput: previous.input.runtimeInput !== next.input.runtimeInput,
    didChangeSemanticQuery: previous.hasSemanticQuery !== next.hasSemanticQuery,
  };
}

export function classifyFileSystemListContinuityTransition<TRuntimeInput>(
  previous: FileSystemListContinuityIdentity<TRuntimeInput>,
  next: FileSystemListContinuityIdentity<TRuntimeInput>,
): FileSystemListContinuityTransition<TRuntimeInput> {
  const diff = diffFileSystemListContinuityIdentity(previous, next);

  if (
    !diff.didChangeCurrentPath &&
    !diff.didChangeDecoration &&
    !diff.didChangeInput &&
    !diff.didChangeSemanticQuery
  ) {
    return { identity: next, kind: "same" };
  }

  if (diff.didChangeCurrentPath) {
    return { kind: "path", previous, next };
  }

  if (!previous.hasSemanticQuery && next.hasSemanticQuery) {
    return { kind: "query-enter", previous, next };
  }

  if (previous.hasSemanticQuery && next.hasSemanticQuery) {
    return { kind: "query-update", previous, next };
  }

  if (previous.hasSemanticQuery && !next.hasSemanticQuery) {
    return { kind: "query-exit", previous, next };
  }

  if (diff.didChangeDecoration) {
    return { kind: "decoration", previous, next };
  }

  return { kind: "input", previous, next };
}

export function createFileSystemListContinuityPlan<TRuntimeInput>({
  pendingRevealPath,
  snapshotsByCurrentPath,
  transition,
}: {
  pendingRevealPath: string | null;
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemListExpansionSnapshot>;
  transition: FileSystemListContinuityTransition<TRuntimeInput>;
}): FileSystemListContinuityPlan<TRuntimeInput> {
  if (transition.kind === "same") {
    return { kind: "none" };
  }

  return {
    expandedPaths: resolveFileSystemListContinuityExpansion({
      snapshotsByCurrentPath,
      transition,
    }),
    kind: "apply",
    nextItemPaths: [...transition.next.input.itemPaths],
    revealPath: pendingRevealPath,
    transition,
  };
}

export function resolveFileSystemListContinuityExpansion<TRuntimeInput>({
  snapshotsByCurrentPath,
  transition,
}: {
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemListExpansionSnapshot>;
  transition: Exclude<
    FileSystemListContinuityTransition<TRuntimeInput>,
    { kind: "same" }
  >;
}): string[] {
  switch (transition.kind) {
    case "query-enter":
    case "query-update":
      return collectFileSystemListDirectoryPaths(
        transition.next.input.itemPaths,
      );
    case "decoration":
    case "input":
    case "path":
    case "query-exit":
      return restoreFileSystemListNormalExpansion({
        currentPath: transition.next.currentPath,
        nextItemPaths: transition.next.input.itemPaths,
        snapshotsByCurrentPath,
      });
  }
}

export function rememberFileSystemListExpansionSnapshot<TRuntimeInput>({
  expandedPaths,
  identity,
  snapshotsByCurrentPath,
}: {
  expandedPaths: Iterable<string>;
  identity: FileSystemListContinuityIdentity<TRuntimeInput>;
  snapshotsByCurrentPath: Map<string, FileSystemListExpansionSnapshot>;
}) {
  const previous = snapshotsByCurrentPath.get(identity.currentPath);
  const mode = identity.hasSemanticQuery ? "query" : "normal";

  if (mode === "query" && previous?.mode === "normal") {
    return;
  }

  snapshotsByCurrentPath.set(identity.currentPath, {
    expandedItemPaths: new Set(expandedPaths),
    mode,
  });
}

export function reduceFileSystemListContinuity<TRuntimeInput>(
  state: FileSystemListContinuityState<TRuntimeInput>,
  event: FileSystemListContinuityEvent<TRuntimeInput>,
): FileSystemListContinuityResult<TRuntimeInput> {
  switch (event.type) {
    case "domain.pathChanged":
      return result({
        ...state,
        modelRevision: `path:${event.path}`,
        pendingRevealPath: null,
      });
    case "domain.queryChanged":
      return result({
        ...state,
        modelRevision: event.search ? `query:${event.search}` : "query:",
        pendingRevealPath: event.search ? null : state.pendingRevealPath,
      });
    case "domain.selectionChanged":
      return result({ ...state, pendingRevealPath: event.path });
    case "domain.folderLoadSucceeded":
      return state.pendingRevealPath?.startsWith(event.path)
        ? result({
            ...state,
            modelRevision: `reveal:${state.pendingRevealPath}`,
          })
        : result(state);
    case "identity.requested":
      return requestFileSystemListContinuityIdentity(state, event.identity);
    case "snapshot.captured":
      return captureFileSystemListContinuitySnapshot({
        expandedPaths: event.expandedPaths,
        identity: event.identity,
        state,
      });
    case "model.applied":
      return applyFileSystemListContinuityModel({
        expandedPaths: event.expandedPaths,
        identity: event.identity,
        state,
      });
    case "selection.revealed":
      return result({
        ...state,
        pendingRevealPath: null,
        phase: "stable",
      });
  }
}

export function useFileSystemListContinuity<TRuntimeInput = unknown>({
  currentPath,
  search,
  selectedPath,
}: {
  currentPath: string;
  search: string;
  selectedPath: string | null;
}): FileSystemListContinuity<TRuntimeInput> {
  const [state, setState] = React.useState(() =>
    createFileSystemListContinuityState<TRuntimeInput>(),
  );
  const stateRef = React.useRef(state);

  const dispatch = React.useCallback(
    (event: FileSystemListContinuityEvent<TRuntimeInput>) => {
      const previous = stateRef.current;
      const next = reduceFileSystemListContinuity(previous, event);

      if (next.state !== previous) {
        stateRef.current = next.state;
        setState(next.state);
      }

      return next.commands;
    },
    [],
  );

  useKeyedMountEffect(joinEffectKey([currentPath, dispatch]), () => {
    dispatch({ path: currentPath, type: "domain.pathChanged" });
  });

  useKeyedMountEffect(joinEffectKey([dispatch, search]), () => {
    dispatch({ search, type: "domain.queryChanged" });
  });

  useKeyedMountEffect(joinEffectKey([dispatch, selectedPath]), () => {
    dispatch({ path: selectedPath, type: "domain.selectionChanged" });
  });

  return React.useMemo(() => ({ dispatch, state }), [dispatch, state]);
}

function requestFileSystemListContinuityIdentity<TRuntimeInput>(
  state: FileSystemListContinuityState<TRuntimeInput>,
  identity: FileSystemListContinuityIdentity<TRuntimeInput>,
): FileSystemListContinuityResult<TRuntimeInput> {
  if (!state.identity) {
    return result({ ...state, identity });
  }

  const transition = classifyFileSystemListContinuityTransition(
    state.identity,
    identity,
  );

  if (transition.kind === "same") {
    return result(state);
  }

  return result(
    {
      ...state,
      phase: "capturing",
      transition,
    },
    [{ identity: transition.previous, type: "snapshot.capture" }],
  );
}

function captureFileSystemListContinuitySnapshot<TRuntimeInput>({
  expandedPaths,
  identity,
  state,
}: {
  expandedPaths: Iterable<string>;
  identity: FileSystemListContinuityIdentity<TRuntimeInput>;
  state: FileSystemListContinuityState<TRuntimeInput>;
}): FileSystemListContinuityResult<TRuntimeInput> {
  const transition = state.transition;

  if (
    state.phase !== "capturing" ||
    !transition ||
    transition.previous !== identity
  ) {
    return result(state);
  }

  const snapshotsByCurrentPath = new Map(state.snapshotsByCurrentPath);
  rememberFileSystemListExpansionSnapshot({
    expandedPaths,
    identity,
    snapshotsByCurrentPath,
  });

  const plan = createFileSystemListContinuityPlan({
    pendingRevealPath: state.pendingRevealPath,
    snapshotsByCurrentPath,
    transition,
  });

  if (plan.kind === "none") {
    return result({
      ...state,
      phase: "stable",
      snapshotsByCurrentPath,
      transition: null,
    });
  }

  return result(
    {
      ...state,
      phase: "applying",
      snapshotsByCurrentPath,
    },
    [
      {
        expandedPaths: plan.expandedPaths,
        identity: plan.transition.next,
        nextItemPaths: plan.nextItemPaths,
        revealPath: plan.revealPath,
        type: "model.apply",
      },
    ],
  );
}

function applyFileSystemListContinuityModel<TRuntimeInput>({
  expandedPaths,
  identity,
  state,
}: {
  expandedPaths: Iterable<string>;
  identity: FileSystemListContinuityIdentity<TRuntimeInput>;
  state: FileSystemListContinuityState<TRuntimeInput>;
}): FileSystemListContinuityResult<TRuntimeInput> {
  if (state.phase !== "applying") return result(state);

  const expandedPathCount = [...expandedPaths].length;
  const nextState = {
    ...state,
    identity,
    modelRevision: `reset:${identity.currentPath}:${identity.decorationVersion}:${expandedPathCount}`,
    phase: state.pendingRevealPath
      ? ("revealing" as const)
      : ("stable" as const),
    transition: null,
  };

  return result(
    nextState,
    state.pendingRevealPath
      ? [{ path: state.pendingRevealPath, type: "selection.reveal" }]
      : [],
  );
}

function result<TRuntimeInput>(
  state: FileSystemListContinuityState<TRuntimeInput>,
  commands: FileSystemListContinuityCommand<TRuntimeInput>[] = [],
): FileSystemListContinuityResult<TRuntimeInput> {
  return { commands, state };
}

function restoreFileSystemListNormalExpansion({
  currentPath,
  nextItemPaths,
  snapshotsByCurrentPath,
}: {
  currentPath: string;
  nextItemPaths: readonly string[];
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemListExpansionSnapshot>;
}): string[] {
  const snapshot = snapshotsByCurrentPath.get(currentPath);

  return filterFileSystemListExpandedPaths({
    expandedItemPaths: snapshot?.expandedItemPaths ?? new Set(),
    nextItemPaths,
  });
}

export function collectFileSystemListDirectoryPaths(
  itemPaths: readonly string[],
): string[] {
  return itemPaths.filter((path) => path.endsWith("/"));
}

export function filterFileSystemListExpandedPaths({
  expandedItemPaths,
  nextItemPaths,
}: {
  expandedItemPaths: ReadonlySet<string>;
  nextItemPaths: readonly string[];
}): string[] {
  const nextPathSet = new Set(nextItemPaths);

  return [...expandedItemPaths].filter((path) => nextPathSet.has(path));
}
