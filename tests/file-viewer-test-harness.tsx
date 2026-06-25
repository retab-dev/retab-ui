import * as React from "react";

import type {
  FileCategory,
  ViewerSource,
} from "@/registry/new-york-v4/ui/file-viewer";
import {
  FileViewer as FileViewerFrame,
  FileViewerBody,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerProvider,
  FileViewerPreview,
  FileViewerSurface,
  FileViewerToolbar,
  FileViewerViewport,
  useFileViewerResource,
  type FileViewerProps,
  type FileViewerProviderProps,
  type FileViewerToolbarProps,
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
      <FileViewerFrame {...props} sidebarMode={mode}>
        {children ?? (
          <>
            <FileViewerHeader />
            <FileViewerBody>
              <FileViewerSurface>
                <FileViewerViewport>
                  <FileViewerDocument />
                </FileViewerViewport>
              </FileViewerSurface>
            </FileViewerBody>
          </>
        )}
      </FileViewerFrame>
    </FileViewerProvider>
  );
}

export function FileViewerTitle(props: React.ComponentProps<"span">) {
  const resource = useFileViewerResource();

  return (
    <span data-slot="file-viewer-title" title={resource.fileName} {...props}>
      {resource.fileName}
    </span>
  );
}

export function FileViewerMeta(props: React.ComponentProps<"span">) {
  const resource = useFileViewerResource();
  const metaText =
    resource.mimeType ||
    resource.descriptor.mimeType ||
    resource.descriptor.category;

  return (
    <span data-slot="file-viewer-meta" {...props}>
      {metaText}
    </span>
  );
}

export function FileViewerControls({
  position: _position,
  subtitle: _subtitle,
  title: _title,
  ...props
}: FileViewerToolbarProps & Record<string, unknown>) {
  return <FileViewerToolbar {...props} />;
}

export {
  FileViewerBody,
  FileViewerDocument,
  FileViewerFrame,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerProvider,
  FileViewerPreview,
  FileViewerSurface,
  FileViewerToolbar,
  FileViewerViewport,
};
