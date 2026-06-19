"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { SourceFieldLink } from "@/components/ui/source-field-link";
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

/**
 * Wraps a scalar leaf so it reports its source path on hover/focus and lights up
 * as a card when active. Without a source link, it renders children unchanged.
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
  if (!sourceLinkActions) return <>{children}</>;
  const active = activeSourcePath === sourcePath;

  return (
    <div
      onMouseEnter={() => sourceLinkActions.onSourceHover(sourcePath)}
      onMouseLeave={() => sourceLinkActions.onSourceHover(null)}
      onFocus={() => sourceLinkActions.onSourceHover(sourcePath)}
      onBlur={() => sourceLinkActions.onSourceHover(null)}
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
