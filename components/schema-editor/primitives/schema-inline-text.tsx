"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

interface SchemaInlineTextProps {
  ariaLabel: string;
  editable: boolean;
  value: string;
  className?: string;
  errorClassName?: string;
  placeholder?: string;
  readOnlyClassName?: string;
  trimOnCommit?: boolean;
  validate?: (value: string) => string | null;
  onCommit: (value: string) => void;
  onOpenReadOnly?: () => void;
}

export function SchemaInlineText({
  ariaLabel,
  editable,
  value,
  className,
  errorClassName,
  placeholder,
  readOnlyClassName,
  trimOnCommit = true,
  validate = () => null,
  onCommit,
  onOpenReadOnly,
}: SchemaInlineTextProps) {
  const isFocusedRef = React.useRef(false);
  const draftValueRef = React.useRef(value);
  const [inputResetVersion, setInputResetVersion] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  useKeyedMountEffect(joinEffectKey([value]), () => {
    if (isFocusedRef.current || draftValueRef.current === value) return;
    draftValueRef.current = value;
    setInputResetVersion((version) => version + 1);
  });

  const normalizeValue = (nextValue: string) =>
    trimOnCommit ? nextValue.trim() : nextValue;

  const commitValue = (input: HTMLInputElement) => {
    const nextValue = normalizeValue(input.value);
    const nextError = validate(nextValue);
    if (nextError) {
      setError(nextError);
      return false;
    }

    setError(null);
    isFocusedRef.current = false;
    draftValueRef.current = nextValue;
    input.value = nextValue;
    if (nextValue !== normalizeValue(value)) {
      onCommit(nextValue);
    }
    return true;
  };

  if (!editable) {
    return (
      <span className={readOnlyClassName} onClick={onOpenReadOnly}>
        {value || (
          <span className="text-muted-foreground/70">{placeholder}</span>
        )}
      </span>
    );
  }

  return (
    <span className="relative flex min-w-0 items-center">
      <input
        key={inputResetVersion}
        aria-label={ariaLabel}
        aria-invalid={Boolean(error)}
        className={className}
        data-slot="schema-inline-input"
        placeholder={placeholder}
        defaultValue={value}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          draftValueRef.current = nextValue;
          setError(nextValue ? validate(normalizeValue(nextValue)) : null);
        }}
        onBlur={(event) => {
          commitValue(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            if (commitValue(event.currentTarget)) event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            draftValueRef.current = value;
            event.currentTarget.value = value;
            setError(null);
            isFocusedRef.current = false;
            event.currentTarget.blur();
          }
        }}
      />
      {error && (
        <p
          className={cn(
            "bg-background text-destructive absolute top-7 left-1 z-10 flex min-w-56 items-center gap-1 rounded-sm border px-2 py-1 text-xs shadow-sm",
            errorClassName,
          )}
        >
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </span>
  );
}
