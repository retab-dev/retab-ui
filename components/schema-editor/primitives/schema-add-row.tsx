"use client";

import { AlertCircle, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SchemaAddInputModel } from "@/components/schema-editor/primitives/schema-add-input-model";

interface SchemaAddRowProps extends SchemaAddInputModel {
  className?: string;
  disabled: boolean;
}

export function SchemaAddRow({
  className,
  disabled,
  error,
  inputLabel,
  placeholder,
  submitLabel,
  value,
  onChange,
  onSubmit,
}: SchemaAddRowProps) {
  const isSubmitDisabled = disabled || !value.trim() || Boolean(error);

  return (
    <div
      data-slot="schema-add-row"
      className={cn("flex flex-col gap-1", className)}
    >
      <div className="flex items-center gap-3">
        <Input
          aria-label={inputLabel}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (!isSubmitDisabled) onSubmit();
            }
          }}
          className={`h-8 w-40 ${error ? "border-destructive" : ""}`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitDisabled}
          className={isSubmitDisabled ? "cursor-not-allowed" : ""}
          onClick={onSubmit}
        >
          <PlusIcon className="h-4 w-4" />
          <span>{submitLabel}</span>
        </Button>
      </div>

      {error && (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
