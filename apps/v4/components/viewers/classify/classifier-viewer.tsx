"use client";

import { type ReactNode } from "react";
import { Loader2, Tags } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import type {
  ClassifierResultViewerInput,
  ClassifyResult,
} from "@/components/viewers/lib/classify-types";

export interface ClassifierViewerProps {
  result: ClassifyResult | null;
  documentInput: ClassifierResultViewerInput;
  isProcessing?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Render the source document for file inputs. Omit for a placeholder. */
  renderDocument?: () => ReactNode;
}

export function ClassifierViewer({
  result,
  documentInput,
  isProcessing = false,
  emptyTitle = "Run classify to see output",
  emptyDescription = "Provide input, define categories, and click Run Classify",
  renderDocument,
}: ClassifierViewerProps) {
  const hasOutput = result !== null;
  const hasDocument =
    documentInput.type === "file"
      ? Boolean(documentInput.fileBuffer)
      : Boolean(documentInput.textValue?.trim());
  const classification = result?.category ?? null;
  const classificationReasoning = result?.reasoning?.trim() || null;

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          {hasOutput && classification ? (
            <div className="absolute top-4 left-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-2">
              {classificationReasoning ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex max-w-full shrink-0 cursor-help items-center gap-2 rounded-full bg-teal-50/95 px-3 py-1 text-xs font-medium text-teal-700 shadow-sm ring-1 ring-teal-200 transition-colors ring-inset hover:bg-teal-100 focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none"
                    >
                      <Tags className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                      <span className="truncate">{classification}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    className="max-w-md text-xs leading-relaxed whitespace-pre-wrap"
                  >
                    {classificationReasoning}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="inline-flex max-w-full shrink-0 items-center gap-2 rounded-full bg-teal-50/95 px-3 py-1 text-xs font-medium text-teal-700 shadow-sm ring-1 ring-teal-200 ring-inset">
                  <Tags className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                  <span className="truncate">{classification}</span>
                </div>
              )}
            </div>
          ) : null}
          {isProcessing && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full bg-teal-50/95 px-3 py-1 shadow-sm ring-1 ring-teal-200 ring-inset">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
              <span className="text-xs font-medium text-teal-600">
                Classifying...
              </span>
            </div>
          )}
          {!hasOutput ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
              <Tags className="h-16 w-16 text-gray-200" />
              <p className="text-center text-base text-gray-500">{emptyTitle}</p>
              <p className="max-w-sm text-center text-sm text-gray-400">
                {emptyDescription}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-hidden bg-gray-100">
                {documentInput.type === "file" ? (
                  hasDocument && documentInput.fileBuffer && renderDocument ? (
                    renderDocument()
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-sm text-gray-500">
                        No document available
                      </span>
                    </div>
                  )
                ) : (
                  <div className="h-full overflow-auto p-4">
                    <pre
                      className={cn(
                        "rounded-lg p-3 text-xs break-words whitespace-pre-wrap",
                        documentInput.type === "json"
                          ? "bg-violet-50 font-mono text-violet-800"
                          : "bg-cyan-50 text-cyan-800",
                      )}
                    >
                      {documentInput.textValue || "No input provided"}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
