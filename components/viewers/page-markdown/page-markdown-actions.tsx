"use client";

import * as React from "react";
import { Check, Copy, Download, MoreHorizontal } from "lucide-react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { createTextDownloadAction } from "@/lib/viewer-download-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import {
  useViewerDownloadTrigger,
  type ViewerDownloadErrorHandler,
} from "@/components/ui/viewer-download";

type CopyStatus = "idle" | "copied" | "failed";

function scheduleCopyStatusReset(
  timeoutRef: React.MutableRefObject<number | null>,
  setStatus: React.Dispatch<React.SetStateAction<CopyStatus>>,
) {
  timeoutRef.current = window.setTimeout(() => {
    timeoutRef.current = null;
    setStatus("idle");
  }, 1200);
}

function clearCopyStatusReset(
  timeoutRef: React.MutableRefObject<number | null>,
) {
  if (timeoutRef.current === null) return;
  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
}

export function MarkdownActionButtons({
  text,
  fileName,
  onDownloadError,
}: {
  text: string;
  fileName: string;
  onDownloadError?: ViewerDownloadErrorHandler;
}) {
  return (
    <>
      <CopyMarkdownButton text={text} />
      <DownloadMarkdownButton
        text={text}
        fileName={fileName}
        onDownloadError={onDownloadError}
      />
    </>
  );
}

export function MarkdownActionsMenu({
  text,
  fileName,
  onDownloadError,
}: {
  text: string;
  fileName: string;
  onDownloadError?: ViewerDownloadErrorHandler;
}) {
  const copy = useCopyMarkdown(text);
  const download = useDownloadMarkdown(text, fileName, onDownloadError);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          className="size-7"
          aria-label="More markdown actions"
          title="More markdown actions"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={copy.write}>
          <Copy />
          {copy.status === "copied"
            ? "Copied"
            : copy.status === "failed"
              ? "Copy failed"
              : "Copy markdown"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={download.isPending}
          onClick={download.trigger}
        >
          <Download />
          Download markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CopyMarkdownButton({ text }: { text: string }) {
  const copy = useCopyMarkdown(text);

  return (
    <Button
      variant="ghost"
      size="iconSm"
      className="size-7"
      aria-label={copy.status === "failed" ? "Copy failed" : "Copy markdown"}
      title={copy.status === "failed" ? "Copy failed" : "Copy all markdown"}
      onClick={copy.write}
    >
      {copy.status === "copied" ? (
        <Check className="text-emerald-600" />
      ) : (
        <Copy className={copy.status === "failed" ? "text-destructive" : ""} />
      )}
    </Button>
  );
}

function DownloadMarkdownButton({
  text,
  fileName,
  onDownloadError,
}: {
  text: string;
  fileName: string;
  onDownloadError?: ViewerDownloadErrorHandler;
}) {
  const download = useDownloadMarkdown(text, fileName, onDownloadError);

  return (
    <Button
      variant="ghost"
      size="iconSm"
      className="size-7"
      aria-label="Download markdown"
      title="Download markdown"
      disabled={download.isPending}
      onClick={download.trigger}
    >
      {download.isPending ? (
        <Spinner className="size-4 animate-spin" />
      ) : (
        <Download />
      )}
    </Button>
  );
}

function useCopyMarkdown(text: string) {
  const [status, setStatus] = React.useState<CopyStatus>("idle");
  const timeoutRef = React.useRef<number | null>(null);
  const isMountedRef = React.useRef(true);
  const copyAttemptRef = React.useRef(0);

  useMountEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearCopyStatusReset(timeoutRef);
    };
  });

  const write = React.useCallback(() => {
    clearCopyStatusReset(timeoutRef);
    const copyAttempt = copyAttemptRef.current + 1;
    copyAttemptRef.current = copyAttempt;

    const isCurrentCopyAttempt = () =>
      isMountedRef.current && copyAttemptRef.current === copyAttempt;

    try {
      const clipboard = navigator.clipboard;
      const writeText = clipboard?.writeText;
      if (typeof writeText !== "function") {
        setStatus("failed");
        scheduleCopyStatusReset(timeoutRef, setStatus);
        return;
      }

      Promise.resolve(writeText.call(clipboard, text)).then(
        () => {
          if (!isCurrentCopyAttempt()) return;
          setStatus("copied");
          scheduleCopyStatusReset(timeoutRef, setStatus);
        },
        () => {
          if (!isCurrentCopyAttempt()) return;
          setStatus("failed");
          scheduleCopyStatusReset(timeoutRef, setStatus);
        },
      );
    } catch {
      setStatus("failed");
      scheduleCopyStatusReset(timeoutRef, setStatus);
    }
  }, [text]);

  return { status, write };
}

function useDownloadMarkdown(
  text: string,
  fileName: string | undefined,
  onError: ViewerDownloadErrorHandler | undefined,
) {
  const action = React.useMemo(
    () => downloadMarkdownAction(text, fileName),
    [fileName, text],
  );
  const { pendingActionId, triggerDownload } = useViewerDownloadTrigger({
    onError,
    resetKey: action,
  });
  const trigger = React.useCallback(() => {
    triggerDownload(action);
  }, [action, triggerDownload]);

  return {
    isPending: pendingActionId === action.id,
    trigger,
  };
}

export function normalizeMarkdownFileName(fileName?: string): string {
  const trimmed = fileName?.trim();
  if (!trimmed) return "document.md";
  if (/\.(?:md|markdown)$/i.test(trimmed)) return trimmed;

  const slashIndex = Math.max(
    trimmed.lastIndexOf("/"),
    trimmed.lastIndexOf("\\"),
  );
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex > slashIndex + 1) return `${trimmed.slice(0, dotIndex)}.md`;

  return `${trimmed}.md`;
}

export function downloadMarkdownAction(text: string, fileName?: string) {
  return createTextDownloadAction({
    id: "download-markdown",
    label: "Download markdown",
    text,
    fileName: normalizeMarkdownFileName(fileName),
    mimeType: "text/markdown;charset=utf-8",
    origin: "derived",
  });
}
