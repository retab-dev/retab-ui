"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useMemo,
  useState,
  useRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { prepare, layout } from "@chenglou/pretext";
import { useMountEffect } from "@/hooks/useMountEffect";
import { toast } from "sonner";
import {
  Tags,
  Plus,
  X,
  ChevronRight,
  Code,
  GripVertical,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  InputType,
} from "./execute-playground";
import type { Category } from "@/app/dashboard/widgets/types/classify";
import type { Classification } from "@/types";
import { CLASSIFIER_SUPPORTED_FILE_ACCEPT } from "./file-accepts";
import { inputStateToUrlBackedMIMEData } from "./upload-input-state";

const MonacoEditor = dynamic(
  () =>
    import("@monaco-editor/react").then(
      (componentModule) => componentModule.Editor,
    ),
  { loading: () => null },
);

const FilePreview = dynamic(
  () =>
    import("@/app/dashboard/widgets/components/file-component/file-preview"),
  { loading: () => null },
);

const ClassifierModelAdvancedSection = dynamic(
  () =>
    import(
      "@/app/dashboard/workflows/[workflowId]/shared/components/classifier-model-section"
    ).then((componentModule) => componentModule.ClassifierModelAdvancedSection),
  { loading: () => null },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Types (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ClassifierConfig {
  model: string;
  categories: Category[];
  input?: { name: string; type: "json" | "file" };
  first_n_pages?: number;
  n_consensus?: number;
}

interface ClassifierBlockExecutionPlaygroundProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ClassifierConfig;
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

interface CategoriesSectionProps {
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}

type DraftCategory = Category & {
  draft_id: string;
};

let draftIdCounter = 0;

function createDraftId() {
  draftIdCounter += 1;
  return `classifier_category_${draftIdCounter}`;
}

function createDraftCategory(category?: Partial<Category>): DraftCategory {
  return {
    draft_id: createDraftId(),
    name: category?.name ?? "",
    description: category?.description ?? "",
  };
}

function isCategorySavable(category: Pick<Category, "name">) {
  return category.name.trim().length > 0;
}

function toPersistedCategory(category: DraftCategory): Category {
  return {
    name: category.name.trim(),
    description: category.description,
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

export function ClassifierCategoriesSection({
  categories,
  onCategoriesChange,
}: CategoriesSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localCategories, setLocalCategories] = useState<DraftCategory[]>(() =>
    categories.map(createDraftCategory),
  );
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

  const summaryCategories = useMemo(
    () => categories.filter((category) => isCategorySavable(category)),
    [categories],
  );
  const persistedDrafts = useMemo(
    () => localCategories.filter(isCategorySavable).map(toPersistedCategory),
    [localCategories],
  );
  const handleEditorMount = useCallback<OnMount>((editor) => {
    editor.layout();
    requestAnimationFrame(() => {
      editor.layout();
    });
  }, []);

  const resetDraftState = useCallback(() => {
    setLocalCategories(categories.map(createDraftCategory));
    setEditorValue(JSON.stringify(categories, null, 2));
    setActiveView("builder");
    setDragOverIndex(null);
    draggedIndexRef.current = null;
  }, [categories]);

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
        setLocalCategories(
          parsed.map((category) => createDraftCategory(category)),
        );
      }
    } catch {
      // Keep raw editor state so users can repair malformed JSON.
    }
  }, []);

  const updateDraftCategory = useCallback(
    (draftId: string, field: "name" | "description", value: string) => {
      setLocalCategories((currentCategories) =>
        currentCategories.map((category) =>
          category.draft_id === draftId
            ? { ...category, [field]: value }
            : category,
        ),
      );
    },
    [],
  );

  const removeDraftCategory = useCallback((draftId: string) => {
    setLocalCategories((currentCategories) =>
      currentCategories.filter((category) => category.draft_id !== draftId),
    );
  }, []);

  const addCategory = useCallback(() => {
    setLocalCategories((currentCategories) => [
      ...currentCategories,
      createDraftCategory(),
    ]);
  }, []);

  const handleSave = useCallback(() => {
    onCategoriesChange(persistedDrafts);
    setIsDialogOpen(false);
  }, [onCategoriesChange, persistedDrafts]);

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

      setLocalCategories((currentCategories) => {
        const reorderedCategories = [...currentCategories];
        const [movedCategory] = reorderedCategories.splice(sourceIndex, 1);
        reorderedCategories.splice(targetIndex, 0, movedCategory);
        return reorderedCategories;
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
          summaryCategories.length === 0
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
            className={`h-3.5 w-3.5 ${summaryCategories.length === 0 ? "text-amber-600" : "text-teal-500"}`}
          />
          <span
            className={`text-[10px] font-medium ${summaryCategories.length === 0 ? "text-amber-800" : "text-gray-600"}`}
          >
            Categories
          </span>
          <ChevronRight
            className={`ml-auto h-3 w-3 ${summaryCategories.length === 0 ? "text-amber-500" : "text-gray-400"}`}
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {summaryCategories.length === 0 ? (
            <span className="text-[10px] font-medium text-amber-600">
              Click to add categories
            </span>
          ) : (
            summaryCategories.map((category) => (
              <span
                key={category.name}
                className="inline-flex items-center rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700"
              >
                {category.name || "Unnamed"}
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
                  <DialogTitle>Edit Classification Categories</DialogTitle>
                  <DialogDescription>
                    Define categories for document classification. The document
                    will be routed to the matching category output.
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
                    Categories
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCategory}
                    className="h-7 text-xs"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Category
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-1 pr-1 pb-2">
                  {localCategories.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-8 text-center text-sm text-gray-400">
                      No categories defined.
                    </div>
                  ) : (
                    localCategories.map((category, idx) => (
                      <div
                        key={category.draft_id}
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
                              className={`absolute right-0 left-0 z-10 h-0.5 transform rounded-full bg-teal-500 ${
                                draggedIndexRef.current > idx
                                  ? "top-0 -translate-y-1/2"
                                  : "bottom-0 translate-y-1/2"
                              }`}
                            />
                          )}
                        <div className="absolute top-1/2 left-1 flex h-5 w-5 -translate-y-1/2 cursor-grab items-center justify-center text-gray-300 group-hover:text-gray-500 active:cursor-grabbing">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDraftCategory(category.draft_id)}
                          className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <div className="pr-8 pl-5">
                          <div className="mb-1 flex items-center gap-2">
                            <input
                              placeholder="Category name"
                              value={category.name}
                              onChange={(e) =>
                                updateDraftCategory(
                                  category.draft_id,
                                  "name",
                                  e.target.value,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const descriptionTextarea =
                                    document.getElementById(
                                      `category-description-${category.draft_id}`,
                                    );
                                  descriptionTextarea?.focus();
                                }
                              }}
                              className="flex-1 border-none bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
                            />
                            {!category.name.trim() && (
                              <span className="shrink-0 text-[10px] text-red-500">
                                Name required
                              </span>
                            )}
                          </div>
                          <AutoResizeTextarea
                            id={`category-description-${category.draft_id}`}
                            placeholder="Add description (helps AI classify accurately)..."
                            value={category.description}
                            onChange={(e) =>
                              updateDraftCategory(
                                category.draft_id,
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
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
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
              disabled={localCategories.some((cat) => !cat.name.trim())}
            >
              Save Categories
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

export interface ClassifierResultViewerInput {
  type: InputType;
  fileBuffer: ArrayBuffer | null;
  fileName: string | null;
  fileMimeType: string;
  textValue: string;
}

/** Simple decision shape accepted by the viewer — works with both new and legacy types. */
export interface ClassifyResult {
  category: string;
  reasoning?: string;
}

export interface ClassifierResultViewerProps {
  result: ClassifyResult | null;
  documentInput: ClassifierResultViewerInput;
  isProcessing?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ClassifierResultViewer({
  result,
  documentInput,
  isProcessing = false,
  emptyTitle = "Run classify to see output",
  emptyDescription = "Provide input, define categories, and click Run Classify",
}: ClassifierResultViewerProps) {
  const hasOutput = result !== null;
  const hasDocument =
    documentInput.type === "file"
      ? Boolean(documentInput.fileBuffer)
      : Boolean(documentInput.textValue?.trim());
  const classification = result?.category ?? null;
  const classificationReasoning = result?.reasoning?.trim() || null;

  return (
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
                hasDocument && documentInput.fileBuffer ? (
                  <FilePreview
                    content={documentInput.fileBuffer}
                    mimeType={documentInput.fileMimeType}
                  />
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
  );
}

export function ClassifierOutputRenderer(
  result: unknown,
  inputStates: InputState[],
  isProcessing: boolean,
) {
  const raw = result as Record<string, unknown> | null;
  const classifyResult: ClassifyResult | null = raw
    ? {
        category:
          (raw.output as any)?.category ??
          (raw.classification as any)?.category ??
          "",
        reasoning:
          (raw.output as any)?.reasoning ??
          (raw.classification as any)?.reasoning ??
          "",
      }
    : null;
  const documentInput = inputStates[0];
  return (
    <ClassifierResultViewer
      result={classifyResult}
      documentInput={{
        type: documentInput.type,
        fileBuffer: documentInput.fileBuffer,
        fileName: documentInput.fileName,
        fileMimeType: documentInput.fileMimeType,
        textValue: documentInput.textValue,
      }}
      isProcessing={isProcessing}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Classifier Playground Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ClassifierPlaygroundOptions {
  supportsLoadFromRun?: boolean;
  inputType?: InputType;
  allowTypeChange?: boolean;
}

export function createClassifierInputs(
  options: ClassifierPlaygroundOptions = {},
) {
  const inputType = options.inputType || "file";
  return [
    createFileInput("document", "Document", {
      type: inputType,
      allowTypeChange: options.allowTypeChange ?? false,
      supportsLoadFromRun: options.supportsLoadFromRun ?? inputType === "file",
      fileAccept: CLASSIFIER_SUPPORTED_FILE_ACCEPT,
    }),
  ];
}

export function createClassifierSections(
  options: ClassifierPlaygroundOptions = {},
): ProcessingNodeSection[] {
  const sections: ProcessingNodeSection[] = [
    // Model + Advanced (first N pages) in one block, matching classifier block style
    {
      type: "custom",
      render: (cfg, onChange) => {
        const firstNPages =
          typeof cfg.first_n_pages === "number" && cfg.first_n_pages > 0
            ? (cfg.first_n_pages as number)
            : undefined;
        return (
          <ClassifierModelAdvancedSection
            model={(cfg.model as string) || "retab-small"}
            onModelChange={(value) => onChange({ ...cfg, model: value })}
            nConsensus={
              typeof cfg.n_consensus === "number" ? cfg.n_consensus : 1
            }
            onConsensusChange={(value) =>
              onChange({ ...cfg, n_consensus: value })
            }
            firstNPages={firstNPages}
            onFirstNPagesChange={(value) =>
              onChange({ ...cfg, first_n_pages: value })
            }
          />
        );
      },
    },
  ];

  // Add input-type section if type changes are allowed
  if (options.allowTypeChange) {
    sections.push({ type: "input-type", inputId: "document" });
  }

  // Add categories section
  sections.push({
    type: "custom",
    render: (cfg, onChange) => (
      <ClassifierCategoriesSection
        categories={(cfg.categories as Category[]) || []}
        onCategoriesChange={(categories) => onChange({ ...cfg, categories })}
      />
    ),
  });

  return sections;
}

export function getClassifierRequirements(
  inputStates: InputState[],
  cfg: Record<string, unknown>,
): RequirementItem[] {
  const documentState = inputStates[0];
  const hasInput = hasInputValue(documentState);
  const categories = (cfg.categories as Category[]) || [];
  const validCategories = categories.filter((cat) => cat.name.trim());

  return [
    {
      id: "input",
      label: "Input",
      isMet: hasInput,
      description: hasInput
        ? documentState.type === "file"
          ? documentState.fileName || "File loaded"
          : `${documentState.type} input`
        : "Upload a document",
    },
    {
      id: "categories",
      label: "Categories",
      isMet: validCategories.length > 0,
      description:
        validCategories.length > 0
          ? `${validCategories.length} defined`
          : "Define categories",
    },
  ];
}

export function createClassifierRunHandler() {
  return async (inputStates: InputState[], cfg: Record<string, unknown>) => {
    const documentState = inputStates[0];
    const categories = (cfg.categories as Category[]) || [];
    const validCategories = categories.filter((cat) => cat.name.trim());

    if (!hasInputValue(documentState)) {
      throw new Error("Please provide input first");
    }

    if (validCategories.length === 0) {
      throw new Error("Please add at least one category");
    }

    let classifyRequest: Record<string, unknown>;

    if (documentState.type === "file") {
      if (!documentState.fileBuffer) {
        throw new Error("Please upload a document first");
      }
      const documentData: MIMEData =
        await inputStateToUrlBackedMIMEData(documentState);

      classifyRequest = {
        document: documentData,
        model: (cfg.model as string) || "retab-small",
        categories: validCategories,
        ...(typeof cfg.n_consensus === "number" && cfg.n_consensus > 1
          ? { n_consensus: cfg.n_consensus }
          : {}),
        ...(typeof cfg.first_n_pages === "number" && cfg.first_n_pages > 0
          ? { first_n_pages: cfg.first_n_pages }
          : {}),
      };
    } else {
      const base64Data = Buffer.from(documentState.textValue, "utf-8").toString(
        "base64",
      );
      const dataUrl = `data:text/plain;base64,${base64Data}`;

      classifyRequest = {
        document: {
          filename: "document.txt",
          url: dataUrl,
        } satisfies MIMEData,
        model: (cfg.model as string) || "retab-small",
        categories: validCategories,
        ...(typeof cfg.n_consensus === "number" && cfg.n_consensus > 1
          ? { n_consensus: cfg.n_consensus }
          : {}),
        ...(typeof cfg.first_n_pages === "number" && cfg.first_n_pages > 0
          ? { first_n_pages: cfg.first_n_pages }
          : {}),
      };
    }

    const response = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/classifications`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classifyRequest),
      },
      {
        timeout: 600000,
        retryConfig: { maxRetries: 2, baseDelay: 2000, maxDelay: 10000 },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Classification failed: ${errorText || response.statusText}`,
      );
    }

    const result = await response.json();
    const category = result.output?.category ?? "Unknown";
    toast.success(`Classified as: ${category}`);
    return result;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Classifier Playground Canvas (standalone, no dialog)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ClassifierPlaygroundCanvasProps {
  config: ClassifierConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  className?: string;
  canvasId?: string;
  headerSlot?: ReactNode;
  initialInputStates?: Partial<InputState>[];
  initialResult?: Record<string, unknown>;
  // Workflow context (optional)
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // Options
  supportsLoadFromRun?: boolean;
  inputType?: InputType;
  allowTypeChange?: boolean;
  // Custom run handler (allows wrapping the default handler)
  onRun?: (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
  ) => Promise<Classification | Record<string, unknown>>;
  // When set, hides the Run affordance (page-owned capability gate).
  runDisabledReason?: string | null;
}

export function ClassifierPlaygroundCanvas({
  config,
  onConfigChange,
  className,
  canvasId = "classifier-playground-canvas",
  headerSlot,
  initialInputStates,
  initialResult,
  blockId,
  workflowId,
  workflow,
  supportsLoadFromRun = false,
  inputType = "file",
  allowTypeChange = false,
  onRun,
  runDisabledReason,
}: ClassifierPlaygroundCanvasProps) {
  const options: ClassifierPlaygroundOptions = {
    supportsLoadFromRun,
    inputType,
    allowTypeChange,
  };
  const inputs = createClassifierInputs(options);
  const sections = createClassifierSections(options);
  const defaultRunHandler = useMemo(() => createClassifierRunHandler(), []);
  const handleRun = onRun || defaultRunHandler;

  return (
    <PlaygroundCanvas
      blockType="classifier"
      title="Classify"
      description="Classify documents into categories"
      icon={Tags}
      color="#14b8a6"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getClassifierRequirements}
      onRun={handleRun}
      renderOutput={ClassifierOutputRenderer}
      runButtonLabel="Run Classify"
      runningLabel="Classifying..."
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
// Main Classifier Execute Playground (dialog version for workflow blocks)
// ═══════════════════════════════════════════════════════════════════════════════

export function ClassifierBlockExecutionPlaygroundV2({
  open,
  onOpenChange,
  config,
  onConfigChange,
  blockId,
  workflowId,
  workflow,
  runDisabledReason,
}: ClassifierBlockExecutionPlaygroundProps) {
  // Input definition with changeable type
  const inputType = config.input?.type || "file";
  const options: ClassifierPlaygroundOptions = {
    supportsLoadFromRun: inputType === "file",
    inputType,
    allowTypeChange: true,
  };
  const inputs = createClassifierInputs(options);
  const sections = createClassifierSections(options);
  const handleRun = useMemo(() => createClassifierRunHandler(), []);

  return (
    <ExecutePlayground
      open={open}
      onOpenChange={onOpenChange}
      blockType="classifier"
      title="Classify"
      description="Classify documents into categories"
      icon={Tags}
      color="#14b8a6"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getClassifierRequirements}
      onRun={handleRun}
      renderOutput={ClassifierOutputRenderer}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}
