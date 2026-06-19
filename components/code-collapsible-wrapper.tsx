"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CodeHeaderCopyButton } from "@/components/copy-button";
import { getIconForLanguageExtension } from "@/components/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

export function CodeCollapsibleWrapper({
  className,
  children,
  collapsedContent,
  copyValue,
  language = "tsx",
  title,
  renderContentWhenCollapsed = true,
  ...props
}: React.ComponentProps<typeof Collapsible> & {
  collapsedContent?: React.ReactNode;
  copyValue?: string;
  language?: string;
  title?: string;
  renderContentWhenCollapsed?: boolean;
}) {
  const [isOpened, setIsOpened] = React.useState(false);
  const closedContent =
    collapsedContent ?? (renderContentWhenCollapsed ? children : null);

  return (
    <Collapsible
      open={isOpened}
      onOpenChange={setIsOpened}
      className={cn(
        "group/collapsible bg-code relative overflow-hidden rounded-lg md:-mx-1",
        className,
      )}
      {...props}
    >
      <div className="bg-code text-code-foreground flex min-h-10 items-center justify-between gap-3 px-3">
        <div className="[&_svg]:text-code-foreground flex min-w-0 items-center gap-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:opacity-70">
          {getIconForLanguageExtension(language)}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex shrink-0 items-center">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                buttonVariants({ size: "sm", variant: "ghost" }),
                "text-muted-foreground h-7 rounded-md px-2",
              )}
            >
              {isOpened ? "Collapse" : "Expand"}
            </button>
          </CollapsibleTrigger>
          <Separator orientation="vertical" className="mx-1.5 h-4!" />
          {copyValue ? <CodeHeaderCopyButton value={copyValue} /> : null}
        </div>
      </div>
      {isOpened ? (
        <CollapsibleContent className="relative overflow-hidden data-open:h-auto [&>figure]:mt-0 [&>figure]:md:mx-0!">
          {children}
        </CollapsibleContent>
      ) : (
        <div className="relative h-64 max-h-64 overflow-hidden [&>figure]:mt-0 [&>figure]:md:mx-0!">
          {closedContent}
        </div>
      )}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground absolute inset-x-0 bottom-0 flex h-24 items-end justify-center rounded-b-lg bg-transparent pb-4 text-sm group-data-open/collapsible:hidden"
          style={{
            background:
              "linear-gradient(to top, var(--color-code), color-mix(in oklab, var(--color-code) 68%, transparent), transparent)",
          }}
        >
          {isOpened ? "Collapse" : "Expand"}
        </button>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
