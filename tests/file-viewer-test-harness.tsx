import * as React from "react";

import type {
  FileCategory,
  ViewerSource,
} from "@/registry/new-york-v4/ui/file-viewer-core";
import {
  FileViewer as FileViewerShell,
  FileViewerContent,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerTitle,
  FileViewerProvider,
  FileViewerPreview,
  FileViewerInset,
  FileViewerControls,
  FileViewerViewport,
  type FileViewerProps,
  type FileViewerProviderProps,
} from "@/registry/new-york-v4/ui/file-viewer";

type FileViewerHarnessProps = Omit<FileViewerProps, "sidebarMode"> &
  Pick<
    FileViewerProviderProps,
    | "fallbackFrameSize"
    | "fallbackSlideSize"
    | "isolateStyles"
    | "onSidebarOpenChange"
    | "sidebarOpen"
  > & {
    as?: FileCategory;
    bare?: boolean;
    category?: FileCategory;
    defaultOpen?: boolean;
    mode?: FileViewerProps["sidebarMode"];
    source: ViewerSource;
  };

export function FileViewerHarness({
  as,
  bare = false,
  category,
  children,
  defaultOpen,
  fallbackFrameSize,
  fallbackSlideSize,
  isolateStyles,
  mode,
  onSidebarOpenChange,
  sidebarOpen,
  source,
  ...props
}: FileViewerHarnessProps) {
  const resolvedCategory = category ?? as;

  if (bare) {
    return (
      <FileViewerPreview
        category={resolvedCategory}
        fallbackFrameSize={fallbackFrameSize}
        fallbackSlideSize={fallbackSlideSize}
        isolateStyles={isolateStyles}
        source={source}
        className={props.className}
      />
    );
  }

  return (
    <FileViewerProvider
      category={resolvedCategory}
      defaultSidebarOpen={defaultOpen}
      fallbackFrameSize={fallbackFrameSize}
      fallbackSlideSize={fallbackSlideSize}
      isolateStyles={isolateStyles}
      onSidebarOpenChange={onSidebarOpenChange}
      sidebarOpen={sidebarOpen}
      source={source}
    >
      <FileViewerShell {...props} sidebarMode={mode}>
        {children ?? (
          <>
            <FileViewerHeader />
            <FileViewerContent>
              <FileViewerInset>
                <FileViewerViewport>
                  <FileViewerDocument />
                </FileViewerViewport>
              </FileViewerInset>
            </FileViewerContent>
          </>
        )}
      </FileViewerShell>
    </FileViewerProvider>
  );
}

export {
  FileViewerContent,
  FileViewerDocument,
  FileViewerShell,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerTitle,
  FileViewerProvider,
  FileViewerPreview,
  FileViewerInset,
  FileViewerControls,
  FileViewerViewport,
};
