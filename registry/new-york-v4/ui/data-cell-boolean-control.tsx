"use client";

import * as React from "react";
import { CheckIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  dataCellBooleanDisplayClass,
  dataCellCheckboxDisplayClass,
} from "@/registry/new-york-v4/ui/data-cell-classes";
import {
  dataCellBooleanValueMeta,
  nextDataCellBooleanValue,
} from "@/registry/new-york-v4/ui/data-cell-boolean-value";
import type { DataCellBooleanControlProps } from "@/registry/new-york-v4/ui/data-cell-control-contract";

export function DataCellBooleanIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      data-slot="checkbox-indicator"
      className={cn(
        "flex items-center justify-center transition-none",
        checked ? "text-current" : "text-muted-foreground/72",
      )}
    >
      {checked ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <XIcon className="size-3.5" />
      )}
    </span>
  );
}

export function DataCellBooleanControl({
  kind,
  value,
  disabled = false,
  name,
  className,
  autoFocus,
  session,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onDoubleClick,
  ...props
}: DataCellBooleanControlProps) {
  const checked = Boolean(value);
  const {
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rootProps
  } = props;

  return (
    <div
      {...rootProps}
      data-slot="data-cell"
      data-kind={kind}
      data-mode="edit"
      className={cn(
        dataCellBooleanDisplayClass,
        "justify-center px-1",
        className,
      )}
    >
      <button
        type="button"
        role="checkbox"
        id={id}
        name={name}
        aria-checked={checked}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel ?? (checked ? "true" : "false")}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          dataCellCheckboxDisplayClass,
          "flex items-center justify-center",
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          const nextValue = nextDataCellBooleanValue(value);
          session.commit(nextValue, dataCellBooleanValueMeta(nextValue), {
            endEditing: false,
            markFinished: false,
          });
          onClick?.(event);
        }}
        onFocus={onFocus}
        onBlur={(event) => {
          session.end();
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Escape") return;
          session.end();
          event.currentTarget.blur();
          event.preventDefault();
        }}
        onDoubleClick={onDoubleClick}
      >
        <DataCellBooleanIndicator checked={checked} />
      </button>
    </div>
  );
}
