"use client";

import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationErrorDisplayProps {
  validationErrors?: string | null;
  className?: string;
  /**
   * Whether to show the full error panel or just an inline indicator
   */
  variant?: "full" | "inline" | "compact";
}

export function ValidationErrorDisplay({
  validationErrors,
  className,
  variant = "full",
}: ValidationErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if there are no errors
  if (!validationErrors) {
    return null;
  }

  // Parse errors into individual items for better display
  const errorItems = validationErrors.split("\n\n").filter(Boolean);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "box-border w-full max-w-full overflow-hidden border-l-2 border-destructive",
          className,
        )}
      >
        <div className="box-border flex w-full min-w-0 items-center justify-between px-3 py-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded px-1 py-1 text-left transition-colors hover:bg-background/5"
            title={
              isExpanded
                ? "Click to collapse error details"
                : "Click to expand error details"
            }
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 flex-shrink-0 text-destructive" />
            ) : (
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-destructive" />
            )}
            <AlertCircle className="h-3 w-3 flex-shrink-0 text-destructive" />
            <span className="truncate text-xs font-medium text-destructive">
              {errorItems.length} validation error
              {errorItems.length !== 1 ? "s" : ""}
            </span>
          </button>
        </div>
        {isExpanded && (
          <div className="box-border w-full overflow-hidden border-t border-destructive/30 bg-destructive/10 px-3 py-2">
            <div className="w-full max-w-full space-y-1">
              {errorItems.map((error, index) => (
                <div
                  key={index}
                  className="box-border w-full max-w-full overflow-hidden font-mono text-xs leading-relaxed break-all text-destructive"
                >
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant (default)
  return (
    <div
      className={cn(
        "box-border w-full max-w-full overflow-hidden rounded-none border border-destructive bg-destructive/10",
        className,
      )}
    >
      <div className="box-border flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded px-1 py-1 text-left text-destructive transition-colors hover:bg-destructive/10"
          title={
            isExpanded
              ? "Click to collapse error details"
              : "Click to expand error details"
          }
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            Schema validation errors ({errorItems.length})
          </span>
        </button>
      </div>
      {isExpanded && (
        <div className="box-border w-full space-y-3 overflow-hidden border-t border-destructive px-3 py-2">
          <div className="w-full max-w-full space-y-3">
            {errorItems.map((error, index) => (
              <div
                key={index}
                className="box-border w-full max-w-full overflow-hidden text-sm leading-relaxed break-all whitespace-pre-wrap [overflow-wrap:anywhere] text-destructive"
              >
                {error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
