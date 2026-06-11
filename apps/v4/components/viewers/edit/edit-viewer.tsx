"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FormField } from "@/components/viewers/lib/edit-types";

export type EditViewMode = "original" | "filled";

export interface EditViewerProps {
  detectedFields: FormField[];
  /** Whether a filled document is available (enables the "Filled" view). */
  hasFilled?: boolean;
  /** Whether the original document is available (enables the "Original" view). */
  hasOriginal?: boolean;
  isProcessing?: boolean;
  isDetecting?: boolean;
  /** Render the document for a given view. Omit to show the field table only. */
  renderDocument?: (view: EditViewMode) => ReactNode;
}

export function EditViewer({
  detectedFields,
  hasFilled = false,
  hasOriginal = false,
  isProcessing = false,
  isDetecting = false,
  renderDocument,
}: EditViewerProps) {
  const views = useMemo(() => {
    const v: EditViewMode[] = [];
    if (hasOriginal) v.push("original");
    if (hasFilled) v.push("filled");
    return v;
  }, [hasFilled, hasOriginal]);

  const [viewMode, setViewMode] = useState<EditViewMode>(
    hasFilled ? "filled" : "original",
  );
  const hasOutput = detectedFields.length > 0 || hasFilled;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {(isDetecting || isProcessing) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {isDetecting ? "Detecting form fields..." : "Filling document..."}
            </span>
          </div>
        </div>
      )}

      {!hasOutput ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
          <Pencil className="h-16 w-16 text-muted-foreground" />
          <p className="text-center text-base text-muted-foreground">
            Run edit to see output
          </p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Upload a document, add filling instructions, and click Run Edit
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {views.length > 0 && renderDocument ? (
            <>
              <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background px-2 py-1.5">
                {views.map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setViewMode(view)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                      viewMode === view
                        ? "bg-success/10 text-success-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {renderDocument(views.includes(viewMode) ? viewMode : views[0])}
              </div>
            </>
          ) : null}

          {detectedFields.length > 0 ? (
            <div className="max-h-[45%] shrink-0 overflow-auto border-t border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Field</th>
                    <th className="px-3 py-2 text-left font-medium">Value</th>
                    <th className="px-3 py-2 text-left font-medium">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedFields.map((field) => (
                    <tr key={field.key} className="border-t">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium">{field.key}</div>
                        {field.description ? (
                          <div className="text-xs text-muted-foreground">
                            {field.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {field.type === "checkbox" ? (
                          <span className="text-muted-foreground">
                            {field.value === "true" || field.value === "checked"
                              ? "Checked"
                              : "Unchecked"}
                          </span>
                        ) : field.value ? (
                          field.value
                        ) : (
                          <span className="text-muted-foreground italic">empty</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">
                        {field.bbox.page}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
