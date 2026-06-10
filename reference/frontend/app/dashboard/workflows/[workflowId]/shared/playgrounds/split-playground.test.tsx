import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import "@/test/setup-dom";
import type { SplitView } from "@/app/dashboard/widgets/types/split";
import type { InputState } from "./execute-playground";
import {
  buildSplitLegendItems,
  normalizeSplitViewerResult,
  SplitOutputRenderer,
} from "./split-playground";

const splitResult: SplitView = {
  output: [
    { name: "Invoice", pages: [1, 2], partitions: [] },
    { name: "Receipt", pages: [3], partitions: [] },
  ],
  consensus: {
    likelihoods: null,
    choices: [],
  },
  usage: { credits: 0 },
};

const inputStates: InputState[] = [
  {
    id: "document",
    type: "file",
    fileBuffer: null,
    fileName: "sample.pdf",
    fileMimeType: "application/pdf",
    textValue: "",
  },
];

function SplitOutputFixture() {
  return <>{SplitOutputRenderer(splitResult, inputStates, false)}</>;
}

describe("SplitOutputRenderer", () => {
  test("normalizes legacy split results for the shared viewer", () => {
    expect(
      normalizeSplitViewerResult({
        splits: [
          { name: "Invoice", pages: [1, 2, "bad", 0] },
          { name: "Receipt", pages: [3] },
        ],
      }),
    ).toMatchObject({
      output: [
        { name: "Invoice", pages: [1, 2], partitions: [] },
        { name: "Receipt", pages: [3], partitions: [] },
      ],
    });
  });

  test("does not install selection-driven jump controls in the split output path", async () => {
    const source = await Bun.file(
      import.meta.path.replace(/\.test\.tsx$/, ".tsx"),
    ).text();

    expect(source).not.toContain("DropdownMenu");
    expect(source).not.toContain("SplitPendingJumpRunner");
    expect(source).not.toContain("selectedSubdocument");
    expect(source).toContain('variant="panel"');
    expect(source).not.toContain('variant="header"');
    expect(source).not.toContain("trackCurrentPage={false}");
    expect(source).not.toContain("handleCopyToClipboard");
    expect(source).not.toContain("handleDownload");
    expect(source).not.toContain("Download document");
  });

  test("renders the playground split viewer without a subdocument picker", () => {
    const html = renderToStaticMarkup(<SplitOutputFixture />);

    expect(html).not.toContain("Select a subdocument");
    expect(html).not.toContain("Full document");
    expect(html).not.toContain("Invoice /");
    expect(html).not.toContain("Receipt /");
  });

  test("wires the PDF scroll page into the single progress diagram", async () => {
    const source = await Bun.file(
      import.meta.path.replace(/\.test\.tsx$/, ".tsx"),
    ).text();
    const renderedDiagramVariants =
      source.match(/variant="(?:panel|header)"/g) ?? [];

    expect(renderedDiagramVariants).toEqual(['variant="panel"']);
    expect(source).toContain("onCurrentPageChange={setCurrentPdfPage}");
    expect(source).not.toContain(
      "onValueChange={setSelectedSplitDiagramRowId}",
    );
    expect(source).not.toContain("selectedRowId={selectedSplitDiagramRow?.id}");
    expect(source).not.toContain("<Select");
    expect(source).not.toContain("<SelectTrigger");
    expect(source).toContain(
      "<SplitLegendStrip splitResult={splitResult} currentPage={currentPage} />",
    );
    expect(source).toContain("grid grid-cols-4");
    expect(source).toContain("font-semibold text-black");
    expect(source).toContain("font-normal text-gray-600");
    expect(source).toContain("<TooltipTrigger asChild>");
    expect(source).toContain(
      '<TooltipContent side="bottom" className="max-w-xs break-words">',
    );
    expect(source).toContain("Show all");
    expect(source).toContain("Hide unused");
    expect(source).toContain("buildPageRuns(split.pages)");
    expect(source).not.toContain("canvasOverlay=");
    expect(source).toContain("buildSplitDiagramColorMap(splitResult)");
    expect(source).toContain("pdfRef.current?.scrollToPage(page)");
    expect(source).not.toContain("onScrollProgressChange");
    expect(source).not.toContain("pdfScrollProgress");
  });

  test("deduplicates repeated split labels in the legend", () => {
    const items = buildSplitLegendItems(
      {
        output: [
          { name: "supplement", pages: [1], partitions: [] },
          { name: "supplement", pages: [2], partitions: [] },
          { name: "misc_form", pages: [], partitions: [] },
          { name: "misc_form", pages: [3], partitions: [] },
        ],
        consensus: null,
        usage: { credits: 0 },
      },
      2,
    );

    expect(items.map((item) => item.name)).toEqual(["misc_form", "supplement"]);
    expect(items.find((item) => item.name === "supplement")).toMatchObject({
      isUsed: true,
      isActive: true,
    });
    expect(items.find((item) => item.name === "misc_form")).toMatchObject({
      isUsed: true,
      isActive: false,
    });
  });

  test("renders the subdocument definition code editor without Monaco wrapping", async () => {
    const source = await Bun.file(
      import.meta.path.replace(/\.test\.tsx$/, ".tsx"),
    ).text();

    expect(source).toContain('wordWrap: "off"');
  });

  test("does not expose duplicate split instances in the workflow split playground editor", async () => {
    const source = await Bun.file(
      import.meta.path.replace(/\.test\.tsx$/, ".tsx"),
    ).text();

    expect(source).not.toContain("Allow multiple");
    expect(source).not.toContain("allow_multiple_instances");
  });

  test("uses a large flex subdocuments editor dialog", async () => {
    const source = await Bun.file(
      import.meta.path.replace(/\.test\.tsx$/, ".tsx"),
    ).text();

    expect(source).toContain(
      "flex h-[90vh] max-h-[90vh] flex-col overflow-hidden sm:max-w-6xl",
    );
    expect(source).toContain(
      'div className="flex min-h-0 flex-1 flex-col overflow-hidden"',
    );
    expect(source).toContain('height="100%"');
  });
});
