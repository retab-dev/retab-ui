"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { SourceFieldLink } from "@/components/ui/source-field-link";
import { useSourceLinkFocusPreviewIntent } from "@/components/json-form/source-link-focus-intent";
import {
  useSourceTableHoverController,
  type JsonFormSourceLinkActions,
} from "@/components/json-form/source-link-table-hover";

export type JsonFormSourceLink = SourceFieldLink;

const ActiveSourcePathContext = React.createContext<string | null>(null);
const SourceLinkActionsContext =
  React.createContext<JsonFormSourceLinkActions | null>(null);

export function JsonFormSourceLinkProvider({
  sourceLink,
  children,
}: {
  sourceLink?: JsonFormSourceLink;
  children: React.ReactNode;
}) {
  const onSourceHover = sourceLink?.onSourceHover;
  const selectSourcePath = sourceLink?.selectSourcePath;
  const sourceLinkActions = React.useMemo<JsonFormSourceLinkActions | null>(
    () => (onSourceHover ? { onSourceHover, selectSourcePath } : null),
    [onSourceHover, selectSourcePath],
  );

  return (
    <SourceLinkActionsContext.Provider value={sourceLinkActions}>
      <ActiveSourcePathContext.Provider
        value={sourceLink?.activeSourcePath ?? null}
      >
        {children}
      </ActiveSourcePathContext.Provider>
    </SourceLinkActionsContext.Provider>
  );
}

export function useActiveSourcePath(): string | null {
  return React.useContext(ActiveSourcePathContext);
}

export function useSourceLinkActions(): JsonFormSourceLinkActions | null {
  return React.useContext(SourceLinkActionsContext);
}

export function useSourceLinkedTableCells({
  tableRef,
  refreshKey,
}: {
  tableRef: React.RefObject<HTMLElement | null>;
  refreshKey: unknown;
}) {
  return useSourceTableHoverController({
    activeSourcePath: useActiveSourcePath(),
    refreshKey,
    sourceLinkActions: useSourceLinkActions(),
    tableRef,
  });
}

function shouldSelectSourceFromKeyDown(event: React.KeyboardEvent): boolean {
  if (event.defaultPrevented || event.key !== "Enter") return false;
  return !(event.target instanceof HTMLTextAreaElement);
}

function shouldPreviewSourceFromPointerMove(
  event: React.PointerEvent,
): boolean {
  return !event.defaultPrevented && event.pointerType !== "touch";
}

/**
 * Wraps a scalar leaf so it reports its source path from explicit pointer or
 * keyboard intent. Without a source link, it renders children unchanged.
 */
export function SourceLinkShell({
  sourcePath,
  children,
}: {
  sourcePath: string;
  children: React.ReactNode;
}) {
  const activeSourcePath = useActiveSourcePath();
  const sourceLinkActions = useSourceLinkActions();
  const shouldPreviewFocus = useSourceLinkFocusPreviewIntent();
  const focusPreviewedRef = React.useRef(false);
  const pointerPreviewedRef = React.useRef(false);
  if (!sourceLinkActions) return <>{children}</>;
  const active = activeSourcePath === sourcePath;

  const clearPreviewIfIdle = () => {
    if (focusPreviewedRef.current || pointerPreviewedRef.current) return;
    sourceLinkActions.onSourceHover(null);
  };

  return (
    <div
      data-source-active={active ? "true" : "false"}
      data-source-path={sourcePath}
      onPointerMove={(event) => {
        if (
          pointerPreviewedRef.current ||
          !shouldPreviewSourceFromPointerMove(event)
        ) {
          return;
        }
        pointerPreviewedRef.current = true;
        sourceLinkActions.onSourceHover(sourcePath);
      }}
      onPointerLeave={() => {
        if (!pointerPreviewedRef.current) return;
        pointerPreviewedRef.current = false;
        clearPreviewIfIdle();
      }}
      onFocus={(event) => {
        if (!shouldPreviewFocus(event)) return;
        focusPreviewedRef.current = true;
        sourceLinkActions.onSourceHover(sourcePath);
      }}
      onBlur={() => {
        if (!focusPreviewedRef.current) return;
        focusPreviewedRef.current = false;
        clearPreviewIfIdle();
      }}
      onClick={() => sourceLinkActions.selectSourcePath?.(sourcePath)}
      onKeyDownCapture={(event) => {
        if (shouldSelectSourceFromKeyDown(event)) {
          sourceLinkActions.selectSourcePath?.(sourcePath);
        }
      }}
      className={cn(
        "rounded-md border px-3 py-2 transition-colors",
        active
          ? "border-primary/40 bg-primary/5"
          : "hover:bg-muted/60 border-transparent",
      )}
    >
      {children}
    </div>
  );
}
