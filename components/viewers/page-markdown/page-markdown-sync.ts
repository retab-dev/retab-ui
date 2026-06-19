"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

export type PageMarkdownSyncPane = "markdown" | "document";

export interface PageMarkdownSyncState {
  pageNumber: number;
  pane: PageMarkdownSyncPane;
}

export interface PendingPageMarkdownScroll {
  pageNumber: number;
  pane: PageMarkdownSyncPane;
}

export interface PageMarkdownSyncTransition {
  confirmed: boolean;
  pending: PendingPageMarkdownScroll | null;
  scrollTarget: PendingPageMarkdownScroll | null;
  state: PageMarkdownSyncState;
}

export function initialPageMarkdownSyncState(): PageMarkdownSyncState {
  return { pageNumber: 1, pane: "markdown" };
}

export function resolvePageMarkdownSyncReport({
  state,
  pending,
  pane,
  pageNumber,
}: {
  state: PageMarkdownSyncState;
  pending: PendingPageMarkdownScroll | null;
  pane: PageMarkdownSyncPane;
  pageNumber: number;
}): PageMarkdownSyncTransition {
  const nextPageNumber = Math.max(
    1,
    Number.isFinite(pageNumber) ? Math.floor(pageNumber) : 1,
  );

  if (pending?.pane === pane && pending.pageNumber === nextPageNumber) {
    return {
      confirmed: true,
      pending: null,
      scrollTarget: null,
      state: {
        pageNumber: nextPageNumber,
        pane,
      },
    };
  }

  if (pending?.pane === pane) {
    return {
      confirmed: false,
      pending,
      scrollTarget: null,
      state,
    };
  }

  if (!pending && state.pageNumber === nextPageNumber && state.pane === pane) {
    return {
      confirmed: false,
      pending: null,
      scrollTarget: null,
      state,
    };
  }

  if (!pending && state.pageNumber === nextPageNumber) {
    return {
      confirmed: false,
      pending: null,
      scrollTarget: null,
      state: {
        pageNumber: nextPageNumber,
        pane,
      },
    };
  }

  const targetPane: PageMarkdownSyncPane =
    pane === "markdown" ? "document" : "markdown";
  const nextState = {
    pageNumber: nextPageNumber,
    pane,
  };
  const nextPending = {
    pageNumber: nextPageNumber,
    pane: targetPane,
  };

  return {
    confirmed: false,
    pending: nextPending,
    scrollTarget: nextPending,
    state: nextState,
  };
}

export function usePageMarkdownSync({
  onMarkdownPageChange,
  pageCount,
  resetKey,
}: {
  onMarkdownPageChange?: (pageNumber: number) => void;
  pageCount?: number;
  resetKey?: string;
}) {
  const [state, setState] = React.useState(initialPageMarkdownSyncState);
  const stateRef = React.useRef(state);
  const pendingRef = React.useRef<PendingPageMarkdownScroll | null>(null);
  const pageCountLimit = Math.max(1, pageCount ?? 1);

  React.useEffect(() => {
    const nextState = initialPageMarkdownSyncState();
    stateRef.current = nextState;
    pendingRef.current = null;
    setState(nextState);
  }, [resetKey]);

  React.useEffect(() => {
    const currentState = stateRef.current;
    const nextPageNumber = Math.min(currentState.pageNumber, pageCountLimit);
    const nextState =
      nextPageNumber === currentState.pageNumber
        ? currentState
        : {
            ...currentState,
            pageNumber: nextPageNumber,
          };
    const currentPending = pendingRef.current;

    stateRef.current = nextState;
    pendingRef.current =
      currentPending && currentPending.pageNumber <= pageCountLimit
        ? currentPending
        : null;
    setState(nextState);
  }, [pageCountLimit]);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reportPage = React.useCallback(
    (pane: PageMarkdownSyncPane, pageNumber: number) => {
      const transition = resolvePageMarkdownSyncReport({
        state: stateRef.current,
        pending: pendingRef.current,
        pane,
        pageNumber,
      });

      stateRef.current = transition.state;
      pendingRef.current = transition.pending;
      setState(transition.state);

      if (transition.state.pane === "markdown" && !transition.confirmed) {
        onMarkdownPageChange?.(transition.state.pageNumber);
      }

      return transition.scrollTarget;
    },
    [onMarkdownPageChange],
  );

  return {
    currentPage: state.pageNumber,
    reportDocumentPage: React.useCallback(
      (pageNumber: number) => reportPage("document", pageNumber),
      [reportPage],
    ),
    reportMarkdownPage: React.useCallback(
      (pageNumber: number) => reportPage("markdown", pageNumber),
      [reportPage],
    ),
  };
}
