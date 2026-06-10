"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Braces,
  Download,
  KeyRound,
  Layers,
  Loader2,
  MoreHorizontal,
  ScanText,
  Scissors,
  SquarePen,
  Tags,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type PrimitiveViewerOperation =
  | "extract"
  | "parse"
  | "edit"
  | "split"
  | "classify"
  | "partition";

export interface PrimitiveOperationMetadata {
  label: string;
  viewerName: string;
  color: string;
  Icon: LucideIcon;
}

export const PRIMITIVE_OPERATION_METADATA: Record<
  PrimitiveViewerOperation,
  PrimitiveOperationMetadata
> = {
  extract: {
    label: "Extract",
    viewerName: "Extract viewer",
    color: "#8b5cf6",
    Icon: Layers,
  },
  parse: {
    label: "Parse",
    viewerName: "Parse viewer",
    color: "#06b6d4",
    Icon: ScanText,
  },
  edit: {
    label: "Edit",
    viewerName: "Edit viewer",
    color: "#10b981",
    Icon: SquarePen,
  },
  split: {
    label: "Split",
    viewerName: "Split viewer",
    color: "#f59e0b",
    Icon: Scissors,
  },
  classify: {
    label: "Classify",
    viewerName: "Classify viewer",
    color: "#14b8a6",
    Icon: Tags,
  },
  partition: {
    label: "Partition",
    viewerName: "Partition viewer",
    color: "#6366f1",
    Icon: KeyRound,
  },
};

export interface PrimitiveViewerDownloadAction {
  id: string;
  label: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadBuffer({
  buffer,
  filename,
  mimeType,
}: {
  buffer: ArrayBuffer;
  filename: string;
  mimeType: string;
}) {
  downloadBlob(new Blob([buffer], { type: mimeType }), filename);
}

export function downloadJson(data: unknown, filename: string) {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    filename,
  );
}

export function downloadMarkdown(markdown: string, filename: string) {
  downloadBlob(new Blob([markdown], { type: "text/markdown" }), filename);
}

export function buildMarkdownFromPages(pages: string[]) {
  return pages
    .map((page, index) => {
      const pageHeader =
        pages.length > 1 ? `\n\n---\n# Page ${index + 1}\n\n` : "";
      return index === 0 ? page : pageHeader + page;
    })
    .join("");
}

export interface PrimitiveViewerHeaderProps {
  operation: PrimitiveViewerOperation;
  contextText?: string | null;
  operationLabel?: string;
  actions?: PrimitiveViewerDownloadAction[];
  accessory?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function PrimitiveViewerHeader({
  operation,
  contextText,
  operationLabel,
  actions = [],
  accessory,
  onClose,
  className,
}: PrimitiveViewerHeaderProps) {
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const metadata = PRIMITIVE_OPERATION_METADATA[operation];
  const Icon = metadata.Icon;
  const visibleActions = actions.filter((action) => !action.disabled);

  const runAction = useCallback(
    async (action: PrimitiveViewerDownloadAction) => {
      setRunningActionId(action.id);
      try {
        await action.run();
      } catch (error) {
        console.error("Primitive viewer action failed:", error);
        toast.error("Download failed");
      } finally {
        setRunningActionId(null);
      }
    },
    [],
  );

  return (
    <div
      className={cn(
        "flex h-[39px] flex-shrink-0 items-center border-b border-gray-200 bg-white pr-1 pl-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Icon
          className="h-4 w-4 flex-shrink-0"
          style={{ color: metadata.color }}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-950">
            {operationLabel ?? metadata.label}
          </h3>
          {contextText ? (
            <p className="truncate text-xs font-medium text-gray-500">
              {contextText}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {accessory}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Open primitive viewer actions"
              disabled={visibleActions.length === 0}
            >
              {runningActionId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-gray-500">
              <Braces className="h-3.5 w-3.5" />
              Downloads
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleActions.length > 0 ? (
              visibleActions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  disabled={runningActionId !== null}
                  onSelect={(event) => {
                    event.preventDefault();
                    void runAction(action);
                  }}
                  className="text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{action.label}</span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled className="text-xs">
                No downloads available
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {onClose ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close primitive viewer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PrimitiveViewerBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      {children}
    </div>
  );
}

export interface PrimitiveViewerShellProps extends PrimitiveViewerHeaderProps {
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}

export function PrimitiveViewerShell({
  children,
  bodyClassName,
  className,
  ...headerProps
}: PrimitiveViewerShellProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-white", className)}>
      <PrimitiveViewerHeader {...headerProps} />
      <PrimitiveViewerBody className={bodyClassName}>
        {children}
      </PrimitiveViewerBody>
    </div>
  );
}
