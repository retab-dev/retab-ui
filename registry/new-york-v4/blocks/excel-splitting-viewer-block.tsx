"use client";

import * as React from "react";
import { FileSpreadsheet, TableProperties } from "lucide-react";

import { cn } from "@/lib/utils";
import { CsvViewerDocument } from "@/components/ui/csv-viewer";
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
import { XlsxViewer } from "@/components/ui/xlsx-viewer";
import { SEGMENT_PALETTE } from "@/lib/segments";
import csvOutputs from "@/components/viewers/sample-data/excel-splitting.json";

const WORKBOOK_ID = "workbook";
const WORKBOOK_NAME = "nvidia-financials-fy2024.xlsx";
const XLSX_URL = "/samples/nvidia-financials-fy2024.xlsx";

const WORKBOOK_SOURCE = {
  kind: "url" as const,
  url: XLSX_URL,
  fileName: WORKBOOK_NAME,
};

type CsvId = keyof typeof csvOutputs;

/**
 * One CSV the Excel splitter emitted. `sheetLabel` is the workbook sheet it was
 * carved from; `enrichment` is the reconstruction step that turned that raw
 * sheet into a clean, partition-ready table. The CSV text itself lives in the
 * sample-data JSON, keyed by `id`.
 */
type CsvOutput = {
  id: CsvId;
  fileName: string;
  sheetLabel: string;
  enrichment: string;
};

const CSV_OUTPUTS: CsvOutput[] = [
  {
    id: "income-statement",
    fileName: "income-statement.csv",
    sheetLabel: "Consolidated Statements of Income",
    enrichment: "Period columns flattened to one header",
  },
  {
    id: "comprehensive-income",
    fileName: "comprehensive-income.csv",
    sheetLabel: "Consolidated Statements of Comprehensive Income",
    enrichment: "Section banners kept as label rows",
  },
  {
    id: "balance-sheet",
    fileName: "balance-sheet.csv",
    sheetLabel: "Consolidated Balance Sheets",
    enrichment: "Merged title cell dropped",
  },
  {
    id: "shareholders-equity",
    fileName: "shareholders-equity.csv",
    sheetLabel: "Consolidated Statements of Shareholders' Equity",
    enrichment: "Equity-component matrix melted to columns",
  },
  {
    id: "cash-flows",
    fileName: "cash-flows.csv",
    sheetLabel: "Consolidated Statements of Cash Flows",
    enrichment: "Blank filler cells cleared",
  },
];

// Stable {kind:"text"} source per CSV so selecting one swaps the document
// without re-creating the viewer resource on every render.
const CSV_SOURCE_BY_ID = new Map(
  CSV_OUTPUTS.map((output) => [
    output.id,
    {
      kind: "text" as const,
      text: csvOutputs[output.id],
      fileName: output.fileName,
    },
  ]),
);

function csvShape(id: CsvId) {
  const lines = csvOutputs[id].split("\n");
  return { rows: lines.length, cols: lines[0]?.split(",").length ?? 0 };
}

function outputColor(index: number) {
  return SEGMENT_PALETTE[index % SEGMENT_PALETTE.length];
}

/**
 * Excel splitting block — one Excel workbook fanned out into several clean CSVs.
 * A left sidebar lists the source workbook first, then every CSV the splitter
 * emitted. Selecting an entry swaps the main viewer to that document: the XLSX
 * viewer for the workbook, the CSV viewer for each output.
 */
export function ExcelSplittingViewerBlock() {
  const [activeId, setActiveId] = React.useState<string>(WORKBOOK_ID);
  const isWorkbook = activeId === WORKBOOK_ID;
  const activeSource = isWorkbook
    ? WORKBOOK_SOURCE
    : CSV_SOURCE_BY_ID.get(activeId as CsvId)!;

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
                  Source workbook &rarr; {CSV_OUTPUTS.length} CSVs
                </p>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                <li>
                  <WorkbookRow
                    active={isWorkbook}
                    onSelect={() => setActiveId(WORKBOOK_ID)}
                  />
                </li>
                <li>
                  <p className="text-muted-foreground/70 border-y px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
                    Reconstructed CSVs
                  </p>
                </li>
                {CSV_OUTPUTS.map((output, index) => {
                  const { rows, cols } = csvShape(output.id);
                  return (
                    <li key={output.id}>
                      <CsvOutputRow
                        output={output}
                        color={outputColor(index)}
                        rows={rows}
                        cols={cols}
                        active={output.id === activeId}
                        onSelect={() => setActiveId(output.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            </FileViewerSidebarContent>
          </FileViewerSidebar>
          <FileViewerInset>
            <FileViewerViewport>
              {isWorkbook ? (
                <XlsxViewer
                  source={WORKBOOK_SOURCE}
                  bare
                  controls={false}
                  fallbackSheetTabs
                  className="h-full"
                />
              ) : (
                <CsvViewerDocument
                  source={activeSource}
                  fillHeight
                  controls={false}
                  className="h-full"
                />
              )}
            </FileViewerViewport>
          </FileViewerInset>
        </FileViewerContent>
      </FileViewer>
    </FileViewerProvider>
  );
}

/** The source workbook — the first sidebar entry. */
function WorkbookRow({
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
      <FileSpreadsheet className="text-muted-foreground size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate font-mono text-sm">
          {WORKBOOK_NAME}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          Source workbook
        </span>
      </span>
    </button>
  );
}

/** One reconstructed CSV in the sidebar. */
function CsvOutputRow({
  output,
  color,
  rows,
  cols,
  active,
  onSelect,
}: {
  output: CsvOutput;
  color: string;
  rows: number;
  cols: number;
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
          <TableProperties className="size-3" />
          {rows}&times;{cols}
        </span>
      </div>
      <div className="text-muted-foreground truncate pl-[18px] text-xs">
        {output.sheetLabel}
      </div>
      <div className="text-muted-foreground/80 truncate pl-[18px] text-[11px]">
        {output.enrichment}
      </div>
    </button>
  );
}
