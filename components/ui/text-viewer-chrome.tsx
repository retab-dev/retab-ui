"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { type ViewerDownloadAction } from "@/lib/viewer-download-actions";

import { Skeleton } from "./skeleton";
import { TextCodeViewerFrame } from "./text-code-viewer-chrome";
import {
  ViewerControls,
  ViewerControlButton,
  ViewerControlsSkeleton,
} from "./viewer-controls";

export function TextViewerFrame({
  className,
  bare,
  children,
}: {
  className?: string;
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TextCodeViewerFrame
      bare={bare}
      bareClassName="h-full bg-background"
      className={className}
      dataSlot="text-viewer"
      framedClassName="rounded-xl border bg-background"
    >
      {children}
    </TextCodeViewerFrame>
  );
}

export function TextViewerFallback({
  className,
  controls = true,
  bare,
}: {
  className?: string;
  controls?: boolean;
  bare?: boolean;
}) {
  return (
    <TextViewerFrame className={className} bare={bare}>
      {controls ? <ViewerControlsSkeleton title zoom download /> : null}
      <div
        className="min-h-0 flex-1 space-y-3 overflow-hidden p-5"
        data-slot="text-body-skeleton"
      >
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-4"
            style={{ width: `${48 + ((index * 17) % 44)}%` }}
          />
        ))}
      </div>
    </TextViewerFrame>
  );
}

export function TextViewerControls({
  wordCount,
  fontScale,
  copyText,
  copyLabel = "Copy text",
  downloadAction,
  leading,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  wordCount: number;
  fontScale: number;
  copyText?: string;
  copyLabel?: string;
  downloadAction: ViewerDownloadAction;
  leading?: React.ReactNode;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
}) {
  return (
    <ViewerControls
      title={leading ?? `${wordCount} word${wordCount === 1 ? "" : "s"}`}
      zoom={{
        scale: fontScale,
        onZoomOut,
        onZoomIn,
        onFit: onResetZoom,
        fitLabel: "Reset zoom",
      }}
      downloads={[downloadAction]}
      extra={
        copyText == null ? null : (
          <TextViewerCopyControl label={copyLabel} text={copyText} />
        )
      }
    />
  );
}

function TextViewerCopyControl({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const [isCopied, setIsCopied] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  useMountEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  });

  const copyText = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);

    try {
      const result = navigator.clipboard?.writeText(text);
      void Promise.resolve(result).then(() => {
        setIsCopied(true);
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          setIsCopied(false);
        }, 1200);
      });
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <ViewerControlButton
      label={isCopied ? "Copied" : label}
      onClick={copyText}
      type="button"
    >
      {isCopied ? <Check /> : <Copy />}
    </ViewerControlButton>
  );
}
