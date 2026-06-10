"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import type { DocumentProps, PageProps } from "react-pdf";

import type { FormField } from "@/app/dashboard/widgets/types/edit";
import type { BBox } from "@/types";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getReactPdfComponents } from "@/app/dashboard/shared/pdf-utils";

type TemplateEditorPdfStageProps = {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  pdfBuffer: ArrayBuffer;
  readonly?: boolean;
  isDrawingMode?: boolean;
  onDrawingComplete?: () => void;
  hoveredFieldIndex?: number | null;
  selectedFieldIndex?: number | null;
  onSelectedFieldChange?: (index: number | null) => void;
};

function getFieldColor(type: string, isSelected: boolean, isHovered: boolean) {
  const colors = {
    text: {
      border: isSelected ? "border-blue-500" : "border-blue-400",
      bg: isSelected
        ? "bg-blue-500/20"
        : isHovered
          ? "bg-blue-400/15"
          : "bg-blue-400/10",
      handle: "bg-blue-500",
      label: "bg-blue-400",
      labelText: "text-blue-200",
    },
    checkbox: {
      border: isSelected ? "border-green-500" : "border-green-400",
      bg: isSelected
        ? "bg-green-500/20"
        : isHovered
          ? "bg-green-400/15"
          : "bg-green-400/10",
      handle: "bg-green-500",
      label: "bg-green-400",
      labelText: "text-green-200",
    },
  };
  return colors[type as keyof typeof colors] || colors.text;
}

interface DraggableBBoxProps {
  field: FormField;
  fieldIndex: number;
  pageWidth: number;
  pageHeight: number;
  isSelected: boolean;
  isHighlightedFromTable?: boolean;
  onSelect: (index: number) => void;
  onUpdate: (index: number, bbox: Partial<BBox>) => void;
  readonly?: boolean;
}

function DraggableBBox({
  field,
  fieldIndex,
  pageWidth,
  pageHeight,
  isSelected,
  isHighlightedFromTable = false,
  onSelect,
  onUpdate,
  readonly = false,
}: DraggableBBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [localBBox, setLocalBBox] = useState<Partial<BBox> | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startBBoxRef = useRef({ ...field.bbox });

  const colors = getFieldColor(
    field.type,
    isSelected || isHighlightedFromTable,
    isHovered || isHighlightedFromTable,
  );

  const displayBBox = localBBox ? { ...field.bbox, ...localBBox } : field.bbox;
  const pixelLeft = displayBBox.left * pageWidth;
  const pixelTop = displayBBox.top * pageHeight;
  const pixelWidth = displayBBox.width * pageWidth;
  const pixelHeight = displayBBox.height * pageHeight;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, action: "drag" | string) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(fieldIndex);

      if (readonly) return;

      startPosRef.current = { x: e.clientX, y: e.clientY };
      startBBoxRef.current = { ...field.bbox };

      if (action === "drag") {
        setIsDragging(true);
      } else {
        setIsResizing(action);
      }
    },
    [fieldIndex, field.bbox, onSelect, readonly],
  );

  const dragRef = useRef({
    isDragging: false,
    isResizing: null as string | null,
    localBBox: null as Partial<BBox> | null,
    pageWidth,
    pageHeight,
    fieldIndex,
    onUpdate,
  });
  dragRef.current = {
    isDragging,
    isResizing,
    localBBox,
    pageWidth,
    pageHeight,
    fieldIndex,
    onUpdate,
  };

  useMountEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const s = dragRef.current;
      if (!s.isDragging && !s.isResizing) return;
      const deltaX = (e.clientX - startPosRef.current.x) / s.pageWidth;
      const deltaY = (e.clientY - startPosRef.current.y) / s.pageHeight;

      if (s.isDragging) {
        const newLeft = Math.max(
          0,
          Math.min(
            1 - startBBoxRef.current.width,
            startBBoxRef.current.left + deltaX,
          ),
        );
        const newTop = Math.max(
          0,
          Math.min(
            1 - startBBoxRef.current.height,
            startBBoxRef.current.top + deltaY,
          ),
        );
        setLocalBBox({ left: newLeft, top: newTop });
      } else if (s.isResizing) {
        const newBBox = { ...startBBoxRef.current };
        if (s.isResizing.includes("e")) {
          newBBox.width = Math.max(
            0.01,
            Math.min(1 - newBBox.left, startBBoxRef.current.width + deltaX),
          );
        }
        if (s.isResizing.includes("w")) {
          const newWidth = Math.max(0.01, startBBoxRef.current.width - deltaX);
          const newLeft =
            startBBoxRef.current.left + startBBoxRef.current.width - newWidth;
          if (newLeft >= 0) {
            newBBox.left = newLeft;
            newBBox.width = newWidth;
          }
        }
        if (s.isResizing.includes("s")) {
          newBBox.height = Math.max(
            0.01,
            Math.min(1 - newBBox.top, startBBoxRef.current.height + deltaY),
          );
        }
        if (s.isResizing.includes("n")) {
          const newHeight = Math.max(
            0.01,
            startBBoxRef.current.height - deltaY,
          );
          const newTop =
            startBBoxRef.current.top + startBBoxRef.current.height - newHeight;
          if (newTop >= 0) {
            newBBox.top = newTop;
            newBBox.height = newHeight;
          }
        }
        setLocalBBox(newBBox);
      }
    };

    const handleMouseUp = () => {
      const s = dragRef.current;
      if (!s.isDragging && !s.isResizing) return;
      if (s.localBBox) {
        s.onUpdate(s.fieldIndex, s.localBBox);
        setLocalBBox(null);
      }
      setIsDragging(false);
      setIsResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

  const resizeHandles = ["nw", "ne", "se", "sw"];

  const getHandlePosition = (handle: string) => {
    const positions: Record<string, string> = {
      nw: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
      ne: "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
      se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
      sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    };
    return positions[handle];
  };

  return (
    <div
      className={cn(
        "absolute z-20 border-2 transition-colors",
        colors.border,
        colors.bg,
        readonly
          ? "cursor-default"
          : isDragging || isResizing
            ? "cursor-grabbing"
            : "cursor-grab",
      )}
      style={{
        left: pixelLeft,
        top: pixelTop,
        width: pixelWidth,
        height: pixelHeight,
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        handleMouseDown(e, "drag");
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "pointer-events-none absolute -top-5 -left-[2px] rounded-none px-1 py-0.5 shadow-lg transition-opacity duration-150 select-none",
          "text-2xs font-medium text-white",
          "flex items-center gap-1.5 whitespace-nowrap",
          colors.label,
          isSelected || isHovered || isHighlightedFromTable
            ? "opacity-100"
            : "opacity-0",
        )}
        title={field.description}
      >
        <span className="max-w-[250px] truncate">{field.key}</span>
        <span className={cn("flex-shrink-0 text-[10px]", colors.labelText)}>
          ({field.type})
        </span>
      </div>

      {field.combing && field.max_length && field.max_length > 1 && (
        <>
          {Array.from({ length: field.max_length - 1 }, (_, i) => (
            <div
              key={`divider-${i}`}
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-gray-400"
              style={{
                left: `${((i + 1) / field.max_length!) * 100}%`,
              }}
            />
          ))}
        </>
      )}

      {isSelected &&
        !readonly &&
        resizeHandles.map((handle) => (
          <div
            key={handle}
            className={cn(
              "absolute z-30 h-1.5 w-1.5 rounded-full border border-white shadow-sm",
              colors.handle,
              getHandlePosition(handle),
            )}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e, handle);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ))}
    </div>
  );
}

interface PdfPageWithBoxesProps {
  pageNumber: number;
  fields: FormField[];
  selectedFieldIndex: number | null;
  hoveredFieldIndex?: number | null;
  onSelectField: (index: number) => void;
  onUpdateField: (index: number, bbox: Partial<BBox>) => void;
  onAddField?: (field: FormField) => void;
  PageComponent: React.ComponentType<PageProps>;
  readonly?: boolean;
  isDrawingMode?: boolean;
  onDrawingComplete?: () => void;
}

function PdfPageWithBoxes({
  pageNumber,
  fields,
  selectedFieldIndex,
  hoveredFieldIndex,
  onSelectField,
  onUpdateField,
  onAddField,
  PageComponent,
  readonly = false,
  isDrawingMode = false,
  onDrawingComplete,
}: PdfPageWithBoxesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageAspectRatio, setPageAspectRatio] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [drawCurrent, setDrawCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth);
    return () => resizeObserver.disconnect();
  });

  const handlePageLoadSuccess = useCallback(
    (page: {
      height: number;
      width: number;
      originalHeight: number;
      originalWidth: number;
    }) => {
      setPageAspectRatio(page.originalHeight / page.originalWidth);
    },
    [],
  );

  const renderedPageHeight =
    pageAspectRatio > 0 && containerWidth > 0
      ? containerWidth * pageAspectRatio
      : 0;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingMode || readonly) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      e.preventDefault();
      e.stopPropagation();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsDrawing(true);
      setDrawStart({ x, y });
      setDrawCurrent({ x, y });
    },
    [isDrawingMode, readonly],
  );

  const drawRef = useRef({
    isDrawing,
    drawStart,
    drawCurrent,
    containerWidth,
    pageHeight: renderedPageHeight,
    pageNumber,
    fields,
    onAddField,
    onDrawingComplete,
  });
  drawRef.current = {
    isDrawing,
    drawStart,
    drawCurrent,
    containerWidth,
    pageHeight: renderedPageHeight,
    pageNumber,
    fields,
    onAddField,
    onDrawingComplete,
  };

  useMountEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const s = drawRef.current;
      if (!s.isDrawing) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(s.containerWidth, e.clientX - rect.left));
      const y = Math.max(0, Math.min(s.pageHeight, e.clientY - rect.top));
      setDrawCurrent({ x, y });
    };

    const handleMouseUp = () => {
      const s = drawRef.current;
      if (!s.isDrawing) return;
      if (s.drawStart && s.drawCurrent && s.onAddField) {
        const left =
          Math.min(s.drawStart.x, s.drawCurrent.x) / s.containerWidth;
        const top = Math.min(s.drawStart.y, s.drawCurrent.y) / s.pageHeight;
        const width =
          Math.abs(s.drawCurrent.x - s.drawStart.x) / s.containerWidth;
        const height = Math.abs(s.drawCurrent.y - s.drawStart.y) / s.pageHeight;
        if (width > 0.01 || height > 0.01) {
          const existingKeys = new Set(s.fields.map((f) => f.key));
          let keyCounter = s.fields.length + 1;
          let newKey = `field_${keyCounter}`;
          while (existingKeys.has(newKey)) {
            keyCounter += 1;
            newKey = `field_${keyCounter}`;
          }
          const newField: FormField = {
            key: newKey,
            description: "",
            type: "text",
            bbox: {
              left: Number(left.toFixed(4)),
              top: Number(top.toFixed(4)),
              width: Number(Math.max(0.01, width).toFixed(4)),
              height: Number(Math.max(0.01, height).toFixed(4)),
              page: s.pageNumber,
            },
          };
          s.onAddField(newField);
          s.onDrawingComplete?.();
        }
      }
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

  const pageFields = fields.filter((f) => f.bbox.page === pageNumber);
  const drawingPreview =
    drawStart && drawCurrent
      ? {
          left: Math.min(drawStart.x, drawCurrent.x),
          top: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full min-w-0 bg-white",
        isDrawingMode && !readonly && "cursor-crosshair",
      )}
      style={{ isolation: "isolate" }}
      onMouseDown={handleMouseDown}
    >
      {containerWidth > 0 && (
        <>
          <PageComponent
            pageNumber={pageNumber}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onLoadSuccess={handlePageLoadSuccess}
          />

          {renderedPageHeight > 0 && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {pageFields.map((field) => {
                const globalIndex = fields.findIndex(
                  (f) =>
                    f.bbox.left === field.bbox.left &&
                    f.bbox.top === field.bbox.top &&
                    f.bbox.page === field.bbox.page &&
                    f.description === field.description,
                );
                return (
                  <div
                    key={`${field.description}-${globalIndex}`}
                    className="pointer-events-auto"
                  >
                    <DraggableBBox
                      field={field}
                      fieldIndex={globalIndex}
                      pageWidth={containerWidth}
                      pageHeight={renderedPageHeight}
                      isSelected={selectedFieldIndex === globalIndex}
                      isHighlightedFromTable={hoveredFieldIndex === globalIndex}
                      onSelect={onSelectField}
                      onUpdate={onUpdateField}
                      readonly={readonly || isDrawingMode}
                    />
                  </div>
                );
              })}

              {drawingPreview && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-500/20"
                  style={{
                    left: drawingPreview.left,
                    top: drawingPreview.top,
                    width: drawingPreview.width,
                    height: drawingPreview.height,
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TemplateEditorPdfStage({
  fields,
  onChange,
  pdfBuffer,
  readonly = false,
  isDrawingMode = false,
  onDrawingComplete,
  hoveredFieldIndex,
  selectedFieldIndex,
  onSelectedFieldChange,
}: TemplateEditorPdfStageProps) {
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [ReactPdfDocument, setReactPdfDocument] =
    useState<React.ComponentType<DocumentProps> | null>(null);
  const [ReactPdfPage, setReactPdfPage] =
    useState<React.ComponentType<PageProps> | null>(null);

  useMountEffect(() => {
    getReactPdfComponents().then(({ Document, Page }) => {
      setReactPdfDocument(() => Document);
      setReactPdfPage(() => Page);
    });
  });

  const pdfUrl = useMemo(() => {
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }, [pdfBuffer]);

  const pdfUrlRef = useRef<string | null>(null);
  pdfUrlRef.current = pdfUrl;
  useMountEffect(() => () => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
    }
  });

  const handleDocumentLoadSuccess = useCallback((pdf: { numPages: number }) => {
    setNumPages(pdf.numPages);
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleDocumentLoadError = useCallback((error: Error) => {
    console.error("Failed to load PDF:", error);
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleUpdateField = useCallback(
    (index: number, bboxUpdates: Partial<BBox>) => {
      const nextFields = fields.map((field, idx) =>
        idx === index
          ? {
              ...field,
              bbox: {
                ...field.bbox,
                ...bboxUpdates,
                left: Number((bboxUpdates.left ?? field.bbox.left).toFixed(4)),
                top: Number((bboxUpdates.top ?? field.bbox.top).toFixed(4)),
                width: Number(
                  (bboxUpdates.width ?? field.bbox.width).toFixed(4),
                ),
                height: Number(
                  (bboxUpdates.height ?? field.bbox.height).toFixed(4),
                ),
              },
            }
          : field,
      );
      onChange(nextFields);
    },
    [fields, onChange],
  );

  const handleAddField = useCallback(
    (newField: FormField) => {
      onChange([...fields, newField]);
      onSelectedFieldChange?.(fields.length);
    },
    [fields, onChange, onSelectedFieldChange],
  );

  const scrollStateRef = useRef({
    lastScrolledTo: null as number | null | undefined,
    hoveredFieldIndex,
    fields,
  });
  scrollStateRef.current.hoveredFieldIndex = hoveredFieldIndex;
  scrollStateRef.current.fields = fields;

  if (
    hoveredFieldIndex !== undefined &&
    hoveredFieldIndex !== null &&
    hoveredFieldIndex !== scrollStateRef.current.lastScrolledTo
  ) {
    scrollStateRef.current.lastScrolledTo = hoveredFieldIndex;
    queueMicrotask(() => {
      const field = scrollStateRef.current.fields[hoveredFieldIndex];
      if (!field) return;
      const pageElement = pageRefs.current.get(field.bbox.page);
      if (!pageElement || !containerRef.current) return;
      const container = containerRef.current;
      const pageRect = pageElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const fieldTopInPage = field.bbox.top * pageRect.height;
      const pageOffsetTop = pageElement.offsetTop;
      const targetScrollTop =
        pageOffsetTop + fieldTopInPage - containerRect.height / 3;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
    });
  }

  if (!ReactPdfDocument || !ReactPdfPage) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      <div
        ref={containerRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto"
        onClick={() => onSelectedFieldChange?.(null)}
      >
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {hasError && (
          <div className="flex h-full items-center justify-center text-red-500">
            <p>Error loading PDF</p>
          </div>
        )}

        <ReactPdfDocument
          file={pdfUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          loading={null}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={i + 1}
                ref={(el) => {
                  if (el) pageRefs.current.set(i + 1, el);
                }}
              >
                <PdfPageWithBoxes
                  pageNumber={i + 1}
                  fields={fields}
                  selectedFieldIndex={selectedFieldIndex ?? null}
                  hoveredFieldIndex={hoveredFieldIndex}
                  onSelectField={onSelectedFieldChange ?? (() => {})}
                  onUpdateField={handleUpdateField}
                  onAddField={handleAddField}
                  PageComponent={ReactPdfPage}
                  readonly={readonly}
                  isDrawingMode={isDrawingMode}
                  onDrawingComplete={onDrawingComplete}
                />
              </div>
            ))}
          </div>
        </ReactPdfDocument>
      </div>
    </div>
  );
}
