"use client";

import * as React from "react";
import { FileText, WrapText } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  FileViewer,
  FileViewerContent,
  FileViewerControls,
  FileViewerHeader,
  FileViewerInset,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { TextViewer } from "@/components/ui/text-viewer";
import { SEGMENT_PALETTE } from "@/lib/segments";
import txtOutputs from "@/components/viewers/sample-data/txt-splitting.json";

const SOURCE_ID = "source";
const SOURCE_NAME = "intake-batch.txt";
const TEXT_URL = "/samples/intake-batch.txt";

const SOURCE_SOURCE = {
  kind: "url" as const,
  url: TEXT_URL,
  fileName: SOURCE_NAME,
};

type TxtId = keyof typeof txtOutputs;

/**
 * One document the text splitter carved out of the batch file. `kind` is the
 * document type it was classified as; `detection` is the boundary cue that
 * separated it from its neighbours. The document text itself lives in the
 * sample-data JSON, keyed by `id`.
 */
type TxtOutput = {
  id: TxtId;
  fileName: string;
  kind: string;
  detection: string;
};

const TXT_OUTPUTS: TxtOutput[] = [
  {
    id: "cover-letter",
    fileName: "cover-letter.txt",
    kind: "Cover letter",
    detection: "Salutation and signature block",
  },
  {
    id: "invoice",
    fileName: "invoice.txt",
    kind: "Invoice",
    detection: "Invoice number and line-item table",
  },
  {
    id: "delivery-receipt",
    fileName: "delivery-receipt.txt",
    kind: "Delivery receipt",
    detection: "Received-by header and gate pass",
  },
  {
    id: "purchase-order",
    fileName: "purchase-order.txt",
    kind: "Purchase order",
    detection: "PO number and not-to-exceed amount",
  },
];

// Stable {kind:"text"} source per document so selecting one swaps the viewer
// without re-creating the resource on every render.
const TXT_SOURCE_BY_ID = new Map(
  TXT_OUTPUTS.map((output) => [
    output.id,
    {
      kind: "text" as const,
      text: txtOutputs[output.id],
      fileName: output.fileName,
    },
  ]),
);

function lineCount(id: TxtId) {
  return txtOutputs[id].split("\n").length;
}

function outputColor(index: number) {
  return SEGMENT_PALETTE[index % SEGMENT_PALETTE.length];
}

/**
 * Text splitting block — one plain-text batch file separated into several
 * documents. A left sidebar lists the source file first, then every document
 * the splitter carved out. Selecting an entry swaps the viewer to that
 * document: the full batch file for the source, each carved-out text otherwise.
 */
export function TxtSplittingViewerBlock() {
  const [activeId, setActiveId] = React.useState<string>(SOURCE_ID);
  const isSource = activeId === SOURCE_ID;
  const activeSource = isSource
    ? SOURCE_SOURCE
    : TXT_SOURCE_BY_ID.get(activeId as TxtId)!;

  return (
    <FileViewerProvider source={activeSource} defaultSidebarOpen>
      <FileViewer className="bg-background h-full min-h-[680px]">
        <FileViewerHeader>
          <FileViewerSidebarTrigger className="-ms-1" />
          <FileViewerTitle />
          <FileViewerControls />
        </FileViewerHeader>
        <FileViewerContent>
          <FileViewerSidebar
            aria-label="Split output"
            side="left"
            width="300px"
          >
            <FileViewerSidebarContent className="gap-0 p-0">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">Split output</p>
                <p className="text-muted-foreground text-xs">
                  Source file &rarr; {TXT_OUTPUTS.length} documents
                </p>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                <li>
                  <SourceRow
                    active={isSource}
                    onSelect={() => setActiveId(SOURCE_ID)}
                  />
                </li>
                <li>
                  <p className="text-muted-foreground/70 border-y px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
                    Split documents
                  </p>
                </li>
                {TXT_OUTPUTS.map((output, index) => (
                  <li key={output.id}>
                    <TxtOutputRow
                      output={output}
                      color={outputColor(index)}
                      lines={lineCount(output.id)}
                      active={output.id === activeId}
                      onSelect={() => setActiveId(output.id)}
                    />
                  </li>
                ))}
              </ul>
            </FileViewerSidebarContent>
          </FileViewerSidebar>
          <FileViewerInset>
            <FileViewerViewport>
              <TextViewer
                source={activeSource}
                bare
                controls={false}
                mode="text"
                className="h-full"
              />
            </FileViewerViewport>
          </FileViewerInset>
        </FileViewerContent>
      </FileViewer>
    </FileViewerProvider>
  );
}

/** The source batch file — the first sidebar entry. */
function SourceRow({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-ring relative flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active ? "bg-muted/60" : "hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "bg-foreground absolute inset-y-0 left-0 w-0.5 transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <FileText className="text-muted-foreground size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate font-mono text-sm">
          {SOURCE_NAME}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          Source file
        </span>
      </span>
    </button>
  );
}

/** One carved-out document in the sidebar. */
function TxtOutputRow({
  output,
  color,
  lines,
  active,
  onSelect,
}: {
  output: TxtOutput;
  color: string;
  lines: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-ring relative flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active ? "bg-muted/60" : "hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-foreground truncate font-mono text-sm">
          {output.fileName}
        </span>
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 font-mono text-[11px]">
          <WrapText className="size-3" />
          {lines} lines
        </span>
      </div>
      <div className="text-muted-foreground truncate pl-[18px] text-xs">
        {output.kind}
      </div>
      <div className="text-muted-foreground/80 truncate pl-[18px] text-[11px]">
        {output.detection}
      </div>
    </button>
  );
}
