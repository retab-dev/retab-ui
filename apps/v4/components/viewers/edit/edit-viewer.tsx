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
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="text-sm text-gray-500">
              {isDetecting ? "Detecting form fields..." : "Filling document..."}
            </span>
          </div>
        </div>
      )}

      {!hasOutput ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
          <Pencil className="h-16 w-16 text-gray-200" />
          <p className="text-center text-base text-gray-500">
            Run edit to see output
          </p>
          <p className="max-w-sm text-center text-sm text-gray-400">
            Upload a document, add filling instructions, and click Run Edit
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {views.length > 0 && renderDocument ? (
            <>
              <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-2 py-1.5">
                {views.map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setViewMode(view)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                      viewMode === view
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-500 hover:bg-gray-100",
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
            <div className="max-h-[45%] shrink-0 overflow-auto border-t border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
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
                          <div className="text-xs text-gray-500">
                            {field.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {field.type === "checkbox" ? (
                          <span className="text-gray-600">
                            {field.value === "true" || field.value === "checked"
                              ? "Checked"
                              : "Unchecked"}
                          </span>
                        ) : field.value ? (
                          field.value
                        ) : (
                          <span className="text-gray-400 italic">empty</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top tabular-nums text-gray-500">
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
