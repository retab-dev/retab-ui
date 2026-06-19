"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ValidationErrorDisplayProps {
  validationErrors?: string | null;
  className?: string;
  /** Whether to show the full error panel or just an inline indicator. */
  variant?: "full" | "inline" | "compact";
}

export function ValidationErrorDisplay({
  validationErrors,
  className,
  variant = "full",
}: ValidationErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!validationErrors) {
    return null;
  }

  const errorItems = validationErrors.split("\n\n").filter(Boolean);

  const toggle = (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setIsExpanded(!isExpanded)}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-auto w-full justify-start gap-2 px-2 py-1.5"
      title={isExpanded ? "Collapse error details" : "Expand error details"}
    >
      {isExpanded ? (
        <ChevronDown className="size-4 shrink-0" />
      ) : (
        <ChevronRight className="size-4 shrink-0" />
      )}
      <AlertCircle className="size-4 shrink-0" />
      <span className="text-sm font-medium">
        {variant === "compact"
          ? `${errorItems.length} validation error${errorItems.length !== 1 ? "s" : ""}`
          : `Schema validation errors (${errorItems.length})`}
      </span>
    </Button>
  );

  const errorList = isExpanded ? (
    <div className="border-destructive/30 space-y-2 border-t px-3 py-2">
      {errorItems.map((error, index) => (
        <p
          key={index}
          className="text-destructive text-sm leading-relaxed break-words whitespace-pre-wrap"
        >
          {error}
        </p>
      ))}
    </div>
  ) : null;

  if (variant === "compact") {
    return (
      <div className={cn("border-destructive border-l-2", className)}>
        {toggle}
        {errorList}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-destructive bg-destructive/10 rounded-md border",
        className,
      )}
    >
      {toggle}
      {errorList}
    </div>
  );
}
