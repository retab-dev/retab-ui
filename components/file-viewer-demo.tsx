"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  FileViewer,
  FileViewerBody,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerPreview,
  FileViewerProvider,
  FileViewerSurface,
  FileViewerToolbar,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  LONG_TEXT_SAMPLE,
  LONG_TEXT_SAMPLE_FILE_NAME,
  LONG_TEXT_SAMPLE_MIME_TYPE,
} from "@/components/long-text-sample";

type DemoFile = {
  label: string;
  file: string;
  fallbackFrameSize?: { width: number; height: number };
  fallbackSlideSize?: { width: number; height: number };
  source?: "inline-text";
};

const FILES = [
  { label: "PDF", file: "spacex-prospectus.pdf" },
  {
    label: "Image",
    file: "an-image-is-worth-16x16-words-page-1.png",
    fallbackFrameSize: { width: 1224, height: 1584 },
  },
  {
    label: "TIFF",
    file: "entropy.tiff",
    fallbackFrameSize: { width: 1275, height: 1650 },
  },
  { label: "XLSX", file: "nvidia-financials-fy2024.xlsx" },
  {
    label: "PPTX",
    file: "sample-presentation.pptx",
    fallbackSlideSize: { width: 960, height: 540 },
  },
  { label: "DOCX", file: "quarterly-business-review.docx" },
  { label: "CSV", file: "sales.csv" },
  { label: "Markdown", file: "release-notes.md" },
  { label: "HTML", file: "welcome.html" },
  { label: "JSON", file: "app-config.json" },
  { label: "Code", file: "use-debounced-value.ts" },
  { label: "Text", file: "review-notes.txt", source: "inline-text" },
] as const satisfies readonly DemoFile[];

type DemoFileKey = DemoFile["file"];

const SHOWCASE_FILES = FILES.filter((file) => file.label !== "Code").map(
  (file) => (file.label === "JSON" ? { ...file, label: "Code" } : file),
);
const DOCS_DEMO_FILES = FILES.filter((file) => file.label !== "Code").map(
  (file) => (file.label === "JSON" ? { ...file, label: "Code" } : file),
);
const SHOWCASE_INITIAL_FILE_KEY =
  SHOWCASE_FILES.find((file) => file.label === "Text")?.file ??
  SHOWCASE_FILES[0].file;

function getActiveFile(files: readonly DemoFile[], active: DemoFileKey) {
  return files.find((file) => file.file === active) ?? files[0];
}

function FileTabs({
  activeFileKey,
  idPrefix,
  files = FILES,
  onChange,
  className,
}: {
  activeFileKey: DemoFileKey;
  idPrefix: string;
  files?: readonly DemoFile[];
  onChange: (file: DemoFileKey) => void;
  className?: string;
}) {
  const tabRefs = React.useRef(new Map<DemoFileKey, HTMLButtonElement>());

  const selectFile = React.useCallback(
    (file: DemoFileKey, focus = false) => {
      onChange(file);
      if (focus) tabRefs.current.get(file)?.focus();
    },
    [onChange],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, file: DemoFileKey) => {
      const index = files.findIndex((item) => item.file === file);
      if (index === -1) return;

      const lastIndex = files.length - 1;
      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = index === lastIndex ? 0 : index + 1;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = index === 0 ? lastIndex : index - 1;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = lastIndex;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextFile = files[nextIndex];
      if (nextFile) selectFile(nextFile.file, true);
    },
    [files, selectFile],
  );

  return (
    <div
      role="tablist"
      aria-label="File format"
      className={cn("flex flex-wrap gap-[3px]", className)}
    >
      {files.map((f) => (
        <button
          key={f.file}
          ref={(node) => {
            if (node) tabRefs.current.set(f.file, node);
            else tabRefs.current.delete(f.file);
          }}
          type="button"
          id={`${idPrefix}-${f.file}-tab`}
          role="tab"
          aria-selected={f.file === activeFileKey}
          aria-controls={
            f.file === activeFileKey ? `${idPrefix}-${f.file}-panel` : undefined
          }
          tabIndex={f.file === activeFileKey ? 0 : -1}
          onClick={() => selectFile(f.file)}
          onKeyDown={(event) => onKeyDown(event, f.file)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            f.file === activeFileKey
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function getFileSource(file: DemoFile) {
  return file.source === "inline-text"
    ? {
        kind: "text" as const,
        text: LONG_TEXT_SAMPLE,
        fileName: LONG_TEXT_SAMPLE_FILE_NAME,
        mimeType: LONG_TEXT_SAMPLE_MIME_TYPE,
      }
    : {
        kind: "url" as const,
        url: `/samples/${file.file}`,
        fileName: file.file,
      };
}

function FileCanvas({
  file,
  idPrefix,
  showFileHeader = true,
}: {
  file: DemoFile;
  idPrefix: string;
  showFileHeader?: boolean;
}) {
  const source = React.useMemo(() => getFileSource(file), [file]);
  const fileViewerResourceProps = {
    source,
    fallbackFrameSize: file.fallbackFrameSize,
    fallbackSlideSize: file.fallbackSlideSize,
    isolateStyles: true,
  } as const;

  return (
    <div
      id={`${idPrefix}-${file.file}-panel`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}-${file.file}-tab`}
      className="bg-background h-[min(680px,calc(100svh-10rem))] min-h-[420px] w-full overflow-hidden rounded-xl border shadow-sm"
    >
      {showFileHeader ? (
        <FileViewerProvider key={file.file} {...fileViewerResourceProps}>
          <FileViewer className="h-full">
            <FileViewerHeader>
              <FileViewerHeaderStart>
                <FileViewerIdentity />
              </FileViewerHeaderStart>
              <FileViewerHeaderEnd>
                <FileViewerToolbar />
              </FileViewerHeaderEnd>
            </FileViewerHeader>
            <FileViewerBody>
              <FileViewerSurface>
                <FileViewerViewport>
                  <FileViewerDocument />
                </FileViewerViewport>
              </FileViewerSurface>
            </FileViewerBody>
          </FileViewer>
        </FileViewerProvider>
      ) : (
        <FileViewerPreview
          key={file.file}
          {...fileViewerResourceProps}
          className="h-full"
        />
      )}
    </div>
  );
}

/** Standalone demo (docs): format tabs stacked above the viewer. */
export function FileViewerDemo() {
  const idPrefix = React.useId();
  const [active, setActive] = React.useState<DemoFileKey>(
    DOCS_DEMO_FILES[0].file,
  );
  const activeFile = getActiveFile(DOCS_DEMO_FILES, active);

  return (
    <div className="flex flex-col gap-3">
      <FileTabs
        activeFileKey={active}
        idPrefix={idPrefix}
        files={DOCS_DEMO_FILES}
        onChange={setActive}
      />
      <FileCanvas file={activeFile} idPrefix={idPrefix} />
    </div>
  );
}

/**
 * Homepage showcase variant: the format tabs live in the header (where a
 * description would sit), so the viewer box top-aligns with the neighbouring
 * Schema Builder card. The header is given a fixed height shared with that card.
 */
export function FileViewerShowcase() {
  const idPrefix = React.useId();
  const [active, setActive] = React.useState<DemoFileKey>(
    SHOWCASE_INITIAL_FILE_KEY,
  );
  const activeFile = getActiveFile(SHOWCASE_FILES, active);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-(--showcase-header-h) flex-col gap-1.5">
        <h3 className="text-foreground text-sm font-medium">File Viewer</h3>
        <FileTabs
          activeFileKey={active}
          idPrefix={idPrefix}
          files={SHOWCASE_FILES}
          onChange={setActive}
        />
      </div>
      <FileCanvas
        file={activeFile}
        idPrefix={idPrefix}
        showFileHeader={false}
      />
    </div>
  );
}
