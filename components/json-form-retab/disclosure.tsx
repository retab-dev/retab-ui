"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Wraps a label element so a field description shows as a hover tooltip on the
 * label itself rather than a body-text block that changes row height.
 */
export function WithDescription({
  text,
  children,
}: {
  text?: string;
  children: React.ReactElement;
}) {
  if (!text) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-left whitespace-pre-line">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function DisclosureHeader({
  open,
  onToggle,
  title,
  summary,
  description,
  labelSuffix,
  actions,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary?: string;
  description?: string;
  labelSuffix?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={summary ? `${title} ${summary}` : title}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <ChevronRight
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <WithDescription text={description}>
          <span className="truncate text-sm font-medium">{title}</span>
        </WithDescription>
        {labelSuffix}
        {summary ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {summary}
          </span>
        ) : null}
      </button>
      {actions}
    </div>
  );
}
