"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FormField } from "@/app/dashboard/widgets/types/edit";
import type { BBox } from "@/types";
import { FileSpreadsheet, Loader2 } from "lucide-react";

type BBoxKey = keyof BBox;

export interface TemplateEditorProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  pdfBuffer?: ArrayBuffer | null;
  readonly?: boolean;
  isDrawingMode?: boolean;
  onDrawingComplete?: () => void;
  hoveredFieldIndex?: number | null;
  selectedFieldIndex?: number | null;
  onSelectedFieldChange?: (index: number | null) => void;
}

const normalizedKeys: Array<Exclude<BBoxKey, "page">> = [
  "left",
  "top",
  "width",
  "height",
];

const TemplateEditorPdfStage = dynamic(
  () =>
    import("./template-editor-pdf-stage").then(
      (importedModule) => importedModule.TemplateEditorPdfStage,
    ),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

export function TemplateEditor({
  fields,
  onChange,
  pdfBuffer,
  readonly = false,
  isDrawingMode = false,
  onDrawingComplete,
  hoveredFieldIndex,
  selectedFieldIndex: controlledSelectedIndex,
  onSelectedFieldChange,
}: TemplateEditorProps) {
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<
    number | null
  >(null);

  const selectedFieldIndex =
    controlledSelectedIndex !== undefined
      ? controlledSelectedIndex
      : internalSelectedIndex;

  const setSelectedFieldIndex = useCallback(
    (index: number | null) => {
      setInternalSelectedIndex(index);
      onSelectedFieldChange?.(index);
    },
    [onSelectedFieldChange],
  );

  const handleFullFieldUpdate = useCallback(
    (index: number, updates: Partial<FormField>) => {
      const nextFields = fields.map((field, idx) =>
        idx === index ? { ...field, ...updates } : field,
      );
      onChange(nextFields);
    },
    [fields, onChange],
  );

  if (!pdfBuffer) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-white">
        <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-3">
          <FileSpreadsheet className="h-4 w-4 text-gray-600" />
          <div>
            <p className="text-sm font-medium text-gray-800">Template editor</p>
            <p className="text-xs text-gray-500">
              Upload a PDF to edit bounding boxes visually.
            </p>
          </div>
        </div>
        <ScrollArea className="flex-1 px-4 py-3">
          {fields.length === 0 ? (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center py-10 text-center text-sm">
              <FileSpreadsheet className="mb-3 h-10 w-10 text-gray-300" />
              <p>No fields detected yet.</p>
              <p className="text-xs">
                Run the inference pipeline to start editing template boxes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <FormFieldCard
                  key={`${field.description}-${index}`}
                  field={field}
                  index={index}
                  onChange={(updates) => handleFullFieldUpdate(index, updates)}
                  readonly={readonly}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <TemplateEditorPdfStage
      fields={fields}
      onChange={onChange}
      pdfBuffer={pdfBuffer}
      readonly={readonly}
      isDrawingMode={isDrawingMode}
      onDrawingComplete={onDrawingComplete}
      hoveredFieldIndex={hoveredFieldIndex}
      selectedFieldIndex={selectedFieldIndex}
      onSelectedFieldChange={setSelectedFieldIndex}
    />
  );
}

interface FormFieldCardProps {
  field: FormField;
  index: number;
  onChange: (updates: Partial<FormField>) => void;
  readonly?: boolean;
}

function FormFieldCard({
  field,
  index,
  onChange,
  readonly = false,
}: FormFieldCardProps) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const getDraftKey = (axis: BBoxKey) => `${index}-${axis}`;

  const getInputValue = (axis: BBoxKey): string => {
    const key = getDraftKey(axis);
    if (draftValues[key] !== undefined) {
      return draftValues[key];
    }
    const rawValue = field.bbox[axis];
    if (rawValue === undefined || rawValue === null) {
      return "";
    }
    return String(rawValue);
  };

  const handleChange = (axis: BBoxKey, rawValue: string) => {
    const key = getDraftKey(axis);
    setDraftValues((prev) => ({ ...prev, [key]: rawValue }));

    const sanitized = rawValue.trim();
    if (
      sanitized === "" ||
      sanitized === "-" ||
      sanitized === "." ||
      sanitized === "-." ||
      sanitized.endsWith(".")
    ) {
      return;
    }

    const parsed = Number(sanitized);
    if (Number.isNaN(parsed)) {
      return;
    }

    const clamped =
      axis === "page"
        ? Math.max(1, Math.round(parsed))
        : clampNormalized(parsed);

    if (field.bbox[axis] === clamped) {
      return;
    }

    onChange({ bbox: { ...field.bbox, [axis]: clamped } });
  };

  const handleBlur = (axis: BBoxKey) => {
    const key = getDraftKey(axis);
    if (!(key in draftValues)) {
      return;
    }

    const parsed = Number(draftValues[key]);
    if (!Number.isNaN(parsed)) {
      const normalized =
        axis === "page"
          ? Math.max(1, Math.round(parsed))
          : clampNormalized(parsed);
      if (field.bbox[axis] !== normalized) {
        onChange({ bbox: { ...field.bbox, [axis]: normalized } });
      }
    }

    setDraftValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Badge
            variant={field.type === "checkbox" ? "secondary" : "outline"}
            className="w-fit text-xs"
          >
            {field.type}
          </Badge>
          <p className="text-sm text-gray-700">{field.description}</p>
        </div>
        <span className="text-muted-foreground text-xs">
          Field #{index + 1}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {normalizedKeys.map((axis) => (
          <div key={axis} className="space-y-1">
            <Label className="text-xs text-gray-500 uppercase">{axis}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={getInputValue(axis)}
              onChange={(e) => handleChange(axis, e.target.value)}
              onBlur={() => handleBlur(axis)}
              placeholder="0.00"
              disabled={readonly}
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500 uppercase">page</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={getInputValue("page")}
            onChange={(e) => handleChange("page", e.target.value)}
            onBlur={() => handleBlur("page")}
            placeholder="1"
            disabled={readonly}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-[11px]">
        Left/Top/Width/Height accept values between 0 and 1. Page numbers must
        be positive integers.
      </p>
    </div>
  );
}

const clampNormalized = (value: number) => {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
};
