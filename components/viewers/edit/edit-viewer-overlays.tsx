import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PageOverlayProps } from "@/components/ui/pdf-viewer";

import { EDIT_FIELD_ACCENTS } from "./edit-viewer-field-style";
import {
  displayEditFieldValue,
  getEditViewerPdfAreaAnchor,
  isEditFieldFilled,
} from "./edit-viewer-model";
import type { EditViewerField, EditViewerMode } from "./edit-viewer-types";

export function EditFieldOverlayLayer({
  fieldsByPage,
  pageNumber,
  mode,
  effectiveFieldKey,
  onFieldHover,
  onFieldSelect,
}: Pick<PageOverlayProps, "pageNumber"> & {
  fieldsByPage: ReadonlyMap<number, readonly EditViewerField[]>;
  mode: EditViewerMode | null;
  effectiveFieldKey: string | null;
  onFieldHover: (key: string | null) => void;
  onFieldSelect: (key: string) => void;
}) {
  const pageFields = fieldsByPage.get(pageNumber) ?? [];
  if (pageFields.length === 0) return null;

  return (
    <>
      {pageFields.map((field) => (
        <EditFieldOverlayButton
          key={field.key}
          field={field}
          active={field.key === effectiveFieldKey}
          showValue={mode === "preview"}
          onFieldHover={onFieldHover}
          onFieldSelect={onFieldSelect}
        />
      ))}
    </>
  );
}

function EditFieldOverlayButton({
  field,
  active,
  showValue,
  onFieldHover,
  onFieldSelect,
}: {
  field: EditViewerField;
  active: boolean;
  showValue: boolean;
  onFieldHover: (key: string | null) => void;
  onFieldSelect: (key: string) => void;
}) {
  const anchor = getEditViewerPdfAreaAnchor(field);
  if (!anchor) return null;

  const accent = EDIT_FIELD_ACCENTS[field.type];
  const filled = isEditFieldFilled(field);
  const value = displayEditFieldValue(field);
  const shouldShowValue = showValue && filled;
  const maxLength = field.maxLength;

  return (
    <button
      type="button"
      onMouseEnter={() => onFieldHover(field.key)}
      onMouseLeave={() => onFieldHover(null)}
      onFocus={() => onFieldHover(field.key)}
      onBlur={() => onFieldHover(null)}
      onClick={() => onFieldSelect(field.key)}
      className={cn(
        "focus-visible:ring-ring/30 pointer-events-auto absolute flex items-center overflow-hidden rounded-[2px] border px-1 text-left transition-all focus-visible:ring-[3px] focus-visible:outline-none",
        active ? "z-10 border-2 shadow-sm" : "border-dashed",
      )}
      style={{
        left: `${anchor.left}%`,
        top: `${anchor.top}%`,
        width: `${anchor.width}%`,
        height: `${anchor.height}%`,
        borderColor: accent.line,
        backgroundColor: active ? accent.tint : "transparent",
        boxShadow: active
          ? `0 0 0 3px color-mix(in oklab, ${accent.line} 22%, transparent)`
          : undefined,
      }}
      aria-label={`${field.key}, ${field.type}, ${filled ? value : "empty"}`}
    >
      {field.combing && maxLength && maxLength > 1 ? (
        <>
          {Array.from({ length: maxLength - 1 }, (_, index) => (
            <span
              key={index}
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-current opacity-35"
              style={{
                left: `${((index + 1) / maxLength) * 100}%`,
                color: accent.line,
              }}
            />
          ))}
        </>
      ) : null}
      {shouldShowValue && field.type === "checkbox" ? (
        <Check
          className="mx-auto size-3.5"
          strokeWidth={3}
          style={{ color: accent.text }}
        />
      ) : shouldShowValue ? (
        <span
          className="truncate font-mono leading-none"
          style={{
            color: accent.text,
            fontSize: "clamp(8px, 1.35cqh, 12px)",
          }}
        >
          {value}
        </span>
      ) : null}
    </button>
  );
}
