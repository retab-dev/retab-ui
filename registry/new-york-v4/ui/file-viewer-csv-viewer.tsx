"use client";

import * as React from "react";

import { inferCsvDialect } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { ViewerResource } from "@/lib/viewer-resource";

const CsvResourceContent = React.lazy(() =>
  import("@/components/ui/csv-viewer").then((m) => ({
    default: m.CsvResourceContent,
  })),
);

export function CsvFileContent({
  resource,
  className,
  bare,
  controls = false,
  isolateStyles,
}: {
  resource: ViewerResource;
  className?: string;
  bare?: boolean;
  controls?: boolean;
  isolateStyles?: boolean;
}) {
  const dialect = inferCsvDialect({
    src: resource.content.directUrl ?? undefined,
    fileName: resource.fileName,
    mimeType: resource.mimeType,
  });
  return (
    <div
      data-slot="csv-file-viewer-content"
      className={cn(
        "bg-card flex min-h-0 flex-1 flex-col overflow-hidden",
        bare ? "h-full" : "min-h-64",
        className,
      )}
    >
      <CsvResourceContent
        resource={resource}
        dialect={dialect}
        fillHeight
        controls={controls}
        isolateStyles={isolateStyles}
      />
    </div>
  );
}
