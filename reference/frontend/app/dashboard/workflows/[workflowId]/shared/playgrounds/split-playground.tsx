"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useState,
  useMemo,
  useRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { prepare, layout } from "@chenglou/pretext";
import { useMountEffect } from "@/hooks/useMountEffect";
import { toast } from "sonner";
import {
  Scissors,
  Loader2,
  Tags,
  Plus,
  X,
  ChevronRight,
  Code,
  GripVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import type { OnMount } from "@monaco-editor/react";
import VectorSquare from "@/public/icons/vector-square.svg";
import type { PdfViewerHandle } from "@/app/(website)/politaxsplit/pdf-viewer";

import {
  asSplitView,
  type SplitConfig,
  type SplitConfigSubdocument,
  type SplitView,
} from "@/app/dashboard/widgets/types/split";
import type { Split } from "@/types";
import { MIMEData } from "@/app/dashboard/widgets/types/mime";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import type { Workflow } from "@/app/dashboard/shared/workflows/types/workflows";

import {
  ExecutePlayground,
  PlaygroundCanvas,
  InputState,
  RequirementItem,
  ProcessingNodeSection,
  createFileInput,
  hasInputValue,
} from "./execute-playground";
import { SPLIT_SUPPORTED_FILE_ACCEPT } from "./file-accepts";
import { inputStateToUrlBackedMIMEData } from "./upload-input-state";
import {
  buildPageRuns,
  buildSplitDiagramRows,
  buildSplitDiagramColorMap,
  getMaxSplitDiagramPage,
} from "./split-segment-diagram-utils";

const MonacoEditor = dynamic(
  () =>
    import("@monaco-editor/react").then(
      (componentModule) => componentModule.Editor,
    ),
  { loading: () => null },
);

const SplitPdfViewer = dynamic(
  () =>
    import("@/app/(website)/politaxsplit/pdf-viewer").then(
      (componentModule) => componentModule.PdfViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

const SplitModelCard = dynamic(
  () =>
    import(
      "@/app/dashboard/workflows/[workflowId]/shared/blocks/registry/split-model-card"
    ).then((componentModule) => componentModule.SplitModelCard),
  { loading: () => null },
);

const SplitSegmentDiagram = dynamic(
  () =>
    import("./split-segment-diagram").then(
      (componentModule) => componentModule.SplitSegmentDiagram,
    ),
  { loading: () => null },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Types (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

/** Format a list of page numbers into compact ranges, e.g. [1,5,6] → "1, 5-6" */
export function formatPageRanges(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "text-emerald-600";
  if (confidence >= 0.7) return "text-amber-600";
  return "text-red-600";
}

export function normalizeSplitViewerResult(result: unknown): SplitView | null {
  const splitView = asSplitView(result as Parameters<typeof asSplitView>[0]);
  if (splitView) return splitView;

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const legacyResult = result as {
    splits?: unknown;
    consensus?: SplitView["consensus"];
    usage?: SplitView["usage"];
  };
  if (!Array.isArray(legacyResult.splits)) {
    return null;
  }

  return {
    output: legacyResult.splits.flatMap((split) => {
      if (!split || typeof split !== "object" || Array.isArray(split)) {
        return [];
      }
      const rawSplit = split as { name?: unknown; pages?: unknown };
      if (typeof rawSplit.name !== "string") {
        return [];
      }
      return [
        {
          name: rawSplit.name,
          pages: Array.isArray(rawSplit.pages)
            ? rawSplit.pages.filter(
                (page): page is number =>
                  typeof page === "number" &&
                  Number.isInteger(page) &&
                  page > 0,
              )
            : [],
          partitions: [],
        },
      ];
    }),
    consensus: legacyResult.consensus ?? null,
    usage: legacyResult.usage ?? null,
  };
}

interface SplitBlockExecutionPlaygroundProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SplitConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // When set, the user lacks `workflow:run` (page-owned capability gate). The
  // Run button stays visible but disabled; the dialog itself remains openable.
  runDisabledReason?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Categories Section Component (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

interface SubdocumentsSectionProps {
  subdocuments: SplitConfigSubdocument[];
  onSubdocumentsChange: (subdocuments: SplitConfigSubdocument[]) => void;
}

type DraftSubdocument = SplitConfigSubdocument & {
  draft_id: string;
};

let draftIdCounter = 0;

function createDraftId() {
  draftIdCounter += 1;
  return `split_subdocument_${draftIdCounter}`;
}

function createDraftSubdocument(
  subdocument?: Partial<SplitConfigSubdocument>,
): DraftSubdocument {
  return {
    draft_id: createDraftId(),
    name: subdocument?.name ?? "",
    description: subdocument?.description ?? "",
  };
}

function isSubdocumentSavable(
  subdocument: Pick<SplitConfigSubdocument, "name">,
) {
  return subdocument.name.trim().length > 0;
}

function toPersistedSubdocument(
  subdocument: DraftSubdocument,
): SplitConfigSubdocument {
  return {
    name: subdocument.name.trim(),
    description: subdocument.description,
  };
}

type AutoResizeTextareaMetrics = {
  width: number;
  font: string;
  lineHeight: number;
  padTop: number;
  padBottom: number;
  padX: number;
};

const AUTO_RESIZE_MIN_HEIGHT = 24;

function readAutoResizeMetrics(
  textarea: HTMLTextAreaElement,
  width: number,
): AutoResizeTextareaMetrics {
  const computed = window.getComputedStyle(textarea);
  const fontSize = parseFloat(computed.fontSize) || 12;
  // `system-ui` is unsafe for pretext's layout() accuracy on macOS. Strip it
  // so the named fallback family (Inter/Arial/etc.) wins instead.
  const fontFamily =
    computed.fontFamily.replace(/system-ui\s*,?\s*/gi, "").trim() ||
    "Arial, sans-serif";
  const fontWeight = computed.fontWeight || "400";
  const fontStylePrefix = computed.fontStyle === "italic" ? "italic " : "";
  const font = `${fontStylePrefix}${fontWeight} ${fontSize}px ${fontFamily}`;
  const lineHeightRaw = computed.lineHeight;
  const lineHeight =
    lineHeightRaw && lineHeightRaw !== "normal"
      ? parseFloat(lineHeightRaw) || Math.round(fontSize * 1.2)
      : Math.round(fontSize * 1.2);
  const padTop = parseFloat(computed.paddingTop) || 0;
  const padBottom = parseFloat(computed.paddingBottom) || 0;
  const padLeft = parseFloat(computed.paddingLeft) || 0;
  const padRight = parseFloat(computed.paddingRight) || 0;
  return {
    width,
    font,
    lineHeight,
    padTop,
    padBottom,
    padX: padLeft + padRight,
  };
}

function AutoResizeTextarea({
  value,
  className,
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [metrics, setMetrics] = useState<AutoResizeTextareaMetrics | null>(
    null,
  );

  useMountEffect(() => {
    const textarea = textareaRef.current;
    const container = textarea?.parentElement;
    if (!textarea || !container) {
      return;
    }

    setMetrics(readAutoResizeMetrics(textarea, container.clientWidth));

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextWidth = Math.floor(entry.contentRect.width);
        setMetrics((previous) => {
          if (!previous || previous.width === nextWidth) return previous;
          return { ...previous, width: nextWidth };
        });
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  });

  const measuredHeight = useMemo(() => {
    if (!metrics) return null;
    const { width, font, lineHeight, padTop, padBottom, padX } = metrics;
    const contentWidth = Math.max(0, width - padX);
    const stringValue = typeof value === "string" ? value : String(value ?? "");
    if (contentWidth <= 0 || stringValue.length === 0) {
      return AUTO_RESIZE_MIN_HEIGHT;
    }
    try {
      const prepared = prepare(stringValue, font, { whiteSpace: "pre-wrap" });
      const { height } = layout(prepared, contentWidth, lineHeight);
      return Math.max(
        Math.ceil(height + padTop + padBottom),
        AUTO_RESIZE_MIN_HEIGHT,
      );
    } catch {
      return AUTO_RESIZE_MIN_HEIGHT;
    }
  }, [metrics, value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      rows={1}
      className={cn(className, "overflow-hidden")}
      style={
        measuredHeight !== null
          ? { ...style, height: `${measuredHeight}px` }
          : style
      }
    />
  );
}

export function SubdocumentsSection({
  subdocuments,
  onSubdocumentsChange,
}: SubdocumentsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localSubdocuments, setLocalSubdocuments] = useState<
    DraftSubdocument[]
  >(() => subdocuments.map(createDraftSubdocument));
  const [activeView, setActiveView] = useState<"builder" | "code">("builder");
  const [editorValue, setEditorValue] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

  const tabsConfig = useMemo(
    () => [
      {
        label: "Builder",
        value: "builder",
        icon: <VectorSquare className="h-4 w-4" />,
      },
      { label: "Code", value: "code", icon: <Code className="h-4 w-4" /> },
    ],
    [],
  );

  const summarySubdocuments = useMemo(
    () =>
      subdocuments.filter((subdocument) => isSubdocumentSavable(subdocument)),
    [subdocuments],
  );
  const persistedDrafts = useMemo(
    () =>
      localSubdocuments
        .filter(isSubdocumentSavable)
        .map(toPersistedSubdocument),
    [localSubdocuments],
  );
  const handleEditorMount = useCallback<OnMount>((editor) => {
    editor.layout();
    requestAnimationFrame(() => {
      editor.layout();
    });
  }, []);

  const resetDraftState = useCallback(() => {
    setLocalSubdocuments(subdocuments.map(createDraftSubdocument));
    setEditorValue(JSON.stringify(subdocuments, null, 2));
    setActiveView("builder");
    setDragOverIndex(null);
    draggedIndexRef.current = null;
  }, [subdocuments]);

  const handleOpen = useCallback(() => {
    resetDraftState();
    setIsDialogOpen(true);
  }, [resetDraftState]);

  const handleViewChange = useCallback(
    (value: string) => {
      const nextView = value as "builder" | "code";
      setActiveView(nextView);
      if (nextView === "code") {
        setEditorValue(JSON.stringify(persistedDrafts, null, 2));
      }
    },
    [persistedDrafts],
  );

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDraftState();
      }
      setIsDialogOpen(open);
    },
    [resetDraftState],
  );

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value) {
      return;
    }

    setEditorValue(value);

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        setLocalSubdocuments(
          parsed.map((subdocument) => createDraftSubdocument(subdocument)),
        );
      }
    } catch {
      // Keep the raw editor value so users can fix malformed JSON.
    }
  }, []);

  const updateDraftSubdocument = useCallback(
    (draftId: string, field: "name" | "description", value: string) => {
      setLocalSubdocuments((currentSubdocuments) =>
        currentSubdocuments.map((subdocument) =>
          subdocument.draft_id === draftId
            ? {
                ...subdocument,
                [field]: value,
              }
            : subdocument,
        ),
      );
    },
    [],
  );

  const removeDraftSubdocument = useCallback((draftId: string) => {
    setLocalSubdocuments((currentSubdocuments) =>
      currentSubdocuments.filter(
        (subdocument) => subdocument.draft_id !== draftId,
      ),
    );
  }, []);

  const addSubdocument = useCallback(() => {
    setLocalSubdocuments((currentSubdocuments) => [
      ...currentSubdocuments,
      createDraftSubdocument(),
    ]);
  }, []);

  const handleSave = useCallback(() => {
    onSubdocumentsChange(persistedDrafts);
    setIsDialogOpen(false);
  }, [onSubdocumentsChange, persistedDrafts]);

  const handleDragStart = useCallback(
    (event: React.DragEvent, sourceIndex: number) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      draggedIndexRef.current = sourceIndex;
    },
    [],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent, index: number) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      if (
        draggedIndexRef.current !== null &&
        draggedIndexRef.current !== index
      ) {
        setDragOverIndex(index);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent, targetIndex: number) => {
      event.preventDefault();
      event.stopPropagation();
      setDragOverIndex(null);

      const sourceIndex = draggedIndexRef.current;
      if (sourceIndex === null || sourceIndex === targetIndex) {
        return;
      }

      setLocalSubdocuments((currentSubdocuments) => {
        const reorderedSubdocuments = [...currentSubdocuments];
        const [movedSubdocument] = reorderedSubdocuments.splice(sourceIndex, 1);
        reorderedSubdocuments.splice(targetIndex, 0, movedSubdocument);
        return reorderedSubdocuments;
      });
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    draggedIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  return (
    <>
      <div
        className={`cursor-pointer rounded-lg p-3 transition-colors ${
          summarySubdocuments.length === 0
            ? "border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100"
            : "bg-gray-50 hover:bg-gray-100"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          handleOpen();
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <Tags
            className={`h-3.5 w-3.5 ${summarySubdocuments.length === 0 ? "text-amber-600" : "text-amber-500"}`}
          />
          <span
            className={`text-[10px] font-medium ${summarySubdocuments.length === 0 ? "text-amber-800" : "text-gray-600"}`}
          >
            Subdocuments
          </span>
          <ChevronRight
            className={`ml-auto h-3 w-3 ${summarySubdocuments.length === 0 ? "text-amber-500" : "text-gray-400"}`}
          />
        </div>

        <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto pr-1">
          {summarySubdocuments.length === 0 ? (
            <span className="text-[10px] font-medium text-amber-600">
              Click to add subdocuments
            </span>
          ) : (
            summarySubdocuments.map((subdocument) => (
              <span
                key={subdocument.name}
                className="inline-flex max-w-full items-center truncate rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
              >
                {subdocument.name || "Unnamed"}
              </span>
            ))
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden sm:max-w-6xl"
          onClick={(event) => event.stopPropagation()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogHeader>
              <div className="flex flex-row items-start justify-between">
                <div>
                  <DialogTitle>Edit Subdocuments</DialogTitle>
                  <DialogDescription>
                    Define how a long document should be split into multiple
                    smaller documents.
                  </DialogDescription>
                </div>
                <div className="flex">
                  <AnimatedTabs
                    tabs={tabsConfig}
                    value={activeView}
                    onChange={handleViewChange}
                  />
                </div>
              </div>
            </DialogHeader>

            {activeView === "builder" ? (
              <div className="flex min-h-0 flex-1 flex-col space-y-3 px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Subdocuments
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSubdocument}
                    className="h-7 text-xs"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Subdocument
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-1 pr-1 pb-2">
                  {localSubdocuments.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-gray-400">
                      <span>No subdocuments defined.</span>
                      <br />
                      <span>Add one to start splitting your document.</span>
                    </div>
                  ) : (
                    localSubdocuments.map((subdocument, idx) => (
                      <div
                        key={subdocument.draft_id}
                        className="group relative rounded-lg bg-gray-50 p-3 transition-all"
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          setDragOverIndex(null);
                        }}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                      >
                        {dragOverIndex === idx &&
                          draggedIndexRef.current !== null && (
                            <div
                              className={`absolute right-0 left-0 z-10 h-0.5 transform rounded-full bg-amber-500 ${
                                draggedIndexRef.current > idx
                                  ? "top-0 -translate-y-1/2"
                                  : "bottom-0 translate-y-1/2"
                              }`}
                            />
                          )}
                        <div className="absolute top-1/2 left-1 flex h-5 w-5 -translate-y-1/2 cursor-grab items-center justify-center text-gray-300 group-hover:text-gray-500 active:cursor-grabbing">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              removeDraftSubdocument(subdocument.draft_id)
                            }
                            className="h-6 w-6 p-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="pr-10 pl-5">
                          <div className="mb-1 flex items-center gap-2">
                            <input
                              placeholder="Subdocument name"
                              value={subdocument.name}
                              onChange={(e) =>
                                updateDraftSubdocument(
                                  subdocument.draft_id,
                                  "name",
                                  e.target.value,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const descriptionTextarea =
                                    document.getElementById(
                                      `subdocument-description-${subdocument.draft_id}`,
                                    );
                                  descriptionTextarea?.focus();
                                }
                              }}
                              className="flex-1 border-none bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
                            />
                            {!subdocument.name.trim() && (
                              <span className="shrink-0 text-[10px] text-red-500">
                                Name required
                              </span>
                            )}
                          </div>
                          <AutoResizeTextarea
                            id={`subdocument-description-${subdocument.draft_id}`}
                            placeholder="Add description..."
                            value={subdocument.description}
                            onChange={(e) =>
                              updateDraftSubdocument(
                                subdocument.draft_id,
                                "description",
                                e.target.value,
                              )
                            }
                            className="min-h-[24px] w-full resize-none border-none bg-transparent text-xs text-gray-500 outline-none placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 px-6 py-4">
                <MonacoEditor
                  height="100%"
                  language="json"
                  theme="vs-dark"
                  value={editorValue || "[]"}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    automaticLayout: true,
                    fontSize: 11,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "off",
                  }}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={localSubdocuments.some((sub) => !sub.name.trim())}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Output Renderer (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export function SplitOutputRenderer(
  result: unknown,
  inputStates: InputState[],
  isProcessing: boolean,
) {
  const [documentPageCount, setDocumentPageCount] = useState<number | null>(
    null,
  );
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const pdfRef = useRef<PdfViewerHandle | null>(null);

  const splitResult = useMemo(
    () => normalizeSplitViewerResult(result),
    [result],
  );
  const hasOutput = splitResult !== null && splitResult.output.length > 0;
  const documentInput = inputStates[0];
  const fallbackDiagramPageCount = useMemo(
    () => getMaxSplitDiagramPage(splitResult),
    [splitResult],
  );
  const diagramPageCount = Math.max(
    documentPageCount ?? 0,
    fallbackDiagramPageCount,
    1,
  );

  function SplitDocumentPageCountLoaderRunner({
    fileBuffer,
    setDocumentPageCount,
  }: {
    fileBuffer: ArrayBuffer;
    setDocumentPageCount: (pageCount: number | null) => void;
  }) {
    useMountEffect(() => {
      let cancelled = false;

      void (async () => {
        try {
          const { PDFDocument } = await import("pdf-lib");
          const pdfDocument = await PDFDocument.load(fileBuffer.slice(0));

          if (!cancelled) {
            setDocumentPageCount(pdfDocument.getPageCount());
          }
        } catch {
          if (!cancelled) {
            setDocumentPageCount(null);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    });

    return null;
  }

  const documentPageCountLoaderKey = documentInput.fileBuffer
    ? `pages:${documentInput.fileBuffer.byteLength}`
    : null;
  const sourceResetKey = useMemo(
    () =>
      JSON.stringify({
        hasFileBuffer: Boolean(documentInput.fileBuffer),
        fileBufferBytes: documentInput.fileBuffer?.byteLength ?? 0,
        splitResult,
      }),
    [documentInput.fileBuffer, splitResult],
  );
  if (!documentInput.fileBuffer && documentPageCount !== null) {
    setDocumentPageCount(null);
  }

  const jumpToPreviewPage = useCallback((page: number) => {
    pdfRef.current?.scrollToPage(page);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {documentPageCountLoaderKey ? (
        <SplitDocumentPageCountLoaderRunner
          key={documentPageCountLoaderKey}
          fileBuffer={documentInput.fileBuffer!}
          setDocumentPageCount={setDocumentPageCount}
        />
      ) : null}
      {/* Content */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {!hasOutput ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            <Scissors className="h-16 w-16 text-gray-200" />
            <p className="text-center text-base text-gray-500">
              Run split to see output
            </p>
            <p className="max-w-sm text-center text-sm text-gray-400">
              Upload a document, define subdocuments, and click Run Split
            </p>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
              <section className="relative z-20 flex min-h-0 flex-none flex-col overflow-hidden">
                {isProcessing && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full bg-amber-50/95 px-3 py-1 shadow-sm ring-1 ring-amber-200 ring-inset">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                    <span className="text-xs font-medium text-amber-600">
                      Splitting...
                    </span>
                  </div>
                )}
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="relative min-h-0 flex-1">
                    <div className="h-full min-h-0">
                      <SplitSegmentDiagram
                        splitResult={splitResult}
                        pageCount={diagramPageCount}
                        currentPage={currentPdfPage}
                        onSelectSplit={() => {}}
                        onSelectVote={() => {}}
                        onJumpToPage={jumpToPreviewPage}
                        variant="panel"
                      />
                    </div>
                  </div>
                </div>
              </section>
              <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ring-1 ring-zinc-200">
                {isProcessing ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : documentInput.fileBuffer ? (
                  <SplitPdfViewerFromBuffer
                    key={sourceResetKey}
                    pdfRef={pdfRef}
                    fileBuffer={documentInput.fileBuffer}
                    pageCount={diagramPageCount}
                    splitResult={splitResult}
                    currentPage={currentPdfPage}
                    onCurrentPageChange={setCurrentPdfPage}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-sm text-zinc-500">
                      No document available
                    </span>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SplitPdfViewerFromBuffer({
  pdfRef,
  fileBuffer,
  pageCount,
  splitResult,
  currentPage,
  onCurrentPageChange,
}: {
  pdfRef: React.RefObject<PdfViewerHandle | null>;
  fileBuffer: ArrayBuffer;
  pageCount: number;
  splitResult: SplitView;
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useMountEffect(() => {
    onCurrentPageChange(1);

    const blob = new Blob([fileBuffer.slice(0)], { type: "application/pdf" });
    const nextPdfUrl = URL.createObjectURL(blob);
    setPdfUrl(nextPdfUrl);

    return () => {
      URL.revokeObjectURL(nextPdfUrl);
    };
  });

  if (!pdfUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SplitLegendStrip splitResult={splitResult} currentPage={currentPage} />
      <SplitPdfViewer
        ref={pdfRef}
        url={pdfUrl}
        pageCount={pageCount}
        onCurrentPageChange={onCurrentPageChange}
        variant="light"
      />
    </div>
  );
}

export function buildSplitLegendItems(
  splitResult: SplitView,
  currentPage: number,
) {
  const colorMap = buildSplitDiagramColorMap(splitResult);
  const legendItemsByName = new Map<
    string,
    {
      name: string;
      color: string;
      isUsed: boolean;
      isActive: boolean;
    }
  >();

  for (const split of splitResult.output) {
    const pageRuns = buildPageRuns(split.pages);
    const existing = legendItemsByName.get(split.name);
    const isUsed = pageRuns.length > 0;
    const isActive = pageRuns.some(
      (run) => currentPage >= run.start_page && currentPage < run.end_page + 1,
    );

    legendItemsByName.set(split.name, {
      name: split.name,
      color: existing?.color ?? colorMap.get(split.name) ?? "#4E79A7",
      isUsed: (existing?.isUsed ?? false) || isUsed,
      isActive: (existing?.isActive ?? false) || isActive,
    });
  }

  return Array.from(legendItemsByName.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function SplitLegendStrip({
  splitResult,
  currentPage,
}: {
  splitResult: SplitView;
  currentPage: number;
}) {
  const [isShowingAll, setIsShowingAll] = useState(false);
  const legendItems = useMemo(() => {
    return buildSplitLegendItems(splitResult, currentPage);
  }, [currentPage, splitResult]);

  const visibleLegendItems = isShowingAll
    ? legendItems
    : legendItems.filter((item) => item.isUsed);
  const hasHiddenItems = legendItems.some((item) => !item.isUsed);

  if (visibleLegendItems.length === 0) {
    return null;
  }

  return (
    <div
      className="shrink-0 border-b border-zinc-200 bg-white px-3 py-2 text-zinc-950"
      aria-label="Split legend"
    >
      <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
        {visibleLegendItems.map((item) => (
          <div key={item.name} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-5 shrink-0 border border-zinc-950/50"
              style={{ backgroundColor: item.color }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "truncate text-xs",
                    item.isActive
                      ? "font-semibold text-black"
                      : "font-normal text-gray-600",
                  )}
                >
                  {item.name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs break-words">
                {item.name}
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
      {hasHiddenItems ? (
        <button
          type="button"
          className="mt-2 text-[10px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-950 hover:underline"
          onClick={() => setIsShowingAll((showingAll) => !showingAll)}
        >
          {isShowingAll ? "Hide unused" : "Show all"}
        </button>
      ) : null}
    </div>
  );
}

export function SplitOutputViewer({
  result,
  fileBuffer,
  fileName,
  fileMimeType = "application/pdf",
  isProcessing = false,
}: {
  result: unknown;
  fileBuffer: ArrayBuffer | null | undefined;
  fileName?: string | null;
  fileMimeType?: string | null;
  isProcessing?: boolean;
}) {
  const inputStates = useMemo<InputState[]>(
    () => [
      {
        id: "document",
        type: "file",
        fileBuffer: fileBuffer ?? null,
        fileName: fileName ?? "document",
        fileMimeType: fileMimeType ?? "application/pdf",
        textValue: "",
      },
    ],
    [fileBuffer, fileName, fileMimeType],
  );

  return <>{SplitOutputRenderer(result, inputStates, isProcessing)}</>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Split Playground Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface SplitPlaygroundOptions {
  supportsLoadFromRun?: boolean;
}

export function createSplitInputs(options: SplitPlaygroundOptions = {}) {
  return [
    createFileInput("document", "Document", {
      supportsLoadFromRun: options.supportsLoadFromRun ?? true,
      fileAccept: SPLIT_SUPPORTED_FILE_ACCEPT,
    }),
  ];
}

export function createSplitSections(): ProcessingNodeSection[] {
  return [
    {
      type: "custom",
      render: (cfg, onChange) => (
        <SplitModelCard
          model={(cfg.model as string) || "retab-small"}
          onModelChange={(value) => onChange({ ...cfg, model: value })}
          nConsensus={(cfg.n_consensus as number) ?? 1}
          onConsensusChange={(n) => onChange({ ...cfg, n_consensus: n })}
        />
      ),
    },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <SubdocumentsSection
          subdocuments={(cfg.subdocuments as SplitConfigSubdocument[]) || []}
          onSubdocumentsChange={(subdocuments) =>
            onChange({ ...cfg, subdocuments })
          }
        />
      ),
    },
  ];
}

export function getSplitRequirements(
  inputStates: InputState[],
  cfg: Record<string, unknown>,
): RequirementItem[] {
  const documentState = inputStates[0];
  const hasDocument = hasInputValue(documentState);
  const subdocuments = (cfg.subdocuments as SplitConfigSubdocument[]) || [];
  const validSubdocuments = subdocuments.filter((subdoc) => subdoc.name.trim());

  return [
    {
      id: "document",
      label: "Document",
      isMet: hasDocument,
      description: hasDocument
        ? documentState.fileName || "File loaded"
        : "Upload a document",
    },
    {
      id: "subdocuments",
      label: "Subdocuments",
      isMet: validSubdocuments.length > 0,
      description:
        validSubdocuments.length > 0
          ? `${validSubdocuments.length} defined`
          : "Define subdocuments",
    },
  ];
}

export function createSplitRunHandler() {
  return async (inputStates: InputState[], cfg: Record<string, unknown>) => {
    const documentState = inputStates[0];
    const subdocuments = (cfg.subdocuments as SplitConfigSubdocument[]) || [];
    const validSubdocuments = subdocuments.filter((subdoc) =>
      subdoc.name.trim(),
    );

    if (!hasInputValue(documentState) || !documentState.fileBuffer) {
      throw new Error("Please upload a document first");
    }

    if (validSubdocuments.length === 0) {
      throw new Error("Please add at least one subdocument");
    }

    const fileName = (documentState.fileName || "").toLowerCase();
    const fileMimeType = (documentState.fileMimeType || "").toLowerCase();
    const isPdfDocument =
      fileName.endsWith(".pdf") || fileMimeType.includes("application/pdf");
    if (!isPdfDocument) {
      throw new Error("Split playground currently supports PDF files only");
    }

    const documentData: MIMEData =
      await inputStateToUrlBackedMIMEData(documentState);

    const nConsensus = (cfg.n_consensus as number) ?? 1;
    const instructions =
      typeof cfg.instructions === "string" ? cfg.instructions : "";
    const splitRequest = {
      document: documentData,
      model: (cfg.model as string) || "retab-small",
      subdocuments: validSubdocuments,
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      ...(nConsensus > 1 ? { n_consensus: nConsensus } : {}),
    };

    const response = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/splits`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(splitRequest),
      },
      {
        timeout: 600000,
        retryConfig: { maxRetries: 2, baseDelay: 2000, maxDelay: 10000 },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Split failed: ${errorText || response.statusText}`);
    }

    const result: Split = await response.json();
    const sectionCount = result.output?.length ?? 0;
    toast.success(
      `Document split into ${sectionCount} section${sectionCount !== 1 ? "s" : ""}`,
    );
    return result;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Split Playground Canvas (standalone, no dialog)
// ═══════════════════════════════════════════════════════════════════════════════

export interface SplitPlaygroundCanvasProps {
  config: SplitConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  className?: string;
  canvasId?: string;
  headerSlot?: ReactNode;
  initialInputStates?: Partial<InputState>[];
  initialResult?: Split | SplitView;
  // Workflow context (optional)
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // Options
  supportsLoadFromRun?: boolean;
  // Custom run handler (allows wrapping the default handler)
  onRun?: (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
  ) => Promise<Split>;
  // When set, hides the Run affordance (page-owned capability gate).
  runDisabledReason?: string | null;
}

export function SplitPlaygroundCanvas({
  config,
  onConfigChange,
  className,
  canvasId = "split-playground-canvas",
  headerSlot,
  initialInputStates,
  initialResult,
  blockId,
  workflowId,
  workflow,
  supportsLoadFromRun = false,
  onRun,
  runDisabledReason,
}: SplitPlaygroundCanvasProps) {
  const options: SplitPlaygroundOptions = { supportsLoadFromRun };
  const inputs = createSplitInputs(options);
  const sections = createSplitSections();
  const defaultRunHandler = useMemo(() => createSplitRunHandler(), []);
  const handleRun = onRun || defaultRunHandler;

  return (
    <PlaygroundCanvas
      blockType="split"
      title="Split"
      description="Split documents by subdocuments"
      icon={Scissors}
      color="#f59e0b"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getSplitRequirements}
      onRun={handleRun}
      renderOutput={SplitOutputRenderer}
      runButtonLabel="Run Split"
      runningLabel="Splitting..."
      className={className}
      canvasId={canvasId}
      headerSlot={headerSlot}
      initialInputStates={initialInputStates}
      initialResult={initialResult}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Split Execute Playground (dialog version for workflow blocks)
// ═══════════════════════════════════════════════════════════════════════════════

export function SplitBlockExecutionPlaygroundV2({
  open,
  onOpenChange,
  config,
  onConfigChange,
  blockId,
  workflowId,
  workflow,
  runDisabledReason,
}: SplitBlockExecutionPlaygroundProps) {
  const options: SplitPlaygroundOptions = { supportsLoadFromRun: true };
  const inputs = createSplitInputs(options);
  const sections = createSplitSections();
  const handleRun = useMemo(() => createSplitRunHandler(), []);

  return (
    <ExecutePlayground
      open={open}
      onOpenChange={onOpenChange}
      blockType="split"
      title="Split"
      description="Split documents by subdocuments"
      icon={Scissors}
      color="#f59e0b"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getSplitRequirements}
      onRun={handleRun}
      renderOutput={SplitOutputRenderer}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}
