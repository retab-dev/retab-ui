"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SchemaInlineText } from "@/components/schema-editor/primitives/schema-inline-text";

interface SchemaInlineDescriptionProps {
  ariaLabel: string;
  editable: boolean;
  value: string;
  placeholder?: string;
  onOpenDetails?: () => void;
  onCommit: (value: string) => void;
}

export function SchemaInlineDescription({
  ariaLabel,
  editable,
  value,
  placeholder = "Add description",
  onOpenDetails,
  onCommit,
}: SchemaInlineDescriptionProps) {
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  const [inputFocused, setInputFocused] = React.useState(false);

  const description = (
    <SchemaInlineText
      ariaLabel={ariaLabel}
      editable={editable}
      value={value}
      placeholder={placeholder}
      className="text-muted-foreground placeholder:text-muted-foreground/70 hover:bg-accent hover:text-foreground focus:text-foreground m-0 h-6 min-w-[140px] flex-1 cursor-text rounded-sm border-none bg-transparent px-1 !text-xs leading-6 shadow-none outline-none focus-visible:ring-0"
      readOnlyClassName="flex h-6 min-w-[140px] flex-1 items-center truncate rounded-sm px-1 !text-xs text-muted-foreground"
      onOpenReadOnly={onOpenDetails}
      onCommit={onCommit}
    />
  );

  if (!value) return description;

  return (
    <Tooltip open={tooltipOpen && !inputFocused} onOpenChange={setTooltipOpen}>
      {/* SchemaInlineText drops unknown props, so the trigger needs a real DOM element */}
      <TooltipTrigger
        asChild
        onFocusCapture={() => setInputFocused(true)}
        onBlurCapture={() => setInputFocused(false)}
      >
        <span className="flex min-w-0 flex-1 items-center">{description}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="text-muted-foreground mb-1 text-xs">Description:</div>
        <div className="text-xs">{value}</div>
      </TooltipContent>
    </Tooltip>
  );
}
