"use client";

import { ScanText } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";

export function PageMarkdownEmptyState({
  isProcessing,
  processingLabel,
}: {
  isProcessing: boolean;
  processingLabel: string;
}) {
  return (
    <div className="bg-muted/30 text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8">
      {isProcessing ? (
        <>
          <Spinner className="text-primary size-8" />
          <p className="text-sm">{processingLabel}</p>
        </>
      ) : (
        <>
          <ScanText className="size-12 opacity-60" />
          <div className="space-y-1 text-center">
            <p className="text-foreground text-sm font-medium">
              No markdown pages yet
            </p>
            <p className="max-w-xs text-xs">
              Provide page-by-page markdown to see the rendered document here.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
