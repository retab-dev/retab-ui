"use client";

import * as React from "react";

import { FileThumbnail } from "@/components/ui/file-thumbnail";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const sampleFile = {
  name: "loan-application.pdf",
  type: "application/pdf",
};

export function FileThumbnailTooltipDemo() {
  return (
    <div className="flex min-h-44 items-center justify-center p-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full max-w-xs items-center gap-3 rounded-lg border p-3 text-left shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <FileThumbnail
              file={sampleFile}
              previewImageUrl="/samples/loan-application-page-1.png"
              thumbnailShape="square"
              className="w-12 shrink-0 bg-white shadow-sm ring-1 ring-black/5"
              previewClassName="object-contain bg-white"
              presentation="decorative"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                loan-application.pdf
              </span>
              <span className="text-muted-foreground block text-xs">
                PDF - 1 page
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={12}
          className="overflow-visible bg-transparent p-0 shadow-none [&>span]:hidden [&>svg]:hidden"
        >
          <FileThumbnail
            file={sampleFile}
            previewImageUrl="/samples/loan-application-page-1.png"
            thumbnailShape="document"
            className="w-44 bg-white shadow-xl ring-1 ring-black/10"
            previewClassName="object-contain bg-white"
          />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
